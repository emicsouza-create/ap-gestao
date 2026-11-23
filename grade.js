// ---------- GRADE FIXA DA SEMANA E LISTA DE EVOLUÇÕES ----------
// Grade: horários fixos de cada paciente (dia da semana, hora, quem atende). Ana e Emi criam e mudam;
// cada fisio vê só a grade dela. "Lançar na agenda" cria os atendimentos da semana a partir da grade.
const DIAS_GRADE = [[1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado']];
let gradeFisio = '', gradeInativos = false, gradeSemana = '';
const semanaLancar = () => gradeSemana || (new Date().getDay() === 0 ? addDays(weekStart(today()), 7) : weekStart(today()));
// paciente que ainda está sendo atendido (internado não entra na grade nem nos lançamentos)
const pacEmAtendimento = pid => { const p = S.pacientes[pid]; return !!p && (p.status === 'ativo' || p.status === 'verificar'); };
const gradeVisivel = () => Object.values(S.grade || {}).filter(g => (gradeInativos || g.ativo !== false) && (!restrito() || g.fisio === minhaFisio) && (!gradeFisio || g.fisio === gradeFisio));
// conta só horários ativos de pacientes em atendimento (horário de paciente inativo não ocupa vaga)
const gradeOcupa = g => g.ativo !== false && (restrito() || pacEmAtendimento(g.pid));
const vagasDe = nome => Number(Object.values(S.equipe).find(e => e.nome === nome)?.vagasDia) || 0;

function vGrade(){
  const G = gradeVisivel(), fis = restrito() ? [minhaFisio] : fisios();
  const nInat = Object.values(S.grade || {}).filter(g => g.ativo === false).length;
  return `<div class="head"><div><h1>${restrito() ? 'Minha grade' : 'Grade da semana'}</h1><p class="sub">Horários fixos de cada paciente. ${restrito() ? 'Só a sua grade aparece aqui.' : 'Toque num horário para mudar o paciente, o dia, a hora ou quem atende.'}</p></div><span class="sp"></span>
    ${isAdmin ? `<button class="btn pri" data-act="grade-novo">Novo horário</button>` : ''}</div>
  ${!restrito() ? `<div class="seg"><button data-act="grade-fisio" data-v="" aria-pressed="${!gradeFisio}">Todas</button>${fisios().map(f => `<button data-act="grade-fisio" data-v="${esc(f)}" aria-pressed="${gradeFisio === f}">${esc(f.split(' ')[0])}</button>`).join('')}${nInat ? `<button data-act="grade-inativos" aria-pressed="${gradeInativos}">Mostrar ${nInat} desativado${nInat > 1 ? 's' : ''}</button>` : ''}</div>` : ''}
  ${isAdmin ? `<section class="panel pad" style="margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>Lançar na agenda</b><span class="sp"></span>
    <button class="btn sm ghost" data-act="grade-sem" data-v="-7" aria-label="Semana anterior">‹</button><span>semana de ${fmtD(semanaLancar())}</span><button class="btn sm ghost" data-act="grade-sem" data-v="7" aria-label="Próxima semana">›</button>
    <button class="btn sm" data-act="grade-lancar">Lançar esta semana</button></section>` : ''}
  <div class="semana">${DIAS_GRADE.map(([d, nome]) => { const L = G.filter(g => Number(g.dia) === d).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    if (d === 6 && !L.length) return '';
    return `<div class="dia"><h3>${nome} <span class="chip mute">${L.filter(gradeOcupa).length}</span></h3>
      ${fis.filter(f => !gradeFisio || f === gradeFisio).map(f => { const n = L.filter(g => g.fisio === f && gradeOcupa(g)).length, v = vagasDe(f); return v ? `<div class="sub" style="display:flex;gap:6px;align-items:center;margin:4px 0;font-size:12.5px">${esc(f.split(' ')[0])}: ${n}/${v}<div class="pbar" style="flex:1"><i style="width:${Math.min(100, n / v * 100)}%;${n >= v ? 'background:var(--bad)' : ''}"></i></div></div>` : ''; }).join('')}
      ${L.map(g => { const fora = g.ativo === false ? 'desativado' : !restrito() && !pacEmAtendimento(g.pid) ? (S.pacientes[g.pid]?.status === 'internado' ? 'paciente internado' : 'paciente inativo') : '';
        return `<button class="slot" ${isAdmin ? `data-act="grade-edit" data-id="${esc(g._id)}"` : 'disabled'} style="border-left-color:${g.fisio === fis[0] ? 'var(--accent)' : '#8a6fc0'}${fora ? ';opacity:.55' : ''}"><b>${esc(g.hora || '--:--')} · ${esc((g.fisio || '').split(' ')[0])}${fora ? ' · ' + fora : ''}</b>${esc(S.pacientes[g.pid]?.nome || g.pnome || '')}</button>`; }).join('') || '<p class="sub">Livre</p>'}</div>`; }).join('')}</div>
  ${isAdmin ? '<p class="sub">Vagas por dia de cada fisio: em Equipe, toque em Editar na pessoa.</p>' : ''}`;
}
function gradeForm(id){
  const g = id ? S.grade[id] : { dia: 1, hora: '08:00', fisio: gradeFisio || agFisio || '', ativo: true };
  const ini = Object.assign({}, g, { dia: String(g.dia) });
  openForm(id ? 'Horário fixo' : 'Novo horário fixo', [
    { k: 'pid', l: 'Paciente', t: 'select', req: 1, full: 1, o: [['', 'Escolha…'], ...pacAtivos().sort((a, b) => a.nome.localeCompare(b.nome)).map(p => [p._id, p.nome])] },
    { k: 'dia', l: 'Dia da semana', t: 'select', o: DIAS_GRADE.map(([k, l]) => [String(k), l]) },
    { k: 'hora', l: 'Hora', t: 'time' },
    { k: 'fisio', l: 'Quem atende', t: 'select', o: ['', ...fisios()] },
    { k: 'ativo', l: 'Horário ativo', t: 'check' }
  ], ini, async d => {
    if (!d.pid) throw { aviso: 'Escolha o paciente.' };
    if (!d.fisio){ d.fisio = pacFisios(S.pacientes[d.pid])[0] || ''; }
    d.dia = Number(d.dia); d.pnome = S.pacientes[d.pid]?.nome || '';
    // só confere vagas e horário quando o horário fica ativo e muda de dia, hora ou fisio (assim dá para editar mesmo com o dia lotado)
    const mexeu = !id || d.ativo && (g.ativo === false || Number(g.dia) !== d.dia || g.fisio !== d.fisio || (g.hora || '') !== (d.hora || ''));
    if (d.ativo && mexeu){
      const choque = Object.values(S.grade).find(x => x._id !== id && gradeOcupa(x) && x.fisio === d.fisio && Number(x.dia) === d.dia && x.hora && x.hora === d.hora);
      if (choque) throw { aviso: `${d.fisio.split(' ')[0]} já atende ${S.pacientes[choque.pid]?.nome || choque.pnome} nesse horário.` };
      const v = vagasDe(d.fisio), n = Object.values(S.grade).filter(x => x._id !== id && gradeOcupa(x) && x.fisio === d.fisio && Number(x.dia) === d.dia).length;
      if (v && n >= v) throw { aviso: `${d.fisio.split(' ')[0]} já está com as ${v} vagas desse dia ocupadas.` };
    }
    if (id) return mesclar('grade/' + id, mudou(d, Object.assign({}, g, { dia: Number(g.dia) })));
    await db.collection('grade').doc().set(d);
  }, id ? [['Tirar da grade', 'grade-del', id]] : []);
  const f = $('#frm .foot'); if (f && id) f.insertAdjacentHTML('beforebegin', '<p class="sub" style="margin:0">Mudar aqui vale para as próximas semanas lançadas. Atendimentos que já estão na agenda não mudam: ajuste esses na própria agenda.</p>');
}
// cria na agenda os atendimentos da semana escolhida. Nunca escreve por cima de nada: pula feriados, dias que já passaram,
// paciente internado, paciente que já tem atendimento no dia (com qualquer fisio) e o que foi excluído (está na lixeira).
async function lancarGrade(){
  const wk = semanaLancar(), datas = Object.values(S.datas), hoje = today();
  let tirados = [];
  try { const s = await db.collection('lixeira').where('col', '==', 'agenda').get(); tirados = s.docs.map(d => d.data()?.data || {}).filter(a => a.data >= wk && a.data <= addDays(wk, 6)); } catch(e){}
  const ja = (pid, data) => Object.values(S.agenda).some(a => a.pid === pid && a.data === data) || tirados.some(a => a.pid === pid && a.data === data);
  const vistos = new Set();
  const novos = Object.values(S.grade).filter(g => g.ativo !== false && pacEmAtendimento(g.pid)).map(g => ({ g, data: addDays(wk, Number(g.dia) - 1) }))
    .filter(({ g, data }) => { const k = g.pid + data; if (vistos.has(k)) return false; vistos.add(k);
      return data >= hoje && !datas.some(f => f.data === data || (f.ate && data >= f.data && data <= f.ate)) && !ja(g.pid, data); });
  if (!novos.length) return toast('Nada para lançar nesta semana: tudo já está na agenda (ou é feriado, dia que já passou ou paciente internado).');
  return confirmBox(`Lançar ${novos.length} atendimento${novos.length !== 1 ? 's' : ''} da grade na semana de ${fmtD(wk)}? Ficam de fora: dias que já passaram, feriados, pacientes internados e quem já tem atendimento marcado no dia.`, async () => {
    for (const { g, data } of novos) await db.collection('agenda').doc().set({ tipo: 'atendimento', pid: g.pid, pnome: S.pacientes[g.pid]?.nome || g.pnome || '', data, hora: g.hora || '', fisio: g.fisio || '', status: 'agendado', ordem: 50, obs: '', gradeId: g._id });
    toast(novos.length + ' atendimentos lançados');
  });
}

// lista de evoluções: Ana e Emi veem todas; a fisio vê só as dela (o banco também só entrega as dela)
let evoFiltro = '';
function vEvolucoes(){
  const L = Object.entries(S.evolucoes).map(([id, e]) => Object.assign({ _id: id }, e)).filter(e => e.tipo !== 'avaliacao' && (!restrito() || e.fisio === minhaFisio) && (!evoFiltro || e.fisio === evoFiltro)).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  return `<div class="head"><div><h1>${restrito() ? 'Minhas evoluções' : 'Evoluções'}</h1><p class="sub">Últimos 30 dias. ${restrito() ? 'Só as evoluções que você escreveu.' : 'Todas as evoluções da equipe.'} Para escrever uma evolução, abra o atendimento na agenda.</p></div></div>
  ${!restrito() ? `<div class="seg"><button data-act="evo-filtro" data-v="" aria-pressed="${!evoFiltro}">Todas</button>${fisios().map(f => `<button data-act="evo-filtro" data-v="${esc(f)}" aria-pressed="${evoFiltro === f}">${esc(f.split(' ')[0])}</button>`).join('')}</div>` : ''}
  <section class="panel list">${L.map(e => `<button class="irow" ${S.agenda[e._id] ? `data-act="evo" data-id="${esc(e._id)}"` : 'disabled'}><span class="tx"><span class="t">${esc(S.pacientes[e.pid]?.nome || e.pnome || '')}</span><span class="m">${esc([fmtD(e.data), restrito() ? '' : (e.fisio || '').split(' ')[0], rtTexto(e.texto || '').slice(0, 90)].filter(Boolean).join(' · '))}</span></span>
    <span class="r">${e.nAudios ? '<span class="chip info">Áudio</span>' : ''}${e.nFotos ? '<span class="chip mute">Foto</span>' : ''}</span>${ICON.chev}</button>`).join('') || '<div class="empty">Nenhuma evolução nos últimos 30 dias.</div>'}</section>`;
}

async function gradeAcao(a, id, b){
  switch(a){
    case 'grade-fisio': gradeFisio = b.dataset.v || ''; return schedule();
    case 'grade-novo': return gradeForm(null);
    case 'grade-edit': return gradeForm(id);
    case 'grade-del': return confirmBox('Tirar este horário da grade? Os atendimentos que já estão na agenda continuam lá.', () => db.doc('grade/' + id).delete());
    case 'grade-lancar': return lancarGrade();
    case 'grade-sem': gradeSemana = addDays(semanaLancar(), Number(b.dataset.v) || 0); return schedule();
    case 'grade-inativos': gradeInativos = !gradeInativos; return schedule();
    case 'evo-filtro': evoFiltro = b.dataset.v || ''; return schedule();
  }
}

// guarda as telas para abrir rápido (o registro saiu do index.html para valer a regra de segurança que bloqueia código solto na página)
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
