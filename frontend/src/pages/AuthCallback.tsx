import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = (import.meta.env.VITE_API_URL ?? '');

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Only allow same-origin relative paths — reject absolute URLs and protocol-relative
  // URLs (e.g. //evil.com) to prevent open-redirect phishing attacks.
  const rawFrom = searchParams.get('from') || '/';
  const from = rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/';

  useEffect(() => {
    // Supabase puts the token in the URL hash after OAuth redirect
    const hash = globalThis.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    const accessToken = params.get('access_token');

    // Supabase returns errors in the hash too
    const errorCode = params.get('error');
    const errorDesc = params.get('error_description');
    if (errorCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(`שגיאה מ-Google: ${errorDesc || errorCode}`);
      return;
    }

    if (!accessToken) {
      setError('לא התקבל אסימון כניסה מ-Google');
      return;
    }

    // Send token to our backend to upsert the user row and get back a valid app token
    fetch(`${API_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    })
      .then(r => r.json())
      .then(async data => {
        if (data.data?.token) {
          await loginWithToken(data.data.token);
          navigate(from, { replace: true });
        } else {
          throw new Error(data.error || 'Login failed');
        }
      })
      .catch(e => setError(e.message || 'שגיאה בכניסה עם Google'));
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, direction: 'rtl', fontFamily: 'Heebo, sans-serif' }}>
        <div style={{ fontSize: 40 }}>❌</div>
        <div style={{ color: '#dc2626', fontWeight: 700, fontSize: 16 }}>{error}</div>
        <button onClick={() => navigate('/Login')} style={{ padding: '12px 24px', background: '#0d9e6e', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'Heebo, sans-serif' }}>
          חזרה לכניסה
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, direction: 'rtl', fontFamily: 'Heebo, sans-serif' }}>
      <div style={{ fontSize: 40 }}>🔄</div>
      <div style={{ color: '#0d9e6e', fontWeight: 700, fontSize: 18 }}>מתחבר...</div>
      <div style={{ color: '#64748b', fontSize: 14 }}>מעבד את הכניסה עם Google</div>
    </div>
  );
}
