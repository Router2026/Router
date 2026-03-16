import { rawDb } from '@/lib/db/raw-client';

export interface VideoPost {
  id: number;
  title: string;
  description?: string;
  region?: string;
  uploader_name: string;
  video_url?: string;
  thumbnail_url?: string;
  likes_count: number;
  views_count: number;
  created_at: Date;
}

export async function getVideos(): Promise<VideoPost[]> {
  const { rows } = await rawDb.query(`SELECT * FROM video_posts ORDER BY created_at DESC`);
  return rows as unknown as VideoPost[];
}

export async function createVideo(data: Partial<VideoPost>): Promise<VideoPost> {
  const { rows } = await rawDb.query(
    `INSERT INTO video_posts (title, description, region, uploader_name, video_url, thumbnail_url)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      data.title,
      data.description || null,
      data.region || null,
      data.uploader_name || 'אנונימי',
      data.video_url || null,
      data.thumbnail_url || null,
    ]
  );
  return rows[0] as unknown as VideoPost;
}

export async function likeVideo(id: number): Promise<VideoPost | null> {
  const { rows } = await rawDb.query(
    `UPDATE video_posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING *`,
    [id]
  );
  return (rows[0] as unknown as VideoPost) || null;
}
