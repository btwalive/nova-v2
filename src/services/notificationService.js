// Sound & Notification Service for Recruiter Admin

class NotificationService {
  constructor() {
    this.audioCtx = null;
    this.soundEnabled = true;
    try {
      const saved = localStorage.getItem('hirewave_admin_sound_enabled');
      if (saved !== null) {
        this.soundEnabled = saved === 'true';
      }
    } catch (e) {}
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = !!enabled;
    try {
      localStorage.setItem('hirewave_admin_sound_enabled', String(this.soundEnabled));
    } catch (e) {}
  }

  isSoundEnabled() {
    return this.soundEnabled;
  }

  async requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      return 'denied';
    }
  }

  playChime() {
    if (!this.soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      // High quality 3-note ascending chime: C6 (1046.5Hz) -> E6 (1318.51Hz) -> G6 (1567.98Hz)
      const notes = [
        { freq: 1046.5, start: 0, duration: 0.16 },
        { freq: 1318.51, start: 0.12, duration: 0.18 },
        { freq: 1567.98, start: 0.24, duration: 0.45 }
      ];

      notes.forEach(({ freq, start, duration }) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        // Smooth volume attack and decay envelope
        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.32, now + start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } catch (err) {
      console.warn('Audio chime playback error:', err);
    }
  }

  notifyNewCandidate(candidateInfo) {
    this.playChime();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const name = candidateInfo?.name || candidateInfo?.candidate?.fullName || candidateInfo?.candidate?.name || 'A candidate';
      const score = candidateInfo?.evaluation?.overallScore !== undefined 
        ? ` (${candidateInfo.evaluation.overallScore}% Score)`
        : (candidateInfo?.score !== undefined ? ` (${candidateInfo.score}% Score)` : '');
      const role = candidateInfo?.test?.targetRole || candidateInfo?.role || 'Voice Assessment';
      
      try {
        const notification = new Notification('🎉 New Candidate Test Completed!', {
          body: `${name}${score} just completed the ${role}. Click to review submission.`,
          icon: '/favicon.jpeg',
          tag: `new-candidate-${candidateInfo?.id || Date.now()}`,
          requireInteraction: false
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (e) {
        console.warn('Desktop notification error:', e);
      }
    }
  }
}

export const notificationService = new NotificationService();
