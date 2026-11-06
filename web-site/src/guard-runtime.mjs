// Small byte-view adapter used by the existing audited header/ZIP checks.
export class Buffer extends Uint8Array {
 static from(value,encoding){return encoding==='hex'?new Buffer(value.match(/../g).map(x=>parseInt(x,16))):new Buffer(value);}
 readUInt32LE(p){return new DataView(this.buffer,this.byteOffset,this.byteLength).getUint32(p,true);}
 readUInt32BE(p){return new DataView(this.buffer,this.byteOffset,this.byteLength).getUint32(p,false);}
 readUInt16LE(p){return new DataView(this.buffer,this.byteOffset,this.byteLength).getUint16(p,true);}
 readUInt16BE(p){return new DataView(this.buffer,this.byteOffset,this.byteLength).getUint16(p,false);}
 readUIntLE(p,n){let v=0;for(let i=0;i<n;i++)v+=this[p+i]*2**(8*i);return v;}
 equals(other){return this.length===other.length&&this.every((v,i)=>v===other[i]);}
 toString(encoding='utf8',start=0,end=this.length){const bytes=this.subarray(start,end);if(encoding==='utf8')return new TextDecoder().decode(bytes);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return s;}
}
const table=new Uint32Array(256);for(let i=0;i<256;i++){let n=i;for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;table[i]=n;}
export function crc32(bytes){let crc=0xffffffff;for(const value of bytes)crc=table[(crc^value)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export async function inflateRawSync(input,{maxOutputLength}){
 let reader;try{reader=new Blob([input]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();}catch{throw Error('This browser cannot safely read compressed documents. Use a recent Chrome or Edge.');}
 const chunks=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxOutputLength){await reader.cancel();const error=Error('Expanded byte limit exceeded');error.code='ERR_BUFFER_TOO_LARGE';throw error;}chunks.push(value);}
  const result=new Buffer(total);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;
 }finally{reader.releaseLock();}
}
