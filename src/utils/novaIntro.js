export function playNovaIntro() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const now = ctx.currentTime;

  // MASTER
  const master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);

  // ==========================
  // SUB HIT
  // ==========================
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(45, now);
  sub.frequency.exponentialRampToValueAtTime(28, now + 0.8);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, now);
  subGain.gain.exponentialRampToValueAtTime(1.2, now + 0.02);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

  sub.connect(subGain);
  subGain.connect(master);

  sub.start(now);
  sub.stop(now + 1);

  // ==========================
  // RISING SYNTH
  // ==========================
  const rise = ctx.createOscillator();
  rise.type = "sawtooth";
  rise.frequency.setValueAtTime(140, now);
  rise.frequency.exponentialRampToValueAtTime(1400, now + 2.2);

  const riseFilter = ctx.createBiquadFilter();
  riseFilter.type = "lowpass";
  riseFilter.frequency.setValueAtTime(400, now);
  riseFilter.frequency.linearRampToValueAtTime(9000, now + 2.2);

  const riseGain = ctx.createGain();
  riseGain.gain.setValueAtTime(0.0001, now);
  riseGain.gain.linearRampToValueAtTime(0.4, now + 2.1);
  riseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);

  rise.connect(riseFilter);
  riseFilter.connect(riseGain);
  riseGain.connect(master);

  rise.start(now);
  rise.stop(now + 2.6);

  // ==========================
  // WHOOSH
  // ==========================
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(500, now);
  band.frequency.linearRampToValueAtTime(8000, now + 2);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.linearRampToValueAtTime(0.3, now + 1.7);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

  noise.connect(band);
  band.connect(noiseGain);
  noiseGain.connect(master);

  noise.start(now);
  noise.stop(now + 2.5);

  // ==========================
  // IMPACT
  // ==========================
  const impact = ctx.createOscillator();
  impact.type = "triangle";
  impact.frequency.value = 320;

  const impactGain = ctx.createGain();
  impactGain.gain.setValueAtTime(0.0001, now + 2.2);
  impactGain.gain.exponentialRampToValueAtTime(1.1, now + 2.21);
  impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 3);

  impact.connect(impactGain);
  impactGain.connect(master);

  impact.start(now + 2.2);
  impact.stop(now + 3);

  // ==========================
  // SPARKLE
  // ==========================
  for (let i = 0; i < 20; i++) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1800 + Math.random() * 4000;

    const g = ctx.createGain();

    const t = now + 2.2 + Math.random() * 0.5;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

    osc.connect(g);
    g.connect(master);

    osc.start(t);
    osc.stop(t + 0.3);
  }
}
