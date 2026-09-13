import React, { useEffect, useState } from 'react';
import { bindTypewriterAudioUnlock, playTypewriterClick } from '../utils/typewriterSound';

export default function NovaIntroTypewriter({ 
  text,
  segments,
  startDelayMs = 400,
  charMs = 48,
  active = true,
  hideCursorOnComplete = true,
  muteSound = false,
  onComplete 
}) {
  const [visibleLength, setVisibleLength] = useState(0);
  const [typingDone, setTypingDone] = useState(false);

  // Normalize segments or plain text string
  const activeSegments = segments || (text ? [{ text, accent: false }] : [
    { text: "Hello! I'm ", accent: false },
    { text: 'Nova', accent: true },
    { text: ', your AI Skills Assessor.', accent: false },
  ]);

  const fullText = activeSegments.map(s => s.text).join('');
  const fullLength = fullText.length;

  useEffect(() => bindTypewriterAudioUnlock(), []);

  useEffect(() => {
    if (!active || !fullLength) {
      setTypingDone(true);
      onComplete?.();
      return undefined;
    }

    setVisibleLength(0);
    setTypingDone(false);

    let index = 0;
    let intervalId = null;

    const startTimer = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        index += 1;
        
        const char = fullText.charAt(index - 1);
        if (char && char !== ' ' && !muteSound) {
          playTypewriterClick();
        }
        setVisibleLength(index);

        if (index >= fullLength) {
          window.clearInterval(intervalId);
          setTypingDone(true);
          onComplete?.();
        }
      }, charMs);
    }, startDelayMs);

    return () => {
      window.clearTimeout(startTimer);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [active, fullText, fullLength, charMs, startDelayMs, muteSound, onComplete]);

  let remaining = visibleLength;
  const nodes = [];

  activeSegments.forEach((segment, index) => {
    if (remaining <= 0) return;
    const sliceLen = Math.min(remaining, segment.text.length);
    remaining -= sliceLen;
    nodes.push(
      <span
        key={index}
        style={segment.accent ? { color: '#4f46e5', fontWeight: 800 } : undefined}
      >
        {segment.text.slice(0, sliceLen)}
      </span>
    );
  });

  return (
    <h2 className="nova-typewriter-line" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginBottom: '14px', lineHeight: '1.4', display: 'block', clear: 'both' }}>
      {nodes}
      <span
        className={`nova-typewriter-cursor${typingDone ? ' nova-typewriter-cursor-finish' : ''}`}
        style={{ display: (typingDone && hideCursorOnComplete) ? 'none' : 'inline-block' }}
        aria-hidden
      />
    </h2>
  );
}
