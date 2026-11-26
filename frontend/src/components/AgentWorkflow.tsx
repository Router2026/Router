/**
 * AgentWorkflow — the trip agents working live: one row per agent with its role while it waits,
 * a pulsing avatar and a running clock while it works, and what it found (from the server's
 * progress stream) when it's done. Used by the route planner, Smart Build and the free-text
 * planner. `useAgentRun` (hooks/useAgentRun.ts) turns stream events into the state shown here.
 */

import { useEffect, useState } from 'react';
import type { AgentStep } from '../api';
import { AGENTS, type AgentRunState, type AgentStatus } from '../utils/agents';

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} שנ׳`;

const KEYFRAMES = `
@keyframes agentPulse { 0% { box-shadow: 0 0 0 0 rgba(13,158,110,.45) } 70% { box-shadow: 0 0 0 10px rgba(13,158,110,0) } 100% { box-shadow: 0 0 0 0 rgba(13,158,110,0) } }
@keyframes agentDot { 0%, 80%, 100% { opacity: .2 } 40% { opacity: 1 } }
@keyframes agentIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) { .agent-anim { animation: none !important } }
`;

function Dots() {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', gap: 2, marginInlineStart: 4 }}>
      {[0, 1, 2].map(i => (
        <span key={i} className="agent-anim" style={{ width: 4, height: 4, borderRadius: 2, background: '#0d9e6e', animation: `agentDot 1.2s ${i * 0.15}s infinite` }} />
      ))}
    </span>
  );
}

export default function AgentWorkflow({
  keys, state, startedAt, extra, title = 'הסוכנים עובדים על המסלול שלך',
}: Readonly<{
  keys: AgentStep[];
  state: AgentRunState;
  /** When the run started; drives the total clock. null = finished. */
  startedAt: number | null;
  /** An extra last row outside the agents, e.g. saving the route. */
  extra?: { label: string; status: AgentStatus } | null;
  title?: string;
}>) {
  const anyRunning = startedAt !== null;
  const now = useNow(anyRunning);
  const done = keys.filter(k => state[k]?.status === 'done' || state[k]?.status === 'skipped').length;
  const total = keys.length + (extra ? 1 : 0);
  const progress = (done + (extra?.status === 'done' ? 1 : 0)) / total;
  const current = keys.find(k => state[k]?.status === 'running');

  return (
    <div style={{ direction: 'rtl', fontFamily: 'Heebo, sans-serif' }}>
      <style>{KEYFRAMES}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{title}</div>
        {startedAt !== null && <div style={{ fontSize: 12, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{secs(now - startedAt)}</div>}
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
        style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: '100%', width: `${Math.max(4, progress * 100)}%`, background: 'linear-gradient(90deg,#0d9e6e,#34d399)', transition: 'width .4s ease' }} />
      </div>

      <p role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {current ? `${AGENTS[current].name}: ${AGENTS[current].role}` : ''}
      </p>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {keys.map((k, i) => {
          const a = AGENTS[k];
          const st = state[k] ?? { status: 'pending' as AgentStatus };
          const running = st.status === 'running';
          const isDone = st.status === 'done';
          const skipped = st.status === 'skipped';
          const last = i === keys.length - 1 && !extra;
          return (
            <li key={k} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: last ? 0 : 12 }}>
              {!last && <span aria-hidden="true" style={{ position: 'absolute', right: 17, top: 38, bottom: 0, width: 2, background: isDone ? '#a7f3d0' : '#e2e8f0' }} />}
              <span className={running ? 'agent-anim' : undefined} aria-hidden="true" style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, position: 'relative',
                background: isDone ? '#d1fae5' : running ? '#ecfdf5' : '#f1f5f9',
                border: `2px solid ${isDone || running ? '#0d9e6e' : '#e2e8f0'}`,
                filter: st.status === 'pending' || skipped ? 'grayscale(1)' : 'none', opacity: st.status === 'pending' ? 0.6 : 1,
                animation: running ? 'agentPulse 1.6s infinite' : 'none',
              }}>
                {a.icon}
                {isDone && <span style={{ position: 'absolute', bottom: -3, left: -3, width: 16, height: 16, borderRadius: 8, background: '#0d9e6e', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>✓</span>}
              </span>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: st.status === 'pending' || skipped ? '#94a3b8' : '#0f172a' }}>
                    {a.name}{running && <Dots />}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {running && st.startedAt ? secs(now - st.startedAt) : isDone && st.ms !== undefined ? secs(st.ms) : skipped ? 'דילג' : ''}
                  </span>
                </div>
                <div key={st.status} style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 1, animation: 'agentIn .3s ease',
                  color: isDone ? '#047857' : running ? '#334155' : '#94a3b8', fontWeight: isDone ? 600 : 400 }}>
                  {isDone && st.detail ? st.detail : a.role}
                </div>
              </div>
            </li>
          );
        })}
        {extra && (
          <li style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              background: extra.status === 'done' ? '#d1fae5' : extra.status === 'running' ? '#ecfdf5' : '#f1f5f9',
              border: `2px solid ${extra.status === 'pending' ? '#e2e8f0' : '#0d9e6e'}`, opacity: extra.status === 'pending' ? 0.6 : 1 }}>💾</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: extra.status === 'pending' ? '#94a3b8' : '#0f172a' }}>
              {extra.label}{extra.status === 'running' && <Dots />}
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}
