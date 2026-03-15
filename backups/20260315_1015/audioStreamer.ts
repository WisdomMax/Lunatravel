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
    private isMuted = false; 
    private onStatusChange: ((isPlaying: boolean) => void) | null = null;

    constructor() { }

    public setStatusCallback(callback: (isPlaying: boolean) => void) {
        this.onStatusChange = callback;
    }

    /** AI가 말하는 동안 마이크 스트림을 서버에 보내지 않도록 음소거 */
    public muteRecording() {
        this.isMuted = true;
        console.log('[AudioStreamer] Mic muted (AI is speaking)');
    }

    /** AI가 말을 멈추거나 인터럽트 시 마이크 재활성화 */
    public unmuteRecording() {
        this.isMuted = false;
        console.log('[AudioStreamer] Mic unmuted (Ready for user input)');
    }


    public async resumeContext() {
        if (!this.audioContext) {
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
                if (this.isMuted) return; 
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
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
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
            }
        });
        this.activeSources = [];
        this.nextStartTime = 0;
        this.isPlaying = false;
        this.onStatusChange?.(false);
    }

    public clearPlayback() {
        this.stopAll();
    }

    private async processQueue() {
        if (this.playQueue.length === 0 || !this.audioContext) return;

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.onStatusChange?.(true);
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
            if (this.nextStartTime < now) {
                this.nextStartTime = now + 0.01;
            }

            source.start(this.nextStartTime);
            this.nextStartTime += buffer.duration;
        }

        if (this.playbackTimeout !== undefined) {
            window.clearTimeout(this.playbackTimeout);
        }

        const now = this.audioContext.currentTime;
        const delay = Math.max(0, (this.nextStartTime - now) * 1000) + 200;

        this.playbackTimeout = window.setTimeout(() => {
            this.isPlaying = false;
            this.nextStartTime = 0;
            this.playbackTimeout = undefined;
            this.onStatusChange?.(false);
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
