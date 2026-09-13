import React from 'react';
import { Shield, Lock, FileText, Mic, CheckCircle2, Heart } from 'lucide-react';

export default function Footer({ onNavigate }) {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'openhire.in';

  return (
    <footer style={{
      background: '#0f172a',
      color: '#94a3b8',
      borderTop: '1px solid #1e293b',
      padding: '36px 24px 24px',
      fontSize: '0.85rem',
      lineHeight: 1.6
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Top Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '32px', marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid #1e293b' }}>
          
          {/* Col 1: Platform Overview */}
          <div>
            <h4 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 800, margin: '0 0 10px 0' }}>
              Nova AI Assessment
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
              Automated spoken English communication, pronunciation, and listening comprehension assessment platform for modern recruitment.
            </p>
          </div>

          {/* Col 2: Legal & Privacy */}
          <div>
            <h4 style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 800, margin: '0 0 10px 0' }}>
              Legal & Transparency
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>
                <button
                  onClick={() => onNavigate && onNavigate('/privacy-notice')}
                  style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Lock size={12} color="#818cf8" /> Privacy Notice & Data Protection
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate && onNavigate('/terms-of-service')}
                  style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileText size={12} color="#818cf8" /> Terms of Service
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Hardware & Security Compliance */}
          <div>
            <h4 style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 800, margin: '0 0 10px 0' }}>
              Candidate Security & Trust
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={13} color="#10b981" /> Mic & Speaker Only
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={13} color="#10b981" /> No Camera / Video Recording
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={13} color="#10b981" /> TLS 1.2+ Encrypted Transmission
              </span>
            </div>
          </div>

        </div>

        {/* Bottom Copyright & Admin Link Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.78rem' }}>
          <div>
            © 2026 OpenHire Technologies • Active Domain: <code style={{ color: '#a5b4fc' }}>{currentHost}</code>
          </div>

          <button
            onClick={() => onNavigate && onNavigate('/admin')}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0,
              fontSize: '0.78rem'
            }}
          >
            <Shield size={12} /> Recruiter Portal Access
          </button>
        </div>

      </div>
    </footer>
  );
}
