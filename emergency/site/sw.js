/* Only the emergency shell and public catalog are cached. NEVER cache streamed video, tokens or paid sessions. */
const CACHE = 'aftv-emergency-v1';
const ASSETS = ['./','./index.html','./assets/style.css','./assets/app.js','./assets/icon.svg','./data/catalog.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request; const url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  if(!ASSETS.some(path=>new URL(path,self.registration.scope).pathname===url.pathname))return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});}return response;
  }).catch(()=>caches.match(req).then(saved=>saved||Response.error())));
});