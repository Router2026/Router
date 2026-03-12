import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getLocations,
  getLocationById,
  getLocationsInBounds,
  getLocationClusters,
} from '../services/locationService';

const router = Router();

// ── GET /locations ─────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = {
      region:     req.query.region     as string | undefined,
      category:   req.query.category   as string | undefined,
      difficulty: req.query.difficulty as string | undefined,
      search:     req.query.search     as string | undefined,
      has_water:  req.query.has_water  === 'true',
      has_shade:  req.query.has_shade  === 'true',
      accessible: req.query.accessible === 'true',
      limit:      req.query.limit  ? parseInt(req.query.limit  as string) : 200,
      offset:     req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const locations = await getLocations(query);
    res.json({ data: locations, total: locations.length });
  } catch (err: any) {
    console.error('GET /locations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /locations/map  (viewport query) ──────────────────────────────────
router.get('/map', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      north: z.coerce.number(),
      south: z.coerce.number(),
      east:  z.coerce.number(),
      west:  z.coerce.number(),
    });
    const bounds = schema.parse(req.query);
    const locations = await getLocationsInBounds(bounds);
    res.json({ data: locations, total: locations.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /locations/clusters ────────────────────────────────────────────────
router.get('/clusters', async (req: Request, res: Response) => {
  try {
    let bounds;
    if (req.query.north && req.query.south && req.query.east && req.query.west) {
      bounds = {
        north: parseFloat(req.query.north as string),
        south: parseFloat(req.query.south as string),
        east:  parseFloat(req.query.east  as string),
        west:  parseFloat(req.query.west  as string),
      };
    }
    const clusters = await getLocationClusters(bounds);
    res.json({ data: clusters });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /locations/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const location = await getLocationById(id);
    if (!location) return res.status(404).json({ error: 'Location not found' });

    res.json({ data: location });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
