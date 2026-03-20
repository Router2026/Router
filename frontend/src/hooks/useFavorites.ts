// src/hooks/useFavorites.ts
// Manages favorite state globally — optimistic updates, single source of truth.

import { useState, useCallback, useEffect } from 'react';
import { api, type FavoriteLocation } from '../api';
import { useAuth } from '../context/AuthContext';

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [loading, setLoading] = useState(false);

  // Load favorites on login
  useEffect(() => {
    if (!user) { setFavorites([]); return; }
    setLoading(true);
    api.favorites.list()
      .then(setFavorites)
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false));
  }, [user]);

  const isFavorite = useCallback(
    (locationId: number | string) =>
      favorites.some(f => String(f.location_id) === String(locationId)),
    [favorites]
  );

  const toggleFavorite = useCallback(async (locationId: number) => {
    if (!user) return;
    const already = isFavorite(locationId);
    // Optimistic update
    if (already) {
      setFavorites(prev => prev.filter(f => f.location_id !== locationId));
      try { await api.favorites.remove(locationId); }
      catch { api.favorites.list().then(setFavorites); }
    } else {
      try {
        const { favorite } = await api.favorites.add(locationId);
        setFavorites(prev => [favorite, ...prev]);
      } catch { /* ignore */ }
    }
  }, [user, isFavorite]);

  return { favorites, loading, isFavorite, toggleFavorite };
}
