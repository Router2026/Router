import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';
const DISMISSED_TTL = 7 * 24 * 60 * 60 * 1000; // re-show after 7 days

function wasDismissedRecently(): boolean {
  try {
    const ts = localStorage.getItem(DISMISSED_KEY);
    return !!ts && Date.now() - Number(ts) < DISMISSED_TTL;
  } catch { return false; }
}

function markDismissed() {
  try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* */ }
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (wasDismissedRecently()) return;

    // Already installed (standalone mode)
    const isStandalone =
      globalThis.matchMedia('(display-mode: standalone)').matches ||
      (globalThis.navigator as Record<string, unknown>).standalone === true;
    if (isStandalone) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

    if (isIos) {
      // iOS doesn't fire beforeinstallprompt — show manual instructions
      setTimeout(() => { setShowIosPrompt(true); setVisible(true); }, 3000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    globalThis.addEventListener('beforeinstallprompt', handler);
    return () => globalThis.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setVisible(false);
    else dismiss();
  };

  const dismiss = () => {
    markDismissed();
    setVisible(false);
  };

  if (!visible) return null;

  const container: React.CSSProperties = {
    position: 'fixed',
    bottom: 80, // above the nav bar
    left: 12,
    right: 12,
    zIndex: 9000,
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    padding: '16px 18px',
    direction: 'rtl',
    fontFamily: 'Heebo, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxWidth: 440,
    margin: '0 auto',
    animation: 'slideUp 0.3s ease',
  };

  if (showIosPrompt) {
    return (
      <>
        <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={container}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <button onClick={dismiss} aria-label="סגור" style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#1a2e2a', marginBottom: 2 }}>הוסף למסך הבית 📲</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>כדי להתקין את ראוטר כאפליקציה:</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc', borderRadius: 14, padding: '12px 14px' }}>
            {[
              { icon: '⬆️', text: 'לחץ על כפתור השיתוף בסרגל התחתון' },
              { icon: '➕', text: 'גלול למטה ובחר "הוסף למסך הבית"' },
              { icon: '✅', text: 'לחץ "הוסף" לאישור' },
            ].map((step, i) => (
              <div key={step.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0d9e6e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: 13, color: '#374151', flex: 1, textAlign: 'right' }}>
                  <span style={{ marginLeft: 4 }}>{step.icon}</span>{step.text}
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
            פועל ב-Safari — Chrome ב-iOS אינו תומך בהתקנה
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div style={container}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={dismiss} aria-label="סגור" style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#1a2e2a' }}>הוסף ראוטר למסך הבית</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>גישה מהירה, גם ללא אינטרנט</div>
          </div>
          <img src="/pwa-icon.jpg" alt="ראוטר" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        </div>

        <button onClick={handleInstall} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: '0 4px 14px rgba(13,158,110,0.3)' }}>
          📲 התקן אפליקציה
        </button>
      </div>
    </>
  );
}
