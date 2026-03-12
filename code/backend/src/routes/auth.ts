import { Router, Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, verifyToken, getUserById } from '../services/authService';

const router = Router();

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, display_name } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'שם, אימייל וסיסמה נדרשים' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
    }
    const { user, token } = await registerUser(email, password, full_name, display_name);
    res.status(201).json({ data: { user: sanitize(user), token } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'אימייל וסיסמה נדרשים' });
    const { user, token } = await loginUser(email, password);
    res.json({ data: { user: sanitize(user), token } });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// GET /auth/me  (requires Bearer token)
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await getUserById(req.userId!);
    if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
    res.json({ data: sanitize(user) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Auth Middleware ──────────────────────────────────────────────
export interface AuthenticatedRequest extends Request {
  userId?: number;
  userEmail?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'נדרשת התחברות' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'טוקן לא תקין או פג תוקפו' });
  }
}

// Strip sensitive fields before returning user
function sanitize(user: any) {
  const { password_hash, refresh_token, ...safe } = user;
  return safe;
}

export default router;
