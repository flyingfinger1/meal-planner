import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { queryAll, queryOne } from '../db.js';

const router = Router();

// In-memory share tokens (token -> { dates, groupId, expiresAt })
const shareTokens = new Map<string, { dates: string[]; groupId: number; expiresAt: number }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of shareTokens) {
    if (data.expiresAt < now) shareTokens.delete(token);
  }
}, 60000);

// Aggregate shopping ingredients for selected dates
router.get('/shopping', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const dates = ((req.query.dates as string) || '').split(',').filter(Boolean);
  if (!dates.length) return res.status(400).json({ error: 'dates required' });

  const placeholders = dates.map(() => '?').join(',');
  const ingredients = queryAll(`
    SELECT i.name, i.amount, i.category, m.name as meal_name
    FROM meal_plan mp
    JOIN meals m ON mp.meal_id = m.id
    JOIN ingredients i ON i.meal_id = m.id
    WHERE mp.group_id = ? AND mp.date IN (${placeholders})
    ORDER BY i.category, i.name
  `, [groupId, ...dates]);

  res.json({ ingredients });
});

// Create a temporary share token for Bring! (authenticated endpoint)
router.post('/shopping/share-token', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { dates } = req.body;
  if (!dates?.length) return res.status(400).json({ error: 'dates required' });

  const token = crypto.randomBytes(16).toString('hex');
  shareTokens.set(token, {
    dates,
    groupId,
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
  });

  res.json({ token });
});

// Public recipe page for Bring! to scrape (no auth needed, uses token)
router.get('/recipe/shopping/:token', (req: Request, res: Response) => {
  const tokenData = shareTokens.get(req.params.token as string);
  if (!tokenData || tokenData.expiresAt < Date.now()) {
    return res.status(404).send('Link abgelaufen');
  }

  const { dates, groupId } = tokenData;
  const placeholders = dates.map(() => '?').join(',');
  const ingredients = queryAll(`
    SELECT i.name, i.amount, i.category, m.name as meal_name
    FROM meal_plan mp
    JOIN meals m ON mp.meal_id = m.id
    JOIN ingredients i ON i.meal_id = m.id
    WHERE mp.group_id = ? AND mp.date IN (${placeholders})
    ORDER BY i.category, i.name
  `, [groupId, ...dates]);

  const ingredientStrings = ingredients.map((i: any) =>
    i.amount ? `${i.amount} ${i.name}` : i.name
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: `Einkaufsliste`,
    recipeIngredient: ingredientStrings,
  };

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Einkaufsliste</title>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head><body>
<h1>Einkaufsliste</h1>
<ul>${ingredientStrings.map((i: string) => `<li>${i}</li>`).join('')}</ul>
</body></html>`);
});

// Public recipe page for a quick list (for Bring! scraping)
router.get('/recipe/quick-list/:id', (req: Request, res: Response) => {
  const list = queryOne('SELECT * FROM quick_lists WHERE id = ?', [Number(req.params.id)]);
  if (!list) return res.status(404).send('Not found');

  const items = queryAll('SELECT * FROM quick_list_items WHERE list_id = ?', [list.id]);
  const ingredientStrings = items.map((i: any) =>
    i.amount ? `${i.amount} ${i.name}` : i.name
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: list.name,
    recipeIngredient: ingredientStrings,
  };

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${list.name}</title>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head><body>
<h1>${list.name}</h1>
<ul>${ingredientStrings.map((i: string) => `<li>${i}</li>`).join('')}</ul>
</body></html>`);
});

// Serve recipe page with JSON-LD for Bring! to scrape
router.get('/recipe/:mealId', (req: Request, res: Response) => {
  const meal = queryOne('SELECT * FROM meals WHERE id = ?', [Number(req.params.mealId)]);
  if (!meal) return res.status(404).send('Not found');

  const ingredients = queryAll('SELECT * FROM ingredients WHERE meal_id = ?', [meal.id]);
  const ingredientStrings = ingredients.map((i: any) =>
    i.amount ? `${i.amount} ${i.name}` : i.name
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: meal.name,
    recipeIngredient: ingredientStrings,
  };

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${meal.name}</title>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head><body>
<h1>${meal.name}</h1>
<ul>${ingredientStrings.map((i: string) => `<li>${i}</li>`).join('')}</ul>
</body></html>`);
});

export default router;
