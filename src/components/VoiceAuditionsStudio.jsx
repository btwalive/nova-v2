import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckCircle2, Phone, Clock, ExternalLink, RefreshCw,
  MessageSquare, Download, Check, Search,
  ChevronDown, ChevronUp, Headphones, Loader2, Star, Mail, MapPin,
  Send, AlertCircle, Play, Pause, Volume2, RotateCcw, Copy, Sparkles, Key, Plus
} from 'lucide-react';
import { sendAssessmentFeedbackEmail } from '../services/assessmentEmailService';

// Status styling definitions
function getStatusBadge(decision) {
  switch (decision) {
    case 'shortlisted':  return { label: 'Shortlisted',  bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', icon: '🌟' };
    case 'selected':     return { label: 'Selected',     bg: '#dcfce7', text: '#166534', border: '#86efac', icon: '✅' };
    case 'second_round': return { label: '2nd Round',    bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: '🔄' };
    case 'on_hold':      return { label: 'On Hold',      bg: '#fefce8', text: '#a16207', border: '#fde68a', icon: '⏳' };
    case 'rejected':     return { label: 'Rejected',     bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', icon: '❌' };
    default:             return { label: 'Needs Review', bg: '#f8fafc', text: '#475569', border: '#cbd5e1', icon: '⚪' };
  }
}

// Mini animated sound wave equalizer lines
function SoundWaveBars({ isPlaying, color = '#4f46e5' }) {
  const bars = [8, 14, 10, 16, 9];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', height: '14px', verticalAlign: 'middle' }}>
      {bars.map((h, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: '2px',
            height: isPlaying ? '13px' : `${h * 0.7}px`,
            background: color,
            borderRadius: '1px',
            animation: isPlaying ? 'soundWaveBounce 0.7s ease-in-out infinite alternate' : 'none',
            animationDelay: `${i * 0.14}s`,
            transition: 'height 0.15s ease'
          }}
        />
      ))}
    </span>
  );
}

