// Golden Ladle Kitchen — all sounds are synthesized live with WebAudio:
// short oscillator blips and a filtered-noise sizzle. No audio files, no
// network, and nothing copied from anywhere else.

export function createAudio() {
  let context = null;
  let muted = false;
  let sizzleNodes = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, dur, type, volume, when = 0, slideTo = null) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, volume, filterFreq) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  }

  return {
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopSizzle();
      return muted;
    },
    unlock() {
      ensure();
    },
    pop() {
      tone(520, 0.09, 'sine', 0.18, 0, 780);
    },
    chop() {
      noiseBurst(0.08, 0.5, 900);
      tone(180, 0.07, 'triangle', 0.22, 0, 90);
    },
    sizzleStart() {
      if (muted) return;
      const ctx = ensure();
      if (!ctx || sizzleNodes) return;
      const length = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 3200;
      const gain = ctx.createGain();
      gain.gain.value = 0.035;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      sizzleNodes = { source, gain };
    },
    stopSizzle() {
      if (!sizzleNodes) return;
      try {
        sizzleNodes.gain.gain.value = 0;
        sizzleNodes.source.stop();
      } catch {
        // Already stopped.
      }
      sizzleNodes = null;
    },
    ding() {
      tone(880, 0.25, 'sine', 0.2);
      tone(1318, 0.3, 'sine', 0.14, 0.07);
    },
    serve() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, i * 0.09));
    },
    error() {
      tone(160, 0.22, 'square', 0.12, 0, 110);
    },
    walkout() {
      tone(392, 0.16, 'triangle', 0.16, 0, 311);
      tone(311, 0.26, 'triangle', 0.16, 0.16, 233);
    },
    tick() {
      tone(980, 0.05, 'square', 0.07);
    },
    fanfare() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, i * 0.11));
      tone(1568, 0.5, 'sine', 0.16, 0.55);
    },
  };
}
