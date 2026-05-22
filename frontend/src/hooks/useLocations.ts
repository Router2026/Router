// src/hooks/useLocations.ts  ← NEW FILE
// Centralised React Query hooks — all pages read from the same cache.
// Home, Explore, MapView, POIDetail all share one copy of each query.

import { useQuery } from '@tanstack/react-query';
import { api, type POI, type NearbyPOI, type Region } from '../api';

// ── Stable query-key factory ──────────────────────────────────────────────────

export const locationKeys = {
    all: () => ['locations'] as const,
    lists: () => [...locationKeys.all(), 'list'] as const,
    list: (p: Record<string, unknown>) => [...locationKeys.lists(), p] as const,
    detail: (id: string | number) => [...locationKeys.all(), 'detail', String(id)] as const,
    nearby: (id: string | number) => [...locationKeys.all(), 'nearby', String(id)] as const,
    featured: () => [...locationKeys.all(), 'featured'] as const,
    meta: () => [...locationKeys.all(), 'meta'] as const,
    regions: () => ['regions'] as const,
};

// ── Shared regions (used by MapView + Explore) ────────────────────────────────

export function useRegions() {
    return useQuery<Region[]>({
        queryKey: locationKeys.regions(),
        queryFn: () => api.regions.list(),
        staleTime: 60 * 60 * 1000,         // regions change almost never
        gcTime: 24 * 60 * 60 * 1000,
    });
}

// ── Flat POI list scoped to one region (MapView) ──────────────────────────────

export function useLocationsByRegion(regionName: string | null) {
    return useQuery<POI[]>({
        queryKey: locationKeys.list({ region: regionName }),
        queryFn: () => api.locations.list({ region: regionName!, limit: 100 }),
        enabled: !!regionName,
        staleTime: 5 * 60 * 1000,
    });
}

// ── Single POI detail (POIDetail page) ───────────────────────────────────────

export function useLocation(id: string | number | null) {
    return useQuery<POI>({
        queryKey: locationKeys.detail(id ?? ''),
        queryFn: () => api.locations.get(String(id!)),
        enabled: !!id,
        staleTime: 10 * 60 * 1000,
    });
}

// ── Nearby POIs (POIDetail sidebar) ──────────────────────────────────────────

export function useNearbyLocations(id: string | number | null, limit = 6) {
    return useQuery<NearbyPOI[]>({
        queryKey: locationKeys.nearby(id ?? ''),
        queryFn: () => api.locations.getNearby(id!, limit),
        enabled: !!id,
        staleTime: 10 * 60 * 1000,
    });
}

// ── Featured POIs (Home page hero section) ────────────────────────────────────

export function useFeaturedLocations(limit = 10) {
    return useQuery<POI[]>({
        queryKey: locationKeys.featured(),
        queryFn: () => api.locations.getFeatured(limit),
        staleTime: 15 * 60 * 1000,
    });
}

// ── Filter meta: categories + difficulties for dropdowns ──────────────────────

interface LocationMeta { categories: string[]; difficulties: string[]; total_count: number; }

export function useLocationMeta() {
    return useQuery<LocationMeta>({
        queryKey: locationKeys.meta(),
        queryFn: async () => {
            const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/locations/meta`);
            const json = await res.json();
            return json.data as LocationMeta;
        },
        staleTime: 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
    });
}