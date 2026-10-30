"""Builds compress-pdf samples: photo PDF (~10MB), text-only, encrypted, corrupt, PNG/Flate images, empty. Usage: python3 make_compress_samples.py OUTDIR [pages]"""
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
# PNG/Flate images: RGB+PNG predictors (all 5 row filters), RGB plain Flate, Gray, RGB+SMask, plus tiny + Indexed (must be skipped)
import zlib
def png_rows(a):
    h,w,c=a.shape;a=a.astype(np.int16).reshape(h,w*c);out=[];prev=np.zeros(w*c,np.int16)
    for r in range(h):
        t=r%5;cur=a[r];left=np.concatenate([np.zeros(c,np.int16),cur[:-c]]);ul=np.concatenate([np.zeros(c,np.int16),prev[:-c]])
        if t==0:f=cur
        elif t==1:f=cur-left
        elif t==2:f=cur-prev
        elif t==3:f=cur-((left+prev)>>1)
        else:
            p=left+prev-ul;pa,pb,pc=abs(p-left),abs(p-prev),abs(p-ul);f=cur-np.where((pa<=pb)&(pa<=pc),left,np.where(pb<=pc,prev,ul))
        out.append(bytes([t])+(f&255).astype(np.uint8).tobytes());prev=cur
    return b"".join(out)
def pngpdf(path):
    W,H=1800,1200;objs=[None,None];pages=[]
    def add(o):objs.append(o);return len(objs)
    def img(d,data):return d.encode()+f" /Length {len(data)} >>\nstream\n".encode()+data+b"\nendstream"
    def page(xo):
        names=" ".join(f"/Im{i} {r} 0 R" for i,r in enumerate(xo));draw=b"".join(f"q 842 0 0 595 0 0 cm /Im{i} Do Q\n".encode() if i==0 else f"q 40 0 0 40 {20+i*50} 20 cm /Im{i} Do Q\n".encode() for i in range(len(xo)))
        c=add(f"<< /Length {len(draw)} >>\nstream\n".encode()+draw+b"\nendstream")
        pages.append(add(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << {names} >> >> /Contents {c} 0 R >>".encode()))
    base=f"<< /Type /XObject /Subtype /Image /Width {W} /Height {H} /BitsPerComponent 8"
    p1=np.asarray(photo(W,H));page([add(img(base+" /ColorSpace /DeviceRGB /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns 1800 >>",zlib.compress(png_rows(p1),6)))])
    page([add(img(base+" /ColorSpace /DeviceRGB /Filter /FlateDecode",zlib.compress(np.asarray(photo(W,H)).tobytes(),6)))])
    g=np.asarray(photo(W,H).convert("L"));page([add(img(base+" /ColorSpace /DeviceGray /Filter [/FlateDecode] /DecodeParms [<< /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns 1800 >>]",zlib.compress(png_rows(g[:,:,None]),6)))])
    yy,xx=np.mgrid[0:H,0:W];m=(255*np.clip(1.5-np.hypot(xx-W/2,yy-H/2)/(H/2),0,1)).astype(np.uint8)
    sm=add(img(f"<< /Type /XObject /Subtype /Image /Width {W} /Height {H} /BitsPerComponent 8 /ColorSpace /DeviceGray /Filter /FlateDecode",zlib.compress(m.tobytes(),6)))
    tiny=add(img("<< /Type /XObject /Subtype /Image /Width 32 /Height 32 /BitsPerComponent 8 /ColorSpace /DeviceRGB /Filter /FlateDecode",zlib.compress(np.asarray(photo(32,32)).tobytes() if False else rng.integers(0,255,32*32*3,dtype=np.uint8).tobytes())))
    pal=bytes(range(256))*3;idx=add(img(f"<< /Type /XObject /Subtype /Image /Width 400 /Height 400 /BitsPerComponent 8 /ColorSpace [/Indexed /DeviceRGB 255 <{pal[:768].hex()}>] /Filter /FlateDecode",zlib.compress(rng.integers(0,255,160000,dtype=np.uint8).tobytes())))
    page([add(img(base+f" /ColorSpace /DeviceRGB /SMask {sm} 0 R /Filter /FlateDecode",zlib.compress(np.asarray(photo(W,H)).tobytes(),6))),tiny,idx])
    objs[0]=b"<< /Type /Catalog /Pages 2 0 R >>";objs[1]=f"<< /Type /Pages /Kids [{' '.join(f'{p} 0 R' for p in pages)}] /Count {len(pages)} >>".encode()
    out=bytearray(b"%PDF-1.5\n");off=[]
    for i,o in enumerate(objs):off.append(len(out));out+=f"{i+1} 0 obj\n".encode()+o+b"\nendobj\n"
    x=len(out);out+=f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()+b"".join(f"{o:010d} 00000 n \n".encode() for o in off)
    out+=f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode();open(path,"wb").write(out)
pngpdf(f"{O}/png_images.pdf");open(f"{O}/empty.pdf","wb").close()
for f in sorted(os.listdir(O)):print(f,os.path.getsize(f"{O}/{f}"))
