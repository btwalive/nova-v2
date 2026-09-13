import React, { useState, useEffect, useRef } from 'react';
import CandidateAuthModal from './components/CandidateAuthModal';
import SystemCheck from './components/SystemCheck';
import VoiceTestEngine from './components/VoiceTestEngine';
import TestSubmitted from './components/TestSubmitted';
import RecruiterDashboard from './components/RecruiterDashboard';
import AdminLoginModal from './components/AdminLoginModal';
import PrivacyNoticePage from './components/PrivacyNoticePage';
import TermsOfServicePage from './components/TermsOfServicePage';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { INITIAL_TESTS } from './services/testData';
import { evaluateVoiceSubmission } from './services/speechAnalyzer';
import { fetchSubmissionsFromCloud, saveSubmissionToCloud, retryPendingSubmissions, readLocalCache, loadAllCachedSubmissionsAsync, getCacheSyncMeta, retryPendingAudioUploads } from './services/cloudDatabase';
import { notificationService } from './services/notificationService';
import { Shield, ArrowRight, Unplug } from 'lucide-react';


const playClickSfx = () => {
  const submitSfx = new Audio('/mixkit-interface-device-click-2577 (1).wav');
  submitSfx.currentTime = 0;
  submitSfx.play().catch(error => console.warn("Audio playback was blocked or failed:", error));
};


