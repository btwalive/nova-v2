import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Users, Key, Plus, Search, Play, Pause, Award, CheckCircle, Clock, 
  Download, FileText, RefreshCw, MapPin, Star, Share2, 
  ChevronDown, ChevronUp, Phone, Mail, Headphones, Loader2, CheckCircle2, Check,
  Volume2, VolumeX, Bell, BellRing, Sparkles
} from 'lucide-react';
import { updateSubmissionInCloud } from '../services/cloudDatabase';
import { fetchAudioClipFromFirebase } from '../services/firebaseBackup';
import { resolveGDriveUrlAsync, isGDriveRef } from '../services/googleDriveStorage';
import { sendAssessmentFeedbackEmail } from '../services/assessmentEmailService';
import { notificationService } from '../services/notificationService';
import { emitParentMessage } from '../services/externalIntegrationService';
import ResumeViewerModal from './ResumeViewerModal';

function CandidateAudioPlayer({ initialSrc, submissionId, questionId, playbackRate = 1.0 }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (!initialSrc && !submissionId) return;

    if (initialSrc && isGDriveRef(initialSrc)) {
      const fileId = initialSrc.replace('gdrive://', '').trim();
      const streamUrl = `/api/drive-stream?id=${fileId}`;
      setAudioUrl(streamUrl);
      return;
    }

    const isFirebaseRef = initialSrc && String(initialSrc).startsWith('firebase://');
    const isPlayableUrl = initialSrc && !isFirebaseRef &&
      (String(initialSrc).startsWith('http') || String(initialSrc).startsWith('/') || String(initialSrc).startsWith('data:') || String(initialSrc).startsWith('blob:'));

    if (isPlayableUrl) {
      setAudioUrl(initialSrc);
      return;
    }

    const resolvedSubId = isFirebaseRef
      ? initialSrc.replace('firebase://', '').split('/')[0]
      : submissionId;
    const resolvedQId = isFirebaseRef
      ? initialSrc.replace('firebase://', '').split('/').slice(1).join('/')
      : questionId;

    if (resolvedSubId && resolvedQId) {
      setLoading(true);
      fetchAudioClipFromFirebase(resolvedSubId, resolvedQId)
        .then((b64) => {
          if (b64) {
            const formatted = b64.startsWith('data:') ? b64 : `data:audio/webm;base64,${b64}`;
            setAudioUrl(formatted);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [initialSrc, submissionId, questionId]);

  const handleAudioError = () => {
    if (initialSrc && isGDriveRef(initialSrc)) {
      const fileId = initialSrc.replace('gdrive://', '').trim();
      // Direct CDN fallback if local proxy fails
      setAudioUrl(`https://drive.usercontent.google.com/download?id=${fileId}&export=download`);
    } else if (submissionId && questionId) {
      fetchAudioClipFromFirebase(submissionId, questionId).then((b64) => {
        if (b64) setAudioUrl(b64.startsWith('data:') ? b64 : `data:audio/webm;base64,${b64}`);
      }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontStyle: 'italic', padding: '6px 0' }}>
        ⏳ Loading voice clip...
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(148, 163, 184, 0.08)', padding: '4px 8px', borderRadius: '4px', fontStyle: 'italic' }}>
        Audio recording not captured for this question
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        preload="metadata"
        onError={handleAudioError}
        style={{ width: '100%', height: '36px', borderRadius: '6px' }}
      />
    </div>
  );
}

function formatSyncTime(isoStr) {
  if (!isoStr) return 'Active';
  const diffSec = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function RecruiterDashboard({
  submissions = [],
  activeKeys = {},
  onAddKey,
  isLoadingSubmissions = false,
  lastSyncTime = null,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState('candidates');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDecision, setFilterDecision] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [previewResumeCandidate, setPreviewResumeCandidate] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [speed, setSpeed] = useState(1.0);
  const [showAllAudioFor, setShowAllAudioFor] = useState({});

  const [newRoleName, setNewRoleName] = useState('');
  const [generatedKeys, setGeneratedKeys] = useState([]);
  const [bulkCount, setBulkCount] = useState(5);

  const [localSubmissions, setLocalSubmissions] = useState(submissions);
  const [autoSaveStatus, setAutoSaveStatus] = useState({});
  const [emailToast, setEmailToast] = useState(null); // { id, message, status: 'sending' | 'sent' | 'error' }
  const [soundEnabled, setSoundEnabled] = useState(() => notificationService.isSoundEnabled());
  const [notificationPermission, setNotificationPermission] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  });
  const timersRef = useRef({});
  const feedbackCacheRef = useRef({});

  const handleToggleSound = () => {
    const next = !soundEnabled;
    notificationService.setSoundEnabled(next);
    setSoundEnabled(next);
  };

  const handleTestChime = async () => {
    notificationService.playChime();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
      const perm = await notificationService.requestPermission();
      setNotificationPermission(perm);
    }
  };

  const handleEnableDesktopAlerts = async () => {
    const perm = await notificationService.requestPermission();
    setNotificationPermission(perm);
    notificationService.playChime();
  };

  // Load any locally-saved feedback that hasn't synced to cloud yet
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hirewave_recruiter_feedback_cache');
      if (saved) feedbackCacheRef.current = JSON.parse(saved);
    } catch (e) {}
  }, []);

  // Merge incoming submissions with any locally-modified feedback
  // instead of blindly overwriting (which was wiping unsaved feedback)
  useEffect(() => {
    if (!submissions || submissions.length === 0) return;
    const fbCache = feedbackCacheRef.current;

    setLocalSubmissions(prev => {
      // Build lookup of locally-modified feedback from both prev state and localStorage
      const localFeedbackMap = {};
      prev.forEach(item => {
        const id = item.id || item._dbId;
        if (id && item.recruiterFeedback?.updatedAt) {
          localFeedbackMap[id] = item.recruiterFeedback;
        }
      });
      // Also overlay any localStorage-cached feedback
      Object.entries(fbCache).forEach(([id, fb]) => {
        if (fb?.updatedAt) {
          const existing = localFeedbackMap[id];
          // Keep the more recent one
          if (!existing || new Date(fb.updatedAt) > new Date(existing.updatedAt)) {
            localFeedbackMap[id] = fb;
          }
        }
      });

      return submissions.map(s => {
        const id = s.id || s._dbId;
        const localFb = localFeedbackMap[id];
        const cloudFb = s.recruiterFeedback;

        // If we have local feedback that's newer than what cloud returned, keep local
        if (localFb && localFb.updatedAt) {
          const cloudTime = cloudFb?.updatedAt ? new Date(cloudFb.updatedAt).getTime() : 0;
          const localTime = new Date(localFb.updatedAt).getTime();
          if (localTime > cloudTime) {
            return { ...s, recruiterFeedback: localFb };
          }
        }
        return s;
      });
    });
  }, [submissions]);

  useEffect(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, []);

  // Auto-Save Recruiter Feedback & Auto-Dispatch Email
  const handleUpdateFeedback = (sub, partial) => {
    const subId = sub.id || sub._dbId;
    if (!subId) return;

    const currentFB = sub.recruiterFeedback || {};
    let updatedDecision = partial.hiringDecision !== undefined ? partial.hiringDecision : currentFB.hiringDecision;

    // 🌟 STAR CLICK TRIGGER: Auto-set decision and trigger email only when stars are clicked
    const isStarClick = partial.rating !== undefined;
    const clickedRating = Number(partial.rating);

    if (isStarClick) {
      if (clickedRating <= 2) {
        updatedDecision = 'rejected';
      } else {
        updatedDecision = 'selected';
      }
    }

    const merged = {
      ...currentFB,
      ...partial,
      hiringDecision: updatedDecision,
      reviewerName: currentFB.reviewerName || 'Recruiter',
      updatedAt: new Date().toISOString()
    };

    // Update local UI immediately
    setLocalSubmissions(prev =>
      prev.map(item => (item.id || item._dbId) === subId ? { ...item, recruiterFeedback: merged } : item)
    );

    // Cache feedback to localStorage immediately (survives refresh even if cloud is slow)
    try {
      feedbackCacheRef.current[subId] = merged;
      localStorage.setItem('hirewave_recruiter_feedback_cache', JSON.stringify(feedbackCacheRef.current));
    } catch (e) {}

    // Emit event to external parent portal (if embedded in iframe)
    emitParentMessage('CANDIDATE_FEEDBACK_UPDATED', {
      submissionId: subId,
      feedback: merged,
      candidate: sub.candidate
    });

    // 🚀 AUTO-SEND CANDIDATE EMAIL: ONLY TRIGGERS ON STAR CLICK (and skips if already sent for this exact rating)
    const candEmail = sub.candidate?.email || sub.email;
    const candName = sub.candidate?.fullName || sub.candidate?.name || sub.fullName || sub.name || 'Candidate';
    const previousEmailRating = currentFB.emailSentForRating;

    if (isStarClick && candEmail) {
      const emailStars = clickedRating <= 1 ? 1 : clickedRating === 2 ? 2 : 3;
      const statusLabel = emailStars >= 3 ? 'Selected' : 'Rejected';

      // If the candidate was already sent an email for this exact star tier, don't spam them again
      if (previousEmailRating === clickedRating) {
        setEmailToast({
          id: subId,
          message: `ℹ️ ${clickedRating}★ Email already sent previously to ${candEmail}`,
          status: 'sent'
        });
        setTimeout(() => setEmailToast(null), 4000);
        return;
      }

      setEmailToast({
        id: subId,
        message: `Sending ${emailStars}★ (${statusLabel}) email to ${candEmail}...`,
        status: 'sending'
      });

      sendAssessmentFeedbackEmail({
        candidateEmail: candEmail,
        candidateName: candName,
        ratingStars: emailStars,
        customFeedback: merged.areasForImprovement || merged.notes || ''
      }).then(res => {
        if (res.success) {
          merged.emailSentForRating = clickedRating;
          merged.emailSentAt = new Date().toISOString();

          setEmailToast({
            id: subId,
            message: `✉️ Sent ${emailStars}★ Email to ${candEmail} (${res.evalData?.statusLabel || statusLabel})`,
            status: 'sent'
          });
          setTimeout(() => setEmailToast(null), 4500);
        } else {
          setEmailToast({
            id: subId,
            message: `⚠️ Email failed: ${res.error}`,
            status: 'error'
          });
          setTimeout(() => setEmailToast(null), 4500);
        }
      }).catch(err => {
        setEmailToast({
          id: subId,
          message: `⚠️ Email error: ${err.message}`,
          status: 'error'
        });
        setTimeout(() => setEmailToast(null), 4500);
      });
    }

    if (timersRef.current[subId]) clearTimeout(timersRef.current[subId]);
    setAutoSaveStatus(prev => ({ ...prev, [subId]: 'saving' }));

    timersRef.current[subId] = setTimeout(async () => {
      try {
        // Read latest submission state from localSubmissions to avoid stale closures
        let latestSub = sub;
        setLocalSubmissions(prev => {
          const found = prev.find(item => (item.id || item._dbId) === subId);
          if (found) latestSub = found;
          return prev; // no mutation, just reading
        });

        await updateSubmissionInCloud(subId, { ...latestSub, recruiterFeedback: merged });
        setAutoSaveStatus(prev => ({ ...prev, [subId]: 'saved' }));

        // Clear from localStorage cache once cloud confirms
        try {
          delete feedbackCacheRef.current[subId];
          localStorage.setItem('hirewave_recruiter_feedback_cache', JSON.stringify(feedbackCacheRef.current));
        } catch (e) {}

        setTimeout(() => {
          setAutoSaveStatus(prev => {
            const next = { ...prev };
            delete next[subId];
            return next;
          });
        }, 2000);
      } catch (e) {
        console.warn('Auto-save error:', e);
        setAutoSaveStatus(prev => ({ ...prev, [subId]: 'error' }));
      }
    }, 600);
  };

  const handleCopySummary = (sub, e) => {
    if (e) e.stopPropagation();
    const c = sub.candidate || {};
    const fb = sub.recruiterFeedback || {};
    const name = c.fullName || c.name || sub.fullName || sub.name || 'Candidate';
    const phone = c.phone || c.phoneNumber || sub.phone || 'N/A';
    const email = c.email || sub.email || 'N/A';
    const location = c.currentLocation || c.location || sub.location || 'N/A';

    const text = `📋 CANDIDATE VOICE EVALUATION
Candidate: ${name}
Phone: ${phone}
Email: ${email}
Location: ${location}
Experience: ${c.experienceLevel || 'Fresher'}
Role Key: ${sub.authKey || 'Direct'}
Hiring Decision: ${(fb.hiringDecision || 'Pending').toUpperCase()}
Rating: ${fb.rating ? `${fb.rating}/5 Stars` : 'Not Rated'}
Remarks: ${fb.notes || 'None'}
Clips Submitted: ${sub.rawResponses?.length || 0}`;

    navigator.clipboard.writeText(text);
    setCopiedId(sub.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleExportCSV = () => {
    if (!localSubmissions.length) return;
    const headers = ['Candidate Name', 'Phone', 'Email', 'Location', 'Experience', 'Role Key', 'Clips', 'Submitted At', 'Decision', 'Rating', 'Remarks'];
    const rows = localSubmissions.map(s => {
      const c = s.candidate || {};
      const fb = s.recruiterFeedback || {};
      const name = c.fullName || c.name || s.fullName || s.name || '';
      const phone = c.phone || c.phoneNumber || s.phone || '';
      const email = c.email || s.email || '';
      const location = c.currentLocation || c.location || s.location || '';

      return [
        `"${name}"`,
        `"${phone}"`,
        `"${email}"`,
        `"${location}"`,
        `"${c.experienceLevel || 'Fresher'}"`,
        `"${s.authKey || ''}"`,
        s.rawResponses?.length || 0,
        `"${s.submittedAt || s._createdAt || ''}"`,
        `"${fb.hiringDecision || 'pending'}"`,
        fb.rating || '',
        `"${(fb.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Candidate_Evaluations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateKey = (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const randomKey = Math.random().toString(36).substring(2, 10);
    onAddKey(randomKey, newRoleName.trim());
    setGeneratedKeys([randomKey]);
    setNewRoleName('');
  };

  const handleBulkCreateKeys = () => {
    if (!newRoleName.trim()) return;
    const keys = [];
    const count = parseInt(bulkCount, 10) || 5;
    for (let i = 0; i < count; i++) {
      const randomKey = Math.random().toString(36).substring(2, 10);
      onAddKey(randomKey, newRoleName.trim());
      keys.push(randomKey);
    }
    setGeneratedKeys(keys);
    setNewRoleName('');
  };

  // Filtered List
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return (localSubmissions || []).filter(s => {
      if (!s) return false;
      const c = s.candidate || {};
      const fb = s.recruiterFeedback || {};
      const name = c.fullName || c.name || c.candidateName || s.fullName || s.name || s.candidateName || '';
      const phone = c.phone || c.phoneNumber || c.mobile || s.phone || s.phoneNumber || '';
      const email = c.email || s.email || '';
      const location = c.currentLocation || c.location || c.city || s.location || '';
      const key = s.authKey || s.key || '';

      const matchesTerm = !term ||
        name.toLowerCase().includes(term) ||
        phone.toLowerCase().includes(term) ||
        email.toLowerCase().includes(term) ||
        location.toLowerCase().includes(term) ||
        key.toLowerCase().includes(term);
      
      const decision = fb.hiringDecision || 'pending';
      const matchesDecision = filterDecision === 'all' || decision === filterDecision;
      return matchesTerm && matchesDecision;
    });
  }, [localSubmissions, searchTerm, filterDecision]);

  const getStatusBadge = (decision) => {
    switch (decision) {
      case 'shortlisted':
        return { label: 'Shortlisted', bg: 'rgba(5, 150, 105, 0.2)', text: '#34d399', border: '#059669', icon: '🌟' };
      case 'selected':
        return { label: 'Selected', bg: 'rgba(22, 163, 74, 0.2)', text: '#4ade80', border: '#16a34a', icon: '✅' };
      case 'second_round':
        return { label: '2nd Round', bg: 'rgba(79, 70, 229, 0.2)', text: '#a5b4fc', border: '#4f46e5', icon: '🔄' };
      case 'on_hold':
        return { label: 'On Hold', bg: 'rgba(217, 119, 6, 0.2)', text: '#fcd34d', border: '#d97706', icon: '⏳' };
      case 'rejected':
        return { label: 'Rejected', bg: 'rgba(220, 38, 38, 0.2)', text: '#f87171', border: '#dc2626', icon: '❌' };
      default:
        return { label: 'Needs Review', bg: 'rgba(148, 163, 184, 0.12)', text: '#94a3b8', border: '#334155', icon: '⚪' };
    }
  };

  const totalCount = localSubmissions.length;
  const pendingCount = localSubmissions.filter(s => (s.recruiterFeedback?.hiringDecision || 'pending') === 'pending').length;
  const shortlistedCount = localSubmissions.filter(s => ['shortlisted', 'selected'].includes(s.recruiterFeedback?.hiringDecision)).length;

  return (
    <div style={{ background: '#090d16', minHeight: '100vh', padding: '20px 24px', color: '#f8fafc', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      
      <style>{`
        @media (max-width: 768px) {
          .admin-desktop-header { display: none !important; }
          .admin-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
            padding: 14px !important;
            border-radius: 10px !important;
            margin-bottom: 10px !important;
            background: #111827 !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
          }
          .admin-drawer {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Headphones size={22} color="#818cf8" /> Candidate Voice Submissions
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '3px 0 0 0' }}>
            Review candidate voice recordings & manage hiring decisions
          </p>

          {/* Floating Email Notification Toast */}
          {emailToast && (
            <div style={{
              marginTop: '8px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: emailToast.status === 'error' ? 'rgba(239, 68, 68, 0.2)' : emailToast.status === 'sent' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              border: `1px solid ${emailToast.status === 'error' ? '#ef4444' : emailToast.status === 'sent' ? '#22c55e' : '#3b82f6'}`,
              color: emailToast.status === 'error' ? '#fca5a5' : emailToast.status === 'sent' ? '#86efac' : '#93c5fd'
            }}>
              {emailToast.status === 'sending' && <Loader2 size={13} className="animate-spin" />}
              {emailToast.status === 'sent' && <CheckCircle2 size={13} color="#22c55e" />}
              {emailToast.status === 'error' && <Clock size={13} color="#ef4444" />}
              <span>{emailToast.message}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sound & Notification Controls */}
          <button
            onClick={handleToggleSound}
            title={soundEnabled ? 'Click to Mute New Candidate Alert Chimes' : 'Click to Enable New Candidate Alert Chimes'}
            style={{
              background: soundEnabled ? 'rgba(37, 99, 235, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${soundEnabled ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              color: soundEnabled ? '#93c5fd' : '#fca5a5',
              padding: '6px 11px',
              borderRadius: '7px',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s'
            }}
          >
            {soundEnabled ? <Volume2 size={13} color="#60a5fa" /> : <VolumeX size={13} color="#f87171" />}
            {soundEnabled ? 'Sound: ON' : 'Sound: OFF'}
          </button>

          <button
            onClick={handleTestChime}
            title="Test notification chime sound & grant browser alerts permission"
            style={{
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#e2e8f0',
              padding: '6px 10px',
              borderRadius: '7px',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Play size={11} color="#38bdf8" /> Test Chime
          </button>

          {notificationPermission !== 'granted' && (
            <button
              onClick={handleEnableDesktopAlerts}
              title="Allow browser popup notifications when candidate submits test"
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fde68a',
                padding: '6px 10px',
                borderRadius: '7px',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <BellRing size={12} color="#fbbf24" /> Enable Browser Alerts
            </button>
          )}

          {/* Smart Cache & Sync Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            padding: '5px 10px',
            borderRadius: '8px',
            fontSize: '0.74rem'
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#38bdf8', fontWeight: 700 }}>
              <Sparkles size={12} color="#38bdf8" /> {localSubmissions.length} Cached
            </span>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
              {formatSyncTime(lastSyncTime)}
            </span>
          </div>

          {onRefresh && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {/* Quick Delta Check (Lightweight, 0 server strain) */}
              <button
                onClick={() => onRefresh(false, true)}
                title="Quick Check: Fetch only newly submitted candidates without reloading the entire database"
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  color: '#93c5fd',
                  padding: '6px 11px',
                  borderRadius: '7px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {isLoadingSubmissions ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={12} />}
                Quick Check
              </button>

              {/* Full Cloud Resync */}
              <button
                onClick={() => {
                  if (window.confirm('Perform a full database resync from cloud? This will re-fetch all candidate records.')) {
                    onRefresh(true, false);
                  }
                }}
                title="Full Sync: Download all records directly from cloud database"
                style={{
                  background: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#cbd5e1',
                  padding: '6px 10px',
                  borderRadius: '7px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={11} color="#94a3b8" />
                Full Sync
              </button>
            </div>
          )}

          <button
            onClick={handleExportCSV}
            style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#e2e8f0', padding: '6px 11px', borderRadius: '7px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Download size={13} /> Export CSV
          </button>

          <div style={{ display: 'flex', background: '#111827', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              onClick={() => setActiveTab('candidates')}
              style={{ background: activeTab === 'candidates' ? '#2563eb' : 'transparent', color: activeTab === 'candidates' ? '#ffffff' : '#94a3b8', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Candidates ({localSubmissions.length})
            </button>
            <button
              onClick={() => setActiveTab('keys')}
              style={{ background: activeTab === 'keys' ? '#2563eb' : 'transparent', color: activeTab === 'keys' ? '#ffffff' : '#94a3b8', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Test Keys ({Object.keys(activeKeys).length})
            </button>
          </div>
        </div>
      </div>



      {activeTab === 'candidates' ? (
        <>
          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#111827', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Total Candidates</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>{totalCount}</div>
            </div>
            <div style={{ background: '#111827', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>Needs Review</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '2px' }}>{pendingCount}</div>
            </div>
            <div style={{ background: '#111827', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>Shortlisted / Selected</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>{shortlistedCount}</div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ background: '#111827', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search candidate name, phone, email, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', height: '34px', paddingLeft: '32px', paddingRight: '10px', borderRadius: '7px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#0f172a', color: '#ffffff', fontSize: '0.8rem' }}
              />
              <Search size={13} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>

            {/* Filter Dropdown */}
            <select
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value)}
              style={{ height: '34px', borderRadius: '7px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#0f172a', color: '#e2e8f0', fontSize: '0.76rem', fontWeight: 600, padding: '0 8px', cursor: 'pointer' }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">⏳ Needs Review</option>
              <option value="shortlisted">🌟 Shortlisted</option>
              <option value="selected">✅ Selected</option>
              <option value="second_round">🔄 2nd Round</option>
              <option value="on_hold">⏳ On Hold</option>
              <option value="rejected">❌ Rejected</option>
            </select>

            {/* Audio Speed */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#0f172a', padding: '2px 6px', borderRadius: '7px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Speed:</span>
              {[1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setSpeed(rate)}
                  style={{ background: speed === rate ? '#2563eb' : 'transparent', color: speed === rate ? '#ffffff' : '#94a3b8', border: 'none', borderRadius: '4px', padding: '2px 4px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', padding: '6px 10px', borderRadius: '7px', fontSize: '0.74rem', cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Candidates List */}
          {isLoadingSubmissions && localSubmissions.length === 0 ? (
            <div style={{ background: '#111827', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <div>Loading Candidate Pipeline...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: '#111827', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <Users size={32} color="#64748b" style={{ marginBottom: '8px' }} />
              <div>No candidate submissions found.</div>
            </div>
          ) : (
            <div style={{ background: '#111827', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', overflow: 'hidden' }}>
              
              {/* Header */}
              <div className="admin-desktop-header" style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(240px, 2.5fr) minmax(110px, 1fr) minmax(130px, 1fr) minmax(110px, 0.9fr) minmax(70px, 0.6fr) 80px',
                padding: '10px 16px',
                background: '#0b0f19',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.4px'
              }}>
                <div>Candidate Profile</div>
                <div>Role Key</div>
                <div>Hiring Status</div>
                <div>Rating</div>
                <div>Resume</div>
                <div style={{ textAlign: 'right' }}>Review</div>
              </div>

              {/* Rows */}
              {filtered.map((sub, idx) => {
                const isExpanded = expandedId === sub.id;
                const fb = sub.recruiterFeedback || {};
                const decision = fb.hiringDecision || 'pending';
                const rating = fb.rating || 0;
                const statusBadge = getStatusBadge(decision);
                const c = sub.candidate || {};
                const audioClips = sub.rawResponses || [];

                const candidateName = c.fullName || c.name || c.candidateName || sub.fullName || sub.name || sub.email || 'Candidate';
                const phone = c.phone || c.phoneNumber || c.mobile || sub.phone || sub.phoneNumber || '';
                const email = c.email || sub.email || '';
                const location = c.currentLocation || c.location || c.city || sub.location || '';
                const currentSave = autoSaveStatus[sub.id];

                return (
                  <div key={sub.id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    
                    <div 
                      className="admin-row"
                      onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(240px, 2.5fr) minmax(110px, 1fr) minmax(130px, 1fr) minmax(110px, 0.9fr) minmax(70px, 0.6fr) 80px',
                        padding: '12px 16px',
                        alignItems: 'center',
                        background: isExpanded ? 'rgba(30, 41, 59, 0.6)' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      {/* Col 1: Candidate Profile */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.88rem' }}>
                            {candidateName}
                          </span>
                          {audioClips.length > 0 && (
                            <span style={{ fontSize: '0.62rem', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 700 }}>
                              🎙️ {audioClips.length} clips
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                          {phone && (
                            <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} style={{ color: '#38bdf8', textDecoration: 'none' }}>
                              📞 {phone}
                            </a>
                          )}
                          {email && <span>✉️ {email}</span>}
                          {location && <span style={{ color: '#38bdf8' }}>📍 {location}</span>}
                        </div>
                      </div>

                      {/* Col 2: Role Key */}
                      <div style={{ fontSize: '0.76rem', color: '#cbd5e1', fontWeight: 600 }}>
                        {sub.authKey || 'Direct'}
                      </div>

                      {/* Col 3: Status Badge */}
                      <div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: statusBadge.bg, border: `1px solid ${statusBadge.border}`, color: statusBadge.text, padding: '2px 7px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700 }}>
                          <span>{statusBadge.icon}</span> {statusBadge.label}
                        </span>
                      </div>

                      {/* Col 5: Rating */}
                      <div style={{ color: '#fbbf24', fontSize: '0.74rem', letterSpacing: '1px' }}>
                        {rating > 0 ? (
                          <span>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)} <strong style={{ fontSize: '0.68rem', color: '#ffffff' }}>({rating}/5)</strong></span>
                        ) : (
                          <span style={{ color: '#64748b' }}>Not rated</span>
                        )}
                      </div>

                      {/* Col 6: Resume */}
                      <div>
                        {c.resumeFileName ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewResumeCandidate(c); }}
                            style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#93c5fd', padding: '3px 7px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            📄 PDF
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>—</span>
                        )}
                      </div>

                      {/* Col 7: Actions */}
                      <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '5px' }}>
                        <button
                          onClick={(e) => handleCopySummary(sub, e)}
                          title="Copy summary"
                          style={{ background: copiedId === sub.id ? 'rgba(5, 150, 105, 0.2)' : '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', color: copiedId === sub.id ? '#34d399' : '#94a3b8', padding: '3px 6px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.7rem' }}
                        >
                          {copiedId === sub.id ? <Check size={11} /> : <Share2 size={11} />}
                        </button>
                        <button
                          style={{ background: isExpanded ? '#2563eb' : '#1e293b', color: isExpanded ? '#ffffff' : '#cbd5e1', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '3px 8px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {isExpanded ? 'Close' : 'Listen'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Drawer */}
                    {isExpanded && (
                      <div style={{ background: '#0f172a', borderTop: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px 18px' }} onClick={(e) => e.stopPropagation()}>
                        
                        <div className="admin-drawer" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
                          
                          {/* Left: Audio Clips */}
                          <div style={{ background: '#111827', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '12px' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>🎙️ Voice Recording {audioClips.length > 1 ? `(1 of ${audioClips.length})` : ''}</span>
                              {audioClips.length > 1 && !showAllAudioFor[sub.id] && (
                                <button
                                  onClick={() => setShowAllAudioFor(prev => ({ ...prev, [sub.id]: true }))}
                                  style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', padding: '3px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  Show All {audioClips.length} Clips ▼
                                </button>
                              )}
                              {showAllAudioFor[sub.id] && audioClips.length > 1 && (
                                <button
                                  onClick={() => setShowAllAudioFor(prev => ({ ...prev, [sub.id]: false }))}
                                  style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', padding: '3px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  Show Less ▲
                                </button>
                              )}
                            </div>

                            {audioClips.length === 0 ? (
                              <div style={{ color: '#64748b', fontSize: '0.74rem', padding: '14px 0', textAlign: 'center' }}>
                                No audio recordings captured.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(showAllAudioFor[sub.id] ? audioClips : audioClips.slice(0, 1)).map((clip, cIdx) => (
                                  <div key={cIdx} style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '8px 10px' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#818cf8', marginBottom: '4px' }}>
                                      Part {cIdx + 1}: {clip.questionTitle || clip.questionId || `Question ${cIdx + 1}`}
                                    </div>
                                    <CandidateAudioPlayer
                                      initialSrc={clip.audioUrl || clip.base64Audio}
                                      submissionId={sub.id || sub._dbId}
                                      questionId={clip.questionId || `q_${cIdx}`}
                                      playbackRate={speed}
                                    />
                                  </div>
                                ))}
                                {!showAllAudioFor[sub.id] && audioClips.length > 1 && (
                                  <div
                                    onClick={() => setShowAllAudioFor(prev => ({ ...prev, [sub.id]: true }))}
                                    style={{ textAlign: 'center', padding: '6px', cursor: 'pointer', color: '#818cf8', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.08)', borderRadius: '6px', border: '1px dashed rgba(99, 102, 241, 0.2)' }}
                                  >
                                    + {audioClips.length - 1} more recording{audioClips.length - 1 > 1 ? 's' : ''} — click to expand
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Right: Decision & Notes */}
                          <div style={{ background: '#111827', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '12px' }}>
                            
                            {/* Decision & Rating */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                              <div>
                                <label style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                                  Hiring Decision:
                                </label>
                                <select
                                  value={fb.hiringDecision || 'pending'}
                                  onChange={(e) => handleUpdateFeedback(sub, { hiringDecision: e.target.value })}
                                  style={{ width: '100%', padding: '5px', borderRadius: '5px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#1e293b', color: '#ffffff', fontSize: '0.76rem', fontWeight: 700 }}
                                >
                                  <option value="pending">⏳ Needs Review</option>
                                  <option value="shortlisted">🌟 Shortlisted</option>
                                  <option value="selected">✅ Selected</option>
                                  <option value="second_round">🔄 2nd Round</option>
                                  <option value="on_hold">⏳ On Hold</option>
                                  <option value="rejected">❌ Rejected</option>
                                </select>
                              </div>

                              <div>
                                <label style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                                  Star Rating:
                                </label>
                                <div style={{ display: 'flex', gap: '2px', marginTop: '3px' }}>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      onClick={() => handleUpdateFeedback(sub, { rating: star })}
                                      style={{ background: 'none', border: 'none', color: (fb.rating || 0) >= star ? '#fbbf24' : '#475569', fontSize: '1.1rem', cursor: 'pointer', padding: '0 1px' }}
                                    >
                                      ★
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Remarks */}
                            <div style={{ marginBottom: '8px' }}>
                              <label style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                                Recruiter Voice & Interview Remarks:
                              </label>
                              <textarea
                                rows={4}
                                placeholder="Type remarks on voice clarity, accent, confidence, or next steps..."
                                value={fb.notes || ''}
                                onChange={(e) => handleUpdateFeedback(sub, { notes: e.target.value })}
                                style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid rgba(255, 255, 255, 0.12)', fontSize: '0.76rem', color: '#ffffff', background: '#1e293b', resize: 'vertical' }}
                              />
                            </div>

                            {/* Footer Status */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                Auto-saves immediately on change
                              </span>

                              <div>
                                {currentSave === 'saved' && (
                                  <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <CheckCircle2 size={11} /> Saved to Cloud
                                  </span>
                                )}
                                {currentSave === 'saving' && (
                                  <span style={{ fontSize: '0.7rem', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <Loader2 size={10} className="animate-spin" /> Saving...
                                  </span>
                                )}
                                {!currentSave && (
                                  <span style={{ fontSize: '0.68rem', color: '#34d399' }}>✓ Synced</span>
                                )}
                              </div>
                            </div>

                          </div>

                        </div>

                      </div>
                    )}

                  </div>
                );
              })}

            </div>
          )}
        </>
      ) : (
        /* Test Keys Tab */
        <div style={{ background: '#111827', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '18px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '12px', color: '#ffffff' }}>Generate Test Invitation Keys</h2>
          
          <form onSubmit={handleCreateKey} style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <input
              type="text"
              style={{ flex: 1, minWidth: '180px', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#ffffff', padding: '6px 10px', borderRadius: '7px', fontSize: '0.8rem' }}
              placeholder="Target Job Role (e.g. Customer Support Executive)..."
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
            />
            <button 
              type="submit" 
              style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '7px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} /> Single Key
            </button>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="number"
                min="1"
                max="50"
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                style={{ width: '46px', padding: '6px', borderRadius: '7px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#0f172a', color: '#ffffff', textAlign: 'center', fontSize: '0.78rem' }}
              />
              <button 
                type="button" 
                onClick={handleBulkCreateKeys} 
                style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#cbd5e1', padding: '6px 10px', borderRadius: '7px', fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}
              >
                Bulk
              </button>
            </div>
          </form>

          {generatedKeys.length > 0 && (
            <div style={{ background: 'rgba(5, 150, 105, 0.15)', border: '1px solid rgba(5, 150, 105, 0.3)', padding: '12px', borderRadius: '7px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 700, marginBottom: '4px' }}>Newly Generated Links:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {generatedKeys.map((k) => (
                  <span key={k} style={{ background: '#111827', padding: '4px 8px', borderRadius: '5px', border: '1px solid #059669', fontSize: '0.74rem', fontFamily: 'monospace', color: '#34d399' }}>
                    https://openhire.in/?key={k}
                  </span>
                ))}
              </div>
            </div>
          )}

          <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '8px', color: '#cbd5e1' }}>Active Test Keys ({Object.keys(activeKeys).length})</h3>
          <div style={{ display: 'grid', gap: '6px' }}>
            {Object.entries(activeKeys).map(([key, role]) => {
              const linkUrl = `https://openhire.in/?key=${key}`;
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '8px 12px', borderRadius: '7px', border: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', fontSize: '0.82rem' }}>{key}</span>
                    <span style={{ fontSize: '0.76rem', color: '#94a3b8', marginLeft: '8px' }}>Role: {typeof role === 'object' ? (role.targetRole || role.title) : role}</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(linkUrl);
                      alert(`Copied: ${linkUrl}`);
                    }}
                    style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#cbd5e1', padding: '3px 7px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.7rem' }}
                  >
                    Copy Link
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* PDF Viewer Modal */}
      {previewResumeCandidate && (
        <ResumeViewerModal
          candidate={previewResumeCandidate}
          onClose={() => setPreviewResumeCandidate(null)}
        />
      )}

    </div>
  );
}
