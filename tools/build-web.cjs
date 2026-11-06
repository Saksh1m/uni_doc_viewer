'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),site=path.join(root,'web-site'),dist=path.join(site,'dist');
(async()=>{
 await fs.mkdir(dist,{recursive:true});for(const name of await fs.readdir(path.join(site,'src')))await fs.copyFile(path.join(site,'src',name),path.join(dist,name));
 for(const name of await fs.readdir(path.join(root,'src/web')))if(/^render-.*\.mjs$|^parse-worker\.js$|^style\.css$/.test(name))await fs.copyFile(path.join(root,'src/web',name),path.join(dist,name));
 await fs.cp(path.join(root,'src/web/vendor'),path.join(dist,'vendor'),{recursive:true});await fs.copyFile(path.join(root,'src/THIRD-PARTY-NOTICES.json'),path.join(dist,'THIRD-PARTY-NOTICES.json'));
 const image=await fs.readFile(path.join(root,'src/image-info.cjs'),'utf8');await fs.writeFile(path.join(dist,'image-guard.mjs'),"import {Buffer} from './guard-runtime.mjs';\n"+image.slice(image.indexOf('// Inspect'),image.indexOf('module.exports'))+'\nexport {imageInfo};\n');
 const archive=await fs.readFile(path.join(root,'src/archive-check.cjs'),'utf8');let guard=archive.slice(archive.indexOf('const TOTAL'),archive.indexOf('// Serialize')).replace('function inspectArchive(', 'async function inspectArchive(').replace(':inflateRawSync(', ':await inflateRawSync(');
 await fs.writeFile(path.join(dist,'archive-guard.mjs'),"import {Buffer,crc32,inflateRawSync} from './guard-runtime.mjs';\nimport {imageInfo} from './image-guard.mjs';\n"+guard+'\nexport {inspectArchive};\n');
 const assets=[];async function walk(dir,base=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const rel=base+e.name;if(e.isDirectory())await walk(path.join(dir,e.name),rel+'/');else if(!['sw.js','_headers'].includes(rel))assets.push({url:'./'+rel,hash:crypto.createHash('sha256').update(await fs.readFile(path.join(dir,e.name))).digest('hex')});}}await walk(dist);assets.sort((a,b)=>a.url.localeCompare(b.url));
 const version=crypto.createHash('sha256').update(JSON.stringify(assets)).update(await fs.readFile(path.join(site,'service-worker.template.js'))).digest('hex').slice(0,16);
 const sw=(await fs.readFile(path.join(site,'service-worker.template.js'),'utf8')).replace('__VERSION__',version).replace('__ASSETS__',JSON.stringify(assets.map(a=>a.url)));
 await fs.writeFile(path.join(dist,'sw.js'),sw);console.log('Built browser-only site: '+assets.length+' assets; version '+version);
})().catch(error=>{console.error(error);process.exitCode=1;});
