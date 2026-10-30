"""Render two PDFs at 60dpi and print min SSIM (RGB render -> luma, per page) and max mean-RGB colour shift (poppler), then max shift under MuPDF. Usage: python3 pdf_visual.py A.pdf B.pdf"""
import sys,subprocess,tempfile,glob,numpy as np
from PIL import Image
def ren(p):
    d=tempfile.mkdtemp();subprocess.run(["pdftoppm","-r","60","-png",p,d+"/p"],check=True);return [np.asarray(Image.open(f).convert("L"),dtype=np.float64) for f in sorted(glob.glob(d+"/p*.png"))]
def ssim(a,b):
    from scipy.ndimage import uniform_filter as U
    C1,C2=6.5025,58.5225;ma,mb=U(a,7),U(b,7);va=U(a*a,7)-ma*ma;vb=U(b*b,7)-mb*mb;cv=U(a*b,7)-ma*mb
    return float((((2*ma*mb+C1)*(2*cv+C2))/((ma*ma+mb*mb+C1)*(va+vb+C2))).mean())
def col(p):
    d=tempfile.mkdtemp();subprocess.run(["pdftoppm","-r","20","-png",p,d+"/p"],check=True);return [np.asarray(Image.open(f).convert("RGB"),dtype=np.float64) for f in sorted(glob.glob(d+"/p*.png"))]
A,B=ren(sys.argv[1]),ren(sys.argv[2])
same=len(A)==len(B) and all(a.shape==b.shape for a,b in zip(A,B))
CA,CB=col(sys.argv[1]),col(sys.argv[2])
cd=max(float(np.abs(a.reshape(-1,3).mean(0)-b.reshape(-1,3).mean(0)).max()) for a,b in zip(CA,CB)) if same else 999
def mu(p):
    import pymupdf
    return [np.frombuffer(x.samples,np.uint8).reshape(-1,x.n)[:,:3].astype(np.float64).mean(0) for x in (pg.get_pixmap(dpi=20) for pg in pymupdf.open(p))]
try:
    MA,MB=mu(sys.argv[1]),mu(sys.argv[2]);md=max(float(np.abs(a-b).max()) for a,b in zip(MA,MB)) if len(MA)==len(MB) else 999
except ImportError: md=0
print(len(A),len(B),min(ssim(a,b) for a,b in zip(A,B)) if same else 0,cd,md)
