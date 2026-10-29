// ---------- RELATÓRIO DE AVALIAÇÃO (PDF) ----------
// Layout em cartões: dados do paciente, anamnese, dados vitais, composição corporal,
// um cartão por grupo de testes (cada teste com explicação, valores e gráfico) e planejamento.

// logo carregada uma vez, para entrar no topo e como marca d'água
let LOGO_AP = null;
// fonte Noto Sans (a mesma do relatório de referência), só com os caracteres usados em português
const FONTES_AP = {};
const lerBase64 = async url => { const b = await (await fetch(url)).blob(); const d = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }); return String(d).split(',')[1]; };
(async () => { try { for (const [k, f] of [['normal', 'NotoSans_400Regular'], ['bold', 'NotoSans_700Bold'], ['italic', 'NotoSans_400Regular_Italic']]) FONTES_AP[k] = await lerBase64(`fonts/${f}.ttf`); } catch(e){} })();
(async () => { try { const b = await (await fetch('icons/logo-ap.jpg')).blob(); LOGO_AP = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }); } catch(e){} })();

// explicação curta de cada teste (texto próprio do app)
const AV_DESC = {
  tug: 'Tempo para levantar da cadeira, caminhar 3 metros, virar, voltar e sentar. Avalia mobilidade e risco de queda. Quanto menor o tempo, melhor.',
  vmarcha: 'Velocidade da marcha habitual medida num percurso cronometrado.',
  sppb: 'Bateria curta de desempenho físico com equilíbrio, velocidade de marcha e levantar da cadeira. Pontuação de 0 a 12.',
  tls5: 'O paciente levanta e senta de uma cadeira 5 vezes, o mais rápido possível. Avalia força de membros inferiores e funcionalidade. Quanto menor o tempo, melhor o desempenho.',
  tls30: 'Número de vezes que o paciente levanta e senta da cadeira em 30 segundos.',
  fssicu: 'Escala de estado funcional para pacientes internados, com 5 tarefas: rolar, passar de deitado para sentado, sentar na beira do leito, levantar da cadeira e caminhar.',
  preensao: 'A FPP é um teste no qual o avaliado é orientado a realizar uma contração máxima de preensão palmar num dinamômetro. A FPP é um marcador global de força muscular e valores reduzidos estão associados a fraqueza muscular global e é utilizado para triagem de sarcopenia. (Chagas, 2018)',
  mrc: 'Soma da força de 6 grupos musculares de cada lado do corpo (0 a 5 em cada), de 0 a 60 pontos.',
  cvf: 'Capacidade vital forçada: volume máximo de ar expirado com esforço após uma inspiração máxima.',
  vef1: 'Volume de ar expirado no primeiro segundo da manobra de capacidade vital forçada.',
  pfe: 'Pico de fluxo expiratório: maior fluxo de ar alcançado numa expiração forçada.',
  pft: 'Pico de fluxo de tosse: maior fluxo de ar durante uma tosse voluntária. Indica a capacidade de eliminar secreções.',
  pimax: 'Mede a força dos músculos inspiratórios. O paciente faz uma inspiração máxima a partir do volume residual, com a via aérea ocluída, no manovacuômetro.',
  pemax: 'Mede a força dos músculos expiratórios. O paciente faz uma expiração máxima a partir da capacidade pulmonar total, com a via aérea ocluída, no manovacuômetro.',
  sindex: 'Índice de força inspiratória dinâmica, medido durante uma inspiração rápida e máxima.',
  tc6: 'O paciente caminha o mais rápido que conseguir, sem correr, num corredor plano, durante 6 minutos. Avalia a capacidade funcional ao exercício.',
  iswt: 'O paciente caminha num percurso de 10 metros acompanhando sinais sonoros que aceleram a cada minuto, até não conseguir manter o ritmo.',
  cat: 'Questionário de 8 itens sobre o impacto da DPOC no dia a dia, de 0 a 40 pontos.',
  act: 'Questionário de 5 itens sobre o controle da asma nas últimas 4 semanas, de 5 a 25 pontos.',
  alsfrs: 'Escala funcional da ELA revisada: 12 itens sobre fala, deglutição, motricidade e respiração, de 0 a 48 pontos.',
  sf36: 'Questionário de qualidade de vida com 8 domínios.',
  whoqol: 'Questionário de qualidade de vida da OMS, versão abreviada, com 26 itens.',
  snip: 'Pressão inspiratória nasal medida durante uma fungada máxima, pela narina.',
  barthel: 'Avalia a independência em 10 atividades básicas de vida diária, de 0 a 100 pontos.',
  mif: 'Medida de independência funcional: 18 itens motores e cognitivos, de 18 a 126 pontos.',
  ess: 'Questionário sobre a chance de cochilar em 8 situações do dia a dia, de 0 a 24 pontos.',
  stopbang: 'Questionário de 8 itens de rastreio da apneia obstrutiva do sono: ronco, cansaço, apneia observada, pressão alta, IMC, idade, pescoço e sexo.',
  psqi: 'Questionário sobre a qualidade do sono no último mês, de 0 a 21 pontos.',
  berlim: 'Questionário de rastreio de risco para apneia obstrutiva do sono.',
  mallampati: 'Classificação da via aérea pela visualização da orofaringe, de I a IV.'
};
const AV_GRUPO_TITULO = { mob: 'Testes para Avaliação da Mobilidade e Risco de Queda', forca: 'Testes para Avaliação da Força Muscular', pulm: 'Testes para Avaliação da Função Pulmonar',
  cardio: 'Testes para Avaliação da Aptidão Cardiorrespiratória', vfc: 'Variabilidade da Frequência Cardíaca', us: 'Ultrassonografia', esc: 'Escalas e Questionários', func: 'Testes para Avaliação da Funcionalidade', sono: 'Avaliação do Sono', extra: 'Outros Testes' };

