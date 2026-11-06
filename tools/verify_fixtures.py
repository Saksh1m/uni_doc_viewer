"""Validate corpus integrity and semantic ground truth, not application behavior."""
from pathlib import Path
from datetime import datetime
from xml.etree import ElementTree as ET
import csv
import hashlib
import json
import platform
import zipfile
import importlib.metadata

from PIL import Image, ImageOps
from docx import Document
from openpyxl import load_workbook
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/fixtures/generated'
manifest = json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
results = []


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    results.append(label)


ids = set()
for item in manifest['fixtures']:
    check('unique '+item['id'], item['id'] not in ids)
    ids.add(item['id'])
    path=(OUT/item['path']).resolve()
    check('contained '+item['id'], path.is_relative_to(OUT.resolve()))
    data=path.read_bytes()
    check('hash '+item['id'], hashlib.sha256(data).hexdigest()==item['sha256'])
    check('size '+item['id'], len(data)==item['bytes'])
    check('pending viewer '+item['id'], item['viewer_status']=='not_run')
    check('traceability '+item['id'], bool(item['release_checks']) and all(r.startswith('REL-') for r in item['release_checks']))
    if path.suffix in ('.docx','.xlsx','.epub') and item['category'] not in ('invalid',):
        with zipfile.ZipFile(path) as z:
            check('CRC '+item['id'], z.testzip() is None)
            for name in z.namelist():
                if name.endswith(('.xml','.rels','.opf','.xhtml','.ncx')):
                    ET.fromstring(z.read(name))
            if path.suffix=='.epub':
                first=z.infolist()[0]
                check('EPUB packaging '+item['id'], first.filename=='mimetype' and first.compress_type==0 and z.read('mimetype')==b'application/epub+zip')
                container=ET.fromstring(z.read('META-INF/container.xml'))
                opf=next(e for e in container.iter() if e.tag.endswith('rootfile')).attrib['full-path']
                tree=ET.fromstring(z.read(opf))
                check('EPUB chapters '+item['id'], len([e for e in tree.iter() if e.tag.endswith('itemref')])==2)
    if item['id'].startswith('TXT-') and item['category']=='valid' and item['id']!='TXT-06':
        encoding={'TXT-01':'utf-8','TXT-02':'utf-8-sig','TXT-03':'utf-16','TXT-04':'utf-16'}[item['id']]
        check('unicode '+item['id'], 'नमस्ते, 日本語' in data.decode(encoding))
    if item['id'] in ('IMG-PNG','IMG-JPG','IMG-WEBP','LARGE-IMG'):
        with Image.open(path) as im:
            im.load()
            check('dimensions '+item['id'], im.size==(item['facts']['width'],item['facts']['height']))
    if item['id']=='IMG-EXIF':
        with Image.open(path) as im:
            check('orientation tag',im.getexif()[274]==6)
            check('oriented dimensions',ImageOps.exif_transpose(im).size==(480,640))
    if item['id'] in ('PDF-01','PDF-PASSWORD','LARGE-PDF'):
        reader=PdfReader(path)
        if item['id']=='PDF-PASSWORD':
            check('wrong password refused',reader.decrypt('wrong')==0)
            check('correct password accepted',reader.decrypt('viewer-test')!=0)
        count=item['facts']['pages']
        check('PDF pages '+item['id'],len(reader.pages)==count)
        check('PDF first marker '+item['id'],'SEARCH-PDF-0001' in reader.pages[0].extract_text())
        check('PDF last marker '+item['id'],f'SEARCH-PDF-{count:04d}' in reader.pages[-1].extract_text())
    if item['id'] in ('DOCX-01','DOCX-LAYOUT'):
        doc=Document(path)
        check('DOCX paragraph '+item['id'], any('DOCX-SEARCH-MARKER' in p.text for p in doc.paragraphs))
        check('DOCX table '+item['id'], doc.tables[0].cell(1,1).text=='42')
        check('DOCX image '+item['id'],len(doc.inline_shapes)==1)
    if item['id'] in ('XLSX-01','XLSX-1904'):
        wb=load_workbook(path,data_only=True); ws=wb['Values']
        check('XLSX values '+item['id'],[ws[f'B{i}'].value for i in (2,3,4,5,6,7,8,9,10)]==['001234','12345678901234567890',0,True,datetime(2024,1,2),0.125,5,None,999])
        check('XLSX second sheet '+item['id'],wb['Second sheet']['A1'].value=='SECOND-SHEET-MARKER')
        f=load_workbook(path,data_only=False)['Values']
        check('XLSX formulas '+item['id'],[f[f'B{i}'].value for i in (8,9,10)]==['=SUM(2,3)','=SUM(4,5)','=SUM(6,7)'])
    if item['id']=='LARGE-XLSX':
        wb=load_workbook(path,read_only=True); ws=wb.active
        check('large workbook dimensions',(ws.max_row,ws.max_column)==(10000,10))
        check('large workbook last cell',ws['J10000'].value=='R10000C10'); wb.close()
    if item['id']=='DATA-QUOTED':
        rows=list(csv.reader(path.open(encoding='utf-8',newline='')))
        check('CSV quoting',rows[2]==['00002','line one\nline two','=1+1'] and rows[3][1]=='quote "inside"')
    if item['id']=='LARGE-CSV':
        with path.open(encoding='utf-8',newline='') as f:
            rows=csv.reader(f); header=next(rows); count=0
            for row in rows:
                check_cols=len(row)==10
                if not check_cols: raise AssertionError('CSV width')
                count+=1
        check('large CSV shape',len(header)==10 and count==100000)
        check('large CSV last value',row[-1]=='R100000-C10-SYNTHETIC')
    if item['id']=='SEC-EXPAND':
        with zipfile.ZipFile(path) as z:
            check('bounded expansion probe',z.getinfo('OEBPS/padding.txt').file_size==1048576 and sum(i.file_size for i in z.infolist())<1100000)
    if item['id']=='SEC-TRAVERSAL':
        with zipfile.ZipFile(path) as z:
            check('traversal entry present','../../outside-sentinel.txt' in z.namelist())
check('manifest count',manifest['fixture_count']==len(ids))
report={'status':'passed','scope':'Fixture hashes, packaging and selected semantic checks only; no viewer, browser, layout or full EPUB conformance validation.',
        'fixture_count':len(ids),'assertions':len(results),'python':platform.python_version(),
        'packages':{p:importlib.metadata.version(p) for p in ('pillow','reportlab','pypdf','openpyxl','python-docx')},
        'manifest_sha256':hashlib.sha256((OUT/'manifest.json').read_bytes()).hexdigest(),
        'checks':results}
(OUT.parent/'verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(f'PASS: {len(ids)} fixtures; {len(results)} assertions. Viewer tests remain not run.')
