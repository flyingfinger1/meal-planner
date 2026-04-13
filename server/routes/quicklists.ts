import { Router, type Request, type Response } from 'express';
import { queryAll, queryOne, runSql, getLastInsertRowId } from '../db.js';

const router = Router();

// Get all quick lists (with item count)
router.get('/', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const lists = queryAll(`
    SELECT ql.*, COUNT(qli.id) as item_count
    FROM quick_lists ql
    LEFT JOIN quick_list_items qli ON qli.list_id = ql.id
    WHERE ql.group_id = ?
    GROUP BY ql.id
    ORDER BY ql.name
  `, [groupId]);
  res.json(lists);
});

// Get single quick list with items
router.get('/:id', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const list = queryOne('SELECT * FROM quick_lists WHERE id = ? AND group_id = ?', [Number(req.params.id), groupId]);
  if (!list) return res.status(404).json({ error: 'Not found' });

  const items = queryAll(
    'SELECT * FROM quick_list_items WHERE list_id = ? ORDER BY category, name',
    [list.id]
  );
  res.json({ ...list, items });
});

// Create quick list
router.post('/', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  runSql('INSERT INTO quick_lists (group_id, name) VALUES (?, ?)', [groupId, name.trim()]);
  const id = getLastInsertRowId();
  const list = queryOne('SELECT * FROM quick_lists WHERE id = ?', [id]);
  res.json({ ...list, items: [] });
});

// Update quick list name
router.put('/:id', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const list = queryOne('SELECT * FROM quick_lists WHERE id = ? AND group_id = ?', [Number(req.params.id), groupId]);
  if (!list) return res.status(404).json({ error: 'Not found' });

  runSql('UPDATE quick_lists SET name = ? WHERE id = ? AND group_id = ?', [name.trim(), Number(req.params.id), groupId]);
  const updated = queryOne('SELECT * FROM quick_lists WHERE id = ?', [Number(req.params.id)]);
  res.json(updated);
});

// Delete quick list
router.delete('/:id', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const list = queryOne('SELECT * FROM quick_lists WHERE id = ? AND group_id = ?', [Number(req.params.id), groupId]);
  if (!list) return res.status(404).json({ error: 'Not found' });

  runSql('DELETE FROM quick_lists WHERE id = ? AND group_id = ?', [Number(req.params.id), groupId]);
  res.json({ ok: true });
});

// Save items for a quick list (replace all)
router.put('/:id/items', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const listId = Number(req.params.id);
  const { items } = req.body;

  const list = queryOne('SELECT * FROM quick_lists WHERE id = ? AND group_id = ?', [listId, groupId]);
  if (!list) return res.status(404).json({ error: 'Not found' });

  runSql('DELETE FROM quick_list_items WHERE list_id = ?', [listId]);

  for (const item of items || []) {
    if (!item.name?.trim()) continue;
    runSql(
      'INSERT INTO quick_list_items (list_id, name, amount, category) VALUES (?, ?, ?, ?)',
      [listId, item.name.trim(), item.amount || '', item.category || '']
    );
  }

  const saved = queryAll(
    'SELECT * FROM quick_list_items WHERE list_id = ? ORDER BY category, name',
    [listId]
  );
  res.json(saved);
});

export default router;
