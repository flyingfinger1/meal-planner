import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { queryAll, queryOne, runSql, saveDb, getDb } from '../db.js';

const router = Router();

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex');
}

// GET / — list user's groups with role
router.get('/', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const groups = queryAll(`
    SELECT g.id, g.name, g.invite_code, g.created_at, gm.role
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ?
    ORDER BY gm.joined_at ASC
  `, [userId]);
  res.json(groups);
});

// POST / — create group, add creator as owner
router.post('/', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const inviteCode = generateInviteCode();
  const db = getDb();
  db.run('INSERT INTO groups (name, invite_code) VALUES (?, ?)', [name.trim(), inviteCode]);
  saveDb();
  const group = queryOne('SELECT * FROM groups WHERE invite_code = ?', [inviteCode]);
  if (!group) return res.status(500).json({ error: 'Failed to create group' });

  runSql('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [group.id, userId, 'owner']);

  res.status(201).json(group);
});

// GET /join/:inviteCode — public, returns { id, name, memberCount }
router.get('/join/:inviteCode', (req: Request, res: Response) => {
  const group = queryOne('SELECT * FROM groups WHERE invite_code = ?', [req.params.inviteCode]);
  if (!group) return res.status(404).json({ error: 'Invite not found' });

  const countRow = queryOne('SELECT COUNT(*) as count FROM group_members WHERE group_id = ?', [group.id]);
  res.json({ id: group.id, name: group.name, memberCount: countRow?.count ?? 0 });
});

// POST /join/:inviteCode — auth required, join group
router.post('/join/:inviteCode', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const group = queryOne('SELECT * FROM groups WHERE invite_code = ?', [req.params.inviteCode]);
  if (!group) return res.status(404).json({ error: 'Invite not found' });

  // Already a member?
  const existing = queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [group.id, userId]);
  if (existing) return res.json({ groupId: group.id });

  runSql('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [group.id, userId, 'member']);
  res.json({ groupId: group.id });
});

// GET /:id — group info + members (must be member)
router.get('/:id', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const groupId = Number(req.params.id);

  const membership = queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
  if (!membership) return res.status(403).json({ error: 'Not a member' });

  const group = queryOne('SELECT * FROM groups WHERE id = ?', [groupId]);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = queryAll(`
    SELECT u.id as user_id, u.name, u.email, gm.role, gm.joined_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at ASC
  `, [groupId]);

  res.json({ ...group, members });
});

// PUT /:id — rename (owner only)
router.put('/:id', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const groupId = Number(req.params.id);
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const membership = queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
  if (!membership) return res.status(403).json({ error: 'Not a member' });
  if (membership.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  runSql('UPDATE groups SET name = ? WHERE id = ?', [name.trim(), groupId]);
  const group = queryOne('SELECT * FROM groups WHERE id = ?', [groupId]);
  res.json(group);
});

// DELETE /:id — delete (owner only)
router.delete('/:id', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const groupId = Number(req.params.id);

  const membership = queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
  if (!membership) return res.status(403).json({ error: 'Not a member' });
  if (membership.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  runSql('DELETE FROM groups WHERE id = ?', [groupId]);
  res.status(204).end();
});

// POST /:id/leave — leave (blocked if sole owner)
router.post('/:id/leave', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const groupId = Number(req.params.id);

  const membership = queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
  if (!membership) return res.status(400).json({ error: 'Not a member' });

  if (membership.role === 'owner') {
    return res.status(400).json({ error: 'Als Inhaber kannst du die Gruppe nicht verlassen. Übertrage die Inhaberschaft oder lösche die Gruppe.' });
  }

  runSql('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);

  // Auto-delete group if no members remain
  const remaining = queryOne('SELECT COUNT(*) as count FROM group_members WHERE group_id = ?', [groupId]);
  if ((remaining?.count ?? 0) === 0) {
    runSql('DELETE FROM groups WHERE id = ?', [groupId]);
  }

  res.json({ ok: true });
});

// POST /:id/transfer-ownership — transfer ownership to another member (owner only)
router.post('/:id/transfer-ownership', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const groupId = Number(req.params.id);
  const { targetUserId } = req.body;

  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

  const membership = queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
  if (!membership) return res.status(403).json({ error: 'Not a member' });
  if (membership.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const target = queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetUserId]);
  if (!target) return res.status(404).json({ error: 'Target user is not a member of this group' });

  runSql("UPDATE group_members SET role = 'member' WHERE group_id = ? AND user_id = ?", [groupId, userId]);
  runSql("UPDATE group_members SET role = 'owner' WHERE group_id = ? AND user_id = ?", [groupId, targetUserId]);

  res.json({ ok: true });
});

// DELETE /:id/members/:userId — remove member (owner only)
router.delete('/:id/members/:memberId', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const groupId = Number(req.params.id);
  const targetId = Number(req.params.memberId);

  const membership = queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
  if (!membership) return res.status(403).json({ error: 'Not a member' });
  if (membership.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  if (targetId === userId) return res.status(400).json({ error: 'Use /leave to remove yourself' });

  runSql('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetId]);
  res.json({ ok: true });
});

// POST /:id/regenerate-invite — new invite_code (owner only)
router.post('/:id/regenerate-invite', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const groupId = Number(req.params.id);

  const membership = queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
  if (!membership) return res.status(403).json({ error: 'Not a member' });
  if (membership.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const newCode = generateInviteCode();
  runSql('UPDATE groups SET invite_code = ? WHERE id = ?', [newCode, groupId]);
  res.json({ invite_code: newCode });
});

export default router;
