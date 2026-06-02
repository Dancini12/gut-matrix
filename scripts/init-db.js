import { createClient } from "@libsql/client";

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.executeMultiple(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS problems (
    id         TEXT    PRIMARY KEY,
    user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nome       TEXT    NOT NULL DEFAULT '',
    g          INTEGER NOT NULL DEFAULT 3 CHECK (g BETWEEN 1 AND 5),
    u          INTEGER NOT NULL DEFAULT 3 CHECK (u BETWEEN 1 AND 5),
    t          INTEGER NOT NULL DEFAULT 3 CHECK (t BETWEEN 1 AND 5),
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_problems_user_id ON problems(user_id);
`);

console.log("✓ Schema inicializado no Turso");
