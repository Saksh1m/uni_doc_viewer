'use strict';
// Interactive source-development entry point. Does not invoke the native launcher,
// register file associations, or change Windows policy. The URL is user output,
// not an application log; do not persist or share this one-time credential.
const path=require('node:path'),fs=require('node:fs/promises');
const {startViewer}=require('../src/server.cjs'),{ViewerError}=require('../src/snapshot.cjs'),{FORMATS}=require('../src/formats.cjs');
async function main(args=process.argv.slice(2)){
 if(args[0]==='--')args=args.slice(1);
 if(!args.length||args.length===1&&args[0]==='--help'){
  process.stdout.write('Usage: node tools/view-local.cjs "C:\\path\\to\\document.pdf"\nSupported: '+FORMATS.join(', ')+'\nThis starts the source viewer. Keep this terminal open while reading.\n');return;
 }
 if(args.length!==1)throw new ViewerError('Provide one file path in quotes. Use --help for instructions.');
 const format=path.extname(args[0]).slice(1).toLowerCase();
 if(FORMATS.includes(format)&&!['txt','png','jpg','jpeg','webp'].includes(format)){
  const required={pdf:'pdf/pdf.mjs',docx:'mammoth.js',epub:'jszip.js',md:'marked.mjs',xlsx:'xlsx.js',csv:'papa.js',tsv:'papa.js'};
  try{await fs.access(path.resolve(__dirname,'../src/web/vendor',required[format]));}catch{throw new ViewerError('The local rendering assets are missing. From the code folder, run: node tools/build-renderers.cjs');}
 }
 const viewer=await startViewer(args[0]);
 const stop=()=>void viewer.close();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 viewer.server.once('close',()=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);process.stdout.write('Local viewer stopped.\n');});
 process.stdout.write('Open this one-time address in your browser within 60 seconds:\n'+viewer.url+'\nKeep this terminal open. Choose End viewing session in the browser when finished.\nThe address grants access to this file. Do not share it or save this output as a log.\n');
}
if(require.main===module)main().catch(error=>{process.stderr.write((error instanceof ViewerError?error.message:'The local viewer could not start.')+'\n');process.exitCode=1;});
module.exports={main};
