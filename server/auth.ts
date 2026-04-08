import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_NAME = 'meal_planner_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export const authEnabled = !!AUTH_PASSWORD;

const router = Router();

// Check if user is authenticated
router.get('/check', (req: Request, res: Response) => {
  if (!authEnabled) return res.json({ authenticated: true });

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ authenticated: false });

  try {
    jwt.verify(token, AUTH_SECRET);
    res.json({ authenticated: true });
  } catch {
    res.status(401).json({ authenticated: false });
  }
});

// Login
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;

  if (!authEnabled) return res.json({ ok: true });

  if (password !== AUTH_PASSWORD) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }

  const token = jwt.sign({ auth: true }, AUTH_SECRET, { expiresIn: '30d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });
  res.json({ ok: true });
});

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// Middleware to protect API routes
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!authEnabled) return next();

  // Allow auth routes through
  if (req.path.startsWith('/auth/') || req.path.startsWith('/auth')) return next();

  // Allow recipe pages (for Bring! scraping, includes share token URLs)
  if (req.path.startsWith('/recipe/')) return next();

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    jwt.verify(token, AUTH_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}

export default router;
