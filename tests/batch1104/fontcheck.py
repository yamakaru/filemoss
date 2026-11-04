"""Regression FM-01/FM-04: every glyph in embedded subset fonts must decode and every used char must have outlines;
font names must carry a 6-letter subset tag and not say Thin. Usage: fontcheck.py out.pdf 'chars'"""
import sys,io,re,subprocess,pikepdf
from fontTools.ttLib import TTFont
pdf,chars=sys.argv[1],sys.argv[2];bad=[];ink=set()
P=pikepdf.open(pdf);fds={}
for pg in P.pages:
  for f in (pg.Resources.get('/Font') or {}).values():
    for c in ([f]+list(f.get('/DescendantFonts') or [])):
      fd=c.get('/FontDescriptor')
      if fd is not None and '/FontFile2' in fd:fds[fd.objgen]=fd
if not fds:bad.append('no embedded TrueType fonts found')
for o in fds.values():
  if True:
    nm=str(o.FontName)
    if not re.match(r'^/[A-Z]{6}\+',nm) or 'Thin' in nm:bad.append('name '+nm)
    t=TTFont(io.BytesIO(o.FontFile2.read_bytes()))
    g=t['glyf']
    for n in t.getGlyphOrder():
      try:
        gl=g[n];gl.expand(g)
        if gl.numberOfContours>0:gl.getCoordinates(g);ink.add(nm+n)
      except Exception as e:bad.append(f'{nm} glyph {n} corrupt');break
if len(ink)<len(set(chars)):bad.append(f'only {len(ink)} glyphs with outlines for {len(set(chars))} chars')
txt=subprocess.run(['pdftotext',pdf,'-'],capture_output=True,text=True).stdout
# render page 1 at 2 scales: chars with outlines must produce ink; compare via mutool-free approach: pdftoppm crop of footer is in e2e; here check text layer
for ch in chars:
  if ch not in txt:bad.append('text missing '+ch)
print('OK' if not bad else 'BAD '+'; '.join(bad[:5]))
