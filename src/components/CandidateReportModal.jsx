import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Award, AlertTriangle, CheckCircle, Volume2, Sparkles, BookOpen, Clock, 
  Activity, MessageSquare, Repeat, MapPin, Download, FileText, Eye, User, 
  Star, ThumbsUp, ThumbsDown, Check, Copy, Printer, Edit3, Save, Share2, 
  CheckCircle2, HelpCircle, ArrowRight, Loader2, Phone, Mail, Briefcase
} from 'lucide-react';
import { evaluateVoiceSubmission, getIeltsCefrMapping } from '../services/speechAnalyzer';
import { fetchAudioClipFromFirebase } from '../services/firebaseBackup';
import { resolveGDriveUrlAsync, isGDriveRef } from '../services/googleDriveStorage';
import { updateSubmissionInCloud } from '../services/cloudDatabase';
import { sendAssessmentFeedbackEmail } from '../services/assessmentEmailService';
import ResumeViewerModal from './ResumeViewerModal';

function AudioPlayerWithFallback({ initialSrc, submissionId, questionId }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialSrc && isGDriveRef(initialSrc)) {
      setLoading(true);
      resolveGDriveUrlAsync(initialSrc)
        .then((streamingUrl) => {
          if (streamingUrl) {
            setAudioUrl(streamingUrl);
          } else if (submissionId && questionId) {
            return fetchAudioClipFromFirebase(submissionId, questionId).then(b64 => {
              if (b64) setAudioUrl(b64.startsWith('data:') ? b64 : `data:audio/webm;base64,${b64}`);
            });
          }
        })
        .catch(() => {
          if (submissionId && questionId) {
            return fetchAudioClipFromFirebase(submissionId, questionId).then(b64 => {
              if (b64) setAudioUrl(b64.startsWith('data:') ? b64 : `data:audio/webm;base64,${b64}`);
            });
          }
        })
        .finally(() => setLoading(false));
      return;
    }

    const isFirebaseRef = initialSrc && String(initialSrc).startsWith('firebase://');
    const isPlayableUrl = initialSrc && !isFirebaseRef &&
      (String(initialSrc).startsWith('http') || String(initialSrc).startsWith('data:') || String(initialSrc).startsWith('blob:'));

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
        .finally(() => setLoading(false));
    }
  }, [initialSrc, submissionId, questionId]);

  if (loading) {
    return (
      <div style={{ fontSize: '0.75rem', color: '#0284c7', fontStyle: 'italic', marginBottom: '8px' }}>
        ⏳ Loading audio recording...
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div style={{ fontSize: '0.74rem', color: '#b45309', background: '#fef3c7', padding: '4px 10px', borderRadius: '4px', marginBottom: '8px' }}>
        ⚠️ Audio recording file unavailable for this question
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '10px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Volume2 size={13} /> 🎙️ Candidate Spoken Audio:
      </div>
      <audio src={audioUrl} controls style={{ width: '100%', height: '34px' }} />
    </div>
  );
}

const PRESET_FEEDBACK_CHIPS = [
  '✅ Strong pronunciation & clear articulation',
  '✅ High confidence & structured responses',
  '⭐ Recommended for client-facing / voice roles',
  '⚠️ Moderate hesitation & filler words',
  '🔄 Requires grammar & sentence structure grooming',
  '⚠️ Low speaking pace / pauses between sentences',
  '💼 Suitable for back-office / non-voice operations',
  '🚀 Ready for technical / operations round'
];

