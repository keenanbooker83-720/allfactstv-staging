/* All Facts TV emergency shell. No SDK, framework, token or third-party build dependency. */
const state = { films: [], view: 'all', query: '', source: 'none' };
const $ = id => document.getElementById(id);
const safeHttps = value => {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : ''; }
  catch { return ''; }
};
const safeCheckout = value => {
  const url = safeHttps(value);
  if (!url) return '';
  const host = new URL(url).hostname.toLowerCase();
  return host === 'buy.stripe.com' || host === 'checkout.stripe.com' ? url : '';
};
function readyToBuy(film) {
  // An independent copy of the site must have its own validated entitlement/playback path.
  return film.type === 'paid' && film.checkoutReady === true &&
    film.independentPlaybackReady === true && !!safeCheckout(film.purchaseUrl) &&
    !!safeHttps(film.previewUrl) && /^\d{4}-\d\d-\d\d/.test(film.verifiedAt || '');
}
function readyToWatch(film) { return film.type === 'free' && !!safeHttps(film.freeVideoUrl); }
function node(tag, cls, text) {
  const el = document.createElement(tag); if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text; return el;
}
function btn(text, handler, cls = '') {
  const el = node('button', cls, text); el.type = 'button'; el.addEventListener('click', handler); return el;
}
function closeMenu() { $('sidebar').classList.remove('open'); $('scrim').hidden = true; $('menu-toggle').setAttribute('aria-expanded', 'false'); }
function pickView(view) {
  state.view = view; state.query = ''; $('query').value = ''; closeMenu();
  document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  render(); $('library').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function subjectNames() {
  return [...new Set(state.films.map(x => x.category).filter(Boolean))].sort((a,b) => a.localeCompare(b));
}
function renderNav() {
  const nav = $('subjects'); nav.replaceChildren();
  subjectNames().forEach(c => {
    const b = btn('•  ' + c, () => pickView('subject:' + c)); b.dataset.view = 'subject:' + c; nav.append(b);
  });
}
function cover(film) {
  const box = node('div', 'cover');
  const src = safeHttps(film.posterUrl);
  const fallback = node('div', 'placeholder', 'ALL FACTS');
  box.append(fallback);
  if (src) {
    const img = node('img'); img.src = src; img.alt = ''; img.loading = 'lazy';
    img.addEventListener('load', () => fallback.remove());
    img.addEventListener('error', () => img.remove()); box.append(img);
  }
  box.append(node('span','tag',film.type === 'free' ? 'FREE TO VIEW' : readyToBuy(film) ? 'BUY STREAM' : 'PREVIEW / ARCHIVE'));
  return box;
}
function addFilm(film) {
  const article = node('article', 'film'); article.append(cover(film));
  const body = node('div','film-body'); body.append(node('h3', '', film.title));
  body.append(node('div','film-sub',[film.scholar,film.category].filter(Boolean).join(' · ') || 'Documentary'));
  const actions = node('div','film-actions');
  if (readyToWatch(film)) actions.append(btn('Watch free', () => openPlayer(film, 'free'), 'buy'));
  else if (safeHttps(film.previewUrl)) actions.append(btn('Play preview', () => openPlayer(film, 'preview')));
  actions.append(btn('More', () => openInfo(film)));
  if (readyToBuy(film)) {
    const a = node('a','buy','Buy Stream'); a.href = safeCheckout(film.purchaseUrl); a.target = '_blank'; a.rel = 'noopener noreferrer'; actions.append(a);
  } else if (film.type === 'paid') {
    actions.append(node('div','unavailable','Purchase unavailable until independent playback and checkout are verified.'));
  }
  body.append(actions); article.append(body); return article;
}
function filtered() {
  return state.films.filter(f => {
    if (state.view === 'free' && f.type !== 'free') return false;
    if (state.view.startsWith('subject:') && f.category !== state.view.slice(8)) return false;
    if (state.query && ![f.title, f.scholar, f.category, f.synopsis].join(' ').toLowerCase().includes(state.query)) return false;
    return true;
  });
}
function render() {
  const viewName = state.view === 'all' ? 'Browse Everything' : state.view === 'free' ? 'Free to View' : state.view.slice(8);
  $('library-heading').textContent = state.query ? 'Search Results' : viewName;
  $('metric-total').textContent = String(state.films.length);
  $('metric-free').textContent = String(state.films.filter(readyToWatch).length);
  $('metric-ready').textContent = String(state.films.filter(readyToBuy).length);
  const visible = filtered(); $('results-count').textContent = visible.length + ' titles';
  $('library-description').textContent = state.source === 'cached' ? 'Offline copy of the latest locally cached catalog.' : 'Only verified links are enabled.';
  const filters = $('filters'); filters.replaceChildren();
  for (const [label, view] of [['All Films','all'],['Free to View','free'],...subjectNames().map(s => [s,'subject:'+s])]) {
    const b = btn(label,()=>pickView(view)); b.setAttribute('aria-pressed',String(state.view === view)); filters.append(b);
  }
  const area = $('cards'); area.replaceChildren(); const msg = $('message'); msg.replaceChildren();
  if (state.source === 'unavailable') msg.textContent = 'Catalog could not be loaded. The emergency shell remains available.';
  if (!state.films.length) {
    const empty = node('div','empty-state'); empty.append(node('span','symbol','▣'),node('h3','','The emergency framework is ready'),node('p','','No films are invented or published here. Import verified catalog records when they are available. The player, search, categories, and controls are prepared.'));
    area.append(empty);
  } else if (!visible.length) {
    const empty = node('div','empty-state'); empty.append(node('span','symbol','⌕'),node('h3','','Nothing matches this selection'),node('p','','Choose another category or search term.')); area.append(empty);
  } else visible.forEach(f => area.append(addFilm(f)));
}
function modal(film) {
  $('viewer').hidden = false; document.body.style.overflow = 'hidden';
  $('modal-title').textContent = film.title;
  $('modal-subtitle').textContent = [film.scholar,film.category].filter(Boolean).join(' · ');
}
function openInfo(film) {
  modal(film); const el = $('player-target'); el.replaceChildren();
  const details = node('div','empty-state');
  details.append(node('div','symbol','FACTS'),node('h3','',film.title),node('p','',film.synopsis || 'Further information will be published once this record is verified.'));
  el.append(details);
}
function openPlayer(film, kind) {
  const primary = kind === 'free' ? safeHttps(film.freeVideoUrl) : safeHttps(film.previewUrl);
  const secondary = kind === 'free' ? safeHttps(film.backupFreeVideoUrl) : safeHttps(film.backupPreviewUrl);
  if (!primary) return;
  modal(film); const target = $('player-target'); target.replaceChildren();
  const vid = node('video'); vid.controls = true; vid.playsInline = true; vid.preload = 'metadata'; vid.src = primary;
  let backupUsed = false;
  vid.addEventListener('error', () => {
    if (!backupUsed && secondary && secondary !== primary) { backupUsed = true; vid.src = secondary; vid.load(); }
    else { const warn=node('p','','Playback is not available from the configured media source.'); target.append(warn); }
  });
  target.append(vid); vid.play().catch(() => {});
}
function closeModal() { $('viewer').hidden = true; document.body.style.overflow = ''; $('player-target').replaceChildren(); }
function validCatalog(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.products)) throw Error('Unsupported catalog schema');
  const seen = new Set();
  return data.products.filter(f => {
    if (!f || typeof f.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,99}$/.test(f.id) || seen.has(f.id)) return false;
    if (typeof f.title !== 'string' || !f.title.trim() || !['free','paid'].includes(f.type)) return false;
    seen.add(f.id); return true;
  });
}
async function boot() {
  try {
    const response = await fetch('data/catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw Error('Catalog not reachable');
    state.films = validCatalog(await response.json()); state.source = navigator.onLine ? 'live' : 'cached';
  } catch(e) { state.source = 'unavailable'; $('message').textContent = 'Catalog unavailable; shell remains operational.'; }
  renderNav(); render();
  $('query').addEventListener('input', ev => { state.query = ev.target.value.trim().toLowerCase(); render(); });
  $('discover').addEventListener('click', ev => { const b = ev.target.closest('[data-view]'); if (b) pickView(b.dataset.view); });
  $('menu-toggle').addEventListener('click', () => { const open = $('sidebar').classList.toggle('open'); $('scrim').hidden = !open; $('menu-toggle').setAttribute('aria-expanded',String(open)); });
  $('scrim').addEventListener('click', closeMenu);
  $('browse-btn').addEventListener('click', () => pickView('all'));
  $('free-btn').addEventListener('click', () => pickView('free'));
  $('close').addEventListener('click',closeModal);
  $('viewer').addEventListener('click',e => {if(e.target.dataset.close) closeModal();});
  document.addEventListener('keydown',e => {if(e.key==='Escape'){closeModal();closeMenu();}});
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
}
boot();