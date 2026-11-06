"""Synthetic image-heavy PDF for source performance checks; no private documents."""
from pathlib import Path
from io import BytesIO
import random, hashlib, json
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
root=Path(__file__).resolve().parents[2]
out=root/'tests/fixtures/run-work/performance'
out.mkdir(parents=True,exist_ok=True)
image=Image.frombytes('RGB',(1630,1630),random.Random(11).randbytes(1630*1630*3))
buf=BytesIO();image.save(buf,format='PNG')
pdf=out/'image-heavy-10mb.pdf'
c=canvas.Canvas(str(pdf),invariant=1,pageCompression=1)
c.drawString(40,800,'UFV PERFORMANCE PDF - deterministic synthetic image')
c.drawImage(ImageReader(BytesIO(buf.getvalue())),40,120,width=500,height=650)
c.showPage();c.drawString(40,800,'PERFORMANCE-PAGE-2');c.showPage();c.save()
meta={'id':'PERF-PDF','path':str(pdf.relative_to(root)).replace('\\','/'),'bytes':pdf.stat().st_size,'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'pages':2,'imagePixels':1630*1630,'provenance':'Deterministic synthetic RGB noise image plus text; image-heavy, not a representative real-world PDF.'}
(out/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
print(json.dumps(meta))