function gerarPdfAvaliacao(x){
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J){ toast('Não consegui carregar o gerador de PDF. Confira a internet e tente de novo.'); return false; }
  const v = x.av || {}, K = x.calc && x.calc.testes ? x.calc : avCalc(v);
  const doc = new J({ unit: 'mm', format: 'a4' });
  const M = 10, W = 210 - 2 * M, TOP = 10, BOT = 285, PAD = 4, IW = W - 2 * PAD;
  const C = { tx: [31, 41, 55], mut: [107, 114, 128], borda: [226, 230, 235], fundo: [248, 249, 251], barra: [55, 65, 81], res: [20, 137, 123], ref: [196, 202, 211], grade: [229, 233, 237] };
  let y = TOP;
  const lh = s => s * 0.3528 * 1.42;
  let FN = 'helvetica';
  if (FONTES_AP.normal && FONTES_AP.bold && FONTES_AP.italic) try {
    [['normal', 'NotoSans-Regular.ttf'], ['bold', 'NotoSans-Bold.ttf'], ['italic', 'NotoSans-Italic.ttf']].forEach(([st, arq]) => { doc.addFileToVFS(arq, FONTES_AP[st]); doc.addFont(arq, 'NotoSans', st); });
    FN = 'NotoSans';
  } catch(e){ FN = 'helvetica'; }
  const fonte = (s, b, cor, it) => { doc.setFont(FN, b ? 'bold' : it ? 'italic' : 'normal'); doc.setFontSize(s); doc.setTextColor(...(cor || C.tx)); };
  const novaPagina = () => { doc.addPage(); y = TOP; };
  const dataAv = v.quando ? fmtD(v.quando.slice(0, 10)) : fmtD(x.data);
  const dataHora = dataAv + (v.quando && v.quando.length > 10 ? ', ' + v.quando.slice(11, 16) : '');
  const un = (val, u) => `${val}${u ? ' ' + u : ''}`;
  const n2 = (n, c = 2) => fmtNum(n, c);

  // ----- itens que vão dentro dos cartões: cada um sabe medir a própria altura e se desenhar -----
  const paragrafo = (txt, { s = 8.6, it = false, b = false, cor } = {}) => {
    fonte(s, b, cor, it); const L = doc.splitTextToSize(String(txt), IW);
    return { h: L.length * lh(s) + 1, draw: (x0, y0) => { fonte(s, b, cor, it); L.forEach((l, i) => doc.text(l, x0, y0 + lh(s) * (i + 0.8), i < L.length - 1 && L.length > 1 ? { maxWidth: IW, align: 'justify' } : {})); } };
  };
  const sub = (rot, txt) => {
    const p = paragrafo(txt);
    return { h: 8 + p.h + 3, draw: (x0, y0) => { fonte(6.8, true, C.mut); doc.text(rot.toUpperCase(), x0, y0 + 3); doc.setDrawColor(...C.borda); doc.setLineWidth(0.2); doc.line(x0, y0 + 5, x0 + IW, y0 + 5); p.draw(x0, y0 + 7); } };
  };
  const espaco = h => ({ h, draw: () => {} });
  // junta vários itens para não separar um teste do seu gráfico entre páginas
  const junto = L => ({ h: L.reduce((a, b) => a + b.h, 0), draw: (x0, y0) => { let yy = y0; L.forEach(it => { it.draw(x0, yy); yy += it.h; }); } });
  const obs = txt => {
    fonte(8, false, C.mut, true); const L = doc.splitTextToSize(String(txt), IW - 8); const h = L.length * lh(8) + 6;
    return { h: h + 3, draw: (x0, y0) => { doc.setFillColor(...C.fundo); doc.rect(x0, y0, IW, h, 'F'); doc.setFillColor(...C.ref); doc.rect(x0, y0, 0.8, h, 'F');
      fonte(8, false, C.mut, true); L.forEach((l, i) => doc.text(l, x0 + 4, y0 + 3 + lh(8) * (i + 0.8))); } };
  };
  const tituloTeste = t => { fonte(10, true); const L = doc.splitTextToSize(t.toUpperCase(), IW); return { h: L.length * lh(10) + 2.5, draw: (x0, y0) => { fonte(10, true); L.forEach((l, i) => doc.text(l, x0, y0 + lh(10) * (i + 0.8))); } }; };
  // gráfico de colunas: resultado x referência
  // barras: [[nome, valor, cor], ...]; a última é a referência
  const graficoColunas = (nome, res, ref, barras, linha) => {
    barras = barras || [[nome, res, C.res], ['Referência', ref, C.ref]];
    const h = 50;
    return { h: h + 4, draw: (x0, y0) => {
      doc.setFillColor(...C.fundo); doc.setDrawColor(...C.borda); doc.setLineWidth(0.2); doc.roundedRect(x0, y0, IW, h, 2, 2, 'FD');
      const base = y0 + h - 15, alto = 26, max = Math.max(...barras.map(b => b[1]), linha ? linha[0] : 0) * 1.15 || 1, cx = x0 + IW / 2, bw = 6, gap = 2, x1 = cx - (barras.length * bw + (barras.length - 1) * gap) / 2;
      doc.setDrawColor(...C.grade); doc.setLineDashPattern([0.8, 0.8], 0);
      for (let i = 0; i <= 3; i++){ const gy = base - alto * i / 3; doc.line(x0 + 30, gy, x0 + IW - 30, gy); }
      doc.setLineDashPattern([], 0);
      barras.forEach(([, val, cor], i) => { const bx = x1 + i * (bw + gap), ref = /^(Referência|Predito)/.test(barras[i][0]);
        const bh = Math.max(0.6, val / max * alto); doc.setFillColor(...cor); doc.rect(bx, base - bh, bw, bh, 'F');
        fonte(7.5, true, ref ? C.mut : C.tx); doc.text(fmtNum(val, val < 10 ? 2 : 0), bx + bw / 2, base - bh - 1.6, { align: 'center' });
      });
      if (linha){ const ly0 = base - linha[0] / max * alto; doc.setDrawColor(178, 59, 59); doc.setLineWidth(0.35); doc.setLineDashPattern([1.2, 0.8], 0); doc.line(x0 + 30, ly0, x0 + IW - 30, ly0); doc.setLineDashPattern([], 0);
        fonte(6.5, false, [178, 59, 59]); doc.text(linha[1], x0 + IW - 30, ly0 - 1, { align: 'right' }); }
      fonte(7, false, C.mut); doc.text(dataAv, cx, base + 4, { align: 'center' });
      const ly = base + 10; fonte(6.8, false, C.mut);
      const tot = barras.reduce((a, b) => a + 4 + doc.getTextWidth(b[0]) + 8, -8); let lx = cx - tot / 2;
      barras.forEach(([nm, , cor]) => { doc.setFillColor(...cor); doc.rect(lx, ly - 2.2, 2.6, 2.6, 'F'); doc.text(nm, lx + 4, ly); lx += 4 + doc.getTextWidth(nm) + 8; });
    } };
  };
  // faixa de classificação com marcador do resultado
  const graficoFaixa = (val, def, u, cls) => {
    const h = 24, ZONAS = [[236, 244, 243], [205, 228, 225], [160, 205, 199], [111, 178, 169]];
    return { h: h + 4, draw: (x0, y0) => {
      doc.setFillColor(...C.fundo); doc.setDrawColor(...C.borda); doc.setLineWidth(0.2); doc.roundedRect(x0, y0, IW, h, 2, 2, 'FD');
      const a0 = x0 + 12, pw = IW - 24, by = y0 + 8, bh = 6, X = t => a0 + (Math.max(def.min, Math.min(def.max, t)) - def.min) / (def.max - def.min) * pw;
      def.cortes.forEach(([c, l], i) => {
        const a = X(Math.max(c, def.min)), b = i + 1 < def.cortes.length ? X(def.cortes[i + 1][0]) : X(def.max);
        doc.setFillColor(...ZONAS[Math.min(i, 3)]); doc.rect(a + (i ? 0.4 : 0), by, Math.max(0.2, b - a - (i ? 0.4 : 0)), bh, 'F');
        fonte(6.5, false, C.tx); if (doc.getTextWidth(l) < b - a - 1.5) doc.text(l, (a + b) / 2, by + 4.1, { align: 'center' });
        if (i){ fonte(6.5, false, C.mut); doc.text(fmtNum(c, 1), a, by + bh + 3.6, { align: 'center' }); }
      });
      const mx = X(val); doc.setFillColor(...C.res); doc.triangle(mx - 1.8, by - 3, mx + 1.8, by - 3, mx, by - 0.4, 'F');
      doc.setDrawColor(...C.res); doc.setLineWidth(0.7); doc.line(mx, by - 0.4, mx, by + bh);
      fonte(7.5, true, C.res); doc.text(`${fmtNum(val, 1)}${u ? ' ' + u : ''} · ${cls}`, x0 + IW / 2, y0 + h - 2.8, { align: 'center' });
    } };
  };
  const tabela = (cab, linhas) => {
    const lw = [IW * 0.42, IW * 0.29, IW * 0.29], rh = 7.5, tw = IW, h = rh * (linhas.length + 1);
    return { h: h + 3, draw: (x0, y0) => {
      doc.setDrawColor(...C.borda); doc.setLineWidth(0.2); doc.setFillColor(...C.fundo); doc.rect(x0, y0, tw, rh, 'F'); doc.rect(x0, y0, tw, h);
      let cx = x0; cab.forEach((c, i) => { fonte(6.8, true, i ? C.tx : C.mut); doc.text(c.toUpperCase(), i ? cx + lw[i] / 2 : cx + 3, y0 + 4.8, i ? { align: 'center' } : {}); cx += lw[i]; });
      linhas.forEach((L, r) => { const ry = y0 + rh * (r + 1); doc.line(x0, ry, x0 + tw, ry); let cx2 = x0;
        L.forEach((c, i) => { fonte(8, false, i ? C.tx : C.mut); doc.text(String(c), i ? cx2 + lw[i] / 2 : cx2 + 3, ry + 4.9, i ? { align: 'center' } : {}); cx2 += lw[i]; }); });
      let cx3 = x0; lw.slice(0, -1).forEach(w => { cx3 += w; doc.line(cx3, y0, cx3, y0 + h); });
    } };
  };

  // cartão com título e barra lateral; se não couber na página, continua em outro cartão
  const cartao = (titulo, itens) => {
    itens = itens.filter(Boolean); if (!itens.length) return;
    const TH = titulo ? 10 : PAD;
    let i = 0, primeiro = true;
    while (i < itens.length){
      if (y + TH + itens[i].h + PAD > BOT) novaPagina();
      let h = TH, j = i; while (j < itens.length && y + h + itens[j].h + PAD <= BOT){ h += itens[j].h; j++; }
      if (j === i){ h += itens[i].h; j = i + 1; }
      h += PAD - 2;
      doc.setDrawColor(...C.borda); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.25); doc.roundedRect(M, y, W, h, 2.5, 2.5, 'FD');
      if (titulo){ doc.setFillColor(...C.barra); doc.rect(M + PAD, y + 3.6, 1.1, 5, 'F'); fonte(8, true); doc.text((titulo + (primeiro ? '' : ' (continuação)')).toUpperCase(), M + PAD + 4, y + 7.4); }
      let yy = y + TH; for (let k = i; k < j; k++){ itens[k].draw(M + PAD, yy); yy += itens[k].h; }
      y += h + 4.5; i = j; primeiro = false;
    }
  };
  const cabecalhoGrupo = (t, prox = 30) => { if (y + 11 + prox > BOT) novaPagina(); fonte(9, true); doc.text(t, M, y + 4); doc.setDrawColor(...C.borda); doc.setLineWidth(0.3); doc.line(M, y + 6.5, M + W, y + 6.5); y += 11; };

  // ----- topo -----
  // mesmas medidas do relatório de referência: logo à esquerda do título, linha abaixo
  if (LOGO_AP) try { doc.addImage(LOGO_AP, 'JPEG', 64.5, 9.6, 20, 16); } catch(e){}
  fonte(10, true); doc.text('Relatório de Avaliação Funcional', LOGO_AP ? 92 : 105, 18.4, LOGO_AP ? {} : { align: 'center' });
  doc.setDrawColor(31, 48, 82); doc.setLineWidth(0.5); doc.line(M, 28.9, M + W, 28.9); y = 34;

  // ----- paciente -----
  { const h = 21.2; doc.setFillColor(...C.fundo); doc.setDrawColor(...C.borda); doc.setLineWidth(0.25); doc.roundedRect(M, y, W, h, 2, 2, 'FD');
    fonte(10.5, true); doc.text(x.pnome || '', M + PAD, y + 6.2);
    const cols = [['Idade', K.idade != null ? K.idade + ' anos' : '—'], ['Nascimento', v.nasc ? fmtD(v.nasc) : '—'], ['Sexo', v.sexo ? rotulo(AV_SEXO, v.sexo) : '—'], ['Avaliação', dataHora]];
    cols.forEach(([r, val], i) => { const cx = M + PAD + i * 47.2; fonte(5.8, true, C.mut); doc.text(r.toUpperCase(), cx, y + 13.4, { charSpace: 0.25 }); fonte(8, false); doc.text(val, cx, y + 17.5); });
    y += h + 5; }

  // ----- anamnese -----
  const comorb = (v.comorb || []).map(c => rotulo(AV_COMORB, c)).join(', ');
  const respTxt = [v.respiracao ? rotulo(AV_RESP, v.respiracao) : '', v.protese ? 'prótese ventilatória: ' + v.protese : ''].filter(Boolean).join('; ');
  cartao('Anamnese', [
    v.diag && sub('Diagnósticos clínicos', v.diag), v.queixa && sub('Queixa principal', v.queixa), v.hda && sub('História da doença atual', v.hda),
    v.hdp && sub('História da doença pregressa', v.hdp), v.antfam && sub('Antecedentes familiares', v.antfam), comorb && sub('Comorbidades', comorb),
    v.farmacos && sub('Fármacos em uso', v.farmacos), v.equipe && sub('Equipe assistencial', v.equipe), v.examefis && sub('Exame físico', v.examefis),
    v.evolucao && sub('Evolução', rotulo(AV_EVOL, v.evolucao)), respTxt && sub('Respiração', respTxt),
    v.situacao && sub('Situação', rotulo(AV_SITUACAO, v.situacao))
  ]);

  // ----- dados vitais -----
  const vit = AV_VITAIS.filter(([k]) => v[k]).map(([k, l, u]) => `${l} ${v[k]} ${u}`).join('   •   ');
  cartao('Dados vitais', [vit && paragrafo(vit, { s: 8.6 }), v.ausculta && sub('Ausculta pulmonar', v.ausculta), v.pmv && sub('Padrão muscular ventilatório', v.pmv)]);

  // ----- composição corporal -----
  const linhas = [];
  if (v.altura) linhas.push(['Altura', fmtNum(num(v.altura) / 100, 2) + ' m', '—']);
  if (v.massa) linhas.push(['Massa corporal', fmtNum(num(v.massa), 1) + ' kg', '—']);
  if (K.imc) linhas.push(['IMC', fmtNum(K.imc.valor, 2) + ' kg/m²', K.imc.cls]);
  if (v.pescoco) linhas.push(['Circunferência do pescoço', fmtNum(num(v.pescoco), 1) + ' cm', '—']);
  if (v.cintura) linhas.push(['Circunferência da cintura', fmtNum(num(v.cintura), 1) + ' cm', '—']);
  if (v.quadril) linhas.push(['Circunferência do quadril', fmtNum(num(v.quadril), 1) + ' cm', '—']);
  if (K.rcq != null) linhas.push(['Relação cintura-quadril', fmtNum(K.rcq, 2), '—']);
  cartao('Composição corporal', [linhas.length && tabela(['Indicador', dataAv, 'Classificação'], linhas),
    K.imc && paragrafo(`Classificação do IMC: ${K.imc.fonte}${K.imc.aviso ? '. Atenção: ' + K.imc.aviso : ''}.`, { s: 7.2, cor: C.mut, it: true }),
    v.fonte && paragrafo('Fonte dos dados: ' + v.fonte, { s: 7.2, cor: C.mut, it: true })]);

  // ----- testes: um cartão por grupo -----
  AV_GRUPOS.forEach(G => {
    let itens = [];
    G.itens.forEach(([id, nome, u0, , tipo]) => {
      // só entram os testes marcados na avaliação
      if (!avMarcados(v).includes(id)) return;
      const tem = ['r', 'p', 'o', 'n'].some(s => v[`t_${id}_${s}`]);
      const t = K.testes[id] || {}, u = tipo === 'extra' ? (v[`t_${id}_u`] || '') : u0, nm = tipo === 'extra' ? (v[`t_${id}_n`] || nome) : nome;
      const todos = itens; itens = [];
      if (todos.length) itens.push(espaco(4));
      itens.push(tituloTeste(nm));
      const refs = [t.fonte, t.fonteCls].filter(Boolean).join('; ');
      const desc = [AV_DESC[id] || '', refs ? `(${refs})` : ''].filter(Boolean).join(' ');
      if (desc) itens.push(paragrafo(desc), espaco(1.5));
      if (!tem) itens.push(paragrafo('Resultado não registrado.', { s: 8, it: true, cor: C.mut }));
      else if (tipo === 'txt'){ if (v[`t_${id}_r`]) itens.push(paragrafo(v[`t_${id}_r`])); }
      else {
        const r = num(v[`t_${id}_r`]);
        const partes = [r != null ? `Valor obtido${id === 'preensao' && avMaos(v).usada ? ' (mão ' + avMaos(v).usada + ')' : ''}: ${un(fmtNum(r, 2), u)}` : '', t.pct != null ? `${fmtNum(t.pct, 0)}% do predito` : '',
          t.pred != null ? `Valor de referência (predito): ${un(n2(t.pred), u)}` : '', t.lin != null ? `Limite inferior: ${un(fmtNum(t.lin, 0), u)}` : '', t.cls ? `Classificação: ${t.cls}` : ''].filter(Boolean);
        if (partes.length) itens.push(paragrafo(partes.join('; ') + '.', { b: true }));
        if (t.aviso) itens.push(paragrafo('Atenção: ' + t.aviso + '.', { s: 7.4, it: true, cor: C.mut }));
        if (t.falta) itens.push(paragrafo('Predito não calculado: faltou ' + t.falta.join(', ') + '.', { s: 7.4, it: true, cor: C.mut }));
        if (!t.fonte && t.pred != null) itens.push(paragrafo('Valor de referência informado pela fisioterapeuta.', { s: 7.4, it: true, cor: C.mut }));
        itens.push(espaco(1.5));
        const maos = id === 'preensao' ? avMaos(v) : null;
        if (maos && maos.lista.length){
          if (t.maos) t.maos.forEach(m => itens.push(paragrafo(`Mão ${m.l}${m.dom ? ' (dominante)' : ' (não dominante)'}: ${fmtNum(m.val, 2)} ${u}; predito ${fmtNum(m.pred, 2)} ${u}; ${fmtNum(m.pct, 0)}% do predito.`)));
          else itens.push(paragrafo(maos.lista.map(([l, val]) => `Mão ${l}: ${fmtNum(val, 2)} ${u}`).join('; ') + (maos.dom ? `; mão dominante: ${maos.dom}` : '') + '.'));
          if (t.corte) itens.push(paragrafo(`Ponto de corte para força reduzida: ${t.corte} kgf (EWGSOP2).`, { s: 7.4, it: true, cor: C.mut }));
        }
        // preensão: gráfico com as mãos testadas, com a referência quando houver predito
        if (maos && t.maos) itens.push(graficoColunas('', 0, 0, t.maos.flatMap(m => [['Mão ' + m.l, m.val, m.l === 'esquerda' ? [122, 91, 196] : [15, 143, 127]], ['Predito ' + m.l, m.pred, C.ref]]), t.corte ? [t.corte, `corte EWGSOP2: ${t.corte} kgf`] : null));
        else if (maos && maos.lista.length) itens.push(graficoColunas('', 0, 0, [...maos.lista.map(([l, val]) => ['Mão ' + l, val, l === 'esquerda' ? [122, 91, 196] : [15, 143, 127]]), ...(t.pred > 0 ? [['Referência', t.pred, C.ref]] : [])]));
        else if (r != null && t.pred > 0) itens.push(graficoColunas(tipo === 'extra' ? 'Resultado' : nm.split(' (')[0].length <= 14 ? nm : 'Resultado', r, t.pred));
        else if (r != null && t.cls) itens.push(graficoFaixa(r, AV_CLS[id], u, t.cls));
      }
      if (v[`t_${id}_o`]) itens.push(obs(v[`t_${id}_o`]));
      todos.push(junto(itens)); itens = todos;
    });
    if (itens.length){ cabecalhoGrupo(AV_GRUPO_TITULO[G.g] || G.t, Math.min(itens[0].h + 2 * PAD, BOT - TOP - 11)); cartao('', itens); }
  });

  // ----- planejamento -----
  if (v.diagfisio || v.objetivos || v.conclusao){
    cabecalhoGrupo('Planejamento e Diagnóstico');
    if (v.diagfisio) cartao('Diagnóstico fisioterapêutico', [paragrafo(v.diagfisio)]);
    if (v.objetivos) cartao('Objetivos terapêuticos', [paragrafo(v.objetivos)]);
    if (v.conclusao) cartao('Conclusão', [paragrafo(v.conclusao)]);
  }
  { if (y + 15 > 290) novaPagina(); y += 2; doc.setDrawColor(...C.borda); doc.setFillColor(255, 255, 255); doc.roundedRect(M, y, W, 13, 2.5, 2.5, 'FD');
    fonte(8, false, C.mut); const pre = 'Profissional responsável: '; doc.text(pre, M + PAD + 2, y + 8); fonte(8, true, C.barra); doc.text(v.fisio || x.fisio || '', M + PAD + 2 + doc.getTextWidth(pre) + 0.5, y + 8); }

  // marca d'água e número da página
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++){
    doc.setPage(i);
    if (LOGO_AP && doc.GState) try { doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.07 })); doc.addImage(LOGO_AP, 'JPEG', 50, 105, 110, 88); doc.restoreGraphicsState(); } catch(e){}
    if (n > 1){ fonte(7, false, C.mut); doc.text(`${i} / ${n}`, M + W, 292, { align: 'right' }); }
  }
  doc.save(`Avaliacao AP - ${(x.pnome || 'paciente').replace(/[\\/:*?"<>|]/g, '')} - ${x.data || ''}.pdf`.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  return true;
}
