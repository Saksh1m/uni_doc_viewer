'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('@playwright/test'),{createBroker}=require('../src/broker.cjs');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
async function setup(t){
 let now=0;const broker=await createBroker({now:()=>now,tickMs:60000,emptyGraceMs:60000});
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ufv-session-browser-'));
 t.after(async()=>{await browser.close();await broker.close();await fs.rm(dir,{recursive:true,force:true});});
 async function open(i){const file=path.join(dir,`file-${i}.txt`);await fs.writeFile(file,'Document '+i);const s=await broker.registerFile(file),page=await context.newPage();await page.goto(s.url);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Read-only snapshot'));return {page,...s};}
 return {broker,context,open,advance:ms=>{now+=ms;}};
}
test('five tabs share a broker, refresh independently and cannot exchange file credentials',async t=>{
 const x=await setup(t),tabs=await Promise.all(Array.from({length:5},(_,i)=>x.open(i)));
 for(let i=0;i<tabs.length;i++){const {page}=tabs[i];assert.equal(await page.locator('#content').textContent(),'Document '+i);await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Read-only snapshot'));assert.equal(await page.locator('#content').textContent(),'Document '+i);}
 const wrong=await tabs[0].page.evaluate(async id=>{const credential=sessionStorage.getItem('ufv-session:'+location.pathname.split('/').pop());return (await fetch('/api/files/'+id+'/bytes',{headers:{Authorization:'Bearer '+credential}})).status;},tabs[1].fileId);assert.equal(wrong,401);
 await tabs[0].page.locator('#close').click();await tabs[0].page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Viewing session ended.'));assert.equal(x.broker.diagnostics().sessions,4);
 await tabs[1].page.reload();await tabs[1].page.waitForFunction(()=>document.querySelector('#content').textContent==='Document 1');
});
test('connection recovery and clock-advanced background/expiry preserve the correct loaded document',async t=>{
 const x=await setup(t),{page}=await x.open(1);
 await x.context.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('connection is unavailable'));
 assert.equal(await page.locator('#content').textContent(),'Document 1');assert.equal(await page.locator('#retry').isVisible(),true);
 await x.context.setOffline(false);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Read-only snapshot'));
 x.advance(31*60*1000);
 const resumed=page.waitForResponse(r=>r.url().endsWith('/ping')&&r.status()===204);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await resumed;
 // Let the fetch continuation release its in-flight guard before the next resume.
 await page.waitForTimeout(50);
 x.advance(46*60*1000);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('session expired'));
 assert.equal(await page.locator('#content').textContent(),'Document 1');assert.equal(await page.locator('#retry').isVisible(),false);
});
test('broker crash leaves actionable recovery and allows clearing the local view',async t=>{
 const x=await setup(t),{page}=await x.open(2);await x.broker.close();
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('reopen the original file'));
 assert.equal(await page.locator('#content').textContent(),'Document 2');
 await page.locator('#close').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('View closed.'));
 assert.equal(await page.locator('#content').textContent(),'');assert.equal(await page.locator('#tools').isVisible(),false);
});
