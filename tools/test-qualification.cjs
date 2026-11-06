'use strict';
const {spawn}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),names=process.argv.slice(2),browsers=names.length?names:['chrome','msedge','firefox'];
if(browsers.some(n=>!['chromium','chrome','msedge','firefox'].includes(n)))throw Error('Choose chromium, chrome, msedge or firefox.');
(async()=>{
 const results=[];await fs.mkdir(path.join(root,'tests/results'),{recursive:true});
 for(const name of browsers){
  const result=await new Promise(resolve=>{let output='';const child=spawn(process.execPath,['--test','tests/qualification.test.cjs'],{cwd:root,windowsHide:true,env:{...process.env,UFV_BROWSER:name},stdio:['ignore','pipe','pipe']});
   for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{output+=data;process.stdout.write(data);});child.on('error',error=>{output+='\n'+error.message;});child.on('close',code=>resolve({browser:name,exitCode:code,output}));
  });
  await fs.writeFile(path.join(root,'tests/results/qualification-'+name+'.tap'),result.output);
  results.push({browser:name,exitCode:result.exitCode,version:new RegExp('# '+name+' ([\\d.]+)').exec(result.output)?.[1]||null,passed:Number(/# pass (\d+)/.exec(result.output)?.[1]||0),failed:Number(/# fail (\d+)/.exec(result.output)?.[1]||0),launchFailure:/browserType.launch:/.test(result.output)});
 }
 await fs.writeFile(path.join(root,'tests/results/qualification-matrix.json'),JSON.stringify({recordedAt:new Date().toISOString(),scope:'Isolated headless source tests; not installed-product qualification',results},null,2)+'\n');
 process.exitCode=results.some(r=>r.exitCode!==0)?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;});
