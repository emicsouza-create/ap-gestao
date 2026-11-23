// ---------- TELAS DE GESTÃO E PRIVACIDADE (só acesso total: Ana e Emi) ----------
// Quem está sumindo · Relatórios · Recados para as famílias · Privacidade (LGPD)

const LINK_AVISO = 'https://emicsouza-create.github.io/ap-gestao/privacidade.html';
const registrarAcesso = (col, id, resumo) => { try { sb.rpc('registrar_acesso', { p_col: col, p_id: id, p_resumo: resumo || '' }).then(() => {}, () => {}); } catch(e){} };

// ===== QUEM ESTÁ SUMINDO =====
let diasSumindo = 14;
function listaSumindo(dias){
  const t = today(), mes = t.slice(0, 7);
  return pacAtivos().map(p => {
    const A = Object.values(S.agenda).filter(a => a.pid === p._id && (a.tipo || 'atendimento') !== 'outro');
    const feitos = A.filter(a => a.status === 'feito' && a.data <= t).map(a => a.data).sort();
    const ultimo = feitos[feitos.length - 1] || '';
    const semDias = ultimo ? Math.round((parseD(t) - parseD(ultimo)) / 864e5) : null;
    const faltas = A.filter(a => a.data.slice(0, 7) === mes && (a.status === 'falta' || a.status === 'cancelado')).length;
    const motivos = [];
    if (semDias !== null && semDias >= dias) motivos.push(`${semDias} dias sem atendimento`);
    if (semDias === null && A.length) motivos.push('nenhum atendimento marcado como realizado nos últimos 4 meses');
    if (faltas >= 2) motivos.push(`${faltas} faltas ou cancelamentos neste mês`);
    return { p, motivos, semDias, faltas, valor: Number(S.planos[p._id]?.valor) || 0, peso: (semDias ?? 120) + faltas * 5 };
  }).filter(x => x.motivos.length).sort((a, b) => b.peso - a.peso);
}
function vSumindo(){
  const L = listaSumindo(diasSumindo), total = L.reduce((s, x) => s + x.valor, 0);
  const t = today(), semMarca = Object.values(S.agenda).filter(a => a.pid && a.data < t && (a.status || 'agendado') === 'agendado').length;
  return `<div class="head"><div><h1>Quem está sumindo</h1><p class="sub">Pacientes ativos sem atendimento realizado há ${diasSumindo} dias ou mais, ou com 2 faltas ou cancelamentos no mês. Ligue antes que virem cancelamento.</p></div></div>
  ${semMarca ? `<div class="cta warnbox"><div class="tx">${semMarca} atendimentos que já passaram estão sem marcação (realizado ou não aconteceu). Enquanto não forem marcados, esta lista pode mostrar pacientes que estão sendo atendidos normalmente.</div><button class="btn sm" data-tab="agenda">Ir para a agenda</button></div>` : ''}
  <div class="seg">${[7, 14, 21, 30].map(d => `<button data-act="sum-dias" data-v="${d}" aria-pressed="${d === diasSumindo}">${d} dias</button>`).join('')}</div>
  ${L.length ? `<div class="cta bad" style="margin:12px 0"><div><div class="k">Em risco por mês</div><div class="v" style="font-size:28px">${brl(total)}</div></div><p style="margin:0">Se ${L.length === 1 ? 'esse paciente cancelar' : `esses ${L.length} pacientes cancelarem`}, é o que a AP deixa de receber por mês (${brl(total * 12)} em um ano).</p></div>` : ''}
  <section class="panel list">${L.map(x => { const p = x.p; const msg = `Olá, ${(p.responsavel || '').split(' ')[0] || 'tudo bem'}! Aqui é da AP Fisioterapia. Sentimos falta de ${p.nome.split(' ')[0]} nos atendimentos. Está tudo bem? Quer que a gente reorganize os horários desta semana?`;
    const link = waLink(p.telefone, msg);
    return `<div class="row"><div class="main"><div class="name">${esc(p.nome)}</div>
      <div class="meta">${x.motivos.map(m => `<span class="chip ${/falta/.test(m) ? 'warn' : 'bad'}" style="white-space:normal">${esc(m)}</span>`).join(' ')}</div>
      <div class="meta">${esc([pacFisios(p).map(n => n.split(' ')[0]).join(' e '), p.responsavel ? 'responsável: ' + p.responsavel : '', p.contatoRetencaoEm ? 'contatado em ' + fmtD(p.contatoRetencaoEm) : ''].filter(Boolean).join(' · '))}</div></div>
      <div class="acts" style="align-items:center;flex-direction:column;gap:6px"><span class="num" style="font-weight:700">${x.valor ? brl(x.valor) + '/mês' : 'sem valor'}</span>
      ${link ? `<a class="btn sm pri" href="${esc(link)}" target="_blank" rel="noopener" data-act="sum-contato" data-id="${p._id}">Chamar no WhatsApp</a>` : '<span class="chip warn">Sem WhatsApp</span>'}</div></div>`; }).join('') || '<div class="empty">Ninguém sumindo nesse período.</div>'}</section>
  <p class="sub">Conta pelos atendimentos marcados na agenda dos últimos 4 meses.</p>`;
}

