// src/pages/Invite.tsx — where a WhatsApp invite link lands (/invite/:token).
// Shows which trip it is without signing in; joining needs an account, so a signed-out
// visitor goes to Login and comes back here.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, type InvitePreview } from '../api';
import { useAuth } from '../context/AuthContext';

const btn: React.CSSProperties = { width: '100%', minHeight: 50, border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' };

export default function Invite() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isGuest, isLoading } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'joining'>('loading');

  useEffect(() => {
    api.collab.previewInvite(token)
      .then(p => { setPreview(p); setStatus('ready'); })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const signedIn = !!user && !isGuest;

  const join = async () => {
    if (!signedIn) {
      navigate('/Login', { state: { from: location } });
      return;
    }
    setStatus('joining');
    try {
      const routeId = await api.collab.acceptInvite(token);
      navigate(`/TripDetail?id=${routeId}`, { replace: true });
    } catch {
      setStatus('invalid');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0d9e6e 0%, #0bba7e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, direction: 'rtl', fontFamily: 'Heebo, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '28px 22px', width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }}>
        {status === 'loading' || isLoading ? (
          <div style={{ color: '#94a3b8' }}>טוען...</div>
        ) : status === 'invalid' || !preview ? (
          <>
            <div style={{ fontSize: 40 }}>🔗</div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a', margin: '8px 0' }}>הקישור כבר לא פעיל</h1>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>ייתכן שהמארגן/ת יצר/ה קישור חדש או ביטל/ה אותו. בקשו קישור עדכני.</p>
            <button type="button" onClick={() => navigate('/')} style={{ ...btn, background: '#f1f5f9', color: '#334155', marginTop: 12 }}>לדף הבית</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40 }}>👥</div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{preview.owner_name} מזמין/ה אתכם לתכנן ביחד</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1a2e2a', margin: '6px 0 4px' }}>{preview.name}</h1>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 18 }}>
              {[preview.region, `${preview.stops} עצירות`].filter(Boolean).join(' · ')}
            </div>
            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, marginBottom: 18 }}>אחרי ההצטרפות תוכלו להציע מקומות לטיול ולהצביע על ההצעות של כולם.</p>
            <button type="button" onClick={join} disabled={status === 'joining'} style={{ ...btn, background: '#0d9e6e', color: '#fff' }}>
              {status === 'joining' ? 'מצטרפים…' : signedIn ? 'הצטרפות לטיול' : 'התחברות והצטרפות'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
