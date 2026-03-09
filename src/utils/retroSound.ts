export class RetroSound {
    private static ctx: AudioContext | null = null;

    private static init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    static unlockAudioContext() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    static playHover() {
        this.init();
        if (!this.ctx || this.ctx.state !== 'running') return;

        // 아주 낮고 조용한 '툭' 소리 (고급 UI 호버음)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime); // 낮은 주파수
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.03, this.ctx.currentTime); // 볼륨도 작게
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    static playClick() {
        this.init();
        if (!this.ctx) return;

        // 맑고 부드러운 '톡' (선택음, 물방울 떨어지는 듯한 느낌)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    static playSuccess() {
        this.init();
        if (!this.ctx) return;

        // 신비롭고 부드러운 화음 (마치 마법이 걸리는 듯한 느낌)
        const now = this.ctx.currentTime;
        const notes = [220, 277.18, 329.63, 440]; // A3, C#4, E4, A4 (따뜻한 A Major 화음)

        notes.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.05); // 약간의 딜레이로 부드럽게 펼쳐짐

            gain.gain.setValueAtTime(0, now + i * 0.05);
            gain.gain.linearRampToValueAtTime(0.05, now + i * 0.05 + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.6); // 긴 여운

            osc.connect(gain);
            gain.connect(this.ctx!.destination);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.6);
        });
    }

    static playBoot() {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // 묵직하고 장엄한 시작음 (베이스가 강한 화음이 서서히 커졌다가 사라짐)
        const notes = [110, 164.81, 220, 329.63]; // A2, E3, A3, E4 (매우 낮은 옥타브 추가)

        notes.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);

            gain.gain.setValueAtTime(0, now + i * 0.1);
            // 서서히 커지는 어택 (웅장함 연출)
            gain.gain.linearRampToValueAtTime(0.06, now + i * 0.1 + 0.4);
            // 길고 부드럽게 사라지는 릴리즈
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 2.0);

            osc.connect(gain);
            gain.connect(this.ctx!.destination);

            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 2.0);
        });
    }
}