// Compact horizontal studio with 12 audio buttons and 1-click playback
function HorizontalAudioStudio({ clips = [], speed = 1.0 }) {
  const audioRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [visitedIndices, setVisitedIndices] = useState(() => new Set());
  const [hasError, setHasError] = useState(false);

  const fallbacks = [
    '/audio/prompts/intro_fresher_1.mp3',
    '/audio/prompts/reading_passage_1.mp3',
    '/audio/prompts/lr_sentence_1.mp3',
    '/audio/prompts/story_passage.mp3',
    '/audio/prompts/extempore_topic_1.mp3'
  ];

  const formatSource = (clip, index) => {
    const s = clip?.audioUrl || clip?.base64Audio || clip?.rawAudioUrl;
    if (!s) return fallbacks[index % fallbacks.length];
    if (s.startsWith('gdrive://')) {
      const fId = s.replace('gdrive://', '').trim();
      return `/api/drive-stream?id=${fId}`;
    }
    if (s.startsWith('firebase://')) {
      const parts = s.replace('firebase://', '').trim().split('/');
      return `/api/drive-stream?id=${parts[0]}`;
    }
    if (s.includes('drive.google.com/uc?id=')) {
      const match = s.match(/[?&]id=([^&]+)/);
      if (match) return `/api/drive-stream?id=${match[1]}`;
    }
    if (s.includes('drive.google.com/file/d/')) {
      const match = s.match(/\/file\/d\/([^/?]+)/);
      if (match) return `/api/drive-stream?id=${match[1]}`;
    }
    return s;
  };

  const activeClip = clips[activeIdx] || null;
  const activeSrc = formatSource(activeClip, activeIdx);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed || 1.0;
    }
  }, [speed]);

  const handleTogglePlay = (idx) => {
    setVisitedIndices(prev => new Set(prev).add(idx));

    if (activeIdx === idx) {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(e => console.warn('Audio play error:', e));
        }
      }
    } else {
      setActiveIdx(idx);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.src = formatSource(clips[idx], idx);
        audioRef.current.load();
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(e => console.warn('Audio play error:', e));
      }
    }
  };

  const handleError = () => {
    if (activeSrc && activeSrc.includes('/api/drive-stream?id=')) {
      const fId = activeSrc.split('id=')[1];
      if (fId && audioRef.current) {
        audioRef.current.src = `https://drive.usercontent.google.com/download?id=${fId}&export=download`;
        audioRef.current.load();
        if (isPlaying) audioRef.current.play().catch(() => {});
        return;
      }
    }
    const fallback = fallbacks[activeIdx % fallbacks.length];
    if (audioRef.current && audioRef.current.src !== fallback) {
      setHasError(true);
      audioRef.current.src = fallback;
      audioRef.current.load();
      if (isPlaying) audioRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || activeClip?.durationSeconds || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (activeIdx < clips.length - 1) {
      const nextIdx = activeIdx + 1;
      setActiveIdx(nextIdx);
      setVisitedIndices(prev => new Set(prev).add(nextIdx));
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.src = formatSource(clips[nextIdx], nextIdx);
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const effectiveDuration = duration || activeClip?.durationSeconds || 0;
    if (effectiveDuration > 0 && audioRef.current) {
      const newTime = pos * effectiveDuration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectiveDuration = duration || activeClip?.durationSeconds || 0;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  const extractedDriveId = activeClip?.gdriveId || (activeClip?.audioUrl && activeClip.audioUrl.startsWith('gdrive://') ? activeClip.audioUrl.replace('gdrive://', '').trim() : null);
  const downloadUrl = extractedDriveId
    ? `https://drive.usercontent.google.com/download?id=${extractedDriveId}&export=download`
    : (activeSrc.startsWith('http') || activeSrc.startsWith('/') ? activeSrc : null);

  const isRealCandidateAudio = (activeSrc.includes('drive-stream') || activeSrc.includes('drive.usercontent.google.com') || activeSrc.startsWith('data:audio')) && !hasError;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Hidden HTML5 Audio Engine */}
      <audio
        ref={audioRef}
        src={activeSrc}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        style={{ display: 'none' }}
      />

      {/* Header info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Headphones size={15} color="#4f46e5" />
          <span>Candidate Voice Auditions ({clips.length} Questions)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
            {visitedIndices.size} of {clips.length} reviewed
          </span>
          {isPlaying && (
            <span style={{ fontSize: '10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
              ▶ Playing Q{activeIdx + 1}
            </span>
          )}
        </div>
      </div>

      {/* 12 Horizontal Buttons with Audio Lines */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        alignItems: 'center',
        padding: '2px 0'
      }}>
        {clips.map((clip, ci) => {
          const isActive = activeIdx === ci;
          const isThisPlaying = isActive && isPlaying;
          const isVisited = visitedIndices.has(ci);
          const clipSecs = clip.durationSeconds || 0;

          return (
            <button
              key={ci}
              type="button"
              onClick={() => handleTogglePlay(ci)}
              title={`${clip.questionTitle || clip.questionId || `Question ${ci + 1}`}${clipSecs ? ` (${clipSecs}s)` : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 8px',
                borderRadius: '6px',
                border: isThisPlaying
                  ? '1.5px solid #2563eb'
                  : isActive
                    ? '1.5px solid #3b82f6'
                    : isVisited
                      ? '1px solid #a7f3d0'
                      : '1px solid #cbd5e1',
                background: isThisPlaying
                  ? '#eff6ff'
                  : isActive
                    ? '#f0f7ff'
                    : isVisited
                      ? '#f0fdf4'
                      : '#ffffff',
                color: isThisPlaying
                  ? '#1d4ed8'
                  : isActive
                    ? '#1e40af'
                    : isVisited
                      ? '#166534'
                      : '#1e293b',
                boxShadow: isThisPlaying
                  ? '0 0 0 2px rgba(37,99,235,0.2)'
                  : '0 1px 2px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                fontSize: '11.5px',
                fontWeight: '700',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {isThisPlaying ? (
                <Pause size={11} fill="#1d4ed8" color="#1d4ed8" />
              ) : (
                <Play size={11} fill={isActive ? '#2563eb' : isVisited ? '#166534' : '#64748b'} color={isActive ? '#2563eb' : isVisited ? '#166534' : '#64748b'} />
              )}
              <span>Q{ci + 1}</span>
              <SoundWaveBars isPlaying={isThisPlaying} color={isThisPlaying ? '#2563eb' : isActive ? '#3b82f6' : isVisited ? '#16a34a' : '#94a3b8'} />
              {clipSecs > 0 && (
                <span style={{ fontSize: '9.5px', fontWeight: '600', color: isThisPlaying ? '#1d4ed8' : isVisited ? '#15803d' : '#64748b', opacity: 0.9 }}>
                  {clipSecs}s
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Question Player Bar */}
      {activeClip && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '7px',
          padding: '7px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
              <span style={{ background: '#dbeafe', color: '#1e40af', fontWeight: '800', fontSize: '10px', padding: '1px 5px', borderRadius: '3px' }}>
                Q{activeIdx + 1}
              </span>
              <strong style={{ color: '#0f172a' }}>{activeClip.questionTitle || activeClip.questionId || `Question ${activeIdx + 1}`}</strong>
              {isRealCandidateAudio && (
                <span style={{ fontSize: '9px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '0 4px', borderRadius: '3px', fontWeight: '700' }}>
                  ✓ Voice Recording
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', fontWeight: '700' }}>
                {formatTime(currentTime)} / {formatTime(effectiveDuration)}
              </span>
              <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', fontWeight: '600' }}>
                {speed}x
              </span>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={`candidate_recording_q${activeIdx + 1}.wav`}
                  title="Download recording"
                  style={{ color: '#4f46e5', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                >
                  <Download size={12} />
                </a>
              )}
            </div>
          </div>

          {/* Seeking progress bar */}
          <div
            onClick={handleSeek}
            style={{
              width: '100%',
              height: '4px',
              background: '#e2e8f0',
              borderRadius: '2px',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
            title="Click to seek"
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: '#2563eb',
                borderRadius: '2px',
                transition: 'width 0.1s linear'
              }}
            />
          </div>

          {/* Transcript & Target prompt */}
          {(activeClip.expectedText || activeClip.transcript) && (
            <div style={{
              marginTop: '2px',
              fontSize: '11px',
              color: '#475569',
              background: '#f8fafc',
              padding: '4px 7px',
              borderRadius: '4px',
              border: '1px solid #f1f5f9',
              lineHeight: 1.35
            }}>
              {activeClip.expectedText && (
                <div><strong style={{ color: '#64748b' }}>Target Prompt:</strong> {activeClip.expectedText}</div>
              )}
              {activeClip.transcript && activeClip.transcript !== '(No spoken words recognized)' && (
                <div style={{ marginTop: activeClip.expectedText ? '2px' : 0 }}>
                  <strong style={{ color: '#0f172a' }}>Spoken:</strong> {activeClip.transcript}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Client Process Options
const DEFAULT_PROCESS_OPTIONS = [
  'Adobe GGN',
  'Airbnb',
  'Birkenstock GGN',
  'Amex Travel GGN',
  'Adobe Jaipur',
  'TP Norton Jaipur',
  'Meesho Voice Jaipur',
  'Telus Digital GGN',
  'LinkedIn GGN',
  'UPS Logistics GGN',
  'LanguageLine (LLS)',
  'Luxury Hotel GGN',
  'Equifax GGN',
  'PF Tech GGN',
  'MMT Travel Desk GGN',
  'Cricket Wireless Jaipur'
];

function ProcessMultiSelect({ selected = [], onChange, options = DEFAULT_PROCESS_OPTIONS }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(x => x !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const removeOption = (opt, e) => {
    if (e) e.stopPropagation();
    onChange(selected.filter(x => x !== opt));
  };

  const filtered = options.filter(opt => opt.toLowerCase().includes(query.toLowerCase().trim()));

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          minHeight: '38px',
          padding: '5px 8px',
          borderRadius: '6px',
          border: `1.5px solid ${isOpen ? '#4f46e5' : '#cbd5e1'}`,
          background: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '5px',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', flex: 1 }}>
          {selected.length === 0 ? (
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Assign processes (e.g. Adobe GGN, Airbnb)...</span>
          ) : (
            selected.map(opt => (
              <span
                key={opt}
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {opt}
                <button
                  type="button"
                  onClick={(e) => removeOption(opt, e)}
                  title={`Remove ${opt}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#3b82f6',
                    padding: 0,
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  ✕
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown size={14} color="#64748b" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </div>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 10000,
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
            maxHeight: '230px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc' }}>
            <Search size={12} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search process (e.g. Adobe, Airbnb)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: '12px',
                color: '#0f172a',
                background: 'transparent'
              }}
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                style={{ fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: '700' }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                No matching process found
              </div>
            ) : (
              filtered.map(opt => {
                const isSelected = selected.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    style={{
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? '#1d4ed8' : '#334155',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      transition: 'background 0.1s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                    />
                    <span>{opt}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Voice Auditions & Evaluations Studio ────────────────────────────────

export default function VoiceAuditionsStudio({
  submissions = [],
  onRefresh,
  isLoading = false,
  onUpdateFeedback
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDecision, setFilterDecision] = useState('all');
  const [filterProcess, setFilterProcess] = useState('all');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [expandedId, setExpandedId] = useState(null);
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [emailStatusMap, setEmailStatusMap] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Parse and normalize submissions
  const normalizedCandidates = useMemo(() => {
    return submissions.map(sub => {
      const id = sub.id || sub._dbId;
      const data = sub.data || {};
      const c = sub.candidate || data.candidate || {};
      const ev = sub.evaluation || data.evaluation || {};
      const fb = sub.recruiterFeedback || data.recruiterFeedback || {};

      // Raw responses with audio recordings
      const rawResponses = sub.rawResponses || data.rawResponses || sub.responses || data.responses || [];
      const rawClips = rawResponses.map((r, i) => ({
        questionId: r.questionId || `q${i + 1}`,
        questionTitle: r.questionTitle || `Question ${i + 1}`,
        audioUrl: r.audioUrl || r.base64Audio || r.rawAudioUrl || null,
        gdriveId: r.gdriveId || null,
        durationSeconds: r.durationSeconds || r.duration || 0,
        expectedText: r.expectedText || r.promptText || '',
        transcript: r.transcript || r.recognizedText || ''
      }));

      const overallScore = Math.round(Number(ev.overallScore ?? ev.score ?? sub.overallScore ?? 0));
      const cefr = ev.cefrLevel || sub.cefrLevel || (overallScore >= 75 ? 'C1' : overallScore >= 55 ? 'B2' : overallScore >= 40 ? 'B1' : 'A2');

      return {
        id,
        candidateName: c.fullName || c.name || sub.fullName || sub.name || (sub.email || c.email || '').split('@')[0] || 'Candidate',
        candidateEmail: (sub.email || c.email || '').trim().toLowerCase(),
        candidatePhone: c.phone || c.phoneNumber || sub.phone || '',
        location: c.currentLocation || c.location || sub.location || 'Gurgaon, Haryana',
        overallScore,
        cefrLevel: cefr,
        grammarScore: ev.grammarScore || Math.round(overallScore * 0.95),
        vocabularyScore: ev.vocabularyScore || Math.round(overallScore * 0.92),
        submittedAt: sub.submittedAt || sub.created_at || sub._createdAt || data.submittedAt || new Date().toISOString(),
        clips: rawClips,
        recruiterFeedback: fb
      };
    });
  }, [submissions]);

  // Filtered candidate list
  const filteredCandidates = useMemo(() => {
    return normalizedCandidates.filter(cand => {
      const t = searchTerm.toLowerCase().trim();
      const fb = cand.recruiterFeedback || {};
      const decision = fb.hiringDecision || 'pending';
      const assigned = fb.assignedProcesses || [];

      if (filterDecision !== 'all') {
        if (filterDecision === 'pending' && decision !== 'pending') return false;
        if (filterDecision !== 'pending' && decision !== filterDecision) return false;
      }

      if (filterProcess !== 'all' && !assigned.includes(filterProcess)) {
        return false;
      }

      if (!t) return true;

      return [
        cand.candidateName,
        cand.candidateEmail,
        cand.candidatePhone,
        cand.cefrLevel,
        String(cand.overallScore),
        assigned.join(' ')
      ].some(v => v && v.toLowerCase().includes(t));
    });
  }, [normalizedCandidates, searchTerm, filterDecision, filterProcess]);

  const total = normalizedCandidates.length;
  const pending = normalizedCandidates.filter(c => !c.recruiterFeedback?.hiringDecision || c.recruiterFeedback?.hiringDecision === 'pending').length;
  const selected = normalizedCandidates.filter(c => ['selected', 'shortlisted'].includes(c.recruiterFeedback?.hiringDecision)).length;

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDecision, filterProcess]);

  const totalPages = Math.ceil(filteredCandidates.length / pageSize) || 1;
  const paginatedCandidates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCandidates.slice(start, start + pageSize);
  }, [filteredCandidates, currentPage, pageSize]);

  // Handle saving feedback
  const handleSaveFeedback = (cand, partial) => {
    if (!onUpdateFeedback) return;
    const currentFb = cand.recruiterFeedback || {};
    const updated = {
      ...currentFb,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    onUpdateFeedback({ id: cand.id }, updated);
  };

  // 1-Click Send Result Email via Resend
  const handleSendEmail = async (cand, e) => {
    if (e) e.stopPropagation();
    const email = cand.candidateEmail;
    if (!email || !email.includes('@')) {
      alert('Candidate has no valid email address.');
      return;
    }

    setSendingEmailId(cand.id);
    setEmailStatusMap(prev => ({ ...prev, [cand.id]: null }));

    try {
      const fb = cand.recruiterFeedback || {};
      const stars = fb.rating || (cand.overallScore >= 70 ? 3 : cand.overallScore >= 45 ? 2 : 1);
      const res = await sendAssessmentFeedbackEmail({
        candidateEmail: email,
        candidateName: cand.candidateName,
        ratingStars: stars,
        customScore: cand.overallScore
      });

      if (res.success) {
        setEmailStatusMap(prev => ({ ...prev, [cand.id]: { success: true } }));
        handleSaveFeedback(cand, { emailSentAt: new Date().toISOString() });
      } else {
        setEmailStatusMap(prev => ({ ...prev, [cand.id]: { error: res.error || 'Failed to dispatch email' } }));
      }
    } catch (err) {
      setEmailStatusMap(prev => ({ ...prev, [cand.id]: { error: err.message } }));
    } finally {
      setSendingEmailId(null);
    }
  };

  // Copy evaluation summary
  const handleCopySummary = (cand, e) => {
    if (e) e.stopPropagation();
    const fb = cand.recruiterFeedback || {};
    const text = `📋 CANDIDATE VOICE EVALUATION
Name: ${cand.candidateName}
Email: ${cand.candidateEmail}
Phone: ${cand.candidatePhone || 'N/A'}
CEFR Level: ${cand.cefrLevel} (${cand.overallScore}/100)
Clips Captured: ${cand.clips.length}
Hiring Decision: ${(fb.hiringDecision || 'Pending Review').toUpperCase()}
Assigned Processes: ${(fb.assignedProcesses || []).join(', ') || 'None'}
Evaluation: https://evaluation.openhire.in/?admin=true`;

    navigator.clipboard.writeText(text);
    setCopiedId(cand.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'CEFR Level', 'Score', 'Decision', 'Processes', 'Clips Count', 'Date'];
    const rows = filteredCandidates.map(c => {
      const fb = c.recruiterFeedback || {};
      return [
        `"${c.candidateName}"`,
        `"${c.candidateEmail}"`,
        `"${c.candidatePhone}"`,
        `"${c.cefrLevel}"`,
        c.overallScore,
        `"${fb.hiringDecision || 'pending'}"`,
        `"${(fb.assignedProcesses || []).join('; ')}"`,
        c.clips.length,
        `"${c.submittedAt}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `nova_candidates_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '16px 20px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes soundWaveBounce {
          0% { height: 3px; }
          50% { height: 13px; }
          100% { height: 5px; }
        }
      `}</style>

      {/* Main Studio Card */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #cbd5e1', boxShadow: '0 4px 20px rgba(15,23,42,0.06)', overflow: 'hidden' }}>

        {/* Top Header Bar */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ecfdf5', border: '1.5px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Headphones size={22} color="#059669" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Candidate Voice Auditions & Evaluations
                </h1>
                <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '10px', fontWeight: '800' }}>
                  {total} Candidates
                </span>
                <span style={{ fontSize: '10px', background: '#059669', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                  LIVE CLOUD
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Multi-question voice playback studio, CEFR scoring, process assignment & candidate communication
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Playback speed toggle */}
            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 4px', fontSize: '12px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginRight: '4px' }}>Speed:</span>
              {[1.0, 1.25, 1.5].map(s => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  style={{
                    background: playbackSpeed === s ? '#4f46e5' : 'transparent',
                    color: playbackSpeed === s ? '#ffffff' : '#334155',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button
              onClick={handleExportCSV}
              style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <Download size={13} /> Export CSV
            </button>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: isLoading ? 'not-allowed' : 'pointer', background: '#0f172a', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                {isLoading ? 'Syncing...' : 'Sync Cloud'}
              </button>
            )}
          </div>
        </div>

        {/* Metric Counter Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          {[
            { label: 'Total Assessed Candidates', value: total, color: '#0f172a', bg: '#ffffff', border: '#e2e8f0' },
            { label: 'Needs Recruiter Review', value: pending, color: '#a16207', bg: '#fefce8', border: '#fde68a' },
            { label: 'Selected / Shortlisted', value: selected, color: '#166534', bg: '#dcfce7', border: '#86efac' },
          ].map(m => (
            <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: '8px', padding: '10px 16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{m.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: m.color, marginTop: '2px' }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Search and Filters Bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search candidate name, email, phone, CEFR score..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', height: '36px', paddingLeft: '34px', paddingRight: '10px', borderRadius: '7px', border: '1.5px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          <select
            value={filterDecision}
            onChange={e => setFilterDecision(e.target.value)}
            style={{ height: '36px', borderRadius: '7px', border: '1.5px solid #cbd5e1', background: '#fff', color: '#0f172a', fontSize: '13px', fontWeight: '600', padding: '0 10px', cursor: 'pointer' }}
          >
            <option value="all">All Decisions</option>
            <option value="pending">⚪ Needs Review</option>
            <option value="shortlisted">🌟 Shortlisted</option>
            <option value="selected">✅ Selected</option>
            <option value="second_round">🔄 2nd Round</option>
            <option value="on_hold">⏳ On Hold</option>
            <option value="rejected">❌ Rejected</option>
          </select>

          <select
            value={filterProcess}
            onChange={e => setFilterProcess(e.target.value)}
            style={{ height: '36px', borderRadius: '7px', border: '1.5px solid #cbd5e1', background: '#fff', color: '#0f172a', fontSize: '13px', fontWeight: '600', padding: '0 10px', cursor: 'pointer' }}
          >
            <option value="all">All Processes</option>
            {DEFAULT_PROCESS_OPTIONS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Candidate List Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8fafc' }}>
          {filteredCandidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: '#ffffff', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
              <Headphones size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '700', color: '#334155' }}>No candidate auditions found</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Try clearing filters or search terms</p>
            </div>
          ) : (
            paginatedCandidates.map((cand, idx) => {
              const fb = cand.recruiterFeedback || {};
              const decision = fb.hiringDecision || 'pending';
              const badge = getStatusBadge(decision);
              const assigned = fb.assignedProcesses || [];
              const isSending = sendingEmailId === cand.id;
              const emailStatus = emailStatusMap[cand.id];
              const isCopied = copiedId === cand.id;

              return (
                <div
                  key={cand.id || idx}
                  style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Top Candidate Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>{cand.candidateName}</span>
                        {/* CEFR Pill */}
                        <span style={{
                          background: cand.overallScore >= 70 ? '#ecfdf5' : '#eff6ff',
                          color: cand.overallScore >= 70 ? '#065f46' : '#1d4ed8',
                          border: `1px solid ${cand.overallScore >= 70 ? '#a7f3d0' : '#bfdbfe'}`,
                          padding: '1px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '800'
                        }}>
                          CEFR {cand.cefrLevel} ({cand.overallScore}/100)
                        </span>
                        {/* Status Badge */}
                        <span style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`, padding: '1px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                          {badge.icon} {badge.label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' }}>
                        <span>✉️ {cand.candidateEmail}</span>
                        {cand.candidatePhone && <span>📞 {cand.candidatePhone}</span>}
                        <span>📍 {cand.location}</span>
                        <span>🕒 {new Date(cand.submittedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Quick Communication Triggers */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {cand.candidatePhone && (
                        <>
                          <a
                            href={`https://wa.me/${cand.candidatePhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${cand.candidateName}, this is regarding your Nova Voice Assessment results with OpenHire.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: '#25d366',
                              color: '#ffffff',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            💬 WhatsApp
                          </a>
                          <a
                            href={`tel:${cand.candidatePhone}`}
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Phone size={12} /> Call
                          </a>
                        </>
                      )}

                      {/* 1-Click Send Result Email */}
                      <button
                        onClick={(e) => handleSendEmail(cand, e)}
                        disabled={isSending}
                        style={{
                          background: '#4f46e5',
                          color: '#ffffff',
                          border: 'none',
                          padding: '5px 11px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: isSending ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        {isSending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                        {isSending ? 'Sending...' : 'Send Result Email'}
                      </button>

                      {/* Copy summary */}
                      <button
                        onClick={(e) => handleCopySummary(cand, e)}
                        style={{
                          background: '#ffffff',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          padding: '5px 9px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Copy evaluation summary"
                      >
                        {isCopied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        {isCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Email Feedback Toast */}
                  {emailStatus && (
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: emailStatus.success ? '#ecfdf5' : '#fef2f2',
                      color: emailStatus.success ? '#065f46' : '#991b1b',
                      border: `1px solid ${emailStatus.success ? '#a7f3d0' : '#fecaca'}`
                    }}>
                      {emailStatus.success ? '✓ Result email dispatched to candidate via Resend' : `Error: ${emailStatus.error}`}
                    </div>
                  )}

                  {/* Horizontal 12-Audio Studio */}
                  {cand.clips.length > 0 ? (
                    <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <HorizontalAudioStudio clips={cand.clips} speed={playbackSpeed} />
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
                      No voice recordings uploaded for this session
                    </div>
                  )}

                  {/* Bottom Controls: Decision & Process Matching */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    {/* Decision Selector & Star Rating */}
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                        Hiring Decision & Star Rating
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <select
                          value={decision}
                          onChange={(e) => handleSaveFeedback(cand, { hiringDecision: e.target.value })}
                          style={{
                            height: '34px',
                            padding: '0 10px',
                            borderRadius: '6px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '12px',
                            fontWeight: '700',
                            background: '#ffffff',
                            color: '#0f172a',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="pending">⚪ Needs Review</option>
                          <option value="shortlisted">🌟 Shortlisted</option>
                          <option value="selected">✅ Selected</option>
                          <option value="second_round">🔄 2nd Round</option>
                          <option value="on_hold">⏳ On Hold</option>
                          <option value="rejected">❌ Rejected</option>
                        </select>

                        {/* Stars */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          {[1, 2, 3].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleSaveFeedback(cand, {
                                rating: star,
                                hiringDecision: star >= 3 ? 'shortlisted' : star === 2 ? 'selected' : 'rejected'
                              })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                              title={`Rate ${star} Star${star > 1 ? 's' : ''}`}
                            >
                              <Star
                                size={18}
                                fill={(fb.rating || 0) >= star ? '#f59e0b' : 'none'}
                                color={(fb.rating || 0) >= star ? '#f59e0b' : '#cbd5e1'}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Process Matcher Multi-Select */}
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                        Eligible Process Matching
                      </label>
                      <ProcessMultiSelect
                        selected={assigned}
                        onChange={(newAssigned) => handleSaveFeedback(cand, { assignedProcesses: newAssigned })}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination Controls */}
          {filteredCandidates.length > pageSize && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginTop: '8px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                Showing <strong style={{ color: '#0f172a' }}>{(currentPage - 1) * pageSize + 1}</strong> to <strong style={{ color: '#0f172a' }}>{Math.min(currentPage * pageSize, filteredCandidates.length)}</strong> of <strong style={{ color: '#0f172a' }}>{filteredCandidates.length}</strong> candidates
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: currentPage === 1 ? '#f8fafc' : '#ffffff',
                    color: currentPage === 1 ? '#94a3b8' : '#334155',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: currentPage === totalPages ? '#f8fafc' : '#ffffff',
                    color: currentPage === totalPages ? '#94a3b8' : '#334155',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
