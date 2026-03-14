import { Router, Response } from 'express';
import { db } from '../config/db';
import { requireAuth, type AuthenticatedRequest } from './auth';

const router = Router();

// ── GET /favorites  — list the logged-in user's saved location IDs ──────────
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { rows } = await db.query(
            `SELECT location_id FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.userId],
        );
        res.json({ data: rows.map((r: any) => r.location_id) });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /favorites/:locationId  — add to favorites ─────────────────────────
router.post('/:locationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const locationId = parseInt(req.params.locationId);
        if (isNaN(locationId)) return res.status(400).json({ error: 'Invalid location ID' });

        await db.query(
            `INSERT INTO user_favorites (user_id, location_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, location_id) DO NOTHING`,
            [req.userId, locationId],
        );
        res.status(201).json({ data: { location_id: locationId, saved: true } });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /favorites/:locationId  — remove from favorites ──────────────────
router.delete('/:locationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const locationId = parseInt(req.params.locationId);
        if (isNaN(locationId)) return res.status(400).json({ error: 'Invalid location ID' });

        await db.query(
            `DELETE FROM user_favorites WHERE user_id = $1 AND location_id = $2`,
            [req.userId, locationId],
        );
        res.json({ data: { location_id: locationId, saved: false } });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;