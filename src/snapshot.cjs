'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {checkArchive}=require('./archive-check.cjs');
const {imageInfo}=require('./image-info.cjs');
const MiB=1024*1024;
const LIMITS=Object.freeze({txt:8*MiB,md:2*MiB,pdf:150*MiB,docx:12*MiB,xlsx:12*MiB,epub:24*MiB,csv:24*MiB,tsv:24*MiB,png:24*MiB,jpg:24*MiB,jpeg:24*MiB,webp:24*MiB});
class ViewerError extends Error {}
function decodeText(bytes){
 let encoding='utf-8';if(bytes[0]===255&&bytes[1]===254)encoding='utf-16le';if(bytes[0]===254&&bytes[1]===255)encoding='utf-16be';
 try{return new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{throw new ViewerError('This text file has an unsupported or invalid encoding. Use UTF-8 or BOM-marked UTF-16.');}
}
function validateSignature(bytes,format){
 const starts=hex=>bytes.subarray(0,hex.length/2).equals(Buffer.from(hex,'hex'));
 if(format==='pdf'&&!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw new ViewerError('The file does not have a PDF signature.');
 if(['docx','xlsx','epub'].includes(format)&&!starts('504b0304'))throw new ViewerError('The document container is not recognized.');
 if(format==='png'&&!starts('89504e470d0a1a0a'))throw new ViewerError('The image signature is not recognized.');
 if(['jpg','jpeg'].includes(format)&&!starts('ffd8ff'))throw new ViewerError('The image signature is not recognized.');
 if(format==='webp'&&!(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'))throw new ViewerError('The image signature is not recognized.');
 if(format==='txt')decodeText(bytes);
}
async function snapshot(filePath,reserve){
 if(typeof filePath!=='string'||filePath.includes('\0'))throw new ViewerError('Choose a regular local file.');
 const full=path.resolve(filePath),format=path.extname(full).slice(1).toLowerCase(),limit=LIMITS[format];
 if(!limit)throw new ViewerError('This file format is not supported.');
 if(process.platform==='win32'&&(full.startsWith('\\\\')||full.slice(2).includes(':')))throw new ViewerError('Choose a regular file on a local drive. Network/device paths and alternate streams are not supported.');
 let handle,bytes;
 try{
  // Reject a final symlink rather than following a mutable file alias.
  if(!(await fs.lstat(full)).isFile())throw new ViewerError('Choose a regular file, not a folder, device or symbolic link.');
  const resolved=await fs.realpath(full);
  if(process.platform==='win32'&&(resolved.startsWith('\\\\')||resolved.slice(2).includes(':')))throw new ViewerError('Choose a regular file on a local drive.');
  handle=await fs.open(resolved,'r');const before=await handle.stat({bigint:true});
  if(!before.isFile())throw new ViewerError('Choose a regular file.');
  if(before.size>BigInt(limit))throw new ViewerError('The file exceeds the size limit for this format.');
  const size=Number(before.size);reserve(size);bytes=Buffer.alloc(size);
  let used=0;while(used<size){const part=await handle.read(bytes,used,Math.min(size-used,MiB),used);if(!part.bytesRead)break;used+=part.bytesRead;}
  const after=await handle.stat({bigint:true});
  if(used!==size||['size','mtimeNs','ctimeNs','ino','dev'].some(k=>before[k]!==after[k]))throw new ViewerError('The file changed while opening. Please reopen it.');
  validateSignature(bytes,format);
  try{
   if(['docx','xlsx','epub'].includes(format))await checkArchive(bytes,format);
   if(['png','jpg','jpeg','webp'].includes(format))imageInfo(bytes);
   if(['md','csv','tsv'].includes(format))decodeText(bytes);
  }catch(error){throw new ViewerError(error.message);}
  return {bytes,name:path.basename(full),format};
 }catch(e){bytes?.fill(0);if(e instanceof ViewerError)throw e;throw new ViewerError(e.code==='ENOENT'?'The file could not be found. Select it again.':'The file could not be read. Check its location and permissions.');}
 finally{await handle?.close();}
}
module.exports={snapshot,decodeText,ViewerError,LIMITS};
