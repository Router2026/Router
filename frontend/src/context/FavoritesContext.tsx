// src/context/FavoritesContext.tsx
// Single source of truth for favorites — fetched once on login, shared by all components.

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, type FavoriteLocation } from '../api';
import { useAuth } from './AuthContext';

interface FavoritesContextValue {
  favorites:      FavoriteLocation[];
  loading:        boolean;
  isFavorite:     (locationId: number | string) => boolean;
  toggleFavorite: (locationId: number) => Promise<void>;
  refresh:        () => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [loading, setLoading]     = useState(false);
  const pendingRef = useRef(new Set<number>());

  const fetchFavorites = useCallback(() => {
    setLoading(true);
    api.favorites.list()
      .then(setFavorites)
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false));
  }, []);

  // Reload whenever the logged-in user changes
  useEffect(() => {
    if (!user) { setFavorites([]); return; }
    fetchFavorites();
  }, [user?.id]); // depend only on id — not the whole object — to avoid infinite loops

  const isFavorite = useCallback(
    (locationId: number | string) =>
      favorites.some(f => String(f.location_id) === String(locationId)),
    [favorites],
  );

  const toggleFavorite = useCallback(async (locationId: number) => {
    if (!user) return;
    if (pendingRef.current.has(locationId)) return;
    pendingRef.current.add(locationId);
    const already = isFavorite(locationId);

    if (already) {
      // Optimistic remove
      setFavorites(prev => prev.filter(f => f.location_id !== locationId));
      try {
        await api.favorites.remove(locationId);
      } catch {
        fetchFavorites();
      } finally {
        pendingRef.current.delete(locationId);
      }
    } else {
      const placeholder: FavoriteLocation = {
        id: -Date.now(), user_id: Number(user.id),
        location_id: locationId, created_at: new Date().toISOString(),
      };
      setFavorites(prev => [placeholder, ...prev]);
      try {
        const { favorite } = await api.favorites.add(locationId);
        setFavorites(prev =>
          prev.map(f => f.id === placeholder.id ? favorite : f)
        );
      } catch {
        setFavorites(prev => prev.filter(f => f.id !== placeholder.id));
      } finally {
        pendingRef.current.delete(locationId);
      }
    }
  }, [user, isFavorite, fetchFavorites]);

  const value = useMemo(
    () => ({ favorites, loading, isFavorite, toggleFavorite, refresh: fetchFavorites }),
    [favorites, loading, isFavorite, toggleFavorite, fetchFavorites],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
