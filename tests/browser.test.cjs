'use strict';
// Uses a fresh headless test browser, never the user's Chrome profile/windows.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const {spawn}=require('node:child_process');
const readline=require('node:readline');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const dist=path.join(root,'dist/UniversalFileViewer');
const manifest=require('./fixtures/generated/manifest.json');
async function packaged(file,t){
 const env={...process.env,PATH:process.env.SystemRoot+'\\System32'};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const child=spawn(path.join(dist,'runtime/node.exe'),[path.join(dist,'app/server.cjs'),'--',file],{env,cwd:os.tmpdir(),windowsHide:true,stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());const lines=readline.createInterface({input:child.stdout});
 const ready=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Package start timeout')),10000);
  lines.once('line',line=>{clearTimeout(timer);resolve(line);});child.once('error',reject);
  child.once('exit',code=>{clearTimeout(timer);reject(Error('Early package exit '+code));});
 });
 return JSON.parse(ready).url;
}
test('packaged app renders text offline, refreshes, wraps, and uses no remote resources',async t=>{
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:1100,height:720}});
 const external=[];
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='127.0.0.1'){external.push(url.origin);return route.abort();}
  return route.continue();
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const id of ['PATH-01','PATH-02','PATH-03','TXT-03','TXT-04','TXT-06']){
  const item=manifest.fixtures.find(f=>f.id===id);
  const url=await packaged(path.join(root,'tests/fixtures/generated',item.path),t);
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Read-only snapshot')||document.querySelector('#status').textContent==='This file is empty.');
  assert.equal(await page.locator('h1').innerText(),path.basename(item.path));
  const value=await page.locator('#content').textContent();
  if(id==='TXT-06')assert.equal(value,'');else assert.match(value,id==='PATH-03'?/ARGUMENT-FILE-MARKER/:/नमस्ते, 日本語/);
  assert.equal(new URL(page.url()).hash,'');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Read-only snapshot')||document.querySelector('#status').textContent==='This file is empty.');
  assert.equal(await page.locator('#content').textContent(),value);
  await page.getByLabel('Wrap lines').uncheck();assert.match(await page.locator('#content').getAttribute('class'),/nowrap/);
  if(id==='PATH-01'){
   await fs.mkdir(path.join(root,'tests/results'),{recursive:true});
   await page.screenshot({path:path.join(root,'tests/results/text-viewer.png'),fullPage:true});
  }
  await page.locator('#close').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Viewing session ended.'));
  assert.equal(await page.locator('#content').textContent(),'');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('No active viewing session.'));
 }
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(root,'tests/results/browser-summary.json'),JSON.stringify({browser:browser.version(),fixtures:6,refresh:true,wrap:true,unexpectedExternalRequests:external,pageErrors:errors,scope:'Isolated headless browser with packaged runtime; not desktop Chrome UI or clean-machine qualification.'},null,2));
});
test('markup inside a text file stays literal and does not execute',async t=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'ufv-markup-'));t.after(()=>fs.rm(folder,{recursive:true,force:true}));
 const text='<script>window.UFV_EXECUTED=true</script>\n<img src="https://fixture.invalid/pixel">';
 const file=path.join(folder,'markup.txt');await fs.writeFile(file,text);
 const url=await packaged(file,t);const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(url);await page.waitForFunction(()=>document.querySelector('#content').textContent.length>0);
 assert.equal(await page.locator('#content').textContent(),text);assert.equal(await page.locator('#content script, #content img').count(),0);
 assert.equal(await page.evaluate(()=>window.UFV_EXECUTED),undefined);
});
