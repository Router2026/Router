import { Router, Request, Response } from 'express';
import { getAllRegions, getRegionBySlug } from '../services/regionService';

const router = Router();

// GET /regions
router.get('/', async (_req: Request, res: Response) => {
  try {
    const regions = await getAllRegions();
    res.json({ data: regions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /regions/:slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const region = await getRegionBySlug(req.params.slug);
    if (!region) return res.status(404).json({ error: 'Region not found' });
    res.json({ data: region });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
