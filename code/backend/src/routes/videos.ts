import { Router, Request, Response } from 'express';
import { getVideos, createVideo, likeVideo } from '../services/videoService';

const router = Router();

// GET /videos
router.get('/', async (_req: Request, res: Response) => {
  try {
    const videos = await getVideos();
    res.json({ data: videos, total: videos.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /videos
router.post('/', async (req: Request, res: Response) => {
  try {
    const video = await createVideo(req.body);
    res.status(201).json({ data: video });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /videos/:id/like
router.patch('/:id/like', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const video = await likeVideo(id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json({ data: video });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
