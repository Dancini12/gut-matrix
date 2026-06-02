import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "./supabase";

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────
const ESCALA = {
  g: {
    titulo: "Gravidade",
    pergunta: "Qual o impacto se nada for feito?",
    niveis: { 5: "Extremamente grave", 4: "Muito grave", 3: "Grave", 2: "Pouco grave", 1: "Sem gravidade" },
  },
  u: {
    titulo: "Urgência",
    pergunta: "Qual o prazo para agir?",
    niveis: { 5: "Ação imediata", 4: "Muito urgente", 3: "Urgente", 2: "Pouco urgente", 1: "Pode esperar" },
  },
  t: {
    titulo: "Tendência",
    pergunta: "Como evolui se não agir?",
    niveis: { 5: "Piora rapidamente", 4: "Piora em breve", 3: "Irá piorar", 2: "Piora a longo prazo", 1: "Não irá mudar" },
  },
};

const PRESET = [
  { nome: "Atraso na entrega de pedidos", g: 4, u: 4, t: 4 },
  { nome: "Reclamações no atendimento",   g: 3, u: 3, t: 3 },
  { nome: "Falta de divulgação nas redes", g: 4, u: 3, t: 4 },
  { nome: "Equipe sobrecarregada",        g: 3, u: 4, t: 4 },
];

const tier = (v) => {
  if (v >= 100) return { rotulo: "Crítica", cor: "#b3261e" };
  if (v >= 50)  return { rotulo: "Alta",    cor: "#d9772b" };
  if (v >= 20)  return { rotulo: "Média",   cor: "#c6a015" };
  return               { rotulo: "Baixa",   cor: "#4f8a5b" };
};

