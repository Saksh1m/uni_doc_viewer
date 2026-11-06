'use strict';
// Test-only child. Diagnostics stay on Node IPC; never add them to the viewer HTTP API.
const {createBroker}=require('../../src/broker.cjs');
(async()=>{
 const broker=await createBroker({emptyGraceMs:300000});
 process.on('disconnect',()=>void broker.close());
 process.on('message',async message=>{
  try{let value;
   if(message.op==='open')value=await broker.registerFile(message.path);
   else if(message.op==='stats')value={...broker.diagnostics(),memory:process.memoryUsage(),resources:process.resourceUsage(),pid:process.pid};
   else if(message.op==='stop'){await broker.close();process.send({id:message.id,value:true},()=>process.disconnect());return;}
   else throw Error('Unsupported benchmark operation');
   process.send({id:message.id,value});
  }catch(error){process.send({id:message.id,error:error.message});}
 });
 process.send({ready:true,pid:process.pid});
})().catch(error=>{console.error(error.message);process.exitCode=1;});
