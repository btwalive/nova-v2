let audioContext = null;

export function unlockTypewriterAudio() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

export function playTypewriterClick() {
  const ctx = unlockTypewriterAudio();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  try {
    const now = ctx.currentTime;
    
    // Mechanical keyboard click synthesis
    const bufferSize = Math.max(100, Math.floor(ctx.sampleRate * 0.02)); // 20ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Bandpass filter to shape noise into a crisp mechanical click
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3800; // High frequency click tone
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start(now);
    noise.stop(now + 0.025);
  } catch (e) {
    console.warn("Typewriter click sound error:", e);
  }
}

export function bindTypewriterAudioUnlock() {
  if (typeof window === 'undefined') return () => {};

  const unlock = () => {
    unlockTypewriterAudio();
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('pointermove', unlock, { passive: true });
  window.addEventListener('mousemove', unlock, { passive: true });
  window.addEventListener('mouseenter', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });

  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('pointermove', unlock);
    window.removeEventListener('mousemove', unlock);
    window.removeEventListener('mouseenter', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
}
