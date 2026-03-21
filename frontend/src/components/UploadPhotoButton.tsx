// src/components/UploadPhotoButton.tsx — UPDATED
// Feature 7: allows upload from computer (file picker) in addition to URL.

import { useState, useRef } from 'react';
import { api, fileToBase64, type XpResult } from '../api';
import XpToast from './XpToast';
import { useAuth } from '../context/AuthContext';

interface Props {
  locationId: number;
  onUploaded?: (imageUrl: string) => void;
}

type UploadMode = 'url' | 'file';

export default function UploadPhotoButton({ locationId, onUploaded }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<UploadMode>('file');
  const [urlInput, setUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const openModal = () => { setShowModal(true); setError(null); setUrlInput(''); setSelectedFile(null); setPreview(null); };
  const closeModal = () => { setShowModal(false); setSelectedFile(null); setPreview(null); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError('הקובץ גדול מדי (מקסימום 5 MB)'); return; }
    setSelectedFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    setError(null);
    setUploading(true);
    try {
      let res;
      if (mode === 'file') {
        if (!selectedFile) { setError('בחר קובץ תמונה'); setUploading(false); return; }
        res = await api.locations.uploadImageFile(locationId, selectedFile);
      } else {
        const url = urlInput.trim();
        if (!url) { setError('הכנס קישור לתמונה'); setUploading(false); return; }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          setError('הקישור חייב להתחיל ב-https://'); setUploading(false); return;
        }
        res = await api.locations.uploadImage(locationId, url);
      }
      setXpResult(res.xp);
      closeModal();
      onUploaded?.(res.image.image_url);
    } catch (err: any) {
      setError(
        err?.code === 'LIMIT_REACHED'
          ? 'הגעת למגבלת התמונות עבור מיקום זה'
          : 'העלאה נכשלה — ודא שהתמונה תקינה'
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

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['file', 'url'] as UploadMode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(null); }}
                  style={{ flex: 1, padding: '8px', borderRadius: 10, border: `2px solid ${mode === m ? '#0d9e6e' : '#e2e8f0'}`, background: mode === m ? '#f0fdf8' : '#fff', color: mode === m ? '#0d9e6e' : '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {m === 'file' ? '📁 מהמחשב' : '🔗 קישור URL'}
                </button>
              ))}
            </div>

            {mode === 'file' ? (
              <>
                <input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }} onChange={handleFileChange} />
                {preview ? (
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <img src={preview} alt="preview" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, border: '2px solid #e2e8f0' }} />
                    <button onClick={() => { setSelectedFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                      style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    style={{ width: '100%', height: 120, border: '2px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748b', marginBottom: 12 }}>
                    <span style={{ fontSize: 32 }}>🖼️</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Heebo, sans-serif' }}>לחץ לבחירת תמונה מהמחשב</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>JPEG, PNG, WEBP, GIF · מקסימום 5 MB</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  קישור לתמונה (https://)
                </label>
                <input
                  type="url" value={urlInput}
                  onChange={e => setUrlInput(e.target.value)} onKeyDown={onKeyDown}
                  placeholder="https://i.imgur.com/example.jpg" autoFocus
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, direction: 'ltr', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  העלה ל-Imgur / Cloudinary ואז הדבק את הקישור הישיר
                </div>
              </>
            )}

            {error && (
              <div style={{ marginTop: 10, color: '#ef4444', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={handleSubmit} disabled={uploading || (mode === 'file' ? !selectedFile : !urlInput.trim())}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 12, background: uploading ? '#e2e8f0' : 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: uploading ? '#94a3b8' : '#fff', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 15, cursor: uploading ? 'not-allowed' : 'pointer' }}>
                {uploading ? '⏳ מעלה...' : '✅ העלה'}
              </button>
              <button onClick={closeModal}
                style={{ padding: '12px 20px', border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
