/* Michael's Baking: offline service worker. Cache-first; the cache name changes with every build. */
const VERSION="5926512be4";
const CACHE="bake-"+VERSION;
const ASSETS=["./","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png"];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:"reload"})))).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("bake-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(req.mode==="navigate"){const page=await cache.match("index.html");if(page)return page}
    const hit=await cache.match(req,{ignoreSearch:true});if(hit)return hit;
    try{const res=await fetch(req);if(res.ok&&url.pathname.startsWith(new URL("./",self.registration.scope).pathname))cache.put(req,res.clone());return res}
    catch(err){if(req.mode==="navigate"){const page=await cache.match("index.html");if(page)return page}throw err}
  })());
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>cs.length?cs[0].focus():self.clients.openWindow("./")));
});
