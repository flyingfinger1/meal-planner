import initSqlJs, { type Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'meal-planner.sqlite');

let db: Database;

function runMigration1(database: Database): void {
  // Create new tables
  database.run(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, user_id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS group_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      sent_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_email TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create a default group for existing data
  const inviteCode = Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
  database.run(
    `INSERT INTO groups (name, invite_code) VALUES ('Mein Haushalt', ?)`,
    [inviteCode.slice(0, 8)]
  );

  // Get the new group id
  const groupRow = database.exec("SELECT last_insert_rowid() as id");
  const groupId = groupRow[0]?.values[0]?.[0] as number ?? 1;

  // Migrate existing meals table: drop old UNIQUE(name), add group_id
  // We need to recreate the table since SQLite doesn't support DROP CONSTRAINT
  database.run(`
    CREATE TABLE IF NOT EXISTS meals_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(group_id, name)
    )
  `);

  // Check if old meals table exists and migrate
  const mealsExists = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='meals'");
  if (mealsExists[0]?.values?.length) {
    database.run(`INSERT INTO meals_new (id, group_id, name, created_at) SELECT id, ${groupId}, name, created_at FROM meals`);
    database.run(`DROP TABLE meals`);
  }
  database.run(`ALTER TABLE meals_new RENAME TO meals`);

  // Migrate ingredients (structure unchanged, just ensure table exists)
  database.run(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount TEXT DEFAULT '',
      category TEXT DEFAULT ''
    )
  `);

  // Migrate meal_plan: drop old UNIQUE(date, meal_type), add group_id
  database.run(`
    CREATE TABLE IF NOT EXISTS meal_plan_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL DEFAULT 'dinner',
      meal_id INTEGER REFERENCES meals(id) ON DELETE SET NULL,
      notes TEXT DEFAULT '',
      UNIQUE(group_id, date, meal_type)
    )
  `);

  const planExists = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='meal_plan'");
  if (planExists[0]?.values?.length) {
    database.run(`INSERT INTO meal_plan_new (id, group_id, date, meal_type, meal_id, notes) SELECT id, ${groupId}, date, meal_type, meal_id, notes FROM meal_plan`);
    database.run(`DROP TABLE meal_plan`);
  }
  database.run(`ALTER TABLE meal_plan_new RENAME TO meal_plan`);

  // Migrate settings: drop old PRIMARY KEY (key), add group_id
  database.run(`
    CREATE TABLE IF NOT EXISTS settings_new (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (group_id, key)
    )
  `);

  const settingsExists = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'");
  if (settingsExists[0]?.values?.length) {
    database.run(`INSERT INTO settings_new (group_id, key, value) SELECT ${groupId}, key, value FROM settings`);
    database.run(`DROP TABLE settings`);
  }
  database.run(`ALTER TABLE settings_new RENAME TO settings`);

  // Migrate quick_lists: drop old UNIQUE(name), add group_id
  database.run(`
    CREATE TABLE IF NOT EXISTS quick_lists_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(group_id, name)
    )
  `);

  const qlExists = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='quick_lists'");
  if (qlExists[0]?.values?.length) {
    database.run(`INSERT INTO quick_lists_new (id, group_id, name, created_at) SELECT id, ${groupId}, name, created_at FROM quick_lists`);
    database.run(`DROP TABLE quick_lists`);
  }
  database.run(`ALTER TABLE quick_lists_new RENAME TO quick_lists`);

  // quick_list_items: structure unchanged
  database.run(`
    CREATE TABLE IF NOT EXISTS quick_list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL REFERENCES quick_lists(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount TEXT DEFAULT '',
      category TEXT DEFAULT ''
    )
  `);

  // Mark migration done + flag so the first registering user claims this group
  database.run(`INSERT INTO _meta (key, value) VALUES ('schema_version', '1')`);
  database.run(`INSERT INTO _meta (key, value) VALUES ('claim_group_id', '${groupId}')`);

}

export async function initDb(): Promise<Database> {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // Schema versioning
  let schemaVersion = 0;
  try {
    const metaResult = db.exec("SELECT value FROM _meta WHERE key = 'schema_version'");
    if (metaResult[0]?.values?.length) {
      schemaVersion = Number(metaResult[0].values[0][0]);
    }
  } catch {
    // _meta table doesn't exist yet
  }

  if (schemaVersion < 1) {
    db.run('PRAGMA foreign_keys = OFF');
    runMigration1(db);
    db.run('PRAGMA foreign_keys = ON');
    saveDb();
  }

  return db;
}

export function getDb(): Database {
  return db;
}

export function saveDb(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Helper to run queries and get results as objects
export function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(sql: string, params: any[] = []): any | undefined {
  const results = queryAll(sql, params);
  return results[0];
}

export function runSql(sql: string, params: any[] = []): void {
  db.run(sql, params);
  saveDb();
}

export function getLastInsertRowId(): number {
  const result = queryOne('SELECT last_insert_rowid() as id');
  return result?.id ?? 0;
}
