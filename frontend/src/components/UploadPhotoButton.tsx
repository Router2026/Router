/**
 * UploadPhotoButton.tsx  — REWRITTEN (Req 1 + Req 2)
 * ────────────────────────────────────────────────────
 * Changes vs previous version:
 *
 *  Req 1 — Fixed upload flow:
 *    • File mode now uses the shared base64 → /api/media/upload → publicUrl
 *      pipeline (via useMultiImageUpload) instead of calling the old
 *      api.locations.uploadMedia() which was broken by the RLS issue.
 *    • After getting the publicUrl, saves it to location_media via
 *      api.locations.uploadMediaUrl() (URL mode) so the DB only ever
 *      receives a plain https:// string — never a File or base64.
 *
 *  Req 2 — Multiple file selection:
 *    • <input> now has the `multiple` attribute.
 *    • When multiple files are selected a preview grid is shown.
 *    • All files are uploaded concurrently via Promise.all inside uploadAll().
 *    • Each resulting public URL is saved as a separate location_media row.
 */

import { useRef } from 'react';
import type { XpResult, LocationMedia } from '../api';
import { api } from '../api';
import XpToast from './XpToast';
import { useAuth } from '../context/AuthContext';
import { useMultiImageUpload } from '../hooks/useMultiImageUpload';
import { useState } from 'react';

interface Props {
  locationId: number;
  onUploaded?: (mediaItem: LocationMedia) => void;
}

