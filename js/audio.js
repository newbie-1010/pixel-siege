// Retro sound effects generated with the Web Audio API (no audio files).
// Browsers only allow sound after the player interacts, so init() runs on the
// first key press or click.

const SFX = {
  ctx: null,
  out: null,
  noiseBuf: null,
  muted: false,
  volume: 0.22,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.muted ? 0 : this.volume;
      this.out.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.8);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.ctx = null;
    }
  },

  setMuted(m) {
    this.muted = m;
    if (this.out) this.out.gain.value = m ? 0 : this.volume;
  },

  tone(type, f0, f1, dur, vol, delay) {
    const c = this.ctx;
    if (!c || this.muted) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, vol, freq, delay) {
    const c = this.ctx;
    if (!c || this.muted || !this.noiseBuf) return;
    const t = c.currentTime + (delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(80, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t); src.stop(t + dur + 0.02);
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shoot': this.tone('square', 900, 300, 0.06, 0.16); break;
      case 'enemyShoot': this.tone('triangle', 420, 160, 0.14, 0.28); break;
      case 'hit': this.tone('square', 260, 110, 0.05, 0.18); break;
      case 'explode': this.noise(0.25, 0.5, 1800); this.tone('square', 150, 40, 0.2, 0.18); break;
      case 'bigExplode': this.noise(0.8, 0.7, 2600); this.tone('sawtooth', 120, 30, 0.7, 0.3); break;
      case 'hurt': this.tone('sawtooth', 320, 60, 0.25, 0.3); break;
      case 'charge': this.tone('sawtooth', 90, 320, 0.5, 0.18); break;
      case 'boss': this.tone('sawtooth', 90, 35, 1.0, 0.35); this.noise(0.7, 0.3, 700); break;
      case 'select': this.tone('square', 660, 660, 0.04, 0.12); break;
      case 'pickup': [660, 880, 1320].forEach((f, i) => this.tone('square', f, f, 0.07, 0.15, i * 0.06)); break;
      case 'clear': [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.12, 0.18, i * 0.11)); break;
      case 'gameover': [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.97, 0.24, 0.3, i * 0.2)); break;
    }
  },
};
