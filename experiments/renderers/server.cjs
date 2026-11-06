// Disposable private test server. Not the application's production file broker.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,token=crypto.randomBytes(24).toString('hex'),prefix='/'+token+'/';
const inventory=JSON.parse(fs.readFileSync(path.join(root,'inventory.json')));
const publicFiles=new Map(inventory.filter(f=>!f.path.startsWith('runtime/')&&!f.path.startsWith('inputs/')).map(f=>[f.path,f.path]));
publicFiles.set('','index.html');
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'fixtures.json')));
for(const f of fixtures)publicFiles.set('fixture/'+f.id,f.file);
let host;const stats={};
const server=http.createServer((req,res)=>{
 if(req.headers.host!==host||!req.url.startsWith(prefix)){res.writeHead(404);return res.end();}
 const route=req.url.slice(prefix.length).split('?')[0];
 if(route==='metrics'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(stats));}
 const file=publicFiles.get(route);if(!file){res.writeHead(404);return res.end();}
 const full=path.join(root,file),size=fs.statSync(full).size;
 const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.pdf':'application/pdf'}[path.extname(file)]||'application/octet-stream';
 res.setHeader('Content-Type',mime);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 // EPUB requires inline book styling and blob images; scripts remain local.
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'");
 let start=0,end=size-1,status=200;
 if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m){res.writeHead(416);return res.end();}start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;if(start>end||start>=size){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end();}status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);}
 res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Length',Math.max(0,end-start+1));
 if(route.startsWith('fixture/')){const id=route.slice(8);stats[id]??={requests:0,rangeRequests:0,bytesScheduled:0};stats[id].requests++;stats[id].rangeRequests+=status===206?1:0;stats[id].bytesScheduled+=end-start+1;}
 res.writeHead(status);if(req.method==='HEAD')return res.end();fs.createReadStream(full,{start,end}).on('error',()=>res.destroy()).pipe(res);
});
server.listen(0,'127.0.0.1',()=>{host='127.0.0.1:'+server.address().port;process.stdout.write(JSON.stringify({url:'http://'+host+prefix})+'\n');});
