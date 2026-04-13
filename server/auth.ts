import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { queryOne, queryAll, runSql, getLastInsertRowId, saveDb, getDb } from './db.js';

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      name: string;
    }
    interface Request {
      groupId?: number | null;
    }
  }
}

const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
export const COOKIE_NAME = 'meal_planner_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface JwtPayload {
  userId: number;
  groupId: number | null;
}

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: '30d' });
}

function setCookieToken(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });
}

function createGroupForUser(userId: number, groupName: string): number {
  const inviteCode = crypto.randomBytes(4).toString('hex');
  runSql('INSERT INTO groups (name, invite_code) VALUES (?, ?)', [groupName, inviteCode]);
  const group = queryOne('SELECT * FROM groups WHERE invite_code = ?', [inviteCode]);
  const groupId = group?.id as number;
  runSql('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, userId, 'owner']);
  return groupId;
}

// Setup Passport Google OAuth strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3200'}/api/auth/google/callback`,
      },
      (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || '';
          const name = profile.displayName || email;
          const googleId = profile.id;

          // Find by google_id first, then by email
          let user = queryOne('SELECT * FROM users WHERE google_id = ?', [googleId]);
          if (!user && email) {
            user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
            if (user) {
              // Link google_id to existing account
              runSql('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
              user = queryOne('SELECT * FROM users WHERE id = ?', [user.id]);
            }
          }

          if (!user) {
            // Create new user
            runSql(
              'INSERT INTO users (email, name, google_id) VALUES (?, ?, ?)',
              [email, name, googleId]
            );
            const newUser = queryOne('SELECT * FROM users WHERE google_id = ?', [googleId]);
            if (!newUser) return done(new Error('Failed to create user'));

            // Claim migrated group if available, otherwise create a new one
            const claimMeta = queryOne("SELECT value FROM _meta WHERE key = 'claim_group_id'");
            if (claimMeta) {
              const migratedGroupId = Number(claimMeta.value);
              runSql('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [migratedGroupId, newUser.id, 'owner']);
              runSql("DELETE FROM _meta WHERE key = 'claim_group_id'");
            } else {
              createGroupForUser(newUser.id, `${name}s Haushalt`);
            }

            user = newUser;
          }

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser((id: number, done) => {
  const user = queryOne('SELECT * FROM users WHERE id = ?', [id]);
  done(null, user || null);
});

const router = Router();

// GET /providers — public, returns which OAuth providers are configured
router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
});

// GET /check
router.get('/check', (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ authenticated: false });

  try {
    const payload = jwt.verify(token, AUTH_SECRET) as any;
    // Reject old-format tokens
    if (!payload.userId) {
      return res.status(401).json({ authenticated: false });
    }
    const user = queryOne('SELECT id, email, name FROM users WHERE id = ?', [payload.userId]);
    if (!user) return res.status(401).json({ authenticated: false });

    // Validate groupId — user may have left, been removed, or the group was deleted
    let groupId: number | null = payload.groupId ?? null;
    if (groupId !== null) {
      // JOIN with groups to also catch deleted groups with orphaned group_members rows
      const membership = queryOne(
        `SELECT gm.* FROM group_members gm
         JOIN groups g ON g.id = gm.group_id
         WHERE gm.group_id = ? AND gm.user_id = ?`,
        [groupId, user.id]
      );
      if (!membership) {
        // No longer a member — fall back to their first remaining group
        const firstGroup = queryOne(
          `SELECT gm.group_id FROM group_members gm
           JOIN groups g ON g.id = gm.group_id
           WHERE gm.user_id = ? ORDER BY gm.joined_at ASC LIMIT 1`,
          [user.id]
        );
        groupId = firstGroup?.group_id ?? null;
        // Rewrite the cookie so subsequent API calls use the correct groupId
        setCookieToken(res, signToken({ userId: user.id, groupId }));
      }
    }

    res.json({
      authenticated: true,
      user: { id: user.id, name: user.name, email: user.email },
      groupId,
      smtpEnabled: !!process.env.SMTP_HOST,
    });
  } catch {
    res.status(401).json({ authenticated: false });
  }
});

