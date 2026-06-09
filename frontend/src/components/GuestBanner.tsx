/**
 * GuestBanner — sticky top bar shown when user is in guest mode.
 * Nudges the guest towards registration with a contextual message.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function GuestBanner() {
  const { isGuest, upgradeGuest } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!isGuest || dismissed) return null;

  return (
    <output
      aria-label="מצב אורח — חלק מהתכונות נעולות"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 3000,
        background: 'linear-gradient(90deg, #0f172a 0%, #0d9e6e 100%)',
        padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        direction: 'rtl',
        fontFamily: 'Heebo, sans-serif',
      }}
    >
      {/* Lock icon */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>

      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', flex: 1, lineHeight: 1.3 }}>
        גולש כ<strong style={{ color: '#fff' }}>אורח</strong> — הרשמה חינמית לסל מסלול, מועדפים ועוד
      </span>

      <button
        onClick={() => { upgradeGuest(); navigate('/Register'); }}
        aria-label="הרשמה חינמית לגישה מלאה"
        style={{
          padding: '4px 11px', border: 'none', borderRadius: 7,
          background: '#fff', color: '#0d9e6e',
          fontSize: 11, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        הרשמה
      </button>

      <button
        onClick={() => setDismissed(true)}
        aria-label="סגור הודעה"
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
      >
        ×
      </button>
    </output>
  );
}

/** Returns the height of the guest banner so other elements can offset themselves */
export const GUEST_BANNER_HEIGHT = 38;
