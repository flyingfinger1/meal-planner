import { Router, type Request, type Response } from 'express';
import { queryAll, queryOne, runSql } from '../db.js';

const router = Router();

// Get plan entries for a date range
router.get('/', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  const entries = queryAll(`
    SELECT mp.*, m.name as meal_name
    FROM meal_plan mp
    LEFT JOIN meals m ON mp.meal_id = m.id
    WHERE mp.group_id = ? AND mp.date >= ? AND mp.date <= ?
    ORDER BY mp.date, mp.meal_type, mp.id
  `, [groupId, from as string, to as string]);

  res.json(entries);
});

// Add a new plan entry
router.post('/', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { date, meal_type, meal_id, notes } = req.body;
  if (!date || !meal_type || !meal_id) return res.status(400).json({ error: 'date, meal_type and meal_id required' });

  runSql('INSERT INTO meal_plan (group_id, date, meal_type, meal_id, notes) VALUES (?, ?, ?, ?, ?)',
    [groupId, date, meal_type, meal_id, notes || '']);

  res.status(204).end();
});

// Update an existing plan entry (change meal)
router.put('/:id', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { meal_id, notes } = req.body;
  const id = Number(req.params.id);

  runSql('UPDATE meal_plan SET meal_id = ?, notes = ? WHERE id = ? AND group_id = ?',
    [meal_id, notes || '', id, groupId]);

  const entry = queryOne(`
    SELECT mp.*, m.name as meal_name
    FROM meal_plan mp
    LEFT JOIN meals m ON mp.meal_id = m.id
    WHERE mp.id = ?
  `, [id]);

  res.json(entry);
});

// Delete a plan entry
router.delete('/:id', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  runSql('DELETE FROM meal_plan WHERE id = ? AND group_id = ?', [Number(req.params.id), groupId]);
  res.status(204).end();
});

export default router;
