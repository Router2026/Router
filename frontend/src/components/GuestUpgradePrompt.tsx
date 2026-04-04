/**
 * GuestUpgradePrompt — contextual modal shown when a guest tries a locked action.
 * Supports a `feature` string to personalise the message.
 */
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURE_PERKS: Record<string, { icon: string; perks: string[] }> = {
  'הוספה לסל המסלול': {
    icon: '🎒',
    perks: ['שמור מסלולים ואתרים', 'בנה מסלולים מותאמים אישית', 'שתף עם חברים'],
  },
  'שמירת מועדפים': {
    icon: '❤️',
    perks: ['שמור אתרים אהובים', 'גש אליהם בכל עת', 'ארגן לפי אזורים'],
  },
  'הוספת ביקורת': {
    icon: '⭐',
    perks: ['שתף חוויות מהשטח', 'עזור לטיילים אחרים', 'צבור נקודות XP'],
  },
  'דיווח': {
    icon: '🚨',
    perks: ['דווח על מצב שבילים', 'עדכן על חסימות', 'עזור לקהילה'],
  },
  'יצירת מסלול AI': {
    icon: '🤖',
    perks: ['AI בונה מסלול בשבילך', 'מותאם לקבוצה ולרמה', 'עם מפה ועצירות'],
  },
};

const DEFAULT_PERKS = ['שמור ושתף מסלולים', 'הוסף ביקורות ותמונות', 'צבור XP ועלה ברמות'];

interface Props {
  feature?: string;
  onClose?: () => void;
}

export default function GuestUpgradePrompt({ feature, onClose }: Props) {
  const navigate = useNavigate();
  const { upgradeGuest } = useAuth();
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
    // Trap scroll
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Keyboard: Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const perkData = feature ? (FEATURE_PERKS[feature] || null) : null;
  const perks = perkData?.perks || DEFAULT_PERKS;
  const icon = perkData?.icon || '🔓';

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
      style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', direction: 'rtl' }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{ background: '#fff', borderRadius: 24, padding: '28px 22px 22px', maxWidth: 360, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        {/* Icon */}
        <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 14px', boxShadow: '0 8px 20px rgba(13,158,110,0.25)' }}>
          {icon}
        </div>

        <h2 id="guest-upgrade-title" style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', textAlign: 'center', marginBottom: 6, marginTop: 0 }}>
          {feature ? `${feature} — דרוש חשבון` : 'דרוש חשבון'}
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 18, lineHeight: 1.6 }}>
          הצטרף חינם ותוך שניות תוכל:
        </p>

        {/* Perks */}
        <div style={{ background: '#f8fafc', borderRadius: 14, padding: '12px 14px', marginBottom: 20 }}>
          {perks.map((perk, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: i < perks.length - 1 ? '1px solid #e8f9f3' : 'none' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#e8f9f3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span style={{ fontSize: 13, color: '#1a2e2a', fontWeight: 600 }}>{perk}</span>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <button
          ref={primaryRef}
          onClick={handleRegister}
          style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 9, boxShadow: '0 6px 18px rgba(13,158,110,0.3)' }}
        >
          🚀 הרשמה חינמית — 30 שניות
        </button>

        <button
          onClick={handleLogin}
          style={{ width: '100%', padding: '12px', border: '2px solid #0d9e6e', borderRadius: 14, background: '#fff', color: '#0d9e6e', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 9 }}
        >
          🔑 כבר יש לי חשבון
        </button>

        {onClose && (
          <button
            onClick={onClose}
            style={{ width: '100%', padding: '9px', border: 'none', borderRadius: 14, background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}
          >
            המשך כאורח
          </button>
        )}
      </div>
    </div>
  );
}
