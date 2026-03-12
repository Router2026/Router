import { Router, Request, Response } from 'express';
import { getReviews, createReview } from '../services/reviewService';

const router = Router();

// GET /reviews?location_id=123
router.get('/', async (req: Request, res: Response) => {
  try {
    const locationId = req.query.location_id ? parseInt(req.query.location_id as string) : undefined;
    const reviews = await getReviews(locationId);
    res.json({ data: reviews, total: reviews.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /reviews
router.post('/', async (req: Request, res: Response) => {
  try {
    const review = await createReview(req.body);
    res.status(201).json({ data: review });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