// POST /register
router.post('/register', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  if (!email?.trim() || !name?.trim() || !password) {
    return res.status(400).json({ error: 'email, name and password required' });
  }

  const existing = queryOne('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    runSql(
      'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      [email.trim().toLowerCase(), name.trim(), passwordHash]
    );
    const user = queryOne('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) return res.status(500).json({ error: 'Failed to create user' });

    // If a migration left an ownerless group, the first user claims it instead of getting a new one
    let groupId: number;
    const claimMeta = queryOne("SELECT value FROM _meta WHERE key = 'claim_group_id'");
    if (claimMeta) {
      groupId = Number(claimMeta.value);
      runSql('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, user.id, 'owner']);
      runSql("DELETE FROM _meta WHERE key = 'claim_group_id'");
    } else {
      groupId = createGroupForUser(user.id, `${name.trim()}s Haushalt`);
    }

    const token = signToken({ userId: user.id, groupId });
    setCookieToken(res, token);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      groupId,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = queryOne('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  try {
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Get user's first group
    const membership = queryOne(
      'SELECT group_id FROM group_members WHERE user_id = ? ORDER BY joined_at ASC LIMIT 1',
      [user.id]
    );
    const groupId = membership?.group_id ?? null;

    const token = signToken({ userId: user.id, groupId });
    setCookieToken(res, token);

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      groupId,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// POST /clear-group — rewrite cookie with groupId: null (user has no group left)
router.post('/clear-group', (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, AUTH_SECRET) as any;
    if (!payload.userId) return res.status(401).json({ error: 'Invalid token' });
    setCookieToken(res, signToken({ userId: payload.userId, groupId: null }));
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /switch-group
router.post('/switch-group', (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, AUTH_SECRET) as any;
    if (!payload.userId) return res.status(401).json({ error: 'Invalid token' });

    const { groupId } = req.body;
    if (!groupId) return res.status(400).json({ error: 'groupId required' });

    // Verify membership
    const membership = queryOne(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, payload.userId]
    );
    if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

    const newToken = signToken({ userId: payload.userId, groupId });
    setCookieToken(res, newToken);
    res.json({ groupId });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// GET /google
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', (req: Request, res: Response, next: NextFunction) => {
    // Store pending invite code in a short-lived cookie so the callback can join the group
    const invite = req.query.invite as string | undefined;
    if (invite) {
      res.cookie('pending_invite', invite, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
      });
    }
    passport.authenticate('google', { scope: ['email', 'profile'] })(req, res, next);
  });

  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${process.env.APP_URL || 'http://localhost:5173'}/login?error=oauth` }),
    (req: Request, res: Response) => {
      const user = req.user as any;
      if (!user) return res.redirect(`${process.env.APP_URL || 'http://localhost:5173'}/login?error=oauth`);

      // Check for pending invite — join the group automatically
      const pendingInvite = req.cookies?.pending_invite as string | undefined;
      res.clearCookie('pending_invite');

      let groupId: number | null = null;

      if (pendingInvite) {
        const inviteGroup = queryOne('SELECT * FROM groups WHERE invite_code = ?', [pendingInvite]);
        if (inviteGroup) {
          const existing = queryOne(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [inviteGroup.id, user.id]
          );
          if (!existing) {
            runSql('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
              [inviteGroup.id, user.id, 'member']);
          }
          groupId = inviteGroup.id as number;
        }
      }

      if (groupId === null) {
        const membership = queryOne(
          'SELECT group_id FROM group_members WHERE user_id = ? ORDER BY joined_at ASC LIMIT 1',
          [user.id]
        );
        groupId = membership?.group_id ?? null;
      }

      const token = signToken({ userId: user.id, groupId });
      setCookieToken(res, token);
      res.redirect(process.env.APP_URL || 'http://localhost:5173');
    }
  );
} else {
  router.get('/google', (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Google OAuth not configured' });
  });
  router.get('/google/callback', (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Google OAuth not configured' });
  });
}

// Middleware to protect API routes
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = jwt.verify(token, AUTH_SECRET) as any;

    // Reject old format tokens { auth: true }
    if (!payload.userId) {
      res.status(401).json({ error: 'Session expired, please log in again' });
      return;
    }

    const user = queryOne('SELECT id, email, name FROM users WHERE id = ?', [payload.userId]);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = { id: user.id, email: user.email, name: user.name };
    req.groupId = payload.groupId ?? null;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}

export { passport };
export default router;
