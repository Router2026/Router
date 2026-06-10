/**
 * useMultiImageUpload.ts
 * ──────────────────────
 * Reusable hook that handles the full multi-file image upload lifecycle:
 *
 *  1. User selects one or more files from <input multiple>
 *  2. Each file gets an instant local preview via URL.createObjectURL()
 *  3. On submit, ALL files are uploaded concurrently to /api/media/upload
 *     via Promise.all, and the resulting public URL strings are returned.
 *  4. Blob URLs are revoked on reset to prevent memory leaks.
 *
 * Used by:
 *   • UploadPhotoButton  — single-file media upload to location_media
 *   • POIDetailsEditAdmin — multiple gallery images for locations.images
 *   • ContributePOI       — multiple photos for community_pois.photos
 */

import { useState, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectedFile {
  /** The raw browser File object. */
  file: File;
  /** Local blob: URL for immediate preview — revoked automatically on reset. */
  previewUrl: string;
}

export interface UseMultiImageUploadReturn {
  /** Currently selected files with their preview URLs. */
  selectedFiles: SelectedFile[];
  /** Whether an upload to /api/media/upload is in progress. */
  isUploading: boolean;
  /** Error message from the most recent upload attempt, if any. */
  uploadError: string | null;
  /**
   * Attach to <input type="file" multiple onChange={...} />.
   * Replaces the current selection (does NOT append).
   */
  handleFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /**
   * Upload all currently selected files concurrently via Promise.all.
   * Returns an array of Supabase Storage public URL strings.
   * Throws on failure — caller should catch and surface the error.
   */
  uploadAll: () => Promise<string[]>;
  /**
   * Remove a single file from the selection by index.
   * Revokes the associated blob URL.
   */
  removeFile: (index: number) => void;
  /** Clear the entire selection and revoke all blob URLs. */
  reset: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMultiImageUpload(): UseMultiImageUploadReturn {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Keep blob URLs in a ref so they can be revoked even after state is cleared.
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // ── handleFilesChange ──────────────────────────────────────────────────────
  const handleFilesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      // Revoke any previously created blob URLs before replacing the selection.
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();

      const newFiles: SelectedFile[] = Array.from(fileList).map(file => {
        // KEY: createObjectURL is synchronous and returns a local blob: URL
        // that works immediately — no FileReader, no network, no delay.
        const previewUrl = URL.createObjectURL(file);
        blobUrlsRef.current.add(previewUrl);
        return { file, previewUrl };
      });

      setSelectedFiles(newFiles);
      setUploadError(null);
    },
    [],
  );

  // ── uploadAll ──────────────────────────────────────────────────────────────
  const uploadAll = useCallback(async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return [];

    setIsUploading(true);
    setUploadError(null);

    try {
      const token = localStorage.getItem('router_auth_token');
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

      // Upload every file concurrently — Promise.all waits for all to settle.
      // If any single upload rejects, the whole Promise.all rejects.
      //
      // FIX: Use FormData (multipart) instead of base64 JSON.
      // base64 inflates each file ~33% and Next.js JSON body limit is 4 MB,
      // causing "Failed to fetch" silently for photos over ~3 MB.
      const publicUrls = await Promise.all(
        selectedFiles.map(async ({ file }) => {
          // Step A: Wrap in FormData — browser sets the multipart boundary automatically
          const form = new FormData();
          form.append('file', file);

          // Step B: POST to /api/media/upload
          const res = await fetch(`${apiBase}/api/media/upload`, {
            method: 'POST',
            headers: {
              // No Content-Type header — browser sets it with the multipart boundary
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: form,
          });

          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(
              (json as any)?.error?.message ?? `Upload failed: HTTP ${res.status}`,
            );
          }

          // Step C: Extract the Supabase Storage public URL
          const json = await res.json();
          const publicUrl: string | undefined = (json as any)?.data?.url;
          if (!publicUrl) throw new Error(`No URL returned for file: ${file.name}`);

          return publicUrl;
        }),
      );

      return publicUrls;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      throw err; // re-throw so the calling submit handler can react
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles]);

  // ── removeFile ─────────────────────────────────────────────────────────────
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        blobUrlsRef.current.delete(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ── reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    blobUrlsRef.current.clear();
    setSelectedFiles([]);
    setIsUploading(false);
    setUploadError(null);
  }, []);

  return {
    selectedFiles,
    isUploading,
    uploadError,
    handleFilesChange,
    uploadAll,
    removeFile,
    reset,
  };
}