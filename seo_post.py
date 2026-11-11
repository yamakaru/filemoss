"""SEO post-processing on dist/ (runs last in build.py, after i18n.py and searchidx.py).
S2 <lastmod> in sitemaps via lastmod.json · S3 BreadcrumbList (tool pages) + Organization (home pages) JSON-LD
S5 404 bodies: noindex, no canonical/hreflang/JSON-LD · S6 dist/llms.txt
No new strings go through i18n; nothing here calls a translation API."""
import os,re,json,glob,hashlib,subprocess,datetime
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup
exec(open("config.py").read())
SITE=os.environ.get("BASE_URL",BASE_URL).rstrip("/")
D="dist";LANGS=["es","pt","fr","de","it","id","vi","ja"];NONTOOL={"about","privacy","contact"}
TODAY=datetime.datetime.now(ZoneInfo("Asia/Saigon")).date().isoformat()
def rd(p):return open(p,encoding="utf-8").read()
def wr(p,s):open(p,"w",encoding="utf-8").write(s)
def ldtag(obj):return '<script type="application/ld+json">'+json.dumps(obj,ensure_ascii=False).replace("</","<\\/")+'</script>'
def add_ld(h,obj):
    """insert after the last existing JSON-LD block (or before </head>); idempotent per @type"""
    if re.search(r'<script type="application/ld\+json">[^<]*"@type": ?"%s"'%obj["@type"],h):return h
    ms=list(re.finditer(r'<script type="application/ld\+json">.*?</script>',h,re.S))
    i=ms[-1].end() if ms else h.index("</head>")
    return h[:i]+ldtag(obj)+h[i:]
def file_of(url):return D+(url[len(SITE):] or "/")+"index.html"
def is_tool(url):
    s=[x for x in url[len(SITE):].split("/") if x]
    if s and s[0] in LANGS:s=s[1:]
    return len(s)==1 and s[0] not in NONTOOL
# ---------------- S5: 404 bodies (status is already 404 via Pages)
def fix_404():
    fs=[f"{D}/404.html"]+[f"{D}/{l}/404.html" for l in LANGS if os.path.exists(f"{D}/{l}/404.html")]
    for f in fs:
        h=rd(f)
        h=re.sub(r'<link[^>]*rel="canonical"[^>]*/?>','',h)
        h=re.sub(r'<link[^>]*hreflang=[^>]*/?>','',h)
        h=re.sub(r'<script type="application/ld\+json">.*?</script>','',h,flags=re.S)
        h=re.sub(r'<meta[^>]*property="og:url"[^>]*/?>','',h)
        if 'name="robots"' not in h:h=re.sub(r"(</title>)",r'\1<meta name="robots" content="noindex">',h,count=1)
        head=h.split("</head>")[0]
        assert "canonical" not in head and "hreflang=" not in head and "ld+json" not in h and "noindex" in head,f
        wr(f,h)
    return len(fs)
# ---------------- sitemap URLs
def sitemap_files():return [f"{D}/sitemap-{l}.xml" for l in ["en"]+LANGS]
def sitemap_urls():
    out=[]
    for f in sitemap_files():out+=re.findall(r"<url><loc>([^<]+)</loc>",rd(f))
    return out
# ---------------- S3: JSON-LD
def schema(urls):
    crumbs=orgs=0
    for u in urls:
        f=file_of(u);h=rd(f);s=BeautifulSoup(h,"html.parser")
        nav=s.find("nav",class_="crumb")
        if nav and is_tool(u):
            a=nav.find("a");can=s.find("link",rel="canonical")["href"];h1=s.find("h1").get_text(" ",strip=True)
            home=a["href"];home=SITE+home if home.startswith("/") else home
            h=add_ld(h,{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
                {"@type":"ListItem","position":1,"name":a.get_text(" ",strip=True),"item":home},
                {"@type":"ListItem","position":2,"name":h1,"item":can}]});crumbs+=1
        if f==f"{D}/index.html" or re.fullmatch(rf"{D}/[a-z]{{2}}/index.html",f):
            h=add_ld(h,{"@context":"https://schema.org","@type":"Organization","@id":SITE+"/#org","name":SITE_NAME,"url":SITE+"/"});orgs+=1
        wr(f,h)
    return crumbs,orgs
