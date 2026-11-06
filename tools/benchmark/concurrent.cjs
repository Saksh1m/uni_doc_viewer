'use strict';
const {launch}=require('./run.cjs'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
(async()=>{
 const h=await launch(),result={startedAt:new Date().toISOString(),scope:'Five simultaneous source viewer sessions, isolated headless Chromium; sampled memory only'};
 try{
  result.baseline=await h.sample();const start=performance.now(),sessions=await Promise.all(['LARGE-PDF','DOCX-01','EPUB-3','LARGE-XLSX','LARGE-CSV'].map(id=>h.open(id)));result.allReadyMs=performance.now()-start;
  result.opens=sessions.map(s=>({id:s.id,readyMs:s.readyMs,admissionMs:s.admissionMs}));
  assert.match(await sessions[0].page.locator('.textLayer').innerText(),/SEARCH-PDF/);assert.match(await sessions[1].page.frameLocator('iframe').locator('body').innerText(),/DOCX-SEARCH/);assert.match(await sessions[2].page.frameLocator('iframe').locator('body').innerText(),/EPUB-CHAPTER/);assert.match(await sessions[3].page.locator('table').innerText(),/R00001C01/);assert.match(await sessions[4].page.locator('table').innerText(),/R000001-C01-SYNTHETIC/);
  result.loaded=await h.sample();assert.equal(result.loaded.broker.sessions,5);
  for(const s of sessions)await s.close({expectEmpty:false});result.afterClose=await h.sample();for(const key of ['sessions','pendingRegistrations','snapshotBytes','activeReads'])assert.equal(result.afterClose.broker[key],0);
  result.finishedAt=new Date().toISOString();result.correctDocuments=true;
 }catch(error){result.error=error.stack;process.exitCode=1;}finally{await h.stop();await fs.writeFile(path.resolve(__dirname,'../../tests/results/step-11-concurrent.json'),JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify({allReadyMs:result.allReadyMs,loadedWorkingSetMiB:result.loaded?.workingSetBytes/1048576,afterCloseMiB:result.afterClose?.workingSetBytes/1048576,correctDocuments:result.correctDocuments,error:result.error},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
