// 轻量音效：使用 Web Audio 合成，无需外部资源文件
let audioCtx = null;
let enabled = true;

function getCtx() {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function tone({ freq = 440, duration = 0.12, type = 'sine', gain = 0.06, delay = 0, slideTo = null }) {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const start = ctx.currentTime + delay;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);

    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
}

export const sound = {
    setEnabled(value) {
        enabled = value;
        if (value) getCtx();
    },
    isEnabled() {
        return enabled;
    },
    click() {
        tone({ freq: 660, duration: 0.06, type: 'triangle', gain: 0.04 });
    },
    place() {
        tone({ freq: 320, slideTo: 180, duration: 0.14, type: 'triangle', gain: 0.07 });
    },
    flip(count = 1) {
        const n = Math.min(count, 6);
        for (let i = 0; i < n; i++) {
            tone({
                freq: 520 + i * 70,
                duration: 0.09,
                type: 'sine',
                gain: 0.045,
                delay: i * 0.045
            });
        }
    },
    win() {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
            tone({ freq: f, duration: 0.22, type: 'triangle', gain: 0.07, delay: i * 0.11 })
        );
    },
    lose() {
        [392, 329.63, 261.63].forEach((f, i) =>
            tone({ freq: f, duration: 0.26, type: 'sine', gain: 0.06, delay: i * 0.12 })
        );
    }
};

export default sound;