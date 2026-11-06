"""Synthetic test inputs, not user-facing documents. Run from any directory.

Generated archives have fixed timestamps. Regeneration only overwrites named
fixture outputs; it never recursively deletes a directory or reads sources/.
"""
from pathlib import Path
import csv
import hashlib
import io
import json
import zipfile
from datetime import datetime
from xml.etree import ElementTree as ET

from PIL import Image, ImageDraw
from docx import Document
from docx.shared import Inches
from openpyxl import Workbook
from openpyxl.utils.datetime import CALENDAR_MAC_1904
from reportlab.pdfgen import canvas
from reportlab.lib.pdfencrypt import StandardEncryption

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/fixtures/generated'
ROWS = []


def target(name):
    p = OUT / name
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def register(fid, name, kind, expected, rel=('REL-03',), facts=None):
    p = OUT / name
    ROWS.append(dict(id=fid, path=name, category=kind, expected=expected,
                     release_checks=list(rel), facts=facts or {},
                     bytes=p.stat().st_size,
                     sha256=hashlib.sha256(p.read_bytes()).hexdigest(),
                     viewer_status='not_run'))


def raw(fid, name, data, kind, expected, rel=('REL-03',), facts=None):
    target(name).write_bytes(data if isinstance(data, bytes) else data.encode('utf-8'))
    register(fid, name, kind, expected, rel, facts)


def archive(path, entries, epub=False):
    with zipfile.ZipFile(path, 'w') as z:
        for name, data in entries.items():
            info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED if epub and name == 'mimetype' else zipfile.ZIP_DEFLATED
            z.writestr(info, data)


def normalized(path, transform=None):
    with zipfile.ZipFile(path) as z:
        entries = {n: z.read(n) for n in z.namelist()}
    if 'docProps/core.xml' in entries:
        core = ET.fromstring(entries['docProps/core.xml'])
        for tag in ('created', 'modified'):
            el = core.find('{http://purl.org/dc/terms/}' + tag)
            if el is not None:
                el.text = '2020-01-01T00:00:00Z'
        entries['docProps/core.xml'] = ET.tostring(core, encoding='utf-8', xml_declaration=True)
    if transform:
        transform(entries)
    archive(path, entries)


def make_pdf(name, pages=3, encrypted=False):
    enc = StandardEncryption('viewer-test', ownerPassword='fixture-owner', strength=128) if encrypted else None
    c = canvas.Canvas(str(target(name)), invariant=1, pageCompression=1, encrypt=enc)
    c.setTitle('Synthetic PDF fixture')
    for page in range(1, pages + 1):
        c.setFont('Helvetica', 20)
        c.drawString(54, 780, f'UFV PDF page {page} of {pages}')
        c.setFont('Helvetica', 11)
        c.drawString(54, 750, f'SEARCH-PDF-{page:04d}')
        for line in range(25):
            c.drawString(54, 720 - line * 22, f'Synthetic row {line + 1:02d}; page {page}; no personal information.')
        c.showPage()
    c.save()


def make_epub(name, version='3.0', probes=False):
    uid = 'urn:uuid:9f104b41-7664-4e45-ae24-326a96129890'
    entries = {'mimetype': 'application/epub+zip',
        'META-INF/container.xml': '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'}
    extra = ('<script>document.documentElement.setAttribute("data-probe-executed","yes");</script>'
             '<img src="https://viewer-fixture.invalid/tracker.png" alt="External image must be blocked"/>'
             '<img src="../neighbor-secret.txt" alt="Neighbor must not load"/>') if probes else ''
    for i in (1, 2):
        entries[f'OEBPS/chapter{i}.xhtml'] = f'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter {i}</title></head><body><h1>Chapter {i}</h1><p>EPUB-CHAPTER-{i} synthetic reading text.</p>{extra if i == 1 else ""}</body></html>'
    entries['OEBPS/toc.ncx'] = f'<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="{uid}"/></head><docTitle><text>Synthetic book</text></docTitle><navMap>' + ''.join(f'<navPoint id="n{i}" playOrder="{i}"><navLabel><text>Chapter {i}</text></navLabel><content src="chapter{i}.xhtml"/></navPoint>' for i in (1, 2)) + '</navMap></ncx>'
    nav = ''
    modified = ''
    if version == '3.0':
        entries['OEBPS/nav.xhtml'] = '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="chapter1.xhtml">Chapter 1</a></li><li><a href="chapter2.xhtml">Chapter 2</a></li></ol></nav></body></html>'
        nav = '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
        modified = '<meta property="dcterms:modified">2020-01-01T00:00:00Z</meta>'
    props = ' properties="scripted remote-resources"' if probes else ''
    entries['OEBPS/package.opf'] = f'<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="{version}" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">{uid}</dc:identifier><dc:title>Synthetic book</dc:title><dc:language>en</dc:language>{modified}</metadata><manifest><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"{props}/><item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>{nav}</manifest><spine toc="ncx"><itemref idref="c1"/><itemref idref="c2"/></spine></package>'
    archive(target(name), entries, epub=True)


