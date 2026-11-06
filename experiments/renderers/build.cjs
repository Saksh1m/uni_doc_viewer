const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'), out=path.join(root,'dist/renderer-lab');
async function copy(from,to){await fs.mkdir(path.dirname(to),{recursive:true});await fs.cp(from,to,{recursive:true});}
(async()=>{
 await fs.mkdir(out,{recursive:true});
 await copy(path.join(root,'dist/UniversalFileViewer/runtime'),path.join(out,'runtime'));
 for(const name of ['server.cjs','index.html','app.mjs','data-worker.js','doc-worker.js'])await copy(path.join(__dirname,name),path.join(out,name));
 const modules=path.join(__dirname,'node_modules'), vendor=path.join(out,'vendor');
 for(const [from,to] of [['pdfjs-dist/build','pdf'],['pdfjs-dist/cmaps','cmaps'],['pdfjs-dist/standard_fonts','standard_fonts'],['pdfjs-dist/wasm','wasm'],['pdfjs-dist/iccs','iccs'],['mammoth/mammoth.browser.min.js','mammoth.js'],['dompurify/dist/purify.min.js','purify.js'],['jszip/dist/jszip.min.js','jszip.js'],['xlsx/dist/xlsx.full.min.js','xlsx.js'],['papaparse/papaparse.min.js','papa.js'],['marked/lib/marked.esm.js','marked.mjs']])await copy(path.join(modules,from),path.join(vendor,to));
 // Rebuild from source so overrides actually reach the shipped bundle.
 const result=await esbuild.build({entryPoints:[path.join(modules,'epubjs/src/epub.js')],bundle:true,format:'iife',globalName:'EPUBModule',platform:'browser',target:'es2022',outfile:path.join(vendor,'epub.js'),metafile:true,define:{'process.env.NODE_ENV':'"production"'}});
 await fs.writeFile(path.join(out,'epub-bundle-inputs.json'),JSON.stringify(Object.keys(result.metafile.inputs),null,2));
 const fixtures=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/generated/manifest.json'),'utf8')).fixtures;
 const supplemental=JSON.parse(await fs.readFile(path.join(__dirname,'generated/manifest.json'),'utf8'));
 const index=[];
 for(const row of [...fixtures,...supplemental]){
  const source=path.join(row.kind?path.join(__dirname,'generated'):path.join(root,'tests/fixtures/generated'),row.path);
  const kind=row.kind||path.extname(row.path).slice(1);
  if(!['pdf','docx','epub','xlsx','csv','tsv','md'].includes(kind))continue;
  const file='inputs/'+row.id+'.'+kind;await copy(source,path.join(out,file));
  index.push({id:row.id,kind,file,bytes:row.bytes,sha256:row.sha256,expected:row.expected||row.description});
 }
 await fs.writeFile(path.join(out,'fixtures.json'),JSON.stringify(index,null,2));
 // Include notices for all resolved npm packages, including dependencies.
 const notices=[];
 async function packages(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.name.startsWith('.'))continue;const p=path.join(dir,e.name);if(e.isDirectory()&&e.name.startsWith('@')){await packages(p);continue;}if(!e.isDirectory())continue;try{const meta=JSON.parse(await fs.readFile(path.join(p,'package.json'),'utf8'));const docs=(await fs.readdir(p)).filter(n=>/^(licen[cs]e|copying|notice)/i.test(n));const texts=[];for(const n of docs){if((await fs.stat(path.join(p,n))).isFile())texts.push(await fs.readFile(path.join(p,n),'utf8'));}notices.push({name:meta.name,version:meta.version,license:meta.license,notices:texts});}catch{}try{await packages(path.join(p,'node_modules'));}catch{}}}
 await packages(modules);await fs.writeFile(path.join(out,'THIRD-PARTY-NOTICES.json'),JSON.stringify(notices,null,2));
 await copy(path.join(root,'dist/UniversalFileViewer/NODE-LICENSE.txt'),path.join(out,'NODE-LICENSE.txt'));
 const inventory=[];
 async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name!=='inventory.json'){const b=await fs.readFile(p);inventory.push({path:path.relative(out,p).replaceAll('\\','/'),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}}}
 await walk(out);await fs.writeFile(path.join(out,'inventory.json'),JSON.stringify(inventory,null,2));
 console.log('Built isolated renderer lab:',index.length,'inputs;',inventory.reduce((a,f)=>a+f.bytes,0),'bytes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
