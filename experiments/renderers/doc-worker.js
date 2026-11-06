importScripts('vendor/mammoth.js');
self.onmessage=async event=>{
 self.postMessage({started:true});
 try{
  const images=[];
  const result=await mammoth.convertToHtml({arrayBuffer:event.data.bytes},{externalFileAccess:false,
   convertImage:mammoth.images.imgElement(async image=>{const id=images.length;const slot={id,mime:image.contentType,bytes:null};images.push(slot);const value=await image.readAsArrayBuffer();slot.bytes=value instanceof ArrayBuffer?value:Uint8Array.from(value).buffer;return {src:'ufv-image:'+id};})});
  result.images=images;self.postMessage({result},images.map(i=>i.bytes));
 }
 catch(e){self.postMessage({error:e.message});}
};
