'use strict';
(async()=>{
 const $=id=>document.getElementById(id),status=$('status'),content=$('content'),toolbar=$('tools'),retry=$('retry'),cancel=$('cancel'),view=$('rendered'),formatTools=$('format-tools');
 const id=/^\/view\/([a-f0-9]{32})$/.exec(location.pathname)?.[1],token=new URLSearchParams(location.hash.slice(1)).get('token');history.replaceState(null,'',location.pathname);
 const key='ufv-session:'+id,base='/api/files/'+id;
 let credential,timer,loaded=false,busy=false,ended=false,normalStatus='',scope,renderer,metadata,renderFailed=false,focusRetry=false;
 const headers=()=>({Authorization:'Bearer '+credential});
 function finishRecovery(){retry.disabled=false;if(focusRetry&&!retry.hidden){focusRetry=false;retry.focus();}}
 function setStatus(text){if(!ended){normalStatus=text;status.textContent=text;}}
 async function request(url,options={}){const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000),...options});if(!response.ok){const error=Error('Session request failed');error.status=response.status;throw error;}return response;}
 // Some browser operations (including dynamic import) do not accept an AbortSignal.
 // Release the UI even when they remain pending; late results are observed and discarded.
 function waitFor(operation,signal){return new Promise((resolve,reject)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason||new DOMException('Cancelled','AbortError'));};
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve(operation).then(value=>{signal.removeEventListener('abort',abort);signal.aborted?abort():resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  if(signal.aborted)abort();
 });}
 function dispose(reason){if(!scope)return;scope.controller.abort(reason);for(const fn of scope.cleanup.splice(0))try{Promise.resolve(fn()).catch(()=>{});}catch{}scope=null;renderer=null;}
 function failure(error,parsing=false){if(ended)return;
  if(error.status===401){clearInterval(timer);credential=null;sessionStorage.removeItem(key);retry.hidden=true;status.textContent='This viewing session expired. Reopen the original file to start a new session.'+(loaded?' Loaded text remains available.':'');}
  else if(parsing){renderFailed=true;retry.disabled=busy;retry.hidden=!credential;retry.textContent='Retry loading';status.textContent=error.name==='AbortError'?'Loading cancelled. Retry loading or end this viewing session.':'This file could not be displayed: '+error.message;}
  else{retry.hidden=!credential;retry.textContent='Retry connection';status.textContent=credential?'The local viewer connection is unavailable. Retry, or reopen the original file to start a new session.'+(loaded?' Loaded text remains available.':''):'The local viewer could not start this session. Reopen the original file to start a new session.';}
 }
 async function run(action){if(busy||ended||!scope)return;busy=true;cancel.hidden=false;$('reader').setAttribute('aria-busy','true');const origin=document.activeElement;const active=scope;const timeout=setTimeout(()=>{const error=Error('The operation exceeded the 30-second limit.');dispose(error);failure(error,true);},30000);
  try{await waitFor(Promise.resolve().then(action),active.controller.signal);}catch(error){if(!ended){const cause=active.controller.signal.aborted?active.controller.signal.reason:error;dispose();failure(cause,true);}}finally{clearTimeout(timeout);busy=false;finishRecovery();const cancelledFocus=document.activeElement===cancel;cancel.hidden=true;$('reader').setAttribute('aria-busy','false');if(cancelledFocus&&origin?.isConnected)origin.focus();}
 }
 async function load(){$('reader').setAttribute('aria-busy','true');dispose();loaded=false;renderFailed=false;metadata=null;content.textContent='';view.replaceChildren();formatTools.replaceChildren();$('print').hidden=true;retry.hidden=true;cancel.hidden=false;
  const controller=new AbortController();scope={controller,cleanup:[]};const active=scope;
  controller.signal.addEventListener('abort',()=>{for(const fn of active.cleanup.splice(0))try{Promise.resolve(fn()).catch(()=>{});}catch{}},{once:true});
  let timeout;const resumeDeadline=()=>{clearTimeout(timeout);timeout=setTimeout(()=>controller.abort(Error('Loading exceeded the 30-second limit.')),30000);};resumeDeadline();
  try{
   metadata=await(await request(base+'/metadata',{headers:headers(),signal:controller.signal})).json();if(ended)return;
   $('name').textContent=metadata.name;document.title=metadata.name+' — Universal File Viewer';toolbar.hidden=false;const text=metadata.format==='txt';content.hidden=!text;view.hidden=text;formatTools.hidden=text;$('wrap-label').hidden=!text;
   if(text){const bytes=new Uint8Array(await(await request(base+'/bytes',{headers:headers(),signal:controller.signal})).arrayBuffer());if(ended||controller.signal.aborted)throw new DOMException('Cancelled','AbortError');const encoding=bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8';content.textContent=new TextDecoder(encoding,{fatal:true}).decode(bytes);renderer={summary:metadata.size===0?'This file is empty.':metadata.size.toLocaleString()+' bytes · Read-only snapshot · Use Ctrl+F to search',print:()=>window.print(),printLabel:'Print text'};}
   else{const type=metadata.format==='pdf'?'pdf':['png','jpg','jpeg','webp'].includes(metadata.format)?'image':['csv','tsv','xlsx'].includes(metadata.format)?'table':'document';const module=await waitFor(import('/render-'+type+'.mjs'),controller.signal);if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
    const ctx={pauseDeadline:()=>clearTimeout(timeout),resumeDeadline,metadata,base,headers,view,tools:formatTools,signal:controller.signal,run,status:text=>{if(!controller.signal.aborted)setStatus(text);},cleanup:fn=>{if(controller.signal.aborted)Promise.resolve(fn()).catch(()=>{});else active.cleanup.push(fn);},request:(url,options={})=>request(url,{headers:headers(),signal:controller.signal,...options})};
    renderer=await waitFor(module.render(ctx),controller.signal);
   }
   if(ended||controller.signal.aborted)throw new DOMException('Cancelled','AbortError');loaded=true;setStatus(renderer.summary);$('print').hidden=!renderer.print;$('print').textContent=renderer.printLabel||'Print';retry.hidden=true;
  }catch(error){const cause=controller.signal.aborted?controller.signal.reason:error;dispose();failure(cause,metadata!=null&&!cause.status);}
  finally{clearTimeout(timeout);finishRecovery();cancel.hidden=true;$('reader').setAttribute('aria-busy','false');}
 }
 async function reconnect(manual=false){if(busy||ended||!credential)return;busy=true;try{if((!loaded&&!renderFailed)||(manual&&renderFailed))await load();else{await request(base+'/ping',{method:'POST',headers:headers()});if(!ended&&!renderFailed){status.textContent=normalStatus;retry.hidden=true;}}}catch(error){failure(error);}finally{busy=false;}}
 $('wrap').addEventListener('change',e=>content.classList.toggle('nowrap',!e.target.checked));$('print').addEventListener('click',()=>void run(async()=>{try{await renderer?.print?.();}catch(error){if(!scope?.controller.signal.aborted)setStatus('Print preparation stopped: '+error.message);}}));
 cancel.addEventListener('click',()=>{dispose();cancel.hidden=true;focusRetry=true;failure(new DOMException('Cancelled','AbortError'),true);if(!busy)finishRecovery();});
 $('close').addEventListener('click',async()=>{if(ended)return;const oldHeaders=headers();ended=true;clearInterval(timer);dispose();credential=null;sessionStorage.removeItem(key);sessionStorage.removeItem('ufv-position:'+id);content.textContent='';view.replaceChildren();formatTools.replaceChildren();toolbar.hidden=formatTools.hidden=retry.hidden=cancel.hidden=true;$('name').textContent='Universal File Viewer';document.title='Universal File Viewer';status.textContent='Viewing session ended. You can close this tab.';status.focus();try{await request(base+'/close',{method:'POST',headers:oldHeaders});}catch{status.textContent='View closed. The local session will expire automatically. You can close this tab.';}});
 retry.addEventListener('click',()=>void reconnect(true));for(const event of ['focus','online'])window.addEventListener(event,()=>void reconnect());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void reconnect();});
 window.addEventListener('pagehide',()=>dispose());
 window.addEventListener('pageshow',event=>{if(event.persisted&&!ended){loaded=false;renderFailed=false;}void reconnect();});
 try{if(!id){status.textContent='Open a supported file with Universal File Viewer.';return;}credential=sessionStorage.getItem(key);busy=true;
  if(token){const auth=await(await request('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileId:id,token})})).json();credential=auth.credential;sessionStorage.setItem(key,credential);}
  if(!credential){status.textContent='No active viewing session. Reopen the file to start a new session.';return;}await load();
 }catch(error){failure(error);}finally{busy=false;if(credential&&!ended)timer=setInterval(()=>{if(!document.hidden)void reconnect();},60000);}
})();
