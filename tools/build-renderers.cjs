'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),modules=path.join(root,'node_modules'),vendor=path.join(root,'src/web/vendor');
(async()=>{
 const copies=[['pdfjs-dist/build/pdf.mjs','pdf/pdf.mjs'],['pdfjs-dist/build/pdf.worker.mjs','pdf/pdf.worker.mjs'],['pdfjs-dist/web/pdf_viewer.css','pdf/pdf_viewer.css'],['pdfjs-dist/cmaps','cmaps'],['pdfjs-dist/standard_fonts','standard_fonts'],['pdfjs-dist/wasm','wasm'],['pdfjs-dist/iccs','iccs'],['mammoth/mammoth.browser.min.js','mammoth.js'],['jszip/dist/jszip.min.js','jszip.js'],['dompurify/dist/purify.min.js','purify.js'],['marked/lib/marked.esm.js','marked.mjs'],['papaparse/papaparse.min.js','papa.js'],['xlsx/dist/xlsx.full.min.js','xlsx.js']];
 for(const [from,to] of copies){await fs.mkdir(path.dirname(path.join(vendor,to)),{recursive:true});await fs.cp(path.join(modules,from),path.join(vendor,to),{recursive:true});}
 const notices=[];
 async function scan(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.name.startsWith('.')||!e.isDirectory())continue;const p=path.join(dir,e.name);if(e.name.startsWith('@')){await scan(p);continue;}
  try{const meta=JSON.parse(await fs.readFile(path.join(p,'package.json'),'utf8'));const texts=[];for(const n of await fs.readdir(p))if(/^(licen[cs]e|notice|copying)/i.test(n)&&(await fs.stat(path.join(p,n))).isFile())texts.push(await fs.readFile(path.join(p,n),'utf8'));notices.push({name:meta.name,version:meta.version,license:meta.license,notices:texts});}catch{}
  try{await scan(path.join(p,'node_modules'));}catch{}
 }}
 await scan(modules);await fs.writeFile(path.join(root,'src/THIRD-PARTY-NOTICES.json'),JSON.stringify(notices,null,2));
 console.log('Bundled local renderer assets and dependency notices.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
