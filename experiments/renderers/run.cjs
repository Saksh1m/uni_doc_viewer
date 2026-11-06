const {chromium}=require('../../node_modules/@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),readline=require('node:readline');
const root=path.resolve(__dirname,'../..'),dist=path.join(root,'dist/renderer-lab'),out=path.join(__dirname,'results');
const cases=[
 ['PDF-01','pdf',{},r=>{assert.equal(r.pages,3);assert.match(r.text,/SEARCH-PDF-0001/);assert.match(r.lastText,/0003/);} ],
 ['PDF-PASSWORD','pdf',{password:'viewer-test',wrongFirst:true},r=>assert.equal(r.passwordPrompts,2)],
 ['LARGE-PDF','pdf',{},r=>{assert.equal(r.pages,500);assert.match(r.lastText,/0500/);} ],
 ['PERF-PDF-10','pdf',{},r=>assert.match(r.text,/IMAGE-HEAVY-10MB/)],
 ['PERF-PDF-100','pdf',{},r=>assert.match(r.text,/IMAGE-HEAVY-100MB/)],
 ['DOCX-01','docx',{},r=>{assert.match(r.html,/DOCX-SEARCH-MARKER/);assert.match(r.html,/<table/);assert.equal(r.embeddedImages,1);} ],
 ['DOCX-LAYOUT','docx',{},r=>{assert.match(r.html,/MERGED-CELL-MARKER/);assert.ok(!r.html.includes('HEADER-FIDELITY-MARKER'));}],
 ['PERF-DOCX','docx',{},r=>assert.ok(r.embeddedImages>=8)],
 ['EPUB-2','epub',{},r=>{assert.match(r.firstText,/EPUB-CHAPTER-1/);assert.match(r.secondText,/EPUB-CHAPTER-2/);assert.equal(r.nav.length,2);} ],
 ['EPUB-3','epub',{},r=>assert.match(r.secondText,/EPUB-CHAPTER-2/)],
 ['SEC-EPUB','epub',{},r=>{assert.equal(r.executed,false);assert.match(r.firstText,/EPUB-CHAPTER-1/);} ],
 ['PERF-EPUB','epub',{},r=>assert.match(r.firstText,/CAPACITY-EPUB-0/)],
 ['XLSX-01','xlsx',{},r=>{const c=r.sheets[0].cells;assert.equal(c.B2.v,'001234');assert.equal(c.B3.v,'12345678901234567890');assert.equal(c.B6.w,'2024-01-02');assert.equal(c.B7.w,'12.5%');assert.equal(c.B8.v,5);assert.equal(c.B9.f,'SUM(4,5)');assert.ok(c.B9.v==null);assert.equal(c.B10.v,999);assert.equal(r.sheets[1].cells.A1.v,'SECOND-SHEET-MARKER');}],
 ['XLSX-1904','xlsx',{},r=>{assert.equal(r.date1904,true);assert.equal(r.sheets[0].cells.B6.w,'2024-01-02');}],
 ['CACHE-EDGE','xlsx',{},r=>{const c=r.sheets[0].cells;assert.equal(c.B9.cacheStatus,'unavailable');assert.equal(c.B12.v,0);assert.equal(c.B12.cacheStatus,'present-may-be-stale');assert.equal(c.B13.v,'');assert.equal(c.B13.cacheStatus,'present-may-be-stale');}],
 ['LARGE-XLSX','xlsx',{},r=>{assert.equal(r.sheets[0].rows,10000);assert.equal(r.sheets[0].last.v,'R10000C10');}],
 ['LARGE-XLSX','xlsx',{cancel:true},r=>{assert.equal(r.cancelled,true);assert.ok(r.cancelMs<2000);}],
 ['DATA-QUOTED','csv',{},r=>assert.deepEqual(r.first[2],['00002','line one\nline two','=1+1'])],
 ['DATA-SEMICOLON','csv',{delimiter:';'},r=>assert.deepEqual(r.last,['001','1,25'])],
 ['DATA-BASIC','tsv',{},r=>assert.deepEqual(r.last,['001','TSV-MARKER'])],
 ['LARGE-CSV','csv',{},r=>{assert.equal(r.count,100001);assert.equal(r.last[9],'R100000-C10-SYNTHETIC');}],
 ['CSV-BAD','csv',{},r=>assert.ok(r.errors.length>0)],
 ['MD-01','md',{},r=>{assert.match(r.html,/<table/);assert.match(r.html,/MD-TABLE/);}],
 ['SEC-MD','md',{},r=>{assert.ok(!/<script|\sonerror\s*=|\sstyle\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:)/i.test(r.html));}],
 ...['PDF-BAD','PDF-SPOOF','BAD-DOCX','BAD-EPUB','BAD-XLSX'].map(id=>[id,id.startsWith('PDF')?'pdf':id.slice(4).toLowerCase(),{},null]),
 ['SEC-EXPAND','epub',{expandedBudget:512*1024},null,/Expanded-byte budget/],
 ['SEC-TRAVERSAL','epub',{},null,/Unsafe archive path/]
];
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const env={...process.env,PATH:process.env.SystemRoot+'\\System32'};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const server=spawn(path.join(dist,'runtime/node.exe'),[path.join(dist,'server.cjs')],{cwd:process.env.TEMP,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const lines=readline.createInterface({input:server.stdout});
 let browser,browserServer,sampler;
 try{
  const ready=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Lab startup timeout')),10000);lines.once('line',l=>{clearTimeout(timer);resolve(JSON.parse(l));});server.once('error',reject);server.once('exit',()=>reject(Error('Lab server exited')));});
  browserServer=await chromium.launchServer({headless:true});browser=await chromium.connect(browserServer.wsEndpoint());
  const stop=path.join(out,'memory.stop'),memoryFile=path.join(out,'memory.jsonl');await fs.rm(stop,{force:true});
  sampler=spawn(path.join(root,'.venv-fixtures/Scripts/python.exe'),[path.join(__dirname,'memory_sampler.py'),server.pid+','+browserServer.process().pid,memoryFile,stop],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let samplerError='';sampler.stderr.on('data',b=>samplerError+=b);sampler.on('error',e=>samplerError+=e.message);
  const results=[];let index=0;
  for(const [id,kind,opts,verify,errorPattern] of cases){
   const caseStarted=Date.now();const context=await browser.newContext({viewport:{width:1100,height:850}}),page=await context.newPage();
   page.setDefaultTimeout(30000);const external=[],workers=[],errors=[];
   await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==new URL(ready.url).origin){external.push(u.origin);return route.abort();}return route.continue();});
   page.on('worker',w=>workers.push(new URL(w.url()).pathname.split('/').pop()));page.on('pageerror',e=>errors.push(e.message));
   const record={id,kind,options:opts,status:'not_run',startedAt:caseStarted};
   try{
    await page.goto(ready.url);await page.waitForFunction(()=>window.labReady===true);
    const client=await context.newCDPSession(page);await client.send('Performance.enable');
    const value=await Promise.race([page.evaluate(async([id,kind,opts])=>{try{return {value:await window.run(id,kind,opts)};}catch(e){return {error:e.message};}},[id,kind,opts]),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Experiment deadline exceeded')),45000);timer.unref();})]);
    if(verify){if(value.error)throw Error(value.error);verify(value.value);}
    else{assert.ok(value.error,'Expected invalid/probe input to be rejected');if(errorPattern)assert.match(value.error,errorPattern);}
    assert.deepEqual(external,[],'Unexpected external request');assert.deepEqual(errors,[],'Unhandled browser error');
    if(kind==='pdf'&&verify)assert.ok(workers.some(w=>w.includes('pdf.worker')),'PDF must use a real worker');
    if(['xlsx','csv','tsv'].includes(kind)&&verify)assert.ok(workers.includes('data-worker.js'));
    if(kind==='docx'&&verify){assert.ok(workers.includes('doc-worker.js'));const images=await page.frameLocator('iframe').locator('img').evaluateAll(imgs=>imgs.map(i=>({complete:i.complete,width:i.naturalWidth})));assert.ok(images.length>0&&images.every(i=>i.complete&&i.width>0),'DOCX images must actually decode');}
    const metrics=await client.send('Performance.getMetrics');record.mainPageHeapBytes=metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value;
    if(value.value){const {html,...rest}=value.value;record.result=rest;if(html)record.htmlSummary={length:html.length,hasHeaderMarker:html.includes('HEADER-FIDELITY-MARKER')};}
    else record.expectedError=value.error;
    if(['PDF-01','DOCX-01','EPUB-3','XLSX-01','MD-01'].includes(id)){await page.screenshot({path:path.join(out,id+'.png'),fullPage:true});}
    record.status='pass';
   }catch(e){record.status='fail';record.error=e.message;await page.screenshot({path:path.join(out,'failure-'+index+'.png')}).catch(()=>{});}
   record.endedAt=Date.now();record.workers=workers;record.externalRequests=external;record.pageErrors=errors;results.push(record);
   console.log(record.status.toUpperCase(),id,opts.cancel?'cancel':'',record.error||Math.round(record.result?.firstContentMs||0)+'ms');
   await context.close();index++;
  }
  const transfer=await (await fetch(ready.url+'metrics')).json();
  await fs.writeFile(stop,'stop');
  if(sampler.exitCode===null)await new Promise(resolve=>{sampler.once('exit',resolve);const timer=setTimeout(resolve,5000);timer.unref();});
  const samples=(await fs.readFile(memoryFile,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  for(const record of results){const active=samples.filter(s=>s.timeMs>=record.startedAt&&s.timeMs<=record.endedAt);record.memorySamples=active.length;record.peakPrivateBytes=active.length?Math.max(...active.map(s=>s.privateBytes)):null;}
  const report={browser:browser.version(),node:process.version,generatedAt:new Date().toISOString(),scope:'Single-run laboratory measurements after library preload. Main-page JS heap excludes workers/native memory. peakPrivateBytes samples combined private commit of test-browser and lab-server process trees every 100ms, including baseline/test overhead; not instantaneous peaks or release benchmark qualification.',memorySamplerErrors:samplerError,unreadableMemorySamples:samples.filter(s=>s.unreadable.length).length,results,transfer};
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));
  const failures=results.filter(r=>r.status!=='pass');console.log(`${results.length-failures.length}/${results.length} experiments passed`);if(failures.length)process.exitCode=1;
 }finally{await browser?.close();await browserServer?.close();sampler?.kill();server.kill();lines.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