// ===== RELATÓRIOS =====
function vRelatorios(){
  const t = today(), ini = addDays(t, -56);
  const P = Object.values(S.agenda).filter(a => a.pid && a.data >= ini && a.data < t && (a.tipo || 'atendimento') !== 'outro');
  const semMarca = P.filter(a => (a.status || 'agendado') === 'agendado').length;
  // só conta o que foi marcado: realizado, falta ou não aconteceu (remarcado e sem marcação ficam fora)
  const A = P.filter(a => ['feito', 'falta', 'cancelado'].includes(a.status));
  const porPac = {}; A.forEach(a => { const o = porPac[a.pid] = porPac[a.pid] || { prev: 0, real: 0 }; o.prev++; if (a.status === 'feito') o.real++; });
  const L = Object.entries(porPac).map(([pid, o]) => ({ p: S.pacientes[pid], ...o, pct: o.real / o.prev * 100 })).filter(x => x.p).sort((a, b) => a.pct - b.pct);
  const tot = L.reduce((s, x) => ({ prev: s.prev + x.prev, real: s.real + x.real }), { prev: 0, real: 0 });
  const per = [['Manhã cedo', '00:00', '09:00'], ['Manhã', '09:00', '12:00'], ['Tarde', '12:00', '15:00'], ['Fim da tarde', '15:00', '24:00']];
  const dias = [1, 2, 3, 4, 5, 6];
  const B = Object.values(S.agenda).filter(a => a.data >= ini && (a.tipo || 'atendimento') !== 'outro' && a.status !== 'remarcado' && a.status !== 'cancelado');
  const cont = (d, [, x, y]) => B.filter(a => parseD(a.data).getDay() === d && (a.hora || '12:00') >= x && (a.hora || '12:00') < y).length;
  const max = Math.max(1, ...dias.flatMap(d => per.map(p => cont(d, p))));
  const receita = pacAtivos().reduce((s, p) => s + (Number(S.planos[p._id]?.valor) || 0), 0);
  const mesAnt = shiftMes(refAtual(), 0), recebido = Object.values(S.cobrancas).filter(c => c.mes === mesAnt && c.pagoEm).reduce((s, c) => s + (Number(c.valorPago) || Number(c.valor) || 0), 0);
  const NOMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `<div class="head"><div><h1>Presença e relatórios</h1><p class="sub">Últimas 8 semanas, pelos atendimentos marcados na agenda. Remarcações não contam como falta.</p></div></div>
  ${semMarca ? `<div class="cta warnbox"><div class="tx">${semMarca} atendimentos dessas 8 semanas estão sem marcação e ficam fora da conta. Marque na agenda se foram realizados ou não aconteceram.</div></div>` : ''}
  <div class="grid g3">
    <div class="panel pad"><h2>Presença geral</h2><div style="font-size:34px;font-family:var(--display)">${tot.prev ? Math.round(tot.real / tot.prev * 100) : 0}%</div><p class="sub">${tot.real} de ${tot.prev} atendimentos aconteceram</p></div>
    <div class="panel pad"><h2>Pacotes ativos por mês</h2><div style="font-size:30px;font-family:var(--display)">${brl(receita)}</div><p class="sub">soma dos valores dos pacientes ativos</p></div>
    <div class="panel pad"><h2>Recebido · sessões de ${MESES[Number(mesAnt.slice(5)) - 1]}</h2><div style="font-size:30px;font-family:var(--display)">${brl(recebido)}</div><p class="sub">cobranças marcadas como pagas</p></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <section class="panel pad"><h2>Frequência por paciente</h2><p class="sub">Quem falta mais aparece primeiro.</p>
      <div class="list">${L.map(x => `<div class="row"><div class="main"><div class="name">${esc(x.p.nome)}</div><div class="pbar"><i style="width:${x.pct}%;${x.pct < 75 ? 'background:var(--bad)' : x.pct < 90 ? 'background:var(--warn)' : ''}"></i></div></div><div class="acts"><b>${Math.round(x.pct)}%</b><span class="sub" style="margin:0">${x.real}/${x.prev}</span></div></div>`).join('') || '<div class="empty">Ainda não há atendimentos suficientes na agenda.</div>'}</div></section>
    <section class="panel pad"><h2>Dias e horários mais cheios e mais vazios</h2><p class="sub">Atendimentos por dia da semana e período. Quanto mais escuro, mais cheio; os claros são onde cabe paciente novo.</p>
      <div class="mapa"><div></div>${dias.map(d => `<div class="h">${NOMES[d]}</div>`).join('')}
      ${per.map(p => `<div class="h" style="text-align:left">${p[0]}</div>${dias.map(d => { const n = cont(d, p), f = n / max; return `<div style="background:color-mix(in srgb, var(--accent) ${Math.round(f * 85)}%, var(--bg));${f > .55 ? 'color:#fff' : ''}" title="${NOMES[d]}, ${p[0]}: ${n}">${n}</div>`; }).join('')}`).join('')}</div></section>
  </div>`;
}

