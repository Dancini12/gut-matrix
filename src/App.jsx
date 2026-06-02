import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { auth, problems as api } from "./api";

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
  { nome: "Atraso na entrega de pedidos",  g: 4, u: 4, t: 4 },
  { nome: "Reclamações no atendimento",    g: 3, u: 3, t: 3 },
  { nome: "Falta de divulgação nas redes", g: 4, u: 3, t: 4 },
  { nome: "Equipe sobrecarregada",         g: 3, u: 4, t: 4 },
];

const tier = (v) => {
  if (v >= 100) return { rotulo: "Crítica", cor: "#8b1a1a" };
  if (v >= 50)  return { rotulo: "Alta",    cor: "#b85c00" };
  if (v >= 20)  return { rotulo: "Média",   cor: "#8a6800" };
  return               { rotulo: "Baixa",   cor: "#2d6a45" };
};

// ─────────────────────────────────────────────
// Estilos — layout UENP
// ─────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Condensed:wght@700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --navy:      #1c2d5e;
    --navy-dark: #141f42;
    --navy-mid:  #243b7a;
    --gold:      #c9992a;
    --gold-lt:   #e8c56a;
    --paper:     #f0f2f7;
    --card:      #ffffff;
    --line:      #d0d6e8;
    --muted:     #6b7898;
    --ink:       #1a1f36;
    --red:       #c0392b;
  }
  body { background:var(--paper); font-family:'Roboto',system-ui,sans-serif; color:var(--ink); }

  /* ── Loading ── */
  .loading { display:flex; align-items:center; justify-content:center; min-height:100vh;
    background:var(--navy); color:#fff; font-size:15px; letter-spacing:.04em; }

  /* ── Top utility bar ── */
  .top-bar { background:var(--navy-dark); display:flex; align-items:center; justify-content:flex-end;
    padding:5px 24px; gap:12px; font-size:11.5px; }
  .top-bar a, .top-bar button { color:rgba(255,255,255,.75); background:none; border:none;
    font:inherit; cursor:pointer; text-decoration:none; padding:3px 8px; border-radius:3px; transition:.12s; }
  .top-bar a:hover, .top-bar button:hover { color:#fff; background:rgba(255,255,255,.1); }
  .top-bar .sep { color:rgba(255,255,255,.3); user-select:none; }

  /* ── Header ── */
  .site-header { background:var(--card); border-bottom:3px solid var(--gold);
    display:flex; align-items:center; justify-content:space-between; padding:14px 24px; gap:16px; }
  .brand { display:flex; align-items:center; gap:14px; text-decoration:none; }
  .brand-badge { background:var(--navy); color:#fff; font-family:'Roboto Condensed',sans-serif;
    font-weight:700; font-size:26px; letter-spacing:.04em; padding:8px 14px; border-radius:4px;
    position:relative; }
  .brand-badge::after { content:''; position:absolute; bottom:-3px; left:0; right:0; height:3px; background:var(--gold); border-radius:0 0 4px 4px; }
  .brand-text { line-height:1.25; }
  .brand-title { font-size:17px; font-weight:700; color:var(--navy); letter-spacing:-.01em; }
  .brand-sub   { font-size:11px; color:var(--muted); letter-spacing:.01em; }
  .header-user { display:flex; align-items:center; gap:10px; font-size:13px; color:var(--muted); }
  .header-user strong { color:var(--navy); }
  .logout-btn { border:1px solid var(--line); background:transparent; border-radius:4px; padding:6px 14px;
    font:inherit; font-size:12.5px; font-weight:500; color:var(--navy); cursor:pointer; transition:.12s; }
  .logout-btn:hover { background:var(--navy); color:#fff; border-color:var(--navy); }

  /* ── Main nav bar ── */
  .main-nav { background:var(--navy); display:flex; align-items:center; gap:2px; padding:0 20px; overflow-x:auto; }
  .main-nav a, .main-nav button { color:rgba(255,255,255,.8); background:none; border:none; font:inherit;
    font-size:13px; font-weight:500; cursor:pointer; text-decoration:none; padding:13px 14px;
    white-space:nowrap; border-bottom:3px solid transparent; transition:.12s; }
  .main-nav a:hover, .main-nav button:hover,
  .main-nav a.active, .main-nav button.active { color:#fff; border-bottom-color:var(--gold); }

  /* ── Breadcrumb ── */
  .breadcrumb { background:var(--card); border-bottom:1px solid var(--line); padding:8px 24px;
    font-size:12px; color:var(--muted); display:flex; align-items:center; gap:6px; }
  .breadcrumb span { color:var(--muted); }
  .breadcrumb b { color:var(--navy); font-weight:500; }

  /* ── Page layout ── */
  .page-body { display:flex; align-items:flex-start; gap:0; max-width:1200px; margin:0 auto; padding:24px 24px; }
  @media(max-width:900px){ .page-body { flex-direction:column; } }

  /* ── Sidebar ── */
  .sidebar { width:220px; flex-shrink:0; margin-right:24px; }
  @media(max-width:900px){ .sidebar{ width:100%; margin-right:0; margin-bottom:20px; } }
  .sidebar-logo { background:var(--navy); color:#fff; border-radius:6px 6px 0 0; padding:18px 16px; text-align:center; margin-bottom:0; }
  .sidebar-logo .sl-abbr { font-family:'Roboto Condensed',sans-serif; font-weight:700; font-size:28px;
    letter-spacing:.08em; color:var(--gold); }
  .sidebar-logo .sl-name { font-size:10.5px; color:rgba(255,255,255,.7); margin-top:3px; line-height:1.4; }
  .sidebar-nav { background:var(--card); border:1px solid var(--line); border-top:none; border-radius:0 0 6px 6px; }
  .sidebar-nav-title { padding:10px 14px 6px; font-size:10.5px; font-weight:700; color:var(--muted);
    text-transform:uppercase; letter-spacing:.1em; border-bottom:1px solid var(--line); }
  .sidebar-nav a, .sidebar-nav button { display:block; width:100%; text-align:left; padding:9px 14px;
    font:inherit; font-size:13px; color:var(--navy); background:none; border:none; cursor:pointer;
    border-bottom:1px solid var(--line); text-decoration:none; transition:.12s; }
  .sidebar-nav a:last-child, .sidebar-nav button:last-child { border-bottom:none; }
  .sidebar-nav a:hover, .sidebar-nav button:hover { background:var(--paper); color:var(--navy-mid); }
  .sidebar-nav a.active, .sidebar-nav button.active { background:#eef1fa; color:var(--navy); font-weight:600;
    border-left:3px solid var(--gold); }
  .sidebar-legenda { background:var(--card); border:1px solid var(--line); border-radius:6px; padding:14px; margin-top:14px; }
  .sidebar-legenda-title { font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; margin-bottom:10px; }
  .leg-item { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--ink); margin-bottom:7px; }
  .leg-item:last-child { margin-bottom:0; }
  .leg-dot { width:12px; height:12px; border-radius:3px; flex-shrink:0; }

  /* ── Main content ── */
  .main-content { flex:1; min-width:0; }
  .page-title-bar { background:var(--card); border:1px solid var(--line); border-radius:6px;
    padding:16px 20px; margin-bottom:16px; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .page-title { font-size:20px; font-weight:700; color:var(--navy); margin-bottom:3px; }
  .page-desc  { font-size:13px; color:var(--muted); max-width:60ch; line-height:1.5; }
  .page-desc b { color:var(--ink); }

  /* ── Insight ── */
  .insight { background:#eef1fa; border-left:4px solid var(--navy); border-radius:0 6px 6px 0;
    padding:12px 16px; margin-bottom:16px; font-size:13.5px; line-height:1.5; color:var(--ink); }
  .insight b { color:var(--navy); }

  /* ── Toolbar ── */
  .toolbar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; align-items:center; }
  .btn-action { font-size:12.5px; font-weight:500; padding:7px 16px; border-radius:4px;
    border:1px solid var(--navy); background:var(--navy); color:#fff; cursor:pointer; transition:.12s; }
  .btn-action:hover { background:var(--navy-mid); }
  .btn-action.outline { background:transparent; color:var(--navy); }
  .btn-action.outline:hover { background:var(--navy); color:#fff; }
  .btn-action:disabled { opacity:.5; cursor:not-allowed; }

  /* ── Problem card ── */
  .pcard { background:var(--card); border:1px solid var(--line); border-radius:6px; margin-bottom:12px;
    overflow:hidden; }
  .pcard-header { display:flex; align-items:center; gap:10px; padding:12px 16px;
    border-bottom:1px solid var(--line); flex-wrap:wrap; }
  .rank-badge { width:28px; height:28px; border-radius:4px; display:inline-flex; align-items:center;
    justify-content:center; font-weight:700; font-size:12px; color:#fff; flex-shrink:0; }
  input.nome { flex:1; min-width:160px; border:1px solid var(--line); background:#f8f9fc; border-radius:4px;
    padding:7px 10px; font:inherit; font-size:14px; color:var(--ink); transition:.12s; }
  input.nome:focus { outline:none; border-color:var(--navy); background:#fff; box-shadow:0 0 0 3px rgba(28,45,94,.1); }
  .gut-result { display:flex; align-items:center; gap:8px; }
  .gut-lbl  { font-size:10.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
  .gut-val  { font-size:22px; font-weight:700; line-height:1; }
  .tier-badge { font-size:11px; font-weight:700; color:#fff; padding:3px 9px; border-radius:3px; }
  .del { border:none; background:none; color:var(--muted); cursor:pointer; font-size:18px; padding:3px 7px;
    border-radius:4px; margin-left:auto; }
  .del:hover { color:var(--red); background:#fdecea; }

  /* ── Dimensions grid ── */
  .dims { display:grid; grid-template-columns:repeat(3,1fr); gap:0; }
  @media(max-width:760px){ .dims{ grid-template-columns:1fr; } }
  .dim { padding:14px 16px; border-right:1px solid var(--line); }
  .dim:last-child { border-right:none; }
  .dim-head { font-size:12.5px; font-weight:700; color:var(--navy); margin-bottom:2px; }
  .dim-q    { font-size:11px; color:var(--muted); margin-bottom:10px; }
  .opts     { display:flex; flex-direction:column; gap:5px; }
  .opt { display:flex; align-items:center; gap:8px; width:100%; text-align:left; border:1px solid var(--line);
    background:#f8f9fc; border-radius:4px; padding:7px 10px; font:inherit; font-size:12px; color:var(--ink);
    cursor:pointer; transition:.12s; }
  .opt:hover { border-color:var(--navy); background:#eef1fa; }
  .opt.on { border-color:var(--navy); background:#eef1fa; font-weight:600; color:var(--navy); }
  .opt .n { width:20px; height:20px; border-radius:3px; background:var(--line); color:var(--muted);
    font-weight:700; font-size:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .opt.on .n { background:var(--navy); color:#fff; }

  /* ── Add button ── */
  .add-btn { width:100%; padding:10px; border:2px dashed var(--line); background:transparent; border-radius:6px;
    font:inherit; font-size:13px; font-weight:500; color:var(--muted); cursor:pointer; margin-bottom:16px;
    transition:.12s; }
  .add-btn:hover { border-color:var(--navy); color:var(--navy); background:#eef1fa; }

  /* ── Chart card ── */
  .chart-card { background:var(--card); border:1px solid var(--line); border-radius:6px; padding:16px; margin-bottom:16px; }
  .chart-card h2 { font-size:14px; font-weight:700; color:var(--navy); margin-bottom:14px;
    padding-bottom:10px; border-bottom:1px solid var(--line); }

  /* ── Auth screens ── */
  .auth-page { min-height:100vh; background:var(--paper); display:flex; flex-direction:column; }
  .auth-header { background:var(--navy); padding:16px 24px; display:flex; align-items:center; gap:14px; }
  .auth-header .brand-badge { font-size:20px; padding:6px 10px; }
  .auth-header .brand-title { color:#fff; font-size:15px; }
  .auth-header .brand-sub   { color:rgba(255,255,255,.6); font-size:11px; }
  .auth-gold-bar { height:4px; background:var(--gold); }
  .auth-center { flex:1; display:flex; align-items:center; justify-content:center; padding:32px 20px; }
  .auth-box { background:var(--card); border:1px solid var(--line); border-radius:6px;
    width:100%; max-width:420px; overflow:hidden; box-shadow:0 4px 24px rgba(28,45,94,.1); }
  .auth-box-header { background:var(--navy); padding:22px 28px; }
  .auth-box-title { font-size:18px; font-weight:700; color:#fff; margin-bottom:3px; }
  .auth-box-sub   { font-size:12.5px; color:rgba(255,255,255,.65); }
  .auth-box-body  { padding:24px 28px; }
  .field { display:flex; flex-direction:column; gap:5px; margin-bottom:14px; }
  .field label { font-size:12px; font-weight:700; color:var(--navy); text-transform:uppercase; letter-spacing:.05em; }
  .field input { border:1px solid var(--line); background:#f8f9fc; border-radius:4px; padding:10px 12px;
    font:inherit; font-size:14px; color:var(--ink); transition:.12s; }
  .field input:focus { outline:none; border-color:var(--navy); background:#fff; box-shadow:0 0 0 3px rgba(28,45,94,.1); }
  .auth-error   { background:#fdecea; border:1px solid #f5b7b1; border-radius:4px; padding:9px 12px;
    font-size:13px; color:var(--red); margin-bottom:14px; }
  .auth-success { background:#eafaf1; border:1px solid #a9dfbf; border-radius:4px; padding:10px 14px;
    font-size:13px; color:#196f3d; margin-bottom:14px; line-height:1.5; }
  .btn-primary { width:100%; padding:11px; background:var(--navy); color:#fff; border:none; border-radius:4px;
    font:inherit; font-size:14px; font-weight:700; cursor:pointer; transition:.12s; letter-spacing:.02em; }
  .btn-primary:hover    { background:var(--navy-mid); }
  .btn-primary:disabled { opacity:.55; cursor:not-allowed; }
  .auth-divider { border:none; border-top:1px solid var(--line); margin:18px 0; }
  .auth-footer  { text-align:center; font-size:13px; color:var(--muted); }
  .link-btn { background:none; border:none; font:inherit; font-size:13px; font-weight:600; color:var(--navy);
    cursor:pointer; padding:0; text-decoration:underline; text-underline-offset:3px; }
  .link-btn:hover { color:var(--navy-mid); }
`;

// ─────────────────────────────────────────────
// Header institucional compartilhado (auth)
// ─────────────────────────────────────────────
function AuthHeader() {
  return (
    <>
      <div className="auth-header">
        <div className="brand">
          <div className="brand-badge">GUT</div>
          <div className="brand-text">
            <div className="brand-title">Matriz GUT</div>
            <div className="brand-sub">Ferramenta de Priorização Institucional</div>
          </div>
        </div>
      </div>
      <div className="auth-gold-bar" />
    </>
  );
}

// ─────────────────────────────────────────────
// Componente Opcoes
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
// Tela de Cadastro
// ─────────────────────────────────────────────
function TelaCadastro({ onLogin, onVoltar }) {
  const [nome, setNome]             = useState("");
  const [email, setEmail]           = useState("");
  const [senha, setSenha]           = useState("");
  const [confirmar, setConfirmar]   = useState("");
  const [erro, setErro]             = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    if (!nome.trim())    { setErro("Informe seu nome completo."); return; }
    if (!email.trim())   { setErro("Informe seu e-mail."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErro("E-mail inválido."); return; }
    if (!senha)          { setErro("Informe uma senha."); return; }
    if (senha.length < 6){ setErro("Senha deve ter ao menos 6 caracteres."); return; }
    if (senha !== confirmar) { setErro("As senhas não coincidem."); return; }
    setCarregando(true);
    const { data, error } = await auth.register(nome, email, senha);
    setCarregando(false);
    if (error) { setErro(error.error === "E-mail já cadastrado" ? "Este e-mail já possui uma conta." : "Erro ao criar conta. Tente novamente."); return; }
    onLogin(data.session);
  };

  return (
    <div className="auth-page">
      <style>{STYLES}</style>
      <AuthHeader />
      <div className="auth-center">
        <div className="auth-box">
          <div className="auth-box-header">
            <div className="auth-box-title">Criar Conta</div>
            <div className="auth-box-sub">Preencha os dados para acessar a ferramenta</div>
          </div>
          <div className="auth-box-body">
            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="cad-nome">Nome Completo</label>
                <input id="cad-nome" type="text" placeholder="Seu nome completo"
                  value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="cad-email">E-mail</label>
                <input id="cad-email" type="email" placeholder="voce@instituicao.edu.br"
                  value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="cad-senha">Senha</label>
                <input id="cad-senha" type="password" placeholder="Mínimo 6 caracteres"
                  value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="field">
                <label htmlFor="cad-confirmar">Confirmar Senha</label>
                <input id="cad-confirmar" type="password" placeholder="Repita a senha"
                  value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
              </div>
              {erro && <div className="auth-error">{erro}</div>}
              <button type="submit" className="btn-primary" disabled={carregando}>
                {carregando ? "Criando conta…" : "Criar Conta"}
              </button>
            </form>
            <hr className="auth-divider" />
            <div className="auth-footer">
              Já tem uma conta?{" "}
              <button className="link-btn" onClick={onVoltar}>Entrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tela de Login
// ─────────────────────────────────────────────
function TelaLogin({ onLogin, onForgot, onCadastro }) {
  const [email, setEmail]           = useState("");
  const [senha, setSenha]           = useState("");
  const [erro, setErro]             = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    if (!email.trim()) { setErro("Informe seu e-mail."); return; }
    if (!senha)         { setErro("Informe sua senha."); return; }
    setCarregando(true);
    const { data, error } = await auth.signIn(email, senha);
    setCarregando(false);
    if (error) { setErro("E-mail ou senha incorretos."); return; }
    onLogin(data.session);
  };

  return (
    <div className="auth-page">
      <style>{STYLES}</style>
      <AuthHeader />
      <div className="auth-center">
        <div className="auth-box">
          <div className="auth-box-header">
            <div className="auth-box-title">Acesso ao Sistema</div>
            <div className="auth-box-sub">Informe suas credenciais para continuar</div>
          </div>
          <div className="auth-box-body">
            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input id="email" type="email" placeholder="voce@instituicao.edu.br"
                  value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="senha">Senha</label>
                <input id="senha" type="password" placeholder="••••••••"
                  value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
              </div>
              {erro && <div className="auth-error">{erro}</div>}
              <button type="submit" className="btn-primary" disabled={carregando}>
                {carregando ? "Acessando…" : "Acessar"}
              </button>
            </form>
            <hr className="auth-divider" />
            <div className="auth-footer" style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              <button className="link-btn" onClick={onForgot}>Esqueceu sua senha?</button>
              <span>Não tem conta?{" "}
                <button className="link-btn" onClick={onCadastro}>Criar conta</button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tela Esqueceu a Senha
// ─────────────────────────────────────────────
function TelaEsqueceuSenha({ onVoltar }) {
  const [email, setEmail]           = useState("");
  const [erro, setErro]             = useState("");
  const [enviado, setEnviado]       = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    if (!email.trim()) { setErro("Informe seu e-mail."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErro("E-mail inválido."); return; }
    setCarregando(true);
    await auth.forgotPassword(email);
    setCarregando(false);
    setEnviado(true);
  };

  return (
    <div className="auth-page">
      <style>{STYLES}</style>
      <AuthHeader />
      <div className="auth-center">
        <div className="auth-box">
          <div className="auth-box-header">
            <div className="auth-box-title">Recuperação de Acesso</div>
            <div className="auth-box-sub">
              {enviado ? "Verifique sua caixa de entrada"
                : "Informe seu e-mail para receber o link de redefinição"}
            </div>
          </div>
          <div className="auth-box-body">
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
                  <input id="forgot-email" type="email" placeholder="voce@instituicao.edu.br"
                    value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                {erro && <div className="auth-error">{erro}</div>}
                <button type="submit" className="btn-primary" disabled={carregando}>
                  {carregando ? "Enviando…" : "Enviar Link de Redefinição"}
                </button>
                <hr className="auth-divider" />
                <div className="auth-footer">
                  <button type="button" className="link-btn" onClick={onVoltar}>← Voltar ao login</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// App principal
// ─────────────────────────────────────────────
export default function App() {
  const [sessao, setSessao]     = useState(undefined);
  const [tela, setTela]         = useState("login");
  const [rows, setRows]         = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const { data: { session } } = auth.getSession();
    setSessao(session ?? null);
  }, []);

  useEffect(() => {
    if (!sessao) { setRows([]); return; }
    api.list().then(({ data }) => setRows(data ?? []));
  }, [sessao]);

  const setCampo = async (id, campo, val) => {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, [campo]: val } : r)));
    await api.update(id, { [campo]: val });
  };

  const remover = async (id) => {
    setRows((p) => p.filter((r) => r.id !== id));
    await api.remove(id);
  };

  const add = async () => {
    const { data } = await api.create({ nome: "", g: 3, u: 3, t: 3 });
    if (data) setRows((p) => [...p, data]);
  };

  const carregarPreset = async () => {
    setSalvando(true);
    const { data } = await api.replaceAll(PRESET);
    setRows(data ?? []);
    setSalvando(false);
  };

  const limpar = async () => {
    setSalvando(true);
    const { data } = await api.replaceAll([{ nome: "", g: 3, u: 3, t: 3 }]);
    setRows(data ?? []);
    setSalvando(false);
  };

  const logout = async () => {
    await auth.signOut();
    setSessao(null);
  };

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
    gut:  r.gut,
    cor:  tier(r.gut).cor,
  }));

  if (sessao === undefined)
    return <div className="loading"><style>{STYLES}</style>Carregando…</div>;

  if (!sessao) {
    if (tela === "esqueceu") return <TelaEsqueceuSenha onVoltar={() => setTela("login")} />;
    if (tela === "cadastro") return <TelaCadastro onLogin={setSessao} onVoltar={() => setTela("login")} />;
    return <TelaLogin onLogin={setSessao} onForgot={() => setTela("esqueceu")} onCadastro={() => setTela("cadastro")} />;
  }

  return (
    <div>
      <style>{STYLES}</style>

      {/* Top utility bar */}
      <div className="top-bar">
        <button onClick={logout}>Sair</button>
        <span className="sep">|</span>
        <span style={{ color:"rgba(255,255,255,.6)", fontSize:11.5 }}>{sessao.user.email}</span>
      </div>

      {/* Header */}
      <div className="site-header">
        <div className="brand">
          <div className="brand-badge">GUT</div>
          <div className="brand-text">
            <div className="brand-title">Matriz GUT</div>
            <div className="brand-sub">Ferramenta de Priorização Institucional</div>
          </div>
        </div>
        <div className="header-user">
          Olá, <strong>{sessao.user.nome || sessao.user.email.split("@")[0]}</strong>
        </div>
      </div>

      {/* Gold bar */}
      <div style={{ height:4, background:"var(--gold)" }} />

      {/* Main nav */}
      <nav className="main-nav">
        <button className="active">Início</button>
        <button>Problemas</button>
        <button>Ranking</button>
        <button onClick={carregarPreset} disabled={salvando}>Carregar Exemplo</button>
        <button onClick={limpar} disabled={salvando}>Limpar</button>
      </nav>

      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span>Inicial</span> / <span>Priorização</span> / <b>Matriz GUT</b>
      </div>

      {/* Page body */}
      <div className="page-body">

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="sl-abbr">GUT</div>
            <div className="sl-name">Gravidade · Urgência · Tendência</div>
          </div>
          <div className="sidebar-nav">
            <div className="sidebar-nav-title">Navegação</div>
            <button className="active">Problemas</button>
            <button>Ranking</button>
            <button>Sobre a Matriz</button>
          </div>

          <div className="sidebar-legenda">
            <div className="sidebar-legenda-title">Classificação</div>
            {[
              { cor:"#8b1a1a", label:"Crítica", faixa:"≥ 100" },
              { cor:"#b85c00", label:"Alta",    faixa:"50 – 99" },
              { cor:"#8a6800", label:"Média",   faixa:"20 – 49" },
              { cor:"#2d6a45", label:"Baixa",   faixa:"< 20" },
            ].map(({ cor, label, faixa }) => (
              <div key={label} className="leg-item">
                <span className="leg-dot" style={{ background: cor }} />
                <span><strong>{label}</strong> ({faixa})</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="main-content">

          {/* Page title */}
          <div className="page-title-bar">
            <div>
              <div className="page-title">Matriz GUT — Priorização de Problemas</div>
              <div className="page-desc">
                Avalie cada problema em <b>Gravidade</b>, <b>Urgência</b> e <b>Tendência</b>.
                A pontuação <b>GUT = G × U × T</b> define a ordem de ação.
              </div>
            </div>
            <button className="btn-action" onClick={add}>+ Adicionar Problema</button>
          </div>

          {/* Insight */}
          {top && (
            <div className="insight">
              Prioridade nº 1: <b>{top.nome}</b> — GUT {top.gut} ({tier(top.gut).rotulo.toLowerCase()}).
              Inicie as ações por este item.
            </div>
          )}

          {/* Problem cards */}
          {rows.map((r) => {
            const gut = r.g * r.u * r.t;
            const t   = tier(gut);
            const rk  = ranking.rankMap[r.id];
            return (
              <div className="pcard" key={r.id}>
                <div className="pcard-header">
                  {rk
                    ? <span className="rank-badge" style={{ background: t.cor }}>{rk}</span>
                    : <span className="rank-badge" style={{ background:"var(--muted)" }}>–</span>}
                  <input className="nome" value={r.nome} placeholder="Descreva o problema"
                    aria-label="Nome do problema"
                    onChange={(e) => setCampo(r.id, "nome", e.target.value)} />
                  <div className="gut-result">
                    <span className="gut-lbl">GUT</span>
                    <span className="gut-val" style={{ color: t.cor }}>{gut}</span>
                    <span className="tier-badge" style={{ background: t.cor }}>{t.rotulo}</span>
                  </div>
                  <button className="del" onClick={() => remover(r.id)} aria-label="Remover">×</button>
                </div>
                <div className="dims">
                  <Opcoes r={r} campo="g" setCampo={setCampo} />
                  <Opcoes r={r} campo="u" setCampo={setCampo} />
                  <Opcoes r={r} campo="t" setCampo={setCampo} />
                </div>
              </div>
            );
          })}

          <button className="add-btn" onClick={add}>+ Adicionar Problema</button>

          {/* Chart */}
          {chart.length > 0 && (
            <div className="chart-card">
              <h2>Ranking de Prioridade</h2>
              <div style={{ width:"100%", height: Math.max(160, chart.length * 40) }}>
                <ResponsiveContainer>
                  <BarChart data={chart} layout="vertical" margin={{ left:8, right:36, top:4, bottom:4 }}>
                    <XAxis type="number" hide domain={[0, 125]} />
                    <YAxis type="category" dataKey="nome" width={155}
                      tick={{ fontSize:11.5, fill:"#6b7898" }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill:"#00000006" }}
                      contentStyle={{ borderRadius:4, border:"1px solid var(--line)", fontSize:12 }}
                      formatter={(v) => [v, "GUT"]} />
                    <Bar dataKey="gut" radius={[0, 4, 4, 0]} barSize={20}
                      label={{ position:"right", fontSize:11, fill:"#6b7898" }}>
                      {chart.map((c, i) => <Cell key={`${c.nome}-${i}`} fill={c.cor} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
