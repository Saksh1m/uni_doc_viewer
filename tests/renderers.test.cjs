'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),readline=require('node:readline'),{once}=require('node:events');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist/UniversalFileViewer');
const fixtures=require('./fixtures/generated/manifest.json').fixtures;
function fixture(id){return path.join(root,'tests/fixtures/generated',fixtures.find(f=>f.id===id).path);}
async function harness(t){
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const env={...process.env,PATH:process.env.SystemRoot+'\\System32'};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const child=spawn(path.join(dist,'runtime/node.exe'),[process.env.UFV_TEST_SOURCE?path.join(root,'src/managed.cjs'):path.join(dist,'app/managed.cjs')],{windowsHide:true,cwd:process.env.TEMP,env,stdio:['pipe','pipe','pipe']});const lines=readline.createInterface({input:child.stdout});
 t.after(()=>{child.kill();lines.close();});child.stdin.on('error',()=>{});
 function nextLine(){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{done();reject(Error('Packaged runtime response timeout'));},15000);const line=value=>{done();resolve(JSON.parse(value));};const exit=()=>{done();reject(Error('Packaged runtime exited before its response'));};function done(){clearTimeout(timer);lines.off('line',line);child.off('exit',exit);}lines.once('line',line);child.once('exit',exit);if(child.exitCode!==null)exit();});}
 assert.equal((await nextLine()).ready,'1');
 async function open(id,file){const result=nextLine();child.stdin.write(JSON.stringify({op:'open',path:file||fixture(id)})+'\n');const s=await result;assert.ok(s.url,s.error);const origin=new URL(s.url).origin,context=await browser.newContext({viewport:{width:1200,height:850}}),page=await context.newPage(),external=[],errors=[],workers=[],ranges=[];
  page.setDefaultTimeout(15000);await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin){external.push(u.href);return route.abort();}return route.continue();});
  page.on('pageerror',e=>errors.push(e.message));page.on('worker',w=>workers.push(w.url()));page.on('request',r=>{if(r.url().endsWith('/bytes')&&r.headers().range)ranges.push(r.headers().range);});
  await page.goto(s.url);t.diagnostic('Opened '+id);
  return {page,context,external,errors,workers,ranges,id};
 }
 async function ready(s){await s.page.waitForFunction(()=>document.querySelector('#cancel').hidden&&document.querySelector('#tools').hidden===false);const status=await s.page.locator('#status').innerText();assert.ok(!/could not|cancelled|expired/.test(status),s.id+': '+status);}
 async function finish(s){assert.deepEqual(s.external,[],s.id+' external requests');assert.deepEqual(s.errors,[],s.id+' page errors');await s.page.locator('#close').click();await s.page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Viewing session ended.'));await s.context.close();}
 return {open,ready,finish};
}
test('packaged PDF and raster-image adapters: navigation, search, password, zoom and orientation',async t=>{
 const h=await harness(t);let s=await h.open('PDF-01');await h.ready(s);
 assert.equal(await s.page.locator('.pdf-page canvas').count(),1);assert.match(await s.page.locator('.textLayer').innerText(),/SEARCH-PDF-0001/);assert.ok(s.workers.some(w=>w.includes('pdf.worker')));
 await s.page.getByRole('button',{name:'Next page',exact:true}).click();await s.page.waitForFunction(()=>document.querySelector('.textLayer').textContent.includes('0002'));
 await s.page.getByLabel('Find in PDF').fill('0003');await s.page.getByRole('button',{name:'Find next',exact:true}).click();await s.page.waitForFunction(()=>document.querySelector('.textLayer').textContent.includes('0003'));
 await s.page.getByRole('button',{name:'Zoom in',exact:true}).click();await s.page.waitForFunction(()=>document.querySelector('#cancel').hidden);assert.ok(await s.page.locator('.pdf-page canvas').evaluate(c=>c.width*c.height<=16010000));
 await fs.mkdir(path.join(root,'tests/results'),{recursive:true});await s.page.screenshot({path:path.join(root,'tests/results/integrated-pdf.png'),fullPage:true});await h.finish(s);
 s=await h.open('PDF-PASSWORD');await s.page.getByLabel('PDF password').fill('wrong');await s.page.getByRole('button',{name:'Unlock',exact:true}).click();await s.page.getByText('Incorrect password. Try again:',{exact:false}).waitFor();await s.page.getByLabel('PDF password').fill('viewer-test');await s.page.getByRole('button',{name:'Unlock',exact:true}).click();await h.ready(s);assert.equal(await s.page.locator('.pdf-page canvas').count(),1);await h.finish(s);
 for(const id of ['IMG-PNG','IMG-JPG','IMG-WEBP','IMG-EXIF']){s=await h.open(id);await h.ready(s);const img=s.page.locator('.raster-image');assert.ok(await img.evaluate(i=>i.complete&&i.naturalWidth>0));await s.page.getByRole('button',{name:'Zoom in',exact:true}).click();await s.page.getByRole('button',{name:'Fit width',exact:true}).click();if(id==='IMG-EXIF'){const size=await img.evaluate(i=>[i.naturalWidth,i.naturalHeight]);assert.ok(size[1]>size[0],'EXIF orientation should rotate dimensions');}await h.finish(s);}
});
test('packaged isolated reading views: Word, Markdown and EPUB chapters',async t=>{
 const h=await harness(t);
 for(const id of ['MD-01','SEC-MD','DOCX-01','EPUB-2','EPUB-3','SEC-EPUB']){const s=await h.open(id);await h.ready(s);const frame=s.page.frameLocator('iframe');const text=await frame.locator('body').innerText();assert.match(text,id.startsWith('DOCX')?/DOCX-SEARCH-MARKER/:id.includes('EPUB')?/EPUB-CHAPTER-1/:id==='MD-01'?/MD-TABLE/:/./);
  assert.equal(await frame.locator('script,iframe,object,embed').count(),0);assert.equal(await s.page.locator('iframe').getAttribute('sandbox'),'allow-same-origin');
  if(id==='DOCX-01'){assert.ok(s.workers.some(w=>w.endsWith('/parse-worker.js')));const images=await frame.locator('img').evaluateAll(nodes=>nodes.map(i=>({width:i.naturalWidth,complete:i.complete})));assert.ok(images.length>0&&images.every(i=>i.complete&&i.width>0));}
  if(id.includes('EPUB')){await s.page.getByRole('button',{name:'Next chapter',exact:true}).click();await s.page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.body?.textContent.includes('EPUB-CHAPTER-2'));await h.ready(s);await s.page.reload();await h.ready(s);assert.match(await s.page.frameLocator('iframe').locator('body').innerText(),/EPUB-CHAPTER-2/);}
  if(id==='DOCX-01')await s.page.screenshot({path:path.join(root,'tests/results/integrated-docx.png'),fullPage:true});await h.finish(s);
 }
});
test('packaged table adapters: literal CSV, cached XLSX values, sheet navigation and bounded rows',async t=>{
 const h=await harness(t);
 for(const id of ['DATA-QUOTED','DATA-SEMICOLON','DATA-BASIC','XLSX-01','XLSX-1904','LARGE-XLSX','LARGE-CSV']){const s=await h.open(id);await h.ready(s);assert.ok(s.workers.some(w=>w.endsWith('/parse-worker.js')));assert.ok(await s.page.locator('tr').count()<=101);const text=await s.page.locator('table').innerText();
  if(id==='DATA-QUOTED'){assert.match(text,/00002/);assert.match(text,/=1\+1/);}
  if(id==='DATA-SEMICOLON'){await s.page.getByLabel('Delimiter',{exact:true}).selectOption(';');await s.page.waitForFunction(()=>document.querySelector('table').textContent.includes('1,25'));}
  if(id.startsWith('XLSX-')){assert.match(text,/001234/);assert.match(text,/12345678901234567890/);assert.match(text,/2024-01-02/);assert.match(text,/calculated value unavailable/);await s.page.getByLabel('Sheet',{exact:true}).selectOption({index:1});await s.page.waitForFunction(()=>document.querySelector('table').textContent.includes('SECOND-SHEET-MARKER'));}
  if(id.startsWith('LARGE')){await s.page.getByLabel('First row',{exact:true}).fill(id==='LARGE-XLSX'?'10000':'100001');await s.page.getByLabel('First row',{exact:true}).press('Tab');await s.page.waitForFunction(()=>/R10000C10|R100000-C10-SYNTHETIC/.test(document.querySelector('table').textContent));}
  await h.finish(s);
 }
 const edge=await h.open('CACHE-EDGE',path.join(root,'experiments/renderers/generated/cache-edge.xlsx'));await h.ready(edge);
 assert.equal(await edge.page.locator('tr').nth(9).locator('td').nth(1).innerText(),'[calculated value unavailable]');
 assert.equal(await edge.page.locator('tr').nth(12).locator('td').nth(1).innerText(),'0');assert.equal(await edge.page.locator('tr').nth(13).locator('td').nth(1).innerText(),'');await h.finish(edge);
});
test('packaged range delivery, corrupt PDF failure and cancellation with retry',async t=>{
 const h=await harness(t);let s=await h.open('LARGE-PDF');await h.ready(s);assert.ok(s.ranges.length>0,'large PDF must use authenticated range requests');
 await s.page.getByLabel('Page number').fill('500');await s.page.getByLabel('Page number').press('Tab');await s.page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('0500'));await h.finish(s);
 s=await h.open('PDF-BAD');await s.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('could not be displayed'));assert.equal(await s.page.locator('#close').isVisible(),true);await h.finish(s);
 s=await h.open('PDF-PASSWORD');await s.page.getByLabel('PDF password').waitFor();const workersClosed=Promise.all(s.page.workers().map(w=>w.waitForEvent('close',{timeout:2000})));const began=Date.now();await s.page.locator('#cancel').click();await s.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('cancelled'));await workersClosed;assert.ok(Date.now()-began<2000);
 await s.page.waitForTimeout(100);await s.page.getByRole('button',{name:'Retry loading',exact:true}).click();await s.page.getByLabel('PDF password').fill('viewer-test');await s.page.getByRole('button',{name:'Unlock',exact:true}).click();await h.ready(s);await h.finish(s);
});

