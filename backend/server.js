require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const { Pool }   = require("pg");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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

// ── E-mail (redefinição de senha) ───────────────────────────────────────────
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ── Auth: login ─────────────────────────────────────────────────────────────
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: "E-mail ou senha incorretos" });

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
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
    const { rows } = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase(), hash]
    );
    const token = jwt.sign({ id: rows[0].id, email: rows[0].email }, SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "E-mail já cadastrado" });
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── Auth: esqueceu a senha ──────────────────────────────────────────────────
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email?.toLowerCase()]);

    if (rows[0] && process.env.SMTP_HOST) {
      const resetToken = jwt.sign({ id: rows[0].id, purpose: "reset" }, SECRET, { expiresIn: "1h" });
      const link = `${process.env.FRONTEND_URL || "http://localhost:5173"}?reset=${resetToken}`;
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Redefinição de senha — Matriz GUT",
        html: `<p>Clique no link abaixo para redefinir sua senha (válido por 1 hora):</p>
               <p><a href="${link}">${link}</a></p>`,
      });
    }
    // Responde igual independente de o e-mail existir (evita enumeração)
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
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, payload.id]);
    res.json({ message: "Senha redefinida com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── Problems: listar ────────────────────────────────────────────────────────
app.get("/problems", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM problems WHERE user_id = $1 ORDER BY created_at",
      [req.user.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao buscar problemas" });
  }
});

// ── Problems: criar ─────────────────────────────────────────────────────────
app.post("/problems", requireAuth, async (req, res) => {
  try {
    const { nome = "", g = 3, u = 3, t = 3 } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO problems (user_id, nome, g, u, t) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.user.id, nome, g, u, t]
    );
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

    const sets   = updates.map(([k], i) => `${k} = $${i + 3}`).join(", ");
    const values = updates.map(([, v]) => v);
    await pool.query(
      `UPDATE problems SET ${sets} WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id, ...values]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar problema" });
  }
});

// ── Problems: remover ───────────────────────────────────────────────────────
app.delete("/problems/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM problems WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao remover problema" });
  }
});

// ── Problems: substituir todos (Exemplo / Limpar) ───────────────────────────
app.post("/problems/replace", requireAuth, async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    await pool.query("DELETE FROM problems WHERE user_id = $1", [req.user.id]);
    if (!items.length) return res.json([]);

    const placeholders = items
      .map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`)
      .join(", ");
    const values = [req.user.id, ...items.flatMap(({ nome = "", g = 3, u = 3, t = 3 }) => [nome, g, u, t])];
    const { rows } = await pool.query(
      `INSERT INTO problems (user_id, nome, g, u, t) VALUES ${placeholders} RETURNING *`,
      values
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao substituir problemas" });
  }
});

app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
