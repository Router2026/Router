import { Router, Request, Response } from 'express';
import { getReports, createReport, upvoteReport } from '../services/reportService';

const router = Router();

// GET /reports?location_id=123
router.get('/', async (req: Request, res: Response) => {
  try {
    const locationId = req.query.location_id ? parseInt(req.query.location_id as string) : undefined;
    const reports = await getReports(locationId);
    res.json({ data: reports, total: reports.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /reports
router.post('/', async (req: Request, res: Response) => {
  try {
    const report = await createReport(req.body);
    res.status(201).json({ data: report });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /reports/:id/upvote
router.patch('/:id/upvote', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const report = await upvoteReport(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ data: report });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
