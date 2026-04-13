import { Router, type Request, type Response } from 'express';
import { queryAll, queryOne, runSql, getLastInsertRowId, saveDb } from '../db.js';

const router = Router();

// Search/list meals
router.get('/', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const q = (req.query.q as string) || '';
  const meals = q
    ? queryAll('SELECT * FROM meals WHERE group_id = ? AND name LIKE ? ORDER BY name LIMIT 20', [groupId, `%${q}%`])
    : queryAll('SELECT * FROM meals WHERE group_id = ? ORDER BY name', [groupId]);
  res.json(meals);
});

// Get single meal with ingredients
router.get('/:id', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const meal = queryOne('SELECT * FROM meals WHERE id = ? AND group_id = ?', [Number(req.params.id), groupId]);
  if (!meal) return res.status(404).json({ error: 'Not found' });
  meal.ingredients = queryAll('SELECT * FROM ingredients WHERE meal_id = ?', [meal.id]);
  res.json(meal);
});

// Create meal
router.post('/', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const existing = queryOne('SELECT * FROM meals WHERE group_id = ? AND name = ?', [groupId, name.trim()]);
  if (existing) return res.json(existing);

  runSql('INSERT INTO meals (group_id, name) VALUES (?, ?)', [groupId, name.trim()]);
  const meal = queryOne('SELECT * FROM meals WHERE group_id = ? AND name = ?', [groupId, name.trim()]);
  if (!meal) return res.status(500).json({ error: 'Failed to retrieve created meal' });
  res.status(201).json(meal);
});

// Update meal name
router.put('/:id', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const meal = queryOne('SELECT * FROM meals WHERE id = ? AND group_id = ?', [Number(req.params.id), groupId]);
  if (!meal) return res.status(404).json({ error: 'Not found' });

  runSql('UPDATE meals SET name = ? WHERE id = ? AND group_id = ?', [name.trim(), Number(req.params.id), groupId]);
  const updated = queryOne('SELECT * FROM meals WHERE id = ?', [Number(req.params.id)]);
  res.json(updated);
});

// Delete meal
router.delete('/:id', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const id = Number(req.params.id);
  const meal = queryOne('SELECT * FROM meals WHERE id = ? AND group_id = ?', [id, groupId]);
  if (!meal) return res.status(404).json({ error: 'Not found' });

  runSql('DELETE FROM meal_plan WHERE meal_id = ? AND group_id = ?', [id, groupId]);
  runSql('DELETE FROM meals WHERE id = ? AND group_id = ?', [id, groupId]);
  res.status(204).end();
});

// Replace all ingredients for a meal
router.put('/:mealId/ingredients', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const mealId = Number(req.params.mealId);
  const { ingredients } = req.body as { ingredients: { name: string; amount?: string; category?: string }[] };

  const meal = queryOne('SELECT * FROM meals WHERE id = ? AND group_id = ?', [mealId, groupId]);
  if (!meal) return res.status(404).json({ error: 'Meal not found' });

  runSql('DELETE FROM ingredients WHERE meal_id = ?', [mealId]);
  for (const ing of ingredients) {
    if (ing.name?.trim()) {
      runSql(
        'INSERT INTO ingredients (meal_id, name, amount, category) VALUES (?, ?, ?, ?)',
        [mealId, ing.name.trim(), ing.amount || '', ing.category || '']
      );
    }
  }

  const result = queryAll('SELECT * FROM ingredients WHERE meal_id = ?', [mealId]);
  res.json(result);
});

export default router;
