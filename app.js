// ---------- banco (Supabase) ----------
// Uma tabela "docs" guarda cada registro como documento JSON: col (coleção) + id + data.
// As regras de quem vê e altera o quê estão no banco (supabase/schema.sql), não só na tela.
function novoId(){ const a = new Uint8Array(10); crypto.getRandomValues(a); return Array.from(a, b => b.toString(36).padStart(2,'0')).join('').slice(0,20); }
function erroDb(e){ return { code: e?.code === '42501' ? 'sem permissão' : (e?.message || e?.code || 'erro'), message: e?.message || '' }; }
function snapDoc(id, data){ return { id, exists: data !== undefined && data !== null, data: () => data ?? undefined }; }
function criarDb(sb){
  const OPS = { '==':'eq', '!=':'neq', '<':'lt', '<=':'lte', '>':'gt', '>=':'gte' };
  const ouvir = (col, aoMudar) => {
    let t; const ch = sb.channel('c-' + col + '-' + novoId())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'col=eq.' + col }, () => { clearTimeout(t); t = setTimeout(aoMudar, 200); })
      .subscribe();
    const iv = setInterval(aoMudar, 60000);
    return () => { clearInterval(iv); sb.removeChannel(ch); };
  };
  class Doc {
    constructor(col, id){ this.col = col; this.id = id; this.path = col + '/' + id; }
    async get(){ const { data, error } = await sb.from('docs').select('data').eq('col', this.col).eq('id', this.id).maybeSingle(); if (error) throw erroDb(error); return snapDoc(this.id, data ? data.data : undefined); }
    async set(obj){ const { error } = await sb.from('docs').upsert({ col: this.col, id: this.id, data: JSON.parse(JSON.stringify(obj)) }); if (error) throw erroDb(error); }
    async update(patch){ const atual = await this.get(); if (!atual.exists) throw { code: 'registro não encontrado' }; await this.set(Object.assign({}, atual.data(), patch)); }
    async delete(){ const { error } = await sb.from('docs').delete().eq('col', this.col).eq('id', this.id); if (error) throw erroDb(error); }
    onSnapshot(next, err){ let vivo = true; const run = () => this.get().then(s => vivo && next(s)).catch(e => err && err(e)); run(); const off = ouvir(this.col, run); return () => { vivo = false; off(); }; }
    collection(sub){ return new Col(this.path + '/' + sub); }
  }
  class Col {
    constructor(col, filtros){ this.col = col; this.filtros = filtros || []; this.path = col; }
    where(f, op, v){ return new Col(this.col, [...this.filtros, [f, op, v]]); }
    doc(id){ return new Doc(this.col, id || novoId()); }
    async add(obj){ const d = this.doc(); await d.set(obj); return d; }
    async get(){
      let todos = [], de = 0;
      while (true){
        let q = sb.from('docs').select('id,data').eq('col', this.col);
        for (const [f, op, v] of this.filtros) q = q[OPS[op]]('data->>' + f, v);
        const { data, error } = await q.order('id').range(de, de + 999);
        if (error) throw erroDb(error);
        todos = todos.concat(data); if (data.length < 1000) break; de += 1000;
      }
      const docs = todos.map(r => snapDoc(r.id, r.data));
      return { docs, size: docs.length, empty: !docs.length };
    }
    onSnapshot(next, err){ let vivo = true; const run = () => this.get().then(s => vivo && next(s)).catch(e => err && err(e)); run(); const off = ouvir(this.col, run); return () => { vivo = false; off(); }; }
  }
  const partir = p => { const s = p.split('/'); return [s.slice(0, -1).join('/'), s[s.length - 1]]; };
  return { doc: p => { const [c, i] = partir(p); return new Doc(c, i); }, collection: p => new Col(p) };
}
function baixar(nome, blob){
  const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
}
async function baixarBackup(){
  const cols = ['pacientes','planos','cobrancas','agenda','evolucoes','midias','funil','equipe','equipamentos','datas','config','liberados'];
  const out = {};
  for (const c of cols){ try { const s = await db.collection(c).get(); out[c] = {}; s.docs.forEach(d => out[c][d.id] = d.data()); } catch(e){} }
  baixar(`backup-ap-gestao-${today()}.json`, new Blob([JSON.stringify({ formato: 'ap-gestao-backup-1', exportadoEm: today(), colecoes: out }, null, 1)], { type: 'application/json' }));
}
async function importarBackup(file){
  try {
    const j = JSON.parse(await file.text()); const C = j.colecoes || {};
    const rows = []; Object.entries(C).forEach(([col, docs]) => Object.entries(docs).forEach(([id, data]) => rows.push({ col, id, data })));
    if (!rows.length) return toast('O arquivo não tem dados');
    confirmBox(`Importar ${rows.length} registros (${Object.entries(C).map(([c, d]) => c + ': ' + Object.keys(d).length).join(', ')})?`, async () => {
      for (let i = 0; i < rows.length; i += 200){ const { error } = await sb.from('docs').upsert(rows.slice(i, i + 200)); if (error) throw erroDb(error); }
      toast(rows.length + ' registros importados'); setTimeout(() => location.reload(), 800);
    });
  } catch(e){ toast('Arquivo inválido'); }
}

// ---------- utilidades ----------
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl = n => (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pad = n => String(n).padStart(2,'0');
const isoD = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseD = s => { const [y,m,d] = String(s).split('-').map(Number); return new Date(y, m-1, d||1); };
const today = () => isoD(new Date());
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate()+n); return isoD(d); };
const diffDays = (a, b) => Math.round((parseD(a) - parseD(b)) / 86400000);
const fmtD = s => s ? parseD(s).toLocaleDateString('pt-BR') : '';
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const mesNome = m => { const [y,mm] = m.split('-').map(Number); return MESES[mm-1]+' de '+y; };
const curMes = () => today().slice(0,7);
const shiftMes = (m, n) => { const [y,mm] = m.split('-').map(Number); const d = new Date(y, mm-1+n, 1); return d.getFullYear()+'-'+pad(d.getMonth()+1); };
const refAtual = () => shiftMes(curMes(), -1); // cobrança deste mês = sessões do mês anterior
const weekStart = s => { const d = parseD(s); const w = (d.getDay()+6)%7; d.setDate(d.getDate()-w); return isoD(d); };
const DIAS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const noAccent = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'');
const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} } };

function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(()=> t.hidden = true, 2600); }
async function copy(text, okMsg){
  try { await navigator.clipboard.writeText(text); toast(okMsg || 'Copiado'); }
  catch(e){ openMsg('Copie o texto abaixo', text); }
}

// ---------- Pix copia e cola (padrão EMV do Banco Central) ----------
function crc16(str){
  let crc = 0xFFFF;
  for (let i=0;i<str.length;i++){ crc ^= str.charCodeAt(i) << 8; for (let j=0;j<8;j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF; }
  return crc.toString(16).toUpperCase().padStart(4,'0');
}
const tlv = (id, v) => id + String(v.length).padStart(2,'0') + v;
function pixKey(k){
  k = String(k||'').trim();
  if (k.includes('@')) return k.toLowerCase();
  if (k.startsWith('+')) return '+' + k.replace(/\D/g,'');
  if (/^[\d.\-\/\s]+$/.test(k)) return k.replace(/\D/g,'');
  return k;
}
function pixPayload(cfg, valor){
  const key = pixKey(cfg.pixChave); if (!key) return '';
  const name = noAccent(cfg.pixNome || 'AP FISIOTERAPIA').toUpperCase().slice(0,25);
  const city = noAccent(cfg.pixCidade || 'CASCAVEL').toUpperCase().slice(0,15);
  let p = tlv('00','01') + tlv('26', tlv('00','br.gov.bcb.pix') + tlv('01', key)) + tlv('52','0000') + tlv('53','986');
  if (valor > 0) p += tlv('54', Number(valor).toFixed(2));
  p += tlv('58','BR') + tlv('59', name) + tlv('60', city) + tlv('62', tlv('05','***')) + '6304';
  return p + crc16(p);
}

// ---------- estado ----------
const S = { pacientes:{}, planos:{}, cobrancas:{}, agenda:{}, funil:{}, equipe:{}, equipamentos:{}, datas:{}, config:{}, pedidos:{}, liberados:{}, perfis:{}, evolucoes:{}, loaded:{} };
let db = null, isAdmin = false, canWrite = true, modo = 'carregando', minhaFisio = '', myId = null, meuEmail = '', sb = null, pedidoFeito = false, iniciado = false;
const restrito = () => modo === 'agenda';
const MOTIVOS = ['Pedido da família','Paciente internado','Paciente doente ou indisponível','Fisio indisponível','Imprevisto (trânsito, clima)','Outro'];
let tab = null, agWeek = weekStart(today()), agFisio = store.get('ap.fisio') || '', cobMes = refAtual(), pacFiltro = 'ativos', pacBusca = '';
const DEF_CFG = { multa: 2, juros: 1, vencDia: 15, pixNome: 'AP FISIOTERAPIA', pixCidade: 'CASCAVEL', pixChave: '', assinatura: 'Emi · AP Fisioterapia Domiciliar' };
const cfg = () => Object.assign({}, DEF_CFG, S.config);

const ETAPAS = [
  ['indicacao','Indicação / contato recebido'],['contato','1º contato (Ana)'],['fechamento','Fechando pacote (Emi)'],
  ['contrato','Contrato enviado'],['avaliacao_marcada','Avaliação marcada'],['avaliacao_feita','Avaliação feita'],
  ['definir','Ana define quem atende'],['perdido','Não fechou']
];
const STATUS_PAC = {ativo:['Ativo','ok'], internado:['Internado','bad'], pausado:['Pausado','warn'], alta:['Alta / encerrado','mute'], inativo:['Inativo','mute'], verificar:['Conferir cadastro','info']};
const STATUS_AG = {agendado:['Agendado','mute'], feito:['Realizado','ok'], falta:['Falta (cobrada)','bad'], remarcado:['Remarcado','info'], cancelado:['Não aconteceu (sem cobrança)','warn']};

const fisios = () => Object.values(S.equipe).filter(e => e.ativo !== false && e.atende).map(e => e.nome).sort();
const pacAtivos = () => Object.values(S.pacientes).filter(p => p.status === 'ativo' || p.status === 'internado' || p.status === 'verificar');
const pacNome = id => S.pacientes[id]?.nome || '(paciente removido)';

// ---------- cobrança ----------
function cobInfo(c){
  const C = cfg();
  const venc = shiftMes(c.mes, 1) + '-' + pad(c.vencDia || C.vencDia);
  const valor = Math.max(0, (Number(c.valor)||0) - (Number(c.desconto)||0));
  const pago = !!c.pagoEm;
  const t = today();
  const dias = pago ? 0 : Math.max(0, diffDays(t, venc));
  const multa = dias > 0 ? valor * (Number(C.multa)||0)/100 : 0;
  const juros = dias > 0 ? valor * (Number(C.juros)||0)/100/30 * dias : 0;
  const total = Math.round((valor + multa + juros) * 100) / 100;
  let st = pago ? ['Pago','ok'] : dias > 30 ? ['Atrasado +30 dias','bad'] : dias > 0 ? ['Atrasado','bad'] : diffDays(venc, t) <= 5 ? ['Vence em breve','warn'] : ['A receber','mute'];
  if (!pago && S.pacientes[c.pid]?.status === 'internado') st = ['Paciente internado','info'];
  return { venc, valor, pago, dias, multa, juros, total, st };
}
function msgCobranca(c){
  const C = cfg(), i = cobInfo(c), p = S.pacientes[c.pid] || {}, pl = S.planos[c.pid] || {};
  const quem = (pl.pagador || p.responsavel || '').split(' ')[0];
  let m = `Olá${quem ? ', ' + quem : ''}! Tudo bem?\n\n`;
  if (i.dias > 0) {
    m += `O pacote de fisioterapia de ${p.nome || 'paciente'} referente às sessões de ${mesNome(c.mes)} (${brl(i.valor)}) venceu em ${fmtD(i.venc)} e ainda não identificamos o pagamento.\n\n`;
    m += `Com ${i.dias} dia${i.dias>1?'s':''} de atraso, o valor atualizado é ${brl(i.total)} (multa de ${C.multa}% e juros de ${C.juros}% ao mês, conforme o contrato).\n\n`;
    m += `Se já pagou, pode desconsiderar e me mandar o comprovante, por favor.`;
  } else {
    m += `Estou enviando a mensagem referente ao fechamento do mês de ${MESES[Number(c.mes.slice(5))-1]}. O pacote de fisioterapia de ${p.nome || 'paciente'} ficou em ${brl(i.valor)}.\n\nO pagamento pode ser feito entre os dias 10 e ${pad(c.vencDia || C.vencDia)} de ${MESES[Number(shiftMes(c.mes,1).slice(5))-1]}.`;
  }
  const pix = pixPayload(C, i.dias > 0 ? i.total : i.valor);
  if (pix) m += `\n\nPix copia e cola:\n${pix}`;
  m += `\n\nQualquer dúvida, estou à disposição.\n${C.assinatura}`;
  return m;
}
const waLink = (tel, text) => { let d = String(tel||'').replace(/\D/g,''); if (!d) return ''; if (d.length <= 11) d = '55' + d; return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text); };

