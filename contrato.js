// Contrato de Prestação de Serviços de Fisioterapia Domiciliar (versão revisada, out/2026)
// Decisões tomadas pela gestão: férias coletivas descontadas proporcionalmente; reajuste anual pelo IPCA.
// O texto segue a minuta revisada, que ainda deve passar pela análise de advogado.

function extenso(n){
  const u = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const d = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const c = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
  const ate999 = x => {
    if (x === 0) return ''; if (x === 100) return 'cem';
    const ci = Math.floor(x / 100), r = x % 100, p = [];
    if (ci) p.push(c[ci]);
    if (r) p.push(r < 20 ? u[r] : (r % 10 ? d[Math.floor(r/10)] + ' e ' + u[r % 10] : d[Math.floor(r/10)]));
    return p.join(' e ');
  };
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zero';
  const mi = Math.floor(n / 1000000), mil = Math.floor((n % 1000000) / 1000), r = n % 1000;
  const partes = [];
  if (mi) partes.push(mi === 1 ? 'um milhão' : ate999(mi) + ' milhões');
  if (mil) partes.push(mil === 1 ? 'mil' : ate999(mil) + ' mil');
  if (r) partes.push(((mi || mil) && (r < 100 || r % 100 === 0) ? 'e ' : '') + ate999(r));
  return partes.join(' ');
}
function reaisExtenso(v){
  const cent = Math.round((Number(v) || 0) * 100), r = Math.floor(cent / 100), c = cent % 100;
  let s = r ? extenso(r) + (r === 1 ? ' real' : (r % 1000000 === 0 ? ' de reais' : ' reais')) : '';
  if (c) s += (s ? ' e ' : '') + extenso(c) + (c === 1 ? ' centavo' : ' centavos');
  return s || 'zero reais';
}
const pctExtenso = x => Number.isInteger(Number(x)) ? `${x}% (${extenso(Number(x))} por cento)` : `${String(x).replace('.', ',')}%`;

