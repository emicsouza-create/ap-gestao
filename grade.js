// ---------- GRADE FIXA DA SEMANA E LISTA DE EVOLUÇÕES ----------
// Grade: horários fixos de cada paciente (dia da semana, hora, quem atende). Ana e Emi criam e mudam;
// cada fisio vê só a grade dela. "Lançar na agenda" cria os atendimentos da semana a partir da grade.
const DIAS_GRADE = [[1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado']];
let gradeFisio = '';
const gradeVisivel = () => Object.values(S.grade || {}).filter(g => g.ativo !== false && (!restrito() || g.fisio === minhaFisio) && (!gradeFisio || g.fisio === gradeFisio));
const vagasDe = nome => Number(Object.values(S.equipe).find(e => e.nome === nome)?.vagasDia) || 0;

function vGrade(){
  const G = gradeVisivel(), fis = restrito() ? [minhaFisio] : fisios();
  const wk = agWeek;
  return `<div class="head"><div><h1>${restrito() ? 'Minha grade' : 'Grade da semana'}</h1><p class="sub">Horários fixos de cada paciente. ${restrito() ? 'Só a sua grade aparece aqui.' : 'Toque num horário para mudar o paciente, o dia, a hora ou quem atende.'}</p></div><span class="sp"></span>
    ${isAdmin ? `<button class="btn" data-act="grade-lancar">Lançar na agenda</button><button class="btn pri" data-act="grade-novo">Novo horário</button>` : ''}</div>
  ${!restrito() ? `<div class="seg"><button data-act="grade-fisio" data-v="" aria-pressed="${!gradeFisio}">Todas</button>${fisios().map(f => `<button data-act="grade-fisio" data-v="${esc(f)}" aria-pressed="${gradeFisio === f}">${esc(f.split(' ')[0])}</button>`).join('')}</div>` : ''}
  <div class="semana">${DIAS_GRADE.map(([d, nome]) => { const L = G.filter(g => Number(g.dia) === d).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    if (d === 6 && !L.length) return '';
    return `<div class="dia"><h3>${nome} <span class="chip mute">${L.length}</span></h3>
      ${fis.filter(f => !gradeFisio || f === gradeFisio).map(f => { const n = L.filter(g => g.fisio === f).length, v = vagasDe(f); return v ? `<div class="sub" style="display:flex;gap:6px;align-items:center;margin:4px 0;font-size:12.5px">${esc(f.split(' ')[0])}: ${n}/${v}<div class="pbar" style="flex:1"><i style="width:${Math.min(100, n / v * 100)}%;${n >= v ? 'background:var(--bad)' : ''}"></i></div></div>` : ''; }).join('')}
      ${L.map(g => `<button class="slot" ${isAdmin ? `data-act="grade-edit" data-id="${g._id}"` : 'disabled'} style="border-left-color:${g.fisio === fis[0] ? 'var(--accent)' : '#8a6fc0'}"><b>${esc(g.hora || '--:--')} · ${esc((g.fisio || '').split(' ')[0])}</b>${esc(S.pacientes[g.pid]?.nome || g.pnome || '')}</button>`).join('') || '<p class="sub">Livre</p>'}</div>`; }).join('')}</div>
  ${isAdmin ? '<p class="sub">Vagas por dia de cada fisio: em Equipe, toque em Editar na pessoa.</p>' : ''}`;
}
function gradeForm(id){
  const g = id ? S.grade[id] : { dia: 1, hora: '08:00', fisio: gradeFisio || agFisio || '', ativo: true };
  openForm(id ? 'Horário fixo' : 'Novo horário fixo', [
    { k: 'pid', l: 'Paciente', t: 'select', req: 1, full: 1, o: [['', 'Escolha…'], ...pacAtivos().sort((a, b) => a.nome.localeCompare(b.nome)).map(p => [p._id, p.nome])] },
    { k: 'dia', l: 'Dia da semana', t: 'select', o: DIAS_GRADE.map(([k, l]) => [String(k), l]) },
    { k: 'hora', l: 'Hora', t: 'time' },
    { k: 'fisio', l: 'Quem atende', t: 'select', o: ['', ...fisios()] },
    { k: 'ativo', l: 'Horário ativo', t: 'check' }
  ], Object.assign({}, g, { dia: String(g.dia) }), async d => {
    if (!d.pid) throw { code: 'escolha o paciente' };
    if (!d.fisio){ d.fisio = pacFisios(S.pacientes[d.pid])[0] || ''; }
    d.dia = Number(d.dia); d.pnome = S.pacientes[d.pid]?.nome || '';
    const choque = Object.values(S.grade).find(x => x._id !== id && x.ativo !== false && x.fisio === d.fisio && Number(x.dia) === d.dia && x.hora && x.hora === d.hora);
    if (choque) throw { code: `${d.fisio.split(' ')[0]} já atende ${S.pacientes[choque.pid]?.nome || choque.pnome} nesse horário` };
    const v = vagasDe(d.fisio), n = Object.values(S.grade).filter(x => x._id !== id && x.ativo !== false && x.fisio === d.fisio && Number(x.dia) === d.dia).length;
    if (v && n >= v) throw { code: `${d.fisio.split(' ')[0]} já está com as ${v} vagas desse dia ocupadas` };
    await (id ? db.doc('grade/' + id) : db.collection('grade').doc()).set(d);
  }, id ? [['Tirar da grade', 'grade-del', id]] : []);
}
// cria na agenda os atendimentos da semana que está aberta na Agenda (pula feriados e o que já existe)
function lancarGrade(){
  const wk = agWeek, datas = Object.values(S.datas);
  const novos = Object.values(S.grade).filter(g => g.ativo !== false && S.pacientes[g.pid] && pacAtivos().includes(S.pacientes[g.pid])).map(g => ({ g, data: addDays(wk, Number(g.dia) - 1) }))
    .filter(({ g, data }) => !datas.some(f => f.data === data || (f.ate && data >= f.data && data <= f.ate)) && !Object.values(S.agenda).some(a => a.pid === g.pid && a.data === data && a.fisio === g.fisio));
  return confirmBox(`Lançar ${novos.length} atendimento${novos.length !== 1 ? 's' : ''} da grade na semana de ${fmtD(wk)}? Feriados e horários que já estão na agenda ficam de fora.`, async () => {
    for (const { g, data } of novos) await db.doc('agenda/g-' + g._id + '-' + data).set({ tipo: 'atendimento', pid: g.pid, pnome: S.pacientes[g.pid]?.nome || g.pnome || '', data, hora: g.hora || '', fisio: g.fisio || '', status: 'agendado', ordem: 50, obs: '' });
    toast(novos.length + ' atendimentos lançados');
  });
}

// lista de evoluções: Ana e Emi veem todas; a fisio vê só as dela (o banco também só entrega as dela)
let evoFiltro = '';
function vEvolucoes(){
  const L = Object.entries(S.evolucoes).map(([id, e]) => Object.assign({ _id: id }, e)).filter(e => e.tipo !== 'avaliacao' && (!restrito() || e.fisio === minhaFisio) && (!evoFiltro || e.fisio === evoFiltro)).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  return `<div class="head"><div><h1>${restrito() ? 'Minhas evoluções' : 'Evoluções'}</h1><p class="sub">Últimos 30 dias. ${restrito() ? 'Só as evoluções que você escreveu.' : 'Todas as evoluções da equipe.'} Para escrever uma evolução, abra o atendimento na agenda.</p></div></div>
  ${!restrito() ? `<div class="seg"><button data-act="evo-filtro" data-v="" aria-pressed="${!evoFiltro}">Todas</button>${fisios().map(f => `<button data-act="evo-filtro" data-v="${esc(f)}" aria-pressed="${evoFiltro === f}">${esc(f.split(' ')[0])}</button>`).join('')}</div>` : ''}
  <section class="panel list">${L.map(e => `<button class="irow" ${S.agenda[e._id] ? `data-act="evo" data-id="${e._id}"` : 'disabled'}><span class="tx"><span class="t">${esc(S.pacientes[e.pid]?.nome || e.pnome || '')}</span><span class="m">${esc([fmtD(e.data), restrito() ? '' : (e.fisio || '').split(' ')[0], rtTexto(e.texto || '').slice(0, 90)].filter(Boolean).join(' · '))}</span></span>
    <span class="r">${e.nAudios ? '<span class="chip info">Áudio</span>' : ''}${e.nFotos ? '<span class="chip mute">Foto</span>' : ''}</span>${ICON.chev}</button>`).join('') || '<div class="empty">Nenhuma evolução nos últimos 30 dias.</div>'}</section>`;
}

async function gradeAcao(a, id, b){
  switch(a){
    case 'grade-fisio': gradeFisio = b.dataset.v || ''; return schedule();
    case 'grade-novo': return gradeForm(null);
    case 'grade-edit': return gradeForm(id);
    case 'grade-del': return confirmBox('Tirar este horário da grade? Os atendimentos que já estão na agenda continuam lá.', () => db.doc('grade/' + id).delete());
    case 'grade-lancar': return lancarGrade();
    case 'evo-filtro': evoFiltro = b.dataset.v || ''; return schedule();
  }
}
