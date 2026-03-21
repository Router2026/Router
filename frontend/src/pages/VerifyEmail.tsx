import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

type Status = 'loading' | 'success' | 'expired' | 'invalid' | 'no_token';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { loginWithToken } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('no_token'); return; }

    api.auth.verifyEmail(token)
      .then(async () => {
        navigate('/Login?verified=true', { replace: true });
      })
      .catch((err: any) => {
        if (err.message?.includes('expired')) setStatus('expired');
        else setStatus('invalid');
      });
  }, []);

  const handleResend = async () => {
    if (!email.trim()) return;
    await api.auth.resendVerification(email.trim().toLowerCase());
    setResent(true);
  };

  const card = (icon: string, title: string, body: React.ReactNode) => (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f4f3', gap: 16, direction: 'rtl', padding: 24 }}>
      <div style={{ fontSize: 64 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#1a2e2a', textAlign: 'center' }}>{title}</div>
      {body}
    </div>
  );

  if (status === 'loading') return card('⏳', 'מאמת את החשבון שלך...', <div style={{ color: '#94a3b8' }}>רק רגע</div>);

  if (status === 'expired') return card('⏰', 'הקישור פג תוקף', (
    <>
      <div style={{ color: '#64748b', textAlign: 'center', maxWidth: 300 }}>
        קישור האימות תקף ל-24 שעות בלבד. הזן את האימייל שלך לקבלת קישור חדש:
      </div>
      {resent ? (
        <div style={{ color: '#0d9e6e', fontWeight: 700 }}>✓ קישור חדש נשלח! בדוק את תיבת הדואר שלך.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com"
            style={{ padding: '12px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 14, direction: 'ltr', textAlign: 'left', fontFamily: 'Heebo, sans-serif' }} />
          <button onClick={handleResend} style={{ padding: '12px', background: '#0d9e6e', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
            שלח קישור חדש
          </button>
        </div>
      )}
      <button onClick={() => navigate('/Login')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>חזרה להתחברות</button>
    </>
  ));

  // invalid or no_token
  return card('❌', 'קישור לא תקין', (
    <>
      <div style={{ color: '#64748b', textAlign: 'center', maxWidth: 300 }}>
        הקישור אינו תקין. נסה להירשם מחדש או בקש קישור חדש.
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => navigate('/Register')} style={{ padding: '10px 20px', background: '#0d9e6e', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>הרשמה</button>
        <button onClick={() => navigate('/Login')} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>כניסה</button>
      </div>
    </>
  ));
}
