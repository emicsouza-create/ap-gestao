// Guarda as telas do app para abrir rápido. Os dados sempre vêm do banco (nada de paciente fica guardado aqui).
const CACHE = 'ap-gestao-v13';
const ARQUIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'contrato.js', 'avaliacao.js', 'relatorio.js', 'icons/logo-ap.jpg', 'fonts/NotoSans_400Regular.ttf', 'fonts/NotoSans_700Bold.ttf', 'fonts/NotoSans_400Regular_Italic.ttf', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // banco, fotos e áudios: sempre direto da internet
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
