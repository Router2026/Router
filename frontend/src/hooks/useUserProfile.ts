// src/hooks/useUserProfile.ts
// Centralised caching hooks for user-profile data.
// Covers the authenticated user's own profile, public user profiles,
// the leaderboard, and community-POI submissions.
//
// Cache design:
//   userKeys.me()              — /users/me (Profile + ProfileEdit pages)
//   userKeys.public(id)        — /users/:id (PublicUserProfile page)
//   userKeys.myPlaces()        — /community-pois/my (MyPlaces page)
//   userKeys.leaderboard()     — /users/leaderboard (Leaderboard page)
//   userKeys.stats()           — /users/stats (Register page counter)
//
// After updateMe(), the cached profile is patched directly — no refetch.
// After POI create/delete, myPlaces is invalidated (small list, cheap).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type UserProfile, type CommunityPoiSubmission } from '../api';

// ── Query key factory ─────────────────────────────────────────────────────────

export const userKeys = {
  all: () => ['users'] as const,
  me: () => ['users', 'me'] as const,
  public: (id: number) => ['users', 'public', id] as const,
  myPlaces: () => ['users', 'myPlaces'] as const,
  leaderboard: () => ['users', 'leaderboard'] as const,
  stats: () => ['users', 'stats'] as const,
};

// ── Own profile ───────────────────────────────────────────────────────────────

export function useMe(enabled = true) {
  return useQuery<UserProfile>({
    queryKey: userKeys.me(),
    queryFn: () => api.users.me(),
    enabled,
    staleTime: 5 * 60 * 1000,   // profile data doesn't change often
    gcTime: 30 * 60 * 1000,
  });
}

/** Update the authenticated user's profile and patch the cache in-place. */
export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.users.updateMe>[0]) =>
      api.users.updateMe(data),
    onSuccess: (updated) => {
      // Patch cache immediately — no loading spinner on re-navigate.
      qc.setQueryData<UserProfile>(userKeys.me(), updated);
    },
  });
}

// ── Public user profile (PublicUserProfile page) ──────────────────────────────

export function usePublicUserProfile(userId: number | null) {
  return useQuery<{ profile: UserProfile; trips: unknown[]; community_pois: CommunityPoiSubmission[] }>({
    queryKey: userKeys.public(userId ?? 0),
    queryFn: () => api.userProfiles.get(userId!),
    enabled: !!userId && userId > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ── My community-POI submissions (MyPlaces page) ──────────────────────────────

export function useMyPlaces(enabled = true) {
  return useQuery<CommunityPoiSubmission[]>({
    queryKey: userKeys.myPlaces(),
    queryFn: () => api.communityPois.myPlaces(),
    enabled,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/** Delete a community POI and remove it from the cached list immediately. */
export function useDeleteMyPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.communityPois.delete(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<CommunityPoiSubmission[]>(userKeys.myPlaces(), prev =>
        prev?.filter(p => p.id !== id) ?? [],
      );
    },
  });
}

/** Update a pending/rejected community POI and patch the list in-place. */
export function useUpdateMyPlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.communityPois.update>[1] }) =>
      api.communityPois.update(id, data),
    onSuccess: (updated) => {
      qc.setQueryData<CommunityPoiSubmission[]>(userKeys.myPlaces(), prev =>
        prev?.map(p => p.id === updated.id ? updated : p) ?? [],
      );
    },
  });
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export function useLeaderboard() {
  return useQuery<UserProfile[]>({
    queryKey: userKeys.leaderboard(),
    queryFn: () => api.users.leaderboard(),
    staleTime: 10 * 60 * 1000,   // leaderboard changes infrequently
    gcTime: 30 * 60 * 1000,
  });
}

// ── App stats (used in Register page) ────────────────────────────────────────

export function useAppStats() {
  return useQuery({
    queryKey: userKeys.stats(),
    queryFn: () => api.users.stats(),
    staleTime: 60 * 60 * 1000,   // totals change slowly
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Invalidate profile-related caches after an action that modifies XP/stats
 * (e.g. publishing a trip, submitting a review, uploading media).
 */
export function useInvalidateMe() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: userKeys.me() });
  };
}
