'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs/promises');
const readline=require('node:readline');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const dist=path.join(root,'dist/UniversalFileViewer');
const manifest=require('./fixtures/generated/manifest.json');
test('package hashes and native Windows GUI subsystem',async()=>{
 const info=JSON.parse((await fs.readFile(path.join(dist,'build-info.json'),'utf8')).replace(/^\uFEFF/,''));
 for(const [name,hash] of Object.entries(info.hashes))assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(dist,name))).digest('hex').toUpperCase(),hash);
 const exe=await fs.readFile(path.join(dist,'UniversalFileViewer.exe'));
 const pe=exe.readUInt32LE(0x3c);assert.equal(exe.readUInt16LE(pe+24+68),2,'Windows GUI subsystem: no console');
});
test('packaged runtime works with system Node absent from PATH and unrelated cwd',async t=>{
 for(const id of ['TXT-01','PATH-01','PATH-02','PATH-03']){
  const file=manifest.fixtures.find(f=>f.id===id);
  const env={...process.env,PATH:process.env.SystemRoot+'\\System32'};delete env.NODE_OPTIONS;delete env.NODE_PATH;
  const child=spawn(path.join(dist,'runtime/node.exe'),[path.join(dist,'app/server.cjs'),'--',path.join(root,'tests/fixtures/generated',file.path)],{cwd:process.env.TEMP,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());let errors='';child.stderr.on('data',b=>errors+=b);
  const lines=readline.createInterface({input:child.stdout});
  const ready=await Promise.race([new Promise((resolve,reject)=>{lines.once('line',resolve);child.once('error',reject);child.once('exit',()=>reject(new Error(errors||'Package exited before ready')));}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Ready timeout')),10000);timer.unref();})]);
  const url=new URL(JSON.parse(ready).url);
  const fileId=url.pathname.split('/').pop();
  const auth=await fetch(url.origin+'/api/session',{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({fileId,token:url.hash.slice(7)})});
  assert.equal(auth.status,200);const {credential}=await auth.json();
  const headers={Authorization:'Bearer '+credential};
  const metadata=await fetch(url.origin+'/api/files/'+fileId+'/metadata',{headers});assert.equal(metadata.status,200);assert.equal((await metadata.json()).name,path.basename(file.path));
  const response=await fetch(url.origin+'/api/files/'+fileId+'/bytes',{headers});assert.equal(response.status,200);
  assert.match(await response.text(),id==='PATH-03'?/ARGUMENT-FILE-MARKER/:/UFV-TEXT-MARKER/);
  child.kill();lines.close();
 }
});
