import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, CheckCircle, ArrowRight, Volume2, Clock, Sparkles, ZoomIn, ZoomOut, MessageSquare, ChevronRight, Loader2, CloudUpload, AlertCircle, Phone } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { INTRO_SECTION_FRESHER, INTRO_SECTION_EXPERIENCED, CORE_SECTIONS } from '../services/testData';
import { uploadAudioToStorage } from '../services/cloudDatabase';
import { savePendingAudioClip, removePendingAudioClip } from '../services/pendingAudioStore';
import { uploadAudioToDrive } from '../services/googleDriveStorage';
import novaAvatarImg from '../Nova_newavtar.jpeg';
import { playInstantClickSfx as playClickSfx, playPreloadedPromptAudio, preloadAllPromptAudio } from '../utils/sfx';

/** True when base64 looks like real recorded audio (not empty / silent placeholder). */
const isRealAudioPayload = (b64) =>
  typeof b64 === 'string' && b64.length > 500 && !b64.includes('UklGRgQBCwBXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YeAACw');


const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    if (!blob) return resolve('');
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const bytesToBase64 = (bytes) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const compressAudioBlob = async (blob) => {
  // Never invent silent audio — empty recording must stay empty so we can retry / warn.
  if (!blob || blob.size === 0) return '';

  const rawFallback = async () => {
    try {
      return (await blobToBase64(blob)) || '';
    } catch {
      return '';
    }
  };

  const filterPromise = (async () => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) return await rawFallback();

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return await rawFallback();

      const audioCtx = new AudioContextClass();
      const decodedData = await audioCtx.decodeAudioData(arrayBuffer);

      // Target 16,000 Hz sample rate (native Whisper AI speech standard)
      const targetSampleRate = 16000;
      const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OfflineCtxClass) return await rawFallback();
      const offlineCtx = new OfflineCtxClass(1, Math.ceil(decodedData.duration * targetSampleRate), targetSampleRate);

      const source = offlineCtx.createBufferSource();
      source.buffer = decodedData;

      // High-pass filter (80Hz) to eliminate low electrical hum & background AC rumble
      const highpass = offlineCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 80;

      // Low-pass filter (7500Hz) to eliminate high-frequency zer-zer static hiss
      const lowpass = offlineCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 7500;

      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(offlineCtx.destination);

      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const pcmSamples = renderedBuffer.getChannelData(0);

      // Encode to 16-bit PCM WAV header (65,536 quantization levels = zero static noise)
      const buffer = new ArrayBuffer(44 + pcmSamples.length * 2);
      const view = new DataView(buffer);

      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + pcmSamples.length * 2, true);
      writeString(view, 8, 'WAVE');
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // Raw PCM
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, targetSampleRate, true);
      view.setUint32(28, targetSampleRate * 2, true); // Byte rate (16-bit = 2 bytes/sample)
      view.setUint16(32, 2, true); // Block align
      view.setUint16(34, 16, true); // 16 bits per sample
      writeString(view, 36, 'data');
      view.setUint32(40, pcmSamples.length * 2, true);

      let offset = 44;
      for (let i = 0; i < pcmSamples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, pcmSamples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }

      const wavBytes = new Uint8Array(buffer);
      return 'data:audio/wav;base64,' + bytesToBase64(wavBytes);
    } catch (e) {
      console.warn("Audio noise filtering error, fallback to raw base64:", e);
      return await rawFallback();
    }
  })();

  // Give compression enough time on mid-range mobiles; still fall back to raw blob if slow.
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(async () => {
      console.warn("Audio compression timed out, using fast base64 fallback");
      resolve(await rawFallback());
    }, 8000);
  });

  return Promise.race([filterPromise, timeoutPromise]);
};

function CandidateAudioReviewBox({ audioUrl, onReRecord }) {
  return (
    <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '8px', margin: '4px auto 0' }}>
      <audio
        src={audioUrl}
        controls
        style={{ width: '100%', height: '42px', borderRadius: '10px' }}
      />

      {onReRecord && (
        <button
          type="button"
          onClick={onReRecord}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#475569',
            padding: '7px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            alignSelf: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <RotateCcw size={14} /> Re-record answer
        </button>
      )}
    </div>
  );
}

/** Collapsible fresher guidance panel for the mock call section. */
function MockCallHintPanel() {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ marginBottom: '14px' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '0.83rem',
          fontWeight: 600,
          color: '#4f46e5',
          textDecoration: 'underline',
          textUnderlineOffset: '2px'
        }}
      >
        💡 Not sure what to say? {open ? 'Hide tips ▲' : 'See a quick guide ▼'}
      </button>

      {open && (
        <div style={{
          marginTop: '10px',
          background: '#f0f4ff',
          border: '1.5px solid #c7d2fe',
          borderRadius: '12px',
          padding: '14px 16px',
          fontSize: '0.88rem',
          color: '#1e293b',
          lineHeight: '1.65'
        }}>
          <div style={{ fontWeight: 700, marginBottom: '8px', color: '#4338ca' }}>
            📞 How to handle this call — step by step:
          </div>
          <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>
              <strong>Greet &amp; acknowledge</strong> — Start with a warm greeting and confirm you heard the issue.
              <div style={{ color: '#475569', marginTop: '2px' }}>
                e.g. <em>"Thank you for calling. I completely understand how frustrating this must be, Sarah."</em>
              </div>
            </li>
            <li>
              <strong>Empathise &amp; apologise</strong> — Show you care, even if it's not your fault.
              <div style={{ color: '#475569', marginTop: '2px' }}>
                e.g. <em>"I sincerely apologise for the delay — that's not the experience we want for you."</em>
              </div>
            </li>
            <li>
              <strong>Offer a solution</strong> — Tell them what you will do to fix it right now.
              <div style={{ color: '#475569', marginTop: '2px' }}>
                e.g. <em>"I'm pulling up your order right now. I'll escalate this to our logistics team and get you a delivery update within the hour."</em>
              </div>
            </li>
          </ol>
          <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #c7d2fe', paddingTop: '8px' }}>
            💬 Speak naturally — there's no single right answer. We're evaluating your communication, not a script.
          </div>
        </div>
      )}
    </div>
  );
}

