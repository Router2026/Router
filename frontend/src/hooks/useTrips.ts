// src/hooks/useTrips.ts
// Centralised React Query hooks for routes (AI-generated trips), public trips,
// and all associated social data (likes, ratings, comments, media).
// Pages import these instead of calling api.* inside useEffect.

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api, type Trip, type PublicTrip, type PaginatedTrips, type RouteComment, type RouteImage, type CommunityMedia } from '../api';

// ── Query key factory ─────────────────────────────────────────────────────────

export const tripKeys = {
  // Private (AI-generated) routes
  routes: () => ['routes'] as const,
  route: (id: string) => ['routes', id] as const,

  // Public trips feed
  publicList: (filters: Record<string, string | undefined>) =>
    ['publicTrips', 'list', filters] as const,
  publicDetail: (id: number) => ['publicTrips', id] as const,
  publicLikes: (id: number) => ['publicTrips', id, 'likes'] as const,
  publicRating: (id: number) => ['publicTrips', id, 'rating'] as const,
  publicComments: (id: number) => ['publicTrips', id, 'comments'] as const,
  publicImages: (id: number) => ['publicTrips', id, 'images'] as const,
  publicCommunityMedia: (id: number) => ['publicTrips', id, 'communityMedia'] as const,

  // My trips list (for profile page)
  myTrips: () => ['users', 'me', 'trips'] as const,
};

// ── Private routes (MyTrips page) ─────────────────────────────────────────────

