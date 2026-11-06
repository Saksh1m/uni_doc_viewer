import * as pdfjs from './vendor/pdf/pdf.mjs';
import {marked} from './vendor/marked.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf/pdf.worker.mjs',location.href).href;
const view=document.querySelector('#view'),status=document.querySelector('#status');
let cleanup=async()=>{};
function preflightZip(buffer,budget=256*1024*1024){
 const b=new Uint8Array(buffer),v=new DataView(buffer);let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Invalid ZIP container');
 const count=v.getUint16(end+10,true);let offset=v.getUint32(end+16,true),expanded=0;
 if(count===65535||offset===0xffffffff)throw Error('ZIP64 not supported by lab guard');
 if(count>10000)throw Error('Too many archive entries');
 for(let i=0;i<count;i++){
  if(offset+46>end||v.getUint32(offset,true)!==0x02014b50)throw Error('Invalid ZIP directory');
  const size=v.getUint32(offset+24,true),n=v.getUint16(offset+28,true),extra=v.getUint16(offset+30,true),comment=v.getUint16(offset+32,true);
  if(offset+46+n+extra+comment>end)throw Error('Invalid ZIP directory bounds');
  const name=new TextDecoder().decode(b.slice(offset+46,offset+46+n));
  if(name.includes('\\')||name.startsWith('/')||name.split('/').includes('..')||name.includes(':'))throw Error('Unsafe archive path');
  if(v.getUint16(offset+8,true)&1)throw Error('Encrypted archive unsupported');
  expanded+=size;if(size===0xffffffff||expanded>budget)throw Error('Expanded-byte budget exceeded');
  offset+=46+n+extra+comment;
 }
 return {entries:count,declaredExpandedBytes:expanded};
}
window.preflightZip=preflightZip;
function safeHTML(html,allowedImages=new Set()){
 const safe=DOMPurify.sanitize(html,{FORBID_TAGS:['style','script','iframe','object','embed','form','input','link','base'],FORBID_ATTR:['style','srcset'],ALLOW_DATA_ATTR:false,ALLOWED_URI_REGEXP:/^(?:blob:|data:|#)/i});
 const template=document.createElement('template');template.innerHTML=safe;
 for(const el of template.content.querySelectorAll('[src]'))if(!allowedImages.has(el.getAttribute('src'))&&!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(el.getAttribute('src')))el.removeAttribute('src');
 for(const el of template.content.querySelectorAll('[href]'))el.removeAttribute('href');
 return template.innerHTML;
}
function showHTML(html){
 // Same-origin access permits generated blob images and future parent-driven search.
 // Scripts remain forbidden by both sandbox (no allow-scripts) and document CSP.
 const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin');
 frame.srcdoc=`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'"><style>body{font:16px/1.6 system-ui;margin:20px}img{max-width:100%}table{border-collapse:collapse}td{border:1px solid #aaa;padding:5px}</style>`+html;
 view.replaceChildren(frame);
 return new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
}
function tabulate(rows){
 const table=document.createElement('table');for(const row of rows){const tr=table.insertRow();for(const value of row){tr.insertCell().textContent=String(value??'');}}view.replaceChildren(table);
}
async function workerParse(kind,bytes,opts){
 const worker=new Worker(new URL(kind==='docx'?'./doc-worker.js':'./data-worker.js',location.href));cleanup=async()=>worker.terminate();
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{worker.terminate();reject(Error('Parser timeout'));},30000);
  worker.onmessage=e=>{if(e.data.started){if(opts.cancel){const t=performance.now();worker.terminate();clearTimeout(timer);resolve({cancelled:true,cancelMs:performance.now()-t});}return;}clearTimeout(timer);worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data.result);};
  worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};
  worker.postMessage({kind,bytes,delimiter:opts.delimiter},[bytes]);
 });
}
window.run=async function(id,kind,opts={}){
 await cleanup();cleanup=async()=>{};view.replaceChildren();status.textContent=id;
 const started=performance.now();let lag=0,last=performance.now();const ticker=setInterval(()=>{const now=performance.now();lag=Math.max(lag,now-last-20);last=now;},20);
 let result;
 try{
  const url=new URL('./fixture/'+id,location.href).href;
  if(kind==='pdf'){
   let passwordPrompts=0;
   const loading=pdfjs.getDocument({url,disableStream:true,disableAutoFetch:true,rangeChunkSize:65536,isEvalSupported:false,cMapUrl:new URL('./vendor/cmaps/',location.href).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/standard_fonts/',location.href).href,wasmUrl:new URL('./vendor/wasm/',location.href).href,iccUrl:new URL('./vendor/iccs/',location.href).href});
   loading.onPassword=(update,reason)=>{passwordPrompts++;if(!opts.password){loading.destroy();return;}update(passwordPrompts===1&&opts.wrongFirst?'wrong':opts.password);};
   cleanup=async()=>loading.destroy();const pdf=await loading.promise;
   const page=await pdf.getPage(opts.page||1),canvas=document.createElement('canvas'),viewport=page.getViewport({scale:1});canvas.width=viewport.width;canvas.height=viewport.height;view.append(canvas);
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   const firstContentMs=performance.now()-started;
   const text=(await page.getTextContent()).items.map(i=>i.str).join(' ');
   const lastPage=await pdf.getPage(pdf.numPages),lastText=(await lastPage.getTextContent()).items.map(i=>i.str).join(' ');
   result={pages:pdf.numPages,text,lastText,passwordPrompts,firstContentMs};
  }else{
   const response=await fetch(url);if(!response.ok)throw Error('Fixture not found');const bytes=await response.arrayBuffer();
   if(['docx','epub','xlsx'].includes(kind))preflightZip(bytes,opts.expandedBudget);
   if(kind==='docx'){
    const convertStart=performance.now();const converted=await workerParse('docx',bytes,opts);const conversionMs=performance.now()-convertStart;
    const sanitizeStart=performance.now();const images=new Map();
    for(const image of converted.images)if(/^image\/(png|jpeg|gif|webp)$/.test(image.mime))images.set(image.id,URL.createObjectURL(new Blob([image.bytes],{type:image.mime})));
    cleanup=async()=>{for(const url of images.values())URL.revokeObjectURL(url);};
    const replaced=converted.value.replace(/src="ufv-image:(\d+)"/g,(_,id)=>'src="'+(images.get(Number(id))||'')+'"');
    const html=safeHTML(replaced,new Set(images.values()));await showHTML(html);
    result={html,messages:converted.messages,embeddedImages:(html.match(/<img/g)||[]).length,conversionMs,sanitizeAndDisplayMs:performance.now()-sanitizeStart};
   }else if(kind==='md'){
    const html=safeHTML(marked(new TextDecoder().decode(bytes)));await showHTML(html);result={html};
   }else if(kind==='epub'){
    const book=EPUBModule.default(undefined,{replacements:'blobUrl'});
    book.spine.hooks.content.register(doc=>{
     for(const el of doc.querySelectorAll('script,style,link,base,iframe,object,embed,form'))el.remove();
     for(const el of doc.querySelectorAll('*'))for(const a of [...el.attributes]){
      const n=a.name.toLowerCase(),value=a.value.trim();
      if(n.startsWith('on')||n==='style'||n==='srcset'||((n==='src'||n==='href')&&(/^(https?:|\/\/|file:|javascript:)/i.test(value)||value.split('/').includes('..'))))el.removeAttribute(a.name);
     }
    });
    const rendition=book.renderTo(view,{width:900,height:600,allowScriptedContent:false,flow:'scrolled-doc'});cleanup=async()=>{rendition.destroy();book.destroy();};
    await book.open(bytes,'binary');await book.ready;await rendition.display();const firstContentMs=performance.now()-started;
    const firstText=rendition.getContents().map(c=>c.document.body.textContent).join(' ');
    const nav=book.navigation.toc.map(x=>({label:x.label,href:x.href}));
    if(nav[1])await rendition.display(nav[1].href);
    const secondText=rendition.getContents().map(c=>c.document.body.textContent).join(' ');
    const executed=rendition.getContents().some(c=>c.document.documentElement.getAttribute('data-probe-executed')==='yes');
    result={nav,firstText,secondText,executed,firstContentMs};
   }else{
    result=await workerParse(kind,bytes,opts);
    if(result.sheets){const s=result.sheets[0];tabulate(Array.from({length:Math.min(s.rows,12)},(_,r)=>Array.from({length:Math.min(s.columns,10)},(_,c)=>{const cell=s.cells[String.fromCharCode(65+c)+(r+1)];return cell?.f&&cell.v==null?'[calculated value unavailable]':cell?.w??cell?.v??'';})));}
    else if(result.first)tabulate(result.first);
   }
  }
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  result.firstContentMs??=performance.now()-started;result.elapsedMs=performance.now()-started;result.maxMainThreadLagMs=lag;
  status.textContent=id+' completed';return result;
 }finally{clearInterval(ticker);}
};
window.labReady=true;
