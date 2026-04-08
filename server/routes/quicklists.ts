import { Router } from 'express';
import { queryAll, queryOne, runSql, getLastInsertRowId } from '../db.js';

const router = Router();

// Get all quick lists (with item count)
router.get('/', (_req, res) => {
  const lists = queryAll(`
    SELECT ql.*, COUNT(qli.id) as item_count
    FROM quick_lists ql
    LEFT JOIN quick_list_items qli ON qli.list_id = ql.id
    GROUP BY ql.id
    ORDER BY ql.name
  `);
  res.json(lists);
});

// Get single quick list with items
router.get('/:id', (req, res) => {
  const list = queryOne('SELECT * FROM quick_lists WHERE id = ?', [Number(req.params.id)]);
  if (!list) return res.status(404).json({ error: 'Not found' });

  const items = queryAll(
    'SELECT * FROM quick_list_items WHERE list_id = ? ORDER BY category, name',
    [list.id]
  );
  res.json({ ...list, items });
});

// Create quick list
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  runSql('INSERT INTO quick_lists (name) VALUES (?)', [name.trim()]);
  const id = getLastInsertRowId();
  const list = queryOne('SELECT * FROM quick_lists WHERE id = ?', [id]);
  res.json({ ...list, items: [] });
});

// Update quick list name
router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  runSql('UPDATE quick_lists SET name = ? WHERE id = ?', [name.trim(), Number(req.params.id)]);
  const list = queryOne('SELECT * FROM quick_lists WHERE id = ?', [Number(req.params.id)]);
  res.json(list);
});

// Delete quick list
router.delete('/:id', (req, res) => {
  runSql('DELETE FROM quick_lists WHERE id = ?', [Number(req.params.id)]);
  res.json({ ok: true });
});

// Save items for a quick list (replace all)
router.put('/:id/items', (req, res) => {
  const listId = Number(req.params.id);
  const { items } = req.body;

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