type UploadMode = 'file' | 'url';

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 50;

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
  const fileRef = useRef<HTMLInputElement>(null);

  // Multi-file upload hook — handles previews, base64 conversion, and upload
  const { selectedFiles, handleFilesChange, uploadAll, removeFile, reset, uploadError } =
    useMultiImageUpload();

  if (!user) return null;

  const openModal = () => {
    setShowModal(true);
    setError(null);
    setUrlInput('');
    setCaption('');
    reset();
  };

  const closeModal = () => {
    reset(); // revokes all blob: URLs
    setShowModal(false);
  };

  // ── File size validation on selection ────────────────────────────────────
  const handleValidatedFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      const isVideo = f.type.startsWith('video/');
      const maxMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (f.size > maxMB * 1024 * 1024) {
        setError(`"${f.name}" גדול מדי — מקסימום ${maxMB} MB`);
        return;
      }
      if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
        setError(`"${f.name}" — סוג קובץ לא נתמך`);
        return;
      }
    }
    setError(null);
    handleFilesChange(e); // update previews via hook
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    setUploading(true);

    try {
      if (mode === 'file') {
        if (selectedFiles.length === 0) { setError('בחר קובץ'); return; }

        // Step 1: Upload all files concurrently → get public URL strings
        const publicUrls = await uploadAll();

        // Step 2: Save each public URL to location_media as a separate row.
        // The DB column media_url is type TEXT — it expects a plain URL string.
        const results = await Promise.all(
          publicUrls.map(url =>
            api.locations.uploadMediaUrl(
              locationId,
              url,
              'image',
              caption || undefined,
            ),
          ),
        );

        // Surface XP from the last item (server awards once per file)
        if (results.length > 0) {
          setXpResult(results[results.length - 1].xp);
          // Notify parent of the first uploaded item (for optimistic UI update)
          onUploaded?.(results[0].media);
        }

      } else {
        // URL mode — unchanged
        const url = urlInput.trim();
        if (!url) { setError('הכנס קישור'); return; }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          setError('הקישור חייב להתחיל ב-https://'); return;
        }
        const res = await api.locations.uploadMediaUrl(
          locationId, url, urlMediaType, caption || undefined,
        );
        setXpResult(res.xp);
        onUploaded?.(res.media);
      }

      closeModal();

    } catch (err: unknown) {
      setError(
        uploadError ??
        (err instanceof Error ? err.message : 'העלאה נכשלה — ודא שהקובץ תקין'),
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
        style={{
          width: '100%', padding: '16px',
          border: '2px dashed #0d9e6e', borderRadius: 18,
          background: '#f0fdf8', color: '#0d9e6e',
          fontSize: 15, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'Heebo, sans-serif', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
        📷 העלה תמונה / סרטון <span style={{ fontSize: 11, opacity: 0.85 }}>+10 XP</span>
      </button>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)', zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && closeModal()}
        >
          <div style={{
            background: '#fff', borderRadius: 20, padding: '28px 24px',
            width: '100%', maxWidth: 440, direction: 'rtl',
            boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a', marginBottom: 6 }}>
              📷 העלה תמונה / סרטון
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              שתף את המיקום עם הקהילה וקבל <strong>+10 XP</strong>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['file', 'url'] as UploadMode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(null); }}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 10,
                    border: `2px solid ${mode === m ? '#0d9e6e' : '#e2e8f0'}`,
                    background: mode === m ? '#f0fdf8' : '#fff',
                    color: mode === m ? '#0d9e6e' : '#64748b',
                    fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>
                  {m === 'file' ? '📁 מהמכשיר' : '🔗 קישור URL'}
                </button>
              ))}
            </div>

            {mode === 'file' ? (
              <>
                {/*
                  MULTI-FILE INPUT:
                  - multiple attribute allows selecting several files at once
                  - accept="image/*,video/*" opens the full picker on iOS/Android
                  - NOT using capture="environment" so users can choose gallery OR camera
                */}
                <input
                  type="file"
                  ref={fileRef}
                  accept="image/*,video/*"
                  multiple                 // ← Req 2: enables multi-select
                  style={{ display: 'none' }}
                  onChange={handleValidatedFileChange}
                />

                {selectedFiles.length > 0 ? (
                  <div style={{ marginBottom: 12 }}>
                    {/* Preview grid — one tile per selected file */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: selectedFiles.length === 1
                        ? '1fr'
                        : 'repeat(auto-fill, minmax(100px, 1fr))',
                      gap: 8, marginBottom: 8,
                    }}>
                      {selectedFiles.map((sf, idx) => (
                        <div key={sf.previewUrl} style={{ position: 'relative' }}>
                          <img
                            src={sf.previewUrl}
                            alt={sf.file.name}
                            style={{
                              width: '100%',
                              height: selectedFiles.length === 1 ? 160 : 90,
                              objectFit: 'cover', borderRadius: 10,
                              border: '2px solid #e2e8f0',
                            }}
                          />
                          <button
                            onClick={() => removeFile(idx)}
                            style={{
                              position: 'absolute', top: 4, right: 4,
                              background: 'rgba(0,0,0,0.5)', border: 'none',
                              borderRadius: '50%', width: 22, height: 22,
                              cursor: 'pointer', color: '#fff', fontSize: 12,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      style={{
                        fontSize: 12, color: '#64748b', background: 'none',
                        border: '1px dashed #cbd5e1', borderRadius: 8,
                        padding: '5px 10px', cursor: 'pointer',
                        fontFamily: 'Heebo, sans-serif',
                      }}>
                      + שנה / הוסף קבצים
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      width: '100%', height: 120, border: '2px dashed #cbd5e1',
                      borderRadius: 12, background: '#f8fafc', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: 8, color: '#64748b', marginBottom: 12,
                    }}>
                    <span style={{ fontSize: 32 }}>📷</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Heebo, sans-serif' }}>
                      לחץ לבחירת תמונה / סרטון
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      ניתן לבחור מספר קבצים בו-זמנית
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      JPEG · PNG · WEBP · MP4 · MOV
                    </span>
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Media type selector for URL mode */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {(['image', 'video'] as const).map(t => (
                    <button key={t} onClick={() => setUrlMediaType(t)}
                      style={{
                        flex: 1, padding: '7px', borderRadius: 8,
                        border: `2px solid ${urlMediaType === t ? '#0d9e6e' : '#e2e8f0'}`,
                        background: urlMediaType === t ? '#f0fdf8' : '#fff',
                        color: urlMediaType === t ? '#0d9e6e' : '#64748b',
                        fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      }}>
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
                  placeholder={urlMediaType === 'video'
                    ? 'https://example.com/video.mp4'
                    : 'https://i.imgur.com/example.jpg'}
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1.5px solid #e2e8f0', fontSize: 14,
                    direction: 'ltr', outline: 'none', boxSizing: 'border-box', marginBottom: 4,
                  }}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                  {urlMediaType === 'video'
                    ? 'קישור ישיר לקובץ MP4/WEBM/MOV'
                    : 'העלה ל-Imgur / Cloudinary ואז הדבק את הקישור הישיר'}
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
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 10,
                  border: '1.5px solid #e2e8f0', fontSize: 13,
                  fontFamily: 'Heebo, sans-serif', textAlign: 'right',
                  outline: 'none', boxSizing: 'border-box', direction: 'rtl',
                }}
              />
            </div>

            {(error || uploadError) && (
              <div style={{ marginTop: 4, marginBottom: 8, color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
                ⚠️ {error ?? uploadError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={handleSubmit}
                disabled={uploading || (mode === 'file' ? selectedFiles.length === 0 : !urlInput.trim())}
                style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: 12,
                  background: uploading ? '#e2e8f0' : 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
                  color: uploading ? '#94a3b8' : '#fff',
                  fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 15,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                }}>
                {uploading
                  ? `⏳ מעלה ${selectedFiles.length > 1 ? `${selectedFiles.length} קבצים` : ''}...`
                  : '✅ העלה'}
              </button>
              <button
                onClick={closeModal}
                style={{
                  padding: '12px 20px', border: '1.5px solid #e2e8f0',
                  borderRadius: 12, background: '#fff', color: '#64748b',
                  fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}