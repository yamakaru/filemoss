"""Normalize bundled fonts for pdf-lib/fontkit subsetting: 4-byte glyf padding (fontkit's subsetter
corrupts glyphs from 2-byte-padded glyf tables -> dropped glyphs, FM-01) and correct Regular names (FM-04)."""
import sys
from fontTools.ttLib import TTFont
for f,fam in [('fonts/NotoSansJP-sub.ttf','Noto Sans JP'),('fonts/NotoSans-sub.ttf','Noto Sans')]:
    t=TTFont(f);t['glyf'].padding=4
    for n in t.getGlyphOrder():t['glyf'][n].expand(t['glyf'])
    nm=t['name']
    for r in list(nm.names):
        if r.nameID in(2,17):nm.setName('Regular',r.nameID,r.platformID,r.platEncID,r.langID)
        if r.nameID in(4,):nm.setName(fam+' Regular',4,r.platformID,r.platEncID,r.langID)
        if r.nameID==6:nm.setName(fam.replace(' ','')+'-Regular',6,r.platformID,r.platEncID,r.langID)
        if r.nameID==16:nm.setName(fam,16,r.platformID,r.platEncID,r.langID)
        if r.nameID==1:nm.setName(fam,1,r.platformID,r.platEncID,r.langID)
    t['OS/2'].usWeightClass=400;t.save(f);print(f,'ok')
