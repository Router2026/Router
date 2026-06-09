// src/components/XpToast.tsx
// Animated XP gain notification — appears after photo upload (or any XP event).

import { useEffect, useState } from 'react';
import type { XpResult } from '../api';

interface Props {
  xp: XpResult;
  onDone: () => void;
}

export default function XpToast({ xp, onDone }: Readonly<Props>) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 400); }, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: `translateX(-50%) translateY(${visible ? 0 : 60}px)`,
      opacity: visible ? 1 : 0, transition: 'all 0.4s cubic-bezier(.16,1,.3,1)',
      zIndex: 9999, pointerEvents: 'none',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0d9e6e, #34d399)',
        color: '#fff', borderRadius: 20, padding: '12px 24px',
        fontFamily: 'Heebo, sans-serif', direction: 'rtl',
        boxShadow: '0 8px 32px rgba(13,158,110,0.35)',
        display: 'flex', alignItems: 'center', gap: 12,
        fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 28 }}>⚡</span>
        <div>
          <div>+10 XP</div>
          {xp.leveled_up && (
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9, marginTop: 2 }}>
              🎉 עלית לרמה {xp.new_level} — {xp.level_label}!
            </div>
          )}
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>
            סה"כ: {xp.new_xp} XP
          </div>
        </div>
      </div>
    </div>
  );
}
