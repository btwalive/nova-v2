import React, { useState } from 'react';
import { Lock, Mail, Key, ShieldCheck, ArrowRight, X } from 'lucide-react';

export default function AdminLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLogin = (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (cleanEmail === 'aman@openhire.in' && cleanPass === 'Amcat201300') {
      setError('');
      onLoginSuccess();
      onClose();
    } else {
      setError('Invalid admin credentials. Please enter authorized username and password.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="maki-card" style={{ maxWidth: '440px', width: '100%', padding: '32px', position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
            <Lock size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Recruiter Admin Portal</h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Authorized Admin Login</span>
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Admin Email *</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="maki-input"
                style={{ paddingLeft: '38px' }}
                placeholder="admin@openhire.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="maki-input"
                style={{ paddingLeft: '38px' }}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Key size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <button type="submit" className="btn-maki-primary" style={{ marginTop: '8px', width: '100%' }}>
            Authenticate & Access Dashboard <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
