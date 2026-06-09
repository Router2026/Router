/**
 * TripBucketContext
 * -----------------
 * Manages the client-side "Trip Bucket" — a staging area where users collect
 * Points of Interest before generating an optimized route.
 *
 * All state is kept in memory (no backend calls on every add/remove).
 * Route generation is the only operation that hits the backend.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { POI } from '../api';
import type { BucketItem, GeneratedRoute, TripBucketContextValue, UserLocation } from '../utils/types';


// ── Context ───────────────────────────────────────────────────────────────────

const TripBucketContext = createContext<TripBucketContextValue | null>(null);

export function TripBucketProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [generatedRoute, setGeneratedRoute] = useState<GeneratedRoute | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  // Derive a quick-lookup Set for O(1) membership tests
  const poiIdSet = useMemo(() => new Set(items.map(i => i.poi.id)), [items]);

  const addPoi = useCallback((poi: POI) => {
    setItems(prev => {
      if (prev.some(i => i.poi.id === poi.id)) return prev;
      return [...prev, { poi, addedAt: Date.now() }];
    });
  }, []);

  const removePoi = useCallback((poiId: string) => {
    setItems(prev => prev.filter(i => i.poi.id !== poiId));
  }, []);

  const reorderItems = useCallback((fromIndex: number, toIndex: number) => {
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const hasPoi = useCallback((poiId: string) => poiIdSet.has(poiId), [poiIdSet]);

  const clearBucket = useCallback(() => {
    setItems([]);
    setGeneratedRoute(null);
    setGenerationError(null);
    // userLocation is intentionally kept — user shouldn't need to re-detect
    // their position if they build multiple routes in the same session
  }, []);

  const openSheet = useCallback(() => setIsSheetOpen(true), []);
  const closeSheet = useCallback(() => setIsSheetOpen(false), []);

  const value: TripBucketContextValue = {
    items,
    count: items.length,
    addPoi,
    removePoi,
    reorderItems,
    hasPoi,
    clearBucket,
    isSheetOpen,
    openSheet,
    closeSheet,
    generatedRoute,
    setGeneratedRoute,
    isGenerating,
    setIsGenerating,
    generationError,
    setGenerationError,
    userLocation,
    setUserLocation,
  };

  return (
    <TripBucketContext.Provider value={value}>
      {children}
    </TripBucketContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useTripBucket(): TripBucketContextValue {
  const ctx = useContext(TripBucketContext);
  if (!ctx) {
    throw new Error('useTripBucket must be used inside <TripBucketProvider>');
  }
  return ctx;
}