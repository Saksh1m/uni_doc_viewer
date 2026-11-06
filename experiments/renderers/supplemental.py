"""Image-heavy capacity fixtures; ordinary document performance is a separate claim."""
from pathlib import Path
import hashlib, io, json, random, zipfile
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from docx import Document
from docx.shared import Inches

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'experiments/renderers/generated'
OUT.mkdir(exist_ok=True)
rng=random.Random(4404)
images=[]
for i in range(18):
    # Synthetic photographic-entropy pixel data; no private photographs.
    im=Image.frombytes('RGB',(1400,1000),rng.randbytes(1400*1000*3))
    b=io.BytesIO();im.save(b,format='JPEG',quality=90);images.append(b.getvalue())
rows=[]
def record(id,name,kind,description):
    p=OUT/name
    rows.append(dict(id=id,path=name,kind=kind,description=description,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
for mb in (10,100):
    name=f'image-heavy-{mb}mb.pdf';c=canvas.Canvas(str(OUT/name),invariant=1)
    count=0;total=0
    while total<mb*1024*1024:
        # Vary JPEG comment so ReportLab sees a distinct image object per page.
        base=images[count%len(images)]
        comment=f'page-{count}'.encode();jpeg=base[:2]+b'\xff\xfe'+(len(comment)+2).to_bytes(2,'big')+comment+base[2:]
        # ReportLab may deduplicate identical decoded pixels after 18 pages;
        # use a new image after that point to ensure actual image bytes grow.
        if count>=len(images):
            im=Image.frombytes('RGB',(1400,1000),rng.randbytes(1400*1000*3));b=io.BytesIO();im.save(b,format='JPEG',quality=90);jpeg=b.getvalue()
        c.drawString(40,800,f'IMAGE-HEAVY-{mb}MB PAGE {count+1}')
        c.drawImage(ImageReader(io.BytesIO(jpeg)),40,370,width=500,height=357)
        c.showPage();total+=len(jpeg);count+=1
    c.save();record('PERF-PDF-'+str(mb),name,'pdf',f'{count} pages with unique image content; synthetic image-heavy workload, not ordinary text PDF.')
doc=Document();total=0;i=0
while total<10*1024*1024:
    doc.add_heading(f'CAPACITY-DOCX-{i+1}',1);doc.add_picture(io.BytesIO(images[i]),width=Inches(5));total+=len(images[i]);i+=1
doc.save(OUT/'image-heavy-10mb.docx');record('PERF-DOCX','image-heavy-10mb.docx','docx','Embedded raster images; readable headings; not a complex Word layout benchmark.')
base=ROOT/'tests/fixtures/generated/valid/books/epub3.epub'
with zipfile.ZipFile(base) as z: entries={n:z.read(n) for n in z.namelist()}
items='';body='';total=0;i=0
while total<20*1024*1024:
    data=images[i%len(images)];name=f'image{i}.jpg';entries['OEBPS/'+name]=data
    items+=f'<item id="im{i}" href="{name}" media-type="image/jpeg"/>'
    body+=f'<p>CAPACITY-EPUB-{i}</p><img src="{name}" alt="Synthetic image {i}"/>'
    total+=len(data);i+=1
entries['OEBPS/package.opf']=entries['OEBPS/package.opf'].replace(b'</manifest>',items.encode()+b'</manifest>')
entries['OEBPS/chapter1.xhtml']=entries['OEBPS/chapter1.xhtml'].replace(b'</body>',body.encode()+b'</body>')
with zipfile.ZipFile(OUT/'image-heavy-20mb.epub','w') as z:
    for name,data in entries.items():
        info=zipfile.ZipInfo(name,(2020,1,1,0,0,0));info.compress_type=0 if name=='mimetype' else zipfile.ZIP_DEFLATED;z.writestr(info,data)
record('PERF-EPUB','image-heavy-20mb.epub','epub','Embedded raster-image resources; two chapters.')
(OUT/'manifest.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps([{'id':r['id'],'bytes':r['bytes']} for r in rows]))
