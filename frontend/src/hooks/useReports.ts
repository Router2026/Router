// src/hooks/useReports.ts
// Centralised caching hooks for community reports.
// Replaces the inline useQuery in Reports.tsx and the bare useEffect in Profile.tsx.
//
// Cache design:
//   reportKeys.list(type)  — per-type cache, so switching filter tabs is instant
//   reportKeys.mine()      — the authenticated user's own reports (Profile page)
//
// Upvote uses an optimistic mutation: the counter flips in the cache immediately
// and rolls back if the server call fails — no full refetch needed.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CommunityReport } from '../api';

// ── Query key factory ─────────────────────────────────────────────────────────

export const reportKeys = {
  all: () => ['reports'] as const,
  list: (type?: string) => ['reports', 'list', type ?? 'all'] as const,
  mine: (userId?: string | number) => ['reports', 'mine', String(userId ?? 'me')] as const,
};

// ── Public report list (Reports page — filterable by type) ────────────────────

export function useReports(type?: string) {
  return useQuery<CommunityReport[]>({
    queryKey: reportKeys.list(type),
    queryFn: () => api.reports.list({ type }),
    staleTime: 2 * 60 * 1000,   // reports are time-sensitive; 2 min is enough
    gcTime: 10 * 60 * 1000,
  });
}

// ── My reports (Profile page — current user only) ─────────────────────────────

export function useMyReports(userId?: string | number) {
  return useQuery<CommunityReport[]>({
    queryKey: reportKeys.mine(userId),
    queryFn: () => api.reports.myReports(),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ── Upvote mutation with optimistic update ────────────────────────────────────
// Updates every cached list that contains this report ID so the counter stays
// consistent across the Reports page (which may have multiple types cached).

export function useUpvoteReport(activeType?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'add' | 'remove' }) =>
      api.reports.upvote(id, action),

    onMutate: async ({ id, action }) => {
      // Cancel any in-flight refetches that would overwrite our optimistic update.
      await qc.cancelQueries({ queryKey: reportKeys.list(activeType) });

      const delta = action === 'add' ? 1 : -1;
      const snapshot = qc.getQueryData<CommunityReport[]>(reportKeys.list(activeType));

      // Apply optimistic update to the currently-visible list.
      qc.setQueryData<CommunityReport[]>(reportKeys.list(activeType), prev =>
        prev?.map(r =>
          r.id === id ? { ...r, upvotes: Math.max(0, r.upvotes + delta) } : r,
        ) ?? [],
      );

      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      // Roll back to the snapshot on failure.
      if (ctx?.snapshot !== undefined) {
        qc.setQueryData(reportKeys.list(activeType), ctx.snapshot);
      }
    },

    onSuccess: (updated) => {
      // Sync all cached type-lists that contain this report.
      const allQueries = qc.getQueriesData<CommunityReport[]>({ queryKey: reportKeys.all() });
      for (const [key, data] of allQueries) {
        if (!Array.isArray(data)) continue;
        if (!data.some(r => r.id === updated.id)) continue;
        qc.setQueryData<CommunityReport[]>(key, prev =>
          prev?.map(r => r.id === updated.id ? updated : r) ?? [],
        );
      }
    },
  });
}

// ── Create report and prepend to the active list cache ───────────────────────

export function useCreateReport(activeType?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.reports.create>[0]) =>
      api.reports.create(data),
    onSuccess: (newReport) => {
      // Prepend to the relevant list(s) so the user sees their report immediately.
      const matchesType =
        !activeType || newReport.report_type === activeType;
      if (matchesType) {
        qc.setQueryData<CommunityReport[]>(reportKeys.list(activeType), prev =>
          prev ? [newReport, ...prev] : [newReport],
        );
      }
      // Always prepend to the "all" list too.
      qc.setQueryData<CommunityReport[]>(reportKeys.list(), prev =>
        prev ? [newReport, ...prev] : [newReport],
      );
      // Invalidate my-reports so the Profile page refreshes.
      qc.invalidateQueries({ queryKey: reportKeys.all() });
    },
  });
}
