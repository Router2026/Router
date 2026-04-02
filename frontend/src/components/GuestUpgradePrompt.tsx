import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  feature?: string;
  onClose?: () => void;
}

/**
 * Modal shown when a guest user tries to use a registered-only feature.
 */
export default function GuestUpgradePrompt({ feature = 'תכונה זו', onClose }: Props) {
  const navigate = useNavigate();
  const { upgradeGuest } = useAuth();

  const handleRegister = () => {
    upgradeGuest();
    navigate('/Register');
    onClose?.();
  };
  const handleLogin = () => {
    upgradeGuest();
    navigate('/Login');
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-upgrade-title"
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.5)', direction: 'rtl' }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{ background: '#fff', borderRadius: 24, padding: '28px 24px', maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🔒</div>
        <h2 id="guest-upgrade-title" style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', textAlign: 'center', marginBottom: 8, marginTop: 0 }}>
          דרוש חשבון
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 }}>
          {feature} זמינה רק למשתמשים רשומים. הצטרפות חינמית ומהירה!
        </p>

        <button
          onClick={handleRegister}
          autoFocus
          style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 10, boxShadow: '0 4px 15px rgba(13,158,110,0.3)' }}
        >
          🚀 הרשמה חינמית
        </button>

        <button
          onClick={handleLogin}
          style={{ width: '100%', padding: '13px', border: '2px solid #0d9e6e', borderRadius: 14, background: '#fff', color: '#0d9e6e', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 10 }}
        >
          🔑 כבר יש לי חשבון
        </button>

        {onClose && (
          <button
            onClick={onClose}
            style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 14, background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}
          >
            המשך כאורח
          </button>
        )}
      </div>
    </div>
  );
}
