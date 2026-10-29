// ---------- TRANSCRIÇÃO POR VOZ ----------
// Usa o reconhecimento de fala do próprio navegador (Chrome no Android, Safari no iPhone). Precisa de internet.
const SRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let dit = null;
const juntarTexto = (a, b) => { a = a || ''; b = (b || '').trim(); if (!b) return a; return a + (a && !/\s$/.test(a) ? ' ' : '') + b; };
const micBtn = alvo => `<button type="button" class="btn sm mic" data-act="ditar" data-alvo="${alvo}">${ICON.mic}<span>Falar</span></button>`;
function marcaBotao(btn, on){
  if (!btn) return; btn.classList.toggle('on', on);
  const s = btn.querySelector('span'); if (s) s.textContent = on ? 'Ouvindo… toque para parar' : 'Falar';
}
function pararDitado(){
  if (!dit) return; const d = dit; dit = null;
  try { d.rec.abort(); } catch(e){}
  marcaBotao(d.btn, false);
}
// opts.onFalha(msg): em vez de mostrar aviso, avisa quem chamou (usado na gravação de áudio)
function ditar(alvo, btn, opts = {}){
  if (dit){ const mesmo = dit.alvo === alvo && !opts.junto; pararDitado(); if (mesmo) return false; }
  const falha = m => { if (opts.onFalha) opts.onFalha(m); else toast(m); };
  if (!SRec){ falha('Este navegador não transcreve. Toque no campo de texto e use o microfone do teclado do celular.'); return false; }
  const el = document.getElementById(alvo); if (!el) return false;
  const st = { alvo, btn, base: el.value, rec: null, erro: null, mudo: 0 };
  const nova = () => {
    const rec = new SRec(); rec.lang = 'pt-BR'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = e => {
      let txt = ''; for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      const alvoEl = document.getElementById(alvo); if (!alvoEl) return pararDitado();
      st.mudo = 0; alvoEl.value = juntarTexto(st.base, txt); alvoEl.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = e => { st.erro = e.error; };
    rec.onend = () => {
      if (dit !== st) return;
      const alvoEl = document.getElementById(alvo); if (!alvoEl) return pararDitado();
      st.base = alvoEl.value;
      const er = st.erro; st.erro = null;
      if (er === 'not-allowed' || er === 'service-not-allowed'){ pararDitado(); return falha('A transcrição foi bloqueada. Libere o microfone para este app nas configurações do celular.'); }
      if (er === 'audio-capture'){ pararDitado(); return falha('O microfone está ocupado e a transcrição não ligou.'); }
      if (er === 'network'){ pararDitado(); return falha('A transcrição precisa de internet.'); }
      if (er === 'no-speech' && ++st.mudo >= 4){ pararDitado(); return opts.onFalha ? null : toast('Parei de ouvir porque ninguém falou.'); }
      try { st.rec = nova(); st.rec.start(); } catch(err){ pararDitado(); }
    };
    return rec;
  };
  dit = st; st.rec = nova();
  try { st.rec.start(); } catch(err){ dit = null; falha('Não consegui ligar a transcrição.'); return false; }
  marcaBotao(btn, true);
  return true;
}

// ---------- AVALIAÇÃO ----------
// Guardada na coleção "evolucoes" com tipo "avaliacao": assim vale a mesma regra de acesso
// (a Camila só vê e altera as avaliações em que ela é a fisioterapeuta).
const AV_SITUACAO = [['agudo','Agudo'],['cronico','Crônico'],['na','Não se aplica']];
const AV_FICHAS = { cardio: { nome: 'Cardiorrespiratória', grupos: null }, geral: { nome: 'Geral', grupos: ['extra'] }, sono: { nome: 'Sono', grupos: ['extra'] } };
const AV_EVOL = [['neurocentral','Progressivo neurocentral'],['neuroperiferico','Progressivo neuroperiférico'],['naoprog','Não progressivo']];
const AV_RESP = [['espontanea','Espontânea'],['assistida','Assistida']];
const AV_COMORB = [['neuro','Neurológica'],['resp','Respiratória'],['cardio','Cardiovascular']];
// [código, nome, unidade, tem valor predito?, 'txt' quando o resultado é descritivo]
const AV_GRUPOS = [
  { g: 'mob', t: 'Mobilidade e queda', itens: [['tug','TUG','s',1],['vmarcha','Velocidade de marcha','m/s',1],['sppb','SPPB','pontos',0],['tls5','TLS5rep','s',1],['tls30','TLS30s','repetições',1],['fssicu','FSS-ICU','pontos',0],['ims','IMS','pontos',0]] },
  { g: 'forca', t: 'Força', itens: [['rm1','1RM','kg',1],['preensao','Força de preensão palmar (FPP)','kgf',1],['dina','Dinamometria','kgf',1],['dinaq','Dinamometria de quadríceps','kgf',1],['mrc','MRC','pontos',0]] },
  { g: 'pulm', t: 'Função pulmonar', itens: [['cvf','CVF','L',1],['vef1','VEF1','L',1],['pfe','PFE','L/min',1],['pft','Pico de fluxo de tosse','L/min',1],['pimax','PiMax','cmH2O',1],['snip','SNIP','cmH2O',0],['pemax','PeMax','cmH2O',1],['sindex','S-Index','cmH2O',1],['endur','Endurance respiratório','',1]] },
  { g: 'cardio', t: 'Aptidão cardiorrespiratória', itens: [['tc6','TC6','m',1],['td6','TD6','',1],['iswt','ISWT','m',1],['chester','Chester Step','',1],['tls1','TLS 1 min','repetições',1],['tc2','TC2','',1],['risco','Estratificação de risco','',0,'txt']] },
  { g: 'vfc', t: 'VFC', itens: [['vfc','Variabilidade da frequência cardíaca','',0,'txt']] },
  { g: 'us', t: 'Ultrassom', itens: [['uspl','Pleuropulmonar','',0,'txt'],['usdia','Diafragmático','',0,'txt'],['usme','Musculoesquelético','',0,'txt'],['lus','Escore de ultrassom pulmonar (LUS)','pontos',0]] },
  { g: 'func', t: 'Funcionalidade', itens: [['barthel','Índice de Barthel','pontos',0],['mif','MIF','pontos',0],['fss','FSS','pontos',0]] },
  { g: 'sono', t: 'Sono', itens: [['ess','Escala de sonolência de Epworth','pontos',0],['stopbang','STOP-Bang','pontos',0],['psqi','PSQI','pontos',0],['berlim','Questionário de Berlim','',0,'txt'],['mallampati','Mallampati','',0,'txt'],['polisso','Polissonografia','',0,'txt'],['pap','Terapia com PAP','',0,'txt']] },
  { g: 'esc', t: 'Escalas', itens: [['sf36','SF-36','pontos',0],['whoqol','WHOQOL-BREF','pontos',0],['cat','CAT','pontos',0],['act','ACT','pontos',0],['alsfrs','ALSFRS-R','pontos',0]] },
  { g: 'extra', t: 'Testes extras', itens: [['x1','Teste extra 1','',1,'extra'],['x2','Teste extra 2','',1,'extra'],['x3','Teste extra 3','',1,'extra'],['x4','Teste extra 4','',1,'extra']] }
];
const AV_ANAM = [['diag','Diagnósticos clínicos'],['queixa','Queixa principal'],['hda','HDA (história da doença atual)'],['hdp','HDP (história da doença pregressa)'],['antfam','Antecedentes familiares']];
const AV_ANAM2 = [['farmacos','Fármacos em uso'],['equipe','Equipe assistencial'],['examefis','Exame físico']];
const AV_VITAIS = [['fc','FC','bpm'],['fr','FR','irpm'],['pa','PA','mmHg','text'],['spo2','SpO2','%'],['temp','Temperatura','°C']];
const AV_OBRIG = [['pnome','Paciente'],['quando','Data e hora'],['fisio','Fisioterapeuta'],['situacao','Situação'],['sexo','Sexo'],['ficha','Ficha'],['altura','Altura'],['massa','Massa']];

// a Camila não carrega a lista de pacientes; para ela, a busca usa os pacientes da agenda dela
function avPacientes(){
  const m = new Map();
  if (restrito()) Object.values(S.agenda).forEach(a => { if (a.tipo !== 'outro' && a.pnome && !m.has(a.pnome)) m.set(a.pnome, { nome: a.pnome, pid: a.pid || '' }); });
  else Object.values(S.pacientes).filter(p => p.status !== 'inativo').forEach(p => m.set(p.nome, { nome: p.nome, pid: p._id }));
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}
let avT = null, avLista = null, avAtual = null, avCarregando = false;
const num = s => { const n = Number(String(s ?? '').replace(',', '.')); return s === '' || s == null || !isFinite(n) ? null : n; };
const fmtNum = (n, c = 1) => n == null ? '' : n.toLocaleString('pt-BR', { maximumFractionDigits: c });
const rotulo = (L, k) => (L.find(x => x[0] === k) || [k, k])[1];

// ----- cálculos automáticos -----
// Só entram equações e pontos de corte com fonte conhecida. A fonte aparece na tela e no PDF.
// Quando a idade está fora da faixa estudada, o valor sai com aviso de extrapolação.
const AV_SEXO = [['F','Feminino'],['M','Masculino']];
function avIdade(v){
  if (!v.nasc) return null; const ref = (v.quando || today()).slice(0, 10);
  const [a, m, d] = v.nasc.split('-').map(Number), [A, M, D] = ref.split('-').map(Number);
  let i = A - a; if (M < m || (M === m && D < d)) i--; return i >= 0 && i < 130 ? i : null;
}
const avCtx = v => ({ sexo: v.sexo || '', idade: avIdade(v), alt: num(v.altura), peso: num(v.massa) });
const AV_PRECISA = { sexo: 'sexo', idade: 'data de nascimento', alt: 'altura', peso: 'massa' };
// equações de valor predito
const AV_REF = {
  // Neder et al., 1999 (Braz J Med Biol Res 32:719-27), 100 adultos de 20 a 80 anos. Equações e erro-padrão (EPE) da figura 1.
  // Limite inferior = predito − 1,645 × EPE (5º percentil; cálculo do app, o artigo não traz esse limite).
  // O valor da PiMax é usado sem sinal (o manovacuômetro pode mostrar −40; a conta usa 40).
  pimax: { fonte: 'Neder et al., 1999', faixa: [20, 80], usa: ['sexo', 'idade'], abs: 1, pred: c => c.sexo === 'F' ? 110.4 - 0.49 * c.idade : 155.3 - 0.80 * c.idade,
    lin: (c, p) => p - 1.645 * (c.sexo === 'F' ? 9.1 : 17.3), linNota: 'predito − 1,645 × erro-padrão da equação' },
  pemax: { fonte: 'Neder et al., 1999', faixa: [20, 80], usa: ['sexo', 'idade'], abs: 1, pred: c => c.sexo === 'F' ? 115.6 - 0.61 * c.idade : 165.3 - 0.81 * c.idade,
    lin: (c, p) => p - 1.645 * (c.sexo === 'F' ? 11.2 : 15.6), linNota: 'predito − 1,645 × erro-padrão da equação' },
  tc6: { fonte: 'Enright & Sherrill, 1998', faixa: [40, 80], usa: ['sexo', 'idade', 'alt', 'peso'],
    pred: c => c.sexo === 'F' ? 2.11 * c.alt - 2.29 * c.peso - 5.78 * c.idade + 667 : 7.57 * c.alt - 5.02 * c.idade - 1.76 * c.peso - 309,
    lin: (c, p) => p - (c.sexo === 'F' ? 139 : 153) },
  tls5: { fonte: 'Bohannon, 2006 (média da faixa etária)', faixa: [60, 89], usa: ['idade'], menorMelhor: 1, pred: c => c.idade < 70 ? 11.4 : c.idade < 80 ? 12.6 : 14.8 }
};
// pontos de corte: [a partir de, rótulo, 'gt' = só acima do valor]
const AV_CLS = {
  sppb: { fonte: 'Guralnik et al., 1994', min: 0, max: 12, cortes: [[0, 'Muito baixo'], [4, 'Baixo'], [7, 'Moderado'], [10, 'Bom']] },
  mrc: { fonte: 'De Jonghe et al., 2002; Hermans et al., 2012', min: 0, max: 60, cortes: [[0, 'Fraqueza grave'], [36, 'Fraqueza'], [48, 'Sem fraqueza']] },
  pft: { fonte: 'Bach, 1996', min: 0, max: 600, cortes: [[0, 'Tosse ineficaz'], [160, 'Risco nas infecções'], [270, 'Adequada']] },
  cat: { fonte: 'Jones et al., 2009', min: 0, max: 40, cortes: [[0, 'Impacto baixo'], [10, 'Médio'], [21, 'Alto'], [31, 'Muito alto']] },
  ess: { fonte: 'Johns, 1991', min: 0, max: 24, cortes: [[0, 'Normal'], [10, 'Sonolência excessiva', 'gt']] },
  stopbang: { fonte: 'Chung et al., 2012', min: 0, max: 8, cortes: [[0, 'Risco baixo'], [3, 'Risco intermediário'], [5, 'Risco alto']] },
  psqi: { fonte: 'Buysse et al., 1989', min: 0, max: 21, cortes: [[0, 'Boa qualidade do sono'], [5, 'Má qualidade do sono', 'gt']] },
  act: { fonte: 'Nathan et al., 2004', min: 5, max: 25, cortes: [[5, 'Não controlada'], [20, 'Controlada']] }
};
function imcRef(idade){
  return idade != null && idade >= 60
    ? { fonte: 'Lipschitz, 1994 (60 anos ou mais)', min: 14, max: 40, cortes: [[0, 'Baixo peso'], [22, 'Eutrofia'], [27, 'Sobrepeso', 'gt']] }
    : { fonte: 'OMS (adultos)', min: 14, max: 40, cortes: [[0, 'Baixo peso'], [18.5, 'Eutrofia'], [25, 'Sobrepeso'], [30, 'Obesidade']] };
}
// Força de preensão palmar: equações de Novaes et al., 2009 (Fisioterapia e Pesquisa 16(3):217-22),
// brasileiros com 50 anos ou mais, dinamômetro, maior de 3 tentativas. Sexo: 1 homem, 0 mulher.
// Mão dominante: 39,996 − 0,382×idade + 0,174×peso + 13,628×sexo
// Mão não dominante: 44,968 − 0,420×idade + 0,110×peso + 9,274×sexo
// Força reduzida pelo EWGSOP2 (Cruz-Jentoft et al., 2019): abaixo de 27 kgf (homens) e 16 kgf (mulheres), no maior valor.
function avPreensao(v, c){
  const M = avMaos(v), t = {}; if (!M.lista.length) return t;
  const falta = []; if (!c.sexo) falta.push('sexo'); if (c.idade == null) falta.push('data de nascimento'); if (c.peso == null) falta.push('massa');
  if (!v.t_preensao_dom) falta.push('mão dominante');
  if (falta.length) t.falta = falta;
  else {
    const s = c.sexo === 'M' ? 1 : 0;
    const pD = 39.996 - 0.382 * c.idade + 0.174 * c.peso + 13.628 * s, pND = 44.968 - 0.420 * c.idade + 0.110 * c.peso + 9.274 * s;
    t.maos = M.lista.map(([l, val]) => { const dom = (l === 'direita' ? 'dir' : 'esq') === v.t_preensao_dom, pred = dom ? pD : pND; return { l, val, dom, pred, pct: pred > 0 ? val / pred * 100 : null }; });
    const principal = t.maos.find(m => m.dom) || t.maos[0];
    t.pred = principal.pred; t.maoPct = principal.l; t.fonte = 'Novaes et al., 2009';
    if (c.idade < 50) t.aviso = 'equação feita com pessoas de 50 anos ou mais: valor extrapolado';
  }
  if (c.sexo){ const mx = Math.max(...M.lista.map(x => x[1])), corte = c.sexo === 'M' ? 27 : 16;
    t.cls = mx < corte ? `Força reduzida (maior valor abaixo de ${corte} kgf)` : `Força adequada (maior valor a partir de ${corte} kgf)`; t.fonteCls = 'EWGSOP2, Cruz-Jentoft et al., 2019'; t.corte = corte; }
  return t;
}
function classifica(val, def){ let r = null; def.cortes.forEach(([c, l, gt]) => { if (gt ? val > c : val >= c) r = l; }); return r; }
// calcula tudo a partir do que foi digitado
function avCalc(v){
  const c = avCtx(v), out = { idade: c.idade, testes: {} };
  if (c.alt && c.peso){ const imc = c.peso / Math.pow(c.alt / 100, 2), ref = imcRef(c.idade);
    out.imc = { valor: imc, cls: classifica(imc, ref), fonte: ref.fonte, def: ref, aviso: c.idade == null ? 'sem data de nascimento: usada a tabela de adultos' : '' }; }
  const ci = num(v.cintura), qu = num(v.quadril); if (ci && qu) out.rcq = ci / qu;
  AV_GRUPOS.forEach(G => G.itens.forEach(([id, , , temPred, tipo]) => {
    if (tipo === 'txt') return;
    const R = AV_REF[id], C = AV_CLS[id], t = {}; let r = num(v[`t_${id}_r`]); if (R && R.abs && r != null) r = Math.abs(r);
    if (R){
      const falta = R.usa.filter(k => c[k] == null || c[k] === '');
      if (falta.length) t.falta = falta.map(k => AV_PRECISA[k]);
      else { t.pred = R.pred(c); t.fonte = R.fonte; if (R.lin) t.lin = R.lin(c, t.pred);
        if (c.idade < R.faixa[0] || c.idade > R.faixa[1]) t.aviso = `idade fora da faixa estudada (${R.faixa[0]} a ${R.faixa[1]} anos): valor extrapolado`; }
      t.menorMelhor = !!R.menorMelhor;
    } else if (id === 'preensao' && avMaos(v).lista.length){ Object.assign(t, avPreensao(v, c)); if (t.pred == null){ const p = num(v[`t_${id}_p`]); if (p){ t.pred = p; t.manual = true; } } }
    else if (temPred){ const p = num(v[`t_${id}_p`]); if (p) t.pred = p; }
    if (r != null && t.pred > 0){ t.pct = r / t.pred * 100; if (t.lin != null) t.abaixoLin = r < t.lin; }
    if (C && r != null){ t.cls = classifica(r, C); t.fonteCls = C.fonte; }
    if (Object.keys(t).length) out.testes[id] = t;
  }));
  return out;
}

async function carregarAvaliacoes(){
  if (avCarregando) return; avCarregando = true;
  try { const s = await db.collection('evolucoes').where('tipo', '==', 'avaliacao').get(); avLista = s.docs.map(d => Object.assign({ _id: d.id }, d.data())); }
  catch(e){ avLista = avLista || []; toast('Não consegui carregar as avaliações'); }
  avCarregando = false; schedule();
}
function vAvaliacoes(){
  if (!avLista){ carregarAvaliacoes(); return '<div class="empty">Carregando avaliações…</div>'; }
  const L = avLista.slice().sort((a, b) => (b.av?.quando || b.data || '').localeCompare(a.av?.quando || a.data || ''));
  const rasc = L.filter(x => x.status !== 'finalizada').length;
  return `<div class="head"><div><h1>Avaliações</h1><p class="sub">${rasc ? `${rasc} em rascunho. ` : ''}Toque numa avaliação para continuar ou baixar o PDF.</p></div></div>
  <section class="panel list">${L.length ? L.map(x => `<button class="irow" data-act="av-edit" data-id="${x._id}"><span class="tx"><span class="t">${esc(x.pnome || 'Sem nome')}</span>
    <span class="m">${esc([fmtD(x.data), x.fisio ? x.fisio.split(' ')[0] : '', AV_FICHAS[x.av?.ficha]?.nome || ''].filter(Boolean).join(' · '))}</span></span>
    <span class="r"><span class="chip ${x.status === 'finalizada' ? 'ok' : 'warn'}">${x.status === 'finalizada' ? 'Finalizada' : 'Rascunho'}</span></span>${ICON.chev}</button>`).join('')
    : '<div class="empty">Nenhuma avaliação ainda. Toque em "Avaliação" para começar.</div>'}</section>`;
}

// ----- campos do formulário -----
const avv = k => { const v = (avAtual.av || {})[k]; return v == null ? '' : v; };
const avIn = (k, l, o = {}) => `<label class="${o.full ? 'full' : ''}">${esc(l)}${o.req ? ' *' : ''}<input data-k="${k}" type="${o.t || 'text'}" ${o.t === 'number' ? 'inputmode="decimal" step="any"' : ''} ${o.list ? `list="${o.list}"` : ''} value="${esc(avv(k))}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.dis ? 'disabled' : ''} autocomplete="off"></label>`;
const avSel = (k, l, ops, o = {}) => `<label class="${o.full ? 'full' : ''}">${esc(l)}${o.req ? ' *' : ''}<select data-k="${k}" ${o.dis ? 'disabled' : ''}><option value="">Escolha…</option>${ops.map(([v, t]) => `<option value="${esc(v)}" ${String(avv(k)) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
const avTx = (k, l, o = {}) => `<div class="fl full"><div class="lrow"><span>${esc(l)}</span>${micBtn('av_' + k)}</div><textarea id="av_${k}" data-k="${k}" rows="${o.rows || 3}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}>${esc(avv(k))}</textarea></div>`;
const avChk = (k, l, ops) => { const sel = Array.isArray(avv(k)) ? avv(k) : []; return `<fieldset class="full multi"><legend>${esc(l)}</legend>${ops.map(([v, t]) => `<label class="chk"><input type="checkbox" data-k="${k}" data-multi="1" value="${v}" ${sel.includes(v) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</fieldset>`; };
const selo = '<span class="chip ok selo" hidden>Preenchido</span>';

const AV_MAO = [['dir','Direita'],['esq','Esquerda'],['ambas','As duas']];
// preensão palmar: mãos testadas e qual valor entra no % do predito (a dominante; sem dominante, a maior)
function avMaos(v){
  const m = v.t_preensao_mao, d = num(v.t_preensao_d), e = num(v.t_preensao_e), dom = v.t_preensao_dom;
  // sem a mão marcada, valem os campos preenchidos
  const lista = []; if ((!m || m === 'dir' || m === 'ambas') && d != null) lista.push(['direita', d]); if ((!m || m === 'esq' || m === 'ambas') && e != null) lista.push(['esquerda', e]);
  let usada = '', r = null;
  if (lista.length === 1){ usada = lista[0][0]; r = lista[0][1]; }
  else if (lista.length === 2){ const p = dom === 'dir' ? lista[0] : dom === 'esq' ? lista[1] : (d >= e ? lista[0] : lista[1]); usada = p[0]; r = p[1]; }
  return { lista, usada, r, dom: dom ? (dom === 'dir' ? 'direita' : 'esquerda') : '' };
}
function avTeste([id, nome, un, pred, tipo]){
  let corpo;
  if (id === 'preensao') corpo = avSel('t_preensao_mao', 'Mão testada', AV_MAO) + avSel('t_preensao_dom', 'Mão dominante', [['dir','Direita'],['esq','Esquerda']])
    + avIn('t_preensao_d', `Mão direita (${un})`, { t: 'number' }).replace('<label class="', '<label data-mao="dir" class="')
    + avIn('t_preensao_e', `Mão esquerda (${un})`, { t: 'number' }).replace('<label class="', '<label data-mao="esq" class="')
    + avIn(`t_${id}_p`, `Predito manual (${un})`, { t: 'number' }).replace('<label class="', '<label id="lbl_pmanual" class="')
    + `<label>% do predito<output id="pc_${id}" class="calc">—</output></label><label class="full">Classificação<output id="cl_${id}" class="calc">—</output></label><p class="ref full" id="mao_${id}"></p>`
    + avIn(`t_${id}_o`, 'Observações', { full: 1 });
  else if (tipo === 'txt') corpo = avTx(`t_${id}_r`, 'Resultado e achados', { rows: 3 });
  else corpo = (tipo === 'extra' ? avIn(`t_${id}_n`, 'Nome do teste') + avIn(`t_${id}_u`, 'Unidade') : '')
    + avIn(`t_${id}_r`, 'Resultado' + (un ? ` (${un})` : ''), { t: 'number' })
    + (AV_REF[id] ? `<label>Predito${un ? ` (${un})` : ''}<output id="pr_${id}" class="calc">—</output></label><label>% do predito<output id="pc_${id}" class="calc">—</output></label><p class="ref full" id="rf_${id}"></p>`
      : pred ? avIn(`t_${id}_p`, 'Predito' + (un ? ` (${un})` : ''), { t: 'number' }) + `<label>% do predito<output id="pc_${id}" class="calc">—</output></label>` : '')
    + (AV_CLS[id] ? `<label class="full">Classificação<output id="cl_${id}" class="calc">—</output></label><p class="ref full">${esc(AV_CLS[id].fonte)}</p>` : '')
    + avIn(`t_${id}_o`, 'Observações', { full: 1 });
  return `<details class="tst" data-t="${id}"><summary><span class="nm">${esc(nome)}</span>${selo}</summary><div class="form">${corpo}</div></details>`;
}
function avSecao(n, titulo, corpo, cls){
  return `<details class="avsec ${cls || ''}" data-s="${n}" open><summary><span class="nm">${n}. ${esc(titulo)}</span>${selo}</summary><div class="form">${corpo}</div></details>`;
}
function avForm(id, base){
  pararDitado(); clearTimeout(avT);
  avAtual = id ? JSON.parse(JSON.stringify(avLista.find(x => x._id === id) || {})) : Object.assign({ status: 'rascunho', av: {} }, base || {});
  if (!avAtual.av) avAtual.av = {};
  if (!id && !avAtual.av.quando) avAtual.av.quando = today() + 'T' + new Date().toTimeString().slice(0, 5);
  avNascCadastro(avAtual.av);
  if (!avAtual.av.fisio) avAtual.av.fisio = avAtual.fisio || (restrito() ? minhaFisio : '');
  // rascunho que ficou só neste celular (o app fechou antes de salvar)
  let recuperado = false;
  try { const r = JSON.parse(localStorage.getItem('ap.avDraft.' + (id || 'novo')) || 'null'); if (r && r.av && (!id || (r.em || '') > (avAtual.alteradoEm || avAtual.criadoEm || ''))) { avAtual.av = r.av; recuperado = true; } } catch(e){}
  const ro = !canWrite, fin = avAtual.status === 'finalizada';
  const pacs = avPacientes().map(p => p.nome);
  const d = $('#dlg');
  d.innerHTML = `<div class="dlg av"><h2>${id ? 'Avaliação · ' + esc(avAtual.pnome || '') : 'Nova avaliação'}</h2>
    ${recuperado ? '<p class="sub" style="margin:0;color:var(--warn)">Recuperei o que estava digitado e não foi salvo.</p>' : ''}
    ${fin ? `<p class="sub" style="margin:0">Finalizada${avAtual.finalizadaEm ? ' em ' + fmtD(avAtual.finalizadaEm.slice(0, 10)) : ''}. Se alterar, salve de novo para atualizar o PDF.</p>` : '<p class="sub" style="margin:0">Os campos com * são obrigatórios para finalizar. Toque em "Falar" para ditar em qualquer campo de texto.</p>'}
    <form id="avForm" onsubmit="return false">
    <datalist id="avPacs">${pacs.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    ${avSecao(1, 'Dados principais',
      avIn('pnome', 'Paciente', { req: 1, full: 1, list: 'avPacs', ph: 'Digite para buscar na lista' })
      + avIn('quando', 'Data e hora', { req: 1, t: 'datetime-local' })
      + (restrito() ? avIn('fisio', 'Fisioterapeuta', { dis: 1 }) : avSel('fisio', 'Fisioterapeuta', fisios().map(f => [f, f]), { req: 1 }))
      + avSel('situacao', 'Situação', AV_SITUACAO, { req: 1 })
      + avSel('sexo', 'Sexo', AV_SEXO, { req: 1 })
      + avIn('nasc', 'Data de nascimento', { t: 'date' }) + '<label>Idade<output id="avIdade" class="calc">—</output></label>'
      + avSel('ficha', 'Ficha', Object.entries(AV_FICHAS).map(([k, f]) => [k, f.nome]), { req: 1, full: 1 }))}
    ${avSecao(2, 'Anamnese',
      AV_ANAM.map(([k, l]) => avTx(k, l)).join('')
      + avChk('comorb', 'Comorbidades', AV_COMORB)
      + AV_ANAM2.map(([k, l]) => avTx(k, l)).join('')
      + avSel('evolucao', 'Evolução', AV_EVOL) + avSel('respiracao', 'Respiração', AV_RESP)
      + avIn('protese', 'Prótese ventilatória', { full: 1 }))}
    ${avSecao(3, 'Dados vitais e composição corporal',
      AV_VITAIS.map(([k, l, un, t]) => avIn(k, `${l} (${un})`, { t: t || 'number' })).join('')
      + avTx('ausculta', 'Ausculta pulmonar', { rows: 2 }) + avTx('pmv', 'Padrão muscular ventilatório', { rows: 2 })
      + avIn('altura', 'Altura (cm)', { req: 1, t: 'number' }) + avIn('massa', 'Massa (kg)', { req: 1, t: 'number' })
      + '<label>IMC (calculado)<output id="avImc" class="calc">—</output></label><label>Classificação do IMC<output id="avImcCls" class="calc">—</output></label><p class="ref full" id="avImcRef"></p>'
      + avIn('pescoco', 'Circunferência do pescoço (cm)', { t: 'number' })
      + avIn('cintura', 'Circunferência da cintura (cm)', { t: 'number' }) + avIn('quadril', 'Circunferência do quadril (cm)', { t: 'number' })
      + '<label>Relação cintura-quadril (calculada)<output id="avRcq" class="calc">—</output></label>'
      + avIn('fonte', 'Fonte dos dados', { full: 1, ph: 'Ex.: medido na avaliação, informado pela família' }))}
    <details class="avsec" data-s="4" open><summary><span class="nm">4. Testes</span><span class="chip mute" id="avCnt"></span></summary>
      <p class="sub" style="margin:8px 14px">Marque os testes que você vai fazer. Só os marcados abrem para preencher e entram no relatório.</p>
      <div class="tsel">${AV_GRUPOS.map(G => `<div class="tgrp"><div class="tgt">${esc(G.t)}</div><div class="pills">${G.itens.map(([id, nome]) => `<label class="pill"><input type="checkbox" data-k="testes" data-multi="1" value="${id}" ${avMarcados().includes(id) ? 'checked' : ''}><span>${esc(nome)}</span></label>`).join('')}</div></div>`).join('')}</div>
      <div id="avTestes">${AV_GRUPOS.map(G => `<div class="grp" data-g="${G.g}"><div class="tgt">${esc(G.t)}</div>${G.itens.map(avTeste).join('')}</div>`).join('')}</div>
    </details>
    ${avSecao(5, 'Conclusão',
      avTx('diagfisio', 'Diagnóstico fisioterapêutico', { rows: 4 }) + avTx('objetivos', 'Objetivos terapêuticos', { rows: 3 }) + avTx('conclusao', 'Conclusão', { rows: 4 }))}
    </form>
    <p class="sub" id="avMsg" style="margin:0;color:var(--bad)" hidden></p>
    <div class="foot">${id && isAdmin ? `<button type="button" class="btn ghost" data-act="av-del" data-id="${id}">Excluir</button>` : ''}
      ${fin ? `<button type="button" class="btn" data-act="av-pdf" data-id="${id}">${ICON.pdf}Baixar PDF</button>` : ''}<span class="sp"></span>
      <button type="button" class="btn" data-act="close">Fechar</button>
      ${ro ? '' : `<button type="button" class="btn" data-act="av-salvar">Salvar rascunho</button><button type="button" class="btn pri" data-act="av-final">${fin ? 'Salvar e gerar PDF' : 'Finalizar e gerar PDF'}</button>`}</div></div>`;
  if (ro) d.querySelectorAll('#avForm input,#avForm select,#avForm textarea').forEach(el => el.disabled = true);
  if (!d.open) d.showModal();
  avAtualizar(true);
}
// testes marcados; avaliações antigas (sem a lista) consideram marcados os que têm algum valor
function avMarcados(v){
  v = v || avAtual.av || {};
  if (Array.isArray(v.testes)) return v.testes;
  const L = []; AV_GRUPOS.forEach(G => G.itens.forEach(([id]) => { if (['r', 'p', 'o', 'n'].some(s => v[`t_${id}_${s}`])) L.push(id); })); return L;
}
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.k === 'pnome' && e.target.closest('#avForm')){ const v = { pnome: e.target.value }; if (avNascCadastro(v)){ const n = $('#avForm [data-k="nasc"]'); if (n && !n.value){ n.value = v.nasc; avAtualizar(); } } } });
function avNascCadastro(v){
  if (v.nasc || !v.pnome || !isAdmin) return false;
  const p = avPacientes().find(x => x.nome.trim().toLowerCase() === v.pnome.trim().toLowerCase());
  const n = p && S.planos[p.pid]?.nasc; if (n){ v.nasc = n; return true; } return false;
}
function avLer(){
  const v = {}; const f = $('#avForm'); if (!f) return v;
  f.querySelectorAll('[data-k]').forEach(el => {
    const k = el.dataset.k;
    if (el.dataset.multi){ v[k] = v[k] || []; if (el.checked) v[k].push(el.value); return; }
    const x = (el.value || '').trim(); if (x !== '') v[k] = x;
  });
  Object.keys(v).forEach(k => { if (Array.isArray(v[k]) && !v[k].length) delete v[k]; });
  if (restrito()) v.fisio = minhaFisio;
  // preensão palmar: o resultado usado no cálculo vem das mãos escolhidas
  if (v.t_preensao_mao || v.t_preensao_d || v.t_preensao_e){ const M = avMaos(v); if (M.r != null) v.t_preensao_r = String(M.r); else delete v.t_preensao_r; }
  else if (avAtual && avAtual.av && avAtual.av.t_preensao_r) v.t_preensao_r = avAtual.av.t_preensao_r;
  return v;
}
function avAtualizar(semRascunho){
  const f = $('#avForm'); if (!f) return; const v = avLer();
  const K = avCalc(v), set = (id, t) => { const o = document.getElementById(id); if (o) o.textContent = t; };
  set('avIdade', K.idade != null ? K.idade + ' anos' : '—');
  { const mao = v.t_preensao_mao || ''; f.querySelectorAll('[data-mao]').forEach(l => { l.hidden = !!mao && !(mao === 'ambas' || mao === l.dataset.mao); });
    const T = K.testes.preensao || {}, lp = $('#lbl_pmanual'); if (lp) lp.hidden = !T.falta && !!T.maos;
    set('mao_preensao', !mao && !T.maos && !T.falta ? 'Escolha a mão testada e digite o valor.' : T.maos ? T.maos.map(m => `Mão ${m.l}${m.dom ? ' (dominante)' : ''}: predito ${fmtNum(m.pred, 2)} kgf, ${fmtNum(m.pct, 0)}% do predito`).join(' · ') + ` · Novaes et al., 2009${T.aviso ? ' · ' + T.aviso : ''}. Classificação: EWGSOP2.`
      : T.falta ? 'Para calcular o predito, preencha: ' + T.falta.join(', ') + '. Sem isso, digite o predito manual.' : ''); }
  set('avRcq', K.rcq != null ? fmtNum(K.rcq, 2) : '—');
  // IMC = massa (kg) ÷ altura (m)²
  set('avImc', K.imc ? fmtNum(K.imc.valor, 1) : '—'); set('avImcCls', K.imc ? K.imc.cls : '—');
  set('avImcRef', K.imc ? K.imc.fonte + (K.imc.aviso ? ' · ' + K.imc.aviso : '') : '');
  // predito pela equação da referência; % do predito = resultado ÷ predito × 100
  AV_GRUPOS.forEach(G => G.itens.forEach(([id, , un]) => { const t = K.testes[id] || {};
    set('pr_' + id, t.pred != null ? fmtNum(t.pred, 2) : '—');
    set('pc_' + id, t.pct != null ? fmtNum(t.pct, 0) + '%' : '—');
    set('cl_' + id, t.cls || '—');
    if (AV_REF[id]) set('rf_' + id, t.falta ? 'Para calcular o predito, preencha: ' + t.falta.join(', ') + '.'
      : [AV_REF[id].fonte, t.lin != null ? `limite inferior ${fmtNum(t.lin, 1)} ${un}` : '', AV_REF[id].menorMelhor ? 'tempo: quanto menor, melhor' : '', t.aviso || ''].filter(Boolean).join(' · ')); }));
  // selos "Preenchido"
  const tem = el => [...el.querySelectorAll('[data-k]')].some(i => i.dataset.multi ? i.checked : (i.value || '').trim() !== '');
  let nTestes = 0;
  f.querySelectorAll('details.tst').forEach(t => { const ok = tem(t); t.querySelector('.selo').hidden = !ok; if (ok && !t.hidden) nTestes++; });
  // só aparecem os testes marcados; o que acabou de ser marcado já abre
  const marc = v.testes || [];
  f.querySelectorAll('details.tst').forEach(t => { const on = marc.includes(t.dataset.t); if (on && t.hidden) t.open = true; t.hidden = !on; });
  f.querySelectorAll('#avTestes .grp').forEach(g => { g.hidden = !g.querySelector('details.tst:not([hidden])'); });
  f.querySelectorAll('details.avsec[data-s]').forEach(s => { const sl = s.querySelector(':scope > summary .selo'); if (!sl) return;
    const n = s.dataset.s; const ok = n === '1' ? ['pnome','quando','fisio','situacao','sexo','ficha'].every(k => v[k]) : n === '3' ? !!(v.altura && v.massa) : n === '5' ? !!(v.diagfisio && v.objetivos) : tem(s);
    sl.hidden = !ok; });
  const cnt = $('#avCnt'); if (cnt) cnt.textContent = marc.length ? `${marc.length} marcado${marc.length > 1 ? 's' : ''} · ${nTestes} preenchido${nTestes !== 1 ? 's' : ''}` : 'nenhum teste marcado';
  if (!semRascunho){ clearTimeout(avT); avT = setTimeout(() => { try { localStorage.setItem('ap.avDraft.' + (avAtual._id || 'novo'), JSON.stringify({ av: avLer(), em: new Date().toISOString() })); } catch(e){} }, 400); }
}
document.addEventListener('input', e => { if (e.target.closest && e.target.closest('#avForm')) avAtualizar(); });
document.addEventListener('change', e => { if (e.target.closest && e.target.closest('#avForm')) avAtualizar(); });

async function avSalvar(finalizar){
  const v = avLer(), msg = $('#avMsg'); msg.hidden = true;
  if (finalizar){ const falta = AV_OBRIG.filter(([k]) => !v[k]).map(x => x[1]); if (falta.length){ msg.hidden = false; msg.textContent = 'Para finalizar, preencha: ' + falta.join(', ') + '.'; return; } }
  if (!v.pnome){ msg.hidden = false; msg.textContent = 'Escreva o nome do paciente antes de salvar.'; return; }
  const p0 = avPacientes().find(x => x.nome.trim().toLowerCase() === v.pnome.toLowerCase()); const p = p0 ? { _id: p0.pid, nome: p0.nome } : null;
  const id = avAtual._id || ('av_' + novoId()); const agora = new Date().toISOString();
  const K = avCalc(v); if (K.imc) v.imc = fmtNum(K.imc.valor, 1); else delete v.imc;
  const doc = { tipo: 'avaliacao', pid: p?._id || '', pnome: p?.nome || v.pnome, data: (v.quando || today()).slice(0, 10), fisio: v.fisio || '',
    status: finalizar ? 'finalizada' : (avAtual.status || 'rascunho'), agId: avAtual.agId || '', av: v, calc: K,
    criadoEm: avAtual.criadoEm || agora, alteradoEm: avAtual._id ? agora : '', finalizadaEm: finalizar ? agora : (avAtual.finalizadaEm || '') };
  try {
    await db.doc('evolucoes/' + id).set(doc); clearTimeout(avT);
    try { localStorage.removeItem('ap.avDraft.' + (avAtual._id || 'novo')); } catch(e){}
    const x = Object.assign({ _id: id }, doc); avLista = (avLista || []).filter(y => y._id !== id).concat([x]);
    if (finalizar && doc.agId && S.agenda[doc.agId] && (S.agenda[doc.agId].status || 'agendado') === 'agendado') { try { await db.doc('agenda/' + doc.agId).update({ status: 'feito' }); } catch(e){} }
    $('#dlg').close(); schedule();
    if (finalizar){ if (gerarPdfAvaliacao(x)) setTimeout(() => toast('Avaliação finalizada. PDF baixado.'), 300); }
    else toast('Rascunho salvo');
  } catch(e){ msg.hidden = false; msg.textContent = 'Não foi possível salvar (' + (e?.code || 'erro') + '). O que você digitou continua guardado neste celular; tente de novo.'; }
}

// ----- ações -----
async function avAcao(a, id, b){
  if (a === 'ditar') return ditar(b.dataset.alvo, b);
  if (a === 'av-new') return avForm(null);
  if (a === 'av-edit') return avForm(id);
  if (a === 'av-salvar') return avSalvar(false);
  if (a === 'av-final') return avSalvar(true);
  if (a === 'av-pdf'){ const x = (avLista || []).find(y => y._id === id); if (x) gerarPdfAvaliacao(x); return; }
  if (a === 'av-del') return confirmBox('Excluir esta avaliação? Não dá para desfazer.', async () => { await db.doc('evolucoes/' + id).delete(); avLista = (avLista || []).filter(y => y._id !== id); toast('Avaliação excluída'); });
  if (a === 'av-ag'){ // abre a avaliação ligada a um horário de avaliação da agenda
    const ag = S.agenda[id]; if (!ag) return;
    if (!avLista){ toast('Carregando avaliações…'); await carregarAvaliacoes(); }
    const ja = (avLista || []).find(y => y.agId === id); if (ja) return avForm(ja._id);
    const p = S.pacientes[ag.pid];
    return avForm(null, { agId: id, fisio: ag.fisio || '', av: { pnome: p?.nome || ag.pnome || '', quando: ag.data + 'T' + (ag.hora || '08:00'), fisio: ag.fisio || (restrito() ? minhaFisio : '') } });
  }
}
$('#dlg').addEventListener('close', pararDitado);
