// ---------- TEXTO FORMATADO (campos da avaliação) ----------
// Negrito, itálico, sublinhado, tamanho da letra, alinhamento, citação e lista.
// O texto é guardado como HTML limpo: só as marcações abaixo passam; o resto vira texto simples.
const RT_BLOCOS = ['P', 'DIV', 'BLOCKQUOTE', 'UL', 'OL', 'LI'];
const RT_INLINE = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u' };
const RT_ALINHA = ['left', 'center', 'right', 'justify'];
const rtTemHtml = s => typeof s === 'string' && /<\/?(p|div|blockquote|ul|ol|li|b|i|u|font|br)\b/i.test(s);
// texto antigo (sem formatação) vira parágrafos
const rtDeTexto = s => String(s || '').split(/\n/).map(l => `<div>${esc(l) || '<br>'}</div>`).join('');
const rtHtml = s => !s ? '' : rtTemHtml(s) ? rtLimpar(s) : rtDeTexto(s);

function rtLimpar(html){
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const sai = document.createElement('div');
  const copiar = (de, para) => {
    de.childNodes.forEach(n => {
      if (n.nodeType === 3){ para.appendChild(document.createTextNode(n.data)); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName; let novo = null;
      if (tag === 'BR') novo = document.createElement('br');
      else if (RT_BLOCOS.includes(tag)) novo = document.createElement(tag === 'P' ? 'div' : tag.toLowerCase());
      else if (RT_INLINE[tag]) novo = document.createElement(RT_INLINE[tag]);
      else if (tag === 'FONT' && /^[1-7]$/.test(n.getAttribute('size') || '')){ novo = document.createElement('font'); novo.setAttribute('size', n.getAttribute('size')); }
      else if (tag === 'SPAN' || tag === 'FONT'){ // estilos de span vindos de colagem: só negrito/itálico/sublinhado
        const st = n.getAttribute('style') || ''; let alvo = para;
        if (/font-weight:\s*(bold|[6-9]00)/i.test(st)){ const b = document.createElement('b'); alvo.appendChild(b); alvo = b; }
        if (/font-style:\s*italic/i.test(st)){ const i = document.createElement('i'); alvo.appendChild(i); alvo = i; }
        if (/text-decoration[^;]*underline/i.test(st)){ const u = document.createElement('u'); alvo.appendChild(u); alvo = u; }
        copiar(n, alvo); return;
      }
      if (!novo){ copiar(n, para); return; }
      if (RT_BLOCOS.includes(tag)){
        const al = ((n.getAttribute('style') || '').match(/text-align:\s*(\w+)/i) || [])[1] || n.getAttribute('align') || '';
        if (RT_ALINHA.includes(al.toLowerCase())) novo.setAttribute('style', `text-align:${al.toLowerCase()}`);
      }
      para.appendChild(novo); copiar(n, novo);
    });
  };
  copiar(doc.body.firstChild, sai);
  return sai.innerHTML;
}
const rtVazio = el => !(el.textContent || '').trim();

// barra de ferramentas (aparece quando o campo está em uso)
const RT_BOTOES = [
  ['bold', '<b>N</b>', 'Negrito'], ['italic', '<i>I</i>', 'Itálico'], ['underline', '<u>S</u>', 'Sublinhado'],
  ['menor', 'A−', 'Diminuir a letra'], ['maior', 'A+', 'Aumentar a letra'],
  ['justifyLeft', '<span class="al al-e"></span>', 'Alinhar à esquerda'], ['justifyCenter', '<span class="al al-c"></span>', 'Centralizar'],
  ['justifyRight', '<span class="al al-d"></span>', 'Alinhar à direita'], ['justifyFull', '<span class="al al-j"></span>', 'Justificar'],
  ['citacao', '❝', 'Citação'], ['insertUnorderedList', '•≡', 'Lista']
];
const rtBarra = id => `<div class="rt-bar" data-for="${id}" role="toolbar" aria-label="Formatação do texto">${RT_BOTOES.map(([c, ic, t]) => `<button type="button" class="rt-b" data-rt="${c}" title="${t}" aria-label="${t}">${ic}</button>`).join('')}</div>`;
const rtCampo = (id, k, valor, ph) => rtBarra(id) + `<div class="rt" id="${id}" data-k="${k}" data-rico="1" contenteditable="true" role="textbox" aria-multiline="true" ${ph ? `data-ph="${esc(ph)}"` : ''}>${rtHtml(valor)}</div>`;

function rtComando(btn){
  const el = document.getElementById(btn.closest('.rt-bar').dataset.for); if (!el) return;
  if (document.activeElement !== el && !el.contains(document.activeElement)) el.focus();
  try { document.execCommand('styleWithCSS', false, false); } catch(e){}
  const c = btn.dataset.rt;
  if (c === 'maior' || c === 'menor'){
    const atual = Number(document.queryCommandValue('fontSize')) || 3;
    document.execCommand('fontSize', false, String(Math.max(2, Math.min(5, atual + (c === 'maior' ? 1 : -1)))));
  } else if (c === 'citacao'){
    const bloco = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    document.execCommand('formatBlock', false, bloco === 'blockquote' ? 'div' : 'blockquote');
  } else document.execCommand(c, false, null);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
// os botões não tiram o foco do texto (assim a seleção continua marcada)
document.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('.rt-b'); if (b) e.preventDefault(); });
document.addEventListener('mousedown', e => { const b = e.target.closest && e.target.closest('.rt-b'); if (b) e.preventDefault(); });
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.rt-b'); if (b){ e.preventDefault(); rtComando(b); } });
// colar: limpa a formatação que vem de outros programas
document.addEventListener('paste', e => {
  const el = e.target.closest && e.target.closest('.rt[contenteditable="true"]'); if (!el) return;
  e.preventDefault();
  const html = e.clipboardData.getData('text/html'), txt = e.clipboardData.getData('text/plain');
  document.execCommand('insertHTML', false, html ? rtLimpar(html) : rtDeTexto(txt));
});

