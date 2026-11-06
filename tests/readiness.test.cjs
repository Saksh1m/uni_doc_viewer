'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('@playwright/test'),{createBroker}=require('../src/broker.cjs');
const root=path.resolve(__dirname,'..'),fixture=require('./fixtures/generated/manifest.json').fixtures.find(f=>f.id==='PDF-01');
async function setup(t){
 const broker=await createBroker({tickMs:60000,emptyGraceMs:60000}),browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage();let release;const gate=new Promise(r=>release=r);let intercepted=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 t.after(async()=>{release();await browser.close();await broker.close();});await page.clock.install();
 await page.route('**/render-pdf.mjs',async route=>{intercepted=true;await gate;try{await route.continue();}catch{}});
 const s=await broker.registerFile(path.join(root,'tests/fixtures/generated',fixture.path));await page.goto(s.url,{waitUntil:'domcontentloaded'});for(let i=0;i<100&&!intercepted;i++)await new Promise(r=>setTimeout(r,20));assert.ok(intercepted,'renderer request must be stalled');
 return {page,release,errors};
}

test('stalled renderer import reaches its deadline and permits retry without waiting for the import',async t=>{
 const {page,release,errors}=await setup(t);await page.clock.fastForward(31000);
 await page.waitForFunction(()=>document.querySelector('#reader').getAttribute('aria-busy')==='false',{},{timeout:2000});assert.match(await page.locator('#status').innerText(),/30-second/);assert.equal(await page.locator('#retry').isEnabled(),true);
 release();await page.locator('#retry').click();await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('SEARCH-PDF-0001'));assert.deepEqual(errors,[]);
});

test('cancelling a stalled import recovers focus and ending the session prevents late content',async t=>{
 const {page,release,errors}=await setup(t);await page.locator('#cancel').click();await page.waitForFunction(()=>document.activeElement.id==='retry'&&!document.querySelector('#retry').disabled,{},{timeout:2000});
 await page.locator('#close').click();release();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Viewing session ended.'));await page.waitForTimeout(200);assert.equal(await page.locator('.pdf-page').count(),0);assert.deepEqual(errors,[]);
});
