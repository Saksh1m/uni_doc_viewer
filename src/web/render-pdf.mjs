import {printPreview,encodeCanvas} from './render-print.mjs';
import {element,field,button} from './render-common.mjs';
export async function render(ctx){
 const pdfjs=await import('/vendor/pdf/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf/pdf.worker.mjs';
 const source=ctx.pdfData?{data:await ctx.pdfData()}:{url:location.origin+ctx.base+'/bytes',httpHeaders:ctx.headers()};
 ctx.signal.throwIfAborted();
 const loading=pdfjs.getDocument({...source,withCredentials:false,disableStream:true,disableAutoFetch:true,rangeChunkSize:65536,isEvalSupported:false,enableXfa:false,maxImageSize:24000000,canvasMaxAreaInBytes:64000000,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/',iccUrl:'/vendor/iccs/'});
 ctx.cleanup(()=>loading.destroy());
 loading.onPassword=(update,reason)=>{ctx.pauseDeadline();
  const form=element('form'),label=element('label',reason===2?'Incorrect password. Try again: ':'PDF password: '),input=element('input',null,{type:'password',autocomplete:'off','aria-label':'PDF password'}),submit=element('button','Unlock',{type:'submit'});
  ctx.cleanup(()=>form.remove());label.append(input);form.append(label,submit);ctx.view.replaceChildren(form);input.focus();
  form.addEventListener('submit',e=>{e.preventDefault();const value=input.value;input.value='';form.remove();ctx.resumeDeadline();update(value);});ctx.status('This PDF is password protected. Enter its password or cancel.');
 };
 const pdf=await loading.promise;if(pdf.numPages>5000)throw Error('This PDF exceeds the 5,000-page limit.');
 let number=1,scale=1,task,textLayer,lastPage;
 ctx.cleanup(()=>{task?.cancel();textLayer?.cancel();});
 const pageField=field(ctx,'Page',element('input',null,{type:'number',min:'1',max:pdf.numPages,value:'1','aria-label':'Page number'}));ctx.tools.append(element('span','of '+pdf.numPages));
 async function show(n){
  number=Math.max(1,Math.min(pdf.numPages,Math.trunc(Number(n))||1));pageField.value=number;task?.cancel();textLayer?.cancel();lastPage?.cleanup();
  const page=await pdf.getPage(number);lastPage=page;let viewport=page.getViewport({scale});
  const pixels=viewport.width*viewport.height;if(pixels>16000000){scale*=Math.sqrt(16000000/pixels);viewport=page.getViewport({scale});}
  const container=element('div',null,{class:'pdf-page'}),canvas=element('canvas',null,{'aria-label':'PDF page '+number}),layer=element('div',null,{class:'textLayer'});
  container.style.width=viewport.width+'px';container.style.height=viewport.height+'px';container.style.setProperty('--total-scale-factor',scale);container.style.setProperty('--scale-factor',scale);container.style.setProperty('--scale-round-x','1px');container.style.setProperty('--scale-round-y','1px');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);container.append(canvas,layer);ctx.view.replaceChildren(container);
  task=page.render({canvasContext:canvas.getContext('2d'),viewport,annotationMode:pdfjs.AnnotationMode.DISABLE});await task.promise;
  textLayer=new pdfjs.TextLayer({textContentSource:page.streamTextContent(),container:layer,viewport});await textLayer.render();
  ctx.status('Page '+number+' of '+pdf.numPages+' · Read-only PDF');
 }
 pageField.addEventListener('change',()=>void ctx.run(()=>show(pageField.value)));
 button(ctx,'Previous page',()=>show(number-1));button(ctx,'Next page',()=>show(number+1));
 button(ctx,'Zoom in',()=>{scale=Math.min(4,scale*1.25);return show(number);});button(ctx,'Zoom out',()=>{scale=Math.max(.2,scale/1.25);return show(number);});
 button(ctx,'Fit width',async()=>{const page=await pdf.getPage(number);scale=(ctx.view.clientWidth-32)/page.getViewport({scale:1}).width;return show(number);});
 const search=field(ctx,'Find',element('input',null,{type:'search','aria-label':'Find in PDF',maxlength:'200'}));
 let lastSearch='',lastFound=0;
 const find=button(ctx,'Find next',async()=>{const needle=search.value.trim().toLocaleLowerCase();if(!needle)return;let textBytes=0;const offset=lastSearch===needle&&lastFound===number?1:0;
  for(let i=0;i<pdf.numPages;i++){if(ctx.signal.aborted)throw new DOMException('Cancelled','AbortError');const n=((number-1+i+offset)%pdf.numPages)+1,page=await pdf.getPage(n),content=await page.getTextContent(),text=content.items.map(x=>x.str||'').join(' ');textBytes+=text.length;if(textBytes>8*1024*1024)throw Error('PDF search exceeded the 8 MiB text budget. Search a smaller document.');if(text.toLocaleLowerCase().includes(needle)){await show(n);lastSearch=needle;lastFound=n;highlight(needle);ctx.status('Found “'+search.value+'” on page '+n+'.');return;}page.cleanup();}
  ctx.status('No matching text found. Scanned pages have no searchable text unless they contain an OCR text layer.');
 });
 search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();find.click();}});
 function highlight(needle){
  const spans=[...ctx.view.querySelectorAll('.textLayer span')],text=spans.map(s=>s.textContent).join(' ').toLocaleLowerCase();let start=0;
  for(const span of spans){const end=start+span.textContent.length;let at=text.indexOf(needle);while(at>=0){if(at<end&&at+needle.length>start){span.classList.add('search-hit');break;}at=text.indexOf(needle,at+needle.length);}start=end+1;}
  ctx.view.querySelector('.search-hit')?.scrollIntoView({block:'center'});
 }
 const first=field(ctx,'Print from',element('input',null,{type:'number',min:1,max:pdf.numPages,value:1,'aria-label':'Print from page'}));
 const last=field(ctx,'Print through',element('input',null,{type:'number',min:1,max:pdf.numPages,value:pdf.numPages,'aria-label':'Print through page'}));
 async function preparePrint(){
  const a=Number(first.value),b=Number(last.value);
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<1||b>pdf.numPages||b<a||b-a+1>200)throw Error('Choose an ordered range of at most 200 pages within this PDF.');
  let pixels=0;
  for(let n=a;n<=b;n++){ctx.signal.throwIfAborted();const page=await pdf.getPage(n),v=page.getViewport({scale:1.5});pixels+=Math.ceil(v.width)*Math.ceil(v.height);if(pixels>64000000)throw Error('This range exceeds the 64-million-pixel print budget. Choose fewer pages.');}
  const nodes=[],urls=[];let bytes=0;
  try{for(let n=a;n<=b;n++){ctx.signal.throwIfAborted();ctx.status('Preparing print page '+n+' of '+b);const page=await pdf.getPage(n),viewport=page.getViewport({scale:1.5}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   const rendering=page.render({canvasContext:canvas.getContext('2d'),viewport,annotationMode:pdfjs.AnnotationMode.DISABLE});const abort=()=>rendering.cancel();ctx.signal.addEventListener('abort',abort,{once:true});
   try{await rendering.promise;const blob=await encodeCanvas(canvas,ctx.signal);ctx.signal.throwIfAborted();if(!blob)throw Error('Could not encode print page.');bytes+=blob.size;if(bytes>32*1024*1024)throw Error('This range exceeds the 32 MiB print image budget. Choose fewer pages.');const url=URL.createObjectURL(blob);urls.push(url);const img=element('img',null,{src:url,alt:'PDF page '+n,class:'print-page'});await img.decode();nodes.push(img);}finally{ctx.signal.removeEventListener('abort',abort);canvas.width=canvas.height=0;if(page!==lastPage)page.cleanup();}
  }ctx.signal.throwIfAborted();printPreview(ctx,nodes,()=>urls.forEach(url=>URL.revokeObjectURL(url)));}catch(error){urls.forEach(url=>URL.revokeObjectURL(url));throw error;}
 }
 await show(1);
 return {summary:'Page 1 of '+pdf.numPages+' · Read-only PDF',print:preparePrint,printLabel:'Prepare print range'};
}
