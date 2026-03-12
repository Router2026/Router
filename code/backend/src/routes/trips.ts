import { Router, Request, Response } from 'express';
import { getTrips, getTripById, createTrip } from '../services/tripService';

const router = Router();

// GET /trips
router.get('/', async (_req: Request, res: Response) => {
  try {
    const trips = await getTrips();
    res.json({ data: trips, total: trips.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /trips/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const trip = await getTripById(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json({ data: trip });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /trips
router.post('/', async (req: Request, res: Response) => {
  try {
    const trip = await createTrip(req.body);
    res.status(201).json({ data: trip });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
