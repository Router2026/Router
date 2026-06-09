import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.auth.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f4f3', gap: 16, direction: 'rtl', padding: 24 }}>
      <div style={{ fontSize: 64 }}>📬</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#1a2e2a' }}>בדוק את האימייל שלך</div>
      <div style={{ fontSize: 15, color: '#64748b', textAlign: 'center', maxWidth: 320 }}>
        אם <strong>{email}</strong> רשום במערכת, שלחנו לינק לאיפוס סיסמה. הקישור תקף לשעה אחת.
      </div>
      <button onClick={() => navigate('/Login')} style={{ marginTop: 8, padding: '12px 28px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
        חזרה להתחברות
      </button>
    </div>
  );

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', direction: 'rtl' }}>
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '40px 24px 56px', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🔐</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>שכחתי סיסמה</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
          הזן את האימייל שלך ונשלח לך קישור לאיפוס הסיסמה
        </div>
      </div>

      <div style={{ maxWidth: 420, margin: '-28px auto 0', padding: '0 20px 100px', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.1)', padding: '28px 24px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="fp-email" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'right', marginBottom: 6 }}>כתובת אימייל</label>
            <input
              id="fp-email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              type="email"
              placeholder="you@example.com"
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #e2e8f0', borderRadius: 14, fontSize: 15, fontFamily: 'Heebo, sans-serif', direction: 'ltr', textAlign: 'left', outline: 'none', background: '#f8fafc', color: '#1a2e2a', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#0d9e6e')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          <button onClick={handleSubmit} disabled={loading || !email.trim()}
            style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 16, background: loading || !email.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #0f172a, #1e293b)', color: loading || !email.trim() ? '#94a3b8' : '#fff', fontSize: 16, fontWeight: 900, cursor: loading || !email.trim() ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s' }}>
            {loading ? 'שולח...' : '📧 שלח קישור לאיפוס'}
          </button>

          <button onClick={() => navigate('/Login')} style={{ width: '100%', padding: '12px', border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginTop: 10 }}>
            ← חזרה להתחברות
          </button>
        </div>
      </div>
    </div>
  );
}
