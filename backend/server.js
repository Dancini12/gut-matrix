require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const Database  = require("better-sqlite3");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const path      = require("path");
const { randomUUID } = require("crypto");

const app = express();
const db  = new Database(path.join(__dirname, "gut_matrix.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ─────────────────────────────────────────────────────────────────
db.exec(`
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

const SECRET = process.env.JWT_SECRET || "troque-em-producao";
const PORT   = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

// ── Middleware de autenticação ──────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ error: "Não autorizado" });
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

// ── Auth: login ─────────────────────────────────────────────────────────────
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: "E-mail ou senha incorretos" });

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── Auth: cadastro ──────────────────────────────────────────────────────────
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    if (password.length < 6)
      return res.status(400).json({ error: "Senha deve ter ao menos 6 caracteres" });

    const hash = await bcrypt.hash(password, 10);
    const id   = randomUUID();
    try {
      db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(id, email.toLowerCase(), hash);
    } catch (e) {
      if (e.message.includes("UNIQUE"))
        return res.status(409).json({ error: "E-mail já cadastrado" });
      throw e;
    }
    const token = jwt.sign({ id, email: email.toLowerCase() }, SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id, email: email.toLowerCase() } });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── Auth: esqueceu a senha ──────────────────────────────────────────────────
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email?.toLowerCase());

    if (user && process.env.SMTP_HOST) {
      const resetToken = jwt.sign({ id: user.id, purpose: "reset" }, SECRET, { expiresIn: "1h" });
      const link = `${process.env.FRONTEND_URL || "http://localhost:5173"}?reset=${resetToken}`;
      const mailer = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Redefinição de senha — Matriz GUT",
        html: `<p>Clique no link abaixo para redefinir sua senha (válido por 1 hora):</p>
               <p><a href="${link}">${link}</a></p>`,
      });
    }
    res.json({ message: "Se o e-mail existir, um link será enviado." });
  } catch {
    res.status(500).json({ error: "Erro ao enviar e-mail" });
  }
});

// ── Auth: redefinir senha ───────────────────────────────────────────────────
app.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ error: "Senha deve ter ao menos 6 caracteres" });

    let payload;
    try { payload = jwt.verify(token, SECRET); } catch {
      return res.status(400).json({ error: "Link inválido ou expirado" });
    }
    if (payload.purpose !== "reset")
      return res.status(400).json({ error: "Token inválido" });

    const hash = await bcrypt.hash(password, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, payload.id);
    res.json({ message: "Senha redefinida com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── Problems: listar ────────────────────────────────────────────────────────
app.get("/problems", requireAuth, (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM problems WHERE user_id = ? ORDER BY created_at").all(req.user.id);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao buscar problemas" });
  }
});

// ── Problems: criar ─────────────────────────────────────────────────────────
app.post("/problems", requireAuth, (req, res) => {
  try {
    const { nome = "", g = 3, u = 3, t = 3 } = req.body;
    const id = randomUUID();
    db.prepare("INSERT INTO problems (id, user_id, nome, g, u, t) VALUES (?, ?, ?, ?, ?, ?)").run(id, req.user.id, nome, g, u, t);
    const row = db.prepare("SELECT * FROM problems WHERE id = ?").get(id);
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Erro ao criar problema" });
  }
});

// ── Problems: atualizar ─────────────────────────────────────────────────────
app.patch("/problems/:id", requireAuth, (req, res) => {
  try {
    const allowed = ["nome", "g", "u", "t"];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (!updates.length)
      return res.status(400).json({ error: "Nenhum campo válido informado" });

    const sets   = updates.map(([k]) => `${k} = ?`).join(", ");
    const values = updates.map(([, v]) => v);
    db.prepare(`UPDATE problems SET ${sets} WHERE id = ? AND user_id = ?`)
      .run(...values, req.params.id, req.user.id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar problema" });
  }
});

// ── Problems: remover ───────────────────────────────────────────────────────
app.delete("/problems/:id", requireAuth, (req, res) => {
  try {
    db.prepare("DELETE FROM problems WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao remover problema" });
  }
});

// ── Problems: substituir todos (Exemplo / Limpar) ───────────────────────────
app.post("/problems/replace", requireAuth, (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    db.prepare("DELETE FROM problems WHERE user_id = ?").run(req.user.id);
    if (!items.length) return res.json([]);

    const insert = db.prepare("INSERT INTO problems (id, user_id, nome, g, u, t) VALUES (?, ?, ?, ?, ?, ?)");
    const ids = db.transaction((rows) =>
      rows.map(({ nome = "", g = 3, u = 3, t = 3 }) => {
        const id = randomUUID();
        insert.run(id, req.user.id, nome, g, u, t);
        return id;
      })
    )(items);

    const placeholders = ids.map(() => "?").join(",");
    const rows = db.prepare(`SELECT * FROM problems WHERE id IN (${placeholders}) ORDER BY created_at`).all(...ids);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao substituir problemas" });
  }
});

app.listen(PORT, () => console.log(`✓ API rodando em http://localhost:${PORT}`));
