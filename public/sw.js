// Apenas assets públicos. Nunca fazer cache de API, contas, páginas autenticadas ou sessões.
const CACHE_NAME="inventario-pet-public-assets-v20261111";
const STATIC_FILES=["/favicon.svg","/styles.css","/final.css","/app.js",
 "/identity-ui.js","/pwa-install.js","/final.js","/component-art.js",
 "/site.webmanifest","/icons/inventory-192.png","/icons/inventory-512.png"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(STATIC_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys
  .filter(k=>k.startsWith("inventario-pet-public-assets-")&&k!==CACHE_NAME)
  .map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
 if(!STATIC_FILES.includes(url.pathname))return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok){
   const copy=response.clone();
   event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)));
  }
  return response;
 }).catch(()=>caches.match(request)));
});