// ─────────────────────────────────────────────
// Estilos compartilhados
// ─────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=DM+Sans:wght@400;500;600&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  :root { --ink:#1c1a17; --paper:#f6f2ea; --card:#fffdf8; --line:#e3dccd; --muted:#a89e8c; --accent:#c4521e; }

  .wrap { background:var(--paper); color:var(--ink); min-height:100vh; font-family:'DM Sans',system-ui,sans-serif; padding:28px; }

  /* Auth */
  .auth-wrap { background:var(--paper); color:var(--ink); min-height:100vh; font-family:'DM Sans',system-ui,sans-serif;
    display:flex; align-items:center; justify-content:center; padding:24px; }
  .auth-box  { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:36px 32px; width:100%; max-width:400px; }
  .auth-logo { font-family:'Fraunces',serif; font-weight:600; font-size:26px; margin:8px 0 4px; letter-spacing:-.01em; }
  .auth-sub  { color:var(--muted); font-size:13.5px; margin-bottom:28px; line-height:1.5; }
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .field label { font-size:12.5px; font-weight:600; letter-spacing:.02em; }
  .field input { border:1px solid var(--line); background:#fff; border-radius:9px; padding:10px 12px;
    font-family:inherit; font-size:14.5px; color:var(--ink); transition:.12s; }
  .field input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px #c4521e18; }
  .auth-error   { background:#fdf0ed; border:1px solid #e8a07f; border-radius:8px; padding:9px 12px; font-size:13px; color:#b3261e; margin-bottom:12px; }
  .auth-success { background:#edf7f0; border:1px solid #7fc49a; border-radius:8px; padding:12px 14px; font-size:13.5px; color:#2d6a45; margin-bottom:12px; line-height:1.5; }
  .btn-primary { width:100%; padding:12px; background:var(--accent); color:#fff; border:none; border-radius:10px;
    font-family:inherit; font-size:14.5px; font-weight:600; cursor:pointer; transition:.12s; margin-top:4px; }
  .btn-primary:hover    { background:#a8421a; }
  .btn-primary:disabled { opacity:.55; cursor:not-allowed; }
  .auth-divider { border:none; border-top:1px solid var(--line); margin:18px 0; }
  .link-btn { background:none; border:none; font-family:inherit; font-size:13.5px; color:var(--accent);
    cursor:pointer; padding:0; text-decoration:underline; text-underline-offset:3px; }
  .link-btn:hover { color:#a8421a; }
  .auth-footer { text-align:center; margin-top:18px; font-size:13px; color:var(--muted); }

  /* App header */
  .head { margin-bottom:18px; border-bottom:1px solid var(--line); padding-bottom:16px;
    display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .kicker { font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:var(--accent); font-weight:600; }
  h1 { font-family:'Fraunces',serif; font-weight:600; font-size:30px; margin:6px 0 4px; letter-spacing:-.01em; }
  .sub { color:var(--muted); font-size:14px; max-width:64ch; }
  .sub b { color:var(--ink); }
  .logout-btn { border:1px solid var(--line); background:transparent; border-radius:9px; padding:8px 14px;
    font-family:inherit; font-size:13px; font-weight:500; color:var(--muted); cursor:pointer; flex-shrink:0; margin-top:6px; }
  .logout-btn:hover { border-color:var(--accent); color:var(--accent); }

  /* Insight */
  .insight { background:linear-gradient(180deg,#fff6ef,#fffdf8); border:1px solid #e8a07f; border-radius:12px;
    padding:14px 16px; margin-bottom:16px; font-size:14.5px; line-height:1.5; }
  .insight b { color:var(--accent); }

  /* Toolbar */
  .toolbar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; align-items:center; }
  .chip { font-size:12.5px; font-weight:500; padding:7px 13px; border-radius:999px; border:1px solid var(--line); background:transparent; cursor:pointer; color:var(--ink); }
  .chip:hover { border-color:var(--accent); color:var(--accent); }
  .legenda { display:flex; gap:16px; flex-wrap:wrap; font-size:12.5px; color:var(--muted); margin-left:auto; }
  .legenda span { display:flex; align-items:center; gap:6px; }
  .ldot { width:11px; height:11px; border-radius:3px; display:inline-block; }

  /* Problem card */
  .pcard { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; margin-bottom:14px; }
  .pcard-top { display:flex; align-items:center; gap:11px; flex-wrap:wrap; }
  .rank { width:30px; height:30px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; color:#fff; flex-shrink:0; }
  input.nome { flex:1; min-width:180px; border:1px solid var(--line); background:#fff; border-radius:8px; padding:9px 11px; font-family:inherit; font-size:14.5px; color:var(--ink); }
  input.nome:focus { outline:none; border-color:var(--accent); }
  .result { display:flex; align-items:center; gap:10px; }
  .result .lbl { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
  .gut   { font-family:'Fraunces',serif; font-weight:600; font-size:24px; line-height:1; }
  .badge { font-size:11px; font-weight:600; color:#fff; padding:3px 9px; border-radius:999px; }
  .del   { border:none; background:none; color:var(--muted); cursor:pointer; font-size:20px; padding:2px 6px; border-radius:6px; }
  .del:hover { color:var(--accent); background:#f3ebe2; }

  /* Dimensions */
  .dims { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:15px; }
  @media (max-width:760px){ .dims{ grid-template-columns:1fr; } }
  .dim-head { font-family:'Fraunces',serif; font-size:13.5px; font-weight:600; }
  .dim-q  { font-size:11px; color:var(--muted); margin:1px 0 8px; }
  .opts   { display:flex; flex-direction:column; gap:6px; }
  .opt    { display:flex; align-items:center; gap:9px; width:100%; text-align:left; border:1px solid var(--line); background:#fff; border-radius:9px; padding:8px 10px; font-family:inherit; font-size:12.5px; color:var(--ink); cursor:pointer; transition:.12s; }
  .opt:hover { border-color:#d8b9a6; }
  .opt.on { border-color:var(--accent); background:#fbeee6; font-weight:600; }
  .opt .n { width:21px; height:21px; border-radius:6px; background:#efe7d8; color:#5c5346; font-weight:700; font-size:11.5px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .opt.on .n { background:var(--accent); color:#fff; }

  /* Add / Chart */
  .add  { width:100%; padding:11px; border:1px dashed var(--line); background:transparent; border-radius:11px; font-family:inherit; font-size:13.5px; font-weight:500; color:var(--muted); cursor:pointer; margin-bottom:18px; }
  .add:hover { border-color:var(--accent); color:var(--accent); }
  .card   { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; margin-bottom:16px; }
  .card h2 { font-family:'Fraunces',serif; font-size:16px; font-weight:600; margin:0 0 12px; }

  /* Loading */
  .loading { display:flex; align-items:center; justify-content:center; min-height:100vh;
    font-family:'DM Sans',system-ui,sans-serif; color:var(--muted); background:var(--paper); font-size:15px; }
`;

// ─────────────────────────────────────────────
// Componente Opcoes (fora de App para evitar remount)
// ─────────────────────────────────────────────
function Opcoes({ r, campo, setCampo }) {
  return (
    <div className="dim">
      <div className="dim-head">{ESCALA[campo].titulo}</div>
      <div className="dim-q">{ESCALA[campo].pergunta}</div>
      <div className="opts">
        {[5, 4, 3, 2, 1].map((n) => (
          <button key={n} className={`opt ${r[campo] === n ? "on" : ""}`}
            onClick={() => setCampo(r.id, campo, n)}>
            <span className="n">{n}</span> {ESCALA[campo].niveis[n]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tela de Login
// ─────────────────────────────────────────────
function TelaLogin({ onForgot }) {
  const [email, setEmail]         = useState("");
  const [senha, setSenha]         = useState("");
  const [erro, setErro]           = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    if (!email.trim()) { setErro("Informe seu e-mail."); return; }
    if (!senha)         { setErro("Informe sua senha."); return; }
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) setErro("E-mail ou senha incorretos.");
    // se ok, o listener onAuthStateChange em App cuida da navegação
  };

  return (
    <div className="auth-wrap">
      <style>{STYLES}</style>
      <div className="auth-box">
        <div className="kicker">Ferramenta de Priorização</div>
        <div className="auth-logo">Matriz GUT</div>
        <p className="auth-sub">Entre com sua conta para acessar a ferramenta.</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" placeholder="voce@empresa.com"
              value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="senha">Senha</label>
            <input id="senha" type="password" placeholder="••••••••"
              value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
          </div>
          {erro && <div className="auth-error">{erro}</div>}
          <button type="submit" className="btn-primary" disabled={carregando}>
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <hr className="auth-divider" />
        <div className="auth-footer">
          <button className="link-btn" onClick={onForgot}>Esqueceu sua senha?</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tela Esqueceu a Senha
// ─────────────────────────────────────────────
function TelaEsqueceuSenha({ onVoltar }) {
  const [email, setEmail]         = useState("");
  const [erro, setErro]           = useState("");
  const [enviado, setEnviado]     = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    if (!email.trim()) { setErro("Informe seu e-mail."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErro("E-mail inválido."); return; }
    setCarregando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setCarregando(false);
    if (error) { setErro("Não foi possível enviar o e-mail. Tente novamente."); return; }
    setEnviado(true);
  };

  return (
    <div className="auth-wrap">
      <style>{STYLES}</style>
      <div className="auth-box">
        <div className="kicker">Recuperação de acesso</div>
        <div className="auth-logo">Redefinir senha</div>
        <p className="auth-sub">
          {enviado
            ? "Verifique sua caixa de entrada."
            : "Informe o e-mail da sua conta e enviaremos um link para redefinir sua senha."}
        </p>
        {enviado ? (
          <>
            <div className="auth-success">
              Link enviado para <strong>{email}</strong>.<br />
              Verifique também a pasta de spam.
            </div>
            <button className="btn-primary" onClick={onVoltar}>Voltar ao login</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="forgot-email">E-mail</label>
              <input id="forgot-email" type="email" placeholder="voce@empresa.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            {erro && <div className="auth-error">{erro}</div>}
            <button type="submit" className="btn-primary" disabled={carregando}>
              {carregando ? "Enviando…" : "Enviar link de redefinição"}
            </button>
            <hr className="auth-divider" />
            <div className="auth-footer">
              <button type="button" className="link-btn" onClick={onVoltar}>← Voltar ao login</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// App principal
// ─────────────────────────────────────────────
export default function App() {
  const [sessao, setSessao]   = useState(undefined); // undefined = carregando, null = deslogado
  const [tela, setTela]       = useState("login");   // "login" | "esqueceu"
  const [rows, setRows]       = useState([]);
  const [salvando, setSalvando] = useState(false);

  // ── Sessão Supabase ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, s) => setSessao(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Carregar problemas do banco quando loga ──
  useEffect(() => {
    if (!sessao) { setRows([]); return; }
    supabase
      .from("problems")
      .select("*")
      .order("created_at")
      .then(({ data }) => setRows(data ?? []));
  }, [sessao]);

  // ── CRUD com Supabase ──
  const setCampo = async (id, campo, val) => {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, [campo]: val } : r)));
    await supabase.from("problems").update({ [campo]: val }).eq("id", id);
  };

  const remover = async (id) => {
    setRows((p) => p.filter((r) => r.id !== id));
    await supabase.from("problems").delete().eq("id", id);
  };

  const add = async () => {
    const nova = { nome: "", g: 3, u: 3, t: 3, user_id: sessao.user.id };
    const { data } = await supabase.from("problems").insert(nova).select().single();
    if (data) setRows((p) => [...p, data]);
  };

  const carregarPreset = async () => {
    setSalvando(true);
    await supabase.from("problems").delete().eq("user_id", sessao.user.id);
    const inserir = PRESET.map((d) => ({ ...d, user_id: sessao.user.id }));
    const { data } = await supabase.from("problems").insert(inserir).select();
    setRows(data ?? []);
    setSalvando(false);
  };

  const limpar = async () => {
    setSalvando(true);
    await supabase.from("problems").delete().eq("user_id", sessao.user.id);
    const { data } = await supabase.from("problems").insert({ nome: "", g: 3, u: 3, t: 3, user_id: sessao.user.id }).select().single();
    setRows(data ? [data] : []);
    setSalvando(false);
  };

  const logout = () => supabase.auth.signOut();

  // ── Ranking ──
  const ranking = useMemo(() => {
    const valid = rows
      .map((r) => ({ ...r, gut: r.g * r.u * r.t }))
      .filter((r) => r.nome.trim() !== "")
      .sort((a, b) => b.gut - a.gut || a.nome.localeCompare(b.nome));
    const rankMap = {};
    valid.forEach((r, i) => (rankMap[r.id] = i + 1));
    return { ordenado: valid, rankMap };
  }, [rows]);

  const top   = ranking.ordenado[0];
  const chart = ranking.ordenado.slice(0, 10).map((r) => ({
    nome: r.nome.length > 22 ? r.nome.slice(0, 21) + "…" : r.nome,
    gut: r.gut,
    cor: tier(r.gut).cor,
  }));

  // ── Loading inicial ──
  if (sessao === undefined) {
    return <div className="loading"><style>{STYLES}</style>Carregando…</div>;
  }

  // ── Auth screens ──
  if (!sessao) {
    if (tela === "esqueceu") return <TelaEsqueceuSenha onVoltar={() => setTela("login")} />;
    return <TelaLogin onForgot={() => setTela("esqueceu")} />;
  }

  // ── App ──
  return (
    <div className="wrap">
      <style>{STYLES}</style>

      <div className="head">
        <div>
          <div className="kicker">Ferramenta de Priorização</div>
          <h1>Matriz GUT</h1>
          <p className="sub">
            Para cada problema, toque em <b>Gravidade</b>, <b>Urgência</b> e <b>Tendência</b>.
            Prioridade: <b>GUT = G × U × T</b> — quanto maior, mais urgente.
          </p>
        </div>
        <button className="logout-btn" onClick={logout}>
          Sair ({sessao.user.email})
        </button>
      </div>

      {top && (
        <div className="insight">
          Prioridade nº 1: <b>{top.nome}</b> — GUT {top.gut} ({tier(top.gut).rotulo.toLowerCase()}). Comece por aqui.
        </div>
      )}

      <div className="toolbar">
        <button className="chip" onClick={carregarPreset} disabled={salvando}>Exemplo</button>
        <button className="chip" onClick={limpar} disabled={salvando}>Limpar</button>
        <div className="legenda">
          <span><i className="ldot" style={{ background: "#b3261e" }} /> Crítica (≥100)</span>
          <span><i className="ldot" style={{ background: "#d9772b" }} /> Alta (50–99)</span>
          <span><i className="ldot" style={{ background: "#c6a015" }} /> Média (20–49)</span>
          <span><i className="ldot" style={{ background: "#4f8a5b" }} /> Baixa (&lt;20)</span>
        </div>
      </div>

      {rows.map((r) => {
        const gut = r.g * r.u * r.t;
        const t   = tier(gut);
        const rk  = ranking.rankMap[r.id];
        return (
          <div className="pcard" key={r.id}>
            <div className="pcard-top">
              {rk
                ? <span className="rank" style={{ background: t.cor }}>{rk}</span>
                : <span className="rank" style={{ background: "#cbbfa9" }}>–</span>}
              <input className="nome" value={r.nome} placeholder="Descreva o problema"
                aria-label="Nome do problema"
                onChange={(e) => setCampo(r.id, "nome", e.target.value)} />
              <div className="result">
                <span className="lbl">GUT</span>
                <span className="gut" style={{ color: t.cor }}>{gut}</span>
                <span className="badge" style={{ background: t.cor }}>{t.rotulo}</span>
              </div>
              <button className="del" onClick={() => remover(r.id)} aria-label="Remover problema">×</button>
            </div>
            <div className="dims">
              <Opcoes r={r} campo="g" setCampo={setCampo} />
              <Opcoes r={r} campo="u" setCampo={setCampo} />
              <Opcoes r={r} campo="t" setCampo={setCampo} />
            </div>
          </div>
        );
      })}

      <button className="add" onClick={add}>+ adicionar problema</button>

      {chart.length > 0 && (
        <div className="card">
          <h2>Ranking de prioridade</h2>
          <div style={{ width: "100%", height: Math.max(160, chart.length * 38) }}>
            <ResponsiveContainer>
              <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
                <XAxis type="number" hide domain={[0, 125]} />
                <YAxis type="category" dataKey="nome" width={150}
                  tick={{ fontSize: 11.5, fill: "#5c5346" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#00000008" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e3dccd", fontSize: 12 }}
                  formatter={(v) => [v, "GUT"]} />
                <Bar dataKey="gut" radius={[0, 5, 5, 0]} barSize={20}
                  label={{ position: "right", fontSize: 11, fill: "#5c5346" }}>
                  {chart.map((c, i) => <Cell key={`${c.nome}-${i}`} fill={c.cor} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
