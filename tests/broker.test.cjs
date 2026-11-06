'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {createBroker}=require('../src/broker.cjs');
async function setup(t,options={}){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ufv-broker-'));
 const broker=await createBroker({tickMs:60000,emptyGraceMs:60000,...options});
 t.after(async()=>{await broker.close();await fs.rm(dir,{recursive:true,force:true});});
 async function add(name='example.txt',bytes='0123456789'){const file=path.join(dir,name);await fs.writeFile(file,bytes);return {...await broker.registerFile(file),file};}
 async function redeem(s,token=new URL(s.url).hash.slice(7)){return fetch(broker.origin+'/api/session',{method:'POST',headers:{Origin:broker.origin,'Content-Type':'application/json'},body:JSON.stringify({fileId:s.fileId,token})});}
 async function login(s){const r=await redeem(s);assert.equal(r.status,200);return (await r.json()).credential;}
 function request(s,credential,action='bytes',options={}){return fetch(broker.origin+'/api/files/'+s.fileId+'/'+action,{...options,headers:{Authorization:'Bearer '+credential,...options.headers}});}
 return {broker,dir,add,redeem,login,request};
}
test('loopback, generic shell, no filesystem route or unauthenticated file information',async t=>{
 const x=await setup(t),s=await x.add('private-name.txt');assert.equal(x.broker.server.address().address,'127.0.0.1');
 assert.ok(!s.url.includes('private-name'));assert.ok(!(await (await fetch(s.url)).text()).includes('private-name'));
 for(const action of ['metadata','bytes','ping','close']){const r=await x.request(s,'bad',action);assert.equal(r.status,401);assert.equal(await r.text(),'Session unavailable.');}
 for(const route of ['/api/document','/api/register','/shell','/../snapshot.cjs','/?path='+encodeURIComponent(s.file)])assert.equal((await fetch(x.broker.origin+route)).status,404);
});
test('single-use bootstrap is file-bound and atomic under concurrent redemption',async t=>{
 const x=await setup(t),a=await x.add(),b=await x.add('other.txt','other');
 assert.equal((await x.redeem(b,new URL(a.url).hash.slice(7))).status,401);
 const responses=await Promise.all(Array.from({length:8},()=>x.redeem(a)));assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===401).length,7);
 const credential=(await responses.find(r=>r.status===200).json()).credential;
 assert.equal((await x.request(b,credential)).status,401);assert.equal(await (await x.request(a,credential)).text(),'0123456789');
});
test('metadata, immutable snapshot, headers and explicit revocation',async t=>{
 const x=await setup(t),s=await x.add(),credential=await x.login(s);
 await fs.writeFile(s.file,'changed');await fs.unlink(s.file);
 const meta=await (await x.request(s,credential,'metadata')).json();assert.deepEqual(meta,{fileId:s.fileId,name:'example.txt',format:'txt',size:10,snapshot:true});
 const r=await x.request(s,credential);assert.equal(await r.text(),'0123456789');
 for(const [name,value]of Object.entries({'content-type':'application/octet-stream','content-disposition':'attachment','cache-control':'no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin'}))assert.equal(r.headers.get(name),value);
 assert.equal((await x.request(s,credential,'close',{method:'POST',headers:{Origin:x.broker.origin}})).status,204);
 assert.equal((await x.request(s,credential)).status,401);assert.equal(x.broker.diagnostics().snapshotBytes,0);
});
test('byte ranges, suffixes, clipping, If-Range, HEAD and invalid ranges',async t=>{
 const x=await setup(t),s=await x.add(),c=await x.login(s);
 for(const [range,expected,contentRange]of [['bytes=0-2','012','bytes 0-2/10'],['bytes=7-','789','bytes 7-9/10'],['bytes=-2','89','bytes 8-9/10'],['bytes=8-999','89','bytes 8-9/10']]){const r=await x.request(s,c,'bytes',{headers:{Range:range}});assert.equal(r.status,206);assert.equal(await r.text(),expected);assert.equal(r.headers.get('content-range'),contentRange);}
 for(const range of ['bytes=10-','bytes=-0','bytes=2-1','bytes=0-1,4-5','bytes=999999999999999999999-','bytes=-']){const r=await x.request(s,c,'bytes',{headers:{Range:range}});assert.equal(r.status,416);assert.equal(r.headers.get('content-range'),'bytes */10');}
 for(const headers of [{Range:'items=0-1'},{Range:'bytes=0-1','If-Range':'"different"'}]){const r=await x.request(s,c,'bytes',{headers});assert.equal(r.status,200);assert.equal(await r.text(),'0123456789');}
 assert.equal((await x.request(s,c,'bytes',{headers:{Range:'bytes=0-1','If-Range':'"'+s.fileId+'"'}})).status,206);
 const head=await x.request(s,c,'bytes',{method:'HEAD',headers:{Range:'bytes=0-1'}});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'10');assert.equal(await head.text(),'');
 const empty=await x.add('empty.txt',''),ec=await x.login(empty);assert.equal(await (await x.request(empty,ec)).text(),'');assert.equal((await x.request(empty,ec,'bytes',{headers:{Range:'bytes=0-'}})).status,416);
});
test('host, origin, fetch metadata and POST origin reject hostile requests',async t=>{
 const x=await setup(t),s=await x.add(),c=await x.login(s);
 for(const headers of [{Host:'evil.invalid'},{Origin:'https://evil.invalid'},{'Sec-Fetch-Site':'cross-site'},{'Sec-Fetch-Site':'same-site'}]){
  const status=await new Promise((resolve,reject)=>{const req=http.get(x.broker.origin+'/api/files/'+s.fileId+'/bytes',{headers:{Authorization:'Bearer '+c,...headers}},r=>{r.resume();resolve(r.statusCode);});req.on('error',reject);});assert.equal(status,403,JSON.stringify(headers));
 }
 assert.equal((await x.request(s,c,'ping',{method:'POST'})).status,403);
 assert.equal((await x.request(s,c,'ping',{method:'POST',headers:{Origin:x.broker.origin}})).status,204);
 const result=await new Promise((resolve,reject)=>{const req=http.request(x.broker.origin+'/view/'+s.fileId,{headers:['Host',new URL(x.broker.origin).host,'Host',new URL(x.broker.origin).host]},r=>{r.resume();resolve(r.statusCode);});req.on('error',reject);req.end();});assert.equal(result,400);
});
test('bootstrap JSON has strict type, encoding and body bounds',async t=>{
 const x=await setup(t);for(const [headers,body,status]of [[{},'{}',415],[{'Content-Type':'application/json','Content-Encoding':'gzip'},'{}',415],[{'Content-Type':'application/json'},'x'.repeat(1025),413],[{'Content-Type':'application/json'},'{',400],[{'Content-Type':'application/json'},'null',401]])assert.equal((await fetch(x.broker.origin+'/api/session',{method:'POST',headers:{Origin:x.broker.origin,...headers},body})).status,status);
});
test('bootstrap expiry, idle expiry and absolute expiry release allocations',async t=>{
 let now=0;const x=await setup(t,{now:()=>now,bootstrapMs:10,idleMs:20,absoluteMs:50});
 const pending=await x.add();now=10;assert.equal((await x.redeem(pending)).status,401);assert.equal(x.broker.diagnostics().snapshotBytes,0);
 const s=await x.add(),c=await x.login(s);now=29;assert.equal((await x.request(s,c)).status,200);now=49;assert.equal((await x.request(s,c)).status,401);
 const a=await x.add(),ac=await x.login(a);for(now=60;now<99;now+=10)assert.equal((await x.request(a,ac)).status,200);now=99;assert.equal((await x.request(a,ac)).status,401);
 assert.equal(x.broker.diagnostics().snapshotBytes,0);
});
test('concurrent registration respects aggregate memory and session limits',async t=>{
 const x=await setup(t,{maxSnapshotBytes:10,maxSessions:2});
 const results=await Promise.allSettled([x.add('a.txt'),x.add('b.txt'),x.add('c.txt')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(x.broker.diagnostics().snapshotBytes,10);assert.equal(x.broker.diagnostics().pendingRegistrations,0);
 x.broker.revoke(results.find(r=>r.status==='fulfilled').value.fileId);assert.equal(x.broker.diagnostics().snapshotBytes,0);await x.add('after.txt');
});
test('invalid signatures, encodings, extensions, missing paths and oversized files release reservations',async t=>{
 const x=await setup(t);
 for(const [name,bytes]of [['fake.pdf','not PDF'],['fake.docx','not zip'],['fake.png','not PNG'],['invalid.txt',Buffer.from([255])],['bad.exe','exe']]){await assert.rejects(x.add(name,bytes));assert.equal(x.broker.diagnostics().snapshotBytes,0);}
 await assert.rejects(x.broker.registerFile(path.join(x.dir,'missing.txt')),e=>!e.message.includes(x.dir));
 const large=path.join(x.dir,'large.txt');await fs.writeFile(large,'');await fs.truncate(large,8*1024*1024+1);await assert.rejects(x.broker.registerFile(large),/size limit/);assert.equal(x.broker.diagnostics().snapshotBytes,0);
});
test('UTF-16 snapshots preserve original bytes and filenames',async t=>{
 const x=await setup(t),bytes=Buffer.concat([Buffer.from([255,254]),Buffer.from('hello नमस्ते','utf16le')]),s=await x.add('unicode 日本語.txt',bytes),c=await x.login(s);
 assert.deepEqual(Buffer.from(await (await x.request(s,c)).arrayBuffer()),bytes);assert.equal((await (await x.request(s,c,'metadata')).json()).name,'unicode 日本語.txt');
});
test('read budget rejects requests without leaking active-read slots',async t=>{
 const x=await setup(t,{maxActiveReads:0}),s=await x.add(),c=await x.login(s);assert.equal((await x.request(s,c)).status,429);assert.equal(x.broker.diagnostics().activeReads,0);
});
test('sweep expires pending sessions and shuts down an empty broker',async t=>{
 let now=0;const x=await setup(t,{now:()=>now,bootstrapMs:10,emptyGraceMs:5});await x.add();now=10;x.broker.sweep();assert.equal(x.broker.diagnostics().sessions,0);now=15;x.broker.sweep();assert.equal(x.broker.diagnostics().closed,true);await assert.rejects(x.add('late.txt'),/stopped/);
});
test('aborting a large response leaves subsequent range reads available',async t=>{
 const x=await setup(t,{maxActiveReads:1}),bytes=Buffer.alloc(16*1024*1024,65);bytes.write('%PDF-1.7');
 const s=await x.add('large.pdf',bytes),c=await x.login(s);
 const response=await new Promise((resolve,reject)=>{const req=http.get(x.broker.origin+'/api/files/'+s.fileId+'/bytes',{headers:{Authorization:'Bearer '+c}},resolve);req.on('error',reject);});
 t.after(()=>response.destroy());response.pause();assert.equal(response.statusCode,200);response.destroy();
 const deadline=Date.now()+2000;while(x.broker.diagnostics().activeReads&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
 assert.equal(x.broker.diagnostics().activeReads,0);const r=await x.request(s,c,'bytes',{headers:{Range:'bytes=0-7'}});assert.equal(r.status,206);assert.equal(await r.text(),'%PDF-1.7');
});
