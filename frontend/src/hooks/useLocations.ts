import React from 'react';
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

// ── Nearby POIs by GPS coords (Home page "Near You" section) ──────────────────
// Uses a two-step approach: first get the user's coordinates via the Geolocation
// API (stored in React state), then enable the query once coords are available.
// The query key includes rounded coords (0.01° ≈ 1 km) so nearby results are
// shared between navigations that start from roughly the same spot.

export function useNearbyUserLocations(limit = 10, radius = 30000) {
    const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);
    const [geoError, setGeoError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!navigator.geolocation) {
            setGeoError('מיקום אינו נתמך בדפדפן זה');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => setCoords({
                // Round to 2 decimal places (~1 km) so the cache key is stable
                // across minor GPS jitter between navigations.
                lat: Math.round(pos.coords.latitude * 100) / 100,
                lng: Math.round(pos.coords.longitude * 100) / 100,
            }),
            () => setGeoError('לא אושרה גישה למיקום'),
            { timeout: 8000, maximumAge: 60_000 },
        );
    }, []); // runs once per mount — coords persist in React Query cache afterwards

    const query = useQuery<NearbyPOI[]>({
        queryKey: ['locations', 'nearbyUser', coords, limit, radius],
        queryFn: () => api.locations.getNearbyUser(coords!.lat, coords!.lng, limit, radius),
        enabled: !!coords,
        staleTime: 5 * 60 * 1000,   // 5 min — user probably hasn't moved far
        gcTime: 15 * 60 * 1000,
    });

    return { ...query, geoError };
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