import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) { setError('אנא מלא אימייל וסיסמה'); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Navigate to the home page instead of the previous history page
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
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
      <div style={{ background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', padding: '48px 24px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, left: -40, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ fontSize: 44, marginBottom: 8 }}>🧭</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>Router</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', marginTop: 4 }}>גלה מסלולים ייחודיים בטבע ישראל</div>
      </div>

      <div style={{ maxWidth: 420, margin: '-28px auto 0', padding: '0 20px 100px', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.1)', padding: '28px 24px 24px' }}>

          <div style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', textAlign: 'right', marginBottom: 22 }}>כניסה לחשבון</div>

          {/* Email */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right', marginBottom: 6 }}>אימייל</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" type="email"
              style={{ ...inputBase, direction: 'ltr', textAlign: 'left' }}
              onFocus={e => (e.target.style.borderColor = '#0d9e6e')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right', marginBottom: 6 }}>סיסמה</label>
            <div style={{ position: 'relative' }}>
              <input value={password} onChange={e => setPassword(e.target.value)}
                placeholder="הכנס סיסמה" type={showPass ? 'text' : 'password'}
                style={{ ...inputBase, direction: 'ltr', textAlign: 'left', paddingLeft: 44 }}
                onFocus={e => (e.target.style.borderColor = '#0d9e6e')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />

              {/* Added type="button" to prevent default submit behavior */}
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                {showPass
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                }
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 16, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading}
            style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 16, background: loading ? '#e2e8f0' : 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: loading ? '#94a3b8' : '#fff', fontSize: 16, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: loading ? 'none' : '0 8px 20px rgba(13,158,110,0.3)', transition: 'all 0.2s' }}>
            {loading ? 'מתחבר...' : '🔑 כניסה'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>אין לך חשבון?</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          {/* Register CTA */}
          <button type="button" onClick={() => navigate('/Register')}
            style={{ width: '100%', padding: '14px', border: '2px solid #0d9e6e', borderRadius: 16, background: '#fff', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            🚀 הרשמה — זה בחינם!
          </button>

          <button type="button" onClick={() => navigate(-1)}
            style={{ width: '100%', padding: '10px', border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginTop: 6 }}>
            המשך ללא התחברות
          </button>
        </div>

        {/* Demo hint */}
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#94a3b8', background: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          🧪 <strong>דמו:</strong> demo@router.app / demo1234
        </div>
      </div>
    </div>
  );
}