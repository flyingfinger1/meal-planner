import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import authRouter, { requireAuth, passport } from './auth.js';
import mealsRouter from './routes/meals.js';
import planRouter from './routes/plan.js';
import bringRouter from './routes/bring.js';
import calendarRouter from './routes/calendar.js';
import quickListsRouter from './routes/quicklists.js';
import groupsRouter from './routes/groups.js';
import invitationsRouter from './routes/invitations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3200;

async function start() {
  await initDb();

  const app = express();
  app.use(cors({ credentials: true, origin: true }));
  app.use(cookieParser());
  app.use(express.json());

  // Initialize passport (no session needed — JWT only)
  app.use(passport.initialize());

  // Auth routes (unprotected — register, login, logout, check, OAuth)
  app.use('/api/auth', authRouter);

  // Protect all other API routes — exempt public endpoints
  app.use('/api', (req, res, next) => {
    // GET /api/groups/join/:code — invite preview, no auth required
    if (req.method === 'GET' && req.path.startsWith('/groups/join/')) return next();
    // GET /api/recipe/* — public HTML pages for Bring! to scrape
    if (req.method === 'GET' && req.path.startsWith('/recipe/')) return next();
    return requireAuth(req, res, next);
  });

  // API routes
  app.use('/api/meals', mealsRouter);
  app.use('/api/plan', planRouter);
  app.use('/api', bringRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/quick-lists', quickListsRouter);
  app.use('/api/groups', groupsRouter);

  // Invitations routes — POST requires auth (handled inside), GET /join/:code is public-ish
  // The invitations router applies requireAuth per route internally
  app.use('/api', invitationsRouter);

  // Serve frontend in production (only if dist exists)
  const distPath = path.join(__dirname, '..', 'dist');
  const fs = await import('fs');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meal Planner backend running on http://localhost:${PORT}`);
    console.log(`Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? 'enabled' : 'disabled'}`);
    console.log(`SMTP: ${process.env.SMTP_HOST ? 'enabled' : 'disabled'}`);
  });
}

start().catch(console.error);
