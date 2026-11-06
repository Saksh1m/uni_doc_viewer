'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os'),{spawn}=require('node:child_process'),{chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),entry=path.join(root,'tools/view-local.cjs');
function start(args,t){const child=spawn(path.join(root,'dist/UniversalFileViewer/runtime/node.exe'),[entry,...args],{cwd:os.tmpdir(),windowsHide:true,stdio:['ignore','pipe','pipe']});t.after(()=>child.kill());let output='',errors='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>errors+=d);const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});return {child,exited,get output(){return output;},get errors(){return errors;}};}

test('local entry handles help, unsupported files and missing paths without starting a session',async t=>{
 for(const [args,code,pattern]of [[[],0,/Usage:/],[['missing.unsupported'],1,/not supported/],[['missing.txt'],1,/could not be found/],[['one','two'],1,/one file path/]]){const p=start(args,t);assert.equal(await p.exited,code);assert.match(p.output+p.errors,pattern);assert.doesNotMatch(p.output,/http:\/\//);}
});

test('local entry opens a Unicode path from another directory and shuts down after browser closure',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ufv-local-')),file=path.join(dir,'personal नमस्ते & notes.txt'),text='LOCAL-VIEW-MARKER — original stays unchanged';await fs.writeFile(file,text);t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());const p=start([file],t);let url;
 for(let i=0;i<200;i++){url=/http:\/\/127\.0\.0\.1:\d+\/view\/[a-f0-9]{32}#token=[a-f0-9]{64}/.exec(p.output)?.[0];if(url)break;await new Promise(r=>setTimeout(r,25));}assert.ok(url,p.errors);assert.ok(!url.includes('personal'));
 const page=await browser.newPage();await page.goto(url);await page.waitForFunction(()=>document.querySelector('#content').textContent.includes('LOCAL-VIEW-MARKER'));assert.equal(new URL(page.url()).hash,'');await page.reload();await page.waitForFunction(()=>document.querySelector('#content').textContent.includes('LOCAL-VIEW-MARKER'));
 await page.locator('#close').click();let timer;try{assert.equal(await Promise.race([p.exited,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Local broker did not stop')),10000))]),0);}finally{clearTimeout(timer);}
 assert.match(p.output,/Local viewer stopped/);assert.equal(p.errors,'');assert.equal(await fs.readFile(file,'utf8'),text);
});


test('local entry serves the current PDF renderer from a different working directory',async t=>{
 const f=require('./fixtures/generated/manifest.json').fixtures.find(f=>f.id==='PDF-01'),browser=await chromium.launch({headless:true});t.after(()=>browser.close());const p=start([path.join(root,'tests/fixtures/generated',f.path)],t);let url;
 for(let i=0;i<200;i++){url=/http:\/\/127\.0\.0\.1:\d+\/view\/[a-f0-9]{32}#token=[a-f0-9]{64}/.exec(p.output)?.[0];if(url)break;await new Promise(r=>setTimeout(r,25));}assert.ok(url,p.errors);
 const page=await browser.newPage();await page.goto(url);await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('SEARCH-PDF-0001'));await page.getByRole('button',{name:'Next page',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('0002'));await page.locator('#close').click();let timer;try{assert.equal(await Promise.race([p.exited,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('PDF broker did not stop')),10000))]),0);}finally{clearTimeout(timer);}
});