export function useMyRoutes() {
  return useQuery<Trip[]>({
    queryKey: tripKeys.routes(),
    queryFn: () => api.trips.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useRoute(id: string | null) {
  return useQuery<Trip>({
    queryKey: tripKeys.route(id ?? ''),
    queryFn: () => api.trips.get(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/** Delete a private route and remove it from the list cache immediately. */
export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.trips.delete(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<Trip[]>(tripKeys.routes(), prev =>
        prev?.filter(t => t.id !== id) ?? [],
      );
    },
  });
}

// ── Public trips feed ─────────────────────────────────────────────────────────

export type PublicTripFilters = {
  region?: string;
  difficulty?: string;
  style?: string;
  group_type?: string;
};

export function usePublicTrips(filters: PublicTripFilters = {}) {
  return useQuery<PublicTrip[]>({
    queryKey: tripKeys.publicList(filters),
    queryFn: () => api.publicTrips.list(filters),
    staleTime: 3 * 60 * 1000,   // feed stays fresh 3 min
    gcTime: 15 * 60 * 1000,
  });
}

const PAGE_SIZE = 10;

/**
 * Infinite-scroll variant of the public trips feed.
 *
 * Fetches PAGE_SIZE (10) trips at a time instead of the whole feed in one
 * request. Call `fetchNextPage()` (wired to an intersection observer in
 * PublicTrips.tsx) when the user scrolls near the bottom of the list to load
 * the next page. React Query keeps every fetched page cached under one query
 * key, so scrolling back up doesn't refetch already-seen pages.
 */
export function usePublicTripsInfinite(filters: PublicTripFilters = {}) {
  return useInfiniteQuery<PaginatedTrips>({
    queryKey: [...tripKeys.publicList(filters), 'infinite'] as const,
    queryFn: ({ pageParam }) =>
      api.publicTrips.listPaginated({ ...filters, limit: PAGE_SIZE, offset: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.length * PAGE_SIZE : undefined,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function usePublicTrip(id: number | null) {
  return useQuery<PublicTrip>({
    queryKey: tripKeys.publicDetail(id ?? 0),
    queryFn: () => api.publicTrips.get(id!),
    enabled: id != null && id > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Social: likes ─────────────────────────────────────────────────────────────

export function useTripLikes(tripId: number, enabled = true) {
  return useQuery<{ liked: boolean; likes_count: number }>({
    queryKey: tripKeys.publicLikes(tripId),
    queryFn: () => api.publicTrips.getLikes(tripId),
    enabled: enabled && tripId > 0,
    staleTime: 2 * 60 * 1000,
  });
}

export function useToggleTripLike(tripId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.publicTrips.toggleLike(tripId),
    // Optimistic update: flip liked state immediately
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: tripKeys.publicLikes(tripId) });
      const prev = qc.getQueryData<{ liked: boolean; likes_count: number }>(
        tripKeys.publicLikes(tripId),
      );
      if (prev) {
        qc.setQueryData(tripKeys.publicLikes(tripId), {
          liked: !prev.liked,
          likes_count: prev.liked ? prev.likes_count - 1 : prev.likes_count + 1,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(tripKeys.publicLikes(tripId), ctx.prev);
    },
    onSuccess: (data) => {
      qc.setQueryData(tripKeys.publicLikes(tripId), data);
    },
  });
}

// ── Social: ratings ───────────────────────────────────────────────────────────

export function useTripRating(tripId: number, enabled = true) {
  return useQuery<{ average_rating: number; ratings_count: number; user_rating: number | null }>({
    queryKey: tripKeys.publicRating(tripId),
    queryFn: () => api.publicTrips.getRating(tripId),
    enabled: enabled && tripId > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetTripRating(tripId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rating: number) => api.publicTrips.setRating(tripId, rating),
    onSuccess: (data) => {
      qc.setQueryData(tripKeys.publicRating(tripId), data);
    },
  });
}

// ── Social: comments ──────────────────────────────────────────────────────────

export function useTripComments(tripId: number, enabled = true) {
  return useQuery<RouteComment[]>({
    queryKey: tripKeys.publicComments(tripId),
    queryFn: () => api.publicTrips.getComments(tripId),
    enabled: enabled && tripId > 0,
    staleTime: 60 * 1000,   // comments refresh every minute
  });
}

export function useAddTripComment(tripId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.publicTrips.addComment(tripId, content),
    onSuccess: (newComment) => {
      qc.setQueryData<RouteComment[]>(
        tripKeys.publicComments(tripId),
        prev => [...(prev ?? []), newComment],
      );
    },
  });
}

export function useDeleteTripComment(tripId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => api.publicTrips.deleteComment(tripId, commentId),
    onSuccess: (_data, commentId) => {
      qc.setQueryData<RouteComment[]>(
        tripKeys.publicComments(tripId),
        prev => prev?.filter(c => c.id !== commentId) ?? [],
      );
    },
  });
}

// ── Media: route images ───────────────────────────────────────────────────────

export function useTripImages(tripId: number, enabled = true) {
  return useQuery<RouteImage[]>({
    queryKey: tripKeys.publicImages(tripId),
    queryFn: () => api.publicTrips.getImages(tripId),
    enabled: enabled && tripId > 0,
    staleTime: 10 * 60 * 1000,
  });
}

// ── Media: community media ────────────────────────────────────────────────────

export function useTripCommunityMedia(tripId: number, enabled = true) {
  return useQuery<CommunityMedia[]>({
    queryKey: tripKeys.publicCommunityMedia(tripId),
    queryFn: () => api.publicTrips.getCommunityMedia(tripId),
    enabled: enabled && tripId > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddTripCommunityMedia(tripId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, media_type, caption }: { url: string; media_type: 'image' | 'video'; caption?: string }) =>
      api.publicTrips.addCommunityMedia(tripId, url, media_type, caption),
    onSuccess: (data) => {
      qc.setQueryData<CommunityMedia[]>(
        tripKeys.publicCommunityMedia(tripId),
        prev => [...(prev ?? []), data],
      );
    },
  });
}

export function useDeleteTripCommunityMedia(tripId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: number) => api.publicTrips.deleteCommunityMedia(tripId, mediaId),
    onSuccess: (_data, mediaId) => {
      qc.setQueryData<CommunityMedia[]>(
        tripKeys.publicCommunityMedia(tripId),
        prev => prev?.filter(m => m.id !== mediaId) ?? [],
      );
    },
  });
}

/** Call after publishing/updating a trip so the feed and detail both refresh. */
export function useInvalidateTrip() {
  const qc = useQueryClient();
  return (tripId?: number) => {
    qc.invalidateQueries({ queryKey: tripKeys.routes() });
    if (tripId) {
      qc.invalidateQueries({ queryKey: tripKeys.publicDetail(tripId) });
    } else {
      // Invalidate all public trip list variants
      qc.invalidateQueries({ queryKey: ['publicTrips', 'list'] });
    }
  };
}