function textoContrato(p, pl, C){
  const L = (v, n) => (v && String(v).trim()) ? String(v).trim() : '_'.repeat(n || 30);
  const valor = Number(pl.valor) || 0;
  const freq = p.frequencia || '';
  const forma = ({'Pix':'Pix','Boleto':'boleto','Transferência':'transferência','Home care / convênio':'pagamento direto pelo home care ou convênio'})[pl.forma] || 'Pix, boleto ou transferência';
  const hoje = new Date();
  return [
    ['t', 'Contrato de Prestação de Serviços de Fisioterapia Domiciliar'],
    ['h', 'Partes'],
    ['p', `CONTRATANTE (responsável pelo paciente): Nome: ${L(p.responsavel || pl.pagador, 40)}. CPF/CNPJ: ${L(pl.cpf, 22)}. Endereço: ${L(pl.endResp || p.endereco, 45)}. Telefone: ${L(p.telefone, 18)}. E-mail: ${L(pl.email, 28)}.`],
    ['p', `PACIENTE (quando diferente do Contratante): Nome: ${L(p.nome, 40)}. Data de nascimento: ${pl.nasc ? fmtD(pl.nasc) : '____/____/________'}. Grau de parentesco ou vínculo com o Contratante: ${L(pl.parentesco, 22)}.`],
    ['p', 'CONTRATADA: AP Fisioterapia Domiciliar Ltda., CNPJ 48.837.738/0001-34, com sede em Cascavel/PR, telefone (45) 99917-2888.'],
    ['h', '1. Objeto'],
    ['p', '1.1 O presente contrato tem como objeto a prestação de serviços de fisioterapia domiciliar pela Contratada ao Paciente, em sessões com duração média de 40 a 60 minutos cada.'],
    ['p', '1.2 A fisioterapia é uma atividade de meio, e não de resultado. A Contratada compromete-se a empregar os melhores recursos técnicos e a diligência profissional, sem garantir a cura, a melhora ou um resultado específico, que dependem das condições clínicas do Paciente.'],
    ['h', '2. Obrigações da Contratada'],
    ['p', '2.1 A Contratada se obriga a:'],
    ['i', 'a) Prestar seus serviços utilizando o melhor material e as técnicas que julgar adequadas ao tratamento, observando as particularidades do Paciente (idade, peso, condições clínicas e de saúde), em ambiente adequado ao atendimento fisioterapêutico;'],
    ['i', 'b) Orientar e acompanhar a execução de atividades, exercícios e movimentos adequados, com técnica e profissionalismo;'],
    ['i', 'c) Manter registro do atendimento e da evolução do Paciente;'],
    ['i', 'd) Fornecer aparelhos e equipamentos de uso coletivo para uso durante a sessão;'],
    ['i', 'e) Comunicar com antecedência o horário aproximado de atendimento, considerando deslocamento, trânsito e condições climáticas.'],
    ['h', '3. Obrigações do Contratante'],
    ['p', '3.1 O Contratante se obriga a:'],
    ['i', 'a) Fornecer todas as informações médicas, relatórios, prescrições e equipamentos de uso individual necessários para a execução dos serviços, e manter essas informações atualizadas;'],
    ['i', 'b) Efetuar os pagamentos conforme estabelecido na cláusula 6;'],
    ['i', 'c) Responder prontamente a dúvidas ou solicitações da Contratada, para garantir a fluidez do trabalho;'],
    ['i', 'd) Garantir o acompanhamento de um terceiro (familiar ou cuidador) durante a sessão, para receber orientações e informar a rotina do Paciente;'],
    ['i', 'e) Estar no domicílio indicado para receber o profissional, com tolerância de 15 (quinze) minutos de atraso, sob pena de cobrança do valor integral da sessão;'],
    ['i', 'f) Comunicar de imediato à Contratada qualquer mudança no quadro de saúde do Paciente, internação, uso de novos medicamentos ou equipamentos, e fornecer o contato de emergência da família e do médico responsável.'],
    ['h', '4. Remarcação, faltas, feriados, férias e internação'],
    ['p', '4.1 O Contratante poderá solicitar a remarcação de sessões mediante aviso prévio de, no mínimo, 6 (seis) horas corridas antes do horário agendado.'],
    ['p', '4.2 A remarcação depende da disponibilidade da equipe da Contratada, e o Contratante deve colaborar na escolha de nova data e horário dentro da mesma semana ou da semana seguinte.'],
    ['p', '4.3 Cancelamentos ou ausências sem o aviso previsto no item 4.1 serão cobrados integralmente.'],
    ['p', '4.4 Feriados. Não há atendimento em feriados, e as sessões correspondentes não são repostas. O valor mensal considera a média anual de sessões, de modo que alguns meses terão mais atendimentos e outros menos.'],
    ['p', '4.5 Férias coletivas. A Contratada poderá interromper os atendimentos por até 1 (uma) semana por ano, para férias coletivas, com aviso prévio de 30 (trinta) dias. Pacientes em condição clínica grave, como os dependentes de traqueostomia ou de suporte ventilatório, terão seus atendimentos mantidos normalmente nesse período, a critério clínico da Contratada. As sessões não realizadas em razão das férias coletivas serão descontadas proporcionalmente do valor mensal.'],
    ['p', '4.6 Viagem ou ausência do Paciente. Em caso de viagem ou ausência prevista do Paciente ou do Contratante, este deverá comunicar a Contratada com antecedência mínima de 7 (sete) dias, a fim de que as partes combinem o adiantamento de sessões ou a passagem de atividades para o Paciente realizar de forma individual. Como os horários reservados são exclusivos, as sessões do período de ausência não comunicado com essa antecedência serão cobradas normalmente.'],
    ['p', '4.7 Internação ou emergência. Em caso de internação ou emergência, o Contratante deverá comunicar a Contratada imediatamente. As sessões do período de internação, comunicado nos termos deste item, não serão cobradas a partir da data da comunicação. Após a alta, o atendimento será retomado, podendo a Contratada realizar nova avaliação.'],
    ['h', '5. Equipe, substituição e atendimento exclusivo'],
    ['p', '5.1 Os atendimentos poderão ser realizados por qualquer fisioterapeuta do quadro da Contratada, de acordo com o perfil do caso, a agenda e a necessidade clínica.'],
    ['p', '5.2 A Contratada poderá substituir o profissional responsável por motivo de agenda, licença, férias, afastamento ou necessidade clínica, comunicando o Contratante previamente sempre que possível, e garantindo a continuidade do tratamento por profissional habilitado.'],
    ['p', `5.3 Atendimento exclusivo (opcional). (${p.exclusivo ? 'X' : '  '}) O Contratante opta pelo atendimento exclusivo com a fisioterapeuta Ana Paula Morona, mediante o valor diferenciado indicado na cláusula 6. Se a profissional estiver impossibilitada de atender por licença, saúde ou força maior, a Contratada comunicará o Contratante, e as partes combinarão, por escrito, como será mantido o atendimento nesse período, podendo o Contratante aceitar a substituição temporária ou suspender as sessões sem cobrança durante o período de impossibilidade.`],
    ['h', '6. Remuneração'],
    ['p', `6.1 Pelos serviços prestados, o Contratante pagará à Contratada o valor de ${valor ? brl(valor) + ' (' + reaisExtenso(valor) + ')' : 'R$ ____________ (________________________________)'}, referente a:`],
    ['i', `(${freq ? '  ' : '  '}) sessão única;`],
    ['i', `(${freq ? 'X' : '  '}) pacote mensal com ${freq || '____'} sessões por semana (frequência combinada: ${freq || '____'} vezes por semana).`],
    ['p', `6.2 O pagamento do pacote mensal deverá ser feito entre os dias 10 e ${C.vencDia || 15} de cada mês, por ${forma}, conforme os dados informados pela Contratada.`],
    ['p', `6.3 O atraso no pagamento sujeita o Contratante a multa de ${pctExtenso(C.multa)} sobre o valor devido, juros de ${pctExtenso(C.juros)} ao mês e correção monetária pelo índice IPCA.`],
    ['p', '6.4 O valor será reajustado a cada 12 (doze) meses, contados do início do contrato, pelo índice IPCA, ou por outro percentual acordado por escrito. Mudanças na frequência semanal ou na complexidade do atendimento poderão motivar nova proposta de valor, a ser acordada entre as partes.'],
    ['p', '6.5 Quando parte do valor for paga diretamente por plano de saúde ou por terceiro, o Contratante permanece responsável pela parcela não coberta e por qualquer valor que o plano ou o terceiro deixe de pagar, salvo ajuste diverso por escrito.'],
    ['h', '7. Prazo e rescisão'],
    ['p', `7.1 O presente contrato tem início em ${p.inicio ? fmtD(p.inicio) : '____/____/________'} e vigência por prazo indeterminado, com renovação mensal automática.`],
    ['p', '7.2 Qualquer das partes poderá rescindir o contrato mediante aviso prévio de 30 (trinta) dias, por escrito (inclusive por mensagem eletrônica), sendo devidas as sessões realizadas e as agendadas durante o período do aviso.'],
    ['p', '7.3 O contrato se encerra automaticamente, sem multa nem aviso prévio, em caso de alta fisioterapêutica ou falecimento do Paciente, sendo devidos apenas os valores relativos às sessões realizadas até a data do encerramento.'],
    ['p', '7.4 A Contratada poderá suspender os atendimentos em caso de atraso no pagamento superior a 30 (trinta) dias, ou rescindir o contrato de imediato em caso de descumprimento grave das obrigações do Contratante, ou de situação que coloque em risco a segurança dos profissionais.'],
    ['h', '8. Confidencialidade e proteção de dados (LGPD)'],
    ['p', '8.1 A Contratada compromete-se a manter sigilo sobre todas as informações e documentos recebidos do Contratante e referentes ao Paciente, não os divulgando a terceiros sem autorização por escrito, salvo nos casos previstos em lei ou necessários ao cuidado do Paciente.'],
    ['p', '8.2 O Contratante declara ser o Paciente ou seu responsável legal, e consente que a Contratada trate os dados pessoais e os dados de saúde do Paciente (dados sensíveis, nos termos da Lei nº 13.709/2018, a LGPD) para as finalidades de prestação do serviço, registro da evolução, cobrança e cumprimento de obrigações legais e profissionais.'],
    ['p', '8.3 A Contratada poderá compartilhar as informações estritamente necessárias com médicos e profissionais que acompanham o Paciente, com planos de saúde, quando houver cobertura, e com sua equipe, sempre limitando o acesso ao necessário. O Contratante pode solicitar à Contratada, a qualquer tempo, informações sobre o tratamento dos dados e exercer os direitos previstos em lei.'],
    ['h', '9. Intercorrências e emergências'],
    ['p', '9.1 Se houver intercorrência clínica durante a sessão, o profissional adotará as condutas de sua competência e acionará o serviço de urgência (SAMU 192 ou equivalente) e o familiar ou contato de emergência indicado pelo Contratante.'],
    ['p', '9.2 O Contratante declara ter informado, de forma completa e verdadeira, o histórico clínico, os medicamentos, os equipamentos e as restrições do Paciente, e reconhece que a Contratada não responde por consequências decorrentes de informações omitidas ou incorretas.'],
    ['h', '10. Uso de imagem'],
    ['p', '10.1 Durante o atendimento, a Contratada poderá registrar fotografias, vídeos e outras imagens do Paciente e do caso clínico, mediante autorização expressa do Contratante, concedida separadamente para cada finalidade abaixo:'],
    ['i', 'A) Finalidade didática e científica (aulas, palestras, cursos, congressos, livros, artigos e revistas científicas):'],
    ['i', '(   ) Autorizo, com a possibilidade de o rosto do Paciente ser mostrado.   (   ) Autorizo, sem identificação do rosto.   (   ) Não autorizo.'],
    ['i', 'B) Divulgação comercial do trabalho da Contratada (redes sociais, site e materiais de divulgação):'],
    ['i', '(   ) Autorizo, com a possibilidade de o rosto do Paciente ser mostrado.   (   ) Autorizo, sem identificação do rosto.   (   ) Não autorizo.'],
    ['p', '10.2 A autorização é gratuita, não gera direito a ressarcimento ou remuneração, e pode ser revogada a qualquer momento, por escrito, sem ônus nem prejuízo ao atendimento. A revogação produz efeitos a partir da comunicação, e a Contratada retirará, sempre que possível, os materiais já divulgados que estejam sob seu controle.'],
    ['h', '11. Disposições gerais'],
    ['p', '11.1 Este contrato constitui o entendimento completo entre as partes e substitui quaisquer acordos, negociações ou discussões anteriores.'],
    ['p', '11.2 Qualquer alteração só será válida se feita por escrito e aceita por ambas as partes, inclusive por meio eletrônico.'],
    ['p', '11.3 As partes reconhecem a validade da assinatura eletrônica e do aceite por meios digitais.'],
    ['p', '11.4 Em caso de controvérsia, as partes elegem o foro da Comarca de Cascavel/PR.'],
    ['p', 'Por estarem assim justas e contratadas, assinam o presente contrato em duas vias de igual teor e forma.'],
    ['d', `Cascavel, ${hoje.getDate()} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}.`],
    ['s', [`CONTRATANTE: ${L(p.responsavel || pl.pagador, 30)}`, 'AP FISIOTERAPIA DOMICILIAR LTDA. (CONTRATADA)']]
  ];
}

