import { useState, useCallback, useRef } from 'react';

export interface UseImageUploadReturn {
    selectedFile: File | null;
    previewUrl: string | null;
    isUploading: boolean;
    uploadError: string | null;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploadFile: () => Promise<string>;
    reset: () => void;
}

export function useImageUpload(): UseImageUploadReturn {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const objectUrlRef = useRef<string | null>(null);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;

        // Revoke any previous object URL to avoid memory leaks
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }

        if (!file) {
            setSelectedFile(null);
            setPreviewUrl(null);
            return;
        }

        // Instant local preview via createObjectURL
        const localUrl = URL.createObjectURL(file);
        objectUrlRef.current = localUrl;

        setSelectedFile(file);
        setPreviewUrl(localUrl);
        setUploadError(null);
    }, []);

    const uploadFile = useCallback(async (): Promise<string> => {
        if (!selectedFile) throw new Error('No file selected');

        setIsUploading(true);
        setUploadError(null);

        try {
            // FIX: Use FormData (multipart) instead of base64 JSON.
            // base64 inflates file size ~33% and Next.js JSON body limit is 4 MB,
            // causing "Failed to fetch" for photos over ~3 MB.
            const token = localStorage.getItem('router_auth_token');
            const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

            const form = new FormData();
            form.append('file', selectedFile);

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
                throw new Error(json?.error?.message ?? `Upload failed (HTTP ${res.status})`);
            }

            const json = await res.json();
            const publicUrl: string = json?.data?.url;
            if (!publicUrl) throw new Error('No URL returned from upload API');

            return publicUrl;
        } catch (err) {
            const msg = (err as Error)?.message ?? 'Upload failed';
            setUploadError(msg);
            throw err;
        } finally {
            setIsUploading(false);
        }
    }, [selectedFile]);

    const reset = useCallback(() => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        setSelectedFile(null);
        setPreviewUrl(null);
        setIsUploading(false);
        setUploadError(null);
    }, []);

    return { selectedFile, previewUrl, isUploading, uploadError, handleFileChange, uploadFile, reset };
}
