'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const JSZip=require('jszip'),{inspectArchive}=require('../src/archive-check.cjs'),{imageInfo}=require('../src/image-info.cjs');
test('archive validation measures inflated bytes and rejects lies and duplicate/unsafe names',async()=>{
 const z=new JSZip();z.file('META-INF/container.xml','<container/>');z.file('chapter.xhtml','a'.repeat(100000));const good=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});assert.equal(inspectArchive(good,'epub').entries,3);
 const forged=Buffer.from(good);let at=forged.indexOf(Buffer.from('504b0102','hex'));while(at>=0){if(forged.toString('utf8',at+46,at+46+forged.readUInt16LE(at+28))==='chapter.xhtml'){forged.writeUInt32LE(1,at+24);break;}at=forged.indexOf(Buffer.from('504b0102','hex'),at+4);}assert.throws(()=>inspectArchive(forged,'epub'),/size mismatch|local sizes/);
 const traversal=new JSZip();traversal.file('../bad','unsafe');assert.throws(()=>inspectArchive(require('node:buffer').Buffer.from([]),'epub'),/incomplete/);assert.throws(()=>inspectArchive(good.subarray(0,good.length-2),'epub'),/incomplete/);
 const bad=await traversal.generateAsync({type:'nodebuffer'});assert.throws(()=>inspectArchive(bad,'epub'),/Unsafe/);
});
test('raster header guard rejects oversized dimensions before decode',async()=>{
 const manifest=require('./fixtures/generated/manifest.json'),f=manifest.fixtures.find(f=>f.id==='IMG-PNG');const bytes=await fs.readFile(path.join(__dirname,'fixtures/generated',f.path));assert.ok(imageInfo(bytes).pixels>0);const huge=Buffer.from(bytes);huge.writeUInt32BE(100000,16);assert.throws(()=>imageInfo(huge),/limit/);
});

function entries(bytes){const list=[];let p=bytes.readUInt32LE(bytes.length-6);while(bytes.readUInt32LE(p)===0x02014b50){const offset=bytes.readUInt32LE(p+42),name=bytes.toString('utf8',p+46,p+46+bytes.readUInt16LE(p+28));list.push({central:p,offset,name,data:offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28)});p+=46+bytes.readUInt16LE(p+28)+bytes.readUInt16LE(p+30)+bytes.readUInt16LE(p+32);}return list;}
async function archive(options={}){const z=new JSZip();z.file('META-INF/container.xml','<container/>');z.file('chapter.xhtml','<html><body>Reading text</body></html>');return z.generateAsync({type:'nodebuffer',compression:'DEFLATE',...options});}

test('archive integrity: CRC, local headers, encryption flags, disks and streaming descriptors',async()=>{
 const good=await archive();assert.equal(inspectArchive(good,'epub').entries,3);
 const target=entries(good).find(e=>e.name==='chapter.xhtml');
 for(const mutate of [b=>{b.writeUInt32LE(123,target.central+16);b.writeUInt32LE(123,target.offset+14);},b=>b.writeUInt32LE(999,target.offset+18),b=>b.writeUInt16LE(1,target.central+8),b=>b.writeUInt16LE(1,target.central+34)]){const b=Buffer.from(good);mutate(b);assert.throws(()=>inspectArchive(b,'epub'),/checksum|local sizes|Encrypted|Multipart/);}
 const streamed=await archive({streamFiles:true});assert.equal(inspectArchive(streamed,'epub').entries,3);const t=entries(streamed).find(e=>e.name==='chapter.xhtml'),descriptor=t.data+streamed.readUInt32LE(t.central+20);const forged=Buffer.from(streamed);forged.writeUInt32LE(123,descriptor+4);assert.throws(()=>inspectArchive(forged,'epub'),/descriptor/);
 const truncated=Buffer.from(streamed);truncated.writeUInt32LE(0xffffffff,t.central+20);assert.throws(()=>inspectArchive(truncated,'epub'),/bounds/);
});

test('archive rejects UTF-8 and UTF-16 XML declarations',async()=>{
 for(const value of ['<!DOCTYPE x [<!ENTITY a "value">]><x/>',Buffer.from('\ufeff<!DOCTYPE x><x/>','utf16le')]){const z=new JSZip();z.file('META-INF/container.xml','<container/>');z.file('extensionless-part',value);const bytes=await z.generateAsync({type:'nodebuffer'});assert.throws(()=>inspectArchive(bytes,'epub'),/XML declarations/);}
});


test('archive rejects duplicate paths, hidden expansion and excessive entries',async()=>{
 const z=new JSZip();z.file('META-INF/container.xml','<container/>');z.file('aaa','one');z.file('bbb','two');const dup=await z.generateAsync({type:'nodebuffer'}),b=entries(dup).find(e=>e.name==='bbb');dup.write('aaa',b.central+46);dup.write('aaa',b.offset+30);assert.throws(()=>inspectArchive(dup,'epub'),/duplicate/);
 const bomb=new JSZip();bomb.file('META-INF/container.xml','<container/>');bomb.file('oversized',Buffer.alloc(33*1024*1024,65));const bytes=await bomb.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),e=entries(bytes).find(e=>e.name==='oversized');bytes.writeUInt32LE(1,e.central+24);bytes.writeUInt32LE(1,e.offset+22);assert.throws(()=>inspectArchive(bytes,'epub'),/expanded-byte/);
 const many=new JSZip();for(let n=0;n<10001;n++)many.file(String(n),'');const excessive=await many.generateAsync({type:'nodebuffer'});assert.throws(()=>inspectArchive(excessive,'epub'),/exceeds limits/);
});

test('rejected archive registrations release reservations and do not poison subsequent opens',async t=>{
 const {createBroker}=require('../src/broker.cjs'),os=require('node:os'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'ufv-archive-')),broker=await createBroker({tickMs:60000,emptyGraceMs:60000});t.after(async()=>{await broker.close();await fs.rm(dir,{recursive:true,force:true});});
 const bytes=await archive(),e=entries(bytes).find(e=>e.name==='chapter.xhtml');bytes.writeUInt32LE(123,e.central+16);bytes.writeUInt32LE(123,e.offset+14);const file=path.join(dir,'corrupt.epub');await fs.writeFile(file,bytes);
 const results=await Promise.allSettled(Array.from({length:4},()=>broker.registerFile(file)));assert.ok(results.every(r=>r.status==='rejected'&&/checksum/.test(r.reason.message)));assert.equal(broker.diagnostics().snapshotBytes,0);assert.equal(broker.diagnostics().pendingRegistrations,0);assert.equal(broker.diagnostics().sessions,0);
 await fs.writeFile(file,await archive());const session=await broker.registerFile(file);assert.equal(broker.diagnostics().sessions,1);broker.revoke(session.fileId);assert.equal(broker.diagnostics().snapshotBytes,0);
});

test('archive extra fields cannot override checked entry paths',async()=>{
 const z=new JSZip();z.file('META-INF/container.xml','<container/>');z.file('\u00e9','safe');const good=await z.generateAsync({type:'nodebuffer'});assert.equal(inspectArchive(good,'epub').entries,3);const e=entries(good).find(e=>e.name==='\u00e9');const extra=e.central+46+good.readUInt16LE(e.central+28);assert.equal(good.readUInt16LE(extra),0x7075);
 const altered=Buffer.from(good);altered.write('..',extra+9);assert.throws(()=>inspectArchive(altered,'epub'),/Alternate/);
 const invalid=Buffer.from(good);invalid.writeUInt16LE(65535,extra+2);assert.throws(()=>inspectArchive(invalid,'epub'),/extra fields/);
});
