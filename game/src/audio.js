// Synthesised sound: every effect and the music loop are built with WebAudio, so the
// game ships no audio files and never touches the network. The context is created on
// the first user gesture; everything is a no-op before that.

const NOTE = {
  A1: 55, C2: 65.41, D2: 73.42, E2: 82.41, G1: 49, G2: 98,
  A2: 110, B2: 123.47, C3: 130.81, E3: 164.81, G3: 196,
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.pickupCombo = 0;
    this.pickupAt = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone({ freq, freqEnd, type = 'sine', at = 0, dur = 0.1, vol = 0.2, slide = false }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined) {
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(freqEnd, t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise({ at = 0, dur = 0.2, vol = 0.2, freq = 1200, q = 0.8 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + at;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t0);
  }

  click() { this.tone({ freq: 660, freqEnd: 520, type: 'triangle', dur: 0.06, vol: 0.16 }); }

  shoot() {
    this.tone({ freq: 920, freqEnd: 420, type: 'square', dur: 0.07, vol: 0.07, slide: true });
  }

  hit() { this.noise({ dur: 0.04, vol: 0.1, freq: 2400 }); }

  pickup() {
    const now = performance.now();
    this.pickupCombo = now - this.pickupAt < 900 ? Math.min(this.pickupCombo + 1, 12) : 0;
    this.pickupAt = now;
    const base = 620 * Math.pow(1.059, this.pickupCombo);
    this.tone({ freq: base, type: 'sine', dur: 0.09, vol: 0.12 });
    this.tone({ freq: base * 1.5, at: 0.03, type: 'sine', dur: 0.08, vol: 0.08 });
  }

  heal() {
    this.tone({ freq: 520, type: 'sine', dur: 0.12, vol: 0.14 });
    this.tone({ freq: 780, at: 0.08, type: 'sine', dur: 0.14, vol: 0.12 });
  }

  levelUp() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.tone({ freq, at: i * 0.07, type: 'triangle', dur: 0.16, vol: 0.18 });
    });
  }

  hurt() {
    this.tone({ freq: 130, freqEnd: 70, type: 'sawtooth', dur: 0.18, vol: 0.22, slide: true });
    this.noise({ dur: 0.12, vol: 0.14, freq: 500 });
  }

  explode() {
    this.noise({ dur: 0.4, vol: 0.3, freq: 900, q: 0.5 });
    this.tone({ freq: 90, freqEnd: 40, type: 'sine', dur: 0.35, vol: 0.25, slide: true });
  }

  nova() {
    this.tone({ freq: 300, freqEnd: 1200, type: 'sine', dur: 0.22, vol: 0.14, slide: true });
    this.noise({ dur: 0.18, vol: 0.1, freq: 1800 });
  }

  boss() {
    this.tone({ freq: 65, freqEnd: 130, type: 'sawtooth', dur: 0.7, vol: 0.22, slide: true });
    this.noise({ dur: 0.5, vol: 0.16, freq: 300, q: 0.4 });
  }

  victory() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      this.tone({ freq, at: i * 0.11, type: 'triangle', dur: 0.3, vol: 0.18 });
    });
  }

  defeat() {
    [392, 311, 233, 175].forEach((freq, i) => {
      this.tone({ freq, at: i * 0.16, type: 'triangle', dur: 0.28, vol: 0.16 });
    });
  }

  startMusic() {
    if (this.musicTimer) return;
    // A slow A-minor loop: one bass note and a sparse pluck per eighth step.
    const bass = [NOTE.A1, NOTE.A1, NOTE.C2, NOTE.E2, NOTE.A1, NOTE.G1, NOTE.E2, NOTE.D2];
    const pluck = [NOTE.A2, 0, NOTE.C3, 0, NOTE.E3, 0, NOTE.G3, NOTE.B2];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.musicStep % 8;
      const bar = Math.floor(this.musicStep / 8) % 2;
      const bassNote = bass[step] * (bar === 1 ? 1 : 1);
      this.musicNote(bassNote, 0.5, 'triangle', 0.2);
      const pluckNote = pluck[(step + bar * 3) % 8];
      if (pluckNote) this.musicNote(pluckNote * 2, 0.22, 'sine', 0.07);
      this.musicStep += 1;
    }, 240);
  }

  musicNote(freq, dur, type, vol) {
    if (!this.ctx || !this.musicGain) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}