export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  const navigate = (path) => {
    if (path === '/admin') {
      setIsAdminLoginOpen(true);
      return;
    }
    setCurrentPath(path);
  };

  const [viewMode, setViewMode] = useState('candidate'); // 'candidate' | 'recruiter'
  const [testStep, setTestStep] = useState('auth'); // 'auth' | 'system_check' | 'testing' | 'submitted'
  const [urlKey, setUrlKey] = useState('8d5ri83f9c');

  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const [activeKeys, setActiveKeys] = useState(() => {
    try {
      const saved = localStorage.getItem('hirewave_active_test_keys');
      if (saved) {
        return { ...INITIAL_TESTS, ...JSON.parse(saved) };
      }
    } catch (e) { }
    return INITIAL_TESTS;
  });
  const [candidateData, setCandidateData] = useState(null);
  const [activeTest, setActiveTest] = useState(INITIAL_TESTS['8d5ri83f9c']);
  const [mediaStream, setMediaStream] = useState(null);
  const [submissions, setSubmissions] = useState(() => readLocalCache());
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [currentEvaluation, setCurrentEvaluation] = useState(null);
  const [cloudSaveStatus, setCloudSaveStatus] = useState(null); // { success, error }
  const [newCandidateToast, setNewCandidateToast] = useState(null);

  // Track known submission IDs to alert recruiter only on truly new candidate arrivals
  const knownSubmissionIdsRef = useRef(new Set((readLocalCache() || []).map(s => String(s.id || s._dbId)).filter(Boolean)));
  const initialLoadDoneRef = useRef(false);

  // Load complete candidate list from IndexedDB on startup (instant 600+ candidates)
  useEffect(() => {
    loadAllCachedSubmissionsAsync().then((cached) => {
      if (Array.isArray(cached) && cached.length > 0) {
        setSubmissions(cached);
        cached.forEach((s) => {
          const id = String(s.id || s._dbId || '');
          if (id) knownSubmissionIdsRef.current.add(id);
        });
      }
    }).catch(() => {});

    getCacheSyncMeta().then((meta) => {
      if (meta?.timestamp) setLastSyncTime(meta.timestamp);
    }).catch(() => {});
  }, []);

  // Check URL query parameters (e.g. ?key=8d5ri83f9c, ?admin=true, ?dashboard=true, ?admin=dashboard, ?embed=true)
  const [isEmbedMode, setIsEmbedMode] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const keyFromUrl = params.get('key');
      if (keyFromUrl) {
        setUrlKey(keyFromUrl);
      }

      const isEmbed = params.get('embed') === 'true' || params.get('mode') === 'embed';
      if (isEmbed) {
        setIsEmbedMode(true);
      }

      const adminParam = params.get('admin');
      const dashboardParam = params.get('dashboard');
      const isDirectAdminUrl = adminParam === 'true' || adminParam === 'dashboard' || dashboardParam === 'true' || adminParam === 'login';
      const isSavedAdminSession = localStorage.getItem('hirewave_admin_authenticated') === 'true';

      if (isSavedAdminSession || (isEmbed && isDirectAdminUrl)) {
        setIsAdminAuthenticated(true);
        setViewMode('recruiter');
        loadSubmissions(false, false);
      } else if (isDirectAdminUrl) {
        setIsAdminLoginOpen(true);
        loadSubmissions(false, false);
      }
    } catch (e) { }
  }, []);

  // Restore active candidate test session on page reload/refresh
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('hirewave_active_candidate_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed.candidateData) setCandidateData(parsed.candidateData);
        if (parsed.activeTest) setActiveTest(parsed.activeTest);
        if (parsed.urlKey) setUrlKey(parsed.urlKey);
        if (parsed.currentEvaluation) setCurrentEvaluation(parsed.currentEvaluation);
        if (parsed.cloudSaveStatus) setCloudSaveStatus(parsed.cloudSaveStatus);

        if (parsed.testStep) {
          setTestStep(parsed.testStep);
          // If reloading during testing or system_check, automatically re-acquire mic stream
          if (parsed.testStep === 'testing' || parsed.testStep === 'system_check') {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
              navigator.mediaDevices.getUserMedia({ audio: true })
                .then((stream) => setMediaStream(stream))
                .catch((err) => {
                  console.warn("Could not auto-acquire microphone on refresh:", err);
                  setTestStep('system_check');
                });
            }
          }
        }
      }
    } catch (e) {
      console.warn("Error restoring candidate session:", e);
    }
  }, []);

  // Persist current active candidate session to localStorage
  useEffect(() => {
    try {
      if (candidateData) {
        localStorage.setItem('hirewave_active_candidate_session', JSON.stringify({
          candidateData,
          activeTest,
          urlKey,
          testStep,
          currentEvaluation,
          cloudSaveStatus
        }));
      } else {
        localStorage.removeItem('hirewave_active_candidate_session');
      }
    } catch (e) { }
  }, [candidateData, activeTest, urlKey, testStep, currentEvaluation, cloudSaveStatus]);

  // Sync candidate submissions from Cloud Database with smart caching & delta polling
  const loadSubmissions = async (force = false, deltaOnly = false) => {
    setIsLoadingSubmissions(true);
    // Non-blocking retry sync in background
    retryPendingSubmissions().catch(() => { });
    try {
      const data = await fetchSubmissionsFromCloud({ forceRefresh: force, deltaOnly });
      if (data && Array.isArray(data)) {
        // Detect newly arrived submissions not seen previously
        const newArrivals = data.filter((s) => {
          const id = String(s.id || s._dbId || '');
          return id && !knownSubmissionIdsRef.current.has(id);
        });

        // Register all IDs
        data.forEach((s) => {
          const id = String(s.id || s._dbId || '');
          if (id) knownSubmissionIdsRef.current.add(id);
        });

        // Play chime & alert if new submissions arrived in background
        if (initialLoadDoneRef.current && newArrivals.length > 0) {
          const latestArrival = newArrivals[0];
          const name = latestArrival.candidate?.fullName || latestArrival.candidate?.name || 'A candidate';
          const score = latestArrival.evaluation?.overallScore !== undefined ? `${latestArrival.evaluation.overallScore}%` : '';

          notificationService.notifyNewCandidate(latestArrival);
          setNewCandidateToast({
            id: latestArrival.id || latestArrival._dbId,
            message: `🎉 New Candidate Alert: ${name} (${score}) just completed the test!`
          });
          setTimeout(() => setNewCandidateToast(null), 8000);
        }

        initialLoadDoneRef.current = true;
        setSubmissions(data);
        setLastSyncTime(new Date().toISOString());
      }
    } catch (e) {
      console.warn("Error fetching cloud submissions:", e);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    // Candidates loading app do not need background polling of candidate records
    if (viewMode === 'recruiter') {
      loadSubmissions(false, false);
      // Smart poll: Check for newly arrived candidates every 12s when tab is visible
      const interval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        loadSubmissions(false, true); // deltaOnly = true
      }, 12000);
      return () => clearInterval(interval);
    }

    // Only retry orphaned audio AFTER the candidate finishes (or before they start).
    // Running retries mid-test can PATCH incomplete shells into Supabase.
    if (testStep === 'testing' || testStep === 'system_check') {
      return undefined;
    }

    retryPendingSubmissions().catch(() => { });
    const audioRetry = setInterval(() => {
      retryPendingAudioUploads().catch(() => { });
    }, 20000);
    return () => clearInterval(audioRetry);
  }, [viewMode, testStep]);

  useEffect(() => {
    const handleOnline = () => {
      try { retryPendingSubmissions(); } catch (e) { }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);



  const handleAuthenticate = ({ candidate, test, authKey }) => {
    setCandidateData(candidate);
    const resolvedTest = activeKeys[authKey] || test || INITIAL_TESTS['8d5ri83f9c'];
    setActiveTest(resolvedTest);
    if (authKey) setUrlKey(authKey);
    setTestStep('system_check');
  };

  const handleSystemVerified = (stream) => {
    setMediaStream(stream);
    setTestStep('testing');
  };

  const handleSubmitTest = async (rawResponses, meta = {}) => {
    // 🎤 Immediately shut down and release microphone hardware so browser notification stops
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((track) => {
          try { track.stop(); } catch (e) { }
        });
      } catch (e) { }
      setMediaStream(null);
    }

    const evaluation = evaluateVoiceSubmission(rawResponses);
    setCurrentEvaluation(evaluation);
    setCloudSaveStatus({ success: null, error: null, saving: true });

    // Prefer the engine submission id so mid-test uploads + IndexedDB clips share one key
    const submissionId =
      meta.engineSubmissionId ||
      rawResponses?.[0]?._engineSubmissionId ||
      rawResponses?.[0]?.submissionId ||
      ('SUB-' + Date.now());

    const newSubmission = {
      id: submissionId,
      candidate: candidateData,
      test: activeTest,
      authKey: urlKey,
      submittedAt: new Date().toISOString(),
      rawResponses,
      evaluation
    };

    // Instant local UI state update (0 ms response time for candidate)
    setSubmissions((prev) => [newSubmission, ...prev.filter(s => s.id !== newSubmission.id)]);
    knownSubmissionIdsRef.current.add(String(submissionId));
    notificationService.notifyNewCandidate(newSubmission);
    setTestStep('submitted');

    // Save to Cloud Database (awaits metadata + best-effort audio sync).
    // Keep saving:true until this returns so the "do not close" screen stays up.
    try {
      const result = await saveSubmissionToCloud(newSubmission);
      const ok = result?.success === true || result === true;
      setCloudSaveStatus({
        success: ok,
        error: result?.error || (ok ? null : 'Cloud save failed'),
        // Do not surface provider names in candidate UI
        source: null,
        audioSynced: result?.audioSynced === true,
        saving: false,
      });

      if (result?.submission) {
        setSubmissions((prev) => {
          const rest = prev.filter((s) => s.id !== result.submission.id);
          return [result.submission, ...rest];
        });
      }

      // If some clips are still pending, keep retrying in background
      if (ok && result?.audioSynced === false) {
        setTimeout(() => {
          retryPendingAudioUploads().catch(() => { });
        }, 3000);
      }
    } catch (e) {
      console.error('Submit cloud save error:', e);
      setCloudSaveStatus({ success: false, error: e.message || String(e), saving: false, source: null });
    }
  };

  const handleAddNewKey = (newKey, roleName) => {
    setActiveKeys((prev) => {
      const updated = {
        ...prev,
        [newKey]: {
          id: newKey,
          title: `Nova ${roleName} Communication Test`,
          category: "Voice Assessment",
          targetRole: roleName,
          durationMinutes: 15,
          sections: INITIAL_TESTS['8d5ri83f9c']?.sections || []
        }
      };
      try {
        localStorage.setItem('hirewave_active_test_keys', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  };

  const handleAdminSuccess = () => {
    setIsAdminAuthenticated(true);
    try {
      localStorage.setItem('hirewave_admin_authenticated', 'true');
    } catch (e) { }
    setViewMode('recruiter');
  };

  // Deactivate HireWave Nova: Nova is only accessible via OpenHire link
  const isHireWaveAccess = (() => {
    if (typeof window !== 'undefined') {
      const href = window.location.href.toLowerCase();
      const host = window.location.hostname.toLowerCase();
      const pathname = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      const referrer = document.referrer ? document.referrer.toLowerCase() : '';

      return (
        host.includes('hirewave') ||
        pathname.includes('hirewave') ||
        search.includes('hirewave') ||
        href.includes('hirewave') ||
        referrer.includes('hirewave')
      );
    }
    return false;
  })();

  if (isHireWaveAccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', color: '#1e293b', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a', letterSpacing: '-0.02em' }}>404</h1>
        <p style={{ fontSize: '1.1rem', margin: 0, color: '#64748b', fontWeight: 500 }}>This page could not be found.</p>
      </div>
    );
  }

  if (currentPath === '/privacy-notice') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PrivacyNoticePage onBack={() => handleNavigate('/')} />
        <Footer onNavigate={handleNavigate} />
      </div>
    );
  }

  if (currentPath === '/terms-of-service') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TermsOfServicePage onBack={() => handleNavigate('/')} />
        <Footer onNavigate={handleNavigate} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Main App Workspace */}
      <main style={{ flex: 1 }}>
        {viewMode === 'candidate' ? (
          <>
            {testStep === 'auth' && (
              <CandidateAuthModal
                initialKey={urlKey}
                activeKeys={activeKeys}
                onAuthenticate={handleAuthenticate}
              />
            )}

            {testStep === 'system_check' && (
              <SystemCheck
                candidate={candidateData}
                test={activeTest || INITIAL_TESTS['8d5ri83f9c']}
                onProceed={handleSystemVerified}
              />
            )}

            {testStep === 'testing' && (
              <VoiceTestEngine
                candidate={candidateData}
                test={activeTest || INITIAL_TESTS['8d5ri83f9c']}
                mediaStream={mediaStream}
                onSubmitTest={handleSubmitTest}
              />
            )}

            {testStep === 'submitted' && (
              <TestSubmitted
                candidate={candidateData}
                test={activeTest || INITIAL_TESTS['8d5ri83f9c']}
                evaluation={currentEvaluation}
                cloudSaveStatus={cloudSaveStatus}
                onReset={() => {
                  setCandidateData(null);
                  setCloudSaveStatus(null);
                  setCurrentEvaluation(null);
                  try {
                    localStorage.removeItem('hirewave_active_candidate_session');
                  } catch (e) { }
                  setTestStep('auth');
                }}
              />
            )}
          </>
        ) : (
          <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a' }}>
            {/* Recruiter Top Navigation Bar */}
            <div style={{ background: '#ffffff', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', padding: '4px 8px', borderRadius: '6px', letterSpacing: '0.5px' }}>
                  NOVA
                </div>
                <div>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Recruiter Admin</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setViewMode('candidate');
                  setIsAdminAuthenticated(false);
                  try {
                    localStorage.removeItem('hirewave_admin_authenticated');
                  } catch (e) { }
                }}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  padding: '5px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                ← Exit to Candidate View
              </button>
            </div>

            {newCandidateToast && (
              <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                color: '#ffffff',
                padding: '12px 20px',
                borderBottom: '2px solid #6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.86rem',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                animation: 'slideDown 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🎉</span>
                  <span>{newCandidateToast.message}</span>
                </div>
                <button
                  onClick={() => setNewCandidateToast(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            <RecruiterDashboard
              submissions={submissions}
              activeKeys={activeKeys}
              onAddKey={handleAddNewKey}
              isLoadingSubmissions={isLoadingSubmissions}
              lastSyncTime={lastSyncTime}
              onRefresh={(force, deltaOnly) => loadSubmissions(force, deltaOnly)}
            />
          </div>
        )}
      </main>

      {/* Floating Recruiter Admin Login Trigger Link */}
      {viewMode === 'candidate' && testStep === 'auth' && (
        <div style={{ textAlign: 'center', padding: '8px', background: 'transparent', fontSize: '0.75rem' }}>
          <button
            onClick={() => setIsAdminLoginOpen(true)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Shield size={12} /> Recruiter Admin Portal Login
          </button>
        </div>
      )}

      {/* Admin Credentials Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLoginSuccess={handleAdminSuccess}
      />
    </div>
  );
}