def make_workbook(name, mac=False, large=False):
    wb = Workbook()
    wb.properties.created = wb.properties.modified = datetime(2020, 1, 1)
    ws = wb.active
    ws.title = 'Values'
    if large:
        for r in range(10000):
            ws.append([f'R{r + 1:05d}C{c + 1:02d}' for c in range(10)])
    else:
        if mac:
            wb.epoch = CALENDAR_MAC_1904
        for row in [('Label', 'Value'), ('Identifier', '001234'), ('Large identifier', '12345678901234567890'),
                    ('Zero', 0), ('Boolean', True), ('Date', datetime(2024, 1, 2)),
                    ('Percent', 0.125), ('Cached sum', '=SUM(2,3)'), ('Missing cache', '=SUM(4,5)'),
                    ('Stale cache', '=SUM(6,7)'), ('Blank', None)]:
            ws.append(row)
        ws['B6'].number_format = 'yyyy-mm-dd'
        ws['B7'].number_format = '0.0%'
        wb.create_sheet('Second sheet')['A1'] = 'SECOND-SHEET-MARKER'
    p = target(name)
    wb.save(p)

    def caches(entries):
        ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        tree = ET.fromstring(entries['xl/worksheets/sheet1.xml'])
        for cell in tree.findall('.//s:c', ns):
            if cell.get('r') in ('B8', 'B10'):
                v = cell.find('s:v', ns)
                if v is None:
                    v = ET.SubElement(cell, '{' + ns['s'] + '}v')
                v.text = '5' if cell.get('r') == 'B8' else '999'
        entries['xl/worksheets/sheet1.xml'] = ET.tostring(tree, encoding='utf-8', xml_declaration=True)
    normalized(p, None if large else caches)


