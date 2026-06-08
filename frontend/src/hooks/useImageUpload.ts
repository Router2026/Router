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
            const base64 = await fileToBase64(selectedFile);
            const token = localStorage.getItem('router_auth_token');
            const apiBase = import.meta.env.VITE_API_URL ?? '';

            const res = await fetch(`${apiBase}/api/media/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    media_data: base64,
                    mime_type: selectedFile.type,
                }),
            });

            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error?.message ?? `Upload failed (HTTP ${res.status})`);
            }

            const json = await res.json();
            const publicUrl: string = json?.data?.url;
            if (!publicUrl) throw new Error('No URL returned from upload API');

            return publicUrl;
        } catch (err: any) {
            const msg = err?.message ?? 'Upload failed';
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

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`FileReader failed for ${file.name}`));
        reader.readAsDataURL(file);
    });
}