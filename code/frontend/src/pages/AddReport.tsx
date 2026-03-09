import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '../api';

const REPORT_TYPES = ['צפיפות', 'מצב מים', 'מצב שביל', 'חניה', 'מזג אוויר', 'סכנה', 'המלצה'];
const SEVERITIES = [
  { id: 'נמוכה', label: 'נמוכה', color: '#16a34a', bg: '#f0fdf4' },
  { id: 'בינונית', label: 'בינונית', color: '#d97706', bg: '#fffbeb' },
  { id: 'גבוהה', label: 'גבוהה', color: '#dc2626', bg: '#fef2f2' },
];

export default function AddReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poiName = searchParams.get('poi_name') || '';

  const [formData, setFormData] = useState({
    poi_name: poiName,
    report_type: '',
    severity: 'בינונית',
    content: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.report_type || !formData.content) return;
    setLoading(true);
    await base44.entities.CommunityReport.create(formData);
    navigate('/Reports');
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%', direction: 'rtl' }}>

      {/* ── Header (Full Width) ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', width: '100%' }}>
        <div style={{
          maxWidth: 600, margin: '0 auto', padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', flex: 1, textAlign: 'right', margin: 0 }}>דיווח חדש</h1>
        </div>
      </div>

      {/* ── Main Content Container (Centered & Constrained) ── */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px', paddingBottom: 100 }}>

        {/* Location */}
        {poiName && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '14px 16px',
            marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a2e2a' }}>{poiName}</span>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: '#f0fdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
            </div>
          </div>
        )}

        {/* Report Type */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14, textAlign: 'right', marginTop: 0 }}>סוג הדיווח</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
            {REPORT_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setFormData(p => ({ ...p, report_type: type }))}
                style={{
                  padding: '10px 6px', border: `2px solid ${formData.report_type === type ? '#0d9e6e' : '#e2e8f0'}`,
                  borderRadius: 12, background: formData.report_type === type ? '#f0fdf8' : '#fff',
                  color: formData.report_type === type ? '#0d9e6e' : '#64748b',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                  transition: 'all 0.2s ease'
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14, textAlign: 'right', marginTop: 0 }}>רמת חומרה</h3>
          <div style={{ display: 'flex', gap: 10, flexDirection: 'row-reverse' }}>
            {SEVERITIES.map(sev => (
              <button
                key={sev.id}
                onClick={() => setFormData(p => ({ ...p, severity: sev.id }))}
                style={{
                  flex: 1, padding: '12px 8px',
                  border: `2px solid ${formData.severity === sev.id ? sev.color : '#e2e8f0'}`,
                  borderRadius: 12,
                  background: formData.severity === sev.id ? sev.bg : '#fff',
                  color: formData.severity === sev.id ? sev.color : '#64748b',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                  transition: 'all 0.2s ease'
                }}
              >
                {sev.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14, textAlign: 'right', marginTop: 0 }}>תיאור הדיווח</h3>
          <textarea
            value={formData.content}
            onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
            placeholder="תאר את המצב בשטח..."
            rows={4}
            style={{
              width: '100%', border: '2px solid #e2e8f0', borderRadius: 12, boxSizing: 'border-box',
              padding: '12px', fontSize: 14, fontFamily: 'Heebo, sans-serif', background: '#f8fafc',
              textAlign: 'right', resize: 'none', outline: 'none', color: '#1a2e2a',
            }}
          />
        </div>

        {/* Photo Upload */}
        <button style={{
          width: '100%', padding: '14px', border: '2px dashed #e2e8f0',
          borderRadius: 16, background: '#fff', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: '#94a3b8', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          הוסף תמונה (+10 XP)
        </button>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !formData.report_type || !formData.content}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: 16,
            background: formData.report_type && formData.content ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)' : '#e2e8f0',
            color: formData.report_type && formData.content ? '#fff' : '#94a3b8',
            fontSize: 16, fontWeight: 800, cursor: formData.report_type && formData.content ? 'pointer' : 'not-allowed',
            fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease',
            boxShadow: formData.report_type && formData.content ? '0 8px 20px rgba(13, 158, 110, 0.25)' : 'none'
          }}
        >
          {loading ? 'שולח...' : 'שלח דיווח'}
        </button>
      </div>
    </div>
  );
}