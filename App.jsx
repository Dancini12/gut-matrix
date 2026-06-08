import React, { useState, useMemo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  if (v >= 100) return { rotulo: "Crítica", cor: "#b3261e" };
  if (v >= 50)  return { rotulo: "Alta",    cor: "#d9772b" };
  if (v >= 20)  return { rotulo: "Média",   cor: "#c6a015" };
  return               { rotulo: "Baixa",   cor: "#4f8a5b" };
};

let UID = 100;
const nova = (d = { nome: "", g: 3, u: 3, t: 3 }) => ({ id: ++UID, ...d });

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=DM+Sans:wght@400;500;600&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  :root { --ink:#1c1a17; --paper:#f6f2ea; --card:#fffdf8; --line:#e3dccd; --muted:#a89e8c; --accent:#c4521e; }

  .wrap { background:var(--paper); color:var(--ink); min-height:100vh; font-family:'DM Sans',system-ui,sans-serif;
    padding:28px; display:flex; flex-direction:column; }

  /* App header */
  .head { margin-bottom:18px; border-bottom:1px solid var(--line); padding-bottom:16px; }
  .kicker { font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:var(--accent); font-weight:600; }
  h1 { font-family:'Fraunces',serif; font-weight:600; font-size:30px; margin:6px 0 4px; letter-spacing:-.01em; }
  .sub { color:var(--muted); font-size:14px; max-width:64ch; }
  .sub b { color:var(--ink); }

  /* Tabs */
  .tabs { display:flex; gap:4px; margin-bottom:20px; border-bottom:2px solid var(--line); padding-bottom:0; }
  .tab { background:none; border:none; font-family:inherit; font-size:14px; font-weight:500; color:var(--muted);
    cursor:pointer; padding:10px 16px; border-bottom:2px solid transparent; margin-bottom:-2px; transition:.12s; }
  .tab:hover { color:var(--ink); }
  .tab.active { color:var(--accent); border-bottom-color:var(--accent); font-weight:600; }

  /* Como funciona */
  .info-wrap { max-width:760px; }
  .info-section { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:22px 24px; margin-bottom:16px; }
  .info-section h2 { font-family:'Fraunces',serif; font-size:18px; font-weight:600; margin-bottom:10px; }
  .info-section p { font-size:14px; line-height:1.7; color:#3d3a35; margin-bottom:10px; }
  .info-section p:last-child { margin-bottom:0; }
  .formula-box { background:linear-gradient(135deg,#fff6ef,#fbeee6); border:1px solid #e8a07f;
    border-radius:12px; padding:18px 20px; text-align:center; margin:14px 0; }
  .formula { font-family:'Fraunces',serif; font-size:28px; font-weight:600; color:var(--accent); letter-spacing:.04em; }
  .formula-sub { font-size:12.5px; color:var(--muted); margin-top:4px; }
  .dim-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:12px; }
  @media(max-width:600px){ .dim-cards{ grid-template-columns:1fr; } }
  .dim-card { background:#fffdf8; border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .dim-card-title { font-family:'Fraunces',serif; font-size:15px; font-weight:600; margin-bottom:4px; display:flex; align-items:center; gap:8px; }
  .dim-card-letter { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px;
    border-radius:8px; background:var(--accent); color:#fff; font-weight:700; font-size:14px; flex-shrink:0; }
  .dim-card p { font-size:13px; color:var(--muted); line-height:1.5; margin-top:6px; }
  .scale-table { width:100%; border-collapse:collapse; font-size:13px; margin-top:12px; }
  .scale-table th { background:#f0ebe0; padding:9px 12px; text-align:left; font-weight:600; font-size:12px; letter-spacing:.03em; }
  .scale-table td { padding:9px 12px; border-top:1px solid var(--line); }
  .scale-table tr:hover td { background:#faf6ee; }
  .tier-badge { font-size:11px; font-weight:600; color:#fff; padding:2px 8px; border-radius:999px; }
  .step-list { list-style:none; counter-reset:step; margin-top:10px; }
  .step-list li { counter-increment:step; display:flex; gap:12px; align-items:flex-start;
    margin-bottom:12px; font-size:14px; line-height:1.6; }
  .step-list li::before { content:counter(step); display:flex; align-items:center; justify-content:center;
    min-width:26px; height:26px; border-radius:50%; background:var(--accent); color:#fff;
    font-weight:700; font-size:12px; flex-shrink:0; margin-top:1px; }

  /* Insight */
  .insight { background:linear-gradient(180deg,#fff6ef,#fffdf8); border:1px solid #e8a07f; border-radius:12px;
    padding:14px 16px; margin-bottom:16px; font-size:14.5px; line-height:1.5; }
  .insight b { color:var(--accent); }

  /* Toolbar */
  .toolbar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; align-items:center; }
  .chip { font-size:12.5px; font-weight:500; padding:7px 13px; border-radius:999px;
    border:1px solid var(--line); background:transparent; cursor:pointer; color:var(--ink); }
  .chip:hover { border-color:var(--accent); color:var(--accent); }
  .chip.pdf { background:var(--accent); color:#fff; border-color:var(--accent); }
  .chip.pdf:hover { background:#a8421a; border-color:#a8421a; color:#fff; }
  .legenda { display:flex; gap:16px; flex-wrap:wrap; font-size:12.5px; color:var(--muted); margin-left:auto; }
  .legenda span { display:flex; align-items:center; gap:6px; }
  .ldot { width:11px; height:11px; border-radius:3px; display:inline-block; }

  /* Problem card */
  .pcard { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; margin-bottom:14px; }
  .pcard-top { display:flex; align-items:center; gap:11px; flex-wrap:wrap; }
  .rank { width:30px; height:30px; border-radius:50%; display:inline-flex; align-items:center;
    justify-content:center; font-weight:700; font-size:13px; color:#fff; flex-shrink:0; }
  input.nome { flex:1; min-width:180px; border:1px solid var(--line); background:#fff; border-radius:8px;
    padding:9px 11px; font-family:inherit; font-size:14.5px; color:var(--ink); }
  input.nome:focus { outline:none; border-color:var(--accent); }
  .result { display:flex; align-items:center; gap:10px; }
  .result .lbl { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
  .gut   { font-family:'Fraunces',serif; font-weight:600; font-size:24px; line-height:1; }
  .badge { font-size:11px; font-weight:600; color:#fff; padding:3px 9px; border-radius:999px; }
  .del   { border:none; background:none; color:var(--muted); cursor:pointer; font-size:20px;
    padding:2px 6px; border-radius:6px; }
  .del:hover { color:var(--accent); background:#f3ebe2; }

  /* Dimensions */
  .dims { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:15px; }
  @media (max-width:760px){ .dims{ grid-template-columns:1fr; } }
  .dim-head { font-family:'Fraunces',serif; font-size:13.5px; font-weight:600; }
  .dim-q  { font-size:11px; color:var(--muted); margin:1px 0 8px; }
  .opts   { display:flex; flex-direction:column; gap:6px; }
  .opt    { display:flex; align-items:center; gap:9px; width:100%; text-align:left; border:1px solid var(--line);
    background:#fff; border-radius:9px; padding:8px 10px; font-family:inherit; font-size:12.5px;
    color:var(--ink); cursor:pointer; transition:.12s; }
  .opt:hover { border-color:#d8b9a6; }
  .opt.on { border-color:var(--accent); background:#fbeee6; font-weight:600; }
  .opt .n { width:21px; height:21px; border-radius:6px; background:#efe7d8; color:#5c5346;
    font-weight:700; font-size:11.5px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .opt.on .n { background:var(--accent); color:#fff; }

  /* Add / Chart */
  .add  { width:100%; padding:11px; border:1px dashed var(--line); background:transparent; border-radius:11px;
    font-family:inherit; font-size:13.5px; font-weight:500; color:var(--muted); cursor:pointer; margin-bottom:18px; }
  .add:hover { border-color:var(--accent); color:var(--accent); }
  .card   { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; margin-bottom:16px; }
  .card h2 { font-family:'Fraunces',serif; font-size:16px; font-weight:600; margin:0 0 12px; }

  /* Footer */
  .footer { margin-top:auto; padding-top:24px; border-top:1px solid var(--line);
    font-size:12px; color:var(--muted); display:flex; align-items:center; justify-content:center;
    gap:6px; flex-wrap:wrap; text-align:center; line-height:1.6; }
  .footer strong { color:var(--ink); }
`;

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
// Tela Como Funciona
// ─────────────────────────────────────────────
function TelaComoFunciona() {
  return (
    <div className="info-wrap">
      <div className="info-section">
        <h2>O que é a Matriz GUT?</h2>
        <p>
          A Matriz GUT é uma ferramenta de priorização criada por Charles Kepner e Benjamin Tregoe
          na década de 1950. Ela ajuda equipes e gestores a decidir <strong>por onde começar</strong> quando
          existem vários problemas a resolver ao mesmo tempo.
        </p>
        <p>
          Cada problema recebe uma pontuação em três dimensões — <strong>Gravidade</strong>,{" "}
          <strong>Urgência</strong> e <strong>Tendência</strong> — e a multiplicação dessas três
          notas gera um índice GUT. Quanto maior o índice, maior a prioridade de ação.
        </p>
        <div className="formula-box">
          <div className="formula">GUT = G × U × T</div>
          <div className="formula-sub">Valor mínimo: 1 &nbsp;·&nbsp; Valor máximo: 125</div>
        </div>
      </div>

      <div className="info-section">
        <h2>As três dimensões</h2>
        <div className="dim-cards">
          <div className="dim-card">
            <div className="dim-card-title">
              <span className="dim-card-letter">G</span>Gravidade
            </div>
            <p>
              Qual o impacto real do problema nos resultados, nas pessoas ou nos processos
              se ele não for resolvido? Avalia o prejuízo potencial.
            </p>
          </div>
          <div className="dim-card">
            <div className="dim-card-title">
              <span className="dim-card-letter">U</span>Urgência
            </div>
            <p>
              Em quanto tempo é necessário agir? Considera o prazo disponível para tomar
              uma decisão antes que o problema se agrave ainda mais.
            </p>
          </div>
          <div className="dim-card">
            <div className="dim-card-title">
              <span className="dim-card-letter">T</span>Tendência
            </div>
            <p>
              Como o problema se comporta ao longo do tempo se nada for feito? Verifica
              se ele irá crescer, estabilizar ou desaparecer sozinho.
            </p>
          </div>
        </div>
      </div>

      <div className="info-section">
        <h2>Escala de pontuação (1 a 5)</h2>
        <table className="scale-table">
          <thead>
            <tr>
              <th>Nota</th>
              <th>Gravidade</th>
              <th>Urgência</th>
              <th>Tendência</th>
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((n) => (
              <tr key={n}>
                <td><strong>{n}</strong></td>
                <td>{ESCALA.g.niveis[n]}</td>
                <td>{ESCALA.u.niveis[n]}</td>
                <td>{ESCALA.t.niveis[n]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="info-section">
        <h2>Interpretação do resultado</h2>
        <table className="scale-table">
          <thead>
            <tr><th>Pontuação GUT</th><th>Classificação</th><th>O que fazer</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>100 a 125</td>
              <td><span className="tier-badge" style={{ background: "#b3261e" }}>Crítica</span></td>
              <td>Ação imediata — mobilize recursos agora.</td>
            </tr>
            <tr>
              <td>50 a 99</td>
              <td><span className="tier-badge" style={{ background: "#d9772b" }}>Alta</span></td>
              <td>Planeje e execute em curto prazo.</td>
            </tr>
            <tr>
              <td>20 a 49</td>
              <td><span className="tier-badge" style={{ background: "#c6a015" }}>Média</span></td>
              <td>Monitore e agende para médio prazo.</td>
            </tr>
            <tr>
              <td>1 a 19</td>
              <td><span className="tier-badge" style={{ background: "#4f8a5b" }}>Baixa</span></td>
              <td>Pode aguardar — baixo impacto imediato.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="info-section">
        <h2>Como preencher</h2>
        <ol className="step-list">
          <li>Acesse a aba <strong>Ferramenta</strong> no menu acima.</li>
          <li>Clique em <strong>+ adicionar problema</strong> e escreva o nome de cada problema a ser avaliado.</li>
          <li>Para cada problema, selecione a pontuação de <strong>Gravidade</strong>, <strong>Urgência</strong> e <strong>Tendência</strong> clicando nas opções exibidas.</li>
          <li>O valor GUT é calculado automaticamente e os problemas são ordenados do mais crítico ao menos crítico.</li>
          <li>Ao terminar, clique em <strong>Gerar PDF</strong> para exportar o relatório com o ranking de prioridade.</li>
        </ol>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Geração de PDF
// ─────────────────────────────────────────────
function gerarPDF(ranking) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(196, 82, 30);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Matriz GUT — Relatório de Priorização", 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 20);

  doc.setTextColor(28, 26, 23);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Classificação:", 14, 36);
  doc.setFont("helvetica", "normal");
  const legs = [
    { label: "Crítica (≥100)", r: 179, g: 38,  b: 30 },
    { label: "Alta (50–99)",   r: 217, g: 119, b: 43 },
    { label: "Média (20–49)",  r: 198, g: 160, b: 21 },
    { label: "Baixa (<20)",    r: 79,  g: 138, b: 91 },
  ];
  let lx = 42;
  legs.forEach(({ label, r, g, b }) => {
    doc.setFillColor(r, g, b);
    doc.roundedRect(lx, 32, 3, 3, 0.5, 0.5, "F");
    doc.setTextColor(28, 26, 23);
    doc.text(label, lx + 5, 35.5);
    lx += label.length * 1.9 + 10;
  });

  const rows = ranking.map((r, i) => [
    i + 1,
    r.nome,
    r.g, ESCALA.g.niveis[r.g],
    r.u, ESCALA.u.niveis[r.u],
    r.t, ESCALA.t.niveis[r.t],
    r.gut,
    tier(r.gut).rotulo,
  ]);

  autoTable(doc, {
    startY: 42,
    head: [["#", "Problema", "G", "Gravidade", "U", "Urgência", "T", "Tendência", "GUT", "Nível"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2.5, font: "helvetica" },
    headStyles: { fillColor: [240, 235, 224], textColor: [28, 26, 23], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 8,  halign: "center" },
      2: { cellWidth: 9,  halign: "center" },
      4: { cellWidth: 9,  halign: "center" },
      6: { cellWidth: 9,  halign: "center" },
      8: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      9: { cellWidth: 18, halign: "center" },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 9) {
        const row = ranking[data.row.index];
        if (!row) return;
        const t = tier(row.gut);
        const [rv, gv, bv] = t.cor.match(/\w\w/g).map((h) => parseInt(h, 16));
        doc.setFillColor(rv, gv, bv);
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        doc.roundedRect(cx - 9, cy - 3, 18, 6, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(t.rotulo, cx, cy + 0.8, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(28, 26, 23);
      }
    },
    alternateRowStyles: { fillColor: [250, 246, 238] },
    margin: { left: 14, right: 14 },
  });

  const finalY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setTextColor(168, 158, 140);
  doc.text("Desenvolvido por Marcel Dancini · IA: Claude (Anthropic)", 14, finalY);
  doc.text("Página 1", pageW - 14, finalY, { align: "right" });

  doc.save(`matriz-gut-${Date.now()}.pdf`);
}

// ─────────────────────────────────────────────
// App principal
// ─────────────────────────────────────────────
export default function App() {
  const [aba, setAba]   = useState("ferramenta");
  const [rows, setRows] = useState(PRESET.map((d) => nova(d)));

  const setCampo = (id, campo, val) =>
    setRows((p) => p.map((r) => (r.id === id ? { ...r, [campo]: val } : r)));

  const remover = (id) => setRows((p) => p.filter((r) => r.id !== id));

  const add = () => setRows((p) => [...p, nova()]);

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

  return (
    <div className="wrap">
      <style>{STYLES}</style>

      <div className="head">
        <div className="kicker">Ferramenta de Priorização</div>
        <h1>Matriz GUT</h1>
        <p className="sub">
          Para cada problema, toque em <b>Gravidade</b>, <b>Urgência</b> e <b>Tendência</b>.
          Prioridade: <b>GUT = G × U × T</b> — quanto maior, mais urgente.
        </p>
      </div>

      <div className="tabs">
        <button className={`tab ${aba === "ferramenta" ? "active" : ""}`} onClick={() => setAba("ferramenta")}>
          Ferramenta
        </button>
        <button className={`tab ${aba === "como-funciona" ? "active" : ""}`} onClick={() => setAba("como-funciona")}>
          Como funciona
        </button>
      </div>

      {aba === "como-funciona" && <TelaComoFunciona />}

      {aba === "ferramenta" && (
        <>
          {top && (
            <div className="insight">
              Prioridade nº 1: <b>{top.nome}</b> — GUT {top.gut} ({tier(top.gut).rotulo.toLowerCase()}). Comece por aqui.
            </div>
          )}

          <div className="toolbar">
            <button className="chip" onClick={() => setRows(PRESET.map((d) => nova(d)))}>Exemplo</button>
            <button className="chip" onClick={() => setRows([nova()])}>Limpar</button>
            {ranking.ordenado.length > 0 && (
              <button className="chip pdf" onClick={() => gerarPDF(ranking.ordenado)}>
                Gerar PDF
              </button>
            )}
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
        </>
      )}

      <footer className="footer">
        Desenvolvido por <strong>Marcel Dancini</strong> &nbsp;·&nbsp; IA utilizada: <strong>Claude (Anthropic)</strong>
      </footer>
    </div>
  );
}
