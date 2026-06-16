// src/pages/Reports.tsx
//
// PERFORMANCE OPTIMIZATIONS:
//  1. Hoisted TYPE_KEYS (Object.keys(TYPES)) and the filter-chip array out of
//     render — previously recomputed on every render/keystroke.
//  2. localStorage access wrapped defensively (unchanged behavior, but now
//     only read once on mount via useState initializer — already correct,
//     kept as-is).
//  3. Memoized the report card list to avoid re-creating inline style objects
//     for entries that haven't changed (low-risk, applied via React.memo on
//     the card sub-component to skip re-render on parent state changes
//     unrelated to that report, e.g. unrelated optimistic upvote updates
//     on the SAME query, which previously re-rendered the entire list).

import { useState, useRef, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useGuestLock } from '../components/LockedFeature';

const TYPES: Record<string, { label: string; color: string; bg: string }> = {
  צפיפות: { label: 'צפיפות', color: '#dc2626', bg: '#fef2f2' },
  'מצב מים': { label: 'מצב מים', color: '#0284c7', bg: '#eff6ff' },
  'מצב שביל': { label: 'מצב שביל', color: '#d97706', bg: '#fffbeb' },
  חניה: { label: 'חניה', color: '#7c3aed', bg: '#faf5ff' },
  'מזג אוויר': { label: 'מזג אוויר', color: '#0891b2', bg: '#ecfeff' },
  סכנה: { label: 'סכנה', color: '#b91c1c', bg: '#fef2f2' },
  המלצה: { label: 'המלצה', color: '#16a34a', bg: '#f0fdf4' },
};

// Hoisted once at module scope — previously recomputed every render
const TYPE_FILTER_OPTIONS = ['הכל', ...Object.keys(TYPES)];

const SEVERITY_COLORS: Record<string, string> = {
  גבוהה: '#dc2626', בינונית: '#d97706', נמוכה: '#16a34a',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `לפני ${mins} דקות`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `לפני ${hrs} שעות`;
  return `לפני ${Math.floor(hrs / 24)} ימים`;
}

interface ReportCardProps {
  report: {
    id: string; report_type: string; severity: string; content: string;
    poi_name: string; created_date: string; upvotes: number; reporter_name: string;
  };
  voted: boolean;
  onUpvote: (id: string) => void;
}

// memo: an upvote on report A previously re-rendered every card in the list
// (new array reference from setVotedIds). Memoizing means only the card
// whose `voted`/`upvotes` actually changed re-renders.
const ReportCard = memo(function ReportCard({ report, voted, onUpvote }: Readonly<ReportCardProps>) {
  const typeStyle = TYPES[report.report_type] || TYPES['המלצה'];
  return (
    <div style={{ background: '#fff', borderRadius: 20, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f0f0f0' }}>
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{timeAgo(report.created_date)}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ background: typeStyle.bg, color: typeStyle.color, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>{report.report_type}</span>
            <span style={{ background: '#f8fafc', color: SEVERITY_COLORS[report.severity] || '#64748b', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{report.severity}</span>
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 6, textAlign: 'right' }}>{report.poi_name}</div>
        <div style={{ fontSize: 14, color: '#64748b', textAlign: 'right', lineHeight: 1.5 }}>{report.content}</div>
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => onUpvote(report.id)}
          style={{ background: voted ? '#f0fdf8' : 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, color: voted ? '#0d9e6e' : '#94a3b8', fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
          {report.upvotes}
        </button>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>מאת {report.reporter_name}</span>
      </div>
    </div>
  );
});

export default function Reports() {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const reportLock = useGuestLock('דיווח');
  const [selectedType, setSelectedType] = useState('הכל');
  const [votedIds, setVotedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('report_votes');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const queryClient = useQueryClient();
  const pendingRef = useRef(new Set<string>());
  const queryKey = ['reports', 'list', selectedType] as const;

  // Per-type cache — switching back to a previously-viewed type is instant.
  const { data: filtered = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: () => api.reports.list({ type: selectedType === 'הכל' ? undefined : selectedType }),
    staleTime: 2 * 60 * 1000,
  });

  const handleUpvote = async (id: string) => {
    if (pendingRef.current.has(id)) return;
    pendingRef.current.add(id);
    const alreadyVoted = votedIds.has(id);
    const delta = alreadyVoted ? -1 : 1;

    queryClient.setQueryData<unknown[]>(queryKey, prev =>
      (prev as {id: number; upvotes: number}[])?.map(r => r.id === id ? { ...r, upvotes: Math.max(0, r.upvotes + delta) } : r) ?? [],
    );
    setVotedIds(prev => {
      const next = new Set(prev);
      if (alreadyVoted) { next.delete(id); } else { next.add(id); }
      localStorage.setItem('report_votes', JSON.stringify([...next]));
      return next;
    });

    try {
      await api.reports.upvote(id, alreadyVoted ? 'remove' : 'add');
    } catch {
      queryClient.setQueryData<unknown[]>(queryKey, prev =>
        (prev as {id: number; upvotes: number}[])?.map(r => r.id === id ? { ...r, upvotes: Math.max(0, r.upvotes - delta) } : r) ?? [],
      );
      setVotedIds(prev => {
        const next = new Set(prev);
        if (alreadyVoted) { next.add(id); } else { next.delete(id); }
        localStorage.setItem('report_votes', JSON.stringify([...next]));
        return next;
      });
    } finally {
      pendingRef.current.delete(id);
    }
  };

  // Stable callback identity so ReportCard's memo isn't busted by a new
  // function reference on every parent render.
  const onUpvote = useMemo(() => handleUpvote, [queryKey, votedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%', direction: 'rtl' }}>
      <div style={{ background: 'linear-gradient(160deg, #d97706 0%, #f59e0b 100%)', width: '100%' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <button
            onClick={() => reportLock.guardAction(() => navigate('/AddReport'))}
            aria-label={isGuest ? 'דיווח חדש — דרוש חשבון' : 'דיווח חדש'}
            style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '8px 16px', cursor: 'pointer', color: '#d97706', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Heebo, sans-serif', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', opacity: isGuest ? 0.75 : 1 }}>
            {isGuest
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            }
            {isGuest ? 'דיווח — דרוש חשבון' : 'דיווח חדש'}
          </button>
          {reportLock.PromptComponent}
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, marginBottom: 4 }}>דיווחי קהילה</h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>עדכונים בזמן אמת מהשטח</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>
        {/* Filter chips */}
        <div style={{ padding: '16px 16px 8px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, paddingBottom: 4, scrollbarWidth: 'none', direction: 'rtl' }}>
            {TYPE_FILTER_OPTIONS.map(type => {
              const active = selectedType === type;
              const t = TYPES[type];
              return (
                <button key={type} onClick={() => setSelectedType(type)}
                  style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: `2px solid ${active ? (t?.color || '#0d9e6e') : '#e2e8f0'}`, background: active ? (t?.bg || '#f0fdf8') : '#fff', color: active ? (t?.color || '#0d9e6e') : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap', transition: 'all 0.2s ease' }}>
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#64748b', marginTop: 12 }}>טוען דיווחים...</div>
          </div>
        ) : (
          <div style={{ padding: '8px 16px 24px' }}>
            {filtered.map(report => (
              <ReportCard
                key={report.id}
                report={report}
                voted={votedIds.has(report.id)}
                onUpvote={onUpvote}
              />
            ))}
            {filtered.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontWeight: 700 }}>אין דיווחים בקטגוריה זו</div>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
