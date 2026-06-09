// src/components/FavoriteButton.tsx
// Reusable heart-toggle — uses shared FavoritesContext (single fetch, no per-instance requests).

import { useState } from 'react';
import { useFavorites } from '../context/FavoritesContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Props {
  locationId: number;
  size?: number;
  style?: React.CSSProperties;
}

export default function FavoriteButton({ locationId, size = 24, style }: Readonly<Props>) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [animating, setAnimating] = useState(false);

  const favorited = isFavorite(locationId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate('/Login'); return; }
    setAnimating(true);
    await toggleFavorite(locationId);
    setTimeout(() => setAnimating(false), 300);
  };

  return (
    <button
      onClick={handleClick}
      title={favorited ? 'הסר מהמועדפים' : 'הוסף למועדפים'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: 4, lineHeight: 1, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        transform: animating ? 'scale(1.35)' : 'scale(1)',
        transition: 'transform 0.2s cubic-bezier(.36,.07,.19,.97)',
        ...style,
      }}
    >
      <svg
        width={size} height={size} viewBox="0 0 24 24"
        fill={favorited ? '#ef4444' : 'none'}
        stroke={favorited ? '#ef4444' : '#94a3b8'}
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
