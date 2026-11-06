'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(execFile),root=path.resolve(__dirname,'..');
const exe=path.join(root,'dist/UniversalFileViewer/UniversalFileViewer.exe');
const probe=path.join(root,'tests/results/IpcProbe.exe');
const fetch=(url,options={})=>global.fetch(url,{signal:AbortSignal.timeout(8000),...options});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(check,limit=12000){const end=Date.now()+limit;while(Date.now()<end){if(await check())return;await sleep(100);}throw Error('Condition timeout');}
async function invoke(mode,value='') {
 const env={...process.env,PATH:process.env.SystemRoot+'\\System32',NODE_OPTIONS:'--invalid-option-for-isolation-test'};
 try{return JSON.parse((await exec(probe,[exe,mode,value],{windowsHide:true,timeout:20000,env})).stdout);}
 catch(e){if(e.code===1&&e.stdout)return JSON.parse(e.stdout);throw e;}
}
async function login(s){const u=new URL(s.url),r=await fetch(u.origin+'/api/session',{method:'POST',headers:{Origin:u.origin,'Content-Type':'application/json'},body:JSON.stringify({fileId:s.fileId,token:u.hash.slice(7)})});assert.equal(r.status,200);return {...s,origin:u.origin,credential:(await r.json()).credential};}
async function bytes(s){const r=await fetch(s.origin+'/api/files/'+s.fileId+'/bytes',{headers:{Authorization:'Bearer '+s.credential}});assert.equal(r.status,200);return r.text();}
async function close(s){const r=await fetch(s.origin+'/api/files/'+s.fileId+'/close',{method:'POST',headers:{Origin:s.origin,Authorization:'Bearer '+s.credential}});assert.equal(r.status,204);}
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};

test('native shared broker: concurrent launches, ACLs, limits, failures, crash recovery and cleanup',{timeout:120000},async t=>{
 await fs.mkdir(path.dirname(probe),{recursive:true});
 await exec(path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:exe','/reference:System.Web.Extensions.dll','/reference:System.Management.dll','/win32manifest:'+path.join(root,'windows/app.manifest'),'/out:'+probe,path.join(root,'tests/native/IpcProbe.cs')],{windowsHide:true});
 await fs.copyFile(path.join(root,'windows/Launcher.exe.config'),probe+'.config');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ufv-ipc-'));const owned=new Set();
 t.after(async()=>{for(const pid of owned)if(alive(pid))try{process.kill(pid);}catch{}await fs.rm(dir,{recursive:true,force:true});});
 const paths=await Promise.all(Array.from({length:5},async(_,i)=>{const file=path.join(dir,`file ${i} 日本語 & %.txt`);await fs.writeFile(file,'marker-'+i);return file;}));
 const opened=await Promise.all(paths.map(p=>invoke('open',p)));
 t.diagnostic('Five native launch requests returned.');
 for(const s of opened)assert.ok(s.url,JSON.stringify(s));
 assert.equal(new Set(opened.map(s=>new URL(s.url).origin)).size,1);assert.equal(new Set(opened.map(s=>s.fileId)).size,5);
 let inspection=await invoke('inspect');assert.ok(inspection.pid,JSON.stringify(inspection));owned.add(inspection.pid);for(const pid of inspection.children)owned.add(pid);
 assert.equal(inspection.children.length,1,'exactly one runtime');assert.equal(inspection.protectedAcl,true);assert.deepEqual(inspection.allows,[inspection.user]);assert.deepEqual(inspection.denies,['S-1-5-2']);
 const sessions=await Promise.all(opened.map(login));assert.deepEqual(await Promise.all(sessions.map(bytes)),paths.map((_,i)=>'marker-'+i));
 t.diagnostic('Shared runtime, ACL and five document reads passed.');
 const missing=await invoke('open',path.join(dir,'missing.txt'));assert.match(missing.error,/could not be found/);assert.equal(await bytes(sessions[0]),'marker-0');
 assert.match((await invoke('raw','{')).error,/could not process/);
 assert.equal((await invoke('disconnect',path.join(dir,'missing.txt'))).ok,true);
 const extra=[];for(let i=0;i<3;i++){const s=await invoke('open',paths[0]);assert.ok(s.url,JSON.stringify(s));extra.push(await login(s));assert.equal(await bytes(extra[i]),'marker-0');}
 assert.match((await invoke('open',paths[0])).error,/Too many/);
 await invoke('revoke',extra[0].fileId);assert.equal(await bytes(sessions[1]),'marker-1');
 const revoked=await fetch(extra[0].origin+'/api/files/'+extra[0].fileId+'/bytes',{headers:{Authorization:'Bearer '+extra[0].credential}});assert.equal(revoked.status,401);
 const longFixture=require('./fixtures/generated/manifest.json').fixtures.find(f=>f.id==='PATH-02');
 const longSession=await login(await invoke('open',path.join(root,'tests/fixtures/generated',longFixture.path)));
 assert.match(await bytes(longSession),/UFV-TEXT-MARKER/);await close(longSession);
 for(const id of ['PDF-01','IMG-PNG','DOCX-01','EPUB-3','XLSX-01','MD-01','DATA-QUOTED']){
  const item=require('./fixtures/generated/manifest.json').fixtures.find(f=>f.id===id),opened=await invoke('open',path.join(root,'tests/fixtures/generated',item.path));assert.ok(opened.url,opened.error);
  const s=await login(opened),r=await fetch(s.origin+'/api/files/'+s.fileId+'/metadata',{headers:{Authorization:'Bearer '+s.credential}});assert.equal((await r.json()).name,path.basename(item.path));await close(s);
 }
 for(const s of [...sessions,...extra.slice(1)])await close(s);
 const firstHost=inspection.pid,firstChild=inspection.children[0];await waitFor(()=>!alive(firstHost)&&!alive(firstChild));
 t.diagnostic('Capacity, isolated failures and empty shutdown passed.');

 // Restart, then crash the native host: EOF on its private pipe must stop Node.
 let s=await login(await invoke('open',paths[0]));inspection=await invoke('inspect');owned.add(inspection.pid);for(const pid of inspection.children)owned.add(pid);
 assert.notEqual(inspection.pid,firstHost);process.kill(inspection.pid);await waitFor(()=>inspection.children.every(pid=>!alive(pid)));
 const replacement=await login(await invoke('open',paths[1]));assert.equal(await bytes(replacement),'marker-1');
 t.diagnostic('Native-host crash and restart passed.');
 inspection=await invoke('inspect');owned.add(inspection.pid);for(const pid of inspection.children)owned.add(pid);
 // Crash Node: its host must exit, and a subsequent file must get a fresh host.
 process.kill(inspection.children[0]);await waitFor(()=>!alive(inspection.pid));
 s=await login(await invoke('open',paths[2]));assert.equal(await bytes(s),'marker-2');
 t.diagnostic('Runtime crash and restart passed.');
 inspection=await invoke('inspect');owned.add(inspection.pid);for(const pid of inspection.children)owned.add(pid);
 await close(s);await waitFor(()=>!alive(inspection.pid)&&inspection.children.every(pid=>!alive(pid)));
 await fs.writeFile(path.join(root,'tests/results/ipc-summary.json'),JSON.stringify({concurrentLaunches:5,uniqueRuntime:true,currentUserOnlyAcl:true,networkDenied:true,capacity:8,missingFileIsolation:true,perFileRevocation:true,hostCrashRecovery:true,runtimeCrashRecovery:true,emptyExit:true,systemNodeOnPath:false},null,2));
});
