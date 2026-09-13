import React from 'react';
import { Shield, Sparkles, Lock, FileText, Mic, ChevronRight } from 'lucide-react';
import novaAvatarImg from '../Nova_newavtar.jpeg';

export default function Navbar({ onNavigate, currentPath = '/' }) {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'openhire.in';

  return (
    <header style={{
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #e2e8f0',
      position: 'sticky',
      top: 0,
      zIndex: 90,
      padding: '12px 24px',
      boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        
        {/* Brand Logo & Avatar Badge */}
        <div
          onClick={() => onNavigate && onNavigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: '2px solid #4f46e5',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.2)',
            flexShrink: 0
          }}>
            <img src={novaAvatarImg} alt="Nova" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a', letterSpacing: '-0.3px' }}>Nova</span>
              <span style={{ fontSize: '0.72rem', background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', color: '#ffffff', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={11} /> AI Skill Assessor
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
              OpenHire Platform
            </div>

          </div>
        </div>

        {/* Navigation Quick Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <button
            onClick={() => onNavigate && onNavigate('/privacy-notice')}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: currentPath === '/privacy-notice' ? 800 : 600,
              color: currentPath === '/privacy-notice' ? '#4f46e5' : '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Lock size={14} /> Privacy Notice
          </button>

          <button
            onClick={() => onNavigate && onNavigate('/terms-of-service')}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: currentPath === '/terms-of-service' ? 800 : 600,
              color: currentPath === '/terms-of-service' ? '#4f46e5' : '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={14} /> Terms of Service
          </button>

          <button
            onClick={() => onNavigate && onNavigate('/admin')}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Shield size={13} color="#4f46e5" /> Recruiter Login
          </button>
        </nav>

      </div>
    </header>
  );
}
