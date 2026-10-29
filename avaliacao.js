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
  { g: 'forca', t: 'Força', itens: [['rm1','1RM','kg',1],['preensao','Preensão palmar','kgf',1],['dina','Dinamometria','kgf',1],['dinaq','Dinamometria de quadríceps','kgf',1],['mrc','MRC','pontos',0]] },
  { g: 'pulm', t: 'Função pulmonar', itens: [['cvf','CVF','L',1],['vef1','VEF1','L',1],['pfe','PFE','L/min',1],['pft','Pico de fluxo de tosse','L/min',1],['pimax','PiMax','cmH2O',1],['pemax','PeMax','cmH2O',1],['sindex','S-Index','cmH2O',1],['endur','Endurance respiratório','',1]] },
  { g: 'cardio', t: 'Aptidão cardiorrespiratória', itens: [['tc6','TC6','m',1],['td6','TD6','',1],['iswt','ISWT','m',1],['chester','Chester Step','',1],['tls1','TLS 1 min','repetições',1],['tc2','TC2','',1],['risco','Estratificação de risco','',0,'txt']] },
  { g: 'vfc', t: 'VFC', itens: [['vfc','Variabilidade da frequência cardíaca','',0,'txt']] },
  { g: 'us', t: 'Ultrassom', itens: [['uspl','Pleuropulmonar','',0,'txt'],['usdia','Diafragmático','',0,'txt'],['usme','Musculoesquelético','',0,'txt']] },
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
let avT = null, avLista = null, avAtual = null, avTodos = false, avCarregando = false;
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
  pimax: { fonte: 'Neder et al., 1999', faixa: [20, 80], usa: ['sexo', 'idade'], pred: c => c.sexo === 'F' ? 110.4 - 0.49 * c.idade : 155.3 - 0.80 * c.idade },
  pemax: { fonte: 'Neder et al., 1999', faixa: [20, 80], usa: ['sexo', 'idade'], pred: c => c.sexo === 'F' ? 115.6 - 0.61 * c.idade : 165.3 - 0.81 * c.idade },
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
  act: { fonte: 'Nathan et al., 2004', min: 5, max: 25, cortes: [[5, 'Não controlada'], [20, 'Controlada']] }
};
function imcRef(idade){
  return idade != null && idade >= 60
    ? { fonte: 'Lipschitz, 1994 (60 anos ou mais)', min: 14, max: 40, cortes: [[0, 'Baixo peso'], [22, 'Eutrofia'], [27, 'Sobrepeso', 'gt']] }
    : { fonte: 'OMS (adultos)', min: 14, max: 40, cortes: [[0, 'Baixo peso'], [18.5, 'Eutrofia'], [25, 'Sobrepeso'], [30, 'Obesidade']] };
}
function classifica(val, def){ let r = null; def.cortes.forEach(([c, l, gt]) => { if (gt ? val > c : val >= c) r = l; }); return r; }
// calcula tudo a partir do que foi digitado
function avCalc(v){
  const c = avCtx(v), out = { idade: c.idade, testes: {} };
  if (c.alt && c.peso){ const imc = c.peso / Math.pow(c.alt / 100, 2), ref = imcRef(c.idade);
    out.imc = { valor: imc, cls: classifica(imc, ref), fonte: ref.fonte, def: ref, aviso: c.idade == null ? 'sem data de nascimento: usada a tabela de adultos' : '' }; }
  AV_GRUPOS.forEach(G => G.itens.forEach(([id, , , temPred, tipo]) => {
    if (tipo === 'txt') return;
    const r = num(v[`t_${id}_r`]), R = AV_REF[id], C = AV_CLS[id], t = {};
    if (R){
      const falta = R.usa.filter(k => c[k] == null || c[k] === '');
      if (falta.length) t.falta = falta.map(k => AV_PRECISA[k]);
      else { t.pred = R.pred(c); t.fonte = R.fonte; if (R.lin) t.lin = R.lin(c, t.pred);
        if (c.idade < R.faixa[0] || c.idade > R.faixa[1]) t.aviso = `idade fora da faixa estudada (${R.faixa[0]} a ${R.faixa[1]} anos): valor extrapolado`; }
      t.menorMelhor = !!R.menorMelhor;
    } else if (temPred){ const p = num(v[`t_${id}_p`]); if (p) t.pred = p; }
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

function avTeste([id, nome, un, pred, tipo]){
  let corpo;
  if (tipo === 'txt') corpo = avTx(`t_${id}_r`, 'Resultado e achados', { rows: 3 });
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
      + avSel('ficha', 'Ficha (define os testes)', Object.entries(AV_FICHAS).map(([k, f]) => [k, f.nome]), { req: 1, full: 1 }))}
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
      + avIn('fonte', 'Fonte dos dados', { full: 1, ph: 'Ex.: medido na avaliação, informado pela família' }))}
    <details class="avsec" data-s="4" open><summary><span class="nm">4. Testes</span><span class="chip mute" id="avCnt"></span></summary>
      <p class="sub" id="avFichaMsg" style="margin:8px 0"></p>
      ${AV_GRUPOS.map(G => `<details class="grp" data-g="${G.g}"><summary><span class="nm">${esc(G.t)}</span><span class="chip ok cnt" hidden></span></summary>${G.itens.map(avTeste).join('')}</details>`).join('')}
      <button type="button" class="btn sm ghost" data-act="av-todos" id="avTodosBtn"></button>
    </details>
    ${avSecao(5, 'Conclusão',
      avTx('diagfisio', 'Diagnóstico fisioterapêutico', { rows: 4 }) + avTx('objetivos', 'Objetivos terapêuticos', { rows: 3 }) + avTx('condutas', 'Condutas (opcional)', { rows: 3 }))}
    </form>
    <p class="sub" id="avMsg" style="margin:0;color:var(--bad)" hidden></p>
    <div class="foot">${id && isAdmin ? `<button type="button" class="btn ghost" data-act="av-del" data-id="${id}">Excluir</button>` : ''}
      ${fin ? `<button type="button" class="btn" data-act="av-pdf" data-id="${id}">${ICON.pdf}Baixar PDF</button>` : ''}<span class="sp"></span>
      <button type="button" class="btn" data-act="close">Fechar</button>
      ${ro ? '' : `<button type="button" class="btn" data-act="av-salvar">Salvar rascunho</button><button type="button" class="btn pri" data-act="av-final">${fin ? 'Salvar e gerar PDF' : 'Finalizar e gerar PDF'}</button>`}</div></div>`;
  if (ro) d.querySelectorAll('#avForm input,#avForm select,#avForm textarea').forEach(el => el.disabled = true);
  if (!d.open) d.showModal();
  avTodos = false; avAtualizar(true);
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
  return v;
}
function avAtualizar(semRascunho){
  const f = $('#avForm'); if (!f) return; const v = avLer();
  const K = avCalc(v), set = (id, t) => { const o = document.getElementById(id); if (o) o.textContent = t; };
  set('avIdade', K.idade != null ? K.idade + ' anos' : '—');
  // IMC = massa (kg) ÷ altura (m)²
  set('avImc', K.imc ? fmtNum(K.imc.valor, 1) : '—'); set('avImcCls', K.imc ? K.imc.cls : '—');
  set('avImcRef', K.imc ? K.imc.fonte + (K.imc.aviso ? ' · ' + K.imc.aviso : '') : '');
  // predito pela equação da referência; % do predito = resultado ÷ predito × 100
  AV_GRUPOS.forEach(G => G.itens.forEach(([id, , un]) => { const t = K.testes[id] || {};
    set('pr_' + id, t.pred != null ? fmtNum(t.pred, 2) : '—');
    set('pc_' + id, t.pct != null ? fmtNum(t.pct, 0) + '%' : '—');
    set('cl_' + id, t.cls || '—');
    if (AV_REF[id]) set('rf_' + id, t.falta ? 'Para calcular o predito, preencha: ' + t.falta.join(', ') + '.'
      : [AV_REF[id].fonte, t.lin != null ? `limite inferior ${fmtNum(t.lin, 0)} ${un}` : '', AV_REF[id].menorMelhor ? 'tempo: quanto menor, melhor' : '', t.aviso || ''].filter(Boolean).join(' · ')); }));
  // selos "Preenchido"
  const tem = el => [...el.querySelectorAll('[data-k]')].some(i => i.dataset.multi ? i.checked : (i.value || '').trim() !== '');
  let nTestes = 0;
  f.querySelectorAll('details.tst').forEach(t => { const ok = tem(t); t.querySelector('.selo').hidden = !ok; if (ok) nTestes++; });
  f.querySelectorAll('details.grp').forEach(g => { const n = [...g.querySelectorAll('details.tst')].filter(t => !t.querySelector('.selo').hidden).length; const c = g.querySelector('.cnt'); c.hidden = !n; c.textContent = n + (n > 1 ? ' preenchidos' : ' preenchido'); });
  f.querySelectorAll('details.avsec[data-s]').forEach(s => { const sl = s.querySelector(':scope > summary .selo'); if (!sl) return;
    const n = s.dataset.s; const ok = n === '1' ? ['pnome','quando','fisio','situacao','sexo','ficha'].every(k => v[k]) : n === '3' ? !!(v.altura && v.massa) : n === '5' ? !!(v.diagfisio && v.objetivos) : tem(s);
    sl.hidden = !ok; });
  const cnt = $('#avCnt'); if (cnt) cnt.textContent = nTestes ? nTestes + (nTestes > 1 ? ' testes preenchidos' : ' teste preenchido') : 'nenhum teste preenchido';
  // a ficha define quais grupos de testes aparecem
  const fi = AV_FICHAS[v.ficha];
  f.querySelectorAll('details.grp').forEach(g => { const vis = avTodos || !fi || !fi.grupos || fi.grupos.includes(g.dataset.g) || !g.querySelector('.cnt').hidden; g.hidden = !vis; });
  const msg = $('#avFichaMsg'), bt = $('#avTodosBtn');
  if (msg) msg.textContent = !fi ? 'Escolha a ficha no bloco 1 para ver só os testes dela.' : fi.grupos ? `A ficha ${fi.nome} ainda não tem testes definidos. Aparecem só os testes extras.` : `Testes da ficha ${fi.nome}.`;
  if (bt){ bt.hidden = !fi || !fi.grupos; bt.textContent = avTodos ? 'Mostrar só os testes da ficha' : 'Mostrar todos os testes'; }
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

// ----- PDF -----
function gerarPdfAvaliacao(x){
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J){ toast('Não consegui carregar o gerador de PDF. Confira a internet e tente de novo.'); return false; }
  const v = x.av || {}, doc = new J({ unit: 'mm', format: 'a4' });
  const M = 18, W = 210 - 2 * M, TOP = 20, BOT = 278; let y = TOP;
  const lh = s => s * 0.3528 * 1.35;
  const quebra = h => { if (y + h > BOT){ doc.addPage(); y = TOP; } };
  const escreve = (txt, { size = 10, bold = false, indent = 0, after = 1.5, align = 'left', cor = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(cor);
    doc.splitTextToSize(String(txt), W - indent).forEach(l => { quebra(lh(size)); doc.text(l, align === 'center' ? 105 : M + indent, y, { align }); y += lh(size); });
    y += after; doc.setTextColor(0);
  };
  const titulo = t => { quebra(16); y += 3; escreve(t, { size: 12, bold: true, after: 0.5 }); doc.setDrawColor(79, 125, 135); doc.setLineWidth(0.4); doc.line(M, y, M + W, y); y += 4; };
  const campo = (rot, val) => { if (val == null || val === '' || (Array.isArray(val) && !val.length)) return; escreve(rot, { size: 9, bold: true, after: 0.3, cor: 80 }); escreve(val, { after: 2.2 }); };
  const linhaKV = pares => { const t = pares.filter(([, val]) => val !== '' && val != null).map(([r, val]) => `${r}: ${val}`).join('   ·   '); if (t) escreve(t, { after: 2.2 }); };
  const K = x.calc && x.calc.testes ? x.calc : avCalc(v);
  // ----- gráficos desenhados no próprio PDF -----
  const AC = [79, 125, 135], TXT = [29, 42, 45], MUT = [95, 113, 117], GRADE = [222, 228, 229], REF = [140, 150, 152];
  const ZONAS = [[238, 244, 245], [216, 230, 233], [190, 213, 218], [160, 193, 200]];
  const labW = 52, x0 = M + labW, pw = W - labW - 14;
  const nomeCurto = t => doc.splitTextToSize(t, labW - 3)[0];
  function grafPred(itens){
    const rowH = 8, n = itens.length, maxV = Math.min(200, Math.max(120, Math.ceil(Math.max(...itens.map(i => i.pct)) / 20) * 20));
    const X = p => x0 + Math.max(0, Math.min(p, maxV)) / maxV * pw, passo = maxV > 150 ? 50 : 20;
    quebra(rowH * n + 18); const y0 = y + 2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.setLineWidth(0.15); doc.setDrawColor(...GRADE);
    for (let t = 0; t <= maxV; t += passo){ doc.line(X(t), y0, X(t), y0 + rowH * n); doc.text(t + '%', X(t), y0 + rowH * n + 3.6, { align: 'center' }); }
    doc.setDrawColor(...REF); doc.setLineWidth(0.4); doc.setLineDashPattern([1.2, 1], 0); doc.line(X(100), y0 - 1.5, X(100), y0 + rowH * n); doc.setLineDashPattern([], 0);
    itens.forEach((it, i) => {
      const yy = y0 + i * rowH; doc.setFontSize(8.5); doc.setTextColor(...TXT); doc.text(nomeCurto(it.nome + (it.menor ? ' *' : '')), M, yy + 5.2);
      const w = Math.max(0.6, X(it.pct) - x0); doc.setFillColor(...AC); doc.roundedRect(x0, yy + 2.3, w, 4, Math.min(0.8, w / 2), Math.min(0.8, w / 2), 'F');
      if (it.linPct != null){ doc.setDrawColor(...TXT); doc.setLineWidth(0.6); doc.line(X(it.linPct), yy + 1.3, X(it.linPct), yy + 7.3); }
      doc.setFontSize(8); doc.setTextColor(...TXT); doc.text(fmtNum(it.pct, 0) + '%' + (it.pct > maxV ? ' (fora da escala)' : ''), X(it.pct) + 1.5, yy + 5.5);
    });
    y = y0 + rowH * n + 7.5;
    const leg = ['Linha tracejada: 100% do predito.'];
    if (itens.some(i => i.linPct != null)) leg.push('Traço escuro: limite inferior da normalidade.');
    if (itens.some(i => i.menor)) leg.push('* Teste de tempo: acima de 100% significa mais lento que o esperado.');
    escreve(leg.join(' '), { size: 7.5, cor: 95, after: 3 });
  }
  function grafEscala(nome, val, def, un, cls){
    quebra(17); const y0 = y, h = 5, X = t => x0 + (Math.max(def.min, Math.min(def.max, t)) - def.min) / (def.max - def.min) * pw;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...TXT); doc.text(nomeCurto(nome), M, y0 + 4.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.text(nomeCurto(`${fmtNum(val, 1)}${un ? ' ' + un : ''} · ${cls}`), M, y0 + 8.5);
    def.cortes.forEach(([c, l], i) => {
      const a = X(Math.max(c, def.min)), b = i + 1 < def.cortes.length ? X(def.cortes[i + 1][0]) : X(def.max);
      doc.setFillColor(...ZONAS[Math.min(i, 3)]); doc.rect(a + (i ? 0.3 : 0), y0 + 2, Math.max(0.2, b - a - (i ? 0.3 : 0)), h, 'F');
      doc.setFontSize(6.5); doc.setTextColor(...MUT); if (doc.getTextWidth(l) < b - a - 1) doc.text(l, (a + b) / 2, y0 + 5.4, { align: 'center' });
      if (i) doc.text(fmtNum(c, 1), a, y0 + 10, { align: 'center' });
    });
    const mx = X(val); doc.setFillColor(...TXT); doc.triangle(mx - 1.6, y0 + 0.2, mx + 1.6, y0 + 0.2, mx, y0 + 2.4, 'F');
    doc.setDrawColor(...TXT); doc.setLineWidth(0.5); doc.line(mx, y0 + 2, mx, y0 + 2 + h);
    doc.setTextColor(0); y = y0 + 13;
  }

  const quando = v.quando ? fmtD(v.quando.slice(0, 10)) + (v.quando.length > 10 ? ' às ' + v.quando.slice(11, 16) : '') : fmtD(x.data);

  escreve('Avaliação fisioterapêutica', { size: 16, bold: true, after: 1, align: 'center' });
  escreve('AP Fisioterapia Domiciliar', { size: 10, after: 6, align: 'center', cor: 90 });
  titulo('1. Dados principais');
  campo('Paciente', x.pnome); linhaKV([['Data', quando], ['Fisioterapeuta', v.fisio || x.fisio]]);
  linhaKV([['Sexo', v.sexo ? rotulo(AV_SEXO, v.sexo) : ''], ['Idade', K.idade != null ? K.idade + ' anos' : ''], ['Situação', v.situacao ? rotulo(AV_SITUACAO, v.situacao) : ''], ['Ficha', AV_FICHAS[v.ficha]?.nome || '']]);

  const anam = [...AV_ANAM, ['comorb', 'Comorbidades'], ...AV_ANAM2];
  if (anam.some(([k]) => v[k]) || v.evolucao || v.respiracao || v.protese){
    titulo('2. Anamnese');
    anam.forEach(([k, l]) => campo(l, k === 'comorb' ? (v.comorb || []).map(c => rotulo(AV_COMORB, c)).join(', ') : v[k]));
    linhaKV([['Evolução', v.evolucao ? rotulo(AV_EVOL, v.evolucao) : ''], ['Respiração', v.respiracao ? rotulo(AV_RESP, v.respiracao) : '']]);
    campo('Prótese ventilatória', v.protese);
  }
  titulo('3. Dados vitais e composição corporal');
  linhaKV(AV_VITAIS.map(([k, l, un]) => [l, v[k] ? `${v[k]} ${un}` : '']));
  linhaKV([['Altura', v.altura ? v.altura + ' cm' : ''], ['Massa', v.massa ? v.massa + ' kg' : ''], ['IMC', v.imc ? v.imc + ' kg/m²' : ''], ['Pescoço', v.pescoco ? v.pescoco + ' cm' : '']]);
  if (K.imc){ escreve(`Classificação do IMC: ${K.imc.cls} (${K.imc.fonte}${K.imc.aviso ? '; ' + K.imc.aviso : ''})`, { size: 9, after: 1.5 }); grafEscala('IMC', K.imc.valor, K.imc.def, 'kg/m²', K.imc.cls); }
  campo('Ausculta pulmonar', v.ausculta); campo('Padrão muscular ventilatório', v.pmv); campo('Fonte dos dados', v.fonte);

  const grupos = AV_GRUPOS.map(G => ({ t: G.t, L: G.itens.filter(([id]) => ['r', 'p', 'o', 'n'].some(s => v[`t_${id}_${s}`])) })).filter(G => G.L.length);
  if (grupos.length){
    titulo('4. Testes');
    grupos.forEach(G => {
      quebra(12); escreve(G.t, { size: 10.5, bold: true, after: 1 });
      G.L.forEach(([id, nome, un, pred, tipo]) => {
        const u = tipo === 'extra' ? (v[`t_${id}_u`] || '') : un;
        const nm = tipo === 'extra' ? (v[`t_${id}_n`] || nome) : nome;
        if (tipo === 'txt'){ campo(nm, v[`t_${id}_r`]); return; }
        const r = num(v[`t_${id}_r`]), t = K.testes[id] || {};
        const partes = [r != null ? `resultado ${v[`t_${id}_r`]}${u ? ' ' + u : ''}` : '', t.pred != null ? `predito ${fmtNum(t.pred, 2)}${u ? ' ' + u : ''}` : '',
          t.pct != null ? `${fmtNum(t.pct, 0)}% do predito` : '', t.lin != null ? `limite inferior ${fmtNum(t.lin, 0)}${u ? ' ' + u : ''}${t.abaixoLin ? ' (abaixo do limite)' : ''}` : '', t.cls ? `classificação: ${t.cls}` : ''].filter(Boolean);
        escreve(`${nm}: ${partes.join(' · ') || '—'}`, { indent: 3, after: 0.3 });
        const fontes = [t.fonte, t.fonteCls].filter(Boolean).join('; ');
        const nota = [fontes ? 'Referência: ' + fontes : (t.pred != null ? 'Predito informado pela fisioterapeuta' : ''), t.aviso ? 'Atenção: ' + t.aviso : ''].filter(Boolean).join(' · ');
        if (nota) escreve(nota, { indent: 3, size: 8, after: 0.3, cor: 95 });
        y += v[`t_${id}_o`] ? 0 : 1.3;
        if (v[`t_${id}_o`]) escreve('Obs.: ' + v[`t_${id}_o`], { indent: 3, size: 9, after: 1.8, cor: 70 });
      });
      y += 1;
    });
  }
  const barras = [], escalas = [];
  AV_GRUPOS.forEach(G => G.itens.forEach(([id, nome, un, , tipo]) => { const t = K.testes[id]; if (!t) return;
    const nm = tipo === 'extra' ? (v[`t_${id}_n`] || nome) : nome;
    if (t.pct != null) barras.push({ nome: nm, pct: t.pct, linPct: t.lin != null && t.pred ? t.lin / t.pred * 100 : null, menor: t.menorMelhor });
    if (t.cls) escalas.push([nm, num(v[`t_${id}_r`]), AV_CLS[id], un, t.cls]); }));
  if (barras.length || escalas.length){
    quebra(barras.length ? 8 * barras.length + 40 : 40); titulo('Gráficos');
    if (barras.length){ quebra(8 * barras.length + 26); escreve('Resultado em % do predito', { size: 10, bold: true, after: 1 }); grafPred(barras); }
    if (escalas.length){ quebra(26); escreve('Escalas e pontos de corte', { size: 10, bold: true, after: 2 }); escalas.forEach(e => grafEscala(...e)); y += 2; }
  }
  titulo('5. Conclusão');
  campo('Diagnóstico fisioterapêutico', v.diagfisio); campo('Objetivos terapêuticos', v.objetivos); campo('Condutas', v.condutas);
  quebra(30); y += 16; doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(M, y, M + 90, y); y += 5;
  escreve(v.fisio || x.fisio || 'Fisioterapeuta', { size: 9.5, after: 0 });
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++){ doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120); doc.text(`Avaliação · ${x.pnome || ''} · ${quando} · página ${i} de ${n}`, 105, 290, { align: 'center' }); doc.setTextColor(0); }
  doc.save(`Avaliacao AP - ${(x.pnome || 'paciente').replace(/[\\/:*?"<>|]/g, '')} - ${x.data || ''}.pdf`.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  return true;
}

// ----- ações -----
async function avAcao(a, id, b){
  if (a === 'ditar') return ditar(b.dataset.alvo, b);
  if (a === 'av-new') return avForm(null);
  if (a === 'av-edit') return avForm(id);
  if (a === 'av-todos'){ avTodos = !avTodos; return avAtualizar(true); }
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