function gerarContrato(pid, p0, pl0){
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J){ toast('Não consegui carregar o gerador de PDF. Confira a internet e tente de novo.'); return false; }
  const p = Object.assign({}, S.pacientes[pid] || {}, p0 || {}), pl = Object.assign({}, S.planos[pid] || {}, pl0 || {}), C = cfg();
  const doc = new J({ unit: 'mm', format: 'a4' });
  const M = 22, W = 210 - 2 * M, TOP = 22, BOT = 280;
  let y = TOP;
  const linha = (size) => size * 0.3528 * 1.38;
  const escreve = (txt, { size = 10, bold = false, indent = 0, after = 2, align = 'left' } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    const ls = doc.splitTextToSize(txt, W - indent);
    ls.forEach(l => { if (y > BOT){ doc.addPage(); y = TOP; } doc.text(l, align === 'center' ? 105 : M + indent, y, { align }); y += linha(size); });
    y += after;
  };
  for (const [tipo, conteudo] of textoContrato(p, pl, C)){
    if (tipo === 't'){ escreve(conteudo, { size: 15, bold: true, after: 2, align: 'center' }); escreve('AP Fisioterapia Domiciliar Ltda.', { size: 10, after: 6, align: 'center' }); }
    else if (tipo === 'h'){ if (y > BOT - 20){ doc.addPage(); y = TOP; } y += 2; escreve(conteudo, { size: 11, bold: true, after: 1.5 }); }
    else if (tipo === 'p') escreve(conteudo, { after: 2 });
    else if (tipo === 'i') escreve(conteudo, { indent: 6, after: 1.2 });
    else if (tipo === 'd'){ y += 4; escreve(conteudo, { after: 6 }); }
    else if (tipo === 's'){
      if (y > BOT - 50){ doc.addPage(); y = TOP; }
      for (const nome of conteudo){ y += 14; doc.setLineWidth(0.3); doc.line(M, y, M + 110, y); y += 5; escreve(nome, { size: 9.5, after: 2 }); }
    }
  }
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++){ doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120); doc.text(`Contrato · ${p.nome || ''} · página ${i} de ${n}`, 105, 290, { align: 'center' }); doc.setTextColor(0); }
  doc.save(`Contrato AP - ${(p.nome || 'paciente').replace(/[\\/:*?"<>|]/g, '')}.pdf`.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  return true;
}