test('step 8 source: bounded printing, search highlighting and recoverable range errors',{skip:!process.env.UFV_TEST_SOURCE},async t=>{
 const h=await harness(t);let s=await h.open('PDF-01');await h.ready(s);
 await s.page.getByLabel('Find in PDF').fill('0001');await s.page.getByLabel('Find in PDF').press('Enter');await s.page.locator('.search-hit').first().waitFor();assert.match(await s.page.locator('.search-hit').first().innerText(),/0001/);
 await s.page.getByLabel('Print through page').fill('999');await s.page.locator('#print').click();await s.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Print preparation stopped'));assert.equal(await s.page.locator('.pdf-page canvas').count(),1);
 await s.page.getByLabel('Print through page').fill('3');await s.page.locator('#print').click();await s.page.locator('#print-preview').waitFor();assert.equal(await s.page.locator('#print-root img').count(),3);await s.page.screenshot({path:path.join(root,'tests/results/step-8-print-preview.png'),fullPage:true});await s.page.pdf({path:path.join(root,'tests/results/step-8-print.pdf'),format:'A4',printBackground:true});
 await s.page.evaluate(()=>{window.print=()=>{window.printCalled=true;};});await s.page.getByRole('button',{name:'Print prepared content',exact:true}).click();assert.equal(await s.page.evaluate(()=>window.printCalled),true);
 await s.page.getByRole('button',{name:'Back to reading',exact:true}).press('Escape');assert.equal(await s.page.locator('#print-preview').count(),0);await h.finish(s);
 s=await h.open('LARGE-PDF');await h.ready(s);await s.page.locator('#print').click();await s.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('at most 200'));
 await s.page.getByLabel('Print through page').fill('100');await s.page.locator('#print').click();await s.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('64-million-pixel'));assert.equal(await s.page.locator('#print-root').count(),0);
 await s.page.getByRole('button',{name:'Next page',exact:true}).click();await s.page.waitForFunction(()=>document.querySelector('.textLayer').textContent.includes('0002'));await h.finish(s);
 for(const id of ['DOCX-01','MD-01','SEC-MD','EPUB-3']){s=await h.open(id);await h.ready(s);await s.page.locator('#print').click();await s.page.locator('#print-root').waitFor();assert.equal(await s.page.locator('#print-root script,#print-root iframe,#print-root [onerror]').count(),0);assert.ok((await s.page.locator('#print-root').innerText()).length>10);await s.page.getByRole('button',{name:'Back to reading',exact:true}).click();await h.finish(s);}
});

