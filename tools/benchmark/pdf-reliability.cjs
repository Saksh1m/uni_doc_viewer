'use strict';
const {launch}=require('./run.cjs'),fs=require('node:fs/promises'),path=require('node:path'),{performance}=require('node:perf_hooks');
(async()=>{
 const result={startedAt:new Date().toISOString(),purpose:'Follow-up investigation of the earlier unclassified fresh-process PDF timeout',runs:[]},file=path.resolve(__dirname,'../../tests/results/'+(process.env.UFV_PDF_REPORT==='step-12'?'step-12-pdf-reliability.json':'step-11-pdf-reliability.json'));
 for(let i=0;i<10;i++){const start=performance.now();let h;try{h=await launch();const s=await h.open('PERF-PDF');result.runs.push({iteration:i+1,readyMs:performance.now()-start,ok:true});await s.close();}catch(error){result.runs.push({iteration:i+1,ok:false,error:error.message,viewerState:error.viewerState});process.exitCode=1;}finally{if(h)await h.stop();await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');}console.log('PDF startup probe '+(i+1)+': '+(result.runs.at(-1).ok?'passed':'failed'));}
 result.finishedAt=new Date().toISOString();await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