// ---------- alertas ----------
function alertas(){
  const A = [], t = today();
  if (isAdmin){
    Object.values(S.cobrancas).forEach(c => { const i = cobInfo(c); if (!i.pago && i.dias > 30) A.push(['bad', `${pacNome(c.pid)}: ${i.dias} dias de atraso (sessões de ${mesNome(c.mes)}). Pelo contrato, já pode suspender os atendimentos.`, 'cobranca']); else if (!i.pago && i.dias > 0) A.push(['bad', `${pacNome(c.pid)}: pagamento das sessões de ${mesNome(c.mes)} atrasado há ${i.dias} dia${i.dias>1?'s':''} · ${brl(i.total)}`, 'cobranca']); });
    if (!Object.values(S.cobrancas).some(c => c.mes === refAtual())) A.push(['warn', `As cobranças das sessões de ${mesNome(refAtual())} (pagamento até dia ${cfg().vencDia}) ainda não foram geradas.`, 'cobranca']);
    pacAtivos().forEach(p => {
      if (p.inicio){ const ani = addDays(p.inicio, 0); const d = parseD(p.inicio); const n = new Date(d); n.setFullYear(d.getFullYear() + Math.max(1, new Date().getFullYear() - d.getFullYear())); const prox = isoD(n); const falta = diffDays(prox, t); if (falta >= 0 && falta <= 30) A.push(['warn', `${p.nome}: contrato faz aniversário em ${fmtD(prox)}. Avisar o reajuste anual.`, 'pacientes']); }
      if (S.loaded.planos && p.status === 'ativo' && !S.planos[p._id]?.conferido) A.push(['warn', `${p.nome}: valor do pacote ainda não conferido. Sem isso, a mensagem do fechamento do mês não é enviada.`, 'pacientes']);
    });
  }
  pacAtivos().forEach(p => {
    if (!p.contrato) A.push(['warn', `${p.nome}: contrato ainda não assinado.`, 'pacientes']);
    if (p.status === 'internado') A.push(['info', `${p.nome}: internado${p.statusDesde ? ' desde ' + fmtD(p.statusDesde) : ''}. Sessões desse período não são cobradas.`, 'pacientes']);
    if (p.status === 'verificar') A.push(['info', `${p.nome}: cadastro importado precisa ser conferido.`, 'pacientes']);
  });
  Object.values(S.pedidos||{}).forEach(p => A.push(['bad', `${p.nome} pediu acesso ao app. Libere em Equipe.`, 'equipe']));
  const semPac = Object.values(S.agenda).filter(a => !a.pid && a.tipo !== 'outro' && a.tipo !== 'avaliacao' && a.data >= t && a.data <= addDays(t, 7));
  if (semPac.length) A.push(['info', `${semPac.length} atendimento${semPac.length>1?'s':''} da agenda com paciente a confirmar (${[...new Set(semPac.map(a=>a.pnome))].join(', ')}).`, 'agenda']);
  Object.values(S.equipamentos).forEach(e => { if (e.proxima && e.proxima <= addDays(t, 7)) A.push([e.proxima < t ? 'bad':'warn', `Equipamento "${e.nome}": manutenção ${e.proxima < t ? 'vencida desde' : 'em'} ${fmtD(e.proxima)}.`, 'equipe']); });
  return A;
}

// ---------- abas ----------
const TABS = [
  ['hoje','Hoje', false], ['pacientes','Pacientes', false], ['entrada','Entrada', true],
  ['agenda','Agenda', false], ['cobranca','Cobrança', true], ['equipe','Equipe', false], ['painel','Avisos', true]
];
function renderTabs(){
  const nAlert = alertas().filter(a => a[0]==='bad').length;
  if (modo !== 'total' && modo !== 'agenda'){ $('#tabs').innerHTML = ''; return; }
  $('#tabs').innerHTML = TABS.filter(t => restrito() ? ['hoje','agenda'].includes(t[0]) : (!t[2] || isAdmin)).map(([k,l]) => [k, restrito() && k==='agenda' ? 'Minha semana' : l]).map(([k,l]) => `<button data-tab="${k}" aria-current="${tab===k}">${l}${k==='painel' && nAlert ? `<span class="badge">${nAlert}</span>`:''}</button>`).join('');
}
function render(){
  if (!tab || (restrito() && !['hoje','agenda'].includes(tab))) tab = 'hoje';
  renderTabs();
  if (modo === 'pedido'){ if (!dlgOpen()) $('#view').innerHTML = vPedido(); return; }
  if (modo === 'carregando') return;
  const f = {hoje:vHoje, painel:vPainel, pacientes:vPacientes, entrada:vEntrada, agenda:vAgenda, cobranca:vCobranca, equipe:vEquipe}[tab];
  if (dlgOpen()) return; // não redesenha enquanto um formulário está aberto
  $('#view').innerHTML = f();
}
let rq = 0; const schedule = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(render); };

// ---------- PRIMEIRO ACESSO ----------
function vPedido(){
  const nomes = Object.values(S.equipe).filter(e => e.ativo !== false).map(e => e.nome).sort();
  return `<div class="panel" style="max-width:520px;margin:20px auto;padding:20px;display:flex;flex-direction:column;gap:14px">
    <h1>Primeiro acesso</h1>
    ${pedidoFeito ? `<p>Pedido enviado. Assim que a Emi liberar, esta tela abre a sua agenda sozinha.</p>` : `
    <p class="sub" style="margin:0">Escolha o seu nome e peça o acesso. A Emi ou a Ana liberam do lado delas.</p>
    <label class="form" style="display:flex;flex-direction:column;gap:6px;font-weight:600">Quem é você?
      <select id="pedNome"><option value="">Escolha…</option>${nomes.map(n => `<option>${esc(n)}</option>`).join('')}</select></label>
    <button class="btn pri" data-act="pedir">Pedir acesso</button>`}
  </div>`;
}

// ---------- HOJE ----------
let hojeDia = null;
const agSort = (a,b) => (a.hora||'99').localeCompare(b.hora||'99') || (a.ordem||0) - (b.ordem||0);
function vHoje(){
  const t = today(); const d = hojeDia || t; const wd = parseD(d).getDay();
  const L = Object.values(S.agenda).filter(a => a.data === d && (!restrito() || a.fisio === minhaFisio));
  const f = Object.values(S.datas).find(x => x.data === d || (x.ate && d >= x.data && d <= x.ate));
  const nomes = [...new Set([...fisios(), ...L.map(a => a.fisio || '')])].filter(n => L.some(a => (a.fisio||'') === n));
  const ordemFisio = n => agFisio && n === agFisio ? -1 : 0;
  nomes.sort((a,b) => ordemFisio(a) - ordemFisio(b) || a.localeCompare(b));
  const feitos = L.filter(a => a.status === 'feito').length;
  return `
  <div class="head"><div><h1>${DIAS[wd].replace(/^./,c=>c.toUpperCase())}, ${parseD(d).toLocaleDateString('pt-BR',{day:'numeric',month:'long'})}</h1>
    <p class="sub">${d===t ? 'Hoje' : d < t ? 'Dia que já passou' : 'Próximo dia'} · ${L.filter(a=>a.tipo!=='outro').length} atendimentos${feitos ? ` · ${feitos} realizados` : ''}</p></div><span class="sp"></span>
    <button class="btn sm" data-act="dia" data-n="-1">← Dia anterior</button>${d!==t?'<button class="btn sm" data-act="dia" data-n="0">Hoje</button>':''}<button class="btn sm" data-act="dia" data-n="1">Próximo dia →</button></div>
  ${f ? `<div class="panel" style="margin-bottom:16px"><div class="alert"><span class="dot warn"></span><div>${esc(f.tipo==='ferias'?'Férias coletivas':'Feriado')}${f.desc?': '+esc(f.desc):''}. Sem atendimento.</div></div></div>`:''}
  ${nomes.length ? `<div class="grid g2">${nomes.map(n => { const M = L.filter(a => (a.fisio||'') === n).sort(agSort);
    return `<section><h2>${esc(n || 'Sem fisio definida')} · ${M.filter(a=>a.tipo!=='outro').length}</h2><div class="panel list">${M.map(agRow).join('')}</div></section>`; }).join('')}</div>`
  : `<div class="panel empty">Nenhum atendimento lançado para este dia.${canWrite ? ' Lance pela aba Agenda.' : ''}</div>`}`;
}

