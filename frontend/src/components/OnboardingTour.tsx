/**
 * OnboardingTour — Rich 8-step walkthrough
 * 
 * Steps cover:
 *   1. Welcome
 *   2. Discover / Explore (how to find places)
 *   3. Map view interactive walkthrough
 *   4. Trip Bucket — what it is + how to use it
 *   5. Trip Bucket — building a route from the basket
 *   6. Route/Itinerary generation step-by-step
 *   7. Community & Reports
 *   8. Guest upsell (if guest) OR "you're all set" (if registered)
 * 
 * Each step can spotlight a DOM element (via data-tour attr) or show a
 * full illustrated card in the centre of the screen.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const TOUR_KEY = 'router_onboarding_done_v2';

// ── Illustrated mini-diagram components ──────────────────────────────────────

function DiscoverIllustration() {
  return (
    <div style={{ background: 'linear-gradient(135deg, #f0fdf8, #e8f9f3)', borderRadius: 16, padding: '16px 20px', marginBottom: 16, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ background: '#6366f1', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2e2a' }}>חיפוש וסינון</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['גולן 🏔️', 'נחל 🏞️', 'קל 🟢', 'יש מים 💧'].map(tag => (
          <span key={tag} style={{ padding: '4px 10px', borderRadius: 20, background: '#0d9e6e', color: '#fff', fontSize: 11, fontWeight: 700 }}>{tag}</span>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
        סנן לפי אזור, קטגוריה, רמת קושי ומאפיינים (מים, צל, נגישות)
      </div>
    </div>
  );
}

function TripBucketIllustration() {
  const items = ['נחל דן 🏞️', 'תל דן 🏛️', 'מפלי בניאס 💧'];
  return (
    <div style={{ background: 'linear-gradient(135deg, #f0fdf8, #e8f9f3)', borderRadius: 16, padding: '14px 16px', marginBottom: 16, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ background: '#0d9e6e', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 14 }}>🎒</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#0d9e6e' }}>סל המסלול שלי</span>
        <span style={{ marginRight: 'auto', background: '#ef4444', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 800 }}>3</span>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < items.length - 1 ? '1px solid #e8f9f3' : 'none' }}>
          <span style={{ width: 22, height: 22, background: '#0d9e6e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{i + 1}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2e2a', flex: 1 }}>{item}</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>⠿</span>
        </div>
      ))}
    </div>
  );
}

function RouteStepsIllustration() {
  const steps = [
    { icon: '📍', label: 'איסוף מקומות בסל', done: true },
    { icon: '📍', label: 'פתיחת הסל 🎒', done: true },
    { icon: '🧠', label: 'AI מסדר לפי מרחק', done: false },
    { icon: '🗺️', label: 'מסלול מוכן!', done: false },
  ];
  return (
    <div style={{ background: 'linear-gradient(135deg, #f0fdf8, #e8f9f3)', borderRadius: 16, padding: '14px 16px', marginBottom: 16, direction: 'rtl' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', position: 'relative' }}>
          {i < steps.length - 1 && (
            <div style={{ position: 'absolute', right: 13, top: 28, width: 2, height: 18, background: s.done ? '#0d9e6e' : '#e2e8f0', borderRadius: 2 }} />
          )}
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.done ? '#0d9e6e' : '#f1f5f9', border: `2px solid ${s.done ? '#0d9e6e' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
            {s.done ? '✓' : s.icon}
          </div>
          <span style={{ fontSize: 12, fontWeight: s.done ? 700 : 600, color: s.done ? '#0d9e6e' : '#475569' }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Step definitions ──────────────────────────────────────────────────────────

interface Step {
  id: string;
  target: string;
  title: string;
  body: string;
  emoji: string;
  illustration?: React.ReactNode;
  guestOnly?: boolean;
  registeredOnly?: boolean;
}

const ALL_STEPS: Step[] = [
  {
    id: 'welcome',
    target: 'center',
    emoji: '🧭',
    title: 'ברוך הבא ל-Router!',
    body: 'אפליקציה לגילוי ותכנון מסלולים ייחודיים בטבע ישראל. בוא נסקור ביחד את הפיצ\'רים העיקריים — זה ייקח פחות מדקה.',
  },
  {
    id: 'discover',
    target: '[data-tour="nav-home"]',
    emoji: '🔍',
    title: 'גילוי אתרים',
    body: 'בדף הגילוי תוכל לחפש ולסנן מאות מסלולים לפי אזור, קטגוריה, רמת קושי ומאפיינים. לחץ על כל מסלול לפרטים מלאים, תמונות ודירוגים.',
    illustration: <DiscoverIllustration />,
  },
  {
    id: 'map',
    target: '[data-tour="nav-map"]',
    emoji: '🗺️',
    title: 'מפה אינטראקטיבית',
    body: 'המפה מציגה את כל המסלולים כסמנים על גבי ישראל. לחץ על אשכול סמנים כדי להתקרב, ולחץ על סמן בודד כדי לראות פרטי האתר.',
  },
  {
    id: 'bucket',
    target: '[data-tour="nav-explore"]',
    emoji: '🎒',
    title: 'סל המסלול',
    body: 'כשאתה מוצא מקום מעניין, לחץ על "+ הוספה מהירה למסלול" בכרטיסיית האתר. המקומות נשמרים בסל — כמו עגלת קניות לטיולים.',
    illustration: <TripBucketIllustration />,
  },
  {
    id: 'bucket-fab',
    target: '[data-tour="trip-bucket-fab"]',
    emoji: '🚀',
    title: 'בניית מסלול מהסל',
    body: 'לחץ על כפתור הסל הירוק (🎒) בפינה הימנית התחתונה. בשלב 1 תוכל לסדר את הסדר, ובשלב 2 ה-AI יאמץ את המקומות ויבנה מסלול אופטימלי.',
    illustration: <RouteStepsIllustration />,
  },
  {
    id: 'route-generator',
    target: '[data-tour="nav-planner"]',
    emoji: '✨',
    title: 'יצירת מסלול מאפס',
    body: 'אם אין לך מקומות ספציפיים — AI יבנה לך מסלול שלם. בחר אזור, סוג קבוצה ורמת קושי ותוך שניות תקבל מסלול מפורט עם עצירות.',
    registeredOnly: true,
  },
  {
    id: 'community',
    target: '[data-tour="nav-community"]',
    emoji: '👥',
    title: 'קהילה ודיווחים',
    body: 'ב"קהילה" תמצא מסלולים שמשתמשים שיתפו. ב"דיווחים" תוכל לדווח על מצב שבילים, חסימות ומפגעים — ולעזור למטיילים אחרים.',
  },
  {
    id: 'guest-upsell',
    target: 'center',
    emoji: '🔓',
    title: 'רוצה גישה מלאה?',
    body: 'כאורח תוכל לגלוש, לחפש ולצפות במסלולים. הרשמה חינמית פותחת: שמירת מסלולים, דיווחים, ביקורות, תמונות ועוד!',
    guestOnly: true,
  },
  {
    id: 'ready',
    target: 'center',
    emoji: '🎉',
    title: 'מוכן להתחיל!',
    body: 'כל הכלים זמינים לך. לחץ על כל מסלול לפרטים, הוסף מקומות לסל, ובנה את המסלול המושלם שלך.',
    registeredOnly: true,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingTour({ onComplete }: { onComplete?: () => void }) {
  const { isGuest } = useAuth();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Filter steps for current user type
  const steps = ALL_STEPS.filter(s => {
    if (s.guestOnly && !isGuest) return false;
    if (s.registeredOnly && isGuest) return false;
    return true;
  });

  const current = steps[step];
  const isLast = step === steps.length - 1;

  // Find DOM element to spotlight
  const calcSpotlight = useCallback(() => {
    if (!current || current.target === 'center') { setSpotlightRect(null); return; }
    const el = document.querySelector(current.target);
    if (!el) { setSpotlightRect(null); return; }
    setSpotlightRect(el.getBoundingClientRect());
  }, [current]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    calcSpotlight();
    const t = setTimeout(calcSpotlight, 120); // re-run after layout settles
    window.addEventListener('resize', calcSpotlight);
    return () => { clearTimeout(t); window.removeEventListener('resize', calcSpotlight); };
  }, [calcSpotlight]);

  // Focus trap inside the card
  useEffect(() => {
    if (visible) cardRef.current?.focus();
  }, [step, visible]);

  const next = () => isLast ? finish() : setStep(s => s + 1);
  const prev = () => setStep(s => Math.max(0, s - 1));
  const finish = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    setVisible(false);
    onComplete?.();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, visible, steps.length]);

  if (!visible || !current) return null;

  const isCentered = !spotlightRect || current.target === 'center';

  // Card positioning: above the nav bar if spotlighting nav, else centred
  const cardStyle: React.CSSProperties = isCentered
    ? { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10002 }
    : { position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 10002 };

  return (
    <>
      {/* Dim overlay */}
      <div
        aria-hidden="true"
        onClick={finish}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10000, backdropFilter: 'blur(1px)' }}
      />

      {/* Spotlight cutout */}
      {spotlightRect && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: spotlightRect.top - 6,
            left: spotlightRect.left - 6,
            width: spotlightRect.width + 12,
            height: spotlightRect.height + 12,
            borderRadius: 16,
            zIndex: 10001,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
            border: '2.5px solid rgba(13,158,110,0.8)',
            pointerEvents: 'none',
            transition: 'all 0.25s ease',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`סיור הדרכה — שלב ${step + 1} מתוך ${steps.length}: ${current.title}`}
        tabIndex={-1}
        style={{
          ...cardStyle,
          maxWidth: 360, width: 'calc(100% - 40px)',
          background: '#fff', borderRadius: 24,
          padding: '22px 20px 18px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          direction: 'rtl', outline: 'none',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {current.emoji}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#1a2e2a', lineHeight: 1.2 }}>{current.title}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>שלב {step + 1} מתוך {steps.length}</div>
          </div>
          <button
            onClick={finish}
            aria-label="סגור סיור"
            style={{ marginRight: 'auto', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Illustration */}
        {current.illustration}

        {/* Body text */}
        <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: '0 0 18px', textAlign: 'right' }}>
          {current.body}
        </p>

        {/* Progress bar */}
        <div style={{ height: 4, background: '#e8f9f3', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((step + 1) / steps.length) * 100}%`, background: 'linear-gradient(90deg, #0d9e6e, #0bba7e)', borderRadius: 4, transition: 'width 0.35s ease' }} />
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button
              onClick={prev}
              aria-label="שלב קודם"
              style={{ padding: '10px 16px', border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}
            >
              ← קודם
            </button>
          )}
          <button
            onClick={next}
            autoFocus
            aria-label={isLast ? 'סיים סיור ותתחיל' : 'שלב הבא'}
            style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: '0 4px 12px rgba(13,158,110,0.3)' }}
          >
            {isLast ? '🎉 בוא נתחיל!' : 'הבא →'}
          </button>
        </div>

        {/* Guest upsell CTA */}
        {isGuest && current.id === 'guest-upsell' && (
          <a
            href="/Register"
            style={{ display: 'block', marginTop: 10, padding: '11px', borderRadius: 12, background: '#fff', border: '2px solid #0d9e6e', color: '#0d9e6e', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', textAlign: 'center', textDecoration: 'none' }}
          >
            🚀 הרשמה חינמית עכשיו
          </a>
        )}
      </div>
    </>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useShouldShowTour() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!localStorage.getItem(TOUR_KEY)) setShow(true);
  }, []);
  return {
    show,
    markDone: () => { localStorage.setItem(TOUR_KEY, 'true'); setShow(false); },
    resetTour: () => { localStorage.removeItem(TOUR_KEY); setShow(true); },
  };
}
