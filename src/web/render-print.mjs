import {element} from './render-common.mjs';
// Only sanitized reading-view nodes or renderer-owned images enter this surface.
export function printPreview(ctx,nodes,release=()=>{}) {
 document.getElementById('print-preview')?.dispatchEvent(new Event('dismiss'));
 const panel=element('section',null,{id:'print-preview','aria-label':'Print preview'}),controls=element('div',null,{class:'print-controls'}),root=element('div',null,{id:'print-root'});
 const print=element('button','Print prepared content',{type:'button'}),back=element('button','Back to reading',{type:'button'});
 controls.append(element('p','Prepared reading view. Choose paper size and margins in your browser’s print dialog.'),print,back);root.append(...nodes);panel.append(controls,root);document.body.append(panel);document.body.classList.add('print-preview-open');
 const previous=document.activeElement;let closed=false;
 function close(){if(closed)return;closed=true;panel.remove();root.replaceChildren();panel.replaceChildren();document.body.classList.remove('print-preview-open');release();previous?.focus();}
 print.onclick=()=>window.print();back.onclick=close;panel.addEventListener('dismiss',close);panel.addEventListener('keydown',e=>{if(e.key==='Escape')close();});ctx.cleanup(close);back.focus();ctx.status('Print preview ready. Return to reading when finished.');
}

// Canvas encoding has no native cancel API. Stop waiting immediately on abort;
// a later browser callback is ignored and cannot attach a stale preview.
export function encodeCanvas(canvas,signal){
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error,blob)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);error?reject(error):resolve(blob);};
  const abort=()=>finish(signal.reason||new DOMException('Cancelled','AbortError'));
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
  try{canvas.toBlob(blob=>finish(null,blob),'image/png');}catch(error){finish(error);}
 });
}
