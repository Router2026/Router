// src/components/UploadPhotoButton.tsx
// "Upload Photo" button for location pages.
// Accepts an https:// image URL, posts it to the backend, shows XP toast on success.

import { useState } from 'react';
import { api, type XpResult } from '../api';
import XpToast from './XpToast';
import { useAuth } from '../context/AuthContext';

interface Props {
  locationId: number;
  onUploaded?: (imageUrl: string) => void;
}

export default function UploadPhotoButton({ locationId, onUploaded }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Only render for logged-in users — parent should also gate this, but be safe
  if (!user) return null;

  const openModal = () => { setShowModal(true); setError(null); setUrlInput(''); };
  const closeModal = () => setShowModal(false);

  const handleSubmit = async () => {
    const url = urlInput.trim();
    if (!url) { setError('הכנס קישור לתמונה'); return; }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('הקישור חייב להתחיל ב-https://');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await api.locations.uploadImage(locationId, url);
      setXpResult(res.xp);
      closeModal();
      onUploaded?.(url);
    } catch (err: any) {
      setError(
        err?.code === 'LIMIT_REACHED'
          ? 'הגעת למגבלת התמונות עבור מיקום זה'
          : 'העלאה נכשלה — ודא שהקישור תקין ונגיש'
      );
    } finally {
      setUploading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') closeModal();
  };

  return (
    <>
      {xpResult && <XpToast xp={xpResult} onDone={() => setXpResult(null)} />}

      <button
        onClick={openModal}
        style={{ width: '100%', padding: '16px', border: '2px dashed #0d9e6e', borderRadius: 18, background: '#f0fdf8', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16 }}>
        📷 העלה תמונה <span style={{ fontSize: 11, opacity: 0.85 }}>+10 XP</span>
      </button>

      {showModal && (
        <div
          role="dialog" aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && closeModal()}
        >
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 420, direction: 'rtl', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a', marginBottom: 6 }}>📷 העלה תמונה</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              שתף את המיקום עם הקהילה וקבל <strong>+10 XP</strong>
            </div>

            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              קישור לתמונה (https://)
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="https://i.imgur.com/example.jpg"
              autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, direction: 'ltr', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              העלה ל-Imgur / Cloudinary ואז הדבק את הקישור הישיר
            </div>

            {error && (
              <div style={{ marginTop: 10, color: '#ef4444', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={handleSubmit}
                disabled={uploading || !urlInput.trim()}
                style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: 12,
                  background: uploading || !urlInput.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
                  color: uploading || !urlInput.trim() ? '#94a3b8' : '#fff',
                  fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 15,
                  cursor: uploading || !urlInput.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {uploading ? '⏳ מעלה...' : '✅ העלה'}
              </button>
              <button
                onClick={closeModal}
                style={{ padding: '12px 20px', border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
