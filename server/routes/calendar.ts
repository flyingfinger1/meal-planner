import { Router, type Request, type Response } from 'express';
import ical from 'node-ical';
import { queryOne, runSql } from '../db.js';

const router = Router();

// Cache parsed events keyed by groupId
const calendarCache = new Map<number, { events: { date: string; title: string }[]; lastFetch: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchCalendarEvents(groupId: number, url: string): Promise<{ date: string; title: string }[]> {
  const now = Date.now();
  const cached = calendarCache.get(groupId);
  if (cached && now - cached.lastFetch < CACHE_TTL && cached.events.length > 0) {
    return cached.events;
  }

  try {
    const data = await ical.async.fromURL(url);
    const events: { date: string; title: string }[] = [];

    for (const key of Object.keys(data)) {
      const event = data[key];
      if (event.type !== 'VEVENT') continue;

      const startRaw = event.start as any;
      const endRaw = event.end as any;
      if (!startRaw) continue;

      const isDateOnly = startRaw.dateOnly === true;
      const title = (event.summary as string) || 'Besuch';

      const startDate = isDateOnly ? roundToLocalDate(new Date(startRaw)) : formatDate(new Date(startRaw));
      const endDate = endRaw ? (isDateOnly ? roundToLocalDate(new Date(endRaw)) : formatDate(new Date(endRaw))) : null;

      if (endDate && endDate > startDate) {
        let current = startDate;
        while (current < endDate) {
          events.push({ date: current, title });
          current = nextDay(current);
        }
      } else {
        events.push({ date: startDate, title });
      }

      if ((event as any).rrule) {
        const rrule = (event as any).rrule;
        const after = new Date();
        after.setMonth(after.getMonth() - 1);
        const before = new Date();
        before.setMonth(before.getMonth() + 6);
        try {
          const occurrences = rrule.between(after, before, true);
          for (const occ of occurrences) {
            const occD = new Date(occ);
            const occStart = isDateOnly ? roundToLocalDate(occD) : formatDate(occD);
            if (endDate && startDate && endDate > startDate) {
              let cur = occStart;
              const dayCount = daysBetween(startDate, endDate);
              for (let i = 0; i < dayCount; i++) {
                events.push({ date: cur, title });
                cur = nextDay(cur);
              }
            } else {
              events.push({ date: occStart, title });
            }
          }
        } catch {
          // rrule expansion failed, skip
        }
      }
    }

    calendarCache.set(groupId, { events, lastFetch: now });
    return events;
  } catch (e) {
    console.error('Failed to fetch calendar:', e);
    return cached?.events ?? []; // return stale cache on error
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function roundToLocalDate(d: Date): string {
  if (d.getUTCHours() >= 20) {
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    return formatDateUTC(next);
  }
  return formatDateUTC(d);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00Z');
  const db = new Date(b + 'T12:00:00Z');
  return Math.round((db.getTime() - da.getTime()) / (24 * 60 * 60 * 1000));
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return formatDateUTC(d);
}

// Get calendar settings
router.get('/settings', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const row = queryOne("SELECT value FROM settings WHERE group_id = ? AND key = 'ical_url'", [groupId]);
  const labelRow = queryOne("SELECT value FROM settings WHERE group_id = ? AND key = 'ical_label'", [groupId]);
  res.json({
    ical_url: row?.value || '',
    ical_label: labelRow?.value || 'Kinder zu Besuch',
  });
});

// Save calendar settings
router.put('/settings', (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { ical_url, ical_label } = req.body;

  if (ical_url !== undefined) {
    runSql(
      "INSERT INTO settings (group_id, key, value) VALUES (?, 'ical_url', ?) ON CONFLICT(group_id, key) DO UPDATE SET value = excluded.value",
      [groupId, ical_url]
    );
    // Clear cache when URL changes
    calendarCache.delete(groupId);
  }
  if (ical_label !== undefined) {
    runSql(
      "INSERT INTO settings (group_id, key, value) VALUES (?, 'ical_label', ?) ON CONFLICT(group_id, key) DO UPDATE SET value = excluded.value",
      [groupId, ical_label]
    );
  }

  res.json({ ok: true });
});

// Get calendar events for a date range
router.get('/events', async (req: Request, res: Response) => {
  const groupId = req.groupId;
  if (groupId == null) return res.status(403).json({ error: 'No group selected' });

  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  const row = queryOne("SELECT value FROM settings WHERE group_id = ? AND key = 'ical_url'", [groupId]);
  if (!row?.value) return res.json({ events: [] });

  const labelRow = queryOne("SELECT value FROM settings WHERE group_id = ? AND key = 'ical_label'", [groupId]);
  const filterLabel = (labelRow?.value || '').trim().toLowerCase();

  const allEvents = await fetchCalendarEvents(groupId, row.value);
  const filtered = allEvents.filter(e => {
    if (e.date < (from as string) || e.date > (to as string)) return false;
    if (filterLabel) return e.title.toLowerCase().includes(filterLabel);
    return true;
  });

  // Deduplicate by date
  const byDate = new Map<string, string>();
  for (const e of filtered) {
    byDate.set(e.date, e.title);
  }

  const events = Array.from(byDate.entries()).map(([date, title]) => ({ date, title }));
  res.json({ events });
});

export default router;
