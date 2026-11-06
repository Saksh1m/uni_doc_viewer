importScripts('vendor/xlsx.js','vendor/papa.js');
self.onmessage=event=>{
 const {kind,bytes,delimiter}=event.data;self.postMessage({started:true});
 try{
  if(kind==='xlsx'){
   const wb=XLSX.read(bytes,{type:'array',cellNF:true,cellFormula:true,sheetStubs:true});
   const sheets=wb.SheetNames.map(name=>{
    const ws=wb.Sheets[name],range=XLSX.utils.decode_range(ws['!ref']||'A1');const cells={};
    for(let r=0;r<Math.min(range.e.r+1,14);r++)for(let c=0;c<Math.min(range.e.c+1,10);c++){const addr=XLSX.utils.encode_cell({r,c});if(ws[addr]){const cell={...ws[addr]};if(cell.f&&cell.t==='z'){cell.v=null;delete cell.w;cell.cacheStatus='unavailable';}else if(cell.f){cell.cacheStatus='present-may-be-stale';}cells[addr]=cell;}}
    return {name,rows:range.e.r+1,columns:range.e.c+1,cells,last:ws[XLSX.utils.encode_cell(range.e)]};
   });
   self.postMessage({result:{sheets,date1904:!!wb.Workbook?.WBProps?.date1904}});
  }else{
   let count=0,first=[],last=null,errors=[];
   Papa.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes),{delimiter:delimiter||(kind==='tsv'?'\t':''),dynamicTyping:false,skipEmptyLines:true,step(row){if(first.length<4)first.push(row.data);last=row.data;count++;if(errors.length<10)errors.push(...row.errors);}});
   self.postMessage({result:{count,first,last,errors}});
  }
 }catch(e){self.postMessage({error:e.message});}
};
