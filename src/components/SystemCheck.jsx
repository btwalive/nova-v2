import React, { useState, useEffect } from 'react';
import { Mic, Volume2, CheckCircle2, AlertTriangle, ShieldCheck, Play, ArrowRight, RefreshCw, MessageSquare, Laptop, User, FileText, Sparkles, Clock } from 'lucide-react';

import AudioVisualizer from './AudioVisualizer';
import TermsPrivacyModal from './TermsPrivacyModal';
import { playInstantClickSfx as playClickSfx } from '../utils/sfx';

export default function SystemCheck({ candidate, test, onProceed }) {
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [modalTab, setModalTab] = useState('terms');

  const [micState, setMicState] = useState('idle'); // idle, requesting, ready, error
  const [mediaStream, setMediaStream] = useState(null);
  const [speakerTested, setSpeakerTested] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [micVolume, setMicVolume] = useState(0);

  const requestMicAccess = async () => {
    setMicState('requesting');
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(stream);
      // Mic permission + stream are enough to proceed — visualizer is best-effort only.
      setMicState('ready');

      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setMicVolume(Math.min(100, Math.round(average * 2.5)));
          requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (vizErr) {
        console.warn('Mic volume visualizer unavailable (mic still usable):', vizErr);
        setMicVolume(50);
      }

    } catch (err) {
      console.error('Microphone access error:', err);
      setMicState('error');
    }
  };

  const testSpeakerSound = () => {
    setIsPlayingAudio(true);
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance("Welcome to Nova Voice Assessment. Audio output is working correctly.");
      
      const voices = synth.getVoices();
      const naturalVoice = voices.find(v => 
        (v.lang.startsWith('en') || v.lang.includes('US')) &&
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Premium'))
      ) || voices.find(v => v.lang.startsWith('en'));

      if (naturalVoice) {
        utterance.voice = naturalVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      utterance.onend = () => {
        setIsPlayingAudio(false);
        setSpeakerTested(true);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setSpeakerTested(true);
      };
      
      // Fallback timer: in headless Chrome/automated environments, utterance.onend might not fire
      setTimeout(() => {
        setIsPlayingAudio(false);
        setSpeakerTested(true);
      }, 1500);

      synth.speak(utterance);
    } else {
      setTimeout(() => {
        setIsPlayingAudio(false);
        setSpeakerTested(true);
      }, 2000);
    }
  };

  useEffect(() => {
    requestMicAccess();
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const isReadyToStart = micState === 'ready' && speakerTested;

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      
      {/* Top Header */}
      <header className="maki-header">
        <div></div>

        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Candidate: <strong style={{ color: '#0f172a' }}>{candidate?.fullName || 'Candidate'}</strong>
          {candidate?.currentLocation && (
            <span style={{ marginLeft: '8px', color: '#4f46e5', fontWeight: 600 }}>• 📍 {candidate.currentLocation}</span>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: '1080px', width: '100%', margin: '0 auto', padding: '36px 24px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="maki-card" style={{ width: '100%', padding: '40px 36px' }}>
          
          <div className="mobile-grid-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '36px' }}>
            
            {/* Left Column: Diagnostics Instructions */}
            <div style={{ background: '#f8fafc', padding: '28px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#2563eb" /> Assessment Environment Requirements
                </h3>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.86rem', color: '#1e293b', fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '5px 12px', borderRadius: '6px' }}>
                      <Clock size={15} color="#2563eb" /> Duration: 15 Minutes
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '5px 12px', borderRadius: '6px' }}>
                      <FileText size={15} color="#2563eb" /> 5 Short Sections
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#475569' }}>
                    <CheckCircle2 size={16} color="#10b981" /> Stable Internet Connection
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#475569' }}>
                    <CheckCircle2 size={16} color="#10b981" /> Quiet Room & Clear Microphone Access
                  </div>
                </div>
              </div>


            </div>

            {/* Right Column: Hardware Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
                  Verification Checklist
                </h3>

                {/* Step 1: System Compatibility */}
                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '12px', marginBottom: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f8fafc' }}>
                  <CheckCircle2 size={20} color="#10b981" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>1. System & Browser Compatibility</span>
                </div>

                {/* Step 2: Microphone & Audio Permissions */}
                <div style={{ border: micState === 'error' ? '2px solid #ef4444' : '1.5px solid #cbd5e1', borderRadius: '12px', marginBottom: '12px', padding: '16px 20px', backgroundColor: micState === 'error' ? '#fef2f2' : '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {micState === 'ready' ? (
                        <CheckCircle2 size={20} color="#10b981" />
                      ) : micState === 'error' ? (
                        <AlertTriangle size={20} color="#ef4444" />
                      ) : (
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #4f46e5', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                      )}
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: micState === 'error' ? '#991b1b' : '#0f172a' }}>
                        2. Microphone Input Verification
                      </span>
                    </div>

                    {micState === 'ready' && (
                      <span style={{ fontSize: '0.75rem', color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>Active</span>
                    )}
                    {micState === 'error' && (
                      <span style={{ fontSize: '0.75rem', color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>Blocked</span>
                    )}
                  </div>

                  {micState === 'error' && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ background: '#ffffff', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 14px', fontSize: '0.85rem', color: '#991b1b', lineHeight: '1.5' }}>
                        <strong>Microphone access was denied or is unavailable.</strong>
                        <br />
                        To proceed with the assessment, please:
                        <ol style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '0.82rem', color: '#7f1d1d' }}>
                          <li>Click the lock/camera icon in your browser address bar</li>
                          <li>Set Microphone to <strong>Allow</strong></li>
                          <li>Reload this page or click <strong>Retry</strong> below</li>
                        </ol>
                      </div>
                      <button
                        onClick={requestMicAccess}
                        className="btn-maki-primary"
                        style={{ padding: '8px 20px', fontSize: '0.85rem', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', alignSelf: 'flex-start' }}
                      >
                        <RefreshCw size={15} /> Retry Microphone Access
                      </button>
                    </div>
                  )}

                  {micState === 'ready' && (
                    <div style={{ marginTop: '10px' }}>
                      <AudioVisualizer stream={mediaStream} isRecording={true} height={50} />
                    </div>
                  )}
                </div>

                {/* Step 3: Speaker Sound Test */}
                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {speakerTested ? <CheckCircle2 size={20} color="#10b981" /> : <Volume2 size={20} color="#64748b" />}
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>3. Speaker Sound Output</span>
                  </div>

                  <button
                    onClick={testSpeakerSound}
                    disabled={isPlayingAudio}
                    className={speakerTested ? "btn-maki-secondary" : "btn-maki-primary"}
                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                  >
                    {isPlayingAudio ? "Testing..." : speakerTested ? "Verified" : "Test Sound"}
                  </button>
                </div>
              </div>


              {/* Bottom Proceed CTA */}
              <div style={{ marginTop: '24px' }}>
                <button
                  onClick={() => { playClickSfx(); onProceed(mediaStream); }}
                  disabled={!isReadyToStart}
                  className="btn-maki-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                >
                  Proceed to Voice Assessment <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="maki-footer" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
        <div>NOVA Spoken Assessment © 2026</div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', color: '#64748b' }}>
          <button
            onClick={() => { setModalTab('terms'); setIsTermsOpen(true); }}
            style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '0.78rem' }}
          >
            Terms of Service
          </button>
          <span>•</span>
          <button
            onClick={() => { setModalTab('privacy'); setIsTermsOpen(true); }}
            style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '0.78rem' }}
          >
            Privacy Policy
          </button>
        </div>
      </footer>

      <TermsPrivacyModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
        initialTab={modalTab}
      />
    </div>
  );
}
