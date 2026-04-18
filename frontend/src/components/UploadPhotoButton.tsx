// src/components/UploadPhotoButton.tsx — UPDATED
// Fixes:
//  • Mobile upload: accept="image/*,video/*" allows camera roll + files on iOS/Android
//  • Video upload support with video preview
//  • Larger file size limit for videos (50 MB)
//  • Uses new /media endpoint for unified image+video uploads

import { useState, useRef } from 'react';
import { api, type XpResult, type LocationMedia } from '../api';
import XpToast from './XpToast';
import { useAuth } from '../context/AuthContext';

interface Props {
  locationId: number;
  onUploaded?: (mediaItem: LocationMedia) => void;
}

type UploadMode = 'file' | 'url';

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 50;

function isVideoFile(file: File) { return file.type.startsWith('video/'); }
function isImageFile(file: File) { return file.type.startsWith('image/'); }

export default function UploadPhotoButton({ locationId, onUploaded }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<UploadMode>('file');
  const [urlInput, setUrlInput] = useState('');
  const [urlMediaType, setUrlMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideoPreview, setIsVideoPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const openModal = () => {
    setShowModal(true);
    setError(null);
    setUrlInput('');
    setSelectedFile(null);
    setPreview(null);
    setCaption('');
    setIsVideoPreview(false);
  };

  const closeModal = () => {
    if (preview && selectedFile) URL.revokeObjectURL(preview);
    setShowModal(false);
    setSelectedFile(null);
    setPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const isVideo = isVideoFile(f);
    const isImage = isImageFile(f);

    if (!isImage && !isVideo) {
      setError('סוג קובץ לא נתמך. בחר תמונה (JPEG, PNG, WEBP) או סרטון (MP4, MOV, WEBM).');
      return;
    }

    const maxMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (f.size > maxMB * 1024 * 1024) {
      setError(`הקובץ גדול מדי — מקסימום ${maxMB} MB ${isVideo ? 'לסרטון' : 'לתמונה'}`);
      return;
    }

    setSelectedFile(f);
    setError(null);
    setIsVideoPreview(isVideo);
    const objectUrl = URL.createObjectURL(f);
    setPreview(objectUrl);
  };

  const handleSubmit = async () => {
    setError(null);
    setUploading(true);
    try {
      let res;
      if (mode === 'file') {
        if (!selectedFile) { setError('בחר קובץ'); setUploading(false); return; }
        res = await api.locations.uploadMedia(locationId, selectedFile, caption || undefined);
      } else {
        const url = urlInput.trim();
        if (!url) { setError('הכנס קישור'); setUploading(false); return; }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          setError('הקישור חייב להתחיל ב-https://'); setUploading(false); return;
        }
        res = await api.locations.uploadMediaUrl(locationId, url, urlMediaType, caption || undefined);
      }
      setXpResult(res.xp);
      closeModal();
      onUploaded?.(res.media);
    } catch (err: any) {
      setError(
        err?.code === 'LIMIT_REACHED'
          ? 'הגעת למגבלת המדיה עבור מיקום זה'
          : err?.message || 'העלאה נכשלה — ודא שהקובץ תקין'
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
        style={{ width: '100%', padding: '16px', border: '2px dashed #0d9e6e', borderRadius: 18, background: '#f0fdf8', color: '#0d9e6e', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        📷 העלה תמונה / סרטון <span style={{ fontSize: 11, opacity: 0.85 }}>+10 XP</span>
      </button>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && closeModal()}
        >
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 440, direction: 'rtl', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a', marginBottom: 6 }}>📷 העלה תמונה / סרטון</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              שתף את המיקום עם הקהילה וקבל <strong>+10 XP</strong>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['file', 'url'] as UploadMode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(null); }}
                  style={{ flex: 1, padding: '8px', borderRadius: 10, border: `2px solid ${mode === m ? '#0d9e6e' : '#e2e8f0'}`, background: mode === m ? '#f0fdf8' : '#fff', color: mode === m ? '#0d9e6e' : '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {m === 'file' ? '📁 מהמכשיר' : '🔗 קישור URL'}
                </button>
              ))}
            </div>

            {mode === 'file' ? (
              <>
                {/*
                  MOBILE FIX:
                  - accept="image/*,video/*" — lets iOS/Android open the full picker
                    (camera roll, files app, direct camera)
                  - NOT using capture="environment" so user can choose gallery OR camera
                  - Multiple=false intentional here for single upload
                */}
                <input
                  type="file"
                  ref={fileRef}
                  accept="image/*,video/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                {preview ? (
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    {isVideoPreview ? (
                      <video
                        src={preview}
                        controls
                        style={{ width: '100%', maxHeight: 200, borderRadius: 12, border: '2px solid #e2e8f0', background: '#000' }}
                        playsInline
                      />
                    ) : (
                      <img src={preview} alt="preview"
                        style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, border: '2px solid #e2e8f0' }}
                      />
                    )}
                    <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#fff', fontWeight: 700 }}>
                      {isVideoPreview ? '▶ סרטון' : '🖼 תמונה'}
                    </div>
                    <button onClick={() => { setSelectedFile(null); setPreview(null); setIsVideoPreview(false); if (fileRef.current) fileRef.current.value = ''; }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    style={{ width: '100%', height: 120, border: '2px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748b', marginBottom: 12 }}>
                    <span style={{ fontSize: 32 }}>📷</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Heebo, sans-serif' }}>לחץ לבחירת תמונה או סרטון</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>JPEG, PNG, WEBP, GIF · MP4, MOV, WEBM</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>תמונה עד {MAX_IMAGE_MB} MB · סרטון עד {MAX_VIDEO_MB} MB</span>
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Media type selector for URL mode */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {(['image', 'video'] as const).map(t => (
                    <button key={t} onClick={() => setUrlMediaType(t)}
                      style={{ flex: 1, padding: '7px', borderRadius: 8, border: `2px solid ${urlMediaType === t ? '#0d9e6e' : '#e2e8f0'}`, background: urlMediaType === t ? '#f0fdf8' : '#fff', color: urlMediaType === t ? '#0d9e6e' : '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      {t === 'image' ? '🖼 תמונה' : '▶ סרטון'}
                    </button>
                  ))}
                </div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  קישור ל{urlMediaType === 'video' ? 'סרטון' : 'תמונה'} (https://)
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={urlMediaType === 'video' ? 'https://example.com/video.mp4' : 'https://i.imgur.com/example.jpg'}
                  autoFocus
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, direction: 'ltr', outline: 'none', boxSizing: 'border-box', marginBottom: 4 }}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                  {urlMediaType === 'video' ? 'קישור ישיר לקובץ MP4/WEBM/MOV' : 'העלה ל-Imgur / Cloudinary ואז הדבק את הקישור הישיר'}
                </div>
              </>
            )}

            {/* Caption */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                כיתוב (אופציונלי)
              </label>
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="תיאור קצר של התמונה / הסרטון..."
                maxLength={200}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', boxSizing: 'border-box', direction: 'rtl' }}
              />
            </div>

            {error && (
              <div style={{ marginTop: 4, marginBottom: 8, color: '#ef4444', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleSubmit}
                disabled={uploading || (mode === 'file' ? !selectedFile : !urlInput.trim())}
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
