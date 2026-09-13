import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, FileText, Lock, Mic, Volume2, CheckCircle2, Scale, Clock, AlertCircle } from 'lucide-react';

export default function TermsOfServicePage({ onBack }) {
  const [activeSection, setActiveSection] = useState('user-assent');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const tocItems = [
    { id: 'user-assent', label: '1. Candidate Assent & Eligibility' },
    { id: 'scope-hardware', label: '2. Hardware Access & Assessment Scope' },
    { id: 'candidate-conduct', label: '3. Candidate Conduct & Authenticity' },
    { id: 'intellectual-property', label: '4. Intellectual Property Rights' },
    { id: 'system-availability', label: '5. Technical Disclaimer & Availability' },
    { id: 'limitation-liability', label: '6. Limitation of Liability' },
    { id: 'governing-law', label: '7. Governing Law & Contact' }
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
                <FileText size={18} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>OpenHire</span>
              <span style={{ fontSize: '0.8rem', background: '#eef2ff', color: '#4f46e5', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>Terms of Service</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: '#64748b' }}>
            <Clock size={14} /> Last Revision: March 2026
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
            <Scale size={14} /> Website & Assessment Terms of Service
          </div>
          <h1 style={{ margin: '0 0 12px 0', fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
            Terms & Conditions of Service
          </h1>
          <p style={{ margin: 0, fontSize: '1.05rem', color: '#cbd5e1', maxWidth: '780px', lineHeight: 1.6 }}>
            Rules, candidate obligations, microphone & speaker access permissions, and legal conditions governing your use of the Nova Spoken Voice Assessment platform.
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
          <section id="user-assent" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginTop: 0 }}>
              1. Candidate Assent & Eligibility
            </h2>
            <p>
              PLEASE READ THESE TERMS AND CONDITIONS ("Terms") BEFORE USING THIS ASSESSMENT SITE. By accessing or continuing to use this website (accessible via <code>assessment.openhire.in</code> or <code>openhire.in</code>), you signify your explicit acceptance of these Terms.
            </p>

            <p>
              You represent that you are at least 18 years of age (or the minimum legal age in your jurisdiction) and possess the legal authority to participate in spoken recruitment assessments.
            </p>
          </section>

          {/* Section 2 */}
          <section id="scope-hardware" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              2. Hardware Access & Assessment Scope
            </h2>
            <p>
              This platform evaluates candidate spoken communication skills, English pronunciation, listening comprehension, and speech clarity.
            </p>
            <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '12px', padding: '20px', margin: '16px 0' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#1e40af', fontWeight: 800, fontSize: '1rem' }}>
                Hardware & Media Permissions Granted
              </h4>
              <ul style={{ paddingLeft: '20px', margin: 0, color: '#1e3a8a', fontSize: '0.9rem' }}>
                <li style={{ marginBottom: '6px' }}><strong>Microphone Input:</strong> You authorize the site to record audio from your microphone during designated response timers.</li>
                <li style={{ marginBottom: '6px' }}><strong>Speaker Audio Output:</strong> You authorize the site to play prompt audio passages to verify listening comprehension.</li>
                <li style={{ marginBottom: '6px' }}><strong>No Video / Screen Access:</strong> The platform does NOT stream, access, or record your video camera or desktop screen.</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section id="candidate-conduct" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              3. Candidate Conduct & Authenticity
            </h2>
            <p>
              When completing an assessment, you agree:
            </p>
            <ul style={{ paddingLeft: '20px' }}>
              <li>To provide your own authentic spoken responses without third-party proxy speakers.</li>
              <li>Not to use artificial intelligence voice changers, text-to-speech synthesizers, or automated sound injection software.</li>
              <li>Not to disrupt or attempt to bypass system security or data submission endpoints.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section id="intellectual-property" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              4. Intellectual Property Rights
            </h2>
            <p>
              The assessment passages, voice prompts, evaluation algorithms, logo branding, and user interface designs are the sole intellectual property of OpenHire and its platform operators. You may not copy, record, republish, or construct derivative databases from assessment content without prior written authorization.
            </p>
          </section>

          {/* Section 5 */}
          <section id="system-availability" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              5. Technical Disclaimer & Availability
            </h2>
            <p>
              The platform and all assessment components are provided on an "AS IS" and "AS AVAILABLE" basis. While OpenHire implements modern infrastructure safeguards, we are not responsible for candidate-side internet disconnections, local hardware microphone distortion, or browser compatibility issues.
            </p>
          </section>

          {/* Section 6 */}
          <section id="limitation-liability" style={{ scrollMarginTop: '120px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              6. Limitation of Liability
            </h2>
            <p>
              UNDER NO CIRCUMSTANCES SHALL OPENHIRE OR ITS OPERATORS BE LIABLE FOR DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR PARTICIPATION IN AN ASSESSMENT OR INABILITY TO CONNECT TO THE SITE.
            </p>
          </section>

          {/* Section 7 */}
          <section id="governing-law" style={{ scrollMarginTop: '120px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              7. Governing Law & Legal Contact
            </h2>
            <p>
              These Terms are governed by and construed in accordance with applicable laws. Legal inquiries regarding terms or service compliance may be submitted to:
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px 20px', borderRadius: '12px', fontSize: '0.9rem' }}>
              <strong>OpenHire Legal Department</strong><br />
              Email: <code>legal@openhire.in</code> / <code>support@openhire.in</code><br />
              Web: <a href="https://assessment.openhire.in/nova" target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontWeight: 700 }}>assessment.openhire.in/nova</a>
            </div>
          </section>

        </main>
      </div>

    </div>
  );
}
