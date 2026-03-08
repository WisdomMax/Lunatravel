/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class AudioStreamer {
    private audioContext: AudioContext | null = null;
    private processor: ScriptProcessorNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private stream: MediaStream | null = null;
    private playQueue: Int16Array[] = [];
    private isPlaying = false;
    private nextStartTime = 0;
    private activeSources: AudioBufferSourceNode[] = [];
    private playbackTimeout: number | undefined;

    constructor() { }

    public async resumeContext() {
        if (!this.audioContext) {
            // [근본 해결책 4: 피치 왜곡 및 브라우저 기본 샘플레이트 불일치 원천 차단]
            // Gemini API는 기본적으로 24kHz 오디오를 내려보냅니다.
            // 브라우저의 AudioContext가 시스템 기본값(예: 44.1kHz, 48kHz)으로 생성되면
            // 우리가 Float32Array를 24000 버퍼에 밀어넣을 때 브라우저가 강제로 샘플레이트를 변환하며
            // "무~슨~말~이~야" 처럼 소리가 늘어지거나 깨지는 피치 변형이 발생합니다.
            // 따라서 AudioContext 자체를 24000Hz로 고정 생성합니다.
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            try {
                this.audioContext = new AudioContextClass({ sampleRate: 24000 });
            } catch (e) {
                console.warn("Failed to create AudioContext with specific sampleRate. Falling back to default.");
                this.audioContext = new AudioContextClass();
            }
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    public async startRecording(onAudio: (base64: string) => void) {
        try {
            await this.resumeContext();
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            this.source = this.audioContext!.createMediaStreamSource(this.stream);
            this.processor = this.audioContext!.createScriptProcessor(4096, 1, 1);

            const dummyNode = this.audioContext!.createGain();
            dummyNode.gain.value = 0;

            this.source.connect(this.processor);
            this.processor.connect(dummyNode);
            dummyNode.connect(this.audioContext!.destination);

            this.processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = this.downsampleAndConvertToPCM16(inputData, this.audioContext!.sampleRate, 16000);
                const base64 = this.base64Encode(pcm16);
                onAudio(base64);
            };
        } catch (error) {
            console.error("Failed to start recording:", error);
            throw error;
        }
    }

    public stopRecording() {
        this.processor?.disconnect();
        this.source?.disconnect();
        this.stream?.getTracks().forEach(track => track.stop());
        this.processor = null;
        this.source = null;
        this.stream = null;
    }

    public async playAudioChunk(base64: string) {
        await this.resumeContext();

        // Decoding base64 string provided by Gemini Live API
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Gemini Live API usually returns 24kHz PCM16, so 2 bytes per sample.
        // Ensure buffer length is even for Int16Array view.
        const buffer = bytes.buffer.byteLength % 2 === 0
            ? bytes.buffer
            : bytes.buffer.slice(0, bytes.buffer.byteLength - 1);

        const pcm16 = new Int16Array(buffer);
        this.playQueue.push(pcm16);
        this.processQueue();
    }

    public stopAll() {
        if (this.playbackTimeout !== undefined) {
            window.clearTimeout(this.playbackTimeout);
            this.playbackTimeout = undefined;
        }
        this.playQueue = [];
        this.activeSources.forEach(source => {
            try {
                source.stop();
                source.disconnect();
            } catch (e) {
                // Ignore if already stopped
            }
        });
        this.activeSources = [];
        this.nextStartTime = 0;
        this.isPlaying = false;
    }

    public clearPlayback() {
        this.stopAll();
    }

    // 마이크 강제 음소거 메서드 제거 (양방향 Interrupt 허용)

    private async processQueue() {
        if (this.playQueue.length === 0 || !this.audioContext) return;

        // 즉시 재생 상태로 진입 (마이크 차단 해제 - 양방향 통신 허용)
        if (!this.isPlaying) {
            this.isPlaying = true;
        }

        while (this.playQueue.length > 0) {
            const pcm16 = this.playQueue.shift()!;
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768;
            }

            const buffer = this.audioContext.createBuffer(1, float32.length, 24000);
            buffer.getChannelData(0).set(float32);

            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);

            this.activeSources.push(source);
            source.onended = () => {
                this.activeSources = this.activeSources.filter(s => s !== source);
            };

            const now = this.audioContext.currentTime;
            // 과거 시간으로 밀려있을 경우 현재 시간에 마진을 두어 지터 방지, 아니면 이어서 재생
            if (this.nextStartTime < now) {
                this.nextStartTime = now + 0.01;
            }

            source.start(this.nextStartTime);
            this.nextStartTime += buffer.duration;
        }

        // 스케줄링이 모두 끝난 지점부터(this.nextStartTime) 잔향 마진 시간(200ms) 추가
        // 계속 오디오 조각이 도착하면 기존 타이머를 취소하고 스케줄을 계속 갱신(Push back)합니다.
        if (this.playbackTimeout !== undefined) {
            window.clearTimeout(this.playbackTimeout);
        }

        const now = this.audioContext.currentTime;
        const delay = Math.max(0, (this.nextStartTime - now) * 1000) + 200;

        this.playbackTimeout = window.setTimeout(() => {
            this.isPlaying = false;
            this.nextStartTime = 0;
            this.playbackTimeout = undefined;
        }, delay);
    }

    private downsampleAndConvertToPCM16(buffer: Float32Array, sampleRate: number, targetRate: number): Int16Array {
        const ratio = sampleRate / targetRate;
        const newLength = Math.round(buffer.length / ratio);
        const result = new Int16Array(newLength);
        for (let i = 0; i < newLength; i++) {
            const idx = Math.round(i * ratio);
            const sample = Math.max(-1, Math.min(1, buffer[idx]));
            result[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        return result;
    }

    private base64Encode(buffer: Int16Array): string {
        const uint8 = new Uint8Array(buffer.buffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        return btoa(binary);
    }
}