test('step 8 source: EPUB scroll/font restoration, narrow layout and password waiting',{skip:!process.env.UFV_TEST_SOURCE},async t=>{
 const JSZip=require('jszip'),os=require('node:os'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'ufv-reading-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const zip=await JSZip.loadAsync(await fs.readFile(fixture('EPUB-3')));let changed=false;
 for(const name of Object.keys(zip.files)){if(!name.endsWith('.xhtml'))continue;const text=await zip.file(name).async('string');if(text.includes('EPUB-CHAPTER-1')){zip.file(name,text.replace('</body>','<p>Reading position test paragraph.</p>'.repeat(200)+'</body>'));changed=true;}}
 assert.ok(changed);const file=path.join(dir,'long-book.epub');await fs.writeFile(file,await zip.generateAsync({type:'nodebuffer'}));
 const h=await harness(t);let s=await h.open('LONG-BOOK',file);await h.ready(s);await s.page.getByLabel('Text size',{exact:true}).selectOption('24');await s.page.waitForFunction(()=>document.querySelector('#cancel').hidden);
 await s.page.locator('iframe').evaluate(f=>{const d=f.contentDocument.documentElement;f.contentWindow.scrollTo(0,(d.scrollHeight-d.clientHeight)*.6);});
 await s.page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('ufv-position:'+location.pathname.split('/').pop()))?.scroll>.5);await s.page.reload();await h.ready(s);assert.equal(await s.page.getByLabel('Text size',{exact:true}).inputValue(),'24');assert.ok(await s.page.locator('iframe').evaluate(f=>{const d=f.contentDocument.documentElement;return Math.abs(d.scrollTop/(d.scrollHeight-d.clientHeight)-.6)<.03;}));
 await s.page.setViewportSize({width:600,height:425});assert.ok(await s.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await s.page.getByLabel('Find in reading view').fill('paragraph');await s.page.getByLabel('Find in reading view').press('Enter');await s.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Matching text selected'));
 await s.page.locator('#close').click();assert.equal(await s.page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('ufv-position:')).length),0);await s.context.close();
 s=await h.open('PDF-PASSWORD');await s.page.getByLabel('PDF password').waitFor();await s.page.clock.install();await s.page.clock.fastForward(35000);assert.equal(await s.page.getByLabel('PDF password').isVisible(),true);await s.page.getByLabel('PDF password').fill('viewer-test');await s.page.getByRole('button',{name:'Unlock',exact:true}).click();await h.ready(s);await h.finish(s);
});

