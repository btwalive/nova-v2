import React, { useState } from 'react';
import { X, ShieldCheck, FileText, Lock, Mic, Volume2, CheckCircle2 } from 'lucide-react';

export default function TermsPrivacyModal({ isOpen, onClose, initialTab = 'terms' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '760px',
        maxHeight: '88vh',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                OpenHire • Terms & Privacy Notice
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                Nova AI Voice & Spoken Assessment Platform
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.2s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px',
          background: '#ffffff'
        }}>
          <button
            onClick={() => setActiveTab('terms')}
            style={{
              padding: '12px 20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: activeTab === 'terms' ? '#4f46e5' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'terms' ? '2px solid #4f46e5' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FileText size={16} /> Terms of Service
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            style={{
              padding: '12px 20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: activeTab === 'privacy' ? '#4f46e5' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'privacy' ? '2px solid #4f46e5' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Lock size={16} /> Privacy Policy
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
          fontSize: '0.9rem',
          lineHeight: 1.6,
          color: '#334155'
        }}>
          {activeTab === 'terms' ? (
            <div>
              <div style={{ marginBottom: '20px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '14px 18px', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 4px 0', color: '#1e40af', fontWeight: 800, fontSize: '0.95rem' }}>
                  Summary for Candidates
                </h4>
                <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.84rem' }}>
                  This assessment evaluates your spoken English communication skills using your computer or mobile microphone and speakers/headphones. No video or screen content is recorded.
                </p>
              </div>

              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                1. Acceptance of Terms
              </h4>
              <p>
                By accessing or taking this assessment on OpenHire (accessible via <code>assessment.openhire.in</code> or <code>openhire.in</code>), you agree to be bound by these Terms of Service. If you do not agree with these terms, you should not proceed with the assessment.
              </p>


              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                2. Scope of Assessment & Hardware Permissions
              </h4>
              <p>
                This assessment is strictly designed to evaluate spoken English fluency, pronunciation, grammar, listening comprehension, and speech clarity.
              </p>
              <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Microphone Access:</strong> You grant permission to access your microphone to record your spoken responses to prompt questions.
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Speaker Output:</strong> You grant permission to play prompt audio passages to test listening comprehension and repetition accuracy.
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <strong>No Video/Camera Recording:</strong> The system does NOT record or access your webcam, video feed, or desktop screen.
                </li>
              </ul>

              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                3. Candidate Integrity & Conduct
              </h4>
              <p>
                You represent and warrant that:
              </p>
              <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li style={{ marginBottom: '6px' }}>All spoken responses provided during the assessment are your own authentic voice.</li>
                <li style={{ marginBottom: '6px' }}>You will not use artificial voice generators, text-to-speech tools, or third-party proxies during the test.</li>
                <li style={{ marginBottom: '6px' }}>You will complete the assessment independently in a quiet environment.</li>
              </ul>

              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                4. Intellectual Property
              </h4>
              <p>
                All assessment content, audio passages, questions, AI scoring models, and interface branding are the proprietary intellectual property of OpenHire and its platform operators. You agree not to copy, record, distribute, or publicly reproduce any assessment questions or prompt audio.
              </p>

              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                5. System Disclaimer
              </h4>
              <p>
                The platform is provided on an "as is" and "as available" basis. While we strive to maintain uninterrupted service, OpenHire is not liable for candidate-side network drops, device battery failure, or local hardware microphone malfunctions.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '20px', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '14px 18px', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 4px 0', color: '#065f46', fontWeight: 800, fontSize: '0.95rem' }}>
                  Privacy & Data Protection Commitment
                </h4>
                <p style={{ margin: 0, color: '#047857', fontSize: '0.84rem' }}>
                  Your privacy is protected. Audio recordings and generated scores are processed securely and shared only with the employer or recruitment team conducting your hiring process.
                </p>
              </div>

              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                1. Data Controller & Processor Roles
              </h4>
              <p>
                The employer or recruiter requesting your assessment acts as the <strong>Data Controller</strong>. OpenHire acts as the <strong>Data Processor</strong> providing voice processing, speech-to-text evaluation, and candidate reporting.
              </p>

              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                2. Information We Collect
              </h4>
              <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Candidate Identifiers:</strong> Name, Email Address, Phone Number, and Experience Level provided during registration.
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Spoken Audio Data:</strong> Audio clips of your answers recorded through your microphone for AI speech evaluation.
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Speech Transcripts & Speech Features:</strong> Automated text transcriptions, pronunciation accuracy scores, pitch, pacing, and fluency metrics.
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Technical Telemetry:</strong> Browser environment, audio permission status, and completion timestamp.
                </li>
              </ul>

              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                3. Purpose of Processing
              </h4>
              <p>
                Your data is processed strictly for:
              </p>
              <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                <li style={{ marginBottom: '6px' }}>Evaluating spoken English skills and job role suitability for the recruiting organization.</li>
                <li style={{ marginBottom: '6px' }}>Generating automated candidate assessment scorecards for recruiter review.</li>
                <li style={{ marginBottom: '6px' }}>Preventing candidate duplicate attempts or unauthorized re-registrations.</li>
              </ul>

              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                4. Data Sharing & Confidentiality
              </h4>
              <p>
                We do NOT sell, rent, or trade your personal data or voice recordings to third parties or marketing agencies. Your assessment data is accessible solely to authorized recruiters and administrators of the hiring organization.
              </p>

              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                5. Security & Data Safeguards
              </h4>
              <p>
                All data transmission between your browser and our servers is encrypted using HTTPS/TLS 1.2+. Audio files and transcripts are stored securely in cloud databases with restricted role-based access.
              </p>

              <h4 style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', marginTop: '16px', marginBottom: '8px' }}>
                6. Your Privacy Rights
              </h4>
              <p>
                You have the right to request access to your assessment record, request correction of your contact details, or request data deletion by contacting the recruiting organization or reaching out to <code>support@openhire.in</code>.
              </p>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f1f5f9',
          background: '#f8fafc',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Effective Date: March 2026 • OpenHire Assessment Platform
          </span>
          <button
            onClick={onClose}
            style={{
              background: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '9px 20px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </div>
  );
}