def main():
    text = 'UFV-TEXT-MARKER\nSynthetic text: café, नमस्ते, 日本語.\nLine two.\n'
    for fid, suffix, data in [('TXT-01','utf8',text.encode()), ('TXT-02','utf8-bom',text.encode('utf-8-sig')),
                              ('TXT-03','utf16le',b'\xff\xfe'+text.encode('utf-16-le')), ('TXT-04','utf16be',b'\xfe\xff'+text.encode('utf-16-be'))]:
        raw(fid, f'valid/text/{suffix}.txt', data, 'valid', 'Show all Unicode text and find UFV-TEXT-MARKER.')
    raw('TXT-05','invalid/bad-encoding.txt',b'bad utf8: \xff\xfe\x80', 'invalid','Warn about invalid/uncertain encoding.',('REL-09',))
    raw('TXT-06','valid/text/empty.txt',b'', 'valid','Show an empty-file state without reporting corruption.')
    raw('PATH-01','paths/नमस्ते café 日本語 & (test) # 100%.txt',text,'valid','Open exact file without shell interpretation.',('REL-02','REL-06'))
    longname = 'paths/' + '/'.join(['segment-'+str(i)+'-'+'x'*22 for i in range(5)]) + '/long filename ' + 'x'*40 + '.txt'
    raw('PATH-02',longname,text,'valid','Open if OS permits; otherwise specific path-length error.',('REL-02','REL-09'))
    raw('PATH-03','paths/--help.txt','ARGUMENT-FILE-MARKER','valid','Treat selected path as file, not a command-line option.',('REL-02','REL-06'))
    for i in range(1,6):
        raw(f'SESSION-{i:02d}',f'sessions/file-{i}.txt',f'ONLY-FILE-{i}\n','valid',f'Show ONLY-FILE-{i}, never another session marker.',('REL-04','REL-05'))
    raw('SEC-NEIGHBOR','security/neighbor-secret.txt','NEIGHBOR-MUST-NOT-BE-READ','sentinel','Do not expose unless explicitly opened.',('REL-06',))
    raw('MD-01','valid/reading.md','# Markdown fixture\n\n**Bold** and *italic*.\n\n- first\n- second\n\n| Key | Value |\n| --- | --- |\n| marker | MD-TABLE |\n\n```js\nconst value = 42;\n```\n','valid','Show heading, emphasis, list, table, code block.')
    raw('SEC-MD','security/probes.md','# Isolation probe\n<script>document.documentElement.dataset.probeExecuted="yes"</script>\n<img src="https://viewer-fixture.invalid/image" onerror="document.documentElement.dataset.probeExecuted=\'yes\'">\n<style>body{display:none}</style>\n![neighbor](neighbor-secret.txt)\n[unsafe](javascript:void(0))\n','probe','No script marker, app hiding, external requests, neighbor reads, or executable javascript link.',('REL-06','REL-07'))
    for name, rows, delim in [('quoted.csv',[['id','note','value'],['00123','comma, inside','0'],['00002','line one\nline two','=1+1'],['00003','quote "inside"','12345678901234567890']],','),('semicolon.csv',[['id','value'],['001','1,25']],';'),('basic.tsv',[['id','value'],['001','TSV-MARKER']],'\t')]:
        s=io.StringIO(newline=''); csv.writer(s,delimiter=delim,lineterminator='\n').writerows(rows)
        raw('DATA-'+name.split('.')[0].upper(),'valid/data/'+name,s.getvalue(),'valid','Preserve quoted fields, identifiers, literal formula-like text; delimiter override where needed.')
    raw('CSV-BAD','invalid/unclosed.csv','a,b\n1,"never closed','invalid','Show a parse warning/error, not a silent trustworthy table.',('REL-09',))

    im = Image.new('RGB',(640,480),'white'); d=ImageDraw.Draw(im)
    d.rectangle((0,0,319,239),fill='red'); d.rectangle((320,0,639,239),fill='green')
    d.rectangle((0,240,319,479),fill='blue'); d.text((330,260),'BOTTOM RIGHT',fill='black')
    for ext in ('png','jpg','webp'):
        name=f'valid/images/quadrants.{ext}'; im.save(target(name))
        register('IMG-'+ext.upper(),name,'valid','Red top-left, green top-right, blue bottom-left; 640x480.',facts={'width':640,'height':480})
    exif=Image.Exif(); exif[274]=6
    name='valid/images/orientation-6.jpg'; im.save(target(name),exif=exif)
    register('IMG-EXIF',name,'valid','Rotate 90 degrees clockwise; displayed dimensions 480x640.',facts={'orientation':6})
    name='large/image-24mp.png'; Image.new('RGB',(6000,4000),'#145a42').save(target(name))
    register('LARGE-IMG',name,'capacity','Show 6000x4000 image; compressed bytes are not decoded memory.',('REL-08',),{'width':6000,'height':4000})
    for fid,name,pages,encrypted in [('PDF-01','valid/pdf/searchable.pdf',3,False),('PDF-PASSWORD','valid/pdf/password.pdf',3,True),('LARGE-PDF','large/500-pages.pdf',500,False)]:
        make_pdf(name,pages,encrypted)
        register(fid,name,'capacity' if pages==500 else 'valid','Navigate/search numbered pages.'+(' Reject wrong password; open with viewer-test.' if encrypted else ''),('REL-03','REL-08') if pages==500 else ('REL-03',),{'pages':pages,'password':'viewer-test' if encrypted else None})
    raw('PDF-BAD','invalid/truncated.pdf',b'%PDF-1.7\n1 0 obj\n<< /Type /Catalog','invalid','Report damaged PDF.',('REL-09',))
    raw('PDF-SPOOF','invalid/html-disguised.pdf','<html><script>document.title="PROBE"</script></html>','probe','Do not execute HTML; reject mismatched PDF.',('REL-06','REL-09'))

    doc=Document(); doc.core_properties.created=doc.core_properties.modified=datetime(2020,1,1)
    doc.add_heading('Synthetic reading fixture',0); doc.add_heading('Section one',1)
    doc.add_paragraph('DOCX-SEARCH-MARKER with café and a readable paragraph.')
    doc.add_paragraph('First list item',style='List Bullet')
    table=doc.add_table(rows=2,cols=2); table.cell(0,0).text='Item'; table.cell(0,1).text='Value'; table.cell(1,0).text='Synthetic'; table.cell(1,1).text='42'
    doc.add_picture(str(OUT/'valid/images/quadrants.png'),width=Inches(2))
    name='valid/documents/reading.docx'; doc.save(target(name)); normalized(OUT/name)
    register('DOCX-01',name,'valid','Show heading, paragraph, list, table value 42 and embedded image; text search works.')
    doc.add_page_break(); doc.add_heading('Complex layout boundary',1)
    doc.add_paragraph('Second page has a merged table cell; exact pagination is not required.')
    t=doc.add_table(rows=2,cols=3); t.cell(0,0).merge(t.cell(0,2)).text='MERGED-CELL-MARKER'
    doc.sections[0].header.paragraphs[0].text='HEADER-FIDELITY-MARKER'
    name='valid/documents/layout-boundary.docx'; doc.save(target(name)); normalized(OUT/name)
    register('DOCX-LAYOUT',name,'fidelity','Retain readable body and merged-cell marker; exact pagination/header fidelity is outside promise.')

    for fid,name,version,probe in [('EPUB-2','valid/books/epub2.epub','2.0',False),('EPUB-3','valid/books/epub3.epub','3.0',False),('SEC-EPUB','security/scripted.epub','3.0',True)]:
        make_epub(name,version,probe)
        register(fid,name,'probe' if probe else 'valid','Show two chapters and navigation.'+(' No script marker, external requests or neighbor reads.' if probe else ''),('REL-03','REL-06','REL-07') if probe else ('REL-03',),{'epub_version':version})
    for fid,name,mac in [('XLSX-01','valid/data/values-1900.xlsx',False),('XLSX-1904','valid/data/values-1904.xlsx',True)]:
        make_workbook(name,mac)
        register(fid,name,'valid','Preserve identifiers; B6=2024-01-02, B7=12.5%, B8 cached 5, B9 unavailable, B10 cached 999 with stale-results disclosure; second sheet marker visible.',facts={'date_system':1904 if mac else 1900})
    make_workbook('large/100k-cells.xlsx',large=True)
    register('LARGE-XLSX','large/100k-cells.xlsx','capacity','10,000 rows x 10 columns, last value R10000C10; scrolling and cancellation remain usable.',('REL-08',),{'rows':10000,'columns':10})
    raw('LARGE-TXT','large/1mb.txt',('UFV-LARGE-TEXT-ROW '+'x'*80+'\n').encode()*10000,'capacity','Search and scroll; approximately 1 MB.',('REL-08',))
    name='large/100k-rows.csv'
    with target(name).open('w',encoding='utf-8',newline='') as f:
        w=csv.writer(f,lineterminator='\n'); w.writerow([f'column{i}' for i in range(1,11)])
        for r in range(100000):
            w.writerow([f'R{r+1:06d}-C{c+1:02d}-SYNTHETIC' for c in range(10)])
    register('LARGE-CSV',name,'capacity','100,000 data rows and 10 columns; preserve first/last values.',('REL-08',),{'rows':100000,'columns':10})
    for ext in ('docx','xlsx','epub'):
        raw('BAD-'+ext.upper(),f'invalid/truncated.{ext}',b'PK\x03\x04truncated','invalid','Report broken container.',('REL-09',))
    # Bounded surrogates: max expanded size 1 MiB, never a real decompression bomb.
    with zipfile.ZipFile(OUT/'valid/books/epub3.epub') as z:
        base={n:z.read(n) for n in z.namelist()}
    for fid,name,entry,data,expect in [('SEC-EXPAND','security/expansion.epub','OEBPS/padding.txt',b'A'*1048576,'Reject with a test-only expanded-byte budget of 512 KiB; do not require production limits to reject this small fixture.'),('SEC-TRAVERSAL','security/traversal.epub','../../outside-sentinel.txt',b'NEVER-WRITE-THIS','Reject unsafe archive entry; no filesystem extraction outside session.')]:
        entries=dict(base); entries[entry]=data; archive(target(name),entries,epub=True)
        register(fid,name,'probe',expect,('REL-06',),{'max_probe_expansion_bytes':1048576})
    raw('UNSUPPORTED','invalid/unsupported.rtf',r'{\rtf1 Synthetic unsupported format}','unsupported','Explain unsupported format.',('REL-09',))
    manifest={'schema':1,'provenance':'Entirely synthetic; generated locally; no project source files or downloaded documents.',
              'generator':'tools/build_fixtures.py','fixture_count':len(ROWS),'fixtures':ROWS}
    target('manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    lines=['# Generated fixture catalog','','All viewer outcomes are **not run**. Hashes and bytes are in manifest.json.','', '| ID | File | Category | Expected outcome | Release checks |','|---|---|---|---|---|']
    for row in ROWS:
        lines.append(f"| {row['id']} | [{row['path']}]({row['path'].replace(' ', '%20')}) | {row['category']} | {row['expected']} | {', '.join(row['release_checks'])} |")
    target('CATALOG.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(f'Generated {len(ROWS)} fixtures; {sum(r["bytes"] for r in ROWS):,} bytes in {OUT}')


if __name__ == '__main__':
    main()
