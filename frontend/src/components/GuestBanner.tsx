import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Persistent banner shown when user is in guest mode.
 * Appears at the top of every page (except auth pages).
 */
export default function GuestBanner() {
  const { isGuest, upgradeGuest } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!isGuest || dismissed) return null;

  return (
    <div
      role="banner"
      aria-label="מצב אורח — הרשמה לגישה מלאה"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 3000,
        background: 'linear-gradient(90deg, #1a2e2a, #0d9e6e)',
        padding: '9px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        direction: 'rtl', gap: 8,
      }}
    >
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.88)', fontFamily: 'Heebo, sans-serif', flex: 1 }}>
        👀 אתה גולש כ<strong style={{ color: '#fff' }}>אורח</strong> — חלק מהתכונות נעולות
      </span>
      <button
        onClick={() => { upgradeGuest(); navigate('/Register'); }}
        aria-label="הרשמה לגישה מלאה"
        style={{ padding: '5px 12px', border: 'none', borderRadius: 8, background: '#fff', color: '#0d9e6e', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap' }}
      >
        הרשמה חינמית
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="סגור הודעה"
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
