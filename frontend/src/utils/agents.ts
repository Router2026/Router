// The trip agents as the UI presents them (components/AgentWorkflow.tsx), and which run where.

import type { AgentStep } from '../api';

export interface AgentDef { name: string; role: string; icon: string }

export const AGENTS: Record<AgentStep, AgentDef> = {
  intent:     { icon: '🧠', name: 'סוכן ההבנה',   role: 'מבין מה ביקשת: אזור, תאריך, סגנון וקצב' },
  search:     { icon: '🔎', name: 'סוכן החיפוש',  role: 'מחפש במאגר מקומות שמתאימים לבקשה' },
  conditions: { icon: '🌤️', name: 'סוכן התנאים',  role: 'בודק תחזית, חום, שיטפונות ושעת שקיעה' },
  planner:    { icon: '🗺️', name: 'סוכן התכנון',  role: 'קובע סדר, שעות וזמני נסיעה' },
  review:     { icon: '🧐', name: 'סוכן הביקורת', role: 'בודק שהתוכנית באמת עונה לבקשה' },
  summary:    { icon: '✍️', name: 'סוכן ההסבר',   role: 'כותב למה בנה ככה, וטיפים לכל עצירה' },
  fallback:   { icon: '🛟', name: 'תכנון גיבוי',  role: 'בונה מסלול מהיר מהמקומות המומלצים באזור' },
};

/** The form planner skips intent (the form already says what you want). */
export const FORM_AGENTS: AgentStep[] = ['search', 'conditions', 'planner', 'review', 'summary'];
export const FREE_TEXT_AGENTS: AgentStep[] = ['intent', ...FORM_AGENTS];
/** Smart Build: the user picked the places, so no search or review. */
export const SMART_BUILD_AGENTS: AgentStep[] = ['conditions', 'planner', 'summary'];

export type AgentStatus = 'pending' | 'running' | 'done' | 'skipped';
export interface AgentRowState { status: AgentStatus; detail?: string; startedAt?: number; ms?: number }
export type AgentRunState = Partial<Record<AgentStep, AgentRowState>>;
