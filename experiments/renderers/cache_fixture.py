"""Exercise unavailable, zero and empty-string formula caches as distinct cases."""
from pathlib import Path
import zipfile,json,hashlib
from xml.etree import ElementTree as E
root=Path(__file__).resolve().parents[2]
out=Path(__file__).resolve().parent/'generated'
with zipfile.ZipFile(root/'tests/fixtures/generated/valid/data/values-1900.xlsx') as z:
    entries={n:z.read(n) for n in z.namelist()}
ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
tree=E.fromstring(entries['xl/worksheets/sheet1.xml']);data=tree.find('{'+ns+'}sheetData')
for index,kind,formula,cached in [(12,'n','SUM(0,0)','0'),(13,'str','""','')]:
    row=E.SubElement(data,'{'+ns+'}row',r=str(index));cell=E.SubElement(row,'{'+ns+'}c',r='B'+str(index),t=kind)
    E.SubElement(cell,'{'+ns+'}f').text=formula;E.SubElement(cell,'{'+ns+'}v').text=cached
tree.find('{'+ns+'}dimension').set('ref','A1:B13')
entries['xl/worksheets/sheet1.xml']=E.tostring(tree,encoding='utf-8',xml_declaration=True)
p=out/'cache-edge.xlsx'
with zipfile.ZipFile(p,'w') as z:
    for n,b in entries.items():
        info=zipfile.ZipInfo(n,(2020,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,b)
manifest=json.loads((out/'manifest.json').read_text());manifest=[r for r in manifest if r['id']!='CACHE-EDGE']
manifest.append(dict(id='CACHE-EDGE',path=p.name,kind='xlsx',description='B9 unavailable; B12 cached zero; B13 cached empty string.',bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Created CACHE-EDGE')
