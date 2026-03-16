import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44, type VideoPost } from '../api';

const TAGS = ['הכל', 'טבע', 'מים', 'היסטוריה', 'נוף'];

export default function CommunityVideos() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [selectedTag, setSelectedTag] = useState('הכל');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    base44.entities.VideoPost.list().then((data) => setVideos(data));
  }, []);

  const handleLike = async (id: string, current: number) => {
    if (likedIds.has(id)) return;
    await base44.entities.VideoPost.update(id, { likes_count: current + 1 });
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, likes_count: v.likes_count + 1 } : v))
    );
    setLikedIds((prev) => new Set(prev).add(id));
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%' }}>
      {/* Header - רוחב מלא */}
      <div
        style={{
          background: 'linear-gradient(160deg, #7c3aed 0%, #9333ea 100%)',
          width: '100%',
        }}
      >
        {/* תוכן ההדר - ממורכז */}
        <div
          style={{
            maxWidth: 600,
            margin: '0 auto',
            padding: '48px 20px 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <button
            onClick={() => navigate('/UploadVideo')}
            style={{
              background: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '8px 16px',
              cursor: 'pointer',
              color: '#7c3aed',
              fontSize: 13,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'Heebo, sans-serif',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            העלאה
          </button>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, marginBottom: 4 }}>
              וידאו קהילתי
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>שתפו את החוויות שלכם</p>
          </div>
        </div>
      </div>

      {/* Main Content - Container ממורכז */}
      <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>
        {/* Tags */}
        <div style={{ padding: '16px 16px 8px' }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: 4,
              direction: 'rtl',
            }}
          >
            {TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                style={{
                  flexShrink: 0,
                  padding: '6px 16px',
                  borderRadius: 20,
                  border: `2px solid ${selectedTag === tag ? '#7c3aed' : '#e2e8f0'}`,
                  background: selectedTag === tag ? '#faf5ff' : '#fff',
                  color: selectedTag === tag ? '#7c3aed' : '#64748b',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                  transition: 'all 0.2s ease',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Videos */}
        <div style={{ padding: '8px 16px 24px' }}>
          {videos.map((video) => (
            <div
              key={video.id}
              style={{
                background: '#fff',
                borderRadius: 20,
                boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                marginBottom: 16,
                overflow: 'hidden',
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  height: 200,
                  position: 'relative',
                  backgroundImage: `url(${video.thumbnail_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5) 100%)',
                  }}
                />
                {/* Play Button */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#7c3aed">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
                {/* Region tag */}
                {video.region && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      right: 12,
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      borderRadius: 8,
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {video.region}
                  </span>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '14px 16px' }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#1a2e2a',
                    marginBottom: 10,
                    textAlign: 'right',
                  }}
                >
                  {video.title}
                </div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={() => handleLike(video.id, video.likes_count)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        color: likedIds.has(video.id) ? '#ef4444' : '#94a3b8',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'Heebo, sans-serif',
                        transition: 'color 0.2s',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill={likedIds.has(video.id) ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      {video.likes_count}
                    </button>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        color: '#94a3b8',
                        fontSize: 12,
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      {video.views_count || 0}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{video.uploader_name}</span>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #0d9e6e, #34d399)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {video.uploader_name?.charAt(0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
