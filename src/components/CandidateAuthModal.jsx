import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Key, User, Mail, Phone, ArrowRight, ShieldCheck, ChevronLeft, ChevronRight, Wifi, Mic, Volume2, CornerDownLeft, Sparkles, CheckCircle2, AlertCircle, Briefcase, GraduationCap, Clock, FileText, MapPin, UploadCloud, Trash2, Check, Paperclip, FileCheck, File } from 'lucide-react';

import { INITIAL_TESTS } from '../services/testData';
import { checkEmailSubmittedInCloud } from '../services/cloudDatabase';
import NovaIntroTypewriter from './NovaIntroTypewriter';
import novaIntroWav from '../Nova intro effect.wav';
import novaAvatarImg from '../Nova_newavtar.jpeg';
import { playInstantClickSfx as playClickSfx, preloadAllPromptAudio } from '../utils/sfx';

import TermsPrivacyModal from './TermsPrivacyModal';

const REG_STEPS = ['name', 'email', 'phone', 'location', 'resume'];

export default function CandidateAuthModal({ initialKey = "8d5ri83f9c", activeKeys = {}, onAuthenticate }) {
  const [authKey, setAuthKey] = useState(initialKey);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [regStep, setRegStep] = useState('name'); // 'name' | 'email' | 'phone' | 'location' | 'resume'
  const [alreadyCompletedMessage, setAlreadyCompletedMessage] = useState(false);

  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [modalTab, setModalTab] = useState('terms');

  const [candidateInfo, setCandidateInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    currentLocation: '',
    resumeFileName: '',
    resumeFileSize: '',
    resumeFileType: '',
    resumeDataUrl: '',
    experienceLevel: 'fresher', // 'fresher' | 'experienced'
    candidateId: 'EMP-' + Math.floor(100000 + Math.random() * 900000)
  });

  const [error, setError] = useState('');
  const [introTypingDone, setIntroTypingDone] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef(null);

  const handleIntroTypingComplete = useCallback(() => {
    setIntroTypingDone(true);
  }, []);

  // Play greeting tone exactly ONCE on initial load/interaction
  const hasPlayedIntroSfx = useRef(false);

  useEffect(() => {
    if (!alreadyCompletedMessage && !showRegistrationForm && !hasPlayedIntroSfx.current) {
      let handleFirstInteraction = null;

      const cleanupListeners = () => {
        if (handleFirstInteraction) {
          window.removeEventListener('pointerdown', handleFirstInteraction);
          window.removeEventListener('mousemove', handleFirstInteraction);
        }
      };

      handleFirstInteraction = () => {
        if (hasPlayedIntroSfx.current) {
          cleanupListeners();
          return;
        }
        try {
          const audio = new Audio(novaIntroWav);
          audio.volume = 0.5;
          audio.play()
            .then(() => {
              hasPlayedIntroSfx.current = true;
              cleanupListeners();
            })
            .catch(() => {});
        } catch (e) {}
      };

      handleFirstInteraction();

      window.addEventListener('pointerdown', handleFirstInteraction, { once: true, passive: true });
      window.addEventListener('mousemove', handleFirstInteraction, { once: true, passive: true });

      return () => {
        cleanupListeners();
      };
    }
  }, [alreadyCompletedMessage, showRegistrationForm]);

  const handleProceedClick = () => {
    setShowRegistrationForm(true);
    setRegStep('name');
  };

  const handleResumeFileSelect = (file) => {
    if (!file) return;
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const fileName = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some(ext => fileName.endsWith(ext));
    if (!isAllowed) {
      setError('Please upload a valid resume file (.pdf, .doc, .docx, .txt).');
      return;
    }
    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('Resume file size exceeds 10MB limit. Please upload a smaller file.');
      return;
    }

    setError('');
    setIsReadingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
        : `${Math.round(file.size / 1024)} KB`;
      
      setCandidateInfo(prev => ({
        ...prev,
        resumeFileName: file.name,
        resumeFileSize: sizeStr,
        resumeFileType: file.type || 'application/octet-stream',
        resumeDataUrl: dataUrl,
        resumeUrl: dataUrl
      }));
      setIsReadingFile(false);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try selecting again.');
      setIsReadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleResumeFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveResume = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setCandidateInfo(prev => ({
      ...prev,
      resumeFileName: '',
      resumeFileSize: '',
      resumeFileType: '',
      resumeDataUrl: '',
      resumeUrl: ''
    }));
  };

  const finishCandidateSetup = (info = candidateInfo) => {
    playClickSfx();
    const cleanPhone = info.phone.trim();
    const cleanName = info.fullName.trim();
    const cleanEmail = info.email.trim().toLowerCase();
    const cleanLocation = info.currentLocation ? info.currentLocation.trim() : '';

    const finalInfo = {
      ...info,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      currentLocation: cleanLocation,
      resumeFileName: info.resumeFileName || '',
      resumeFileSize: info.resumeFileSize || '',
      resumeFileType: info.resumeFileType || '',
      resumeDataUrl: info.resumeDataUrl || '',
      resumeUrl: info.resumeDataUrl || '',
      experienceLevel: 'fresher'
    };

    const resolvedTest = activeKeys[authKey] || INITIAL_TESTS[authKey] || INITIAL_TESTS['8d5ri83f9c'];
    onAuthenticate({ candidate: finalInfo, test: resolvedTest, authKey });
  };

  const handleNextStep = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (regStep === 'name') {
      if (!candidateInfo.fullName.trim()) {
        setError('Please enter your full name to proceed.');
        return;
      }
      playClickSfx();
      setRegStep('email');
    } else if (regStep === 'email') {
      const cleanEmail = candidateInfo.email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        setError('Please enter a valid email address.');
        return;
      }

      playClickSfx();
      setIsCheckingEmail(true);

      // 1. Instant local check (0ms)
      try {
        if (localStorage.getItem(`hirewave_completed_submission_${cleanEmail}`) === 'true') {
          setAlreadyCompletedMessage(true);
          setIsCheckingEmail(false);
          return;
        }
      } catch (err) {}

      // 2. Cloud duplicate check (with 1.8s timeout built-in)
      try {
        const alreadyExists = await checkEmailSubmittedInCloud(cleanEmail);
        if (alreadyExists) {
          setAlreadyCompletedMessage(true);
          setIsCheckingEmail(false);
          return;
        }
      } catch (err) {
        console.warn('Cloud duplicate check error, proceeding:', err);
      }

      setIsCheckingEmail(false);
      setRegStep('phone');

    } else if (regStep === 'phone') {
      if (!candidateInfo.phone.trim() || candidateInfo.phone.length < 7) {
        setError('Please enter a valid phone number.');
        return;
      }
      playClickSfx();
      setRegStep('location');

    } else if (regStep === 'location') {
      if (!candidateInfo.currentLocation.trim()) {
        setError('Please enter your current location (e.g. Mumbai, Maharashtra or London, UK).');
        return;
      }
      playClickSfx();
      setRegStep('resume');

    } else if (regStep === 'resume') {
      finishCandidateSetup();
    }
  };

  const getStepNumber = () => {
    const idx = REG_STEPS.indexOf(regStep);
    return idx >= 0 ? idx + 1 : 1;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}>
      
      {/* Main Container */}
      <div className="maki-onboarding-shell" style={{ maxWidth: '960px', width: '100%', margin: '0 auto', padding: '40px 24px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%' }}>
          
          {alreadyCompletedMessage ? (
            /* Blocked Completion Screen */
            <div className="maki-card" style={{ padding: '40px 28px', textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#fef3c7', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle2 size={40} color="#d97706" />
              </div>

              <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                Test Already Submitted
              </h2>

              <p style={{ fontSize: '1.05rem', color: '#475569', maxWidth: '520px', margin: '0 auto 16px', lineHeight: '1.6' }}>
                Your Nova assessment for <strong style={{ color: '#0f172a' }}>{candidateInfo.email}</strong> has already been submitted successfully.
              </p>

              <p style={{ fontSize: '0.95rem', color: '#475569', maxWidth: '520px', margin: '0 auto 24px', lineHeight: '1.6' }}>
                If you need to retest, please ask your recruiter for a <strong>Unique Test Key</strong> for your second attempt.
              </p>

              <button onClick={() => { setAlreadyCompletedMessage(false); setRegStep('email'); }} className="btn-maki-secondary">
                Use a different email address
              </button>
            </div>
          ) : showRegistrationForm ? (

            /* CONVERSATIONAL CHAT REGISTRATION STEP-BY-STEP */
            <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Step Progress Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '12px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase' }}>Candidate Setup</span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>• Step {getStepNumber()} of {REG_STEPS.length}</span>
                </div>
                
                {/* Step Dots */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {REG_STEPS.map((s, idx) => (
                    <div
                      key={s}
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: (getStepNumber() - 1) >= idx ? '#4f46e5' : '#cbd5e1',
                        transition: 'all 0.3s ease'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* NOVA CHAT TURN (Left Aligned Message Bubble) */}
              <div key={`nova_reg_${regStep}`} className="chat-bubble-animated" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                
                {/* Nova Avatar */}
                <div style={{ flexShrink: 0, marginTop: '4px' }}>
                  <div className="nova-avatar-alive" style={{ width: '52px', height: '52px', borderRadius: '50%', border: '2.5px solid #4f46e5', overflow: 'hidden', backgroundColor: '#ffffff', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)' }}>
                    <img src={novaAvatarImg} alt="Nova" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }} />
                  </div>
                </div>

                {/* Nova Question Bubble */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4f46e5', marginBottom: '6px', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#4f46e5" /> Nova • AI Skill Assessor
                  </div>

                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0px 22px 22px 22px',
                    padding: '24px 28px',
                    boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.06)'
                  }}>
                    {regStep === 'name' && (
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                          Hi there! Welcome to Nova.
                        </h3>
                        <p style={{ fontSize: '0.98rem', color: '#334155', lineHeight: '1.6' }}>
                          I'm your AI Skills Assessor today. To get started, what is your <strong>Full Name</strong>?
                        </p>
                      </div>
                    )}

                    {regStep === 'email' && (
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                          Thanks, {candidateInfo.fullName.split(' ')[0]}!
                        </h3>
                        <p style={{ fontSize: '0.98rem', color: '#334155', lineHeight: '1.6' }}>
                          What is your <strong>Email Address</strong>?
                        </p>
                      </div>
                    )}

                    {regStep === 'phone' && (
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                          Great! What is your phone number?
                        </h3>
                        <p style={{ fontSize: '0.98rem', color: '#334155', lineHeight: '1.6' }}>
                          Please enter your <strong>Phone Number</strong> so recruiters can contact you.
                        </p>
                      </div>
                    )}

                    {regStep === 'location' && (
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MapPin size={20} color="#4f46e5" /> Where are you currently based?
                        </h3>
                        <p style={{ fontSize: '0.98rem', color: '#334155', lineHeight: '1.6' }}>
                          Please enter your <strong>Current Location (City / State / Country)</strong>.
                        </p>
                      </div>
                    )}

                    {regStep === 'resume' && (
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={20} color="#4f46e5" /> Upload Your Resume / CV
                        </h3>
                        <p style={{ fontSize: '0.98rem', color: '#334155', lineHeight: '1.6' }}>
                          Please upload your latest <strong>Resume or CV</strong> (.pdf, .doc, .docx, .txt) so our recruitment team can review your experience.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CANDIDATE INPUT BUBBLE (Right Aligned Interactive Form Turn) */}
              <div key={`candidate_reg_${regStep}`} className="chat-bubble-animated" style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', width: '100%' }}>
                <div style={{ maxWidth: '640px', width: '100%' }}>
                  
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6', marginBottom: '6px', textAlign: 'right', marginRight: '4px' }}>
                    Your Answer
                  </div>

                  <div style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '22px 0px 22px 22px',
                    padding: '24px 28px',
                    boxShadow: '0 10px 25px rgba(37, 99, 235, 0.07)'
                  }}>
                    {error && (
                      <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, marginBottom: '14px', background: '#fef2f2', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={16} /> {error}
                      </div>
                    )}

                    <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      
                      {regStep === 'name' && (
                        <div>
                          <input
                            type="text"
                            className="maki-input"
                            value={candidateInfo.fullName}
                            onChange={(e) => setCandidateInfo({ ...candidateInfo, fullName: e.target.value })}
                            placeholder="Type your full name (e.g. Sarah Jenkins)..."
                            autoFocus
                            required
                          />
                        </div>
                      )}

                      {regStep === 'email' && (
                        <div>
                          <input
                            type="email"
                            className="maki-input"
                            value={candidateInfo.email}
                            onChange={(e) => setCandidateInfo({ ...candidateInfo, email: e.target.value })}
                            placeholder="Type your email address (e.g. sarah@example.com)..."
                            autoFocus
                            required
                          />
                        </div>
                      )}

                      {regStep === 'phone' && (
                        <div>
                          <input
                            type="tel"
                            className="maki-input"
                            value={candidateInfo.phone}
                            onChange={(e) => setCandidateInfo({ ...candidateInfo, phone: e.target.value })}
                            placeholder="Type your phone number (e.g. +91 98765 43210)..."
                            autoFocus
                            required
                          />
                        </div>
                      )}

                      {regStep === 'location' && (
                        <div>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              className="maki-input"
                              style={{ paddingLeft: '40px' }}
                              value={candidateInfo.currentLocation}
                              onChange={(e) => setCandidateInfo({ ...candidateInfo, currentLocation: e.target.value })}
                              placeholder="Type your current location (e.g. Mumbai, Maharashtra or London, UK)..."
                              autoFocus
                              required
                            />
                            <MapPin size={18} color="#6366f1" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                          </div>
                        </div>
                      )}

                      {regStep === 'resume' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept=".pdf,.doc,.docx,.txt"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleResumeFileSelect(e.target.files[0]);
                              }
                            }}
                          />

                          {candidateInfo.resumeFileName ? (
                            /* Uploaded Resume Card - Fully Responsive */
                            <div style={{
                              background: '#ffffff',
                              border: '2px solid #10b981',
                              borderRadius: '12px',
                              padding: '14px 16px',
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.12)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                <div style={{
                                  width: '42px',
                                  height: '42px',
                                  borderRadius: '8px',
                                  background: '#ecfdf5',
                                  border: '1.5px solid #a7f3d0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <FileCheck size={22} color="#10b981" />
                                </div>
                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {candidateInfo.resumeFileName}
                                  </div>
                                  <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                    <span>{candidateInfo.resumeFileSize}</span>
                                    <span>•</span>
                                    <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <Check size={12} /> Ready
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  style={{
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    color: '#475569',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Change
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRemoveResume}
                                  title="Remove attached file"
                                  style={{
                                    background: '#fef2f2',
                                    border: '1px solid #fecdd3',
                                    color: '#ef4444',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Dropzone UI - Fully Responsive */
                            <div
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              style={{
                                border: isDraggingFile ? '2px dashed #4f46e5' : '2px dashed #cbd5e1',
                                background: isDraggingFile ? '#eef2ff' : '#ffffff',
                                borderRadius: '14px',
                                padding: '24px 16px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                              }}
                            >
                              <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: '#e0e7ff',
                                color: '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 10px'
                              }}>
                                <UploadCloud size={24} />
                              </div>

                              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                                {isReadingFile ? 'Reading file...' : 'Tap to Upload or Drag Resume'}
                              </div>

                              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                                PDF, DOC, DOCX, or TXT (Max 10 MB)
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                        {/* Full Width Primary Submit Button */}
                        <button
                          type="submit"
                          disabled={isCheckingEmail || isReadingFile}
                          className="btn-maki-primary"
                          style={{
                            width: '100%',
                            padding: '13px 20px',
                            fontSize: '0.94rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            borderRadius: '10px'
                          }}
                        >
                          {isCheckingEmail
                            ? 'Checking...'
                            : isReadingFile
                            ? 'Reading file...'
                            : regStep === 'resume'
                            ? (candidateInfo.resumeFileName ? 'Start Assessment with Resume' : 'Start Assessment')
                            : 'Continue'} <ChevronRight size={18} />
                        </button>

                        {/* Secondary Row for Back and Skip */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          {regStep !== 'name' ? (
                            <button
                              type="button"
                              onClick={() => {
                                playClickSfx();
                                if (regStep === 'resume') setRegStep('location');
                                else if (regStep === 'location') setRegStep('phone');
                                else if (regStep === 'phone') setRegStep('email');
                                else if (regStep === 'email') setRegStep('name');
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 2px'
                              }}
                            >
                              <ChevronLeft size={16} /> Back
                            </button>
                          ) : <div />}

                          {regStep === 'resume' && !candidateInfo.resumeFileName && (
                            <button
                              type="button"
                              onClick={() => finishCandidateSetup()}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#475569',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Skip for now
                            </button>
                          )}
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* HERO WELCOME SCREEN WITH TYPEWRITER */
            <div className="maki-card maki-onboarding-card" style={{ padding: '44px 36px' }}>
              <div className="mobile-grid-stack" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '48px', alignItems: 'center' }}>
                
                {/* Left Column: Nova Robot Avatar Image */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: '140px', height: '140px' }}>
                    <div className="nova-avatar-frame" style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      border: '4px solid #7c3aed',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff'
                    }}>
                      <img
                        src={novaAvatarImg}
                        alt="Nova AI Assessor"
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', transform: 'scale(1.15)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Nova Conversational Intro */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ marginBottom: '16px' }}>
                    <div
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '5px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.3px' }}
                    >
                      <ShieldCheck size={14} color="#2563eb" /> SPOKEN ENGLISH ASSESSMENT
                    </div>
                  </div>

                  <NovaIntroTypewriter
                    onComplete={handleIntroTypingComplete}
                  />

                  <p
                    className={`nova-after-typewriter nova-stagger-2${introTypingDone ? ' is-visible' : ''}`}
                    style={{ fontSize: '0.94rem', color: '#475569', marginBottom: '16px', lineHeight: '1.5' }}
                  >
                    This evaluation tests spoken English communication, pronunciation clarity, and professional fluency.
                  </p>

                  <div className={`nova-after-typewriter nova-stagger-2${introTypingDone ? ' is-visible' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 18px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#1e293b', fontWeight: 600 }}>
                      <Clock size={16} color="#2563eb" /> Duration: 15 Minutes
                    </div>
                    <div style={{ width: '1px', height: '18px', backgroundColor: '#cbd5e1' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#1e293b', fontWeight: 600 }}>
                      <FileText size={16} color="#2563eb" /> 5 Evaluation Parts
                    </div>
                  </div>

                  <div className={`nova-after-typewriter nova-stagger-3${introTypingDone ? ' is-visible' : ''}`} style={{ marginTop: '20px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playClickSfx();
                        handleProceedClick();
                      }}
                      className="btn-maki-primary"
                      style={{ padding: '14px 32px', fontSize: '1rem', cursor: 'pointer', position: 'relative', zIndex: 10 }}
                    >
                      Begin Setup <ArrowRight size={18} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <footer className="maki-footer" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', padding: '16px' }}>
        <div>NOVA Spoken Assessment © 2026</div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', color: '#64748b' }}>
          <a
            href="/terms-of-service"
            onClick={(e) => {
              e.preventDefault();
              if (window.location.pathname !== '/terms-of-service') {
                window.history.pushState({}, '', '/terms-of-service');
                window.dispatchEvent(new Event('popstate'));
              }
            }}
            style={{ color: '#4f46e5', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.78rem' }}
          >
            Terms of Service
          </a>
          <span>•</span>
          <a
            href="/privacy-notice"
            onClick={(e) => {
              e.preventDefault();
              if (window.location.pathname !== '/privacy-notice') {
                window.history.pushState({}, '', '/privacy-notice');
                window.dispatchEvent(new Event('popstate'));
              }
            }}
            style={{ color: '#4f46e5', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.78rem' }}
          >
            Privacy Notice
          </a>
        </div>
      </footer>
    </div>
  );
}

