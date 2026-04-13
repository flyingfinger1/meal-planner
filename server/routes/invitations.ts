import { Router, type Request, type Response } from 'express';
import nodemailer from 'nodemailer';
import { queryOne, queryAll, runSql } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

const INVITE_LIMIT_PER_USER = Number(process.env.INVITE_LIMIT_PER_USER || 10);
const INVITE_LIMIT_PER_EMAIL = Number(process.env.INVITE_LIMIT_PER_EMAIL || 3);
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function createTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || '',
        }
      : undefined,
  });
}

// POST /groups/:groupId/invitations
router.post('/groups/:groupId/invitations', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const groupId = Number(req.params.groupId);
  const { email } = req.body;

  if (!email?.trim()) return res.status(400).json({ error: 'email required' });
  const toEmail = email.trim().toLowerCase();

  // Check user is group member
  const membership = queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
  if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

  // Check rate limits (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const userInviteCount = queryOne(
    'SELECT COUNT(*) as count FROM group_invitations WHERE group_id = ? AND sent_by = ? AND sent_at > ?',
    [groupId, userId, since]
  );
  if ((userInviteCount?.count ?? 0) >= INVITE_LIMIT_PER_USER) {
    return res.status(429).json({ error: `Rate limit: max ${INVITE_LIMIT_PER_USER} invitations per 24h` });
  }

  const emailInviteCount = queryOne(
    'SELECT COUNT(*) as count FROM group_invitations WHERE group_id = ? AND to_email = ? AND sent_at > ?',
    [groupId, toEmail, since]
  );
  if ((emailInviteCount?.count ?? 0) >= INVITE_LIMIT_PER_EMAIL) {
    return res.status(429).json({ error: `This email has already been invited ${INVITE_LIMIT_PER_EMAIL} times in the last 24h` });
  }

  // Get group info
  const group = queryOne('SELECT * FROM groups WHERE id = ?', [groupId]);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  // Insert invitation record
  runSql(
    'INSERT INTO group_invitations (group_id, sent_by, to_email) VALUES (?, ?, ?)',
    [groupId, userId, toEmail]
  );

  const inviteUrl = `${APP_URL}/invite/${group.invite_code}`;
  const senderName = req.user!.name;

  let emailSent = false;
  const transport = createTransport();
  if (transport) {
    try {
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h1 style="color: #2563eb;">Einladung zum Essensplaner</h1>
  <p><strong>${senderName}</strong> hat dich eingeladen, dem Haushalt <strong>${group.name}</strong> im Essensplaner beizutreten.</p>
  <p>Der Essensplaner hilft dir bei:</p>
  <ul>
    <li>Wochenweise Essensplanung für deinen Haushalt</li>
    <li>Automatische Einkaufslisten aus deinem Speiseplan</li>
    <li>Bring!-Integration für einfaches Einkaufen</li>
  </ul>
  <p style="margin: 30px 0;">
    <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block;">
      Einladung annehmen
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">
    Oder öffne diesen Link: <a href="${inviteUrl}" style="color: #2563eb;">${inviteUrl}</a>
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
  <p style="color: #9ca3af; font-size: 12px;">
    Diese Einladung wurde von ${senderName} über den Essensplaner versendet.
  </p>
</body>
</html>`;

      const textBody = `${senderName} hat dich zum Essensplaner eingeladen!

${senderName} lädt dich ein, dem Haushalt "${group.name}" im Essensplaner beizutreten.

Der Essensplaner hilft dir bei:
- Wochenweise Essensplanung für deinen Haushalt
- Automatische Einkaufslisten aus deinem Speiseplan
- Bring!-Integration für einfaches Einkaufen

Nimm die Einladung an:
${inviteUrl}

Diese Einladung wurde von ${senderName} über den Essensplaner versendet.`;

      await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@essensplaner.de',
        to: toEmail,
        subject: `${senderName} hat dich zum Essensplaner eingeladen`,
        text: textBody,
        html: htmlBody,
      });
      emailSent = true;
    } catch (err) {
      console.error('Failed to send invitation email:', err);
    }
  }

  res.json({ inviteUrl, emailSent });
});

export default router;
