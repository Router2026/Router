import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const TOUR_KEY = 'router_onboarding_done';

interface Step {
  target: string; // CSS selector or 'center'
  title: string;
  body: string;
  emoji: string;
  placement?: 'top' | 'bottom' | 'center';
}

const STEPS: Step[] = [
  {
    target: 'center',
    title: 'ברוך הבא ל-Router! 🧭',
    body: 'אפליקציה לגילוי מסלולים ייחודיים בטבע ישראל. בוא נסקור יחד את הפיצ\'רים העיקריים.',
    emoji: '🌿',
    placement: 'center',
  },
  {
    target: '[data-tour="nav-map"]',
    title: 'מפה אינטראקטיבית 🗺️',
    body: 'גלה מסלולים ונקודות עניין על המפה. לחץ על כל נקודה לפרטים מלאים.',
    emoji: '🗺️',
    placement: 'top',
  },
  {
    target: '[data-tour="nav-planner"]',
    title: 'מתכנן מסלול חכם 🤖',
    body: 'בחר אזור, קבוצה ורמת קושי ו-AI יבנה לך מסלול מותאם אישית תוך שניות.',
    emoji: '✨',
    placement: 'top',
  },
  {
    target: '[data-tour="nav-community"]',
    title: 'קהילה פעילה 👥',
    body: 'שתף מסלולים, קרא ביקורות וסרטוני שטח מהקהילה שלנו.',
    emoji: '👥',
    placement: 'top',
  },
  {
    target: '[data-tour="nav-reports"]',
    title: 'דיווחים בזמן אמת 🚨',
    body: 'דווח על מצב שבילים, חסימות או מפגעים — עזור למטיילים אחרים.',
    emoji: '🚨',
    placement: 'top',
  },
  {
    target: 'center',
    title: 'מוכן להתחיל! 🎉',
    body: 'כל הכלים זמינים לך. לחץ על כל מסלול לפרטים, דירוגים ותמונות מהשטח.',
    emoji: '🎉',
    placement: 'center',
  },
];

interface TooltipPos { top: number; left: number; width: number; }

export default function OnboardingTour({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const current = STEPS[step];

  const calcPos = useCallback(() => {
    if (current.placement === 'center' || current.target === 'center') {
      setPos(null);
      return;
    }
    const el = document.querySelector(current.target);
    if (!el) { setPos(null); return; }
    const r = el.getBoundingClientRect();
    setPos({ top: r.top, left: r.left, width: r.width });
  }, [step, current]);

  useEffect(() => {
    calcPos();
    window.addEventListener('resize', calcPos);
    return () => window.removeEventListener('resize', calcPos);
  }, [calcPos]);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      finish();
    }
  };
  const prev = () => setStep(s => Math.max(0, s - 1));
  const finish = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    setVisible(false);
    onComplete?.();
  };

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, visible]);

  if (!visible) return null;

  const isCentered = !pos || current.placement === 'center';

  const tooltipStyle: React.CSSProperties = isCentered
    ? {
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
        maxWidth: 340, width: 'calc(100% - 48px)',
      }
    : {
        position: 'fixed',
        bottom: 90,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10001,
        maxWidth: 340, width: 'calc(100% - 48px)',
      };

  return (
    <div ref={overlayRef} aria-modal="true" role="dialog" aria-label="סיור הדרכה" aria-live="polite">
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000 }}
        onClick={finish}
        aria-hidden="true"
      />

      {/* Spotlight on nav item (if applicable) */}
      {pos && (
        <div style={{ position: 'fixed', top: pos.top - 4, left: pos.left - 4, width: pos.width + 8, height: 52, borderRadius: 14, boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)', zIndex: 10000, pointerEvents: 'none' }} aria-hidden="true" />
      )}

      {/* Tooltip card */}
      <div style={{ ...tooltipStyle, background: '#fff', borderRadius: 20, padding: '24px 22px 18px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', direction: 'rtl' }}>
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 10 }} aria-hidden="true">{current.emoji}</div>
        <h3 style={{ fontSize: 17, fontWeight: 900, color: '#1a2e2a', textAlign: 'center', marginBottom: 8, marginTop: 0 }}>{current.title}</h3>
        <p style={{ fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 1.65, marginBottom: 20 }}>{current.body}</p>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }} aria-label={`שלב ${step + 1} מתוך ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 20 : 7, height: 7, borderRadius: 4, background: i === step ? '#0d9e6e' : '#e2e8f0', transition: 'all 0.3s' }} aria-hidden="true" />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {step > 0 && (
            <button onClick={prev} aria-label="שלב קודם" style={{ padding: '10px 16px', border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
              ← הקודם
            </button>
          )}
          <button
            onClick={next}
            autoFocus={step === 0}
            aria-label={step === STEPS.length - 1 ? 'סיים את הסיור' : 'שלב הבא'}
            style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}
          >
            {step === STEPS.length - 1 ? '🎉 בוא נתחיל!' : 'הבא →'}
          </button>
        </div>

        <button onClick={finish} aria-label="דלג על הסיור" style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
          דלג
        </button>
      </div>
    </div>
  );
}

/** Hook — returns true the first time a user logs in or enters guest mode */
export function useShouldShowTour() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) setShow(true);
  }, []);
  return { show, markDone: () => { localStorage.setItem(TOUR_KEY, 'true'); setShow(false); } };
}
