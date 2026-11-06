'use strict';
// Inspect raster dimensions before allowing browser/native decompression.
function imageInfo(b) {
 let width, height;
 if(b.length>=24&&b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))){width=b.readUInt32BE(16);height=b.readUInt32BE(20);for(let p=8;p+12<=b.length;){const size=b.readUInt32BE(p);if(b.toString('ascii',p+4,p+8)==='acTL')throw Error('Animated images are not supported.');if(p+12+size>b.length)throw Error('The PNG image is incomplete.');p+=12+size;}}
 else if(b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
  for(let p=12;p+8<=b.length;){const type=b.toString('ascii',p,p+4),size=b.readUInt32LE(p+4),d=p+8;if(d+size>b.length)break;
   if(type==='VP8X'&&size>=10){if(b[d]&2)throw Error('Animated images are not supported.');width=1+b.readUIntLE(d+4,3);height=1+b.readUIntLE(d+7,3);break;}
   if(type==='VP8 '&&size>=10&&b[d+3]===0x9d&&b[d+4]===1&&b[d+5]===0x2a){width=b.readUInt16LE(d+6)&0x3fff;height=b.readUInt16LE(d+8)&0x3fff;break;}
   if(type==='VP8L'&&size>=5&&b[d]===0x2f){const bits=b.readUInt32LE(d+1);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;break;}p=d+size+(size%2);
  }
 }else if(b[0]===255&&b[1]===216){
  for(let p=2;p+4<=b.length;){if(b[p++]!==255)break;while(b[p]===255)p++;const marker=b[p++];if(marker===0xda||marker===0xd9)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;const len=b.readUInt16BE(p);if(len<2||p+len>b.length)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&len>=7){height=b.readUInt16BE(p+3);width=b.readUInt16BE(p+5);break;}p+=len;
  }
 }
 if(!width||!height)throw Error('The image dimensions could not be read. Use a valid PNG, JPEG or WebP image.');
 if(width*height>24000000||width>32768||height>32768)throw Error('The image exceeds the 24-megapixel or 32768-pixel dimension limit.');
 return {width,height,pixels:width*height};
}
module.exports={imageInfo};
