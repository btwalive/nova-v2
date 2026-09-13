import React, { useEffect } from 'react';
import { CheckCircle2, ShieldCheck, ArrowLeft, AlertTriangle, RotateCcw, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function TestSubmitted({ candidate, test, evaluation, cloudSaveStatus, onReset }) {
  const candidateEmail = candidate?.email ? candidate.email.toLowerCase().trim() : '';
  const answeredCount = evaluation?.evaluatedQuestions?.length || 0;
  const isZeroAnswered = answeredCount === 0;

  const isSaving = !isZeroAnswered && (cloudSaveStatus == null || cloudSaveStatus?.saving === true);
  const saveFailed = !isZeroAnswered && cloudSaveStatus?.saving === false && cloudSaveStatus?.success === false;
  const saveDone = !isZeroAnswered && cloudSaveStatus?.saving === false && cloudSaveStatus?.success !== false;

  // Lock completion + confetti only after upload finishes successfully
  useEffect(() => {
    if (!saveDone || !candidateEmail) return;

    try {
      localStorage.setItem(`hirewave_completed_submission_${candidateEmail}`, 'true');
      localStorage.removeItem(`hirewave_engine_progress_${candidateEmail.replace(/[^a-z0-9]/g, '_')}`);
    } catch (e) {}

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
    });
  }, [saveDone, candidateEmail]);

  // Warn if candidate tries to close / refresh while upload is in progress
  useEffect(() => {
    if (!isSaving) return undefined;

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Your assessment is still being saved. Please do not close this window.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isSaving]);

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <header className="maki-header">
        <div></div>
      </header>

      <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', padding: '40px 24px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="maki-card" style={{ width: '100%', padding: '40px 32px', textAlign: 'center' }}>

          {isZeroAnswered ? (
            <>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#fef2f2', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AlertTriangle size={42} color="#ef4444" />
              </div>

              <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#991b1b', marginBottom: '8px' }}>
                No Voice Recordings Detected
              </h1>

              <p style={{ fontSize: '1rem', color: '#475569', marginBottom: '24px', lineHeight: '1.6' }}>
                We received your assessment submission, but <strong style={{ color: '#ef4444' }}>0 spoken responses were recorded</strong>. This usually happens if microphone access was blocked or if the timer expired before recording answers.
              </p>

              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '16px 20px', textAlign: 'left', marginBottom: '28px', color: '#9f1239', fontSize: '0.88rem' }}>
                <strong>Troubleshooting Steps:</strong>
                <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                  <li>Ensure your microphone is plugged in, enabled, and unmuted.</li>
                  <li>Allow microphone permissions when prompted by your browser.</li>
                  <li>Click <strong>"Re-record Assessment"</strong> below to take the test again.</li>
                </ul>
              </div>

              <button onClick={onReset} className="btn-maki-primary" style={{ padding: '12px 28px', backgroundColor: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={18} /> Re-record Assessment
              </button>
            </>
          ) : isSaving ? (
            <>
              <div className="submit-wait-orb" style={{ width: '88px', height: '88px', borderRadius: '50%', margin: '0 auto 22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={40} color="#ffffff" className="analyzing-spin" />
              </div>

              <h1 style={{ fontSize: '1.75rem', fontWeight: 750, color: '#0f172a', marginBottom: '10px' }}>
                Please do not close this window
              </h1>

              <p style={{ fontSize: '1.02rem', color: '#475569', marginBottom: '22px', lineHeight: '1.65', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
                We are securely saving your assessment. This may take a moment — please keep this page open until it finishes.
              </p>

              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '14px', padding: '18px 20px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#047857', fontWeight: 700, fontSize: '0.95rem', marginBottom: '12px' }}>
                  <span className="submit-wait-pulse-dot" />
                  Finalizing your submission
                </div>
                <div className="submit-wait-bars" aria-hidden="true">
                  <span /><span /><span /><span /><span />
                </div>
                <p style={{ margin: '14px 0 0 0', fontSize: '0.82rem', color: '#065f46', lineHeight: 1.5 }}>
                  Closing or refreshing now may interrupt your results.
                </p>
              </div>
            </>
          ) : (
            <>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#ecfdf5', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle2 size={42} color="#10b981" />
              </div>

              <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                Assessment Completed Successfully
              </h1>

              <p style={{ fontSize: '1.05rem', color: '#475569', marginBottom: '28px', lineHeight: '1.6' }}>
                Thank you, <strong style={{ color: '#0f172a' }}>{candidate?.fullName || 'Candidate'}</strong>. Your voice assessment responses have been received and logged securely.
              </p>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: '0.92rem', color: '#1e3a8a', lineHeight: 1.55, fontWeight: 600 }}>
                  Please update your recruiter about completing this test so they can check your score.
                </p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 24px', textAlign: 'left', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#4f46e5', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                  <ShieldCheck size={18} /> Assessment Confirmation
                </div>
                <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                  Your spoken English evaluation report has been forwarded to the recruiting team for review. Please check with your recruiter for your assessment results.
                </p>

                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: '#64748b' }}>
                  <div>
                    Registered Email:{' '}
                    <strong style={{ color: '#0f172a', wordBreak: 'break-all' }}>{candidate?.email || 'N/A'}</strong>
                  </div>
                  <div>
                    Status:{' '}
                    <strong style={{ color: saveFailed ? '#b91c1c' : '#10b981' }}>
                      {saveFailed ? 'Saved on this device — will sync shortly' : 'Success'}
                    </strong>
                  </div>
                </div>
              </div>

              <button onClick={onReset} className="btn-maki-secondary" style={{ padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <ArrowLeft size={16} /> Return to Home
              </button>
            </>
          )}

        </div>
      </div>

      <footer className="maki-footer">
        <div>NOVA Spoken Assessment © 2026</div>
      </footer>
    </div>
  );
}
