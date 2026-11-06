import {element,field,button,parseWorker} from './render-common.mjs';
function columnName(n){let text='';do{text=String.fromCharCode(65+n%26)+text;n=Math.floor(n/26)-1;}while(n>=0);return text;}
export async function render(ctx){
 let parsed,sheetIndex=0,rowStart=0,columnStart=0,delimiter='';
 const select=field(ctx,'Sheet',element('select',null,{'aria-label':'Sheet'}));
 const rowInput=field(ctx,'First row',element('input',null,{type:'number',min:'1',value:'1','aria-label':'First row'}));
 const colInput=field(ctx,'First column',element('input',null,{type:'number',min:'1',value:'1','aria-label':'First column'}));
 const viewport=element('div',null,{class:'table-scroll',tabindex:'0','aria-label':'Table rows'});ctx.view.append(viewport);
 const get=(sheet,r,c)=>sheet.data?sheet.data[r]?.[c]??'':sheet.cells[columnName(c)+(r+1)]??'';
 function draw(){const sheet=parsed.sheets[sheetIndex];if(!sheet){viewport.textContent='No worksheets found.';return;}
  rowStart=Math.max(0,Math.min(Math.trunc(rowStart)||0,Math.max(0,sheet.rows-1)));columnStart=Math.max(0,Math.min(Math.trunc(columnStart)||0,Math.max(0,sheet.columns-1)));rowInput.value=rowStart+1;colInput.value=columnStart+1;
  const table=element('table'),head=element('tr');table.append(element('caption',sheet.name+' — visible rows'));head.append(element('th','Row',{scope:'col'}));for(let c=columnStart;c<Math.min(columnStart+20,sheet.columns);c++)head.append(element('th',columnName(c),{scope:'col'}));table.append(head);
  for(let r=rowStart;r<Math.min(rowStart+100,sheet.rows);r++){const tr=element('tr');tr.append(element('th',String(r+1),{scope:'row'}));for(let c=columnStart;c<Math.min(columnStart+20,sheet.columns);c++)tr.append(element('td',get(sheet,r,c)));table.append(tr);}
  viewport.replaceChildren(table);ctx.status(parsed.notice+' Showing rows '+(sheet.rows?rowStart+1:0)+'–'+Math.min(rowStart+100,sheet.rows)+' of '+sheet.rows+'; columns '+(columnStart+1)+'–'+Math.min(columnStart+20,sheet.columns)+' of '+sheet.columns+'.');
 }
 async function parse(){const bytes=await (await ctx.request(ctx.base+'/bytes')).arrayBuffer();parsed=await parseWorker(ctx,ctx.metadata.format,bytes,{delimiter});select.replaceChildren(...parsed.sheets.map((s,i)=>element('option',s.name,{value:i})));sheetIndex=0;rowStart=0;columnStart=0;draw();}
 select.addEventListener('change',()=>void ctx.run(()=>{sheetIndex=Number(select.value);rowStart=columnStart=0;draw();}));
 rowInput.addEventListener('change',()=>void ctx.run(()=>{rowStart=Number(rowInput.value)-1;draw();}));colInput.addEventListener('change',()=>void ctx.run(()=>{columnStart=Number(colInput.value)-1;draw();}));
 button(ctx,'Previous rows',()=>{rowStart-=100;draw();});button(ctx,'Next rows',()=>{rowStart+=100;draw();});
 if(ctx.metadata.format==='csv'){const d=field(ctx,'Delimiter',element('select',null,{'aria-label':'Delimiter'}));for(const [value,label]of [['','Detect'],[',','Comma'],[';','Semicolon'],['\t','Tab'],['|','Pipe']])d.append(element('option',label,{value}));d.addEventListener('change',()=>void ctx.run(()=>{delimiter=d.value;return parse();}));}
 const search=field(ctx,'Find',element('input',null,{type:'search','aria-label':'Find in sheet',maxlength:'200'}));
 const find=button(ctx,'Find next',async()=>{const needle=search.value.toLocaleLowerCase();if(!needle)return;const sheet=parsed.sheets[sheetIndex];
  // Visit populated cells only for sparse workbooks; bounded CSV cells are dense.
  if(sheet.cells){const addresses=Object.keys(sheet.cells),start=addresses.findIndex(a=>/\d+$/.exec(a)[0]>rowStart+1);for(let i=0;i<addresses.length;i++){const a=addresses[(Math.max(0,start)+i)%addresses.length];if(String(sheet.cells[a]).toLocaleLowerCase().includes(needle)){const m=/^([A-Z]+)(\d+)$/.exec(a);rowStart=Number(m[2])-1;columnStart=[...m[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;draw();return;}}}
  else for(let i=1;i<=sheet.rows;i++){const r=(rowStart+i)%sheet.rows;for(let c=0;c<sheet.columns;c++)if(String(get(sheet,r,c)).toLocaleLowerCase().includes(needle)){rowStart=r;columnStart=c;draw();return;}if(i%1000===0){await new Promise(r=>setTimeout(r,0));if(ctx.signal.aborted)throw new DOMException('Cancelled','AbortError');}}
  ctx.status('No matching value in the active sheet.');
 });
 search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();find.click();}});
 await parse();const first=parsed.sheets[0];return {summary:parsed.notice+' Showing '+Math.min(100,first?.rows||0)+' of '+(first?.rows||0)+' rows and '+Math.min(20,first?.columns||0)+' of '+(first?.columns||0)+' columns. Use row/column navigation to see the rest.',print:()=>window.print(),printLabel:'Print visible rows'};
}
