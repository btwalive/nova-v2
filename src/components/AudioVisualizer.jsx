import React, { useEffect, useRef } from 'react';

export default function AudioVisualizer({ stream, isRecording, height = 36 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    let animationId;
    let audioContext;
    let analyser;
    let source;

    if (isRecording && stream) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          animationId = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const barWidth = 4;
          const spacing = 4;
          const numBars = 24;
          const totalWidth = numBars * (barWidth + spacing) - spacing;
          const startX = (canvas.width - totalWidth) / 2;
          const midY = canvas.height / 2;

          for (let i = 0; i < numBars; i++) {
            const val = dataArray[i % bufferLength] / 255;
            const barHeight = Math.max(4, val * canvas.height * 0.85);
            const x = startX + i * (barWidth + spacing);
            const y = midY - barHeight / 2;

            // Indigo to Emerald gradient
            const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, '#4f46e5');
            gradient.addColorStop(0.6, '#818cf8');
            gradient.addColorStop(1, '#10b981');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(x, y, barWidth, barHeight, 2.5);
            } else {
              ctx.rect(x, y, barWidth, barHeight);
            }
            ctx.fill();
          }
        };

        draw();
      } catch (err) {
        console.warn('AudioContext visualization error:', err);
      }
    } else {
      // Draw subtle pastel idle wave when not recording
      let step = 0;
      const drawIdle = () => {
        animationId = requestAnimationFrame(drawIdle);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const width = canvas.width;
        const midY = canvas.height / 2;

        for (let x = 0; x < width; x += 4) {
          const y = midY + Math.sin((x + step) * 0.04) * 4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        step += 1.5;
      };
      drawIdle();
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [stream, isRecording]);

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        style={{ width: '100%', maxWidth: '320px', height: `${height}px`, display: 'block' }}
      />
    </div>
  );
}