// ---------- PAINEL ----------
function vPainel(){
  const t = today(), m = curMes();
  const ativos = Object.values(S.pacientes).filter(p => p.status === 'ativo').length;
  const feitos = Object.values(S.agenda).filter(a => a.data?.startsWith(m) && a.status === 'feito').length;
  const ref = refAtual();
  const cobs = Object.values(S.cobrancas).filter(c => c.mes === ref);
  const recebido = cobs.filter(c => c.pagoEm).reduce((s,c) => s + (Number(c.valorPago) || cobInfo(c).valor), 0);
  const aReceber = cobs.filter(c => !c.pagoEm).reduce((s,c) => s + cobInfo(c).valor, 0);
  const A = alertas();
  const med = {}; Object.values(S.pacientes).forEach(p => { const k = (p.medico||'').trim(); if (k) med[k] = (med[k]||0) + 1; });
  Object.values(S.funil).forEach(f => { const k = (f.medico||'').trim(); if (k && f.etapa !== 'perdido' && !f.pid) med[k] = (med[k]||0) + 1; });
  const medL = Object.entries(med).sort((a,b) => b[1]-a[1]).slice(0,8); const mx = Math.max(1, ...medL.map(x=>x[1]));
  return `
  <div class="head"><div><h1>Avisos e números</h1><p class="sub">Primeiro o que precisa de ação. Números do mês logo abaixo.</p></div></div>
  <section class="panel" style="margin-bottom:20px">
    ${A.length ? A.slice(0,14).map(a => `<div class="alert"><span class="dot ${a[0]}"></span><div style="flex:1;min-width:0">${esc(a[1])}</div><button class="btn sm ghost" data-tab="${a[2]}">Abrir</button></div>`).join('') + (A.length > 14 ? `<div class="note">Mais ${A.length-14} avisos nas outras abas.</div>`:'') : '<div class="empty">Nada pendente agora.</div>'}
  </section>
  <h2>${mesNome(m)}</h2>
  <div class="stats">
    <div class="panel stat"><div class="v">${ativos}</div><div class="l">Pacientes ativos</div></div>
    <div class="panel stat"><div class="v">${feitos}</div><div class="l">Atendimentos realizados</div></div>
    <div class="panel stat"><div class="v">${brl(recebido)}</div><div class="l">Recebido pelas sessões de ${MESES[Number(ref.slice(5))-1]}</div></div>
    <div class="panel stat"><div class="v">${brl(aReceber)}</div><div class="l">Falta receber de ${MESES[Number(ref.slice(5))-1]}</div></div>
  </div>
  <div class="grid g2">
    <section class="panel"><div style="padding:14px 16px 0"><h2>Indicações por médico</h2></div>
      ${medL.length ? `<div class="bars">${medL.map(([k,v]) => `<div class="bar"><span title="${esc(k)}">${esc(k)}</span><div class="track"><div class="fill" style="width:${v/mx*100}%"></div></div><span class="num">${v}</span></div>`).join('')}</div>` : '<div class="empty">Preencha "médico que indicou" nos pacientes para ver este gráfico.</div>'}
    </section>
  </div>`;
}

// ---------- PACIENTES ----------
function vPacientes(){
  let L = Object.values(S.pacientes);
  if (pacFiltro === 'ativos') L = L.filter(p => ['ativo','internado','verificar'].includes(p.status));
  else if (pacFiltro !== 'todos') L = L.filter(p => p.status === pacFiltro);
  if (pacBusca) { const q = noAccent(pacBusca).toLowerCase(); L = L.filter(p => noAccent(p.nome + ' ' + (p.responsavel||'') + ' ' + (p.medico||'')).toLowerCase().includes(q)); }
  L.sort((a,b) => a.nome.localeCompare(b.nome));
  const total = isAdmin ? L.filter(p=>p.status==='ativo').reduce((s,p) => s + (Number(S.planos[p._id]?.valor)||0), 0) : 0;
  return `
  <div class="head"><div><h1>Pacientes</h1><p class="sub">${L.length} na lista${isAdmin ? ` · pacotes ativos somam ${brl(total)} por mês` : ''}</p></div><span class="sp"></span>
    ${canWrite ? '<button class="btn pri" data-act="pac-new">Novo paciente</button>' : ''}</div>
  <div class="filters">
    <select id="pacFiltro">${[['ativos','Ativos, internados e a conferir'],['ativo','Só ativos'],['internado','Internados'],['pausado','Pausados'],['alta','Alta / encerrados'],['inativo','Inativos'],['verificar','A conferir'],['todos','Todos']].map(([k,l]) => `<option value="${k}" ${pacFiltro===k?'selected':''}>${l}</option>`).join('')}</select>
    <input id="pacBusca" type="search" placeholder="Buscar nome, responsável ou médico" value="${esc(pacBusca)}" style="flex:1;min-width:180px">
  </div>
  <section class="panel list">${L.length ? L.map(p => {
    const pl = S.planos[p._id] || {}; const st = STATUS_PAC[p.status] || ['—','mute'];
    return `<div class="row"><div class="main"><div class="name">${esc(p.nome)}</div>
      <div class="meta">${[p.frequencia ? p.frequencia + 'x por semana' : '', p.fisio ? 'atende: ' + esc(p.fisio) : 'sem fisio definida', p.medico ? 'indicação: ' + esc(p.medico) : '', isAdmin && pl.pagador ? 'paga: ' + esc(pl.pagador) : ''].filter(Boolean).join(' · ')}</div></div>
      <div class="acts" style="align-items:center">${p.exclusivo ? '<span class="chip info">Exclusivo Ana</span>':''}${!p.contrato ? '<span class="chip warn">Sem contrato</span>':''}<span class="chip ${st[1]}">${st[0]}</span>
      ${isAdmin && !pl.conferido ? '<span class="chip warn">Conferir valor</span>' : ''}${isAdmin ? `<span class="num" style="min-width:90px;text-align:right">${pl.valor ? brl(pl.valor) : '—'}</span>` : ''}
      <button class="btn sm" data-act="pac-edit" data-id="${p._id}">${canWrite ? 'Abrir' : 'Ver'}</button></div></div>`; }).join('')
    : `<div class="empty">${Object.keys(S.pacientes).length ? 'Nenhum paciente com esse filtro.' : 'Nenhum paciente cadastrado ainda. Use "Novo paciente" para começar.'}</div>`}</section>`;
}
function pacFields(){
  const f = [
    {k:'nome',l:'Nome do paciente',req:1,full:1},
    {k:'responsavel',l:'Responsável (contratante)'},{k:'telefone',l:'WhatsApp do responsável',t:'tel',ph:'(45) 99999-9999'},
    {k:'endereco',l:'Endereço do atendimento',full:1},
    {k:'frequencia',l:'Frequência por semana',t:'select',o:['','2','3','5','7']},
    {k:'fisio',l:'Quem atende',t:'select',o:['', ...fisios()]},
    {k:'status',l:'Situação',t:'select',o:Object.entries(STATUS_PAC).map(([k,v])=>[k,v[0]])},
    {k:'statusDesde',l:'Situação desde',t:'date'},
    {k:'medico',l:'Médico que indicou'},{k:'inicio',l:'Início do contrato',t:'date'},
    {k:'emergencia',l:'Contato de emergência',full:1},
    {k:'imagem',l:'Uso de imagem',t:'select',o:[['pendente','Pendente'],['autorizado','Autorizado'],['nao','Não autorizado']]},
    {k:'contrato',l:'Contrato assinado',t:'check'},{k:'exclusivo',l:'Atendimento exclusivo da Ana',t:'check'},
    {k:'obs',l:'Observações da família e do caso (sem dados clínicos detalhados)',t:'textarea',full:1}
  ];
  if (isAdmin) f.push({sec:'Pacote e cobrança (só Emi e Ana veem)'},
    {k:'pl_valor',l:'Valor mensal (R$)',t:'number'},{k:'pl_pagador',l:'Quem paga (nome no Pix/boleto)'},
    {k:'pl_forma',l:'Forma de pagamento',t:'select',o:['Pix','Boleto','Transferência','Home care / convênio']},{k:'pl_vencDia',l:'Pagar até o dia',t:'number'},
    {k:'pl_conferido',l:'Conferi o valor deste paciente (libera o envio automático da cobrança)',t:'check',full:1});
  return f;
}
function pacForm(id){
  const p = id ? S.pacientes[id] : {status:'ativo',imagem:'pendente'}; const pl = id ? (S.planos[id]||{}) : {};
  const v = Object.assign({}, p, {pl_valor:pl.valor, pl_pagador:pl.pagador, pl_forma:pl.forma||'Pix', pl_vencDia:pl.vencDia||cfg().vencDia, pl_conferido: !!pl.conferido});
  openForm(id ? p.nome : 'Novo paciente', pacFields(), v, async (d) => {
    const pid = id || db.collection('pacientes').doc().id;
    const pd = {}; const pld = {};
    Object.entries(d).forEach(([k,x]) => k.startsWith('pl_') ? pld[k.slice(3)] = x : pd[k] = x);
    await db.doc('pacientes/'+pid).set(Object.assign({}, id ? stripId(S.pacientes[id]) : {criado: today()}, pd));
    if (isAdmin) await db.doc('planos/'+pid).set(pld);
    return pid;
  }, id && canWrite ? [[p.status === 'inativo' ? 'Reativar paciente' : 'Inativar paciente', 'pac-inat', id], ['Excluir','pac-del',id]] : []);
  if (id) mostrarHistorico(id);
}
const stripId = o => { const c = Object.assign({}, o); delete c._id; return c; };

// ---------- ENTRADA (funil) ----------
function vEntrada(){
  const L = Object.values(S.funil).filter(f => !f.pid);
  return `
  <div class="head"><div><h1>Entrada de pacientes</h1><p class="sub">Do primeiro contato até a Ana definir quem atende. Contatos que vêm do Google entram na primeira coluna com a etiqueta "Google".</p></div><span class="sp"></span>
  <button class="btn pri" data-act="fun-new">Novo contato</button></div>
  <div class="kanban">${ETAPAS.map(([k,l]) => { const C = L.filter(f => (f.etapa||'indicacao') === k).sort((a,b)=>(a.data||'').localeCompare(b.data||''));
    return `<div class="col"><h4><span>${l}</span><span>${C.length}</span></h4>${C.map(f => `<div class="card">
      <div class="name">${esc(f.nome)}</div>
      <div class="meta" style="font-size:13px;color:var(--muted)">${[f.origem==='google'?'<span class="chip info">Google</span>':f.origem==='medico'?'<span class="chip">Indicação médica</span>':'<span class="chip mute">Outro</span>', f.medico?esc(f.medico):'', f.data?fmtD(f.data):''].filter(Boolean).join(' ')}</div>
      ${f.obs ? `<div style="font-size:13px">${esc(f.obs)}</div>`:''}
      <div class="acts" style="display:flex;gap:6px;flex-wrap:wrap">
        ${k==='definir' ? `<button class="btn sm pri" data-act="fun-conv" data-id="${f._id}">Virar paciente</button>` : k!=='perdido' ? `<button class="btn sm pri" data-act="fun-next" data-id="${f._id}">Avançar</button>`:''}
        <button class="btn sm" data-act="fun-edit" data-id="${f._id}">Editar</button></div></div>`).join('') || '<div style="font-size:13px;color:var(--muted);padding:6px 2px">Vazio</div>'}</div>`; }).join('')}</div>`;
}
const funFields = () => [
  {k:'nome',l:'Nome do paciente',req:1,full:1},{k:'contato',l:'Nome de quem entrou em contato'},{k:'telefone',l:'WhatsApp',t:'tel'},
  {k:'origem',l:'Origem',t:'select',o:[['medico','Indicação médica'],['google','Google'],['outro','Outro']]},{k:'medico',l:'Médico que indicou'},
  {k:'etapa',l:'Etapa',t:'select',o:ETAPAS},{k:'data',l:'Data do contato',t:'date'},
  {k:'valor',l:'Valor proposto (R$)',t:'number'},{k:'frequencia',l:'Frequência',t:'select',o:['','2','3','5','7']},
  {k:'obs',l:'Observações',t:'textarea',full:1}];