test('step 9 source: hostile markup remains inert in reading and print views',{skip:!process.env.UFV_TEST_SOURCE},async t=>{
 const os=require('node:os'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'ufv-hostile-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'hostile.md'),payload=`# Safe heading
<script>parent.document.body.dataset.compromised='yes'</script>
<img src="https://example.invalid/leak" onerror="parent.document.body.dataset.compromised='yes'">
<iframe src="https://example.invalid/frame"></iframe>
<form action="https://example.invalid/post"><input name="secret"><button>Send</button></form>
<svg onload="alert(1)"><a href="javascript:alert(1)">bad</a></svg>
<math><mtext><img src=x onerror=alert(1)></mtext></math>
<a href="javascript:alert(1)" ping="https://example.invalid/ping">click</a>
<meta http-equiv="refresh" content="0;url=https://example.invalid/redirect">
<div id="print-preview" name="status" class="print-controls" style="display:none">VISIBLE-PRINT-CONTENT</div>`;
 await fs.writeFile(file,payload);const h=await harness(t),s=await h.open('HOSTILE-MARKUP',file);await h.ready(s);
 const body=s.page.frameLocator('iframe').locator('body');assert.equal(await body.locator('script,iframe,form,input,button,svg,math,meta,[onerror],[onload],[href],[class],[id],[name]').count(),0);assert.match(await body.innerText(),/VISIBLE-PRINT-CONTENT/);assert.equal(await s.page.evaluate(()=>document.body.dataset.compromised),undefined);
 await s.page.locator('#print').click();await s.page.locator('#print-root').waitFor();assert.equal(await s.page.locator('#print-root script,#print-root [class],#print-root [id]').count(),0);await s.page.emulateMedia({media:'print'});assert.equal(await s.page.getByText('VISIBLE-PRINT-CONTENT',{exact:true}).isVisible(),true);await s.page.emulateMedia({media:'screen'});await s.page.getByRole('button',{name:'Back to reading',exact:true}).click();await h.finish(s);assert.equal(await fs.readFile(file,'utf8'),payload);
});

test('step 9 source: cancellation while encoding print images releases the reader for retry',{skip:!process.env.UFV_TEST_SOURCE},async t=>{
 const h=await harness(t),s=await h.open('PDF-01');await h.ready(s);
 await s.page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;window.restoreEncoder=()=>{HTMLCanvasElement.prototype.toBlob=original;};HTMLCanvasElement.prototype.toBlob=function(callback,...args){window.encodingStarted=true;original.call(this,blob=>setTimeout(()=>callback(blob),5000),...args);};});
 await s.page.locator('#print').click();await s.page.waitForFunction(()=>window.encodingStarted);const closed=Promise.all(s.page.workers().map(w=>w.waitForEvent('close',{timeout:2000}))),start=Date.now();await s.page.locator('#cancel').click();await closed;await s.page.getByRole('button',{name:'Retry loading',exact:true}).waitFor();await s.page.evaluate(()=>window.restoreEncoder());await s.page.getByRole('button',{name:'Retry loading',exact:true}).click();await h.ready(s);assert.ok(Date.now()-start<2000,'cancel and retry must complete without waiting for the encoder callback');assert.equal(await s.page.locator('#print-preview').count(),0);
 await s.page.waitForTimeout(5100);assert.equal(await s.page.locator('#print-preview').count(),0);assert.equal(await s.page.locator('.pdf-page canvas').count(),1);await h.finish(s);
});
