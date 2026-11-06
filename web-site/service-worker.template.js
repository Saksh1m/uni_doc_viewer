const CACHE='ufv-web-__VERSION__',ASSETS=__ASSETS__;
const allowed=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('message',event=>{if(event.data==='cache-status')event.waitUntil((async()=>{const cache=await caches.open(CACHE),keys=new Set((await cache.keys()).map(r=>r.url));event.ports[0]?.postMessage({complete:[...allowed].every(url=>keys.has(url))});})());});
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{for(let i=0;i<ASSETS.length;i+=6)await Promise.all(ASSETS.slice(i,i+6).map(async path=>{const url=new URL(path,self.registration.scope),response=await fetch(url,{cache:'reload',credentials:'same-origin'});if(!response.ok||response.redirected||response.type==='opaque')throw Error('An app asset could not be cached.');await cache.put(url,response);}));}
 catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('ufv-web-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 const key=request.mode==='navigate'&&url.pathname===new URL(self.registration.scope).pathname?new URL('./index.html',self.registration.scope).href:request.url;
 if(!allowed.has(key))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(key);return cached||fetch(request);})());
});
