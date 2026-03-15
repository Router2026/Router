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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BucketItem {
  poi: POI;
  /** Timestamp the user added the POI — used to preserve insertion order */
  addedAt: number;
}

export type BuildMode = 'proximity' | 'smart';

/** User's live geolocation — the fixed starting point of every generated route */
export interface UserLocation {
  lat: number;
  lng: number;
}

export interface RouteStop {
  poi_id: string;
  poi_name: string;
  arrival_time: string;
  duration_minutes: number;
  smart_insight?: string;
  order_index: number;
}

export interface GeneratedRoute {
  mode: BuildMode;
  stops: RouteStop[];
  total_distance_km?: number;
  total_duration_minutes?: number;
  smart_plan?: SmartPlan;
}

export interface SmartPlan {
  route_title: string;
  route_description: string;
  stops: Array<{
    location_id: string;
    poi_name: string;
    arrival_time: string;
    duration_minutes: number;
    smart_insight: string;
    visit_type: string;
  }>;
}

interface TripBucketContextValue {
  /** Ordered list of bucket items */
  items: BucketItem[];
  /** Number of items in the bucket */
  count: number;
  /** Add a POI — silently ignores duplicates */
  addPoi: (poi: POI) => void;
  /** Remove a POI by its id */
  removePoi: (poiId: string) => void;
  /** Move an item from one index to another (for manual reordering) */
  reorderItems: (fromIndex: number, toIndex: number) => void;
  /** True if the given POI id is already in the bucket */
  hasPoi: (poiId: string) => boolean;
  /** Clear all items */
  clearBucket: () => void;
  /** Whether the bottom sheet is open */
  isSheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  /** The most recently generated route (null until built) */
  generatedRoute: GeneratedRoute | null;
  setGeneratedRoute: (route: GeneratedRoute | null) => void;
  /** Loading state for route generation */
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  /** Error from the last generation attempt */
  generationError: string | null;
  setGenerationError: (msg: string | null) => void;
  /**
   * User's live geolocation — persisted in context so it survives a
   * sheet close/reopen within the same session.
   */
  userLocation: UserLocation | null;
  setUserLocation: (loc: UserLocation | null) => void;
}

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

export function useTripBucket(): TripBucketContextValue {
  const ctx = useContext(TripBucketContext);
  if (!ctx) {
    throw new Error('useTripBucket must be used inside <TripBucketProvider>');
  }
  return ctx;
}