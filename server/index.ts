import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import authRouter, { requireAuth, authEnabled } from './auth.js';
import mealsRouter from './routes/meals.js';
import planRouter from './routes/plan.js';
import bringRouter from './routes/bring.js';
import calendarRouter from './routes/calendar.js';
import quickListsRouter from './routes/quicklists.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3200;

async function start() {
  await initDb();

  const app = express();
  app.use(cors({ credentials: true, origin: true }));
  app.use(cookieParser());
  app.use(express.json());

  // Auth routes (unprotected)
  app.use('/api/auth', authRouter);

  // Protect all other API routes
  app.use('/api', requireAuth);

  // API routes
  app.use('/api/meals', mealsRouter);
  app.use('/api/plan', planRouter);
  app.use('/api', bringRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/quick-lists', quickListsRouter);

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
    console.log(`Auth: ${authEnabled ? 'enabled' : 'disabled (set AUTH_PASSWORD to enable)'}`);
  });
}

start().catch(console.error);
