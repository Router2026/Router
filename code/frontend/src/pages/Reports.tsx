import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '../api';

const TYPES: Record<string, { label: string; color: string; bg: string }> = {
  צפיפות: { label: 'צפיפות', color: '#dc2626', bg: '#fef2f2' },
  'מצב מים': { label: 'מצב מים', color: '#0284c7', bg: '#eff6ff' },
  'מצב שביל': { label: 'מצב שביל', color: '#d97706', bg: '#fffbeb' },
  חניה: { label: 'חניה', color: '#7c3aed', bg: '#faf5ff' },
  'מזג אוויר': { label: 'מזג אוויר', color: '#0891b2', bg: '#ecfeff' },
  סכנה: { label: 'סכנה', color: '#b91c1c', bg: '#fef2f2' },
  המלצה: { label: 'המלצה', color: '#16a34a', bg: '#f0fdf4' },
};

const SEVERITY_COLORS: Record<string, string> = {
  גבוהה: '#dc2626',
  בינונית: '#d97706',
  נמוכה: '#16a34a',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `לפני ${mins} דקות`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `לפני ${hrs} שעות`;
  return `לפני ${Math.floor(hrs / 24)} ימים`;
}

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState('הכל');
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    base44.entities.CommunityReport.filter().then(data => setReports(data));
  }, []);

  const filtered = selectedType === 'הכל' ? reports : reports.filter(r => r.report_type === selectedType);

  const handleUpvote = async (id: string, currentUpvotes: number) => {
    if (votedIds.has(id)) return;
    await base44.entities.CommunityReport.update(id, { upvotes: currentUpvotes + 1 });
    setReports(prev => prev.map(r => r.id === id ? { ...r, upvotes: r.upvotes + 1 } : r));
    setVotedIds(prev => new Set(prev).add(id));
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%', direction: 'rtl' }}>

      {/* ── Header (Full Width) ── */}
      <div style={{
        background: 'linear-gradient(160deg, #d97706 0%, #f59e0b 100%)',
        width: '100%'
      }}>
        {/* Header Content (Centered) */}
        <div style={{
          maxWidth: 600, margin: '0 auto',
          padding: '48px 20px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <button
            onClick={() => navigate('/AddReport')}
            style={{
              background: '#fff', border: 'none', borderRadius: 12,
              padding: '8px 16px', cursor: 'pointer',
              color: '#d97706', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'Heebo, sans-serif',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            דיווח חדש
          </button>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, marginBottom: 4 }}>דיווחי קהילה</h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>עדכונים בזמן אמת מהשטח</p>
          </div>
        </div>
      </div>

      {/* ── Main Content Container (Centered) ── */}
      <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>

        {/* Filter Chips */}
        <div style={{ padding: '16px 16px 8px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, paddingBottom: 4, scrollbarWidth: 'none', direction: 'rtl' }}>
            {['הכל', ...Object.keys(TYPES)].map(type => {
              const active = selectedType === type;
              const t = TYPES[type];
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                    border: `2px solid ${active ? (t?.color || '#0d9e6e') : '#e2e8f0'}`,
                    background: active ? (t?.bg || '#f0fdf8') : '#fff',
                    color: active ? (t?.color || '#0d9e6e') : '#64748b',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Report Cards */}
        <div style={{ padding: '8px 16px 24px' }}>
          {filtered.map(report => {
            const typeStyle = TYPES[report.report_type] || TYPES['המלצה'];
            return (
              <div key={report.id} style={{
                background: '#fff', borderRadius: 20, marginBottom: 12,
                boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden',
                border: '1px solid #f0f0f0',
              }}>
                <div style={{ padding: '16px 16px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{timeAgo(report.created_date)}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{
                        background: typeStyle.bg, color: typeStyle.color,
                        borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 800,
                      }}>{report.report_type}</span>
                      <span style={{
                        background: '#f8fafc', color: SEVERITY_COLORS[report.severity] || '#64748b',
                        borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                      }}>{report.severity}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 6, textAlign: 'right' }}>
                    {report.poi_name}
                  </div>
                  <div style={{ fontSize: 14, color: '#64748b', textAlign: 'right', lineHeight: 1.5 }}>
                    {report.content}
                  </div>
                </div>
                <div style={{
                  padding: '10px 16px', borderTop: '1px solid #f8fafc',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <button
                    onClick={() => handleUpvote(report.id, report.upvotes)}
                    style={{
                      background: votedIds.has(report.id) ? '#f0fdf8' : 'none',
                      border: 'none', cursor: 'pointer', padding: '6px 12px',
                      borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6,
                      color: votedIds.has(report.id) ? '#0d9e6e' : '#94a3b8',
                      fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, sans-serif',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={votedIds.has(report.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                    {report.upvotes}
                  </button>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>מאת {report.reporter_name}</span>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 700 }}>אין דיווחים בקטגוריה זו</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}