// ----- para o PDF: transforma o HTML em blocos com trechos de texto -----
// bloco: { alinha, citacao, lista (marcador), trechos: [{ t, b, i, u, tam }] }
function rtBlocos(valor){
  const html = rtHtml(valor); if (!html) return [];
  const raiz = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstChild;
  const blocos = []; let atual = null;
  const novo = (ctx) => { atual = { alinha: ctx.alinha || '', citacao: !!ctx.citacao, lista: ctx.lista || '', trechos: [] }; blocos.push(atual); };
  const andar = (n, ctx, est) => {
    if (n.nodeType === 3){ if (!atual) novo(ctx); if (n.data) atual.trechos.push(Object.assign({ t: n.data.replace(/\s+/g, ' ') }, est)); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName, al = ((n.getAttribute('style') || '').match(/text-align:\s*(\w+)/) || [])[1];
    if (tag === 'BR'){ if (!atual) novo(ctx); atual.trechos.push({ t: '\n' }); return; }
    if (tag === 'UL' || tag === 'OL'){ let i = 0; n.childNodes.forEach(c => { i++; andar(c, Object.assign({}, ctx, { lista: tag === 'OL' ? i + '.' : '•' }), est); }); atual = null; return; }
    if (RT_BLOCOS.includes(tag)){
      const c2 = Object.assign({}, ctx, al ? { alinha: al } : {}, tag === 'BLOCKQUOTE' ? { citacao: true } : {});
      atual = null; novo(c2); n.childNodes.forEach(c => andar(c, c2, est)); atual = null; return;
    }
    const e2 = Object.assign({}, est);
    if (tag === 'B') e2.b = true; if (tag === 'I') e2.i = true; if (tag === 'U') e2.u = true;
    if (tag === 'FONT') e2.tam = Number(n.getAttribute('size')) || 3;
    n.childNodes.forEach(c => andar(c, ctx, e2));
  };
  raiz.childNodes.forEach(c => andar(c, {}, {}));
  return blocos.filter(b => b.trechos.some(t => t.t.trim()));
}
// texto sem formatação (para listas e buscas)
const rtTexto = valor => rtBlocos(valor).map(b => b.trechos.map(t => t.t).join('').trim()).join('\n');
