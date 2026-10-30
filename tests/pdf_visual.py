"""Render two PDFs at 60dpi and print min SSIM (grayscale, per page). Usage: python3 pdf_visual.py A.pdf B.pdf"""
import sys,subprocess,tempfile,glob,numpy as np
from PIL import Image
def ren(p):
    d=tempfile.mkdtemp();subprocess.run(["pdftoppm","-r","60","-gray","-png",p,d+"/p"],check=True);return [np.asarray(Image.open(f),dtype=np.float64) for f in sorted(glob.glob(d+"/p*.png"))]
def ssim(a,b):
    from scipy.ndimage import uniform_filter as U
    C1,C2=6.5025,58.5225;ma,mb=U(a,7),U(b,7);va=U(a*a,7)-ma*ma;vb=U(b*b,7)-mb*mb;cv=U(a*b,7)-ma*mb
    return float((((2*ma*mb+C1)*(2*cv+C2))/((ma*ma+mb*mb+C1)*(va+vb+C2))).mean())
A,B=ren(sys.argv[1]),ren(sys.argv[2])
print(len(A),len(B),min(ssim(a,b) for a,b in zip(A,B)) if len(A)==len(B) and all(a.shape==b.shape for a,b in zip(A,B)) else 0)
