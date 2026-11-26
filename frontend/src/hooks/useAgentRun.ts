// Turns the agents' progress stream into per-agent state for AgentWorkflow.

import { useCallback, useState } from 'react';
import type { AgentStep, AgentStepEvent } from '../api';
import type { AgentRunState } from '../utils/agents';

export function useAgentRun(keys: AgentStep[]) {
  const [state, setState] = useState<AgentRunState>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const reset = useCallback(() => { setState({}); setStartedAt(Date.now()); }, []);
  const stop = useCallback(() => setStartedAt(null), []);

  const onStep = useCallback((e: AgentStepEvent) => {
    setState(prev => {
      const next = { ...prev };
      if (e.step === 'fallback' && e.phase === 'start') {
        // The agents gave up: whatever didn't finish is skipped, the backup planner takes over.
        for (const k of keys) if (next[k]?.status !== 'done') next[k] = { status: 'skipped' };
      }
      const now = Date.now();
      if (e.phase === 'start') next[e.step] = { status: 'running', startedAt: now };
      else next[e.step] = { status: 'done', detail: e.detail, ms: prev[e.step]?.startedAt ? now - prev[e.step]!.startedAt! : undefined };
      return next;
    });
  }, [keys]);

  const visible: AgentStep[] = state.fallback ? [...keys, 'fallback'] : keys;
  return { state, onStep, reset, stop, startedAt, visible };
}
