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

    constructor() { }

    public async resumeContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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

            this.source.connect(this.processor);
            this.processor.connect(this.audioContext!.destination);

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

    private async processQueue() {
        if (this.isPlaying || this.playQueue.length === 0 || !this.audioContext) return;

        this.isPlaying = true;

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

            // Add a 50ms safety buffer to the start time to handle jitter
            const now = this.audioContext.currentTime;
            const startTime = Math.max(now + 0.05, this.nextStartTime);

            source.start(startTime);
            this.nextStartTime = startTime + buffer.duration;

            // Wait for this chunk to end before processing next or handle via scheduling
            // For smoother playback, we schedule ahead without blocking the loop
            // but we need to know when the entire queue is empty to reset isPlaying.
        }

        // Simple heuristic: set isPlaying to false after the scheduled time passes
        setTimeout(() => {
            this.isPlaying = false;
            if (this.playQueue.length > 0) this.processQueue();
        }, (this.nextStartTime - this.audioContext.currentTime) * 1000);
    }

    public clearPlayback() {
        this.playQueue = [];
        this.nextStartTime = 0;
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
