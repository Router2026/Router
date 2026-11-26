// Full-screen modal while the trip agents plan a route: their real, streamed progress
// (AgentWorkflow), plus an optional "saving" row for the follow-up save request.

import type { AgentStep } from '../api';
import AgentWorkflow from './AgentWorkflow';
import type { AgentRunState } from '../utils/agents';

export type GeneratingPhase = 'planning' | 'saving';

interface Props {
  phase: GeneratingPhase;
  keys: AgentStep[];
  state: AgentRunState;
  startedAt: number | null;
  /** Shows a last "saving the route" row (the planner saves right after planning). */
  withSaving?: boolean;
  title?: string;
  onCancel: () => void;
}

export default function RouteGeneratingOverlay({ phase, keys, state, startedAt, withSaving = false, title, onCancel }: Readonly<Props>) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="הסוכנים בונים מסלול"
      style={{
        position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, direction: 'rtl',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 24, padding: '22px 20px 18px', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', fontFamily: 'Heebo, sans-serif',
      }}>
        <AgentWorkflow
          keys={keys}
          state={state}
          startedAt={startedAt}
          title={title}
          extra={withSaving ? { label: 'שומר את המסלול', status: phase === 'saving' ? 'running' : 'pending' } : null}
        />
        {phase === 'planning' && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: '100%', marginTop: 18, padding: '11px', borderRadius: 14, border: '2px solid #e2e8f0', background: '#fff',
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
