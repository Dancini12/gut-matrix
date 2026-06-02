import express from "express";
import cors from "cors";
import { createClient } from "@libsql/client";
import bcryptjs from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";

const app = express();

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const SECRET  = new TextEncoder().encode(process.env.JWT_SECRET || "troque-em-producao");
const ORIGIN  = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({ origin: ORIGIN }));
app.use(express.json());

// ── Auth middleware ─────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ error: "Não autorizado" });
  try {
    const { payload } = await jwtVerify(header.slice(7), SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

// ── Auth: login ─────────────────────────────────────────────────────────────
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email.toLowerCase()] });
    const user = rows[0];
    if (!user || !(await bcryptjs.compare(password, user.password_hash)))
      return res.status(401).json({ error: "E-mail ou senha incorretos" });

    const token = await signToken({ id: user.id, email: user.email });
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

    const hash = await bcryptjs.hash(password, 10);
    const id   = randomUUID();
    try {
      await db.execute({ sql: "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", args: [id, email.toLowerCase(), hash] });
    } catch (e) {
      if (e.message?.includes("UNIQUE"))
        return res.status(409).json({ error: "E-mail já cadastrado" });
      throw e;
    }
    const token = await signToken({ id, email: email.toLowerCase() });
    res.status(201).json({ token, user: { id, email: email.toLowerCase() } });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── Auth: esqueceu a senha ──────────────────────────────────────────────────
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const { rows } = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email?.toLowerCase()] });
    if (rows[0] && process.env.SMTP_HOST) {
      const resetToken = await signToken({ id: rows[0].id, purpose: "reset", exp: Math.floor(Date.now() / 1000) + 3600 });
      const link = `${ORIGIN}?reset=${resetToken}`;
      const mailer = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Redefinição de senha — Matriz GUT",
        html: `<p>Clique no link abaixo para redefinir sua senha (válido por 1 hora):</p><p><a href="${link}">${link}</a></p>`,
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
    try { ({ payload } = await jwtVerify(token, SECRET)); } catch {
      return res.status(400).json({ error: "Link inválido ou expirado" });
    }
    if (payload.purpose !== "reset")
      return res.status(400).json({ error: "Token inválido" });
    const hash = await bcryptjs.hash(password, 10);
    await db.execute({ sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [hash, payload.id] });
    res.json({ message: "Senha redefinida com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── Problems: listar ────────────────────────────────────────────────────────
app.get("/problems", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: "SELECT * FROM problems WHERE user_id = ? ORDER BY created_at", args: [req.user.id] });
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao buscar problemas" });
  }
});

// ── Problems: criar ─────────────────────────────────────────────────────────
app.post("/problems", requireAuth, async (req, res) => {
  try {
    const { nome = "", g = 3, u = 3, t = 3 } = req.body;
    const id = randomUUID();
    await db.execute({ sql: "INSERT INTO problems (id, user_id, nome, g, u, t) VALUES (?, ?, ?, ?, ?, ?)", args: [id, req.user.id, nome, g, u, t] });
    const { rows } = await db.execute({ sql: "SELECT * FROM problems WHERE id = ?", args: [id] });
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao criar problema" });
  }
});

// ── Problems: atualizar ─────────────────────────────────────────────────────
app.patch("/problems/:id", requireAuth, async (req, res) => {
  try {
    const allowed = ["nome", "g", "u", "t"];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (!updates.length)
      return res.status(400).json({ error: "Nenhum campo válido informado" });
    const sets   = updates.map(([k]) => `${k} = ?`).join(", ");
    const values = updates.map(([, v]) => v);
    await db.execute({ sql: `UPDATE problems SET ${sets} WHERE id = ? AND user_id = ?`, args: [...values, req.params.id, req.user.id] });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar problema" });
  }
});

// ── Problems: remover ───────────────────────────────────────────────────────
app.delete("/problems/:id", requireAuth, async (req, res) => {
  try {
    await db.execute({ sql: "DELETE FROM problems WHERE id = ? AND user_id = ?", args: [req.params.id, req.user.id] });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao remover problema" });
  }
});

// ── Problems: substituir todos ──────────────────────────────────────────────
app.post("/problems/replace", requireAuth, async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    await db.execute({ sql: "DELETE FROM problems WHERE user_id = ?", args: [req.user.id] });
    if (!items.length) return res.json([]);

    const ids = [];
    for (const { nome = "", g = 3, u = 3, t = 3 } of items) {
      const id = randomUUID();
      ids.push(id);
      await db.execute({ sql: "INSERT INTO problems (id, user_id, nome, g, u, t) VALUES (?, ?, ?, ?, ?, ?)", args: [id, req.user.id, nome, g, u, t] });
    }
    const placeholders = ids.map(() => "?").join(",");
    const { rows } = await db.execute({ sql: `SELECT * FROM problems WHERE id IN (${placeholders}) ORDER BY created_at`, args: ids });
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao substituir problemas" });
  }
});

// ── Local dev server ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`✓ API rodando em http://localhost:${PORT}`));
}

export default app;
