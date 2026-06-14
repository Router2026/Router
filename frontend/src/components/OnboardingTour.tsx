/**
 * OnboardingTour — Rich 9-step walkthrough
 *
 * Centering strategy: a full-screen fixed wrapper div uses
 * flexbox to centre the card — no translate hacks, no dialog
 * element (which has browser-native margin:auto that fights
 * fixed positioning on mobile Safari / Android WebView).
 *
 * Illustrations are compact and scroll-safe: maxHeight on the
 * card + overflowY:auto handles very small phones.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const TOUR_KEY = 'router_onboarding_done_v3';

const GREEN = '#0d9e6e';
const GREEN_LIGHT = '#e8f9f3';
const GREEN_GRAD = 'linear-gradient(135deg, #0d9e6e, #0bba7e)';

// ── Shared illustration wrapper ───────────────────────────────────────────────
function IllustrationCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, #f0fdf8, ${GREEN_LIGHT})`,
      borderRadius: 14, padding: '12px 14px', marginBottom: 14, direction: 'rtl',
    }}>
      {children}
    </div>
  );
}

// ── Illustrations ─────────────────────────────────────────────────────────────
function WhatInsideIllustration() {
  const items = [
    { icon: '🗺️', label: 'מאות מסלולי טבע וטיול' },
    { icon: '📍', label: 'אתרים לפי מיקום וקטגוריה' },
    { icon: '🎒', label: 'בנאי מסלול אישי חכם' },
    { icon: '👥', label: 'קהילה ודיווחים בזמן אמת' },
  ];
  return (
    <IllustrationCard>
      {items.map((item, i) => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 0',
          borderBottom: i < items.length - 1 ? `1px solid ${GREEN_LIGHT}` : 'none',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a2e2a' }}>{item.label}</span>
        </div>
      ))}
    </IllustrationCard>
  );
}

function DiscoverIllustration() {
  return (
    <IllustrationCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ background: '#6366f1', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e2a' }}>חיפוש וסינון</span>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
        {['גולן 🏔️', 'נחל 🏞️', 'קל 🟢', 'יש מים 💧', 'נגיש ♿'].map(tag => (
          <span key={tag} style={{ padding: '3px 8px', borderRadius: 20, background: GREEN, color: '#fff', fontSize: 10, fontWeight: 700 }}>{tag}</span>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
        סנן לפי אזור, קטגוריה, רמת קושי ומאפיינים — כדי למצוא בדיוק מה שמחפשים.
      </div>
    </IllustrationCard>
  );
}

function ProximityIllustration() {
  const places = [
    { name: 'נחל עמוד', dist: '3.2 ק"מ', color: GREEN },
    { name: 'מפל טנור', dist: '7.8 ק"מ', color: '#0bba7e' },
    { name: 'עין אפק', dist: '14.1 ק"מ', color: '#94a3b8' },
  ];
  return (
    <IllustrationCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>📡</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e2a' }}>מיון לפי מרחק ממך</span>
      </div>
      {places.map((p, i) => (
        <div key={p.name} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
          borderBottom: i < places.length - 1 ? `1px solid ${GREEN_LIGHT}` : 'none',
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: p.color, minWidth: 14 }}>{i + 1}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#1a2e2a', flex: 1 }}>{p.name}</span>
          <span style={{ fontSize: 10, color: p.color, fontWeight: 700 }}>📍 {p.dist}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: 10, color: '#64748b' }}>
        המיקום שלך לא נשמר — משמש רק למיון בזמן אמת.
      </div>
    </IllustrationCard>
  );
}

function AddPlaceIllustration() {
  const fields = ['שם המקום', 'קטגוריה', 'מיקום על המפה', 'תמונות'];
  return (
    <IllustrationCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ background: GREEN, borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e2a' }}>הוספת אתר חדש</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {fields.map(f => (
          <div key={f} style={{ padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${GREEN}`, color: GREEN, fontSize: 10, fontWeight: 700 }}>
            {f}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
        כל אחד יכול לתרום אתר לקהילה. לאחר אישור מנהל — יופיע לכולם.
      </div>
    </IllustrationCard>
  );
}

function TripBucketIllustration() {
  const items = ['נחל דן 🏞️', 'תל דן 🏛️', 'מפלי בניאס 💧'];
  return (
    <IllustrationCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ background: GREEN, borderRadius: 7, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 13 }}>🎒</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: GREEN }}>סל המסלול שלי</span>
        <span style={{ marginRight: 'auto', background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>3</span>
      </div>
      {items.map((item, i) => (
        <div key={item} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
          borderBottom: i < items.length - 1 ? `1px solid ${GREEN_LIGHT}` : 'none',
        }}>
          <span style={{ width: 20, height: 20, background: GREEN, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>{i + 1}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#1a2e2a', flex: 1 }}>{item}</span>
        </div>
      ))}
    </IllustrationCard>
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
    <IllustrationCard>
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', position: 'relative' }}>
          {i < steps.length - 1 && (
            <div style={{ position: 'absolute', right: 11, top: 26, width: 2, height: 16, background: s.done ? GREEN : '#e2e8f0', borderRadius: 2 }} />
          )}
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: s.done ? GREEN : '#f1f5f9', border: `2px solid ${s.done ? GREEN : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>
            {s.done ? '✓' : s.icon}
          </div>
          <span style={{ fontSize: 11, fontWeight: s.done ? 700 : 600, color: s.done ? GREEN : '#475569' }}>{s.label}</span>
        </div>
      ))}
    </IllustrationCard>
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
    id: 'welcome', target: 'center', emoji: '🧭',
    title: 'ברוך הבא ל-Router!',
    body: 'Router היא אפליקציה לגילוי ותכנון מסלולים ייחודיים בטבע ישראל. תמצא כאן מאות אתרים, מפה אינטראקטיבית, תכנון מסלול חכם וקהילה פעילה. הסיור ייקח פחות מדקה.',
    illustration: <WhatInsideIllustration />,
  },
  {
    id: 'discover', target: '[data-tour="nav-home"]', emoji: '🔍',
    title: 'גילוי אתרים',
    body: 'בדף הגילוי תוכל לחפש ולסנן מאות מסלולים לפי אזור, קטגוריה, רמת קושי ומאפיינים (מים, צל, נגישות). לחץ על כל מסלול לפרטים מלאים, תמונות ודירוגים.',
    illustration: <DiscoverIllustration />,
  },
  {
    id: 'proximity', target: '[data-tour="nav-home"]', emoji: '📡',
    title: 'מיון לפי מרחק',
    body: 'לחץ על "מיין לפי מרחק" כדי לראות קודם את המקומות הקרובים אליך. האפליקציה משתמשת במיקומך הנוכחי כדי למיין את התוצאות — ללא שמירת נתונים.',
    illustration: <ProximityIllustration />,
  },
  {
    id: 'add-place', target: '[data-tour="nav-contribute"]', emoji: '➕',
    title: 'הוספת מקום חדש',
    body: 'מכיר מקום מדהים שלא מופיע? לחץ על "הוספת אתר" ומלא את הפרטים — שם, קטגוריה, מיקום ותמונות. לאחר אישור מנהל האתר יופיע לכל הקהילה.',
    illustration: <AddPlaceIllustration />,
  },
  {
    id: 'map', target: '[data-tour="nav-map"]', emoji: '🗺️',
    title: 'מפה אינטראקטיבית',
    body: 'המפה מציגה את כל האתרים כסמנים על פני ישראל. לחץ על אשכול סמנים כדי להתקרב, ועל סמן בודד כדי לראות פרטי האתר — ישירות מהמפה.',
  },
  {
    id: 'bucket', target: '[data-tour="nav-explore"]', emoji: '🎒',
    title: 'סל המסלול',
    body: 'כשתמצא מקום מעניין, לחץ על "הוספה למסלול" בכרטיסיית האתר. המקומות נשמרים בסל — כמו עגלת קניות לטיולים — עד שתהיה מוכן לבנות את המסלול.',
    illustration: <TripBucketIllustration />,
  },
  {
    id: 'bucket-fab', target: '[data-tour="trip-bucket-fab"]', emoji: '🚀',
    title: 'בניית מסלול מהסל',
    body: 'לחץ על כפתור הסל הירוק (🎒) בפינה הימנית התחתונה. בשלב 1 תוכל לסדר את הסדר, ובשלב 2 ה-AI יאמץ את המקומות ויבנה מסלול אופטימלי.',
    illustration: <RouteStepsIllustration />,
  },
  {
    id: 'community', target: '[data-tour="nav-community"]', emoji: '👥',
    title: 'קהילה ודיווחים',
    body: 'ב"קהילה" תמצא מסלולים שמשתמשים שיתפו. ב"דיווחים" תוכל לדווח על מצב שבילים, חסימות ומפגעים — ולעזור למטיילים אחרים בזמן אמת.',
  },
  {
    id: 'guest-upsell', target: 'center', emoji: '🔓',
    title: 'רוצה גישה מלאה?',
    body: 'כאורח תוכל לגלוש, לחפש ולצפות במסלולים. הרשמה חינמית פותחת: שמירת מסלולים, הוספת אתרים, דיווחים, ביקורות, תמונות ועוד!',
    guestOnly: true,
  },
  {
    id: 'ready', target: 'center', emoji: '🎉',
    title: 'מוכן להתחיל!',
    body: 'כל הכלים זמינים לך. גלה אתרים, מיין לפי מרחק, הוסף מקומות לסל — ובנה את המסלול המושלם שלך.',
    registeredOnly: true,
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingTour({ onComplete }: Readonly<{ onComplete?: () => void }>) {
  const { isGuest } = useAuth();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const steps = ALL_STEPS.filter(s => {
    if (s.guestOnly && !isGuest) return false;
    if (s.registeredOnly && isGuest) return false;
    return true;
  });

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const calcSpotlight = useCallback(() => {
    if (!current || current.target === 'center') { setSpotlightRect(null); return; }
    const el = document.querySelector(current.target);
    if (!el) { setSpotlightRect(null); return; }
    setSpotlightRect(el.getBoundingClientRect());
  }, [current]);

  useEffect(() => {
    calcSpotlight();
    const t = setTimeout(calcSpotlight, 120);
    globalThis.addEventListener('resize', calcSpotlight);
    return () => { clearTimeout(t); globalThis.removeEventListener('resize', calcSpotlight); };
  }, [calcSpotlight]);

  useEffect(() => {
    if (visible) cardRef.current?.focus();
  }, [step, visible]);

  const next = () => (isLast ? finish() : setStep(s => s + 1));
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
    globalThis.addEventListener('keydown', handler);
    return () => globalThis.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visible, steps.length]);

  if (!visible || !current) return null;

  return (
    <>
      {/*
        ── Centering architecture ────────────────────────────────────────────
        We use a full-viewport flex wrapper instead of translate(-50%,-50%)
        on a <dialog>. The <dialog> element carries browser-native
        `margin: auto` and positioning context that fights `position:fixed`
        on mobile Safari and older Android WebView — producing off-center
        or partially-offscreen cards. A plain div wrapper with
        `display:flex; align-items:center; justify-content:center`
        is the most robust cross-browser centering primitive and needs
        no JavaScript measurement at all.
      */}

      {/* Full-screen dim overlay — click to dismiss */}
      <div
        aria-hidden="true"
        onClick={finish}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(1px)',
        }}
      />

      {/* Spotlight ring around the target nav element */}
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

      {/*
        Flex wrapper — this is what actually centres the card.
        pointer-events:none so the overlay click-to-dismiss still
        works; the card re-enables pointer events for itself.
      */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 10002,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',           // breathing room on all sides
          pointerEvents: 'none',     // let overlay clicks fall through
          boxSizing: 'border-box',
        }}
      >
        {/* Card */}
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-label={`סיור הדרכה — שלב ${step + 1} מתוך ${steps.length}: ${current.title}`}
          tabIndex={-1}
          style={{
            pointerEvents: 'auto',   // re-enable for the card itself
            width: '100%',
            maxWidth: 380,
            // Never taller than the visible viewport with 32px breathing room
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
            background: '#fff',
            borderRadius: 22,
            padding: '20px 18px 16px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
            direction: 'rtl',
            outline: 'none',
            fontFamily: 'Heebo, sans-serif',
            // Smooth entrance
            animation: 'tourCardIn 0.22s ease',
          }}
        >
          <style>{`
            @keyframes tourCardIn {
              from { opacity: 0; transform: scale(0.96) translateY(8px); }
              to   { opacity: 1; transform: scale(1)    translateY(0);    }
            }
          `}</style>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 13,
              background: GREEN_GRAD,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 21, flexShrink: 0,
            }}>
              {current.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#1a2e2a', lineHeight: 1.2 }}>{current.title}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>שלב {step + 1} מתוך {steps.length}</div>
            </div>
            <button
              onClick={finish}
              aria-label="סגור סיור"
              style={{
                background: '#f1f5f9', border: 'none', borderRadius: '50%',
                width: 28, height: 28, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#64748b', fontSize: 13, flexShrink: 0,
                // Minimum 44×44 tap target via padding
                padding: 8, margin: -8,
              }}
            >
              ✕
            </button>
          </div>

          {/* ── Illustration ── */}
          {current.illustration}

          {/* ── Body ── */}
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: '0 0 16px', textAlign: 'right' }}>
            {current.body}
          </p>

          {/* ── Progress bar ── */}
          <div style={{ height: 4, background: GREEN_LIGHT, borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${((step + 1) / steps.length) * 100}%`,
              background: GREEN_GRAD, borderRadius: 4,
              transition: 'width 0.35s ease',
            }} />
          </div>

          {/* ── Navigation ── */}
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                onClick={prev}
                aria-label="שלב קודם"
                style={{
                  padding: '11px 15px',
                  border: '1.5px solid #e2e8f0', borderRadius: 12,
                  background: '#fff', color: '#64748b',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                  // 44px min tap height
                  minHeight: 44,
                }}
              >
                ← קודם
              </button>
            )}
            <button
              onClick={next}
              autoFocus
              aria-label={isLast ? 'סיים סיור ותתחיל' : 'שלב הבא'}
              style={{
                flex: 1, padding: '11px',
                border: 'none', borderRadius: 12,
                background: GREEN_GRAD, color: '#fff',
                fontSize: 14, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'Heebo, sans-serif',
                boxShadow: '0 4px 12px rgba(13,158,110,0.3)',
                minHeight: 44,
              }}
            >
              {isLast ? '🎉 בוא נתחיל!' : 'הבא →'}
            </button>
          </div>

          {/* ── Guest upsell CTA ── */}
          {isGuest && current.id === 'guest-upsell' && (
            <a
              href="/Register"
              style={{
                display: 'block', marginTop: 10, padding: '11px',
                borderRadius: 12, background: '#fff',
                border: `2px solid ${GREEN}`, color: GREEN,
                fontSize: 13, fontWeight: 800,
                fontFamily: 'Heebo, sans-serif',
                textAlign: 'center', textDecoration: 'none',
                minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              } as React.CSSProperties}
            >
              🚀 הרשמה חינמית עכשיו
            </a>
          )}
        </div>
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