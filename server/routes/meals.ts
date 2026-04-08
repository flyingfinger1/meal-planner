import { Router } from 'express';
import { queryAll, queryOne, runSql, getLastInsertRowId, saveDb } from '../db.js';

const router = Router();

// Search/list meals
router.get('/', (req, res) => {
  const q = (req.query.q as string) || '';
  const meals = q
    ? queryAll('SELECT * FROM meals WHERE name LIKE ? ORDER BY name LIMIT 20', [`%${q}%`])
    : queryAll('SELECT * FROM meals ORDER BY name');
  res.json(meals);
});

// Get single meal with ingredients
router.get('/:id', (req, res) => {
  const meal = queryOne('SELECT * FROM meals WHERE id = ?', [Number(req.params.id)]);
  if (!meal) return res.status(404).json({ error: 'Not found' });
  meal.ingredients = queryAll('SELECT * FROM ingredients WHERE meal_id = ?', [meal.id]);
  res.json(meal);
});

// Create meal
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const existing = queryOne('SELECT * FROM meals WHERE name = ?', [name.trim()]);
  if (existing) return res.json(existing);

  runSql('INSERT INTO meals (name) VALUES (?)', [name.trim()]);
  const id = getLastInsertRowId();
  const meal = queryOne('SELECT * FROM meals WHERE id = ?', [id]);
  res.status(201).json(meal);
});

// Update meal name
router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  runSql('UPDATE meals SET name = ? WHERE id = ?', [name.trim(), Number(req.params.id)]);
  const meal = queryOne('SELECT * FROM meals WHERE id = ?', [Number(req.params.id)]);
  res.json(meal);
});

// Delete meal
router.delete('/:id', (req, res) => {
  runSql('DELETE FROM meals WHERE id = ?', [Number(req.params.id)]);
  res.status(204).end();
});

// Replace all ingredients for a meal
router.put('/:mealId/ingredients', (req, res) => {
  const mealId = Number(req.params.mealId);
  const { ingredients } = req.body as { ingredients: { name: string; amount?: string; category?: string }[] };

  const meal = queryOne('SELECT * FROM meals WHERE id = ?', [mealId]);
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
