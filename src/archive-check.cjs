'use strict';
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {inflateRawSync,crc32}=require('node:zlib');
const {imageInfo}=require('./image-info.cjs');
const TOTAL=256*1024*1024,ENTRY=32*1024*1024;
function checkExtra(bytes,rawName){
 for(let p=0;p<bytes.length;){
  if(p+4>bytes.length)throw Error('Invalid document archive extra fields.');
  const type=bytes.readUInt16LE(p),size=bytes.readUInt16LE(p+2);p+=4;
  if(p+size>bytes.length)throw Error('Invalid document archive extra fields.');
  if(type===1)throw Error('ZIP64 documents are not supported.');
  if(type===0x7075){const value=bytes.subarray(p,p+size);if(size<5||value[0]!==1||value.readUInt32LE(1)!==crc32(rawName)||!value.subarray(5).equals(rawName))throw Error('Alternate document archive paths are not supported.');}
  p+=size;
 }
}
function inspectArchive(b,format){
 let end=-1;for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--)if(b.readUInt32LE(p)===0x06054b50&&p+22+b.readUInt16LE(p+20)===b.length){end=p;break;}
 if(end<0)throw Error('The document archive is incomplete.');
 const count=b.readUInt16LE(end+10),start=b.readUInt32LE(end+16),directorySize=b.readUInt32LE(end+12);
 if(b.readUInt16LE(end+4)||b.readUInt16LE(end+6)||count!==b.readUInt16LE(end+8)||count===65535||start===0xffffffff||directorySize===0xffffffff)throw Error('Multipart and ZIP64 documents are not supported.');
 if(count>10000||start+directorySize!==end)throw Error('The document archive exceeds limits or has invalid bounds.');
 let p=start,total=0,pixels=0;const names=new Set(),intervals=[];
 for(let i=0;i<count;i++){
  if(p+46>end||b.readUInt32LE(p)!==0x02014b50)throw Error('Invalid document archive directory.');
  const flags=b.readUInt16LE(p+8),method=b.readUInt16LE(p+10),compressed=b.readUInt32LE(p+20),expanded=b.readUInt32LE(p+24),n=b.readUInt16LE(p+28),extra=b.readUInt16LE(p+30),comment=b.readUInt16LE(p+32),offset=b.readUInt32LE(p+42);
  if(p+46+n+extra+comment>end||offset+30>start)throw Error('Invalid document archive bounds.');
  const rawName=b.subarray(p+46,p+46+n),name=new TextDecoder('utf-8',{fatal:true}).decode(rawName);
  if(!name||/[\\:\x00-\x1f]/.test(name)||name.startsWith('/')||name.split('/').some(s=>s==='..'||s==='.')||names.has(name))throw Error('Unsafe or duplicate document archive path.');
  checkExtra(b.subarray(p+46+n,p+46+n+extra),rawName);
  names.add(name);if(b.readUInt16LE(p+34)!==0)throw Error('Multipart document entries are not supported.');if(flags&~0x080e||![0,8].includes(method)||(method===0&&(flags&6)))throw Error('Encrypted or unsupported document archive.');
  if(expanded>ENTRY||total+expanded>TOTAL)throw Error('The document exceeds the expanded-byte limit.');
  if(b.readUInt32LE(offset)!==0x04034b50||b.readUInt16LE(offset+6)!==flags||b.readUInt16LE(offset+8)!==method)throw Error('Inconsistent document archive headers.');
  const ln=b.readUInt16LE(offset+26),le=b.readUInt16LE(offset+28),data=offset+30+ln+le;
  if(data+compressed>start||!rawName.equals(b.subarray(offset+30,offset+30+ln)))throw Error('Inconsistent document archive names or bounds.');
  checkExtra(b.subarray(offset+30+ln,data),rawName);
  const checksum=b.readUInt32LE(p+16);let entryEnd=data+compressed;
  if(flags&8){
   // Streaming ZIP entries place CRC and sizes after the compressed bytes.
   let descriptor=entryEnd;
   if(descriptor+4<=start&&b.readUInt32LE(descriptor)===0x08074b50)descriptor+=4;
   if(descriptor+12>start||b.readUInt32LE(descriptor)!==checksum||b.readUInt32LE(descriptor+4)!==compressed||b.readUInt32LE(descriptor+8)!==expanded)throw Error('Inconsistent document archive data descriptor.');
   entryEnd=descriptor+12;
   for(const [field,value] of [[14,checksum],[18,compressed],[22,expanded]]){const local=b.readUInt32LE(offset+field);if(local!==0&&local!==value)throw Error('Inconsistent document archive local sizes or checksum.');}
  }else if(b.readUInt32LE(offset+14)!==checksum||b.readUInt32LE(offset+18)!==compressed||b.readUInt32LE(offset+22)!==expanded)throw Error('Inconsistent document archive local sizes or checksum.');
  intervals.push([offset,entryEnd]);
  const input=b.subarray(data,data+compressed);let output;
  try{output=method===0?input:inflateRawSync(input,{maxOutputLength:Math.min(ENTRY,TOTAL-total)+1});}catch(error){throw Error(error.code==='ERR_BUFFER_TOO_LARGE'?'The document exceeds the actual expanded-byte limit.':'A compressed document entry is corrupt or exceeds the expanded-byte limit.');}
  total+=output.length;if(output.length!==expanded||output.length>ENTRY||total>TOTAL)throw Error('The document exceeds the actual expanded-byte limit or contains a size mismatch.');
  if(crc32(output)!==checksum)throw Error('A document archive entry failed its checksum. The file may be corrupt.');
  // Match UTF-8 and UTF-16/32 declaration spellings before Office/EPUB parsers see XML.
  const prefix=output.toString('latin1',0,128).replace(/\0/g,'').replace(/^(?:\xef\xbb\xbf|\xff\xfe|\xfe\xff)/,'').trimStart();
  if((/\.(xml|rels|xhtml)$/i.test(name)||prefix.startsWith('<'))&&/<!DOCTYPE|<!ENTITY/i.test(output.toString('latin1').replace(/\0/g,'')))throw Error('Document XML declarations (DOCTYPE or ENTITY) are not supported.');
  const raster=output[0]===0xff&&output[1]===0xd8||output.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))||output.toString('ascii',0,4)==='RIFF'&&output.toString('ascii',8,12)==='WEBP';
  if(raster||/\.(png|jpe?g|webp)$/i.test(name)){pixels+=imageInfo(output).pixels;if(pixels>80000000)throw Error('Embedded images exceed the 80-megapixel document limit.');}
  p+=46+n+extra+comment;
 }
 intervals.sort((a,b)=>a[0]-b[0]);for(let i=1;i<intervals.length;i++)if(intervals[i][0]<intervals[i-1][1])throw Error('Overlapping document archive entries.');
 if(p!==end)throw Error('Invalid document archive directory length.');
 if(format==='docx'&&(!names.has('[Content_Types].xml')||!names.has('word/document.xml')))throw Error('This is not a supported Word document.');
 if(format==='xlsx'&&(!names.has('[Content_Types].xml')||!names.has('xl/workbook.xml')))throw Error('This is not a supported Excel workbook.');
 if(format==='epub'&&!names.has('META-INF/container.xml'))throw Error('This is not a supported EPUB book.');
 return {entries:count,expandedBytes:total};
}
// Serialize decompression across registrations; one worker at a time, including
// cleanup after timeout. This guard does not execute document-provided code.
let queue=Promise.resolve();
function checkArchive(bytes,format){
 const job=queue.then(()=>new Promise((resolve,reject)=>{
  const worker=new Worker(__filename,{workerData:{bytes,format},resourceLimits:{maxOldGenerationSizeMb:128}});let finished=false;
  const finish=async(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);await worker.terminate();error?reject(error):resolve(value);};
  const timer=setTimeout(()=>void finish(Error('Document validation timed out after 30 seconds.')),30000);
  worker.once('message',r=>void finish(r.error?Error(r.error):null,r.result));worker.once('error',e=>void finish(e));worker.once('exit',()=>{if(!finished)void finish(Error('Document validation stopped unexpectedly.'));});
 }));queue=job.catch(()=>{});return job;
}
if(!isMainThread){try{parentPort.postMessage({result:inspectArchive(Buffer.from(workerData.bytes),workerData.format)});}catch(error){parentPort.postMessage({error:error.message});}}
module.exports={checkArchive,inspectArchive};
