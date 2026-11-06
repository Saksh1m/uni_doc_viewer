import {Buffer} from './guard-runtime.mjs';
import {inspectArchive} from './archive-guard.mjs';
import {imageInfo} from './image-guard.mjs';
export const limits={txt:8,md:2,pdf:150,png:24,jpg:24,jpeg:24,webp:24,docx:12,epub:24,csv:24,tsv:24,xlsx:12};
export async function validateFile(file){
 const format=file.name.split('.').pop().toLowerCase(),limit=limits[format];if(!limit)throw Error('This format is not supported.');if(file.size>limit*1024*1024)throw Error('This file exceeds the '+limit+' MiB limit for '+format.toUpperCase()+'.');
 const bytes=await file.arrayBuffer(),b=Buffer.from(bytes),starts=hex=>b.subarray(0,hex.length/2).equals(Buffer.from(hex,'hex'));
 if(format==='pdf'&&!b.subarray(0,1024).toString('ascii').includes('%PDF-'))throw Error('The file does not have a PDF signature.');
 if(['docx','epub','xlsx'].includes(format)){if(!starts('504b0304'))throw Error('The document container is not recognized.');await inspectArchive(b,format);}
 if(['png','jpg','jpeg','webp'].includes(format)){if(format==='png'&&!starts('89504e470d0a1a0a')||['jpg','jpeg'].includes(format)&&!starts('ffd8ff')||format==='webp'&&!(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'))throw Error('The image signature does not match its extension.');imageInfo(b);}
 if(['txt','md','csv','tsv'].includes(format)){try{new TextDecoder(b[0]===255&&b[1]===254?'utf-16le':b[0]===254&&b[1]===255?'utf-16be':'utf-8',{fatal:true}).decode(b);}catch{throw Error('Use UTF-8 text or BOM-marked UTF-16.');}}
 return {format,bytes};
}
