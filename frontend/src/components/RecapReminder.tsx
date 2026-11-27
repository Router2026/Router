// "How was it?" banner for trips the user walked in live mode but hasn't recapped yet.
// In-app only: there is no device push registration yet (see lib/notifications/push-service.ts).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearPendingRecap, listDueRecaps } from '../utils/liveTrip';

export default function RecapReminder() {
  const navigate = useNavigate();
  const [due, setDue] = useState(() => listDueRecaps());
  const r = due[0];
  if (!r) return null;

  const dismiss = () => { clearPendingRecap(r.tripId); setDue(listDueRecaps()); };

  return (
    <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fff', border: '1.5px solid #bbf7d0', borderRadius: 16, padding: '12px 14px', margin: '0 0 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', direction: 'rtl', textAlign: 'right' }}>
      <span aria-hidden="true" style={{ fontSize: 26 }}>✍️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#1a2e2a' }}>איך היה ב{r.name}?</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>דרגו את {r.done.length} העצירות שביקרתם וקבלו XP</div>
      </div>
      <button type="button" onClick={() => navigate(`/TripRecap?id=${r.tripId}`)}
        style={{ minHeight: 38, padding: '6px 14px', border: 'none', borderRadius: 12, background: '#0d9e6e', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
        לדרג
      </button>
      <button type="button" onClick={dismiss} aria-label="סגירת התזכורת"
        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
    </div>
  );
}
