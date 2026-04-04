import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const justVerified = searchParams.get('verified') === 'true';
  const justReset = searchParams.get('reset') === 'true';
  const { login, loginAsGuest } = useAuth();
  const from = (location.state as any)?.from?.pathname || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resentVerification, setResentVerification] = useState(false);

  const toHebrewError = (e: any): string => {
    const code = e.code;
    const msg = (e.message || '').toLowerCase();
    if (code === 'AUTH_ERROR' || msg.includes('invalid email or password')) return 'האימייל או הסיסמה שגויים. נסה שוב.';
    if (msg.includes('required')) return 'אנא מלא אימייל וסיסמה';
    if (code === 'DB_ERROR' || msg.includes('failed')) return 'שגיאת שרת, נסה שוב עוד רגע';
    if (msg.includes('network') || msg.includes('fetch')) return 'בעיית חיבור לאינטרנט, בדוק את הרשת שלך';
    return e.message || 'שגיאה לא ידועה';
  };

  const handleSubmit = async () => {
    setError(null);
    setUnverifiedEmail(null);
    if (!email || !password) { setError('אנא מלא אימייל וסיסמה'); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (e: any) {
      if (e.code === 'EMAIL_NOT_VERIFIED' || e.message?.includes('verify your email')) {
        setUnverifiedEmail(email.trim().toLowerCase());
      } else {
        setError(toHebrewError(e));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!SUPABASE_URL) { setError('Google login not configured'); return; }
    setGoogleLoading(true);
    setError(null);
    try {
      // Use Supabase OAuth redirect flow
      const redirectTo = `${window.location.origin}/auth/callback?from=${encodeURIComponent(from)}`;
      const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}&access_type=offline`;
      window.location.href = url;
    } catch (e: any) {
      setError('Google login failed');
      setGoogleLoading(false);
    }
  };

  const handleGuestMode = () => {
    loginAsGuest();
    navigate(from || '/', { replace: true });
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    await fetch((import.meta.env.VITE_API_URL ?? '') + '/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: unverifiedEmail }) });
    setResentVerification(true);
  };

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '14px 16px', border: '2px solid #e2e8f0',
    borderRadius: 14, fontSize: 15, fontFamily: 'Heebo, sans-serif',
    outline: 'none', background: '#f8fafc', color: '#1a2e2a',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  };

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', direction: 'rtl' }}>

      {/* Hero */}
      <div role="banner" style={{ background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', padding: '48px 24px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -40, left: -40, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div aria-hidden="true" style={{ fontSize: 44, marginBottom: 8 }}>🧭</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>Router</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', marginTop: 4 }}>גלה מסלולים ייחודיים בטבע ישראל</div>
      </div>

      <div style={{ maxWidth: 420, margin: '-28px auto 0', padding: '0 20px 100px', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.1)', padding: '28px 24px 24px' }}>

          {justVerified && (
            <div role="status" style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '10px 14px', marginBottom: 16, color: '#166534', fontWeight: 700, fontSize: 14, textAlign: 'right' }}>
              ✓ האימייל אומת בהצלחה! כעת ניתן להתחבר.
            </div>
          )}
          {justReset && (
            <div role="status" style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '10px 14px', marginBottom: 16, color: '#166534', fontWeight: 700, fontSize: 14, textAlign: 'right' }}>
              ✓ הסיסמה עודכנה בהצלחה! כעת ניתן להתחבר.
            </div>
          )}

          <h1 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', textAlign: 'right', marginBottom: 22, marginTop: 0 }}>כניסה לחשבון</h1>

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            aria-label="כניסה עם Google"
            style={{ width: '100%', padding: '13px 16px', border: '2px solid #e2e8f0', borderRadius: 14, background: '#fff', color: '#1a2e2a', fontSize: 15, fontWeight: 700, cursor: googleLoading ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16, transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'מתחבר...' : 'כניסה עם Google'}
          </button>

          {/* Divider */}
          <div role="separator" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>או עם אימייל וסיסמה</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="login-email" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right', marginBottom: 6 }}>אימייל</label>
            <input id="login-email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" type="email" autoComplete="email"
              style={{ ...inputBase, direction: 'ltr', textAlign: 'left' }}
              onFocus={e => (e.target.style.borderColor = '#0d9e6e')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right', marginBottom: 6 }}>סיסמה</label>
            <div style={{ position: 'relative' }}>
              <input id="login-password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="הכנס סיסמה" type={showPass ? 'text' : 'password'} autoComplete="current-password"
                style={{ ...inputBase, direction: 'ltr', textAlign: 'left', paddingLeft: 44 }}
                onFocus={e => (e.target.style.borderColor = '#0d9e6e')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'הסתר סיסמה' : 'הצג סיסמה'} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                {showPass
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                }
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: 'left', marginBottom: 16 }}>
            <button type="button" onClick={() => navigate('/ForgotPassword')} style={{ background: 'none', border: 'none', color: '#0d9e6e', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'Heebo, sans-serif' }}>
              שכחתי סיסמה
            </button>
          </div>

          {/* Unverified email banner */}
          {unverifiedEmail && (
            <div role="alert" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', color: '#92400e', fontSize: 13, fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
              <div>📧 האימייל שלך לא אומת עדיין.</div>
              {resentVerification
                ? <div style={{ marginTop: 6, color: '#0d9e6e' }}>✓ קישור אימות נשלח מחדש!</div>
                : <button onClick={handleResendVerification} style={{ marginTop: 6, background: 'none', border: 'none', color: '#0d9e6e', cursor: 'pointer', fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}>שלח שוב קישור אימות</button>
              }
            </div>
          )}

          {/* Error */}
          {error && (
            <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 16, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span aria-hidden="true">⚠️</span> {error}
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading}
            aria-busy={loading}
            style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 16, background: loading ? '#e2e8f0' : 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: loading ? '#94a3b8' : '#fff', fontSize: 16, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: loading ? 'none' : '0 8px 20px rgba(13,158,110,0.3)', transition: 'all 0.2s' }}>
            {loading ? 'מתחבר...' : '🔑 כניסה'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 12px' }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>אין לך חשבון?</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          {/* Register CTA */}
          <button type="button" onClick={() => navigate('/Register')}
            style={{ width: '100%', padding: '14px', border: '2px solid #0d9e6e', borderRadius: 16, background: '#fff', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            🚀 הרשמה — זה בחינם!
          </button>

          {/* Guest mode */}
          <button type="button" onClick={handleGuestMode}
            aria-label="כניסה כאורח ללא הרשמה"
            style={{ width: '100%', padding: '12px', border: '1.5px dashed #cbd5e1', borderRadius: 16, background: 'transparent', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#cbd5e1'; }}>
            👀 כניסה כאורח (ללא הרשמה)
          </button>

        </div>
      </div>
    </div>
  );
}