// ---------- AGENDA ----------
function agRow(a){
  const st = STATUS_AG[a.status||'agendado'];
  const p = S.pacientes[a.pid];
  const outro = a.tipo === 'outro', conf = !a.pid && !outro && a.tipo !== 'avaliacao';
  return `<div class="row"><span class="num" style="width:48px">${esc(a.hora||'')}</span><div class="main"><div class="name">${esc(p?.nome || a.pnome || '?')}</div>
    <div class="meta">${esc(a.fisio||'sem fisio')}${a.obs ? ' · '+esc(a.obs) : ''}${p?.status==='internado' ? ' · <b>paciente internado</b>':''}</div></div>
    <div class="acts" style="align-items:center">${conf ? '<span class="chip info">Confirmar paciente</span>' : ''}${outro ? '<span class="chip mute">Compromisso</span>' : `<span class="chip ${st[1]}">${st[0]}</span>`}
    ${canWrite && !outro ? `${(a.status||'agendado')==='agendado' ? `<button class="btn sm" data-act="ag-feito" data-id="${a._id}">Realizado</button><button class="btn sm" data-act="ag-rem" data-id="${a._id}">Não aconteceu / remarcar</button>` : `<button class="btn sm ghost" data-act="ag-undo" data-id="${a._id}">Desfazer</button>`}` : ''}
    ${canWrite && !outro && (a.pid || a.pnome) ? `<button class="btn sm ${S.evolucoes[a._id] ? 'ghost' : ''}" data-act="evo" data-id="${a._id}">${S.evolucoes[a._id] ? 'Ver evolução' : 'Evoluir'}</button>` : ''}
    ${canWrite && !restrito() ? `<button class="btn sm ghost" data-act="ag-edit" data-id="${a._id}">Editar</button>` : ''}</div></div>`;
}
function vAgenda(){
  const days = [...Array(7)].map((_,i) => addDays(agWeek, i)); const t = today();
  if (restrito()) agFisio = minhaFisio;
  const all = Object.values(S.agenda).filter(a => a.data >= agWeek && a.data <= days[6] && (!agFisio || a.fisio === agFisio));
  const datas = Object.values(S.datas);
  const fer = d => datas.find(x => x.data === d || (x.ate && d >= x.data && d <= x.ate));
  const prev = Object.values(S.agenda).filter(a => a.data >= addDays(agWeek,-7) && a.data < agWeek).length;
  return `
  <div class="head"><div><h1>Agenda</h1><p class="sub">Semana de ${fmtD(agWeek)} a ${fmtD(days[6])} · ${all.length} atendimentos${agFisio ? ' de ' + esc(agFisio) : ''}</p></div><span class="sp"></span>
    ${canWrite && !restrito() ? `<button class="btn" data-act="ag-copy" ${prev ? '' : 'disabled'} title="Copia os horários da semana anterior para esta">Repetir semana anterior</button><button class="btn pri" data-act="ag-new">Novo atendimento</button>`:''}</div>
  <div class="filters">
    <button class="btn sm" data-act="wk" data-n="-7">← Semana anterior</button><button class="btn sm" data-act="wk" data-n="0">Esta semana</button><button class="btn sm" data-act="wk" data-n="7">Próxima →</button>
    ${restrito() ? '' : `<select id="agFisio"><option value="">Todas as fisios</option>${fisios().map(f => `<option ${agFisio===f?'selected':''}>${esc(f)}</option>`).join('')}</select>`}
    ${isAdmin ? '<button class="btn sm ghost" data-act="data-new">+ Feriado ou férias</button>':''}
  </div>
  <p class="sub" style="margin:-4px 0 14px">Regras do contrato: remarcar com 6 horas de antecedência; sem aviso, a sessão é cobrada. Feriado não tem atendimento nem reposição. Internação comunicada não é cobrada.</p>
  ${days.map(d => { const L = all.filter(a => a.data === d).sort((a,b) => (a.fisio||'').localeCompare(b.fisio||'') || agSort(a,b)); const f = fer(d); const wd = parseD(d).getDay();
    if (!L.length && !f && (wd === 0)) return '';
    return `<div class="day ${d===t?'today':''}"><h3>${DIAS[wd]}, ${fmtD(d)} ${d===t?'<span class="chip">Hoje</span>':''} ${f ? `<span class="chip warn">${esc(f.tipo==='ferias'?'Férias coletivas':'Feriado')}: ${esc(f.desc||'')}</span>${isAdmin?`<button class="btn sm ghost" data-act="data-del" data-id="${f._id}">remover</button>`:''}`:''}</h3>
    <div class="panel list">${L.length ? L.map(agRow).join('') : `<div class="empty" style="padding:14px">${f ? 'Sem atendimento.' : 'Nenhum atendimento.'}</div>`}</div></div>`; }).join('')}`;
}
function agFields(){
  return [
    {k:'tipo',l:'Tipo',t:'select',o:[['atendimento','Atendimento'],['avaliacao','Avaliação'],['outro','Compromisso (reunião, outro)']]},
    {k:'pid',l:'Paciente',t:'select',o:[['','Escolha…'], ...pacAtivos().sort((a,b)=>a.nome.localeCompare(b.nome)).map(p=>[p._id,p.nome])]},
    {k:'pnome',l:'Ou nome escrito (paciente fora da lista, compromisso)',full:1},
    {k:'data',l:'Data',t:'date',req:1},{k:'hora',l:'Horário',t:'time'},
    {k:'fisio',l:'Fisioterapeuta',t:'select',o:['', ...fisios()]},
    {k:'status',l:'Situação',t:'select',o:Object.entries(STATUS_AG).map(([k,v])=>[k,v[0]])},
    {k:'obs',l:'Observação (ex.: remarcado a pedido da família)',full:1}];
}
function agForm(id){
  const a = id ? S.agenda[id] : {tipo:'atendimento', data: agWeek > today() ? agWeek : today(), status:'agendado', fisio: agFisio};
  openForm(id ? 'Atendimento' : 'Novo atendimento', agFields(), a, async d => {
    if (!d.pid && !d.pnome) throw {code:'Escolha o paciente ou escreva um nome'};
    if (!d.fisio && d.pid) d.fisio = S.pacientes[d.pid]?.fisio || '';
    if (d.pid) d.pnome = S.pacientes[d.pid]?.nome || d.pnome;
    const ref = id ? db.doc('agenda/'+id) : db.collection('agenda').doc();
    await ref.set(Object.assign({ordem: id ? (S.agenda[id].ordem||0) : 99}, d));
  }, id ? [['Remarcar','ag-rem',id],['Excluir','ag-del',id]] : []);
}

