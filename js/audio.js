// Tiny procedural WebAudio engine — no external audio files.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.enabled = true;
    this.musicTimer = null;
    this.step = 0;
    this.started = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.55 : 0;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.11;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.15, slide = null, delay = 0, dest = null }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide != null) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  noise({ dur = 0.18, gain = 0.18, freq = 1200, type = 'lowpass', delay = 0, dest = null }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest || this.sfxGain);
    src.start(t0);
  }

  click() {
    this.tone({ freq: 620, dur: 0.055, type: 'square', gain: 0.06 });
    this.tone({ freq: 940, dur: 0.04, type: 'square', gain: 0.035, delay: 0.035 });
  }

  card() {
    this.noise({ dur: 0.22, gain: 0.09, freq: 2200, type: 'highpass' });
    this.tone({ freq: 320, slide: 720, dur: 0.18, type: 'triangle', gain: 0.06 });
  }

  tick() {
    this.tone({ freq: 1100, dur: 0.03, type: 'square', gain: 0.035 });
  }

  countdown(final = false) {
    this.tone({ freq: final ? 880 : 440, dur: 0.12, type: 'square', gain: 0.08 });
  }

  success(perfect = false) {
    const notes = perfect ? [523, 659, 784, 1047, 1319] : [523, 659, 784];
    notes.forEach((f, i) => {
      this.tone({ freq: f, dur: 0.2, type: 'triangle', gain: 0.13, delay: i * 0.075 });
      this.tone({ freq: f * 2, dur: 0.12, type: 'sine', gain: 0.045, delay: i * 0.075 });
    });
    if (perfect) this.noise({ dur: 0.5, gain: 0.05, freq: 6000, type: 'highpass', delay: 0.2 });
  }

  fail() {
    this.tone({ freq: 240, slide: 90, dur: 0.4, type: 'sawtooth', gain: 0.09 });
    this.tone({ freq: 170, slide: 60, dur: 0.45, type: 'square', gain: 0.06, delay: 0.04 });
  }

  slap() {
    this.noise({ dur: 0.09, gain: 0.5, freq: 1800, type: 'bandpass' });
    this.tone({ freq: 140, slide: 45, dur: 0.22, type: 'sine', gain: 0.42 });
    this.noise({ dur: 0.18, gain: 0.16, freq: 500, type: 'lowpass', delay: 0.02 });
  }

  whoosh() {
    this.noise({ dur: 0.22, gain: 0.08, freq: 900, type: 'bandpass' });
  }

  roundStart() {
    [392, 523, 659].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.18, type: 'square', gain: 0.07, delay: i * 0.09 })
    );
    this.noise({ dur: 0.35, gain: 0.07, freq: 400, type: 'lowpass' });
  }

  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    this.started = true;
    const bass = [55, 55, 65.4, 73.4, 55, 82.4, 73.4, 65.4];
    const chords = [
      [220, 261.6, 329.6],
      [196, 246.9, 293.7],
      [174.6, 220, 261.6],
      [196, 246.9, 329.6]
    ];
    const stepMs = 280;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
      const s = this.step % 16;
      if (s % 4 === 0) {
        this.tone({ freq: 110, slide: 42, dur: 0.16, type: 'sine', gain: 0.2, dest: this.musicGain });
      }
      if (s % 2 === 0) {
        this.tone({ freq: bass[(s / 2) % bass.length], dur: 0.22, type: 'triangle', gain: 0.075, dest: this.musicGain });
      }
      if (s === 0 || s === 6 || s === 10) {
        const c = chords[Math.floor(this.step / 16) % chords.length];
        c.forEach((f) => this.tone({ freq: f, dur: 0.13, type: 'square', gain: 0.022, dest: this.musicGain }));
      }
      if (s % 2 === 1) {
        this.noise({ dur: 0.035, gain: 0.025, freq: 7000, type: 'highpass', dest: this.musicGain });
      }
      if (s === 4 || s === 12) {
        this.noise({ dur: 0.09, gain: 0.06, freq: 1400, type: 'bandpass', dest: this.musicGain });
      }
      this.step++;
    }, stepMs);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