// ===== RECADOS PARA AS FAMÍLIAS =====
let recado = { tipo: 'operacional', destino: 'todos', valor: '', texto: '' };
function destinatariosRecado(){
  let L = pacAtivos().filter(p => p.telefone);
  if (recado.destino === 'fisio' && recado.valor) L = L.filter(p => pacFisios(p).includes(recado.valor));
  if (recado.destino === 'dia' && recado.valor){ const wk = weekStart(today()); L = L.filter(p => Object.values(S.agenda).some(a => a.pid === p._id && a.data >= wk && parseD(a.data).getDay() === Number(recado.valor))); }
  const fora = recado.tipo === 'conteudo' ? L.filter(p => p.conteudos !== 'sim') : [];
  return { L: L.filter(p => !fora.includes(p)), fora };
}
function vRecados(){
  const { L, fora } = destinatariosRecado();
  const H = Object.values(S.recados || {}).sort((a, b) => (b.em || '').localeCompare(a.em || '')).slice(0, 15);
  const DS = [[1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado']];
  return `<div class="head"><div><h1>Recados para as famílias</h1><p class="sub">Mande um recado pelo WhatsApp para todas as famílias ou para um grupo. O WhatsApp abre uma conversa por vez, com a mensagem pronta.</p></div></div>
  <div class="grid g2"><section class="panel pad">
    <div class="seg">${[['operacional', 'Agenda e funcionamento'], ['conteudo', 'Dica ou divulgação']].map(([k, l]) => `<button data-act="rec-tipo" data-v="${k}" aria-pressed="${recado.tipo === k}">${l}</button>`).join('')}</div>
    <p class="sub">${recado.tipo === 'operacional' ? 'Vai para todas as famílias do grupo, porque faz parte do atendimento (horário, feriado, mudança).' : 'Vai só para quem deu permissão para receber dicas e conteúdos (campo no cadastro do paciente).'}</p>
    <div class="form" style="margin-top:10px">
      <label>Para quem<select id="recDestino"><option value="todos" ${recado.destino === 'todos' ? 'selected' : ''}>Todos os pacientes ativos</option><option value="fisio" ${recado.destino === 'fisio' ? 'selected' : ''}>Pacientes de uma fisioterapeuta</option><option value="dia" ${recado.destino === 'dia' ? 'selected' : ''}>Quem é atendido em um dia desta semana</option></select></label>
      ${recado.destino === 'fisio' ? `<label>Fisioterapeuta<select id="recValor"><option value="">Escolha…</option>${fisios().map(f => `<option ${f === recado.valor ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>`
        : recado.destino === 'dia' ? `<label>Dia<select id="recValor"><option value="">Escolha…</option>${DS.map(([k, l]) => `<option value="${k}" ${String(k) === recado.valor ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : '<span></span>'}
      <label class="full">Mensagem<textarea id="recTexto" placeholder="Ex.: Na sexta-feira (20/11) não teremos atendimento à tarde. Vamos combinar a reposição com cada família.">${esc(recado.texto)}</textarea></label>
    </div>
    <p class="sub"><b>${L.length}</b> ${L.length === 1 ? 'família' : 'famílias'}${fora.length ? ` · ${fora.length} sem permissão para dicas ficam de fora` : ''}.</p>
    <div style="display:flex;justify-content:flex-end"><button class="btn pri" data-act="rec-preparar">Preparar envio</button></div>
  </section>
  <section class="panel pad"><h2>Enviados</h2><div class="list">${H.map(r => `<div class="row"><div class="main"><div class="name" style="font-weight:500">${esc(r.texto)}</div><div class="meta">${fmtD((r.em || '').slice(0, 10))} · ${esc(r.para)} · ${r.total} famílias</div></div><span class="chip ${r.tipo === 'conteudo' ? 'info' : 'mute'}">${r.tipo === 'conteudo' ? 'Dica' : 'Agenda'}</span></div>`).join('') || '<div class="empty">Nenhum recado ainda.</div>'}</div></section></div>`;
}
function guardaRecado(){ const t = $('#recTexto'), d = $('#recDestino'), v = $('#recValor'); if (t) recado.texto = t.value; if (d) recado.destino = d.value; if (v) recado.valor = v.value; }
document.addEventListener('change', e => { if (e.target.id === 'recDestino'){ guardaRecado(); recado.valor = ''; schedule(); } else if (e.target.id === 'recValor'){ guardaRecado(); schedule(); } });
document.addEventListener('input', e => { if (e.target.id === 'recTexto') recado.texto = e.target.value; });

// ===== PRIVACIDADE (LGPD) =====
let abaPriv = 'dados', registroCache = null, lixeiraCache = null;
const INVENTARIO = [
  ['Nome do paciente', 'Identificar o paciente e organizar os atendimentos', 'Execução do contrato', 'contrato', 'Ana, Emi e a fisio do paciente'],
  ['Endereço do atendimento', 'O atendimento é na casa do paciente', 'Execução do contrato', 'contrato', 'Ana, Emi e a fisio do paciente'],
  ['Responsável e WhatsApp', 'Combinar horários, avisar mudanças, cobrar', 'Execução do contrato', 'contrato', 'Ana, Emi e a fisio do paciente'],
  ['Contato de emergência e médico que indicou', 'Agir numa emergência e falar com a equipe médica', 'Execução do contrato e tutela da saúde', 'saude', 'Ana, Emi e a fisio do paciente'],
  ['CPF/CNPJ, e-mail e endereço de quem paga', 'Contrato, cobrança e nota fiscal', 'Execução do contrato e obrigação legal (nota fiscal)', 'lei', 'Ana e Emi (e a contabilidade, só para a nota)'],
  ['Valor do pacote, cobranças e pagamentos', 'Cobrança mensal', 'Execução do contrato e obrigação legal (fiscal)', 'lei', 'Ana e Emi'],
  ['Data de nascimento e sexo', 'Cuidado clínico e valores de referência dos testes', 'Tutela da saúde (por profissional de saúde)', 'saude', 'Ana, Emi e a fisio do paciente'],
  ['Diagnóstico, anamnese, medicamentos, exame físico', 'Planejar e fazer o tratamento', 'Tutela da saúde', 'saude', 'Ana, Emi e a fisio do paciente'],
  ['Peso, altura, IMC e medidas', 'Avaliação e acompanhamento', 'Tutela da saúde', 'saude', 'Ana, Emi e a fisio do paciente'],
  ['Sinais vitais, testes e avaliações', 'Avaliação e acompanhamento', 'Tutela da saúde', 'saude', 'Ana, Emi e a fisio da avaliação'],
  ['Evoluções em texto e áudio', 'Prontuário', 'Tutela da saúde e dever de manter prontuário', 'saude', 'Ana, Emi e a fisio que atendeu'],
  ['Fotos clínicas', 'Acompanhar a evolução no prontuário', 'Tutela da saúde. Ficam só no prontuário.', 'saude', 'Ana, Emi e a fisio que atendeu'],
  ['Agenda, presença e faltas', 'Organizar a agenda e não perder o paciente', 'Execução do contrato', 'contrato', 'Ana e Emi; a fisio vê só a agenda dela'],
  ['Foto ou vídeo nas redes sociais da AP', 'Divulgação', 'CONSENTIMENTO específico, que pode ser retirado', 'consent', 'Ana e Emi'],
  ['Receber dicas e conteúdos pelo WhatsApp', 'Comunicação que não é da agenda', 'CONSENTIMENTO, que pode ser retirado', 'consent', 'Ana e Emi'],
  ['Contatos da Entrada (ainda não pacientes)', 'Responder quem pediu orçamento', 'Etapa antes do contrato, a pedido da pessoa', 'contrato', 'Ana e Emi'],
  ['E-mail de login da equipe', 'Saber quem entra e o que cada um vê', 'Contrato com a equipe', 'contrato', 'Ana e Emi'],
  ['Registro de atividades', 'Segurança: saber quem abriu ou mudou uma ficha', 'Legítimo interesse e dever de segurança da LGPD', 'interesse', 'Ana e Emi']
];
const TIPO_BASE = { contrato: ['info', 'Contrato'], saude: ['ok', 'Saúde'], lei: ['mute', 'Contrato + lei'], consent: ['warn', 'Consentimento'], interesse: ['mute', 'Legítimo interesse'] };
async function carregarRegistro(){ try { const { data } = await sb.from('registro').select('em,email,acao,col,doc_id,resumo').order('em', { ascending: false }).limit(200); registroCache = data || []; } catch(e){ registroCache = []; } schedule(); }
async function carregarLixeira(){ try { const s = await db.collection('lixeira').get(); lixeiraCache = s.docs.map(d => Object.assign({ _id: d.id }, d.data())).sort((a, b) => (b.em || '').localeCompare(a.em || '')); } catch(e){ lixeiraCache = []; } schedule(); }
const NOME_COL = { pacientes: 'Paciente', planos: 'Pacote', agenda: 'Atendimento', evolucoes: 'Evolução ou avaliação', midias: 'Foto ou áudio', cobrancas: 'Cobrança', funil: 'Contato da entrada', equipe: 'Pessoa da equipe', equipamentos: 'Equipamento', datas: 'Data especial', liberados: 'Acesso ao app', recados: 'Recado' };
const ACAO_REG = { criou: 'criou', alterou: 'alterou', tirou: 'mandou para a lixeira', abriu: 'abriu' };
function vPrivacidade(){
  const semAviso = pacAtivos().filter(p => !p.privAvisoEm).length;
  const abas = [['dados', 'Dados que guardamos'], ['aviso', 'Aviso de privacidade'], ['lixeira', 'Lixeira'], ['registro', 'Registro de atividades'], ['copia', 'Cópia de segurança']];
  let corpo = '';
  if (abaPriv === 'dados') corpo = `<p class="sub">Tudo o que o app guarda, para que serve e a base legal. Só duas coisas pedem permissão (consentimento): usar imagem nas redes e mandar dicas. O resto é necessário para atender, cobrar e cumprir a lei.</p>
    <div class="panel" style="overflow-x:auto;margin-top:10px"><table class="tab"><thead><tr><th>Dado</th><th>Para que serve</th><th>Base legal</th><th>Quem vê</th></tr></thead><tbody>${INVENTARIO.map(([d, f, b, t, q]) => `<tr><td><b>${esc(d)}</b></td><td>${esc(f)}</td><td><span class="chip ${TIPO_BASE[t][0]}">${TIPO_BASE[t][1]}</span><div class="sub" style="margin:4px 0 0">${esc(b)}</div></td><td>${esc(q)}</td></tr>`).join('')}</tbody></table></div>`;
  if (abaPriv === 'aviso') corpo = `<div class="panel pad"><p>O aviso fica numa página pública, sem nenhum dado de paciente. A família recebe o link pelo WhatsApp, no cadastro ou junto com o contrato.</p>
    <p style="margin-top:8px"><a class="btn" href="${LINK_AVISO}" target="_blank" rel="noopener">Abrir o aviso</a></p>
    <p class="sub" style="margin-top:12px">${semAviso ? `<span class="chip warn">${semAviso} pacientes ativos</span> ainda sem registro de que a família recebeu. Abra o paciente e toque em "Enviar aviso de privacidade".` : 'Todos os pacientes ativos já têm o aviso registrado.'}</p></div>`;
  if (abaPriv === 'lixeira'){ if (!lixeiraCache) carregarLixeira();
    corpo = `<p class="sub">O que foi excluído sai das telas, mas continua guardado aqui. Dá para restaurar. Nada é apagado de vez pelo app.</p>
    <section class="panel list" style="margin-top:10px">${!lixeiraCache ? '<div class="empty">Carregando…</div>' : lixeiraCache.filter(x => !(x.col === 'planos' && lixeiraCache.some(y => y.col === 'pacientes' && y.id === x.id))).map(x => `<div class="row"><div class="main"><div class="name">${esc(NOME_COL[x.col] || x.col)}: ${esc(x.data?.nome || x.data?.pnome || (x.data?.pid && S.pacientes[x.data.pid]?.nome) || x.id)}</div><div class="meta">Excluído em ${fmtD(String(x.em).slice(0, 10))} por ${esc(x.por || '')}</div></div><div class="acts"><button class="btn sm" data-act="lix-restaurar" data-id="${esc(x._id)}">Restaurar</button></div></div>`).join('') || '<div class="empty">A lixeira está vazia.</div>'}</section>`; }
  if (abaPriv === 'registro'){ if (!registroCache) carregarRegistro();
    corpo = `<p class="sub">Quem abriu, criou, mudou ou excluiu cada ficha (últimos 200). Ninguém consegue apagar este registro pelo app.</p>
    <section class="panel list" style="margin-top:10px">${!registroCache ? '<div class="empty">Carregando…</div>' : registroCache.map(r => `<div class="row"><div class="main"><div class="name" style="font-weight:500">${esc(r.email)} ${esc(ACAO_REG[r.acao] || r.acao)} ${esc((NOME_COL[r.col] || r.col || '').toLowerCase())}${r.resumo ? ': ' + esc(S.pacientes[r.resumo]?.nome || r.resumo) : ''}</div><div class="meta">${new Date(r.em).toLocaleString('pt-BR')}</div></div></div>`).join('') || '<div class="empty">Nada registrado ainda.</div>'}</section>
    <p><button class="btn sm" data-act="reg-atualizar">Atualizar</button></p>`; }
  if (abaPriv === 'copia') corpo = `<div class="panel pad"><p>Antes de qualquer mudança na forma como os dados são salvos, é feita uma cópia completa no próprio banco. Além disso, dá para baixar uma cópia a qualquer hora.</p>
    <p class="sub">A cópia tem dados de saúde: guarde num lugar com senha (por exemplo, uma pasta protegida do Google Drive da AP). Nunca mande pelo WhatsApp.</p>
    <p style="margin-top:10px"><button class="btn pri" data-act="backup">Baixar cópia agora</button></p></div>`;
  return `<div class="head"><div><h1>Privacidade (LGPD)</h1></div></div>
  <div class="seg">${abas.map(([k, l]) => `<button data-act="priv-aba" data-v="${k}" aria-pressed="${abaPriv === k}">${l}</button>`).join('')}</div><div style="margin-top:12px">${corpo}</div>`;
}

// dados de um paciente, para entregar à família quando ela pedir
async function dadosDoPaciente(pid){
  const p = stripId(S.pacientes[pid] || {}), pl = stripId(S.planos[pid] || {});
  const pega = async col => { try { const s = await db.collection(col).where('pid', '==', pid).get(); return s.docs.map(d => d.data()); } catch(e){ return []; } };
  const [agenda, evolucoes, cobrancas, midias] = await Promise.all([pega('agenda'), pega('evolucoes'), pega('cobrancas'), pega('midias')]);
  return { geradoEm: new Date().toISOString(), responsavelPelosDados: 'AP Fisioterapia Domiciliar', paciente: p, pacoteEContrato: pl,
    atendimentos: agenda.map(a => ({ data: a.data, hora: a.hora, fisio: a.fisio, situacao: a.status, obs: a.obs })),
    evolucoesEAvaliacoes: evolucoes, cobrancas, anexos: midias.map(m => ({ data: m.data, tipo: m.tipo, tamanho: m.tamanho })),
    aviso: 'Fotos e áudios do prontuário podem ser entregues à parte, a pedido.' };
}

// ===== AÇÕES =====
async function gestaoAcao(a, id, b){
  switch(a){
    case 'sum-dias': diasSumindo = Number(b.dataset.v); return schedule();
    case 'sum-contato': setTimeout(() => db.doc('pacientes/' + id).update({ contatoRetencaoEm: today() }).catch(() => {}), 300); return 'link';
    case 'rec-tipo': guardaRecado(); recado.tipo = b.dataset.v; return schedule();
    case 'rec-preparar': {
      guardaRecado(); if (!recado.texto.trim()) return toast('Escreva a mensagem');
      const { L } = destinatariosRecado(); if (!L.length) return toast('Nenhuma família nesse grupo');
      const para = recado.destino === 'todos' ? 'Todos os pacientes ativos' : recado.destino === 'fisio' ? 'Pacientes de ' + recado.valor : 'Quem é atendido ' + ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][Number(recado.valor)];
      await db.collection('recados').doc().set({ em: new Date().toISOString(), tipo: recado.tipo, para, texto: recado.texto, total: L.length });
      const d = $('#dlg');
      d.innerHTML = `<div class="dlg"><h2>Enviar recado</h2><p class="sub">Toque em cada família: o WhatsApp abre com a mensagem pronta e você só toca em enviar.</p>
        <div class="list" style="max-height:50vh;overflow:auto">${L.map(p => `<div class="row"><div class="main"><div class="name">${esc(p.responsavel || p.nome)}</div><div class="meta">${esc(p.nome)}</div></div><a class="btn sm pri" href="${esc(waLink(p.telefone, recado.texto))}" target="_blank" rel="noopener" data-act="rec-ok">Abrir WhatsApp</a></div>`).join('')}</div>
        <div class="foot"><span class="sp"></span><button class="btn" data-act="close">Fechar</button></div></div>`;
      d.showModal(); recado.texto = ''; return;
    }
    case 'rec-ok': b.textContent = 'Aberto ✓'; b.classList.remove('pri'); return 'link';
    case 'priv-aba': abaPriv = b.dataset.v; if (abaPriv === 'registro') registroCache = null; if (abaPriv === 'lixeira') lixeiraCache = null; return schedule();
    case 'reg-atualizar': registroCache = null; return schedule();
    case 'lix-restaurar': return confirmBox('Restaurar este item? Ele volta para a tela de onde saiu.', async () => {
      const item = (lixeiraCache || []).find(x => x._id === id);
      const { error } = await sb.rpc('restaurar_da_lixeira', { p_lid: id }); if (error) throw erroDb(error);
      // paciente volta junto com o pacote dele
      if (item && item.col === 'pacientes'){ const pl = lixeiraCache.find(x => x.col === 'planos' && x.id === item.id); if (pl) await sb.rpc('restaurar_da_lixeira', { p_lid: pl._id }); }
      lixeiraCache = null; toast('Restaurado'); });
    case 'backup': await baixarBackup(); return toast('Cópia baixada. Guarde num lugar com senha.');
    case 'pac-dados': { const p = S.pacientes[id]; const j = await dadosDoPaciente(id); baixar(`dados-paciente-${today()}.json`, new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' })); registrarAcesso('pacientes', id, 'cópia dos dados'); return toast('Arquivo baixado. Mande para a família por um canal seguro.'); }
    case 'pac-aviso': { const p = S.pacientes[id]; const msg = `Olá, ${(p.responsavel || '').split(' ')[0] || 'tudo bem'}! Aqui é da AP Fisioterapia. Este é o nosso aviso de privacidade, com os dados que guardamos sobre ${p.nome.split(' ')[0]} e por quê: ${LINK_AVISO}. Qualquer dúvida, é só falar com a gente por aqui.`;
      const link = waLink(p.telefone, msg); if (!link) return toast('Cadastre o WhatsApp do responsável');
      window.open(link, '_blank', 'noopener'); await db.doc('pacientes/' + id).update({ privAvisoEm: today() }); if ($('#dlg').open) $('#dlg').close(); return toast('Aviso registrado como enviado hoje'); }
  }
}