// ---------- COBRANÇA ----------
function vCobranca(){
  const L = Object.values(S.cobrancas).filter(c => c.mes === cobMes).sort((a,b) => { const x=cobInfo(a), y=cobInfo(b); return (x.pago-y.pago) || (y.dias-x.dias) || pacNome(a.pid).localeCompare(pacNome(b.pid)); });
  const I = L.map(cobInfo);
  const prev = I.reduce((s,i)=>s+i.valor,0), rec = L.filter(c=>c.pagoEm).reduce((s,c)=>s+(Number(c.valorPago)||cobInfo(c).valor),0);
  const atr = I.filter(i=>!i.pago && i.dias>0);
  const faltam = pacAtivos().filter(p => Number(S.planos[p._id]?.valor) > 0 && S.planos[p._id]?.conferido && !S.cobrancas[p._id+'_'+cobMes]).length;
  const C = cfg();
  return `
  <div class="head"><div><h1>Cobrança</h1><p class="sub">Cada cobrança se refere às sessões de um mês e é paga entre os dias 10 e ${C.vencDia} do mês seguinte. Atraso: multa de ${C.multa}% e juros de ${C.juros}% ao mês (calculados por dia). Mais de 30 dias: o contrato permite suspender.</p></div></div>
  <div class="filters"><label for="cobMes" style="font-weight:600">Sessões de</label><input type="month" id="cobMes" value="${cobMes}"><span class="sub" style="margin:0">pagamento até ${pad(C.vencDia)}/${shiftMes(cobMes,1).slice(5)}/${shiftMes(cobMes,1).slice(0,4)}</span>
    ${faltam ? `<button class="btn pri" data-act="cob-gen">Gerar ${faltam} cobrança${faltam>1?'s':''} das sessões de ${mesNome(cobMes)}</button>` : ''}
    <button class="btn" data-act="cob-new">Cobrança avulsa</button>
    <button class="btn" data-act="cob-contador" ${L.some(c=>c.pagoEm)?'':'disabled'}>Lista para o contador</button></div>
  <div class="stats">
    <div class="panel stat"><div class="v">${brl(prev)}</div><div class="l">Previsto no mês</div></div>
    <div class="panel stat"><div class="v" style="color:var(--ok)">${brl(rec)}</div><div class="l">Recebido · ${L.filter(c=>c.pagoEm).length} de ${L.length}</div></div>
    <div class="panel stat"><div class="v" style="color:${atr.length?'var(--bad)':'inherit'}">${atr.length}</div><div class="l">Em atraso · ${brl(atr.reduce((s,i)=>s+i.total,0))} atualizado</div></div>
  </div>
  ${!C.pixChave ? `<div class="panel" style="margin-bottom:16px"><div class="alert"><span class="dot warn"></span><div>Cadastre a chave Pix da AP em "Dados de cobrança" (fim da página) para a mensagem sair com o Pix copia e cola.</div></div></div>`:''}
  <section class="panel list" style="margin-bottom:20px">${L.length ? L.map((c,ix) => { const i = I[ix]; const p = S.pacientes[c.pid]||{}; const pl = S.planos[c.pid]||{};
    const tel = p.telefone || '';
    return `<div class="row"><div class="main"><div class="name">${esc(pacNome(c.pid))}</div>
      <div class="meta">${pl.pagador ? 'paga: '+esc(pl.pagador)+' · ' : ''}${i.pago ? 'pago em '+fmtD(c.pagoEm)+(c.valorPago && Number(c.valorPago)!==i.valor ? ' · '+brl(c.valorPago):'') : 'até '+fmtD(i.venc)}${c.desconto ? ' · desconto '+brl(c.desconto):''}${c.msgEnviadaEm ? ' · mensagem enviada em '+fmtD(c.msgEnviadaEm.slice(0,10)) : ''}${c.msgErro ? ' · não enviada: '+esc(c.msgErro) : ''}${c.obs ? ' · '+esc(c.obs):''}</div></div>
      <div class="acts" style="align-items:center"><span class="chip ${i.st[1]}">${i.st[0]}${!i.pago && i.dias>0 ? ' · '+i.dias+'d':''}</span>
      <span class="num" style="min-width:96px;text-align:right">${brl(i.pago ? (c.valorPago||i.valor) : i.total)}</span>
      ${!i.pago ? `${tel ? `<a class="btn sm" href="${esc(waLink(tel, msgCobranca(c)))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<button class="btn sm" data-act="cob-msg" data-id="${c._id}">Mensagem${C.pixChave?' + Pix':''}</button><button class="btn sm pri" data-act="cob-pay" data-id="${c._id}">Marcar pago</button>` : ''}
      <button class="btn sm ghost" data-act="cob-edit" data-id="${c._id}">Editar</button></div></div>`; }).join('')
    : `<div class="empty">Nenhuma cobrança das sessões de ${mesNome(cobMes)}. ${faltam ? 'Use "Gerar cobranças" para criar uma por paciente ativo, com o valor do pacote.' : 'Cadastre o valor do pacote nos pacientes para gerar as cobranças.'}</div>`}
    <div class="note">O app não confere o banco sozinho: quando o Pix cair, alguém marca "Pago". Correção pelo IPCA não entra no cálculo.</div></section>
  <section class="panel"><details class="cfg"><summary>Dados de cobrança (chave Pix, multa, juros)</summary>
    <form class="form" id="cfgForm" style="padding:0 16px 16px">
      <label class="full">Chave Pix da AP<input id="c_pixChave" value="${esc(C.pixChave)}" placeholder="CNPJ, e-mail, telefone com +55 ou chave aleatória"></label>
      <label>Nome do recebedor (até 25 letras)<input id="c_pixNome" value="${esc(C.pixNome)}" maxlength="25"></label>
      <label>Cidade (até 15 letras)<input id="c_pixCidade" value="${esc(C.pixCidade)}" maxlength="15"></label>
      <label>Multa por atraso (%)<input id="c_multa" type="number" step="0.1" value="${esc(C.multa)}"></label>
      <label>Juros ao mês (%)<input id="c_juros" type="number" step="0.1" value="${esc(C.juros)}"></label>
      <label>Pagar até o dia<input id="c_vencDia" type="number" min="1" max="28" value="${esc(C.vencDia)}"></label>
      <label>Assinatura da mensagem<input id="c_assinatura" value="${esc(C.assinatura)}"></label>
      <div class="full" style="grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn pri" type="submit">Salvar dados</button>
      ${C.pixChave ? `<button class="btn" type="button" data-act="pix-test">Copiar Pix de teste (R$ 1,00)</button><span class="sub" style="margin:0">Teste no app do banco antes de mandar para as famílias.</span>`:''}</div>
    </form></details></section>`;
}
function cobForm(id){
  const c = id ? S.cobrancas[id] : {mes: cobMes, vencDia: cfg().vencDia};
  openForm(id ? 'Cobrança · ' + pacNome(c.pid) : 'Cobrança avulsa', [
    {k:'pid',l:'Paciente',t:'select',o:[['','Escolha…'], ...Object.values(S.pacientes).sort((a,b)=>a.nome.localeCompare(b.nome)).map(p=>[p._id,p.nome])],req:1,full:1,dis:!!id},
    {k:'mes',l:'Mês das sessões',t:'month',req:1,dis:!!id},{k:'valor',l:'Valor do pacote (R$)',t:'number',req:1},
    {k:'desconto',l:'Desconto (R$) · internação, férias',t:'number'},{k:'vencDia',l:'Pagar até o dia',t:'number'},
    {k:'pagoEm',l:'Pago em',t:'date'},{k:'valorPago',l:'Valor recebido (R$)',t:'number'},
    {k:'obs',l:'Observação',full:1}], c, async d => {
      const pid = id ? c.pid : d.pid, mes = id ? c.mes : d.mes;
      await db.doc('cobrancas/'+pid+'_'+mes).set(Object.assign({}, d, {pid, mes}));
    }, id ? [['Excluir','cob-del',id]] : []);
}

// ---------- EQUIPE ----------
function vEquipe(){
  const E = Object.values(S.equipe).sort((a,b)=>a.nome.localeCompare(b.nome));
  const wk = weekStart(today()), we = addDays(wk,6);
  const Q = Object.values(S.equipamentos).sort((a,b)=>(a.proxima||'9').localeCompare(b.proxima||'9'));
  const t = today();
  return `
  <div class="head"><div><h1>Equipe e equipamentos</h1><p class="sub">Quem atende quem, quem tem acesso ao app e onde está cada equipamento.</p></div></div>
  ${isAdmin ? vAcessos() : ''}
  <div class="grid g2">
  <section><div class="head" style="margin-bottom:8px"><h2 style="margin:0">Equipe</h2><span class="sp"></span>${isAdmin?'<button class="btn sm" data-act="eq-new">Adicionar pessoa</button>':''}</div>
    <div class="panel list">${E.length ? E.map(e => { const pc = pacAtivos().filter(p=>p.fisio===e.nome); const sem = Object.values(S.agenda).filter(a=>a.fisio===e.nome && a.data>=wk && a.data<=we).length;
      return `<div class="row"><div class="main"><div class="name">${esc(e.nome)} ${e.ativo===false?'<span class="chip mute">Inativa</span>':''}</div>
      <div class="meta">${esc(e.funcao||'')}${e.atende ? ` · ${pc.length} paciente${pc.length!==1?'s':''} · ${sem} atendimento${sem!==1?'s':''} nesta semana` : ''}</div>
      ${e.atende && pc.length ? `<div class="meta" style="margin-top:4px">${pc.map(p=>esc(p.nome)).join(', ')}</div>`:''}</div>
      ${isAdmin?`<button class="btn sm ghost" data-act="eq-edit" data-id="${e._id}">Editar</button>`:''}</div>`; }).join('') : '<div class="empty">Cadastre a equipe para escolher quem atende cada paciente.</div>'}</div></section>
  <section><div class="head" style="margin-bottom:8px"><h2 style="margin:0">Equipamentos</h2><span class="sp"></span>${canWrite?'<button class="btn sm" data-act="eqp-new">Adicionar equipamento</button>':''}</div>
    <div class="panel list">${Q.length ? Q.map(q => `<div class="row"><div class="main"><div class="name">${esc(q.nome)}</div>
      <div class="meta">${[q.local ? 'está com: '+esc(q.local) : '', q.ultima ? 'última manutenção '+fmtD(q.ultima):''].filter(Boolean).join(' · ')}${q.obs?' · '+esc(q.obs):''}</div></div>
      <div class="acts" style="align-items:center">${q.proxima ? `<span class="chip ${q.proxima<t?'bad':q.proxima<=addDays(t,30)?'warn':'mute'}">Manutenção ${fmtD(q.proxima)}</span>`:''}${canWrite?`<button class="btn sm ghost" data-act="eqp-edit" data-id="${q._id}">Editar</button>`:''}</div></div>`).join('') : '<div class="empty">Liste os equipamentos, onde estão e quando precisam de manutenção.</div>'}</div></section>
  </div>`;
}

function vAcessos(){
  const P = Object.values(S.pedidos||{}), L = Object.values(S.liberados||{}), pf = id => (S.pedidos||{})[id]?.email || (S.liberados||{})[id]?.email || 'e-mail não informado';
  return `<section style="margin-bottom:20px"><h2>Acesso ao app</h2><div class="panel list">
    ${P.map(p => `<div class="row"><div class="main"><div class="name">${esc(p.nome)} pediu acesso</div><div class="meta">Conta: ${esc(pf(p._id))} · ${fmtD((p.quando||'').slice(0,10))}</div></div>
      <div class="acts"><button class="btn sm pri" data-act="lib-agenda" data-id="${p._id}">Liberar só a agenda de ${esc(p.nome)}</button><button class="btn sm" data-act="lib-total" data-id="${p._id}">Liberar tudo</button><button class="btn sm ghost" data-act="lib-recusar" data-id="${p._id}">Recusar</button></div></div>`).join('')}
    ${L.map(l => `<div class="row"><div class="main"><div class="name">${esc(l.fisio)}</div><div class="meta">Conta: ${esc(pf(l._id))} · ${l.nivel==='total' ? 'acesso a tudo' : 'só a própria agenda'}</div></div>
      <div class="acts"><button class="btn sm ghost" data-act="lib-remover" data-id="${l._id}">Remover acesso</button></div></div>`).join('')}
    ${!P.length && !L.length ? '<div class="empty">Ninguém além de você entrou ainda. Quando a Camila abrir o app pela primeira vez, o pedido dela aparece aqui.</div>' : ''}
  </div></section>
  <section style="margin-bottom:20px"><h2>Cópia de segurança</h2><div class="panel list">
    <div class="row"><div class="main"><div class="name">Baixar todos os dados</div><div class="meta">Arquivo .json com pacientes, valores, cobranças, agenda e evoluções em texto. Fotos e áudios ficam no banco.</div></div><div class="acts"><button class="btn sm" data-act="backup-baixar">Baixar</button></div></div>
    <div class="row"><div class="main"><div class="name">Importar dados de um arquivo</div><div class="meta">Use para trazer o backup do app antigo. Registros com o mesmo código são substituídos.</div></div><div class="acts"><label class="btn sm" for="bkArq">Escolher arquivo</label><input id="bkArq" type="file" accept="application/json,.json" hidden></div></div>
  </div></section>`;
}

// ---------- EVOLUÇÃO ----------
let evoAg = null;
function evoForm(agId){
  const a = S.agenda[agId]; evoAg = agId; const e = S.evolucoes[agId];
  const nome = S.pacientes[a.pid]?.nome || a.pnome || '';
  const d = $('#dlg');
  d.innerHTML = `<div class="dlg"><h2>Evolução · ${esc(nome)}</h2>
    <p class="sub" style="margin:0">${fmtD(a.data)} · ${esc(a.fisio||'')}${e ? ` · salva por ${esc(e.fisio||'')} em ${fmtD((e.criadoEm||'').slice(0,10))}` : ''}</p>
    ${e ? '' : `<p class="sub" style="margin:0">Grave um áudio, tire fotos ou escreva. O texto é opcional.</p>`}
    <textarea id="evoTxt" style="min-height:140px" placeholder="Texto opcional. Ex.: paciente acordado, saturação 94 em ar ambiente, fez ciclo ativo, tosse assistida com secreção clara...">${esc(e?.texto || '')}</textarea>
    <div class="midbar">
      <label class="btn" for="evoFoto">Tirar foto</label><input id="evoFoto" type="file" accept="image/*" capture="environment" hidden>
      <span id="recBox"><button class="btn" type="button" data-act="rec-start">Gravar áudio</button></span>
      <label class="btn ghost" for="evoArq">Anexar foto ou áudio do celular</label><input id="evoArq" type="file" accept="image/*,audio/*" hidden>
    </div>
    <div id="evoMidias" class="midias"><p class="sub" style="margin:0">Carregando anexos…</p></div>
    <p class="sub" id="evoMsg" style="margin:0" hidden></p>
    <div id="evoHist"></div>
    <div class="foot"><span class="sp"></span>
      <button class="btn" data-act="close">Fechar</button><button class="btn pri" data-act="evo-save" data-id="${agId}">${e ? 'Salvar alteração' : 'Salvar evolução'}</button></div></div>`;
  d.showModal();
  if (a.pid) carregarHist(a.pid, agId);
  carregarMidias(agId);
}
async function carregarHist(pid, skip){
  try {
    const s = await db.collection('evolucoes').where('pid','==',pid).get();
    const L = s.docs.map(x => Object.assign({_id:x.id}, x.data())).filter(x => x._id !== skip).sort((a,b) => (b.data||'').localeCompare(a.data||'')).slice(0, 5);
    const box = $('#evoHist') || $('#pacHist'); if (!box) return;
    box.innerHTML = L.length ? `<div class="sec" style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);font-weight:700;margin:6px 0">Últimas evoluções</div>` + L.map(x => `<div style="border-top:1px solid var(--line);padding:8px 0;font-size:14px"><b>${fmtD(x.data)}</b> · ${esc(x.fisio||'')}<div style="white-space:pre-wrap;margin-top:4px">${esc(x.texto||'')}</div>${x.nFotos || x.nAudios ? `<div class="meta" style="margin-top:4px">${[x.nFotos ? x.nFotos+' foto'+(x.nFotos>1?'s':'') : '', x.nAudios ? x.nAudios+' áudio'+(x.nAudios>1?'s':'') : ''].filter(Boolean).join(' · ')} · <button class="btn sm ghost" data-act="evo-midias" data-id="${x._id}">Ver anexos</button></div>` : ''}<div id="hm-${x._id}" class="midias"></div></div>`).join('') : (box.id === 'pacHist' ? '<p class="sub">Nenhuma evolução registrada ainda.</p>' : '');
  } catch(e){}
}
function mostrarHistorico(pid){
  const foot = document.querySelector('#frm .foot'); if (!foot) return;
  const div = document.createElement('div'); div.id = 'pacHist'; div.innerHTML = '<p class="sub">Carregando evoluções…</p>';
  foot.parentNode.insertBefore(div, foot); carregarHist(pid, null);
}
async function evoSave(agId){
  const a = S.agenda[agId], txt = $('#evoTxt').value.trim(), msg = $('#evoMsg');
  const M = midiasAtuais.filter(m => m.evoId === agId);
  if (!txt && !M.length){ msg.hidden = false; msg.textContent = 'Escreva, grave um áudio ou tire uma foto antes de salvar.'; return; }
  const prev = S.evolucoes[agId];
  try {
    await db.doc('evolucoes/'+agId).set({pid:a.pid||'', pnome: S.pacientes[a.pid]?.nome || a.pnome || '', data:a.data, fisio:a.fisio||minhaFisio||'', texto:txt, nFotos: M.filter(m=>m.tipo==='foto').length, nAudios: M.filter(m=>m.tipo==='audio').length, criadoEm: prev?.criadoEm || new Date().toISOString(), alteradoEm: prev ? new Date().toISOString() : ''});
    if ((a.status||'agendado') === 'agendado') await db.doc('agenda/'+agId).update({status:'feito'});
    $('#dlg').close(); toast('Evolução salva'); schedule();
  } catch(e){ msg.hidden = false; msg.textContent = 'Não foi possível salvar (' + (e?.code||'erro') + '). Copie o texto antes de fechar.'; }
}

// ---------- FOTOS E ÁUDIOS DA EVOLUÇÃO ----------
// Arquivos guardados no Storage do Supabase (pasta privada "midias"); o registro fica na coleção "midias".
const MAX_BYTES = 25 * 1024 * 1024;
let midiasAtuais = [], gravador = null, gravPartes = [], gravInicio = 0, gravTimer = null, gravStream = null;
const urlsMidia = {};
async function comprimirFoto(file){
  try {
    const url = URL.createObjectURL(file); const img = new Image();
    await new Promise((ok, erro) => { img.onload = ok; img.onerror = erro; img.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    return await new Promise(ok => c.toBlob(b => ok(b || file), 'image/jpeg', 0.8));
  } catch(e){ return file; }
}
const extDe = t => t.includes('jpeg') ? 'jpg' : t.includes('png') ? 'png' : t.includes('webm') ? 'webm' : t.includes('ogg') ? 'ogg' : t.includes('mpeg') ? 'mp3' : t.includes('mp4') || t.includes('m4a') || t.includes('aac') ? 'm4a' : 'bin';
async function salvarMidia(file){
  const msg = $('#evoMsg'); const a = S.agenda[evoAg]; if (!file || !a) return;
  const tipo = (file.type || '').startsWith('image/') ? 'foto' : 'audio';
  msg.hidden = false; msg.textContent = tipo === 'foto' ? 'Salvando a foto…' : 'Salvando o áudio…';
  try {
    const blob = tipo === 'foto' ? await comprimirFoto(file) : file;
    if (blob.size > MAX_BYTES){ msg.textContent = 'Arquivo grande demais (máximo 25 MB).'; return; }
    const mime = blob.type || (tipo === 'foto' ? 'image/jpeg' : 'audio/mp4');
    const mid = novoId(); const path = `${evoAg}/${mid}.${extDe(mime)}`;
    const up = await sb.storage.from('midias').upload(path, blob, { contentType: mime, upsert: false });
    if (up.error) throw { code: up.error.message };
    await db.doc('midias/' + mid).set({evoId: evoAg, pid: a.pid||'', data: a.data, fisio: a.fisio||minhaFisio||'', tipo, mime, path, tamanho: blob.size, criadoEm: new Date().toISOString()});
    msg.textContent = (tipo === 'foto' ? 'Foto salva.' : 'Áudio salvo.') + ' Toque em "Salvar evolução" para fechar.';
    carregarMidias(evoAg);
  } catch(e){ msg.textContent = 'Não foi possível salvar (' + (e?.code || 'erro') + '). Tente de novo.'; }
}
async function gravarAudio(){
  const msg = $('#evoMsg'); msg.hidden = false;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){ msg.textContent = 'Este navegador não grava áudio. Use "Anexar foto ou áudio do celular".'; return; }
  try { gravStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch(e){ msg.textContent = 'O microfone não foi liberado. Libere o acesso ao microfone para este site nas configurações do navegador.'; return; }
  const tipos = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  const tipo = tipos.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  gravador = new MediaRecorder(gravStream, tipo ? { mimeType: tipo } : undefined); gravPartes = [];
  gravador.ondataavailable = e => { if (e.data && e.data.size) gravPartes.push(e.data); };
  gravador.onstop = () => {
    clearInterval(gravTimer); gravStream.getTracks().forEach(t => t.stop());
    const mime = (gravador.mimeType || tipo || 'audio/webm').split(';')[0];
    const blob = new Blob(gravPartes, { type: mime }); gravador = null; botaoGravar(false);
    if (blob.size) salvarMidia(blob);
  };
  gravador.start(1000); gravInicio = Date.now(); botaoGravar(true);
  gravTimer = setInterval(() => { const s = Math.floor((Date.now() - gravInicio) / 1000); const el = $('#recTempo'); if (el) el.textContent = Math.floor(s/60) + ':' + pad(s%60); if (s >= 900) pararGravacao(); }, 500);
}
function pararGravacao(){ if (gravador && gravador.state !== 'inactive') gravador.stop(); }
function botaoGravar(on){
  const b = $('#recBox'); if (!b) return;
  b.innerHTML = on ? '<button class="btn rec" type="button" data-act="rec-stop"><span class="recdot"></span> Gravando <span id="recTempo">0:00</span> · Parar</button>'
                   : '<button class="btn" type="button" data-act="rec-start">Gravar áudio</button>';
}
async function urlDaMidia(m){
  if (urlsMidia[m._id]) return urlsMidia[m._id];
  const r = await sb.storage.from('midias').createSignedUrl(m.path, 3600);
  if (r.error) throw r.error;
  return urlsMidia[m._id] = r.data.signedUrl;
}
async function carregarMidias(evoId, alvo){
  const box = alvo || $('#evoMidias'); if (!box) return;
  try {
    const s = await db.collection('midias').where('evoId','==',evoId).get();
    const L = s.docs.map(d => Object.assign({_id: d.id}, d.data())).filter(m => m.path).sort((x,y) => (x.criadoEm||'').localeCompare(y.criadoEm||''));
    if (!alvo) midiasAtuais = L;
    if (!L.length){ box.innerHTML = alvo ? '<p class="sub">Sem anexos.</p>' : ''; return; }
    box.innerHTML = L.map(m => `<div class="midia" id="m-${m._id}"><span class="sub" style="margin:0">Abrindo…</span></div>`).join('');
    for (const m of L){
      const el = document.getElementById('m-' + m._id); if (!el) continue;
      try {
        const u = await urlDaMidia(m);
        el.innerHTML = (m.tipo === 'foto' ? `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Foto da evolução de ${fmtD(m.data)}"></a>` : `<audio controls preload="metadata" src="${esc(u)}"></audio>`)
          + `<div class="meta">${m.tipo === 'foto' ? 'Foto' : 'Áudio'} · ${(m.tamanho/1024/1024).toFixed(1).replace('.',',')} MB${!alvo && canWrite ? ` · <button class="btn sm ghost" data-act="midia-del" data-id="${m._id}">Apagar</button>` : ''}</div>`;
      } catch(e){ el.innerHTML = '<span class="sub">Não consegui abrir este anexo.</span>'; }
    }
  } catch(e){ box.innerHTML = '<p class="sub">Não consegui carregar os anexos.</p>'; }
}
async function apagarMidia(mid){
  const m = midiasAtuais.find(x => x._id === mid); if (!m) return;
  await sb.storage.from('midias').remove([m.path]);
  await db.doc('midias/' + mid).delete();
  delete urlsMidia[mid];
  carregarMidias(evoAg);
}

// ---------- formulário genérico ----------
const dlgOpen = () => $('#dlg').open;
function closeDlg(){ $('#dlg').close(); schedule(); }
function openForm(title, fields, vals, onSave, extra){
  const ro = !canWrite;
  const h = fields.map((f,ix) => {
    if (f.sec) return `<div class="sec">${esc(f.sec)}</div>`;
    const id = 'f_'+f.k, v = vals?.[f.k] ?? '', dis = (ro || f.dis) ? 'disabled' : '';
    let inp;
    if (f.t === 'select') inp = `<select id="${id}" ${dis} ${f.req?'required':''}>${f.o.map(o => { const [k,l] = Array.isArray(o)?o:[o,o||'—']; return `<option value="${esc(k)}" ${String(v)===String(k)?'selected':''}>${esc(l)}</option>`; }).join('')}${v && !f.o.some(o => (Array.isArray(o)?o[0]:o) == v) ? `<option selected value="${esc(v)}">${esc(v)}</option>`:''}</select>`;
    else if (f.t === 'textarea') inp = `<textarea id="${id}" ${dis}>${esc(v)}</textarea>`;
    else if (f.t === 'check') return `<label class="chk"><input type="checkbox" id="${id}" ${v?'checked':''} ${dis}> ${esc(f.l)}</label>`;
    else inp = `<input id="${id}" type="${f.t||'text'}" ${f.t==='number'?'step="0.01"':''} value="${esc(v)}" ${f.ph?`placeholder="${esc(f.ph)}"`:''} ${f.req?'required':''} ${dis}>`;
    return `<label class="${f.full?'full':''}">${esc(f.l)}${inp}</label>`;
  }).join('');
  const d = $('#dlg');
  d.innerHTML = `<form class="dlg" method="dialog" id="frm"><h2>${esc(title)}</h2><div class="form">${h}</div><p class="sub" id="frmErr" hidden style="color:var(--bad)"></p>
    <div class="foot">${(extra||[]).map(([l,a,id]) => `<button type="button" class="btn ${a.endsWith('del')?'ghost':''}" data-act="${a}" data-id="${id}">${l}</button>`).join('')}<span class="sp"></span>
    <button type="button" class="btn" data-act="close">${ro?'Fechar':'Cancelar'}</button>${ro?'':'<button type="submit" class="btn pri">Salvar</button>'}</div></form>`;
  d.showModal();
  $('#frm').onsubmit = async e => {
    e.preventDefault();
    const out = {};
    fields.forEach(f => { if (f.sec) return; const el = $('#f_'+f.k); if (!el || el.disabled) return;
      out[f.k] = f.t==='check' ? el.checked : f.t==='number' ? (el.value===''? null : Number(el.value)) : el.value.trim(); });
    try { await onSave(out); d.close(); toast('Salvo'); schedule(); }
    catch(err){ const m = $('#frmErr'); m.hidden = false; m.textContent = 'Não foi possível salvar (' + (err?.code||'erro') + '). ' + (err?.code==='invalid_argument' ? 'Seu acesso pode ser só de leitura nesta parte.' : 'Tente de novo em alguns segundos.'); }
  };
}
function openMsg(title, text, extraBtns){
  const d = $('#dlg');
  d.innerHTML = `<div class="dlg"><h2>${esc(title)}</h2><pre class="msg" id="msgTxt">${esc(text)}</pre><div class="foot">${extraBtns||''}<span class="sp"></span><button class="btn" data-act="close">Fechar</button><button class="btn pri" data-act="copy-msg">Copiar</button></div></div>`;
  d.showModal();
}
function confirmBox(text, onYes){
  const d = $('#dlg');
  d.innerHTML = `<div class="dlg"><h2>Confirmar</h2><p>${esc(text)}</p><div class="foot"><span class="sp"></span><button class="btn" data-act="close">Cancelar</button><button class="btn pri" id="yes">Confirmar</button></div></div>`;
  if (!d.open) d.showModal();
  $('#yes').onclick = async () => { try { await onYes(); d.close(); schedule(); } catch(e){ toast('Não foi possível: ' + (e?.code||'erro')); } };
}

// ---------- ações ----------
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-tab],[data-act]'); if (!b) return;
  if (b.dataset.tab){ tab = b.dataset.tab; if (dlgOpen()) $('#dlg').close(); schedule(); window.scrollTo(0,0); return; }
  const a = b.dataset.act, id = b.dataset.id;
  if (a === 'close') return closeDlg();
  if (a === 'copy-msg') return copy($('#msgTxt').textContent, 'Mensagem copiada');
  if (!db) return;
  try {
  switch(a){
    case 'pac-new': return pacForm(null);
    case 'pac-edit': return pacForm(id);
    case 'pac-inat': { const p = S.pacientes[id]; const vai = p.status !== 'inativo';
      return confirmBox(vai ? `Inativar ${p.nome}? Ele sai da agenda nova, da cobrança e do envio automático. O histórico fica guardado.` : `Reativar ${p.nome}?`, () => db.doc('pacientes/'+id).update({status: vai ? 'inativo' : 'ativo', statusDesde: today()})); }
    case 'evo': return evoForm(id);
    case 'evo-save': return evoSave(id);
    case 'midia-del': { const ok = b.dataset.ok; if (!ok){ b.dataset.ok = '1'; b.textContent = 'Toque de novo para apagar'; return; } return apagarMidia(id); }
    case 'evo-midias': { b.remove(); return carregarMidias(id, document.getElementById('hm-' + id)); }
    case 'pac-del': return confirmBox(`Excluir ${pacNome(id)}? Prefira mudar a situação para "Alta" se quiser manter o histórico.`, async () => { await db.doc('pacientes/'+id).delete(); if (isAdmin) await db.doc('planos/'+id).delete(); });
    case 'fun-new': return openForm('Novo contato', funFields(), {etapa:'indicacao', origem:'medico', data: today()}, async d => { await db.collection('funil').doc().set(d); });
    case 'fun-edit': return openForm(S.funil[id].nome, funFields(), S.funil[id], async d => { await db.doc('funil/'+id).set(Object.assign(stripId(S.funil[id]), d)); }, [['Excluir','fun-del',id]]);
    case 'fun-del': return confirmBox('Excluir este contato da entrada?', () => db.doc('funil/'+id).delete());
    case 'fun-next': { const f = S.funil[id]; const i = ETAPAS.findIndex(x => x[0] === (f.etapa||'indicacao')); await db.doc('funil/'+id).update({etapa: ETAPAS[Math.min(i+1, 6)][0]}); return; }
    case 'fun-conv': { const f = S.funil[id];
      openForm('Novo paciente', pacFields(), {nome:f.nome, responsavel:f.contato, telefone:f.telefone, medico:f.medico, frequencia:f.frequencia, status:'ativo', imagem:'pendente', inicio: today(), pl_valor:f.valor, pl_forma:'Pix', pl_vencDia: cfg().vencDia}, async d => {
        const pid = db.collection('pacientes').doc().id; const pd = {}, pld = {};
        Object.entries(d).forEach(([k,x]) => k.startsWith('pl_') ? pld[k.slice(3)] = x : pd[k] = x);
        pd.criado = today(); pd.origem = f.origem;
        await db.doc('pacientes/'+pid).set(pd); await db.doc('planos/'+pid).set(pld); await db.doc('funil/'+id).update({pid, etapa:'definir'});
      }); return; }
    case 'wk': agWeek = b.dataset.n === '0' ? weekStart(today()) : addDays(agWeek, Number(b.dataset.n)); return schedule();
    case 'ag-new': return agForm(null);
    case 'ag-edit': return agForm(id);
    case 'ag-feito': await db.doc('agenda/'+id).update({status:'feito'}); return toast('Marcado como realizado');
    case 'ag-del': return confirmBox('Excluir este atendimento da agenda?', () => db.doc('agenda/'+id).delete());
    case 'ag-undo': await db.doc('agenda/'+id).update({status:'agendado'}); return toast('Voltou para agendado');
    case 'ag-rem': { const a0 = S.agenda[id];
      openForm((a0.pnome || pacNome(a0.pid)) + ' · ' + fmtD(a0.data), [
        {k:'motivo',l:'Por que não aconteceu?',t:'select',o:MOTIVOS,full:1},
        {k:'detalhe',l:'Detalhe (opcional)',full:1},
        {k:'aviso',l:'A família avisou com 6 horas ou mais de antecedência?',t:'select',o:[['sim','Sim'],['nao','Não (a sessão é cobrada)'],['na','Não se aplica (fisio ou internação)']],full:1},
        {sec:'Para quando vai a sessão? (deixe em branco se não vai repor)'},
        {k:'data',l:'Nova data',t:'date'},{k:'hora',l:'Novo horário',t:'time'}],
        {motivo:'Pedido da família', aviso:'sim', data:'', hora:a0.hora}, async d => {
        const txt = d.motivo + (d.detalhe ? ': ' + d.detalhe : '');
        let status = d.data ? 'remarcado' : (d.aviso === 'nao' ? 'falta' : 'cancelado');
        let obs = d.data ? `Remarcado para ${fmtD(d.data)}${d.hora?' '+d.hora:''} · ${txt}` : `${txt}${d.aviso==='nao' ? ' · aviso com menos de 6h, sessão cobrada' : ''}`;
        await db.doc('agenda/'+id).update({status, obs, motivo:d.motivo, detalhe:d.detalhe||'', aviso:d.aviso, novaData:d.data||'', novaHora:d.hora||'', alteradoEm:new Date().toISOString()});
        if (d.data) await db.collection('agenda').doc().set({pid:a0.pid||'', pnome:a0.pnome||'', tipo:a0.tipo||'atendimento', ordem:99, fisio:a0.fisio||'', data:d.data, hora:d.hora||'', status:'agendado', obs:'Reposição de '+fmtD(a0.data)});
      }); return; }
    case 'pedir': { const n = $('#pedNome').value; if (!n) return toast('Escolha o seu nome');
      await db.doc('pedidos/'+myId).set({nome:n, email:meuEmail, quando:new Date().toISOString()}); pedidoFeito = true; return schedule(); }
    case 'lib-agenda': case 'lib-total': { const p = S.pedidos[id];
      await db.doc('liberados/'+id).set({nivel: a==='lib-total' ? 'total' : 'agenda', fisio: p.nome, email: p.email||'', em: today()}); await db.doc('pedidos/'+id).delete(); return toast('Acesso liberado'); }
    case 'lib-recusar': return confirmBox('Recusar este pedido?', () => db.doc('pedidos/'+id).delete());
    case 'lib-remover': return confirmBox('Remover o acesso desta pessoa? Ela volta para a tela de pedido.', () => db.doc('liberados/'+id).delete());
    case 'ag-copy': { const src = Object.values(S.agenda).filter(x => x.data >= addDays(agWeek,-7) && x.data < agWeek && x.status !== 'remarcado' && !String(x.obs||'').startsWith('Reposição'));
      const datas = Object.values(S.datas); const ok = src.filter(x => { const nd = addDays(x.data,7); return !datas.some(f => f.data===nd || (f.ate && nd>=f.data && nd<=f.ate)) && !Object.values(S.agenda).some(y => y.pid===x.pid && y.data===nd && y.hora===x.hora); });
      return confirmBox(`Copiar ${ok.length} atendimento${ok.length!==1?'s':''} da semana anterior para esta? Feriados e horários já lançados ficam de fora.`, async () => { for (const x of ok){ await db.collection('agenda').doc().set({pid:x.pid||'', pnome:x.pnome||'', tipo:x.tipo||'atendimento', ordem:x.ordem||0, fisio:x.fisio||'', data:addDays(x.data,7), hora:x.hora||'', status:'agendado', obs:''}); } toast(ok.length+' atendimentos criados'); }); }
    case 'dia': hojeDia = b.dataset.n === '0' ? null : addDays(hojeDia || today(), Number(b.dataset.n)); if (hojeDia === today()) hojeDia = null; return schedule();
    case 'data-new': return openForm('Feriado ou férias', [{k:'tipo',l:'Tipo',t:'select',o:[['feriado','Feriado'],['ferias','Férias coletivas']]},{k:'desc',l:'Descrição'},{k:'data',l:'Data (ou início)',t:'date',req:1},{k:'ate',l:'Até (só para férias)',t:'date'}], {tipo:'feriado'}, d => db.collection('datas').doc().set(d));
    case 'data-del': return confirmBox('Remover esta data?', () => db.doc('datas/'+id).delete());
    case 'cob-gen': { const L = pacAtivos().filter(p => Number(S.planos[p._id]?.valor) > 0 && S.planos[p._id]?.conferido && !S.cobrancas[p._id+'_'+cobMes]);
      return confirmBox(`Criar ${L.length} cobranças de ${mesNome(cobMes)} com o valor do pacote de cada paciente?`, async () => { for (const p of L){ const pl = S.planos[p._id]; await db.doc('cobrancas/'+p._id+'_'+cobMes).set({pid:p._id, mes:cobMes, valor:Number(pl.valor), vencDia: Number(pl.vencDia)||cfg().vencDia, desconto:null, pagoEm:'', valorPago:null, obs: p.status==='internado' ? 'Paciente internado: conferir desconto' : ''}); } toast(L.length + ' cobranças criadas'); }); }
    case 'cob-new': return cobForm(null);
    case 'cob-edit': return cobForm(id);
    case 'cob-del': return confirmBox('Excluir esta cobrança?', () => db.doc('cobrancas/'+id).delete());
    case 'cob-pay': { const c = S.cobrancas[id], i = cobInfo(c);
      return openForm('Pagamento · ' + pacNome(c.pid), [{k:'pagoEm',l:'Data do pagamento',t:'date',req:1},{k:'valorPago',l:'Valor recebido (R$)',t:'number',req:1},{k:'obs',l:'Observação',full:1}], {pagoEm: today(), valorPago: i.total, obs: c.obs}, d => db.doc('cobrancas/'+id).update(d)); }
    case 'cob-msg': { const c = S.cobrancas[id]; const p = S.pacientes[c.pid]||{}; const m = msgCobranca(c); const pix = pixPayload(cfg(), cobInfo(c).dias>0 ? cobInfo(c).total : cobInfo(c).valor);
      return openMsg('Mensagem para ' + (S.planos[c.pid]?.pagador || p.responsavel || pacNome(c.pid)), m, (pix ? `<button class="btn" data-act="copy-pix" data-v="${esc(pix)}">Copiar só o Pix</button>`:'') + (p.telefone ? `<span class="sub" style="margin:0">WhatsApp: ${esc(p.telefone)}</span>` : '<span class="sub" style="margin:0">Sem WhatsApp cadastrado.</span>')); }
    case 'copy-pix': return copy(b.dataset.v, 'Pix copiado');
    case 'pix-test': return copy(pixPayload(cfg(), 1), 'Pix de teste copiado');
    case 'cob-contador': { const L = Object.values(S.cobrancas).filter(c => c.mes === cobMes && c.pagoEm).sort((a,b)=>a.pagoEm.localeCompare(b.pagoEm));
      const tot = L.reduce((s,c)=>s+(Number(c.valorPago)||cobInfo(c).valor),0);
      const txt = `Recebimentos referentes às sessões de ${mesNome(cobMes)} · AP Fisioterapia Domiciliar\n\n` + L.map(c => `${fmtD(c.pagoEm)} · ${S.planos[c.pid]?.pagador || S.pacientes[c.pid]?.responsavel || '-'} · paciente ${pacNome(c.pid)} · ${brl(Number(c.valorPago)||cobInfo(c).valor)}`).join('\n') + `\n\nTotal: ${brl(tot)}`;
      return openMsg('Lista para o contador', txt, '<button class="btn" data-act="csv">Baixar planilha (.csv)</button>'); }
    case 'csv': { const L = Object.values(S.cobrancas).filter(c => c.mes === cobMes && c.pagoEm).sort((a,b)=>a.pagoEm.localeCompare(b.pagoEm));
      const q = s => '"' + String(s??'').replace(/"/g,'""') + '"';
      const csv = '﻿Data;Pagador;Paciente;Valor\n' + L.map(c => [fmtD(c.pagoEm), S.planos[c.pid]?.pagador || S.pacientes[c.pid]?.responsavel || '', pacNome(c.pid), (Number(c.valorPago)||cobInfo(c).valor).toFixed(2).replace('.',',')].map(q).join(';')).join('\n');
      baixar(`recebimentos-${cobMes}.csv`, new Blob([csv], {type:'text/csv;charset=utf-8'})); return; }
    case 'sair': await sb.auth.signOut(); return location.reload();
    case 'lg-criar': return loginAcao('criar');
    case 'lg-esqueci': return loginAcao('esqueci');
    case 'rec-start': return gravarAudio();
    case 'rec-stop': return pararGravacao();
    case 'backup-baixar': return baixarBackup();
    case 'eq-new': case 'eq-edit': return openForm(id ? S.equipe[id].nome : 'Nova pessoa na equipe', [{k:'nome',l:'Nome',req:1,full:1},{k:'funcao',l:'Função',full:1},{k:'telefone',l:'WhatsApp',t:'tel'},{k:'atende',l:'Faz atendimentos (aparece na agenda)',t:'check'},{k:'ativo',l:'Ativa na equipe',t:'check'}], id ? S.equipe[id] : {atende:true, ativo:true}, d => (id ? db.doc('equipe/'+id) : db.collection('equipe').doc()).set(d), id ? [['Excluir','eq-del',id]] : []);
    case 'eq-del': return confirmBox('Excluir esta pessoa da equipe?', () => db.doc('equipe/'+id).delete());
    case 'eqp-new': case 'eqp-edit': return openForm(id ? S.equipamentos[id].nome : 'Novo equipamento', [{k:'nome',l:'Equipamento',req:1,full:1},{k:'local',l:'Onde está (sede ou paciente)',full:1},{k:'ultima',l:'Última manutenção',t:'date'},{k:'proxima',l:'Próxima manutenção',t:'date'},{k:'obs',l:'Observação',full:1}], id ? S.equipamentos[id] : {}, d => (id ? db.doc('equipamentos/'+id) : db.collection('equipamentos').doc()).set(d), id ? [['Excluir','eqp-del',id]] : []);
    case 'eqp-del': return confirmBox('Excluir este equipamento?', () => db.doc('equipamentos/'+id).delete());
  }} catch(err){ toast('Não foi possível: ' + (err?.code || 'erro')); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'pacFiltro'){ pacFiltro = t.value; schedule(); }
  if (t.id === 'agFisio'){ agFisio = t.value; store.set('ap.fisio', agFisio); schedule(); }
  if (t.id === 'cobMes' && t.value){ cobMes = t.value; schedule(); }
  if (['evoFoto','evoArq'].includes(t.id) && t.files && t.files[0]){ const f = t.files[0]; t.value = ''; salvarMidia(f); }
  if (t.id === 'bkArq' && t.files && t.files[0]){ const f = t.files[0]; t.value = ''; importarBackup(f); }
});
let bt; document.addEventListener('input', e => { if (e.target.id === 'pacBusca'){ pacBusca = e.target.value; clearTimeout(bt); bt = setTimeout(() => { const pos = e.target.selectionStart; render(); const el = $('#pacBusca'); el.focus(); el.setSelectionRange(pos,pos); }, 250); } });
document.addEventListener('submit', async e => {
  if (e.target.id === 'loginForm'){ e.preventDefault(); return loginAcao('entrar'); }
  if (e.target.id === 'nsForm'){ e.preventDefault(); const { error } = await sb.auth.updateUser({ password: $('#nsSenha').value }); if (error){ const m = $('#nsMsg'); m.hidden = false; m.textContent = error.message; return; } $('#dlg').close(); toast('Senha alterada'); return location.reload(); }
  if (e.target.id !== 'cfgForm') return; e.preventDefault();
  const g = k => $('#c_'+k).value.trim();
  try { await db.doc('config/geral').set({pixChave:g('pixChave'), pixNome:g('pixNome'), pixCidade:g('pixCidade'), multa:Number(g('multa'))||0, juros:Number(g('juros'))||0, vencDia:Number(g('vencDia'))||15, assinatura:g('assinatura')}); toast('Dados de cobrança salvos'); }
  catch(err){ toast('Não foi possível salvar: ' + (err?.code||'erro')); }
});
$('#dlg').addEventListener('close', schedule);

// ---------- inicialização ----------
async function iniciarApp(){
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return telaLogin();
  myId = user.id; meuEmail = user.email || '';
  canWrite = true;
  let acesso = null;
  try { const r = await sb.rpc('meu_acesso'); acesso = r.data || null; } catch(e){}
  const dono = acesso?.nivel === 'total' && acesso?.admin === true;
  const podeEditar = true;
  const sub = (col, q) => (q || db.collection(col)).onSnapshot(snap => {
    const o = {}; snap.docs.forEach(d => { o[d.id] = Object.assign({_id: d.id}, d.data()); }); S[col] = o; S.loaded[col] = true;
    schedule();
  }, err => { console.warn(col, err); });
  sub('equipe');
  const iniciar = () => {
    if (iniciado) return; iniciado = true;
    sub('agenda', db.collection('agenda').where('data', '>=', addDays(today(), -120)));
    sub('evolucoes', db.collection('evolucoes').where('data', '>=', addDays(today(), -30)));
    sub('datas');
    if (restrito()) return;
    sub('pacientes'); sub('equipamentos');
    if (isAdmin){
      sub('planos'); sub('cobrancas', db.collection('cobrancas').where('mes', '>=', addDays(today(), -400).slice(0,7))); sub('funil');
      sub('pedidos'); sub('liberados');
      db.doc('config/geral').onSnapshot(s => { S.config = s.exists ? s.data() : {}; schedule(); }, () => {});
    }
  };
  const aplicar = (lib) => {
    const antes = modo;
    if (dono) modo = 'total';
    else if (!myId) modo = 'semid';
    else if (lib?.nivel === 'total') modo = 'total';
    else if (lib?.nivel === 'agenda'){ modo = 'agenda'; minhaFisio = lib.fisio || ''; }
    else modo = 'pedido';
    isAdmin = modo === 'total' && podeEditar;
    if (antes !== modo && iniciado && antes !== 'carregando' && (antes === 'agenda' || modo === 'agenda')) { location.reload(); return; }
    $('#who').innerHTML = esc(meuEmail) + ' · ' + esc({total: 'acesso completo', agenda: 'agenda de ' + minhaFisio, pedido: 'aguardando liberação'}[modo] || '') + ' · <button class="btn sm ghost" data-act="sair">Sair</button>';
    if (modo === 'total' || modo === 'agenda') iniciar();
    schedule();
  };
  if (dono) aplicar(null);
  else {
    db.doc('liberados/' + myId).onSnapshot(s => aplicar(s.exists ? s.data() : null), () => aplicar(null));
    db.doc('pedidos/' + myId).get().then(s => { pedidoFeito = s.exists; schedule(); }).catch(() => {});
  }
}

// ---------- login ----------
function telaLogin(msg){
  modo = 'login'; $('#tabs').innerHTML = ''; $('#who').textContent = '';
  $('#view').innerHTML = `<form class="panel login" id="loginForm">
    <h1>Entrar</h1>
    <p class="sub" style="margin:0">AP Fisioterapia Domiciliar · uso interno da equipe</p>
    <label>E-mail<input id="lgEmail" type="email" autocomplete="username" required></label>
    <label>Senha<input id="lgSenha" type="password" autocomplete="current-password" minlength="6" required></label>
    <p class="sub" id="lgMsg" style="margin:0;color:var(--bad)" ${msg ? '' : 'hidden'}>${esc(msg||'')}</p>
    <button class="btn pri" type="submit">Entrar</button>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" type="button" data-act="lg-criar">Criar minha conta</button><button class="btn ghost" type="button" data-act="lg-esqueci">Esqueci a senha</button></div>
  </form>`;
}
async function loginAcao(tipo){
  const email = $('#lgEmail').value.trim(), senha = $('#lgSenha').value, m = $('#lgMsg');
  const erro = t => { m.hidden = false; m.style.color = 'var(--bad)'; m.textContent = t; };
  const ok = t => { m.hidden = false; m.style.color = 'var(--ok)'; m.textContent = t; };
  if (!email) return erro('Digite o e-mail.');
  if (tipo === 'esqueci'){
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    return error ? erro('Não foi possível enviar: ' + error.message) : ok('Enviamos um link para criar uma senha nova. Confira o e-mail.');
  }
  if (!senha || senha.length < 6) return erro('A senha precisa ter pelo menos 6 caracteres.');
  if (tipo === 'criar'){
    const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) return erro('Não foi possível criar a conta: ' + error.message);
    if (!data.session) return ok('Conta criada. Abra o e-mail que enviamos e confirme para poder entrar.');
    return location.reload();
  }
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) return erro(error.message.includes('Invalid') ? 'E-mail ou senha incorretos.' : error.message.includes('confirm') ? 'Confirme o e-mail antes de entrar (veja a caixa de entrada).' : error.message);
  location.reload();
}

// ---------- partida ----------
(async () => {
  const C = window.AP_CONFIG || {};
  if (!C.supabaseUrl || !C.supabaseKey || !window.supabase){
    $('#view').innerHTML = '<div class="panel empty">O app ainda não foi ligado ao banco de dados. Falta preencher o arquivo config.js.</div>'; return;
  }
  sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  db = criarDb(sb);
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') novaSenha(); });
  iniciarApp();
})();
function novaSenha(){
  const d = $('#dlg');
  d.innerHTML = `<form class="dlg" id="nsForm"><h2>Nova senha</h2><label class="form" style="display:flex;flex-direction:column;gap:6px">Digite a nova senha<input id="nsSenha" type="password" minlength="6" autocomplete="new-password" required></label><p class="sub" id="nsMsg" hidden></p><div class="foot"><span class="sp"></span><button class="btn pri" type="submit">Salvar senha</button></div></form>`;
  d.showModal();
}
