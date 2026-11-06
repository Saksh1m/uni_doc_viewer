'use strict';
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const {snapshot,ViewerError}=require('./snapshot.cjs');
const {assetIndex}=require('./assets.cjs');
const ID=/^[a-f0-9]{32}$/,TOKEN=/^[a-f0-9]{64}$/;
const hash=value=>crypto.createHash('sha256').update(value).digest();
const matches=(value,digest)=>typeof value==='string'&&TOKEN.test(value)&&Buffer.isBuffer(digest)&&crypto.timingSafeEqual(hash(value),digest);
function rangeFor(value,size){
 const m=/^bytes=(\d*)-(\d*)$/.exec(value);if(!m||(!m[1]&&!m[2])||!size)return null;
 const a=m[1]?Number(m[1]):null,b=m[2]?Number(m[2]):null;
 if((a!==null&&!Number.isSafeInteger(a))||(b!==null&&!Number.isSafeInteger(b)))return null;
 const start=a===null?Math.max(0,size-b):a,end=a===null?size-1:Math.min(b??size-1,size-1);
 return start<0||start>=size||end<start||b===0&&a===null?null:{start,end};
}
async function createBroker(options={}){
 const settings={maxSessions:8,maxSnapshotBytes:256*1024*1024,maxActiveReads:4,bootstrapMs:60000,idleMs:45*60*1000,absoluteMs:8*60*60*1000,emptyGraceMs:5000,tickMs:1000,...options};
 const now=settings.now||Date.now,sessions=new Map();let origin,closed=false,registrations=0,reserved=0,activeReads=0,emptySince=now(),timer;
 const assets=await assetIndex();
 const common={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' blob:; frame-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'"};
 function discard(id){const s=sessions.get(id);if(!s)return false;sessions.delete(id);for(const response of s.responses)response.destroy();s.bytes.fill(0);reserved-=s.bytes.length;s.bootstrap=null;s.credential=null;if(!sessions.size&&!registrations)emptySince=now();return true;}
 function expired(s){return s.credential?now()-s.lastUse>=settings.idleMs||now()>=s.hardExpiry:now()>=s.bootstrapExpiry;}
 function sweep(){for(const [id,s]of sessions)if(expired(s))discard(id);if(!sessions.size&&!registrations&&now()-emptySince>=settings.emptyGraceMs)void close();}
 function auth(req,id){const s=sessions.get(id);const match=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization||'');if(!s||expired(s)||!match||!matches(match[1],s.credential)){if(s&&expired(s))discard(id);return null;}s.lastUse=now();return s;}
 const server=http.createServer({maxHeaderSize:8192},async(req,res)=>{
  const send=(code,value,type='text/plain; charset=utf-8',extra={})=>{if(res.destroyed)return;const body=Buffer.isBuffer(value)?value:Buffer.from(value);res.writeHead(code,{...common,'Content-Type':type,...(code===204?{}:{'Content-Length':body.length}),...extra});res.end(req.method==='HEAD'||code===204?undefined:body);};
  try{
   // Reject duplicates as well as conflicting values, before selecting a route.
   for(const name of ['host','origin','authorization'])if(req.rawHeaders.filter((v,i)=>i%2===0&&v.toLowerCase()===name).length>1)return send(400,'Invalid request.');
   if(req.headers.host!==origin.slice(7)||req.headers.origin&&req.headers.origin!==origin)return send(403,'Request refused.');
   if(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))return send(403,'Request refused.');
   if(req.method==='POST'&&req.headers.origin!==origin)return send(403,'Request refused.');
   const route=req.url;
   if((req.method==='GET'||req.method==='HEAD')&&(assets.has(route)||/^\/view\/[a-f0-9]{32}$/.test(route))){const asset=assets.get(route)||assets.get('/shell');if(route==='/shell')return send(404,'Not found.');return send(200,await fs.readFile(asset.file),asset.type);}
   if(route==='/api/session'&&req.method==='POST'){
    if(req.headers['content-type']!=='application/json'||req.headers['content-encoding'])return send(415,'Use an unencoded JSON request.');
    if(Number(req.headers['content-length']||0)>1024)return send(413,'Request too large.',undefined,{Connection:'close'});
    const chunks=[];let length=0;
    for await(const chunk of req){length+=chunk.length;if(length>1024){send(413,'Request too large.',undefined,{Connection:'close'});return;}chunks.push(chunk);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,'Invalid request.');}
    if(!body||!ID.test(body.fileId||'')||!TOKEN.test(body.token||''))return send(401,'Session unavailable.');
    const s=sessions.get(body.fileId);if(!s||expired(s)||!matches(body.token,s.bootstrap)){if(s&&expired(s))discard(body.fileId);return send(401,'Session unavailable.');}
    // No await between checking and consuming: concurrent redemption is atomic.
    s.bootstrap=null;const credential=crypto.randomBytes(32).toString('hex');s.credential=hash(credential);s.lastUse=now();s.hardExpiry=now()+settings.absoluteMs;
    return send(200,JSON.stringify({fileId:body.fileId,credential}),'application/json');
   }
   const match=/^\/api\/files\/([a-f0-9]{32})\/(metadata|bytes|ping|close)$/.exec(route);
   if(match){const [,id,action]=match,s=auth(req,id);if(!s)return send(401,'Session unavailable.');
    if(action==='close'&&req.method==='POST'){discard(id);return send(204,'');}
    if(action==='ping'&&req.method==='POST')return send(204,'');
    if(!['GET','HEAD'].includes(req.method)||!['metadata','bytes'].includes(action))return send(405,'Method not supported.');
    if(action==='metadata')return send(200,JSON.stringify({fileId:id,name:s.name,format:s.format,size:s.bytes.length,snapshot:true}),'application/json; charset=utf-8');
    const size=s.bytes.length,etag='"'+id+'"';let start=0,end=size-1,code=200;
    if(req.method==='GET'&&req.headers.range?.startsWith('bytes=')&&(!req.headers['if-range']||req.headers['if-range']===etag)){
     const range=rangeFor(req.headers.range,size);if(!range)return send(416,'Range unavailable.',undefined,{'Content-Range':'bytes */'+size});
     ({start,end}=range);code=206;
    }
    if(activeReads>=settings.maxActiveReads)return send(429,'Too many active reads.',undefined,{'Retry-After':'1'});
    activeReads++;s.responses.add(res);let finished=false;const release=()=>{if(finished)return;finished=true;activeReads--;s.responses.delete(res);};res.once('finish',release);res.once('close',release);
    return send(code,s.bytes.subarray(start,end+1),'application/octet-stream',{'Content-Disposition':'attachment','Accept-Ranges':'bytes',ETag:etag,...(code===206?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
   }
   return send(404,'Not found.');
  }catch{if(!res.headersSent)send(400,'Request could not be processed.');else res.destroy();}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.timeout=15000;server.maxConnections=32;server.maxRequestsPerSocket=100;
 server.on('clientError',(_,socket)=>{socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;
 timer=setInterval(sweep,settings.tickMs);timer.unref();
 async function registerFile(filePath){
  if(closed)throw new ViewerError('The local viewer has stopped. Reopen the file.');
  if(sessions.size+registrations>=settings.maxSessions)throw new ViewerError('Too many open viewing sessions. Close a session and try again.');
  registrations++;let allocation=0,value;
  try{
   value=await snapshot(filePath,size=>{if(reserved+size>settings.maxSnapshotBytes)throw new ViewerError('The local viewer memory budget is full. Close a session and try again.');reserved+=size;allocation=size;});
   if(closed)throw new ViewerError('The local viewer has stopped. Reopen the file.');
   const fileId=crypto.randomBytes(16).toString('hex'),token=crypto.randomBytes(32).toString('hex');
   sessions.set(fileId,{...value,bootstrap:hash(token),bootstrapExpiry:now()+settings.bootstrapMs,credential:null,lastUse:now(),hardExpiry:0,responses:new Set()});
   return {fileId,url:origin+'/view/'+fileId+'#token='+token};
  }catch(e){reserved-=allocation;value?.bytes.fill(0);throw e;}finally{registrations--;if(!sessions.size&&!registrations)emptySince=now();}
 }
 async function close(){if(closed)return;closed=true;clearInterval(timer);for(const id of sessions.keys())discard(id);await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
 // Trusted in-process API only. No HTTP registration, diagnostics or filesystem API.
 return {origin,server,registerFile,revoke:discard,sweep,close,diagnostics:()=>({sessions:sessions.size,pendingRegistrations:registrations,snapshotBytes:reserved,activeReads,closed})};
}
module.exports={createBroker,rangeFor};
