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
    ORDER BY mp.date, mp.meal_type
  `, [groupId, from as string, to as string]);

  res.json(entries);
});

// Set/update a plan entry (upsert)
router.put('/', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { date, meal_type, meal_id, notes } = req.body;
  if (!date || !meal_type) return res.status(400).json({ error: 'date and meal_type required' });

  if (meal_id === null) {
    runSql('DELETE FROM meal_plan WHERE group_id = ? AND date = ? AND meal_type = ?', [groupId, date, meal_type]);
    return res.status(204).end();
  }

  // Check if entry exists
  const existing = queryOne('SELECT * FROM meal_plan WHERE group_id = ? AND date = ? AND meal_type = ?', [groupId, date, meal_type]);
  if (existing) {
    runSql('UPDATE meal_plan SET meal_id = ?, notes = ? WHERE id = ?', [meal_id, notes || '', existing.id]);
  } else {
    runSql('INSERT INTO meal_plan (group_id, date, meal_type, meal_id, notes) VALUES (?, ?, ?, ?, ?)', [groupId, date, meal_type, meal_id, notes || '']);
  }

  const entry = queryOne(`
    SELECT mp.*, m.name as meal_name
    FROM meal_plan mp
    LEFT JOIN meals m ON mp.meal_id = m.id
    WHERE mp.group_id = ? AND mp.date = ? AND mp.meal_type = ?
  `, [groupId, date, meal_type]);

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