# ---------------- S2: lastmod
def content_hash(h):
    h=re.sub(r"<script\b.*?</script>","",h,flags=re.S|re.I);h=re.sub(r"<style\b.*?</style>","",h,flags=re.S|re.I)
    h=re.sub(r"\?v=[0-9a-f]{10}","",h)  # asset cache-busting hashes are not content
    m=re.search(r"<main[\s>].*?</main>",h,re.S)
    if m:body=m.group(0)
    else:  # home pages have no <main>: body minus header/footer
        b=re.search(r"<body[^>]*>(.*)</body>",h,re.S).group(1)
        body=re.sub(r"<footer\b.*?</footer>","",re.sub(r"<header\b.*?</header>","",b,flags=re.S),flags=re.S)
    s=BeautifulSoup(h,"html.parser")
    t=s.title.get_text() if s.title else ""
    md=s.find("meta",attrs={"name":"description"});d=md["content"] if md else ""
    return hashlib.sha256((t+"\n"+d+"\n"+body).encode()).hexdigest()
def git_date(f):
    """seed: latest commit date of the dist file (dist/ is untracked in this repo -> usually none)"""
    try:return subprocess.run(["git","log","-1","--format=%cs","--",f],capture_output=True,text=True).stdout.strip() or None
    except Exception:return None
def lastmod(urls):
    path="lastmod.json";db=json.load(open(path)) if os.path.exists(path) else {}
    new={};changed=0
    for u in urls:
        key=u[len(SITE):] or "/";hs=content_hash(rd(file_of(u)))
        if key in db and db[key][0]==hs:new[key]=db[key];continue
        if key in db:day=TODAY;changed+=1
        else:day=min((git_date(file_of(u)) if not db else None) or TODAY,TODAY)
        new[key]=[hs,day]
    json.dump(new,open(path,"w"),indent=0,sort_keys=True);open(path,"a").write("\n")
    for f in sitemap_files():
        x=rd(f)
        x=re.sub(r"<lastmod>[^<]*</lastmod>","",x)
        x=re.sub(r"(<url><loc>([^<]+)</loc>)",lambda m:m.group(1)+"<lastmod>"+new[m.group(2)[len(SITE):] or "/"][1]+"</lastmod>",x)
        wr(f,x)
    return changed
# ---------------- S6: llms.txt
def llms(urls):
    def meta(f):
        s=BeautifulSoup(rd(f),"html.parser");md=s.find("meta",attrs={"name":"description"})
        return s.find("h1").get_text(" ",strip=True) if s.find("h1") else "",(md["content"] if md else "").strip()
    _,hd=meta(f"{D}/index.html")
    tools=[u for u in urls if is_tool(u) and not re.match(re.escape(SITE)+r"/(%s)/"%"|".join(LANGS),u)]
    L=[f"# {SITE_NAME}","",f"> {hd}","","All tools run in the browser; files are not uploaded.","","## Tools",""]
    for u in tools:
        h1,d=meta(file_of(u));L.append(f"- [{h1}]({u}): {d}")
    L+=["","## About","",f"- [About]({SITE}/about/): what FileMoss is and how the tools work",f"- [Privacy Policy]({SITE}/privacy/)",f"- [Contact]({SITE}/contact/)","",
        "Other languages: "+" ".join(f"[/{l}/]({SITE}/{l}/)" for l in LANGS),""]
    wr(f"{D}/llms.txt","\n".join(L));return len(tools)
if __name__=="__main__":
    n404=fix_404();urls=sitemap_urls()
    c,o=schema(urls);ch=lastmod(urls);n=llms(urls)
    print(f"seo_post: {n404} 404 pages, {len(urls)} sitemap URLs, {c} breadcrumbs, {o} Organization, lastmod changed {ch}, llms.txt {n} tools")
