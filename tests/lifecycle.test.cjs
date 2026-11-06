'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process'),{once}=require('node:events'),readline=require('node:readline');
const {createBroker}=require('../src/broker.cjs');
test('default lease survives 30 minutes without a heartbeat, but expires without unload',async t=>{
 let now=0;const b=await createBroker({now:()=>now,tickMs:60000});t.after(()=>b.close());
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ufv-lease-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'lease.txt');await fs.writeFile(file,'stable snapshot');
 const s=await b.registerFile(file),url=new URL(s.url);
 const auth=await fetch(b.origin+'/api/session',{method:'POST',headers:{Origin:b.origin,'Content-Type':'application/json'},body:JSON.stringify({fileId:s.fileId,token:url.hash.slice(7)})});
 const headers={Authorization:'Bearer '+(await auth.json()).credential};
 now=31*60*1000;b.sweep();let r=await fetch(b.origin+'/api/files/'+s.fileId+'/bytes',{headers});assert.equal(r.status,200);assert.equal(await r.text(),'stable snapshot');
 now+=46*60*1000;b.sweep();assert.equal(b.diagnostics().sessions,0);assert.equal(b.diagnostics().snapshotBytes,0);
 now+=5000;b.sweep();assert.equal(b.diagnostics().closed,true);
});
test('twenty sessions return snapshot and response accounting to zero',async t=>{
 const b=await createBroker({emptyGraceMs:60000});t.after(()=>b.close());
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ufv-cycles-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'cycles.txt');await fs.writeFile(file,'repeatable');
 for(let i=0;i<20;i++){
  const s=await b.registerFile(file),u=new URL(s.url),auth=await fetch(b.origin+'/api/session',{method:'POST',headers:{Origin:b.origin,'Content-Type':'application/json'},body:JSON.stringify({fileId:s.fileId,token:u.hash.slice(7)})});
  const credential=(await auth.json()).credential,headers={Authorization:'Bearer '+credential};
  assert.equal(await (await fetch(b.origin+'/api/files/'+s.fileId+'/bytes',{headers})).text(),'repeatable');
  assert.equal((await fetch(b.origin+'/api/files/'+s.fileId+'/close',{method:'POST',headers:{...headers,Origin:b.origin}})).status,204);
  assert.deepEqual(b.diagnostics(),{sessions:0,pendingRegistrations:0,snapshotBytes:0,activeReads:0,closed:false});
 }
});
test('managed runtime shuts down when its private parent channel closes',async t=>{
 const child=spawn(process.execPath,[path.resolve(__dirname,'../src/managed.cjs')],{windowsHide:true,stdio:['pipe','pipe','pipe']});t.after(()=>child.kill());
 const lines=readline.createInterface({input:child.stdout});t.after(()=>lines.close());
 assert.deepEqual(JSON.parse((await once(lines,'line'))[0]),{ready:'1'});
 const exited=once(child,'exit');child.stdin.end();assert.equal((await exited)[0],0);
});
test('managed runtime rejects oversized private messages and exits',async t=>{
 const child=spawn(process.execPath,[path.resolve(__dirname,'../src/managed.cjs')],{windowsHide:true,stdio:['pipe','pipe','pipe']});t.after(()=>child.kill());
 child.stdin.on('error',()=>{});const lines=readline.createInterface({input:child.stdout});t.after(()=>lines.close());await once(lines,'line');
 const exited=once(child,'exit');child.stdin.write('x'.repeat(65537));assert.equal((await exited)[0],0);
});
