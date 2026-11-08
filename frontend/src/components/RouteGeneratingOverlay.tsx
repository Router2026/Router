// Full-screen progress overlay shown while an AI route is generated and saved.
// The planning stages are time-based hints (the API is a single request), while
// the "saving" phase reflects the real second request.

import { useEffect, useState } from 'react';

export type GeneratingPhase = 'planning' | 'saving';

const PLANNING_STAGES: Array<{ afterMs: number; text: string }> = [
  { afterMs: 0, text: 'מאתרים מקומות מתאימים באזור' },
  { afterMs: 1500, text: 'ה-AI בוחר את העצירות שהכי מתאימות לכם' },
  { afterMs: 5000, text: 'מחשבים סדר עצירות וזמני נסיעה' },
  { afterMs: 12000, text: 'עוד רגע... מסיימים את המסלול' },
];

function planningStageIndex(elapsedMs: number): number {
  let index = 0;
  PLANNING_STAGES.forEach((s, i) => { if (elapsedMs >= s.afterMs) index = i; });
  return index;
}

interface Props {
  phase: GeneratingPhase;
  onCancel: () => void;
}

export default function RouteGeneratingOverlay({ phase, onCancel }: Readonly<Props>) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(id);
  }, []);

  const stage = planningStageIndex(elapsed);
  const steps = [...PLANNING_STAGES.slice(0, 3).map(s => s.text), 'שומרים את המסלול'];
  const activeStep = phase === 'saving' ? 3 : Math.min(stage, 2);
  const headline = phase === 'saving' ? 'שומרים את המסלול' : PLANNING_STAGES[stage].text;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="route-gen-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, direction: 'rtl',
      }}
    >
      <style>{'@keyframes routeGenSpin { to { transform: rotate(360deg); } }'}</style>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center', fontFamily: 'Heebo, sans-serif',
      }}>
        <div aria-hidden="true" style={{
          width: 52, height: 52, margin: '0 auto 16px', borderRadius: '50%',
          border: '5px solid #d1fae5', borderTopColor: '#0d9e6e', animation: 'routeGenSpin 0.9s linear infinite',
        }} />
        <h2 id="route-gen-title" style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>
          בונים לכם מסלול
        </h2>
        <p role="status" aria-live="polite" style={{ fontSize: 14, color: '#475569', margin: '0 0 20px', minHeight: 20 }}>
          {headline}
        </p>

        <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', textAlign: 'right' }}>
          {steps.map((text, i) => {
            const done = i < activeStep;
            const active = i === activeStep;
            return (
              <li key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', opacity: done || active ? 1 : 0.45 }}>
                <span aria-hidden="true" style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, fontSize: 12, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? '#0d9e6e' : active ? '#d1fae5' : '#f1f5f9',
                  color: done ? '#fff' : active ? '#0d9e6e' : '#94a3b8',
                }}>
                  {done ? '✓' : i + 1}
                </span>
                <span style={{ fontSize: 14, fontWeight: active ? 800 : 600, color: active ? '#0f172a' : '#64748b' }}>{text}</span>
              </li>
            );
          })}
        </ol>

        {phase === 'planning' && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: '100%', padding: '12px', borderRadius: 14, border: '2px solid #e2e8f0', background: '#fff',
              color: '#475569', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
            }}
          >
            ביטול
          </button>
        )}
      </div>
    </div>
  );
}
