'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.bcmap':'application/octet-stream','.ttf':'font/ttf','.pfb':'application/octet-stream','.icc':'application/octet-stream','.bin':'application/octet-stream'};
async function assetIndex(){
 const root=path.join(__dirname,'web'),assets=new Map();
 async function visit(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await visit(file);else if(entry.isFile()&&TYPES[path.extname(file)]){const route='/'+path.relative(root,file).replaceAll('\\','/');assets.set(route,{file,type:TYPES[path.extname(file)]});}}}
 await visit(root);assets.set('/shell',assets.get('/index.html'));assets.delete('/index.html');return assets;
}
module.exports={assetIndex};
