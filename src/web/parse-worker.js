'use strict';
const decode=bytes=>{const b=new Uint8Array(bytes);return new TextDecoder(b[0]===255&&b[1]===254?'utf-16le':b[0]===254&&b[1]===255?'utf-16be':'utf-8',{fatal:true}).decode(b);};
self.onmessage=async({data})=>{
 try{
  const {kind,bytes}=data;let result;
  if(kind==='md'){
   const {marked}=await import('/vendor/marked.mjs');const html=marked.parse(decode(bytes));if(html.length>8*1024*1024)throw Error('The reading view exceeds the 8 MiB text limit.');result={html};
  }else if(kind==='docx'){
   importScripts('/vendor/mammoth.js');const images=[];
   const converted=await mammoth.convertToHtml({arrayBuffer:bytes},{externalFileAccess:false,convertImage:mammoth.images.imgElement(async image=>{
    if(!['image/png','image/jpeg','image/webp'].includes(image.contentType))return {src:''};
    const id=images.length,item={id,mime:image.contentType};images.push(item);const value=await image.readAsArrayBuffer();item.bytes=value instanceof ArrayBuffer?value:Uint8Array.from(value).buffer;return {src:'ufv-image:'+id};
   })});if(converted.value.length>8*1024*1024)throw Error('The reading view exceeds the 8 MiB text limit.');
   result={html:converted.value,images,warnings:converted.messages.length,warningMessages:converted.messages.slice(0,20).map(m=>String(m.message).slice(0,500))};self.postMessage({result},images.map(i=>i.bytes));return;
  }else if(kind==='epub'){
   importScripts('/vendor/jszip.js');const zip=await JSZip.loadAsync(bytes),files=[];let total=0;
   for(const entry of Object.values(zip.files)){if(entry.dir)continue;const content=await entry.async('arraybuffer');total+=content.byteLength;if(total>256*1024*1024)throw Error('The book exceeds the expanded-byte limit.');files.push({name:entry.name,bytes:content});}
   self.postMessage({result:{files}},files.map(f=>f.bytes));return;
  }else if(kind==='xlsx'){
   importScripts('/vendor/xlsx.js');const book=XLSX.read(bytes,{type:'array',cellNF:true,cellFormula:true,sheetStubs:true,cellHTML:false,bookVBA:false});
   let total=0;const sheets=[];
   for(const name of book.SheetNames){const sheet=book.Sheets[name],cells={},range=XLSX.utils.decode_range(sheet['!ref']||'A1');
    if(range.e.r>=100000||range.e.c>=1024)throw Error('The sheet exceeds 100,000 rows or 1,024 columns.');
    for(const address of Object.keys(sheet)){if(address.startsWith('!'))continue;if(++total>100000)throw Error('The workbook exceeds 100,000 populated cells.');const c=sheet[address];cells[address]=c.f&&c.t==='z'?'[calculated value unavailable]':String(c.w??c.v??'');}
    sheets.push({name,rows:range.e.r+1,columns:range.e.c+1,cells});
   }result={sheets,notice:'Saved values only. Formula caches may be stale; formulas are not recalculated.'};
  }else if(kind==='csv'||kind==='tsv'){
   importScripts('/vendor/papa.js');const rows=[];let columns=0,errorCount=0,cells=0,usedDelimiter='';
   Papa.parse(decode(bytes),{delimiter:data.delimiter||(kind==='tsv'?'\t':''),dynamicTyping:false,skipEmptyLines:true,step(row,parser){
    if(rows.length>=100001||row.data.length>1024||(cells+=row.data.length)>1100000){parser.abort();throw Error('The table exceeds 100,000 data rows, 1,024 columns or 1.1 million cells.');}
    usedDelimiter=row.meta.delimiter;errorCount+=row.errors.length;columns=Math.max(columns,row.data.length);rows.push(row.data);
   }});result={sheets:[{name:'Data',rows:rows.length,columns,data:rows}],notice:'Delimiter: '+(usedDelimiter==='\t'?'tab':usedDelimiter||'not detected')+'. Values are literal text.'+(errorCount?' '+errorCount+' parsing issue(s); check the delimiter and source file.':'')};
  }else throw Error('Unsupported parser.');
  self.postMessage({result});
 }catch(error){self.postMessage({error:error.message||'The file could not be parsed.'});}
};
