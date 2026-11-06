'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,firefox}=require('@playwright/test'),{createBroker}=require('../src/broker.cjs');
const browserName=process.env.UFV_BROWSER||'chromium',root=path.resolve(__dirname,'..'),fixtures=require('./fixtures/generated/manifest.json').fixtures;
async function setup(t){
 const browser=await(browserName==='firefox'?firefox:chromium).launch({headless:true,...(['chrome','msedge'].includes(browserName)?{channel:browserName}:{})});
 const broker=await createBroker({emptyGraceMs:60000,tickMs:60000}),context=await browser.newContext({viewport:{width:1200,height:850}}),external=[],errors=[];
 t.after(async()=>{await browser.close();await broker.close();});t.diagnostic(browserName+' '+browser.version());
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==broker.origin){external.push(r.request().url());return r.abort();}return r.continue();});
 async function open(id){const f=fixtures.find(f=>f.id===id);assert.ok(f,id);const s=await broker.registerFile(path.join(root,'tests/fixtures/generated',f.path)),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.goto(s.url);return page;}
 async function ready(page){await page.waitForFunction(()=>document.querySelector('#reader').getAttribute('aria-busy')==='false'&&!document.querySelector('#tools').hidden);assert.doesNotMatch(await page.locator('#status').innerText(),/could not|cancelled|expired/);}
 async function close(page){await page.locator('#close').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Viewing session ended.'));assert.equal(await page.evaluate(()=>document.activeElement.id),'status');await page.close();assert.deepEqual(external,[]);assert.deepEqual(errors,[]);}
 return {browser,broker,context,open,ready,close,errors,external};
}

test(browserName+': required format families, offline assets and named controls',async t=>{
 const h=await setup(t);
 for(const [id,selector,marker]of [['TXT-01','#content',null],['PDF-01','.textLayer','SEARCH-PDF'],['IMG-PNG','.raster-image',null],['MD-01','iframe','MD-TABLE'],['DOCX-01','iframe','DOCX-SEARCH'],['EPUB-3','iframe','EPUB-CHAPTER'],['DATA-QUOTED','table','00002'],['DATA-BASIC','table',null],['XLSX-01','table','001234']]){
  const page=await h.open(id);await h.ready(page);await page.locator(selector).waitFor();if(marker)assert.ok((selector==='iframe'?await page.frameLocator('iframe').locator('body').innerText():await page.locator(selector).innerText()).includes(marker));
  const unnamed=await page.locator('button,input,select').evaluateAll(nodes=>nodes.filter(n=>!n.hidden&&n.getClientRects().length&&!((n.getAttribute('aria-label')||n.textContent||'').trim()||n.labels?.length)).map(n=>n.outerHTML));assert.deepEqual(unnamed,[]);
  await page.setViewportSize({width:600,height:425});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'shell should fit a 600px viewport');if(id==='MD-01'){await fs.mkdir(path.join(root,'tests/results'),{recursive:true});await page.screenshot({path:path.join(root,'tests/results/step-10-'+browserName+'-narrow.png'),fullPage:true});}
  await h.close(page);
 }
});

test(browserName+': keyboard navigation, cancellation focus, table search and preview return',async t=>{
 const h=await setup(t);let page=await h.open('PDF-PASSWORD');await page.getByLabel('PDF password').waitFor();await page.locator('#cancel').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement.id==='retry');await page.keyboard.press('Enter');await page.getByLabel('PDF password').fill('viewer-test');await page.getByLabel('PDF password').press('Enter');await h.ready(page);await h.close(page);
 page=await h.open('MD-01');await h.ready(page);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'skip-link');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'reader');assert.notEqual(await page.locator('#reader').evaluate(n=>getComputedStyle(n).outlineStyle),'none');
 await page.locator('#print').focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Back to reading',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Back to reading');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'print');await h.close(page);
 page=await h.open('XLSX-01');await h.ready(page);await page.getByLabel('First row',{exact:true}).fill('1.5');await page.getByLabel('First row',{exact:true}).press('Tab');await h.ready(page);assert.equal(await page.getByLabel('First row',{exact:true}).inputValue(),'1');await page.getByLabel('Find in sheet').fill('001234');await page.getByLabel('Find in sheet').press('Enter');await h.ready(page);assert.match(await page.locator('table').innerText(),/001234/);assert.ok(await page.locator('caption').isVisible());await h.close(page);
});

test(browserName+': rendered document recovery after cached-page restoration and connection loss',async t=>{
 const h=await setup(t),page=await h.open('PDF-01');await h.ready(page);
 // Deterministic page-transition simulation: not a claim that the browser cached this page.
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await h.ready(page);await page.getByRole('button',{name:'Next page',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('0002'));
 await h.context.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('connection is unavailable'));await h.context.setOffline(false);await page.waitForFunction(()=>document.querySelector('#retry').hidden);assert.match(await page.locator('.textLayer').innerText(),/0002/);
 await h.close(page);assert.equal(h.broker.diagnostics().sessions,0);assert.equal(h.broker.diagnostics().snapshotBytes,0);
});