export default function CandidateReportModal({ submission, onClose, onUpdateFeedback }) {
  const [activeReportTab, setActiveReportTab] = useState('feedback'); // 'feedback' | 'diagnostics' | 'transcripts' | 'pillars'
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);

  // Recruiter Feedback State
  const initialFeedback = submission?.recruiterFeedback || {};
  const [rating, setRating] = useState(initialFeedback.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [decision, setDecision] = useState(initialFeedback.hiringDecision || 'pending');
  const [reviewerName, setReviewerName] = useState(initialFeedback.reviewerName || '');
  const [generalRemarks, setGeneralRemarks] = useState(initialFeedback.notes || '');
  const [strengths, setStrengths] = useState(initialFeedback.strengths || '');
  const [improvements, setImprovements] = useState(initialFeedback.areasForImprovement || '');
  const [nextSteps, setNextSteps] = useState(initialFeedback.nextSteps || '');
  
  // Auto-save Engine State
  const autoSaveTimerRef = useRef(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // 'typing' | 'saving' | 'saved' | 'error'
  const [emailNotificationStatus, setEmailNotificationStatus] = useState(null); // { sending, sent, error, message }

  useEffect(() => {
    if (submission?.recruiterFeedback) {
      const fb = submission.recruiterFeedback;
      setRating(fb.rating || 0);
      setDecision(fb.hiringDecision || 'pending');
      setReviewerName(fb.reviewerName || '');
      setGeneralRemarks(fb.notes || '');
      setStrengths(fb.strengths || '');
      setImprovements(fb.areasForImprovement || '');
      setNextSteps(fb.nextSteps || '');
    }
  }, [submission]);

  if (!submission) return null;

  const candidate = submission.candidate || {};
  let evalData = submission.evaluation || {};

  const handleDownloadResume = () => {
    const url = candidate?.resumeDataUrl || candidate?.resumeUrl;
    const fileName = candidate?.resumeFileName || `${candidate?.fullName ? candidate.fullName.replace(/\s+/g, '_') : 'Candidate'}_Resume.pdf`;
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreviewResume = () => {
    setShowResumeModal(true);
  };

  const rawResponses = submission.rawResponses || evalData.evaluatedQuestions || [];
  if ((!evalData.grammarErrorsList || !evalData.fillerWordsSummary) && rawResponses.length > 0) {
    const computedEval = evaluateVoiceSubmission(rawResponses);
    evalData = {
      ...evalData,
      ...computedEval,
      overallScore: computedEval.overallScore
    };
  }

  const overallScore = evalData.overallScore || 0;
  const ieltsInfo = getIeltsCefrMapping(overallScore);
  const scores = evalData.scores || {};
  const grammarErrors = evalData.grammarErrorsList || [];
  const fillerSummary = evalData.fillerWordsSummary || {};
  const wordRepetitions = evalData.wordRepetitionSummary || [];
  const evaluatedQuestions = evalData.evaluatedQuestions || rawResponses || [];
  const vocabStats = evalData.vocabularyStats || {};
  const fillerEntries = Object.entries(fillerSummary);

  // ⚡ AUTOMATIC AUTO-SAVE FEEDBACK IN MODAL & AUTO-DISPATCH EMAIL
  const triggerModalAutoSave = (feedbackUpdates, isImmediate = false) => {
    if (!submission || !submission.id) return;

    // Apply immediate local state updates
    if (feedbackUpdates.rating !== undefined) setRating(feedbackUpdates.rating);
    if (feedbackUpdates.hiringDecision !== undefined) setDecision(feedbackUpdates.hiringDecision);
    if (feedbackUpdates.reviewerName !== undefined) setReviewerName(feedbackUpdates.reviewerName);
    if (feedbackUpdates.notes !== undefined) setGeneralRemarks(feedbackUpdates.notes);
    if (feedbackUpdates.strengths !== undefined) setStrengths(feedbackUpdates.strengths);
    if (feedbackUpdates.areasForImprovement !== undefined) setImprovements(feedbackUpdates.areasForImprovement);
    if (feedbackUpdates.nextSteps !== undefined) setNextSteps(feedbackUpdates.nextSteps);

    let targetRating = feedbackUpdates.rating !== undefined ? Number(feedbackUpdates.rating) : Number(rating);
    let targetDecision = feedbackUpdates.hiringDecision !== undefined ? feedbackUpdates.hiringDecision : decision;

    // 🌟 STAR CLICK TRIGGER: If user clicked a star, auto-set decision (1,2 -> rejected, 3+ -> selected)
    const isStarClick = feedbackUpdates.rating !== undefined;
    if (isStarClick) {
      if (targetRating <= 2) {
        targetDecision = 'rejected';
        setDecision('rejected');
      } else {
        targetDecision = 'selected';
        setDecision('selected');
      }
    }

    const feedbackPayload = {
      rating: targetRating,
      hiringDecision: targetDecision,
      reviewerName: (feedbackUpdates.reviewerName !== undefined ? feedbackUpdates.reviewerName : reviewerName).trim() || 'HR Reviewer',
      notes: (feedbackUpdates.notes !== undefined ? feedbackUpdates.notes : generalRemarks).trim(),
      strengths: (feedbackUpdates.strengths !== undefined ? feedbackUpdates.strengths : strengths).trim(),
      areasForImprovement: (feedbackUpdates.areasForImprovement !== undefined ? feedbackUpdates.areasForImprovement : improvements).trim(),
      nextSteps: (feedbackUpdates.nextSteps !== undefined ? feedbackUpdates.nextSteps : nextSteps).trim(),
      ...feedbackUpdates,
      hiringDecision: targetDecision,
      updatedAt: new Date().toISOString()
    };

    let tag = submission.recruiterTag || candidate.tag || 'none';
    if (feedbackPayload.hiringDecision === 'shortlisted' || feedbackPayload.hiringDecision === 'selected') {
      tag = overallScore >= 68 ? 'excellent' : 'recommended';
    } else if (feedbackPayload.hiringDecision === 'rejected') {
      tag = 'rejected';
    } else if (feedbackPayload.hiringDecision === 'second_round') {
      tag = 'grooming';
    }

    const updatedSub = {
      ...submission,
      recruiterFeedback: feedbackPayload,
      recruiterTag: tag,
      candidate: {
        ...submission.candidate,
        tag
      }
    };

    if (onUpdateFeedback) {
      onUpdateFeedback(updatedSub);
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // 🚀 AUTO-SEND EMAIL: ONLY TRIGGERS ON STAR RATING SELECTION (and skips if already sent for this exact rating)
    const candEmail = candidate.email || submission.email || (submission.candidate && submission.candidate.email);
    const candName = candidate.fullName || candidate.name || submission.fullName || submission.name || 'Candidate';
    const previousEmailRating = submission.recruiterFeedback?.emailSentForRating;

    if (isStarClick && candEmail) {
      const emailStars = targetRating <= 1 ? 1 : targetRating === 2 ? 2 : 3;
      const statusLabel = emailStars >= 3 ? 'Selected' : 'Rejected';
      
      // If the candidate was already sent an email for this exact star tier, don't spam them again
      if (previousEmailRating === targetRating) {
        setEmailNotificationStatus({
          sending: false,
          sent: true,
          message: `ℹ️ ${targetRating}★ Email already sent previously to ${candEmail}`
        });
        setTimeout(() => setEmailNotificationStatus(null), 4000);
        return;
      }

      setEmailNotificationStatus({
        sending: true,
        message: `Sending ${emailStars}★ (${statusLabel}) email to ${candEmail}...`
      });

      sendAssessmentFeedbackEmail({
        candidateEmail: candEmail,
        candidateName: candName,
        ratingStars: emailStars,
        customFeedback: feedbackPayload.areasForImprovement || feedbackPayload.notes || ''
      }).then(res => {
        if (res.success) {
          // Record that email was sent for this rating tier
          feedbackPayload.emailSentForRating = targetRating;
          feedbackPayload.emailSentAt = new Date().toISOString();

          setEmailNotificationStatus({
            sending: false,
            sent: true,
            message: `✉️ Sent ${emailStars}★ Email to ${candEmail} (${res.evalData?.statusLabel || statusLabel})`
          });
          setTimeout(() => setEmailNotificationStatus(null), 5000);
        } else {
          setEmailNotificationStatus({
            sending: false,
            error: res.error || 'Failed to dispatch email'
          });
          setTimeout(() => setEmailNotificationStatus(null), 5000);
        }
      }).catch(err => {
        setEmailNotificationStatus({
          sending: false,
          error: err.message || 'Error triggering email'
        });
        setTimeout(() => setEmailNotificationStatus(null), 5000);
      });
    }

    const performSave = async () => {
      setAutoSaveStatus('saving');
      try {
        await updateSubmissionInCloud(submission.id, updatedSub);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(null), 3000);
      } catch (e) {
        console.error('Modal auto-save error:', e);
        setAutoSaveStatus('error');
      }
    };

    if (isImmediate) {
      performSave();
    } else {
      setAutoSaveStatus('typing');
      autoSaveTimerRef.current = setTimeout(performSave, 650);
    }
  };

  const handleApplyPresetChip = (chipText) => {
    const newRemarks = generalRemarks ? `${generalRemarks}\n• ${chipText}` : chipText;
    setGeneralRemarks(newRemarks);
    triggerModalAutoSave({ notes: newRemarks }, true);
  };

  const handleCopySummary = () => {
    const summaryText = `📋 CANDIDATE EVALUATION SUMMARY
────────────────────────────────
Candidate: ${candidate.fullName || 'N/A'}
Email: ${candidate.email || 'N/A'} | Phone: ${candidate.phone || 'N/A'}
Location: ${candidate.currentLocation || 'N/A'}

AI CEFR ASSESSMENT
• Overall Score: ${overallScore}/100
• IELTS Band: ${ieltsInfo.ieltsBand} (${ieltsInfo.cefrLevel} - ${ieltsInfo.levelTitle})
• Pronunciation: ${scores.pronunciation || 0}%
• Fluency: ${scores.fluency || 0}%
• Grammar: ${scores.grammar || 0}%
• Vocabulary: ${scores.vocabulary || 0}%
• Speaking Pace: ${scores.wpm || 0} WPM

RECRUITER FEEDBACK & DECISION
• Rating: ${rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) + ` (${rating}/5)` : 'Not rated'}
• Decision: ${decision.toUpperCase().replace('_', ' ')}
• Reviewer: ${reviewerName || 'HR Team'}
${generalRemarks ? `• Remarks: ${generalRemarks}` : ''}
${strengths ? `• Strengths: ${strengths}` : ''}
${improvements ? `• Areas for Improvement: ${improvements}` : ''}
${nextSteps ? `• Next Steps: ${nextSteps}` : ''}
────────────────────────────────
Generated via Nova AI Assessment System`;

    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '920px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        color: '#0f172a'
      }}>
        {/* Modal Header */}
        <div style={{
          background: '#f8fafc',
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {candidate.fullName || 'Candidate Assessment Report'}
              </h2>
              <span style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                background: overallScore >= 68 ? '#ecfdf5' : '#fffbeb',
                color: overallScore >= 68 ? '#047857' : '#b45309',
                border: `1px solid ${overallScore >= 68 ? '#a7f3d0' : '#fde68a'}`,
                padding: '3px 10px',
                borderRadius: '12px'
              }}>
                IELTS {ieltsInfo.ieltsBand} ({ieltsInfo.cefrLevel})
              </span>

              {/* Rating Display */}
              {rating > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#fffbeb', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                  {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '6px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={13} color="#2563eb" /> <strong style={{ color: '#0f172a' }}>{candidate.phone || candidate.phoneNumber || candidate.mobile || submission.phone || 'No phone'}</strong>
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Mail size={13} color="#64748b" /> <strong style={{ color: '#334155' }}>{candidate.email || submission.email || 'No email'}</strong>
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                <MapPin size={12} /> {candidate.currentLocation || candidate.location || candidate.city || submission.location || 'Location not specified'}
              </span>
              {(candidate.experienceLevel || candidate.experience) && (
                <>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                    <Briefcase size={13} color="#d97706" /> {candidate.experienceLevel || candidate.experience}
                  </span>
                </>
              )}
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#64748b' }}>Role: <strong style={{ color: '#334155' }}>{submission.authKey || 'Direct'}</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopySummary}
              style={{
                background: copiedSummary ? '#ecfdf5' : '#ffffff',
                border: `1px solid ${copiedSummary ? '#10b981' : '#cbd5e1'}`,
                color: copiedSummary ? '#047857' : '#0284c7',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              {copiedSummary ? <Check size={14} /> : <Share2 size={14} />}
              {copiedSummary ? 'Copied Summary!' : 'Share Summary'}
            </button>

            {candidate.resumeFileName && (
              <button
                type="button"
                onClick={handlePreviewResume}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <FileText size={14} /> View Resume
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                color: '#64748b',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Executive Score Ribbon */}
        <div style={{ background: '#ffffff', padding: '14px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px', fontWeight: 600 }}>
              🎯 Target Analysis: 1st & 2nd Intro Audios + Topic Speaking Audio
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: overallScore >= 68 ? '#047857' : (overallScore >= 45 ? '#b45309' : '#b91c1c') }}>
              {evalData.recommendation || ieltsInfo.recommendation}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>OVERALL SCORE</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: overallScore >= 68 ? '#059669' : '#d97706' }}>
                {overallScore} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/ 100</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', paddingLeft: '14px' }}>
              <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>SPEAKING PACE</span>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#b45309' }}>
                {scores.wpm || 0} WPM
              </div>
            </div>

            <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', paddingLeft: '14px' }}>
              <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>DECISION</span>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb' }}>
                {decision === 'shortlisted' ? '🌟 Shortlisted' : decision === 'selected' ? '✅ Selected' : decision === 'second_round' ? '🔄 2nd Round' : decision === 'on_hold' ? '⏳ On Hold' : decision === 'rejected' ? '❌ Rejected' : '⚪ Needs Review'}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', overflowX: 'auto' }}>
          <button
            onClick={() => setActiveReportTab('feedback')}
            style={{
              flex: 1,
              minWidth: '170px',
              padding: '12px',
              background: activeReportTab === 'feedback' ? '#ffffff' : 'transparent',
              color: activeReportTab === 'feedback' ? '#2563eb' : '#64748b',
              border: 'none',
              borderBottom: activeReportTab === 'feedback' ? '3px solid #2563eb' : '3px solid transparent',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Edit3 size={15} /> 📝 Recruiter Feedback {generalRemarks || rating ? '✓' : ''}
          </button>

          <button
            onClick={() => setActiveReportTab('diagnostics')}
            style={{
              flex: 1,
              minWidth: '180px',
              padding: '12px',
              background: activeReportTab === 'diagnostics' ? '#ffffff' : 'transparent',
              color: activeReportTab === 'diagnostics' ? '#2563eb' : '#64748b',
              border: 'none',
              borderBottom: activeReportTab === 'diagnostics' ? '3px solid #2563eb' : '3px solid transparent',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <AlertTriangle size={15} /> Grammar & Stutters ({grammarErrors.length + wordRepetitions.length})
          </button>

          <button
            onClick={() => setActiveReportTab('transcripts')}
            style={{
              flex: 1,
              minWidth: '160px',
              padding: '12px',
              background: activeReportTab === 'transcripts' ? '#ffffff' : 'transparent',
              color: activeReportTab === 'transcripts' ? '#2563eb' : '#64748b',
              border: 'none',
              borderBottom: activeReportTab === 'transcripts' ? '3px solid #2563eb' : '3px solid transparent',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <MessageSquare size={15} /> Spoken Audio ({evaluatedQuestions.length})
          </button>

          <button
            onClick={() => setActiveReportTab('pillars')}
            style={{
              flex: 1,
              minWidth: '140px',
              padding: '12px',
              background: activeReportTab === 'pillars' ? '#ffffff' : 'transparent',
              color: activeReportTab === 'pillars' ? '#2563eb' : '#64748b',
              border: 'none',
              borderBottom: activeReportTab === 'pillars' ? '3px solid #2563eb' : '3px solid transparent',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Award size={15} /> Pillar Breakdown
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* TAB 0: RECRUITER FEEDBACK (AUTO-SAVING) */}
          {activeReportTab === 'feedback' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Hiring Decision & Rating Card (Instant auto-save) */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      CANDIDATE HIRING DECISION:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {[
                        { id: 'shortlisted', label: '🌟 Shortlisted', bg: '#ecfdf5', border: '#10b981', color: '#065f46' },
                        { id: 'selected', label: '✅ Selected', bg: '#f0fdf4', border: '#22c55e', color: '#14532d' },
                        { id: 'second_round', label: '🔄 2nd Round', bg: '#eef2ff', border: '#6366f1', color: '#312e81' },
                        { id: 'on_hold', label: '⏳ On Hold', bg: '#fffbeb', border: '#f59e0b', color: '#78350f' },
                        { id: 'rejected', label: '❌ Rejected', bg: '#fef2f2', border: '#ef4444', color: '#7f1d1d' },
                        { id: 'pending', label: '⚪ Needs Review', bg: '#ffffff', border: '#cbd5e1', color: '#475569' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => triggerModalAutoSave({ hiringDecision: item.id }, true)}
                          style={{
                            background: decision === item.id ? item.bg : '#ffffff',
                            border: `1.5px solid ${decision === item.id ? item.border : '#cbd5e1'}`,
                            color: decision === item.id ? item.color : '#64748b',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rating Stars (Instant auto-save) */}
                  <div>
                    <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      RECRUITER RATING:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => triggerModalAutoSave({ rating: star }, true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0 2px',
                            color: (hoverRating || rating) >= star ? '#d97706' : '#cbd5e1',
                            fontSize: '1.4rem'
                          }}
                        >
                          ★
                        </button>
                      ))}
                      <span style={{ fontSize: '0.82rem', color: '#d97706', marginLeft: '6px', fontWeight: 700 }}>
                        {rating ? `${rating}/5 Stars` : 'Rate'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <User size={16} color="#64748b" />
                  <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>Reviewer Name:</span>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => triggerModalAutoSave({ reviewerName: e.target.value }, false)}
                    placeholder="Enter reviewer name / designation..."
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      flex: 1,
                      maxWidth: '280px'
                    }}
                  />
                </div>

                {/* Live Auto-Send Email Notification Status */}
                {emailNotificationStatus && (
                  <div style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: emailNotificationStatus.error ? '#fef2f2' : emailNotificationStatus.sent ? '#f0fdf4' : '#eff6ff',
                    border: `1px solid ${emailNotificationStatus.error ? '#fecaca' : emailNotificationStatus.sent ? '#bbf7d0' : '#bfdbfe'}`,
                    color: emailNotificationStatus.error ? '#991b1b' : emailNotificationStatus.sent ? '#166534' : '#1e40af'
                  }}>
                    {emailNotificationStatus.sending && <Loader2 size={14} className="animate-spin" />}
                    {emailNotificationStatus.sent && <CheckCircle2 size={14} color="#16a34a" />}
                    {emailNotificationStatus.error && <AlertTriangle size={14} color="#dc2626" />}
                    <span>{emailNotificationStatus.message || emailNotificationStatus.error}</span>
                  </div>
                )}
              </div>

              {/* Quick Presets (Instant click auto-save) */}
              <div style={{ background: '#eff6ff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Sparkles size={14} /> Click to Append Common Notes:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PRESET_FEEDBACK_CHIPS.map((chip, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => handleApplyPresetChip(chip)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #bfdbfe',
                        color: '#1e40af',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textareas (Debounced auto-save on typing) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                    📝 Interview Remarks & Qualitative Feedback:
                  </label>
                  <textarea
                    rows={4}
                    value={generalRemarks}
                    onChange={(e) => triggerModalAutoSave({ notes: e.target.value }, false)}
                    placeholder="Enter comprehensive recruiter feedback on candidate articulation, domain fit, pacing, or key interview notes..."
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#0f172a',
                      fontSize: '0.85rem',
                      lineHeight: '1.5'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <ThumbsUp size={13} /> Key Strengths:
                  </label>
                  <textarea
                    rows={3}
                    value={strengths}
                    onChange={(e) => triggerModalAutoSave({ strengths: e.target.value }, false)}
                    placeholder="Candidate strengths observed..."
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #a7f3d0',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#0f172a',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <ThumbsDown size={13} /> Areas for Improvement:
                  </label>
                  <textarea
                    rows={3}
                    value={improvements}
                    onChange={(e) => triggerModalAutoSave({ areasForImprovement: e.target.value }, false)}
                    placeholder="Grooming / growth points..."
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#0f172a',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <ArrowRight size={13} /> Next Steps / Action Items:
                  </label>
                  <input
                    type="text"
                    value={nextSteps}
                    onChange={(e) => triggerModalAutoSave({ nextSteps: e.target.value }, false)}
                    placeholder="e.g. Schedule Manager Interview for Thursday..."
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#0f172a',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>
              </div>

              {/* Auto-save Status Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  {initialFeedback.updatedAt ? `Last saved: ${new Date(initialFeedback.updatedAt).toLocaleTimeString()}` : 'Auto-save active'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {autoSaveStatus === 'typing' && (
                    <span style={{ fontSize: '0.8rem', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Loader2 size={13} className="animate-spin" /> Auto-saving changes...
                    </span>
                  )}
                  {autoSaveStatus === 'saving' && (
                    <span style={{ fontSize: '0.8rem', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Loader2 size={13} className="animate-spin" /> Saving to cloud...
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={15} /> All changes saved to cloud!
                    </span>
                  )}
                  {autoSaveStatus === 'error' && (
                    <span style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 700 }}>
                      ⚠️ Error saving. Will retry automatically.
                    </span>
                  )}
                  {!autoSaveStatus && (
                    <span style={{ fontSize: '0.78rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      ✓ Auto-saved
                    </span>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 1: DIAGNOSTICS */}
          {activeReportTab === 'diagnostics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Repeated Words & Stutters Section */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Repeat size={16} color="#d97706" /> Repeated Words & Stutters ({wordRepetitions.length})
                </h3>

                {wordRepetitions.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {wordRepetitions.map((rep, rIdx) => (
                      <div key={rIdx} style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>[{rep.sectionTitle}]:</span>
                        <strong style={{ color: '#b91c1c' }}>{rep.phrase}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#059669', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> No repeated word stutters detected in primary spontaneous audio.
                  </div>
                )}
              </div>

              {/* Grammar Mistakes Section */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} color="#dc2626" /> Grammar & Agreement Errors ({grammarErrors.length})
                </h3>

                {grammarErrors.length > 0 ? (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {grammarErrors.map((err, gIdx) => (
                      <div key={gIdx} style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '6px', borderLeft: '4px solid #ef4444', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
                            {err.errorType || 'Grammar Error'} ({err.sectionTitle})
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#047857', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                            {err.suggestion}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: '#334155', marginTop: '4px', margin: 0 }}>
                          Spoken phrase: <strong style={{ color: '#b91c1c', textDecoration: 'line-through' }}>"{err.spokenPhrase}"</strong>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#059669', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> Zero grammatical errors detected in primary spontaneous speech clips.
                  </div>
                )}
              </div>

              {/* Filler Words Breakdown */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={16} color="#7c3aed" /> Filler Words & Hesitations ({fillerEntries.length})
                </h3>

                {fillerEntries.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {fillerEntries.map(([word, cnt], fIdx) => (
                      <div key={fIdx} style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', color: '#5b21b6', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>"{word}"</span>
                        <strong style={{ background: '#7c3aed', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
                          {cnt}x
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#059669', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} /> Zero filler words ('um', 'uh', 'like') detected in target audio clips.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: TRANSCRIPTS */}
          {activeReportTab === 'transcripts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {evaluatedQuestions.map((q, idx) => {
                const matchingRaw = (submission.rawResponses || []).find(r => r.questionId === q.questionId) || (submission.rawResponses || [])[idx] || {};
                const audioSrc = q.audioUrl || q.audio || q.audio_url || matchingRaw.audioUrl || matchingRaw.audio || matchingRaw.audio_url || matchingRaw.audioBlob || matchingRaw.base64Audio || '';
                return (
                  <div key={idx} style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                        {q.sectionTitle || `Question ${idx + 1}`}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#b45309', background: '#fffbeb', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                        Pace: {q.wpm || 0} WPM • {q.durationSeconds || 0}s
                      </span>
                    </div>

                    <AudioPlayerWithFallback
                      initialSrc={audioSrc}
                      submissionId={submission.id}
                      questionId={q.questionId || matchingRaw.questionId}
                    />

                    <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>CANDIDATE TRANSCRIPT:</span>
                      <p style={{ fontSize: '0.82rem', color: '#334155', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                        "{q.transcript || '(No speech recorded)'}"
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: PILLARS */}
          {activeReportTab === 'pillars' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>PRONUNCIATION</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>{scores.pronunciation || 0}%</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>FLUENCY</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{scores.fluency || 0}%</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>GRAMMAR</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>{scores.grammar || 0}%</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>VOCABULARY</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>{scores.vocabulary || 0}%</div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* In-App Resume Viewer Lightbox Modal */}
      {showResumeModal && (
        <ResumeViewerModal
          candidate={candidate}
          onClose={() => setShowResumeModal(false)}
        />
      )}
    </div>
  );
}
