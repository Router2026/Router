import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possibleEnvPaths = [
    path.resolve(__dirname, '../.env.local'),
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../frontend/.env.local'),
    path.resolve(__dirname, '../../client/.env.local'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
];

for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        process.loadEnvFile(envPath);
    }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials!');
    process.exit(1);
}

const BUCKET_NAME = 'location-media';
const CONCURRENCY = 10;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const jsonPath = [
    path.resolve(__dirname, './heavy-files.json'),
    path.resolve(__dirname, '../heavy-files.json'),
    path.resolve(__dirname, '../../heavy-files.json'),
].find((p) => fs.existsSync(p));

if (!jsonPath) {
    console.error('Could not find heavy-files.json!');
    process.exit(1);
}

let files = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// חילוץ המערך האמיתי מתוך העטיפה של ה-SQL Editor ב-Supabase
if (Array.isArray(files) && files.length === 1 && files[0].json_agg) {
    files = files[0].json_agg;
} else if (files.json_agg) {
    files = files.json_agg;
}
let totalSavedBytes = 0;
let processedCount = 0;

async function processSingleFile(file, index) {
    try {
        const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET_NAME).download(file.name);
        if (downloadError) return;

        const originalBuffer = Buffer.from(await blob.arrayBuffer());
        const originalSize = originalBuffer.length;

        // כיווץ אגרסיבי: 1024 פיקסלים, איכות 60
        const compressedBuffer = await sharp(originalBuffer)
            .rotate()
            .resize({
                width: 1024,
                height: 1024,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .jpeg({ quality: 60, mozjpeg: true })
            .toBuffer();

        const newSize = compressedBuffer.length;

        if (newSize >= originalSize * 0.9) {
            processedCount++;
            return;
        }

        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(file.name, compressedBuffer, {
                upsert: true,
                contentType: 'image/jpeg',
                cacheControl: '31536000',
            });

        if (uploadError) return;

        totalSavedBytes += originalSize - newSize;
        processedCount++;

        console.log(`[${processedCount}/${files.length}] ${file.name}: ${(originalSize / (1024 * 1024)).toFixed(2)}MB -> ${(newSize / 1024).toFixed(0)}KB`);
    } catch (err) {
        console.error(`Error (${file.name}):`, err.message);
    }
}

async function runBatchCompression() {
    console.log(`Starting aggressive compression for ${files.length} heavy files...`);
    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((file, batchIdx) => processSingleFile(file, i + batchIdx)));
    }
    console.log(`\nDone! Total space saved: ${(totalSavedBytes / (1024 * 1024)).toFixed(2)} MB`);
}

runBatchCompression();