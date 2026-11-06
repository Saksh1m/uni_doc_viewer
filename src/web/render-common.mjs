export function element(tag, text, attributes={}) {
 const node=document.createElement(tag);if(text!=null)node.textContent=text;
 for(const [name,value] of Object.entries(attributes))node.setAttribute(name,value);return node;
}
export function button(ctx,text,action){const b=element('button',text,{type:'button'});b.addEventListener('click',()=>void ctx.run(action));ctx.tools.append(b);return b;}
export function field(ctx,label,node){const wrapper=element('label',label+' ');wrapper.append(node);ctx.tools.append(wrapper);return node;}
export function decode(bytes){const b=new Uint8Array(bytes);return new TextDecoder(b[0]===255&&b[1]===254?'utf-16le':b[0]===254&&b[1]===255?'utf-16be':'utf-8',{fatal:true}).decode(b);}
export async function parseWorker(ctx,kind,bytes,options={}) {
 const worker=new Worker('/parse-worker.js');ctx.cleanup(()=>worker.terminate());
 return new Promise((resolve,reject)=>{
  let done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);ctx.signal.removeEventListener('abort',abort);worker.terminate();error?reject(error):resolve(value);};
  const abort=()=>finish(new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>finish(Error('Parsing exceeded the 30-second limit.')),30000);
  ctx.signal.addEventListener('abort',abort,{once:true});if(ctx.signal.aborted){abort();return;}
  worker.onmessage=e=>finish(e.data.error?Error(e.data.error):null,e.data.result);worker.onerror=()=>finish(Error('The document parser could not complete this file.'));
  worker.postMessage({kind,bytes,...options},[bytes]);
 });
}
export async function imageURL(ctx,bytes,mime){
 if(!['image/png','image/jpeg','image/webp'].includes(mime))return null;
 const url=URL.createObjectURL(new Blob([bytes],{type:mime}));ctx.cleanup(()=>URL.revokeObjectURL(url));return url;
}
export async function isolatedHTML(ctx,html,images=new Map(),fontSize=16) {
 if(html.length>8*1024*1024||(html.match(/</g)||[]).length>100000)throw Error('The reading view exceeds the text or markup limit.');
 if(!globalThis.DOMPurify){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/vendor/purify.js';s.onload=resolve;s.onerror=()=>reject(Error('The installed sanitizer is missing.'));document.head.append(s);});}
 ctx.signal.throwIfAborted();
 const clean=DOMPurify.sanitize(html,{FORBID_TAGS:['style','script','iframe','object','embed','form','input','button','textarea','select','link','base','meta','svg','math','video','audio','source'],FORBID_ATTR:['class','style','srcset','formaction','action','background'],ALLOW_DATA_ATTR:false,ALLOWED_URI_REGEXP:/^ufv-image:/});
 const template=document.createElement('template');template.innerHTML=clean;
 for(const node of template.content.querySelectorAll('[src]')){const url=images.get(node.getAttribute('src'));if(node.tagName==='IMG'&&url)node.setAttribute('src',url);else node.removeAttribute('src');}
 for(const node of template.content.querySelectorAll('[href]'))node.removeAttribute('href');
 for(const node of template.content.querySelectorAll('[id],[name]')){node.removeAttribute('id');node.removeAttribute('name');}
 const frame=element('iframe',null,{title:'Document reading view',sandbox:'allow-same-origin',class:'document-frame'});
 const loaded=new Promise((resolve,reject)=>{
  const abort=()=>{frame.removeEventListener('load',done);reject(new DOMException('Cancelled','AbortError'));};
  const done=()=>{ctx.signal.removeEventListener('abort',abort);resolve();};
  frame.addEventListener('load',done,{once:true});ctx.signal.addEventListener('abort',abort,{once:true});if(ctx.signal.aborted)abort();
 });
 frame.srcdoc='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; script-src &apos;none&apos;; img-src blob:; style-src &apos;unsafe-inline&apos;; base-uri &apos;none&apos;; form-action &apos;none&apos;"><style>body{font:'+fontSize+'px/1.65 system-ui;margin:24px;color:#172b22;background:white;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px}pre{white-space:pre-wrap}a{color:inherit}</style></head><body>'+template.innerHTML+'</body></html>';
 ctx.view.replaceChildren(frame);await loaded;return frame;
}
