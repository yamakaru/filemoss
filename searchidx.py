# Post-build: give every tool card both EN and VI titles/keywords (data-x / data-k) so search works in either language on every page.
import os,re,glob,html
from bs4 import BeautifulSoup
def cards(p):
    s=BeautifulSoup(open(p,encoding="utf-8").read(),"html.parser");out={}
    for a in s.select("a.card[href]"):
        slug=a["href"].strip("/").split("/")[-1];h=a.find("h3")
        if not h:continue
        out[slug]=(h.get_text(" ",strip=True),a.get_text(" ",strip=True))
    return out
EN,VI=cards("dist/index.html"),cards("dist/vi/index.html")
TAG=re.compile(r"<a\b[^>]*\bclass=(['\"])card\1[^>]*>")
for f in glob.glob("dist/**/*.html",recursive=True):
    h=open(f,encoding="utf-8").read()
    def add(m):
        t=m.group(0)
        if "data-x=" in t:return t
        hr=re.search(r"href=(['\"])([^'\"]*)\1",t)
        slug=hr.group(2).strip("/").split("/")[-1] if hr else ""
        if slug not in EN:return t
        e,v=EN[slug],VI.get(slug,("",""))
        return t[:-1]+' data-x="%s" data-k="%s">'%(html.escape(e[0]+" "+v[0]),html.escape(e[1]+" "+v[1]))
    n=TAG.sub(add,h)
    if n!=h:open(f,"w",encoding="utf-8").write(n)
print("searchidx: EN",len(EN),"VI",len(VI))
