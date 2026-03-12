import { Router, Request, Response } from 'express';
import { getCurrentUser, getLeaderboard, getStats } from '../services/userService';

const router = Router();

// GET /users/me
router.get('/me', async (_req: Request, res: Response) => {
  try {
    const user = await getCurrentUser();
    res.json({ data: user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/leaderboard
router.get('/leaderboard', async (_req: Request, res: Response) => {
  try {
    const users = await getLeaderboard();
    res.json({ data: users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/stats  — app-wide summary stats
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getStats();
    res.json({ data: stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
