import { Router, Request, Response } from 'express';
import { startSyncJob, getSyncStatus } from '../jobs/syncJobs';

const router = Router();

// POST /sync/kkl
router.post('/kkl', async (_req: Request, res: Response) => {
  try {
    const jobId = await startSyncJob('kkl');
    res.json({ message: 'KKL sync started', jobId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sync/inpa
router.post('/inpa', async (_req: Request, res: Response) => {
  try {
    const jobId = await startSyncJob('inpa');
    res.json({ message: 'INPA sync started', jobId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sync/osm  (OpenStreetMap — recommended starter)
router.post('/osm', async (_req: Request, res: Response) => {
  try {
    const jobId = await startSyncJob('osm');
    res.json({ message: 'OSM sync started', jobId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sync/status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const jobId = req.query.jobId as string | undefined;
    const status = await getSyncStatus(jobId);

    if (jobId && !status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(status || { totalLocations: 0, processedLocations: 0, progressPercentage: 0, status: 'idle' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