export default function VoiceTestEngine({ candidate, test, mediaStream, onSubmitTest }) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Overall Test Countdown Timer (15 Minutes = 900 seconds)
  const [testTimeLeftSeconds, setTestTimeLeftSeconds] = useState(900);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [recordedBase64Audio, setRecordedBase64Audio] = useState('');
  const [recordedAudioDuration, setRecordedAudioDuration] = useState(0);
  const recordedDurationRef = useRef(0);
  const [transcriptText, setTranscriptText] = useState('');
  const [micError, setMicError] = useState(null); // null | 'denied' | 'unavailable'

  // Refs keep the latest audio payload — React state alone races with Next/Submit.
  const recordedBase64Ref = useRef('');
  const recordedBlobRef = useRef(null);
  const recordedUrlRef = useRef(null);

  const [readerFontSize, setReaderFontSize] = useState(0.88); // Default to smallest 0.88rem
  const [isPlayingPrompt, setIsPlayingPrompt] = useState(false);
  const [isPlayingCallerAudio, setIsPlayingCallerAudio] = useState(false);
  const [isSyncingAudio, setIsSyncingAudio] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const submissionIdRef = useRef('SUB-' + Date.now());
  const isAdvancingRef = useRef(false);

  // Extempore Prep Timer
  const [prepTimeLeft, setPrepTimeLeft] = useState(null);
  const [isPrepping, setIsPrepping] = useState(false);

  const [responses, setResponses] = useState({});
  const responsesRef = useRef({});

  // Synchronize responsesRef with state
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  // Dynamic Section List based on Candidate Experience Level (Fresher vs Experienced)
  const introSec = candidate?.experienceLevel === 'experienced' ? INTRO_SECTION_EXPERIENCED : INTRO_SECTION_FRESHER;
  const sections = [introSec, ...CORE_SECTIONS];

  const candidateEmailKey = candidate?.email ? candidate.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_') : 'default';
  const progressKey = `hirewave_engine_progress_${candidateEmailKey}`;

  // Active Test Countdown Clock Timer Effect - Automatically PAUSED during audio upload & analysis
  useEffect(() => {
    if (isAnalyzing || isProcessingAudio || isSyncingAudio) {
      return; // Timer paused while uploading/processing so candidate time is preserved!
    }

    const clockInterval = setInterval(() => {
      setTestTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(clockInterval);
          // Auto submit when time runs out
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [isAnalyzing, isProcessingAudio, isSyncingAudio]);

  const formatCountdown = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Restore engine progress on mount
  useEffect(() => {
    try {
      const savedProgress = localStorage.getItem(progressKey);
      if (savedProgress) {
        const parsed = JSON.parse(savedProgress);
        if (parsed.submissionId) submissionIdRef.current = parsed.submissionId;
        if (typeof parsed.sectionIdx === 'number') setCurrentSectionIndex(parsed.sectionIdx);
        if (typeof parsed.questionIdx === 'number') setCurrentQuestionIndex(parsed.questionIdx);
        if (parsed.responses) {
          setResponses(parsed.responses);
          responsesRef.current = parsed.responses;
        }
        if (typeof parsed.timeLeft === 'number' && parsed.timeLeft > 0) setTestTimeLeftSeconds(parsed.timeLeft);
      }
    } catch (e) {}
  }, [progressKey]);

  // Persist engine progress on index/response change (metadata only — audio lives in IndexedDB)
  useEffect(() => {
    try {
      const slimResponses = {};
      Object.entries(responsesRef.current || {}).forEach(([key, r]) => {
        slimResponses[key] = {
          ...r,
          // Keep short durable URLs; drop multi-MB base64 from localStorage to avoid quota loss
          base64Audio: '',
          audioUrl: (r.audioUrl && String(r.audioUrl).startsWith('http')) ? r.audioUrl : (r.audioUrl && String(r.audioUrl).startsWith('gdrive://') ? r.audioUrl : (r.audioUrl && String(r.audioUrl).startsWith('firebase://') ? r.audioUrl : '')),
        };
      });
      localStorage.setItem(progressKey, JSON.stringify({
        sectionIdx: currentSectionIndex,
        questionIdx: currentQuestionIndex,
        responses: slimResponses,
        timeLeft: testTimeLeftSeconds,
        submissionId: submissionIdRef.current,
      }));
    } catch (e) {}
  }, [currentSectionIndex, currentQuestionIndex, responses, testTimeLeftSeconds, progressKey]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const prepIntervalRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  const currentSection = sections[currentSectionIndex] || sections[0] || {};
  const questions = currentSection?.questions || [];
  const currentQuestion = questions[currentQuestionIndex] || questions[0] || {};

  const currentAudioRef = useRef(null);
  const preloadedHandleRef = useRef(null);
  const callerAudioObjRef = useRef(null);


  const stopAllAudio = () => {
    if (callerAudioObjRef.current) {
      try {
        callerAudioObjRef.current.pause();
        callerAudioObjRef.current.currentTime = 0;
      } catch (e) {}
    }
    if (preloadedHandleRef.current) {
      try { preloadedHandleRef.current.stop(); } catch (e) {}
    }
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (e) {}
    }
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setIsPlayingPrompt(false);
    setIsPlayingCallerAudio(false);
  };

  useEffect(() => {
    stopAllAudio();

    setIsRecording(false);
    setRecordingTime(0);
    recordedBase64Ref.current = '';
    recordedBlobRef.current = null;
    recordedUrlRef.current = null;
    setRecordedAudioUrl(null);
    setRecordedAudioBlob(null);
    setRecordedBase64Audio('');
    setTranscriptText('');

    if (currentQuestion && currentQuestion.prepTimeSeconds) {
      setPrepTimeLeft(currentQuestion.prepTimeSeconds);
      setIsPrepping(true);
    } else {
      setPrepTimeLeft(null);
      setIsPrepping(false);
    }

    const questionKey = `${currentSection?.id}_${currentQuestion?.id}`;
    if (responsesRef.current[questionKey]) {
      const saved = responsesRef.current[questionKey];
      recordedUrlRef.current = saved.audioUrl || null;
      recordedBase64Ref.current = saved.base64Audio || '';
      setRecordedAudioUrl(saved.audioUrl || null);
      setRecordedBase64Audio(saved.base64Audio || '');
      setTranscriptText(saved.transcript || '');
    }

    return () => stopAllAudio();
  }, [currentSectionIndex, currentQuestionIndex]);

  // Extempore / Question Prep Countdown
  useEffect(() => {
    if (isPrepping && prepTimeLeft !== null) {
      if (prepTimeLeft > 0) {
        prepIntervalRef.current = setInterval(() => {
          setPrepTimeLeft((prev) => prev - 1);
        }, 1000);
      } else {
        setIsPrepping(false);
        startRecording();
      }
    }
    return () => clearInterval(prepIntervalRef.current);
  }, [isPrepping, prepTimeLeft]);

  // Recording Timer
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isRecording]);



  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  };

  const localStreamRef = useRef(null);

  const releaseAllMicrophones = () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => {
          try { t.stop(); } catch (e) {}
        });
        localStreamRef.current = null;
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => {
          try { t.stop(); } catch (e) {}
        });
      }
    } catch (e) {
      console.warn('Error releasing microphone tracks:', e);
    }
  };

  // Ensure microphone is completely released when engine unmounts
  useEffect(() => {
    return () => {
      stopAllAudio();
      releaseAllMicrophones();
    };
  }, []);

  const startRecording = async () => {
    stopAllAudio();
    setMicError(null);

    setIsPrepping(false);
    clearInterval(prepIntervalRef.current);
    
    audioChunksRef.current = [];
    recordedBase64Ref.current = '';
    recordedBlobRef.current = null;
    recordedUrlRef.current = null;
    recordedDurationRef.current = 0;
    setRecordedBase64Audio('');
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setRecordedAudioDuration(0);
    setTranscriptText('');

    let streamToUse = mediaStream;
    if (!streamToUse || !streamToUse.active || streamToUse.getAudioTracks().every(t => t.readyState === 'ended')) {
      try {
        streamToUse = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        localStreamRef.current = streamToUse;
      } catch (err) {
        console.error('Failed to auto-acquire microphone:', err);
        const errorType = (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') ? 'denied' : 'unavailable';
        setMicError(errorType);
        return;
      }
    }

    try {
      const mimeType = getSupportedMimeType();
      let recorder;
      if (mimeType) {
        try {
          recorder = new MediaRecorder(streamToUse, { mimeType, audioBitsPerSecond: 64000 });
        } catch (e) {
          recorder = new MediaRecorder(streamToUse);
        }
      } else {
        recorder = new MediaRecorder(streamToUse);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // Process stop into a promise so callers can await real base64 (not stale React state).
      recorder._processStop = () => new Promise(async (resolve) => {
        setIsProcessingAudio(true);
        try {
          const chunks = audioChunksRef.current.slice();
          if (!chunks.length) {
            console.warn('MediaRecorder stopped with zero audio chunks');
            recordedBase64Ref.current = '';
            recordedBlobRef.current = null;
            recordedUrlRef.current = null;
            setRecordedBase64Audio('');
            setRecordedAudioBlob(null);
            setRecordedAudioUrl(null);
            resolve({ base64: '', blob: null, url: null });
            return;
          }

          const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          recordedBlobRef.current = audioBlob;
          // Do NOT publish playable URL to UI state until base64 is ready —
          // otherwise Next enables early and candidates can skip before audio is saved.
          const base64Str = await compressAudioBlob(audioBlob);
          const safeBase64 = isRealAudioPayload(base64Str) ? base64Str : (await blobToBase64(audioBlob)) || '';
          recordedBase64Ref.current = safeBase64;
          recordedUrlRef.current = audioUrl;
          setRecordedAudioBlob(audioBlob);
          setRecordedAudioUrl(audioUrl);
          setRecordedBase64Audio(safeBase64);

          // Durable local backup before any cloud upload — survives tab close / failed sync.
          if (isRealAudioPayload(safeBase64) && currentQuestion?.id) {
            savePendingAudioClip({
              submissionId: submissionIdRef.current,
              questionId: currentQuestion.id,
              index: currentQuestionIndex,
              base64Audio: safeBase64,
            }).catch(() => {});
          }

          resolve({ base64: safeBase64, blob: audioBlob, url: audioUrl });
        } catch (e) {
          console.warn('Base64 audio conversion error:', e);
          resolve({
            base64: recordedBase64Ref.current || '',
            blob: recordedBlobRef.current,
            url: recordedUrlRef.current,
          });
        } finally {
          setIsProcessingAudio(false);
        }
      });

      recorder.onstop = () => {
        // Default handler for manual Stop button (no awaiter).
        if (recorder._stopResolver) return;
        recorder._processStop();
      };

      recorder.start(250); // Flush chunks every 250ms
      setIsRecording(true);
      setRecordingTime(0);
      setMicError(null);
    } catch (err) {
      console.error('Error starting recording:', err);
      setMicError('unavailable');
    }
  };


  const stopRecording = () => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
        recorder._stopResolver = resolve;
        const prevOnStop = recorder.onstop;
        recorder.onstop = async () => {
          try {
            const result = await recorder._processStop();
            resolve(result);
          } catch (e) {
            resolve({ base64: '', blob: null, url: null });
          } finally {
            recorder._stopResolver = null;
            recorder.onstop = prevOnStop;
          }
        };

        try {
          // Final chunk flush before stop — critical on Safari / some Chromium builds.
          if (typeof recorder.requestData === 'function' && recorder.state === 'recording') {
            recorder.requestData();
          }
        } catch (e) {}

        const durationSecs = Math.max(1, recordingTime);
        recordedDurationRef.current = durationSecs;
        setRecordedAudioDuration(durationSecs);

        recorder.stop();
        setIsRecording(false);

        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
          } catch (e) {}
        }
      } else {
        resolve({
          base64: recordedBase64Ref.current || recordedBase64Audio || '',
          blob: recordedBlobRef.current || recordedAudioBlob,
          url: recordedUrlRef.current || recordedAudioUrl,
        });
      }
    });
  };

  // Pre-load HD voices asynchronously on mobile & desktop
  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    const loadVoices = () => {
      if (window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          setAvailableVoices(voices);
        }
      }
    };

    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const playPromptAudio = (textToSpeak, staticAudioUrl = null) => {
    stopAllAudio();

    const targetUrl = staticAudioUrl || currentQuestion?.audioUrl || currentSection?.passageAudioUrl;

    if (targetUrl) {
      setIsPlayingPrompt(true);
      preloadedHandleRef.current = playPreloadedPromptAudio(targetUrl, () => {
        setIsPlayingPrompt(false);
      });
      return;
    }

    if (window.speechSynthesis && textToSpeak) {
      fallbackSpeechSynth(textToSpeak);
    }
  };

  const fallbackSpeechSynth = (textToSpeak) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();

    setIsPlayingPrompt(true);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Filter highest quality natural US/UK English voices
    const voices = availableVoices.length > 0 ? availableVoices : synth.getVoices();
    const naturalVoice = voices.find(v => 
      (v.lang.startsWith('en-US') || v.lang.startsWith('en-GB') || v.lang.startsWith('en')) &&
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Online') || v.name.includes('Premium'))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    utterance.onend = () => setIsPlayingPrompt(false);
    utterance.onerror = () => setIsPlayingPrompt(false);
    synth.speak(utterance);
  };

  const playCallerAudio = (text, audioUrl = null) => {
    if (typeof window === 'undefined') return;
    if (isPlayingCallerAudio) {
      stopAllAudio();
      return;
    }
    stopAllAudio();

    const targetUrl = audioUrl || currentQuestion?.audioUrl || '/audio/prompts/mock_call_customer.mp3';

    // 1. Play authentic hosted US neural voice MP3
    if (targetUrl) {
      try {
        const audio = new Audio(targetUrl);
        callerAudioObjRef.current = audio;
        setIsPlayingCallerAudio(true);
        audio.onended = () => {
          setIsPlayingCallerAudio(false);
        };
        audio.onerror = () => {
          console.warn('Audio file error, falling back to speech synth');
          fallbackCallerSpeechSynth(text);
        };
        audio.play().catch((err) => {
          console.warn('Audio play error, falling back to speech synth:', err);
          fallbackCallerSpeechSynth(text);
        });
        return;
      } catch (e) {
        console.warn('Audio player init error:', e);
      }
    }

    fallbackCallerSpeechSynth(text);
  };

  const fallbackCallerSpeechSynth = (text) => {
    if (window.speechSynthesis && text) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 0.94; // natural grounded US accent pitch

        const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
        const usVoice = voices.find(v => 
          (v.lang === 'en-US' || v.lang === 'en_US') && 
          (v.name.includes('Natural') || v.name.includes('Guy') || v.name.includes('David') || v.name.includes('Google') || v.name.includes('Christopher') || v.name.includes('Mark') || v.name.includes('Alex'))
        ) || voices.find(v => v.lang === 'en-US' || v.lang === 'en_US') || voices.find(v => v.lang.startsWith('en'));

        if (usVoice) utterance.voice = usVoice;
        utterance.lang = 'en-US';

        utterance.onstart = () => setIsPlayingCallerAudio(true);
        utterance.onend = () => setIsPlayingCallerAudio(false);
        utterance.onerror = () => setIsPlayingCallerAudio(false);

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
        setIsPlayingCallerAudio(false);
      }
    }
  };

  const saveCurrentResponse = (overrideData = {}) => {
    const questionKey = `${currentSection?.id}_${currentQuestion?.id}`;
    
    let expectedText = "";
    if (currentSection?.type === 'reading') {
      expectedText = currentQuestion?.promptText || "";
    } else if (currentSection?.type === 'mock_call') {
      expectedText = currentQuestion?.callerAudioText || "";
    } else if (currentSection?.type === 'listen_repeat') {
      expectedText = currentQuestion?.audioText || "";
    }

    // Never fake a perfect script match by copying expectedText into transcript.
    // Free-thinking answers must be scored from real speech only.
    const realTranscript = (overrideData.transcript || transcriptText || '').trim();

    const base64Audio =
      overrideData.base64Audio ||
      recordedBase64Ref.current ||
      recordedBase64Audio ||
      '';

    const audioUrl =
      overrideData.audioUrl ||
      (isRealAudioPayload(base64Audio) ? base64Audio : null) ||
      recordedUrlRef.current ||
      recordedAudioUrl ||
      '';

    const newResponse = {
      sectionId: currentSection?.id,
      sectionTitle: currentSection?.title,
      sectionType: currentSection?.type || null,
      questionId: currentQuestion?.id,
      durationSeconds: overrideData.durationSeconds || recordingTime || 12,
      audioUrl,
      base64Audio: isRealAudioPayload(base64Audio) ? base64Audio : '',
      audioStored: !!overrideData.audioStored,
      transcript: realTranscript,
      expectedText,
      submissionId: submissionIdRef.current,
    };

    const updated = {
      ...responsesRef.current,
      [questionKey]: newResponse
    };
    responsesRef.current = updated;
    setResponses(updated);
    return newResponse;
  };

  const syncQuestionAudio = async (questionKey, questionId, index) => {
    const currResp = responsesRef.current[questionKey];
    const audioSource =
      currResp?.base64Audio ||
      (currResp?.audioUrl && String(currResp.audioUrl).startsWith('data:') ? currResp.audioUrl : null) ||
      recordedBase64Ref.current;

    if (!isRealAudioPayload(audioSource)) return false;

    // Always keep IndexedDB backup until cloud URL is confirmed.
    await savePendingAudioClip({
      submissionId: submissionIdRef.current,
      questionId,
      index,
      base64Audio: audioSource,
    });

    setIsSyncingAudio(true);
    try {
      // Prefer Google Drive first (same as final save path)
      let durableUrl = null;
      let storageLabel = '';
      try {
        durableUrl = await uploadAudioToDrive(audioSource, {
          submissionId: submissionIdRef.current,
          questionId,
          index,
        });
        if (durableUrl) storageLabel = 'Google Drive';
      } catch (e) {
        console.warn('Drive upload during question sync failed:', e?.message || e);
      }

      if (!durableUrl) {
        durableUrl = await uploadAudioToStorage(audioSource, {
          submissionId: submissionIdRef.current,
          questionId,
          index,
        });
        if (durableUrl) storageLabel = 'Supabase Storage';
      }

      if (durableUrl) {
        responsesRef.current[questionKey] = {
          ...responsesRef.current[questionKey],
          audioUrl: durableUrl,
          base64Audio: audioSource, // keep until final cloud patch confirms
          audioStored: true,
          _audioStorage: storageLabel,
        };
        setResponses({ ...responsesRef.current });
        await removePendingAudioClip(submissionIdRef.current, questionId);
        return true;
      }
    } catch (e) {
      console.warn('Question audio upload error (kept locally for retry):', e);
    } finally {
      setIsSyncingAudio(false);
    }
    return false;
  };

  const handleFinalSubmit = async () => {
    let stopResult = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
      stopResult = await stopRecording();
    }

    saveCurrentResponse({
      base64Audio: stopResult?.base64 || recordedBase64Ref.current || '',
      audioUrl: stopResult?.url || recordedUrlRef.current || '',
    });

    const currentKey = `${currentSection?.id}_${currentQuestion?.id}`;
    await syncQuestionAudio(currentKey, currentQuestion?.id, currentQuestionIndex);

    const allResponsesList = Object.values(responsesRef.current).map((r) => ({
      ...r,
      // Ensure final payload still carries base64 when cloud URL is missing
      base64Audio: isRealAudioPayload(r.base64Audio)
        ? r.base64Audio
        : (isRealAudioPayload(r.audioUrl) ? r.audioUrl : ''),
      _engineSubmissionId: submissionIdRef.current,
    }));
    try {
      localStorage.removeItem(progressKey);
      localStorage.removeItem('hirewave_active_candidate_session');
    } catch (e) {}
    releaseAllMicrophones();
    onSubmitTest(allResponsesList, { engineSubmissionId: submissionIdRef.current });
  };

  const handleNext = async () => {
    if (isAdvancingRef.current || isAnalyzing) return;
    isAdvancingRef.current = true;
    setIsAnalyzing(true);

    try {
      stopAllAudio();
      let stopResult = null;
      const recorder = mediaRecorderRef.current;
      if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
        stopResult = await stopRecording();
      }

      saveCurrentResponse({
        base64Audio: stopResult?.base64 || recordedBase64Ref.current || '',
        audioUrl: stopResult?.url || recordedUrlRef.current || '',
      });

      const currentKey = `${currentSection?.id}_${currentQuestion?.id}`;
      await syncQuestionAudio(currentKey, currentQuestion?.id, currentQuestionIndex);

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else if (currentSectionIndex < sections.length - 1) {
        setCurrentSectionIndex(currentSectionIndex + 1);
        setCurrentQuestionIndex(0);
      } else {
        await handleFinalSubmit();
      }
    } finally {
      // Keep analyzing visible briefly so the transition feels intentional
      await new Promise((r) => setTimeout(r, 280));
      setIsAnalyzing(false);
      isAdvancingRef.current = false;
    }
  };

  const isLastQuestion = currentSectionIndex === sections.length - 1 && currentQuestionIndex === questions.length - 1;

  // Calculate overall progress
  const totalQuestions = sections.reduce((sum, sec) => sum + (sec.questions?.length || 0), 0);
  const completedQuestions = sections.slice(0, currentSectionIndex).reduce((sum, sec) => sum + (sec.questions?.length || 0), 0) + currentQuestionIndex;
  const progressPercent = Math.round((completedQuestions / totalQuestions) * 100);

  const getNovaConversationalIntro = () => {
    switch (currentSection?.type) {
      case 'speaking':
        return `Please answer this question into your microphone:`;
      case 'mock_call':
        return `Listen to the customer's call, then record your response:`;
      case 'reading':
        return `Read this passage out loud:`;
      case 'listen_repeat':
        return `Listen to this sentence and repeat it out loud:`;
      case 'audio_comprehension':
        return `Listen to the audio story below, then answer the question:`;
      case 'extempore':
        return `Speak on this topic after the prep timer:`;
      default:
        return `Complete this question into your microphone:`;
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '220px', background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}>
      
      {/* Main Conversational Chat Canvas */}
      <div style={{ maxWidth: '960px', width: '100%', margin: '0 auto', padding: '24px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* NOVA'S AI CHAT TURN (Symmetrically Aligned Question Card) */}
        <div key={`nova_msg_${currentSectionIndex}_${currentQuestionIndex}`} className="chat-bubble-animated" style={{ width: '100%', maxWidth: '880px', margin: '0 auto' }}>
          
          {/* Nova Sender Badge Header */}
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4f46e5', marginBottom: '8px', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className={isPlayingPrompt ? "nova-avatar-speaking" : "nova-avatar-alive"} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #4f46e5', overflow: 'hidden', backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(79, 70, 229, 0.2)', flexShrink: 0 }}>
              <img src={novaAvatarImg} alt="Nova" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }} />
            </div>
            <span>Nova • AI Skill Assessor</span>
            {isPlayingPrompt && (
              <span style={{ fontSize: '0.75rem', color: '#2563eb', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                <span className="typing-dot typing-dot-1" /><span className="typing-dot typing-dot-2" /><span className="typing-dot typing-dot-3" /> Speaking...
              </span>
            )}
          </div>

          {/* Bubble Box */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '24px',
            boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.06)',
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box'
          }}>
              
              {/* Nova Conversational Instruction Header */}
              <div style={{ fontSize: '0.98rem', fontWeight: 600, color: '#1e1b4b', marginBottom: '16px', lineHeight: '1.6', background: '#f5f3ff', borderLeft: '4px solid #4f46e5', padding: '12px 16px', borderRadius: '0 10px 10px 0' }}>
                {getNovaConversationalIntro()}
              </div>

              {/* Assessment Section Content Box */}
              <div className="maki-content-box">
                
                {currentSection.type === 'speaking' && (
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>{currentQuestion.questionText}</h3>
                    <p style={{ fontSize: '1rem', color: '#334155', lineHeight: '1.6' }}>{currentQuestion.promptText}</p>
                  </div>
                )}

                {currentSection.type === 'mock_call' && (
                  <div>
                    {/* Incoming Call Card */}
                    <div style={{
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                      borderRadius: '16px',
                      padding: '18px 20px',
                      color: '#ffffff',
                      border: '1px solid #334155',
                      boxShadow: '0 6px 20px -4px rgba(15, 23, 42, 0.2)',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#22c55e',
                          boxShadow: '0 0 8px #22c55e'
                        }} />
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.6px', color: '#86efac', textTransform: 'uppercase' }}>
                          Incoming Customer Call
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#60a5fa',
                            flexShrink: 0
                          }}>
                            <Phone size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                              {currentQuestion.callerName || 'Sarah Mitchell'}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                              {currentQuestion.callerIssue || 'Order #84920 • Delayed Delivery'}
                            </div>
                          </div>
                        </div>

                        {/* Audio Player Action */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            type="button"
                            onClick={() => playCallerAudio(currentQuestion.callerAudioText, currentQuestion.audioUrl)}
                            style={{
                              background: isPlayingCallerAudio ? '#ef4444' : '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 18px',
                              fontSize: '0.88rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: isPlayingCallerAudio ? '0 4px 14px rgba(239, 68, 68, 0.35)' : '0 4px 14px rgba(37, 99, 235, 0.35)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Volume2 size={16} />
                            <span>{isPlayingCallerAudio ? 'Pause Call' : 'Play Customer Call'}</span>
                          </button>

                          {/* Equalizer animation when playing */}
                          {isPlayingCallerAudio && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', paddingLeft: '4px' }}>
                              {[12, 22, 16, 26, 14, 20, 10].map((h, i) => (
                                <div
                                  key={i}
                                  style={{
                                    width: '3px',
                                    height: `${h}px`,
                                    background: '#60a5fa',
                                    borderRadius: '2px',
                                    transition: 'height 0.2s ease'
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fresher Hint Panel — collapsible */}
                    <MockCallHintPanel />

                    {/* The Ask (Minimal prompt) */}
                    <p style={{ fontSize: '0.98rem', color: '#1e293b', lineHeight: '1.6', margin: '0 0 16px 0', fontWeight: 500 }}>
                      {currentQuestion.promptText || "Listen to the customer's call, then record your response to resolve the issue."}
                    </p>
                  </div>
                )}

                {currentSection.type === 'listen_repeat' && (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '16px', fontWeight: 500 }}>Click below to listen to the sentence:</p>
                    <button onClick={() => playPromptAudio(currentQuestion.audioText, currentQuestion.audioUrl)} disabled={isPlayingPrompt} className="btn-maki-primary" style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
                      <Volume2 size={20} /> {isPlayingPrompt ? "Playing Audio..." : "Play Audio"}
                    </button>
                  </div>
                )}

                {currentSection.type === 'audio_comprehension' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eef2ff', padding: '14px 18px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #c7d2fe', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#3730a3', fontSize: '0.9rem' }}>Passage Audio Story</span>
                      <button onClick={() => playPromptAudio(currentSection.passageAudioText, currentSection.passageAudioUrl || currentQuestion.audioUrl)} disabled={isPlayingPrompt} className="btn-maki-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                        <Volume2 size={16} /> {isPlayingPrompt ? "Playing Audio..." : "Play Audio"}
                      </button>
                    </div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{currentQuestion.questionText}</h4>
                  </div>
                )}

                {currentSection.type === 'extempore' && (
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>{currentQuestion.topicTitle}</h3>
                    <p style={{ fontSize: '1rem', color: '#334155', lineHeight: '1.6' }}>{currentQuestion.promptText}</p>

                    {isPrepping && (
                      <div style={{ marginTop: '16px', background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '12px 16px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={18} /> Prep Timer: {prepTimeLeft}s remaining. Recording starts automatically!
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* CANDIDATE'S RESPONSE TURN (Nova Signature Voice Studio Console) */}
        <div key={`candidate_msg_${currentSectionIndex}_${currentQuestionIndex}`} className="chat-bubble-animated" style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', width: '100%' }}>
          <div style={{ maxWidth: '880px', width: '100%' }}>
            
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4f46e5', marginBottom: '6px', textAlign: 'right', marginRight: '4px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
              <Mic size={14} color="#4f46e5" /> Candidate Voice Studio
            </div>

            {/* Studio Console Outer Frame - Nova Light & Indigo Glass Theme */}
            <div style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)',
              border: '1.5px solid #c7d2fe',
              borderRadius: '16px 0px 16px 16px',
              padding: '14px 18px',
              boxShadow: '0 6px 20px -5px rgba(79, 70, 229, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              overflow: 'visible'
            }}>

              {/* Real-time Studio Visualizer Display Box */}
              <div style={{
                width: '100%',
                background: '#ffffff',
                borderRadius: '12px',
                padding: '8px 14px',
                border: '1px solid #e0e7ff',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.72rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isRecording ? '#ef4444' : '#10b981', boxShadow: isRecording ? '0 0 8px #ef4444' : '0 0 6px #10b981' }} />
                    {isRecording ? 'RECORDING IN PROGRESS' : recordedAudioUrl ? 'AUDIO RECORDED' : 'VOICE INPUT'}
                  </span>
                  <span style={{ color: '#4f46e5', fontWeight: 800 }}>{isRecording ? `${recordingTime}s` : ''}</span>
                </div>

                <AudioVisualizer stream={mediaStream} isRecording={isRecording} height={42} />
              </div>

              {/* Mic Recording Controls */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                {!isRecording && !isProcessingAudio && !recordedAudioUrl && (
                  <button
                    onClick={() => startRecording()}
                    className="btn-maki-primary"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      padding: '9px 24px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      boxShadow: '0 3px 12px rgba(239, 68, 68, 0.25)',
                      borderRadius: '10px'
                    }}
                  >
                    <Mic size={18} /> Start Recording
                  </button>
                )}

                {isRecording && (
                  <button
                    onClick={async () => { await stopRecording(); }}
                    className="btn-maki-primary btn-rec-active"
                    style={{
                      background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                      padding: '9px 24px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      boxShadow: '0 0 18px rgba(239, 68, 68, 0.35)',
                      borderRadius: '10px'
                    }}
                  >
                    <Square size={16} /> Stop Recording ({recordingTime}s)
                  </button>
                )}

                {isProcessingAudio && !isRecording && (
                  <div style={{ fontSize: '0.82rem', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <Loader2 size={16} className="animate-spin" /> Saving your audio…
                  </div>
                )}

                {recordedAudioUrl && !isRecording && !isProcessingAudio && (
                  <CandidateAudioReviewBox
                    audioUrl={recordedAudioUrl}
                    durationHint={recordedAudioDuration || recordedDurationRef.current || recordingTime}
                    onReRecord={() => {
                      playClickSfx();
                      startRecording();
                    }}
                  />
                )}
              </div>

              {/* Microphone Error Notification Banner */}
              {micError && (
                <div style={{
                  width: '100%',
                  background: '#fef2f2',
                  border: '1.5px solid #fca5a5',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 700, color: '#991b1b' }}>
                    <AlertCircle size={18} color="#ef4444" />
                    {micError === 'denied'
                      ? 'Microphone Permission Denied'
                      : 'Microphone Unavailable'}
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#7f1d1d', lineHeight: '1.5', margin: 0 }}>
                    {micError === 'denied'
                      ? 'Your browser has blocked microphone access. Please click the lock icon in your address bar, set Microphone to "Allow", then try again.'
                      : 'No microphone was detected on your device. Please connect a microphone or headset and try again.'}
                  </p>
                  <button
                    onClick={() => { setMicError(null); startRecording(); }}
                    className="btn-maki-primary"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      padding: '8px 20px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      alignSelf: 'flex-start'
                    }}
                  >
                    <RotateCcw size={14} /> Retry Microphone
                  </button>
                </div>
              )}

              {/* Live Speech Recognition Telemetry Stream */}
              {transcriptText && (
                <div style={{
                  width: '100%',
                  background: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '0.88rem',
                  color: '#3730a3',
                  lineHeight: '1.5'
                }}>
                  <span style={{ fontWeight: 800, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Sparkles size={14} color="#4f46e5" /> Live Voice Recognition:
                  </span>
                  <span style={{ fontStyle: 'italic', color: '#1e1b4b' }}>"{transcriptText}"</span>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* ====== STICKY BOTTOM CONTROL BAR ====== */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        boxShadow: '0 -4px 25px rgba(0,0,0,0.08)',
        padding: '12px 24px 16px',
        zIndex: 100
      }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>

          {/* Row 1: Overall Progress Bar */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assessment Progress</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4f46e5' }}>{progressPercent}% Completed</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #4f46e5, #2563eb)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* Row 2: Section Indicators + Timer + Next Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>

            {/* Section Step Dots */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {sections.map((sec, idx) => {
                const isActive = idx === currentSectionIndex;
                const isCompleted = idx < currentSectionIndex;
                return (
                  <div
                    key={sec.id || idx}
                    style={{
                      width: isActive ? 'auto' : '30px',
                      height: '30px',
                      minWidth: '30px',
                      borderRadius: isActive ? '15px' : '50%',
                      padding: isActive ? '0 12px' : '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: isActive || isCompleted ? '#ffffff' : '#94a3b8',
                      background: isActive ? '#4f46e5' : isCompleted ? '#10b981' : '#f1f5f9',
                      border: isActive ? '2px solid #4f46e5' : isCompleted ? '2px solid #10b981' : '2px solid #cbd5e1',
                      transition: 'all 0.3s ease',
                      gap: '4px'
                    }}
                  >
                    {isCompleted ? '✓' : (idx + 1)}
                    {isActive && <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>/{sections.length}</span>}
                  </div>
                );
              })}
            </div>

            {/* Countdown Clock with Silent Freeze during upload/analysis */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: testTimeLeftSeconds < 180 ? '#ef4444' : '#0f172a',
              fontWeight: 700,
              fontSize: '0.9rem',
              background: testTimeLeftSeconds < 180 ? '#fef2f2' : '#f8fafc',
              padding: '8px 16px',
              borderRadius: '10px',
              border: testTimeLeftSeconds < 180 ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0'
            }}>
              <Clock size={16} color={testTimeLeftSeconds < 180 ? '#ef4444' : '#4f46e5'} />
              <span>{formatCountdown(testTimeLeftSeconds)}</span>
            </div>

            {/* Next / Finish Action Button */}
            <button
              onClick={() => { playClickSfx(); handleNext(); }}
              disabled={
                isAnalyzing ||
                isRecording ||
                isProcessingAudio ||
                isSyncingAudio ||
                !(
                  isRealAudioPayload(recordedBase64Audio) ||
                  isRealAudioPayload(recordedBase64Ref.current) ||
                  (recordedAudioUrl && (
                    String(recordedAudioUrl).startsWith('http') ||
                    String(recordedAudioUrl).startsWith('gdrive://') ||
                    String(recordedAudioUrl).startsWith('firebase://')
                  ))
                )
              }
              className={isAnalyzing ? 'btn-maki-analyzing' : 'btn-maki-primary'}
              style={{ padding: '10px 24px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '200px', justifyContent: 'center' }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={18} className="analyzing-spin" />
                  <span className="analyzing-label">Analyzing</span>
                  <span className="analyzing-dots" aria-hidden="true">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </>
              ) : isLastQuestion ? (
                <>
                  Finish Assessment <ChevronRight size={18} />
                </>
              ) : (
                <>
                  Next Question <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
