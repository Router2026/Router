import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const REPORT_TYPES = ['צפיפות', 'מצב מים', 'מצב שביל', 'חניה', 'מזג אוויר', 'סכנה', 'המלצה'];
const SEVERITIES = [
  { id: 'נמוכה', label: 'נמוכה', color: '#16a34a', bg: '#f0fdf4' },
  { id: 'בינונית', label: 'בינונית', color: '#d97706', bg: '#fffbeb' },
  { id: 'גבוהה', label: 'גבוהה', color: '#dc2626', bg: '#fef2f2' },
];

export default function AddReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoggedIn } = useAuth();

  const poiName = searchParams.get('poi_name') || '';
  // Feature 5: Read location_id from URL param
  const locationId = searchParams.get('location_id') ? parseInt(searchParams.get('location_id')!) : undefined;

  const [formData, setFormData] = useState({
    poi_name: poiName,
    report_type: '',
    severity: 'בינונית',
    content: '',
    reporter_name: user?.username || 'אנונימי',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!formData.report_type || !formData.content) return;
    setLoading(true);
    try {
      await api.reports.create({
        ...formData,
        // Feature 5: Always include location_id when available
        location_id: locationId,
        reporter_name: isLoggedIn ? (user?.username || formData.reporter_name) : 'אנונימי',
      });
      setSuccess(true);
      setTimeout(() => navigate(locationId ? `/POIDetail?id=${locationId}` : '/Reports'), 1200);
    } catch {
      setLoading(false);
    }
  };

  if (success) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
      <div style={{ fontSize: 56 }}>✅</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#0d9e6e' }}>הדיווח נשלח!</div>
    </div>
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%', direction: 'rtl' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', width: '100%' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', flex: 1, textAlign: 'right', margin: 0 }}>דיווח חדש</h1>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px', paddingBottom: 100 }}>

        {/* Location indicator */}
        {poiName && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a2e2a' }}>{poiName}</span>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: '#f0fdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            </div>
          </div>
        )}

        {/* Report type */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14, textAlign: 'right', marginTop: 0 }}>סוג הדיווח</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
            {REPORT_TYPES.map(type => (
              <button key={type} onClick={() => setFormData(p => ({ ...p, report_type: type }))}
                style={{ padding: '10px 6px', border: `2px solid ${formData.report_type === type ? '#0d9e6e' : '#e2e8f0'}`, borderRadius: 12, background: formData.report_type === type ? '#f0fdf8' : '#fff', color: formData.report_type === type ? '#0d9e6e' : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease' }}>
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
              <button key={sev.id} onClick={() => setFormData(p => ({ ...p, severity: sev.id }))}
                style={{ flex: 1, padding: '12px 8px', border: `2px solid ${formData.severity === sev.id ? sev.color : '#e2e8f0'}`, borderRadius: 12, background: formData.severity === sev.id ? sev.bg : '#fff', color: formData.severity === sev.id ? sev.color : '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease' }}>
                {sev.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14, textAlign: 'right', marginTop: 0 }}>תיאור הדיווח</h3>
          <textarea value={formData.content} onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
            placeholder="תאר את המצב בשטח..." rows={4}
            style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 12, boxSizing: 'border-box', padding: '12px', fontSize: 14, fontFamily: 'Heebo, sans-serif', background: '#f8fafc', textAlign: 'right', resize: 'none', outline: 'none', color: '#1a2e2a' }} />
        </div>

        {/* Reporter name (if not logged in) */}
        {!isLoggedIn && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14, textAlign: 'right', marginTop: 0 }}>שם מדווח</h3>
            <input value={formData.reporter_name} onChange={e => setFormData(p => ({ ...p, reporter_name: e.target.value }))}
              placeholder="השם שיוצג לצד הדיווח"
              style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: 12, boxSizing: 'border-box', fontSize: 14, fontFamily: 'Heebo, sans-serif', background: '#f8fafc', textAlign: 'right', outline: 'none', color: '#1a2e2a' }} />
          </div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading || !formData.report_type || !formData.content}
          style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 16, background: formData.report_type && formData.content ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)' : '#e2e8f0', color: formData.report_type && formData.content ? '#fff' : '#94a3b8', fontSize: 16, fontWeight: 800, cursor: formData.report_type && formData.content ? 'pointer' : 'not-allowed', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease', boxShadow: formData.report_type && formData.content ? '0 8px 20px rgba(13, 158, 110, 0.25)' : 'none' }}>
          {loading ? 'שולח...' : 'שלח דיווח'}
        </button>
      </div>
    </div>
  );
}
