import {printPreview} from './render-print.mjs';
import {element,field,button,decode,parseWorker,imageURL,isolatedHTML} from './render-common.mjs';
function xml(text){if(text.length>2*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('The book contains unsupported XML declarations or oversized metadata.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('The book metadata is malformed.');return doc;}
const nodes=(doc,name)=>[...doc.getElementsByTagNameNS('*',name)];
function resolveEntry(base,href){
 if(!href||/^[a-z][a-z\d+.-]*:|^\/|\\/i.test(href))return null;
 try{const u=new URL(href,'https://book.invalid/'+base);if(u.origin!=='https://book.invalid')return null;return decodeURIComponent(u.pathname.slice(1));}catch{return null;}
}
export async function render(ctx){
 const bytes=await (await ctx.request(ctx.base+'/bytes')).arrayBuffer();let frame,summary;
 if(ctx.metadata.format==='md'){
  const parsed=await parseWorker(ctx,'md',bytes);frame=await isolatedHTML(ctx,parsed.html);summary='Markdown reading view · External resources and links are disabled.';
 }else if(ctx.metadata.format==='docx'){
  const converted=await parseWorker(ctx,'docx',bytes),images=new Map();
  for(const image of converted.images){const url=await imageURL(ctx,image.bytes,image.mime);if(url)images.set('ufv-image:'+image.id,url);}
  frame=await isolatedHTML(ctx,converted.html,images);
  if(converted.warnings){const details=element('details'),heading=element('summary','Word conversion warnings ('+converted.warnings+')'),list=element('ul');for(const warning of converted.warningMessages||[])list.append(element('li',warning));details.append(heading,list);ctx.tools.append(details);}
  summary='Word reading view · Original pagination and complex layout may differ.'+(converted.warnings?' '+converted.warnings+' conversion warning(s).':'');
 }else{
  const parsed=await parseWorker(ctx,'epub',bytes),files=new Map(parsed.files.map(f=>[f.name,f.bytes]));
  const text=name=>{const value=files.get(name);if(!value)throw Error('The book references a missing resource.');return decode(value);};
  if(files.has('META-INF/encryption.xml'))throw Error('Encrypted or DRM-protected EPUB books are not supported.');
  if(text('mimetype').trim()!=='application/epub+zip')throw Error('The file is not an EPUB book.');
  const container=xml(text('META-INF/container.xml')),opfPath=nodes(container,'rootfile')[0]?.getAttribute('full-path');if(!opfPath||!files.has(opfPath))throw Error('The EPUB package is missing.');
  const opf=xml(text(opfPath));if(nodes(opf,'meta').some(n=>n.getAttribute('property')==='rendition:layout'&&n.textContent.trim()==='pre-paginated'))throw Error('Fixed-layout EPUB books are not supported.');
  const manifest=new Map(nodes(opf,'item').map(n=>[n.getAttribute('id'),{path:resolveEntry(opfPath,n.getAttribute('href')),mime:n.getAttribute('media-type'),properties:n.getAttribute('properties')||''}]));
  const spine=nodes(opf,'itemref').map(n=>manifest.get(n.getAttribute('idref'))).filter(n=>n&&n.mime==='application/xhtml+xml');if(!spine.length||spine.length>5000)throw Error('The book has no supported reading order or exceeds 5,000 chapters.');
  const titles=new Map();const nav=[...manifest.values()].find(n=>n.properties.split(/\s+/).includes('nav'));
  if(nav?.path){const d=xml(text(nav.path));for(const a of nodes(d,'a')){const target=resolveEntry(nav.path,a.getAttribute('href'));if(target&&!titles.has(target))titles.set(target,a.textContent.trim());}}
  else{const ncx=[...manifest.values()].find(n=>n.mime==='application/x-dtbncx+xml');if(ncx?.path)for(const p of nodes(xml(text(ncx.path)),'navPoint')){const content=nodes(p,'content')[0],label=nodes(p,'text')[0];if(content&&label)titles.set(resolveEntry(ncx.path,content.getAttribute('src')),label.textContent.trim());}}
  const chapter=field(ctx,'Chapter',element('select',null,{'aria-label':'Chapter'}));spine.forEach((item,i)=>chapter.append(element('option',titles.get(item.path)||'Chapter '+(i+1),{value:i})));
  const font=field(ctx,'Text size',element('select',null,{'aria-label':'Text size'}));for(const size of [14,16,20,24,28])font.append(element('option',size+' px',{value:size}));font.value='16';
  const positionKey='ufv-position:'+ctx.metadata.fileId;let saved;try{saved=JSON.parse(sessionStorage.getItem(positionKey));}catch{}if(typeof saved==='number')saved={chapter:saved};saved=saved||{};
  let current=Math.max(0,Math.min(spine.length-1,Math.trunc(saved.chapter)||0)),urls=[];
  if([14,16,20,24,28].includes(saved.font))font.value=String(saved.font);
  const ratio=()=>{const d=frame?.contentDocument?.documentElement;return d?d.scrollTop/Math.max(1,d.scrollHeight-d.clientHeight):0;};
  function save(){sessionStorage.setItem(positionKey,JSON.stringify({chapter:current,font:Number(font.value),scroll:ratio()}));}
  window.addEventListener('pagehide',save);ctx.cleanup(()=>window.removeEventListener('pagehide',save));
  ctx.cleanup(()=>{for(const url of urls)URL.revokeObjectURL(url);files.clear();});
  async function show(index,scroll=0){
   current=Math.max(0,Math.min(spine.length-1,index));chapter.value=current;for(const url of urls)URL.revokeObjectURL(url);urls=[];
   const item=spine[current],source=text(item.path);if(source.length>2*1024*1024)throw Error('This chapter exceeds the 2 MiB text limit.');
   const doc=xml(source),images=new Map();let id=0;
   for(const img of nodes(doc,'img')){const target=resolveEntry(item.path,img.getAttribute('src')),asset=[...manifest.values()].find(n=>n.path===target);img.removeAttribute('src');if(asset&&files.has(target)&&['image/png','image/jpeg','image/webp'].includes(asset.mime)){const url=URL.createObjectURL(new Blob([files.get(target)],{type:asset.mime}));urls.push(url);const key='ufv-image:'+id++;images.set(key,url);img.setAttribute('src',key);}}
   const body=nodes(doc,'body')[0];if(!body)throw Error('The chapter has no reading content.');
   frame=await isolatedHTML(ctx,new XMLSerializer().serializeToString(body),images,Number(font.value));await Promise.all([...frame.contentDocument.images].map(i=>i.decode().catch(()=>{})));const d=frame.contentDocument.documentElement;d.scrollTop=Math.max(0,Math.min(1,Number(scroll)||0))*(d.scrollHeight-d.clientHeight);frame.contentWindow.addEventListener('scroll',save,{passive:true});save();ctx.status('Chapter '+(current+1)+' of '+spine.length+' · Reading view; book scripts, styles and external resources are disabled.');
  }
  chapter.addEventListener('change',()=>void ctx.run(()=>show(Number(chapter.value))));font.addEventListener('change',()=>void ctx.run(()=>show(current,ratio())));
  button(ctx,'Previous chapter',()=>show(current-1));button(ctx,'Next chapter',()=>show(current+1));await show(current,saved.scroll);summary='Chapter '+(current+1)+' of '+spine.length+' · Read-only EPUB reading view';
 }
 const search=field(ctx,'Find in this view',element('input',null,{type:'search','aria-label':'Find in reading view',maxlength:'200'}));
 let lastNode=null,lastOffset=0;
 const find=button(ctx,'Find next',()=>{const needle=search.value.toLocaleLowerCase();if(!needle||!frame?.contentDocument)return;const doc=frame.contentDocument,walk=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let node;const all=[];while((node=walk.nextNode()))all.push(node);let start=Math.max(0,all.indexOf(lastNode));
  for(let i=0;i<=all.length;i++){const n=all[(start+i)%all.length];if(!n)break;const offset=n===lastNode&&i===0?lastOffset:0,pos=n.textContent.toLocaleLowerCase().indexOf(needle,offset);if(pos>=0){const range=doc.createRange();range.setStart(n,pos);range.setEnd(n,pos+needle.length);const selection=frame.contentWindow.getSelection();selection.removeAllRanges();selection.addRange(range);n.parentElement.scrollIntoView({block:'center'});lastNode=n;lastOffset=pos+needle.length;ctx.status('Matching text selected in the reading view.');return;}}
  lastNode=null;lastOffset=0;ctx.status('No matching text in this reading view.');
 });
 search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();find.click();}});
 return {summary,print:()=>{const body=element('div');for(const node of frame.contentDocument.body.childNodes)body.append(node.cloneNode(true));printPreview(ctx,[body]);},printLabel:ctx.metadata.format==='epub'?'Print current chapter':'Print reading view'};
}
