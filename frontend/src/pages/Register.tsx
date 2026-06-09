import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, type AppStats, type Region } from '../api';
import { roundToThousands } from '../utils/helper';

function StrengthBar({ password }: { password: string }) {
  const score = [/.{6,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(password)).length;
  const labels = ['', 'חלשה', 'בינונית', 'חזקה', 'מצוינת'];
  const colors = ['#e2e8f0', '#ef4444', '#f59e0b', '#0d9e6e', '#059669'];
  if (!password) return null;
  return (
    <div style={{ marginBottom: 16, direction: 'rtl' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= score ? colors[score] : '#e2e8f0', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: colors[score], fontWeight: 700, textAlign: 'right' }}>
        {score > 0 && `חוזק סיסמה: ${labels[score]}`}
      </div>
    </div>
  );
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

interface RegistrationFields {
  fullName: string;
  username: string;
  usernameStatus: UsernameStatus;
  email: string;
  password: string;
  confirm: string;
  agreedToTerms: boolean;
}

/** Pure validation — module-level so it can be tested independently (S3776). */
function validateRegistrationForm(fields: RegistrationFields): string | null {
  if (!fields.fullName.trim()) return 'אנא הכנס שם מלא';
  if (!fields.username || !USERNAME_RE.test(fields.username)) return 'שם משתמש לא תקין (3-20 תווים, אנגלית/מספרים/_)';
  if (fields.usernameStatus === 'taken') return 'שם המשתמש תפוס';
  if (fields.usernameStatus === 'checking') return 'ממתין לבדיקת שם משתמש...';
  if (!fields.email.trim() || !fields.email.includes('@')) return 'אנא הכנס כתובת אימייל תקינה';
  if (fields.password.length < 6) return 'הסיסמה חייבת להכיל לפחות 6 תווים';
  if (fields.password !== fields.confirm) return 'הסיסמאות אינן תואמות';
  if (!fields.agreedToTerms) return 'יש לאשר את מדיניות הפרטיות כדי להמשיך';
  return null;
}

/**
 * Schedules a debounced username-availability check and returns the cleanup
 * function. Module-level so it doesn't contribute to the component's cognitive
 * complexity (S3776).
 */
function scheduleUsernameCheck(
  username: string,
  debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  setStatus: (s: UsernameStatus) => void,
): () => void {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(async () => {
    try {
      const available = await api.auth.checkUsername(username);
      setStatus(available ? 'available' : 'taken');
    } catch { setStatus('idle'); }
  }, 500);
  return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
}

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);

  useEffect(() => {
    api.regions.list().then(setRegions).catch(() => { });
    api.users.stats().then(setStats).catch(() => { });
  }, []);

  const totalLocations = roundToThousands(stats?.total_locations) ?? 0;
  const totalRegions = stats?.total_regions ?? regions.length;
  const avgRating = stats?.average_rating ?? 4.8;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!username) { setUsernameStatus('idle'); return; }
    if (!USERNAME_RE.test(username)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    // scheduleUsernameCheck is module-level to reduce component complexity (S3776)
    return scheduleUsernameCheck(username, debounceRef, setUsernameStatus);
  }, [username]);

  // Delegates to module-level validateRegistrationForm to reduce cognitive complexity (S3776)
  const validate = () => validateRegistrationForm({ fullName, username, usernameStatus, email, password, confirm, agreedToTerms });

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      await register(email.trim(), password, fullName.trim(), username.trim().toLowerCase());
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '14px 16px', border: '2px solid #e2e8f0',
    borderRadius: 14, fontSize: 15, fontFamily: 'Heebo, sans-serif',
    textAlign: 'right', outline: 'none', background: '#f8fafc',
    color: '#1a2e2a', boxSizing: 'border-box', direction: 'rtl',
    transition: 'border-color 0.2s',
  };

  const usernameColor = { idle: '#e2e8f0', checking: '#f59e0b', available: '#0d9e6e', taken: '#ef4444', invalid: '#ef4444' }[usernameStatus];
  const usernameHint = { idle: '', checking: 'בודק זמינות...', available: '✓ שם משתמש פנוי', taken: '✗ שם משתמש תפוס', invalid: '✗ 3-20 תווים: אנגלית, מספרים, _ בלבד' }[usernameStatus];

  if (success) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f4f3', gap: 16, direction: 'rtl', padding: 24 }}>
      <div style={{ fontSize: 72 }}>📧</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: '#0d9e6e' }}>בדוק את האימייל שלך!</div>
      <div style={{ fontSize: 15, color: '#64748b', textAlign: 'center', maxWidth: 320 }}>
        שלחנו קישור אימות לכתובת <strong>{email}</strong>.<br />לחץ על הקישור כדי להפעיל את החשבון שלך.
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
        לא קיבלת? בדוק תיקיית ספאם או{' '}
        <button onClick={async () => {
          try { await fetch((import.meta.env.VITE_API_URL ?? '') + '/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); alert('נשלח שוב!'); } catch { /* intentional */ }
        }} style={{ background: 'none', border: 'none', color: '#0d9e6e', cursor: 'pointer', fontWeight: 700, fontSize: 13, padding: 0 }}>שלח שוב</button>
      </div>
      <button onClick={() => navigate('/Login')} style={{ marginTop: 8, padding: '12px 28px', background: '#0d9e6e', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
        כניסה לחשבון
      </button>
    </div>
  );

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', direction: 'rtl' }}>
      <div style={{ background: 'linear-gradient(135deg, #0d9e6e 0%, #059669 100%)', padding: '40px 24px 76px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ fontSize: 44, marginBottom: 8 }}>🧭</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>הצטרף ל-Router</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', marginTop: 6 }}>גלה מסלולים, שתף חוויות וצור מסלולים חדשים</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
          {['📍 דיווחים בזמן אמת', '🗺️ שמור מסלולים', '⭐ כתוב ביקורות'].map(b => (
            <span key={b} style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>{b}</span>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 20px 100px', position: 'relative' }}>

        {/* ── Quick Stats ── */}
        <div style={{ marginTop: -40, marginBottom: 24, zIndex: 10 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '18px 20px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center' }}>
            {[
              { value: totalLocations > 0 ? `${totalLocations}+` : '...', label: 'מסלולים', icon: '🗺️' },
              { value: totalRegions > 0 ? String(totalRegions) : '...', label: 'אזורים', icon: '📍' },
              { value: avgRating > 0 ? `${avgRating}★` : '...', label: 'דירוג ממוצע', icon: '⭐' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0d9e6e' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.06)', padding: '28px 24px 24px', position: 'relative', zIndex: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', textAlign: 'right', marginBottom: 22 }}>יצירת חשבון חדש</div>

          {/* Username */}
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="register-username" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right', marginBottom: 6 }}>שם משתמש *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-username"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="israel_123"
                style={{ ...inputBase, direction: 'ltr', textAlign: 'left', borderColor: usernameColor, paddingRight: 44 }}
              />
              {usernameStatus !== 'idle' && (
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>
                  {usernameStatus === 'checking' ? '⏳' : usernameStatus === 'available' ? '✅' : '❌'}
                </div>
              )}
            </div>
            {usernameHint && <div style={{ fontSize: 11, color: usernameColor, fontWeight: 700, textAlign: 'right', marginTop: 4 }}>{usernameHint}</div>}
          </div>

          {/* Full name */}
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="register-fullname" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right', marginBottom: 6 }}>שם מלא *</label>
            <input id="register-fullname" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="ישראל ישראלי" style={inputBase}
              onFocus={e => (e.target.style.borderColor = '#0d9e6e')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="register-email" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right', marginBottom: 6 }}>אימייל *</label>
            <input id="register-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email"
              style={{ ...inputBase, direction: 'ltr', textAlign: 'left' }}
              onFocus={e => (e.target.style.borderColor = '#0d9e6e')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 4 }}>
            <label htmlFor="register-password" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right', marginBottom: 6 }}>סיסמה *</label>
            <div style={{ position: 'relative' }}>
              <input id="register-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="לפחות 6 תווים"
                type={showPass ? 'text' : 'password'} style={{ ...inputBase, paddingLeft: 44, direction: 'ltr', textAlign: 'left' }}
                onFocus={e => (e.target.style.borderColor = '#0d9e6e')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
              <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                {showPass
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                }
              </button>
            </div>
          </div>

          <StrengthBar password={password} />

          {/* Confirm */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="register-confirm" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right', marginBottom: 6 }}>אימות סיסמה *</label>
            <div style={{ position: 'relative' }}>
              <input id="register-confirm" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="הכנס סיסמה שוב"
                type={showPass ? 'text' : 'password'}
                style={{ ...inputBase, paddingRight: 44, borderColor: confirm && confirm !== password ? '#ef4444' : confirm && confirm === password ? '#0d9e6e' : '#e2e8f0' }}
                onFocus={e => { if (!confirm || confirm === password) e.target.style.borderColor = '#0d9e6e'; }}
                onBlur={e => { e.target.style.borderColor = confirm && confirm !== password ? '#ef4444' : confirm && confirm === password ? '#0d9e6e' : '#e2e8f0'; }} />
              {confirm && <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>{confirm === password ? '✅' : '❌'}</div>}
            </div>
            {confirm && confirm !== password && <div style={{ fontSize: 11, color: '#ef4444', textAlign: 'right', marginTop: 4 }}>הסיסמאות אינן תואמות</div>}
          </div>

          {/* Privacy policy agreement */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, direction: 'rtl' }}>
            <button type="button"
              onClick={() => setAgreedToTerms(v => !v)}
              style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `2px solid ${agreedToTerms ? '#0d9e6e' : '#cbd5e1'}`, background: agreedToTerms ? '#0d9e6e' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', marginTop: 1, cursor: 'pointer', padding: 0 }}>
              {agreedToTerms && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </button>
            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              קראתי ואני מסכים/ה ל
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer"
                style={{ color: '#0d9e6e', fontWeight: 700, textDecoration: 'underline' }}>
                מדיניות הפרטיות
              </a>
              {' '}של Router
            </span>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 16, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading || usernameStatus === 'taken' || usernameStatus === 'checking'}
            style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 16, background: loading ? '#e2e8f0' : 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: loading ? '#94a3b8' : '#fff', fontSize: 16, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: loading ? 'none' : '0 8px 20px rgba(13,158,110,0.3)', transition: 'all 0.2s' }}>
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>יוצר חשבון...</span>
              : '🚀 יצירת חשבון'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>כבר יש לך חשבון?</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          <button onClick={() => navigate('/Login')}
            style={{ width: '100%', padding: '14px', border: '2px solid #0d9e6e', borderRadius: 16, background: '#fff', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget.style.background = '#f0fdf8'); }}
            onMouseLeave={e => { (e.currentTarget.style.background = '#fff'); }}>
            כניסה לחשבון קיים
          </button>

        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}