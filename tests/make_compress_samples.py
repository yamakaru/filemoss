"""Builds compress-pdf samples: photo PDF (~10MB), text-only, encrypted, corrupt. Usage: python3 make_compress_samples.py OUTDIR [pages]"""
import sys,io,os,numpy as np
from PIL import Image,ImageFilter
from pypdf import PdfWriter,PdfReader
O=sys.argv[1];N=int(sys.argv[2]) if len(sys.argv)>2 else 7;os.makedirs(O,exist_ok=True);rng=np.random.default_rng(7)
def photo(w=3000,h=2200):
    small=rng.integers(0,255,(h//40,w//40,3),dtype=np.uint8)
    im=Image.fromarray(small).resize((w,h),Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))
    a=np.asarray(im).astype(np.int16)+rng.normal(0,6,(h,w,3)).astype(np.int16)
    return Image.fromarray(np.clip(a,0,255).astype(np.uint8))
ims=[photo() for _ in range(N)]
ims[0].save(f"{O}/photos_10mb.pdf",save_all=True,append_images=ims[1:],quality=95,resolution=300)
# text-only via reportlab-free minimal PDF writer
def textpdf(path,pages=3):
    objs=[];content=[]
    for p in range(pages):
        lines="".join(f"BT /F1 11 Tf 50 {780-i*14} Td (Page {p+1} line {i+1}: the quick brown fox jumps over the lazy dog.) Tj ET\n" for i in range(50))
        content.append(lines.encode())
    kids=" ".join(f"{4+2*i} 0 R" for i in range(pages))
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>");objs.append(f"<< /Type /Pages /Kids [{kids}] /Count {pages} >>".encode());objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for i,c in enumerate(content):
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {5+2*i} 0 R >>".encode())
        objs.append(f"<< /Length {len(c)} >>\nstream\n".encode()+c+b"\nendstream")
    out=bytearray(b"%PDF-1.4\n");off=[]
    for i,o in enumerate(objs):off.append(len(out));out+=f"{i+1} 0 obj\n".encode()+o+b"\nendobj\n"
    x=len(out);out+=f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()+b"".join(f"{o:010d} 00000 n \n".encode() for o in off)
    out+=f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode();open(path,"wb").write(out)
textpdf(f"{O}/text_only.pdf")
w=PdfWriter(clone_from=PdfReader(f"{O}/text_only.pdf"));w.encrypt(user_password="secret",owner_password="owner",algorithm="RC4-128");w.write(f"{O}/encrypted.pdf")
b=open(f"{O}/photos_10mb.pdf","rb").read();open(f"{O}/corrupt.pdf","wb").write(b[:2000])
for f in sorted(os.listdir(O)):print(f,os.path.getsize(f"{O}/{f}"))
