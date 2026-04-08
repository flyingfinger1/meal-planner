import { Router } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// Get plan entries for a date range
router.get('/', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  const entries = queryAll(`
    SELECT mp.*, m.name as meal_name
    FROM meal_plan mp
    LEFT JOIN meals m ON mp.meal_id = m.id
    WHERE mp.date >= ? AND mp.date <= ?
    ORDER BY mp.date, mp.meal_type
  `, [from as string, to as string]);

  res.json(entries);
});

// Set/update a plan entry (upsert)
router.put('/', (req, res) => {
  const { date, meal_type, meal_id, notes } = req.body;
  if (!date || !meal_type) return res.status(400).json({ error: 'date and meal_type required' });

  if (meal_id === null) {
    runSql('DELETE FROM meal_plan WHERE date = ? AND meal_type = ?', [date, meal_type]);
    return res.status(204).end();
  }

  // Check if entry exists
  const existing = queryOne('SELECT * FROM meal_plan WHERE date = ? AND meal_type = ?', [date, meal_type]);
  if (existing) {
    runSql('UPDATE meal_plan SET meal_id = ?, notes = ? WHERE id = ?', [meal_id, notes || '', existing.id]);
  } else {
    runSql('INSERT INTO meal_plan (date, meal_type, meal_id, notes) VALUES (?, ?, ?, ?)', [date, meal_type, meal_id, notes || '']);
  }

  const entry = queryOne(`
    SELECT mp.*, m.name as meal_name
    FROM meal_plan mp
    LEFT JOIN meals m ON mp.meal_id = m.id
    WHERE mp.date = ? AND mp.meal_type = ?
  `, [date, meal_type]);

  res.json(entry);
});

// Delete a plan entry
router.delete('/:id', (req, res) => {
  runSql('DELETE FROM meal_plan WHERE id = ?', [Number(req.params.id)]);
  res.status(204).end();
});

export default router;
