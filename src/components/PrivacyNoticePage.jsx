import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, Lock, Mic, Volume2, CheckCircle2, Eye, Server, FileText, HelpCircle, ChevronRight, Scale, Clock } from 'lucide-react';

export default function PrivacyNoticePage({ onBack }) {
  const [activeSection, setActiveSection] = useState('identity');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const tocItems = [
    { id: 'identity', label: '1. Identity of Controller & Processor' },
    { id: 'data-collected', label: '2. Personal Data We Collect' },
    { id: 'how-collected', label: '3. How Data is Collected' },
    { id: 'how-used', label: '4. How We Use Your Data' },
    { id: 'mic-hardware', label: '5. Microphone & Audio Privacy' },
    { id: 'disclosures', label: '6. Who We Disclose Data To' },
    { id: 'security', label: '7. Data Security & Storage' },
    { id: 'rights', label: '8. Your Data Protection Rights' },
    { id: 'contact', label: '9. Contact Information' }
  ];

  const scrollToSection = (id) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Top Header */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={onBack}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <ArrowLeft size={16} /> Back to Assessment
            </button>
            <div style={{ height: '24px', width: '1px', background: '#cbd5e1' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#4f46e5', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={18} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>OpenHire</span>
              <span style={{ fontSize: '0.8rem', background: '#eef2ff', color: '#4f46e5', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>Legal & Privacy</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: '#64748b' }}>
            <Clock size={14} /> Effective Date: March 2026
          </div>
        </div>
      </header>

      {/* Hero Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        color: '#ffffff',
        padding: '48px 32px',
        borderBottom: '1px solid #1e293b'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(129, 140, 248, 0.3)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '16px' }}>
            <Lock size={14} /> Privacy Notice & Data Protection Policy
          </div>
          <h1 style={{ margin: '0 0 12px 0', fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
            Privacy Notice for Nova Spoken Assessment
          </h1>
          <p style={{ margin: 0, fontSize: '1.05rem', color: '#cbd5e1', maxWidth: '780px', lineHeight: 1.6 }}>
            Transparency regarding how OpenHire collects, evaluates, processes, and protects your personal identifiers, microphone voice data, and speech assessment results.
          </p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 32px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }}>
        
        {/* Sticky Left Sidebar Table of Contents */}
        <aside style={{ position: 'sticky', top: '100px', height: 'fit-content' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)'
          }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '0.85rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Table of Contents
            </h4>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {tocItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: activeSection === item.id ? 700 : 500,
                    color: activeSection === item.id ? '#4f46e5' : '#475569',
                    background: activeSection === item.id ? '#eef2ff' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Legal Body Content */}
        <main style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '40px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
          lineHeight: 1.7,
          color: '#334155'
        }}>

          {/* Section 1 */}
          <section id="identity" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginTop: 0 }}>
              1. Identity of Controller & Processor
            </h2>
            <p>
              When you take an assessment on OpenHire (accessible via <code>assessment.openhire.in</code> or <code>openhire.in</code>), you participate in a voice communication evaluation requested by a corporate client, prospective employer, or recruiter (the <strong>Data Controller</strong>).
            </p>

            <p>
              OpenHire operates as the <strong>Data Processor</strong> providing speech-to-text transcription, acoustic voice feature analysis, and candidate evaluation scorecards under the strict instructions of the Data Controller.
            </p>
          </section>

          {/* Section 2 */}
          <section id="data-collected" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              2. Personal Data We Collect
            </h2>
            <p>
              To process your spoken voice assessment, we collect specific categories of personal identifiers and technical audio data:
            </p>

            {/* Category Table */}
            <div style={{ overflowX: 'auto', margin: '20px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', border: '1px solid #e2e8f0' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>Data Category</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>Examples</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#4f46e5' }}>Candidate Identifiers</td>
                    <td style={{ padding: '12px 16px' }}>Full Name, Email Address, Phone Number, Candidate ID.</td>
                    <td style={{ padding: '12px 16px' }}>Identity verification & linking assessment scorecard to candidate record.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#4f46e5' }}>Spoken Voice Audio</td>
                    <td style={{ padding: '12px 16px' }}>Microphone audio recordings of prompt responses.</td>
                    <td style={{ padding: '12px 16px' }}>AI speech recognition, transcription, and recruiter voice review.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#4f46e5' }}>Speech Feature Metrics</td>
                    <td style={{ padding: '12px 16px' }}>Pronunciation accuracy, pitch, pacing, articulation rate, grammar.</td>
                    <td style={{ padding: '12px 16px' }}>Generating objective spoken English scorecards (CEFR benchmarks).</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#4f46e5' }}>Hardware Telemetry</td>
                    <td style={{ padding: '12px 16px' }}>Microphone permission status, speaker check confirmation, browser user agent.</td>
                    <td style={{ padding: '12px 16px' }}>Ensuring device compatibility and test session stability.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3 */}
          <section id="how-collected" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              3. How Data is Collected
            </h2>
            <p>
              Data is collected directly when you register on the assessment portal, permit browser microphone access, and record your spoken answers into the microphone. No background background surveillance cookies or unrelated device telemetry are gathered.
            </p>
          </section>

          {/* Section 4 */}
          <section id="how-used" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              4. How We Use Your Data
            </h2>
            <ul style={{ paddingLeft: '20px' }}>
              <li><strong>Candidate Assessment:</strong> Evaluating spoken communication proficiency for recruitment selection.</li>
              <li><strong>Scorecard Generation:</strong> Structuring detailed performance breakdowns for hiring decision-makers.</li>
              <li><strong>Security & Anti-Fraud:</strong> Preventing duplicate test submissions using candidate email validation.</li>
            </ul>
          </section>

          {/* Section 5 - Dedicated Mic & Hardware Guarantee */}
          <section id="mic-hardware" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '14px', padding: '24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#065f46', fontWeight: 800, fontSize: '1.1rem', marginBottom: '8px' }}>
                <Mic size={22} color="#059669" /> 5. Microphone & Audio Privacy Guarantee
              </div>
              <p style={{ margin: '0 0 10px 0', color: '#047857', fontSize: '0.92rem' }}>
                We strictly limit data collection to your spoken voice microphone input and prompt audio speaker playback:
              </p>
              <ul style={{ paddingLeft: '20px', color: '#065f46', margin: 0, fontSize: '0.9rem' }}>
                <li style={{ marginBottom: '6px' }}><strong>NO Camera or Video Recording:</strong> OpenHire does NOT access, stream, or record your webcam or video camera.</li>
                <li style={{ marginBottom: '6px' }}><strong>NO Desktop Screen Proctoring:</strong> We do NOT monitor, record, or inspect your desktop screen, browser tabs, or background files.</li>
                <li style={{ marginBottom: '6px' }}><strong>Active Mic Indicator:</strong> Microphone recording is active ONLY when you click "Start Recording" or during designated prompt timers.</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section id="disclosures" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              6. Who We Disclose Data To
            </h2>
            <p>
              We do <strong>NOT</strong> sell, rent, or commercialize candidate data or audio recordings to third-party advertisers or data brokers. Data disclosures are strictly limited to:
            </p>
            <ul style={{ paddingLeft: '20px' }}>
              <li><strong>Hiring Organizations & Employers:</strong> Accessing assessment scorecards and voice review links.</li>
              <li><strong>Secure Cloud Infrastructure:</strong> Encrypted cloud storage providers for audio hosting.</li>
              <li><strong>Legal Compliance:</strong> Only when compelled by mandatory legal process or law enforcement warrant.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section id="security" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              7. Data Security & Storage
            </h2>
            <p>
              All candidate data in transit is protected using industry-standard <strong>HTTPS / TLS 1.2+ encryption</strong>. Audio recordings stored in cloud database buckets are protected with strict role-based access control policies.
            </p>
          </section>

          {/* Section 8 */}
          <section id="rights" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              8. Your Data Protection Rights
            </h2>
            <p>
              Depending on your jurisdiction, you possess the right to:
            </p>
            <ul style={{ paddingLeft: '20px' }}>
              <li>Request access to your candidate assessment report and audio recordings.</li>
              <li>Request correction of inaccurate registration contact details.</li>
              <li>Request erasure of your assessment record from recruiter databases.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section id="contact" style={{ scrollMarginTop: '120px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              9. Contact Information
            </h2>
            <p>
              If you have any questions regarding this Privacy Notice or wish to exercise your data protection rights, please contact our Data Protection Office at:
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px 20px', borderRadius: '12px', fontSize: '0.9rem' }}>
              <strong>OpenHire Data Protection Office</strong><br />
              Email: <code>privacy@openhire.in</code> / <code>support@openhire.in</code><br />
              Web: <a href="https://assessment.openhire.in/nova" target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontWeight: 700 }}>assessment.openhire.in/nova</a>
            </div>
          </section>

        </main>
      </div>

    </div>
  );
}
