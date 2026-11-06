'use strict';
const path=require('node:path');
const {createBroker}=require('./broker.cjs');
const {ViewerError}=require('./snapshot.cjs');
const {FORMATS}=require('./formats.cjs');
async function startViewer(filePath,options={}){
 if(!FORMATS.includes(path.extname(filePath||'').slice(1).toLowerCase()))throw new ViewerError('This file format is not supported by the installed viewer.');
 const broker=await createBroker(options);
 try{return {...broker,...await broker.registerFile(filePath)};}catch(e){await broker.close();throw e;}
}
module.exports={startViewer};
if(require.main===module){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--'){process.stderr.write('Open one .txt file using the Windows launcher.\n');process.exitCode=1;}
 else startViewer(args[1]).then(viewer=>{
  // The launcher owns this anonymous stdout pipe. This is not a persisted log.
  process.stdout.write(JSON.stringify({url:viewer.url})+'\n');
  process.once('SIGTERM',()=>void viewer.close());process.once('SIGINT',()=>void viewer.close());
 }).catch(error=>{process.stderr.write((error instanceof ViewerError?error.message:'The local viewer could not start. Please try again.')+'\n');process.exitCode=1;});
}
