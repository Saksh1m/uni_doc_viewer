import {element,button} from './render-common.mjs';
export async function render(ctx){
 const bytes=await (await ctx.request(ctx.base+'/bytes')).arrayBuffer();
 const type={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'}[ctx.metadata.format];
 const url=URL.createObjectURL(new Blob([bytes],{type}));ctx.cleanup(()=>URL.revokeObjectURL(url));
 const img=element('img',null,{src:url,alt:ctx.metadata.name,class:'raster-image'});ctx.view.append(img);await img.decode();
 if(ctx.signal.aborted)throw new DOMException('Cancelled','AbortError');
 if(img.naturalWidth*img.naturalHeight>24000000)throw Error('Image exceeds 24 megapixels.');
 let zoom=1;const apply=()=>{img.style.maxWidth='none';img.style.width=Math.round(img.naturalWidth*zoom)+'px';};
 button(ctx,'Fit width',()=>{zoom=Math.min(1,(ctx.view.clientWidth-32)/img.naturalWidth);apply();});
 button(ctx,'Zoom in',()=>{zoom=Math.min(4,zoom*1.25);apply();});button(ctx,'Zoom out',()=>{zoom=Math.max(.1,zoom/1.25);apply();});
 return {summary:img.naturalWidth+' × '+img.naturalHeight+' · Read-only image',print:()=>window.print(),printLabel:'Print image'};
}
