-- Extensão para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Usuários
CREATE TABLE IF NOT EXISTS users (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Problemas GUT (um por usuário)
CREATE TABLE IF NOT EXISTS problems (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome       TEXT        NOT NULL DEFAULT '',
  g          INTEGER     NOT NULL DEFAULT 3 CHECK (g BETWEEN 1 AND 5),
  u          INTEGER     NOT NULL DEFAULT 3 CHECK (u BETWEEN 1 AND 5),
  t          INTEGER     NOT NULL DEFAULT 3 CHECK (t BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problems_user_id ON problems(user_id);
