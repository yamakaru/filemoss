"""Post-build i18n: turns the English dist/ into /<lang>/ copies.
import warnings;from bs4 import MarkupResemblesLocatorWarning;warnings.filterwarnings("ignore",category=MarkupResemblesLocatorWarning)
Usage: python3 i18n.py SITE_NAME BASE_URL [--translate]
 - Without --translate it only uses the cached translations in i18n/<lang>.json (fails on misses).
 - With --translate it fills misses via the Kie Gemini chat API (KIE_API_KEY). --translate requires --max-credits N:
   the Kie balance is read before the run and after every batch; translation stops (cache saved, exit 3) before the spend reaches N.
 - --estimate: no API call, no key needed. Prints missing strings/characters per language and kind plus projected credits, then exits.
 Every --estimate/--translate run appends one row to $KIE_I18N_LOG (default /workspace/tasks/kie_i18n_log.csv). The key is never printed or logged."""
import os,re,sys,json,hashlib,glob,html as H,concurrent.futures as cf,urllib.request,time
from bs4 import BeautifulSoup,NavigableString,Comment
SITE_NAME,SITE=sys.argv[1],sys.argv[2].rstrip("/");TRANSLATE="--translate" in sys.argv;ESTIMATE="--estimate" in sys.argv
MAXC=float(sys.argv[sys.argv.index("--max-credits")+1]) if "--max-credits" in sys.argv else None
if TRANSLATE and MAXC is None:raise SystemExit("--translate requires --max-credits N (credit cap for this run)")
LOG=os.environ.get("KIE_I18N_LOG","/workspace/tasks/kie_i18n_log.csv");CREDIT_URL="https://api.kie.ai/api/v1/chat/credit"
RUN={"strings":0,"chars":0,"b0":None,"b1":None,"status":"ok","batches":0}
LANGS={"es":"Español","pt":"Português","fr":"Français","de":"Deutsch","it":"Italiano","id":"Bahasa Indonesia","vi":"Tiếng Việt","ja":"日本語"}
LNAME={"es":"Spanish (Latin American, neutral; e.g. 'concreto' not 'hormigón', 'calculadora de concreto', 'unir PDF', 'convertir JPG a PDF')","pt":"Brazilian Portuguese (e.g. 'calculadora de concreto', 'juntar PDF', 'converter JPG em PDF')","fr":"French (e.g. 'calcul béton', 'fusionner PDF', 'convertir JPG en PDF')","de":"German (e.g. 'Betonrechner', 'PDF zusammenfügen', 'JPG in PDF umwandeln')","it":"Italian (e.g. 'calcolo calcestruzzo', 'unire PDF', 'convertire JPG in PDF')","id":"Indonesian (e.g. 'kalkulator beton', 'gabungkan PDF', 'ubah JPG ke PDF')","vi":"Vietnamese (e.g. 'tính khối lượng bê tông', 'ghép file PDF', 'chuyển JPG sang PDF')","ja":"Japanese (e.g. 'コンクリート計算', 'PDF結合', 'JPG PDF 変換')"}
ALL=["en"]+list(LANGS)
CTX={"PorchMath":"PorchMath, a free home-improvement material calculator website (concrete, paint, flooring...). Measurements stay in US units (ft, in, sq ft, cu yd, lb, gallons) because formulas depend on them; keep unit abbreviations as-is.",
"FileMoss":"FileMoss, a free private browser-based office/file tools website (PDF merge, image converters, OCR, calculators)."}[SITE_NAME]
D="dist";os.makedirs("i18n",exist_ok=True)
TERMS=open("i18n_terms.txt",encoding="utf-8").read().strip() if os.path.exists("i18n_terms.txt") else ""
if TERMS:CTX=CTX+" "+TERMS
CACHE={l:(json.load(open(f"i18n/{l}.json")) if os.path.exists(f"i18n/{l}.json") else {}) for l in LANGS}
def hk(s):return hashlib.sha1(s.encode()).hexdigest()[:16]
INLINE={"a","b","i","em","strong","span","small","code","u","sup","sub","br","kbd","abbr","mark","s"}
SKIPTXT={"script","style","svg","noscript"}
TATTR=["placeholder","title","aria-label","alt"]
LETTER=re.compile(r"[^\W\d_]")
def has_text(s):return bool(LETTER.search(s))
def brand_only(t):return re.sub(r"\s+","",t) in ("PorchMath","FileMoss","PDF","JPG","PNG","HEIC","WEBP","CSV","JSON","QR","OCR","")
def skel(fr):
    s=BeautifulSoup(fr,"html.parser");out=[]
    for t in s.find_all(True):out.append(t.name+"|"+"|".join(f"{k}={v}" for k,v in sorted(t.attrs.items()) if k not in TATTR))
    return sorted(out)
# ---------- JS string literals
LIT=re.compile(r"""'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*\"""")
def js_lits(js):
    # skip regex literals and comments crudely: only quotes; good enough for our generated code
    return [(m.start(),m.end(),m.group(0)) for m in LIT.finditer(js)]
CODEISH=re.compile(r"^(?:[a-z][a-z0-9_-]*|[#.\[/].*|.*/.*|https?:.*|mailto:.*|tel:.*|[A-Za-z]{2}-[A-Z]{2}|\d.*|[A-Z_]+|[a-z]+[A-Z]\w*)$")
DISPLAY_LOWER={"sec","min","lower case","words"}
def lit_candidate(raw):
    q=raw[0];body=raw[1:-1]
    txt=re.sub(r"<[^>]*>","",body)
    if not has_text(txt):return False
    st=txt.strip()
    if st in DISPLAY_LOWER:return True
    if CODEISH.match(st) and " " not in st:return False
    if re.fullmatch(r"[\w-]+",st) and st.islower():return False
    if st in ("eng","canvas","image/png","Byte","Sheet1","recognizing text","check time"):return False
    if not body.lstrip().startswith('<') and re.search(r'="|style',body):return False
    if re.search(r'rgba\(|[{}]|join\(|^[#.;?\\]|\[|\w+\.(pdf|svg|png|txt|zip|json|csv|jpg)$|\w:\S*:|^\w:$|T\d\d:',body):return False
    return True
def esc_for(q,s):
    s=s.replace("\\","\\\\") if False else s
    return s.replace(q,"\\"+q).replace("\n","\\n")
def unesc(q,body):return body.replace("\\"+q,q).replace("\\n","\n")
# ---------- Kie budget (F1)
def balance():
    r=urllib.request.Request(CREDIT_URL,headers={"Authorization":"Bearer "+os.environ["KIE_API_KEY"]})
    return float(json.load(urllib.request.urlopen(r,timeout=30))["data"])
def log_run(mode,langs):
    import csv,datetime
    t=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).strftime("%Y-%m-%d %H:%M:%S +07")
    new=not os.path.exists(LOG);os.makedirs(os.path.dirname(LOG) or ".",exist_ok=True)
    with open(LOG,"a",newline="",encoding="utf-8") as f:
        w=csv.writer(f)
        if new:w.writerow(["time_asia_saigon","repo","mode","langs","strings","chars","balance_before","balance_after","credits_used","max_credits","status"])
        b0,b1=RUN["b0"],RUN["b1"];w.writerow([t,SITE_NAME,mode,"+".join(langs),RUN["strings"],RUN["chars"],"" if b0 is None else b0,"" if b1 is None else b1,"" if b0 is None or b1 is None else round(b0-b1,2),"" if MAXC is None else MAXC,RUN["status"]])
class BudgetStop(Exception):pass
# Projection used by --estimate: tokens ~ chars/3.5; input = source + ~600 prompt tokens per request; output = 1.3 x source
# tokens, times (1 + THINK) for model reasoning tokens. THINK=2 is calibrated on the 11/11 runs (see task notes).
THINK=2.0
def project(chars,reqs):
    tok=chars/3.5;inp=tok+600*reqs;out=tok*1.3*(1+THINK)
    return inp*100/1e6+out*700/1e6
# ---------- LLM
def llm(prompt,tries=4):
    for a in range(tries):
        try:
            req=urllib.request.Request("https://api.kie.ai/gemini-3.1-pro/v1/chat/completions",data=json.dumps({"messages":[{"role":"user","content":prompt}],"response_format":{"type":"json_object"}}).encode(),headers={"Authorization":"Bearer "+os.environ["KIE_API_KEY"],"Content-Type":"application/json"})
            r=json.load(urllib.request.urlopen(req,timeout=300))
            c=r["choices"][0]["message"]["content"].strip()
            c=re.sub(r"^```(?:json)?|```$","",c).strip()
            return json.loads(c)
        except Exception as e:
            print("llm retry",a,repr(e)[:200],flush=True);time.sleep(3+5*a)
    raise RuntimeError("llm failed")
def translate_batch(lang,items,kind):
    """items: dict id->source. returns id->translation (validated)."""
    rules={"html":"Each value is an HTML fragment. Translate only human-visible text and the attributes placeholder/title/aria-label/alt. Keep every tag and every other attribute (class, id, href, style, data-*) byte-identical; you may reorder inline tags if grammar requires. Keep &nbsp; and entities.",
           "text":"Each value is plain text (page title, meta description or attribute). Keep it concise; titles ≲60 chars, descriptions ≲160 chars when possible.",
           "js":"Each value is a JavaScript string literal's content shown to users in the UI (labels, result names, messages). Translate it. Preserve leading/trailing spaces and punctuation, any HTML tags, '%s'-like tokens, numbers and units. If a value is clearly a code token not meant for users, return it unchanged."}[kind]
    p=f"""You are a professional localizer for {CTX}
Translate the JSON values below from English into {LNAME[lang]}. Write natural, idiomatic, concise UI copy a native speaker would expect, using the terms people actually type into Google in that language (SEO). Keep brand names (PorchMath, FileMoss, Quikrete, Sakrete, Behr, USG, Sheetrock, Google, Microsoft Word, pdf-lib, pdf.js, SheetJS, Cloudflare, Amazon, AdSense, GitHub etc.), file format names (PDF, JPG, PNG, HEIC, WEBP, CSV, JSON, XLSX, QR), code examples (camelCase, snake_case, kebab-case, CONSTANT_CASE, PascalCase, aLtErNaTiNg) and email addresses unchanged. Keep numbers and units exactly. Do not add explanations.
{rules}
Return a JSON object with exactly the same keys and the translated strings as values.
{json.dumps(items,ensure_ascii=False)}"""
    out=llm(p);res={}
    for k,src in items.items():
        t=out.get(k)
        if not isinstance(t,str) or not t.strip():continue
        if kind=="html" and skel(src)!=skel(t):continue
        if kind=="js":
            lead=re.match(r"^\s*",src).group(0);trail=re.search(r"\s*$",src).group(0);t=lead+t.strip()+trail
            if skel(src)!=skel(t):continue
        res[k]=t
    return res
def fill(lang,need):
    """need: dict key->(kind,src)"""
    miss={k:v for k,v in need.items() if k not in CACHE[lang]}
    if not miss:return
    if not TRANSLATE:raise SystemExit(f"{lang}: {len(miss)} untranslated strings; run with --translate")
    RUN["strings"]+=len(miss);RUN["chars"]+=sum(len(v[1]) for v in miss.values())
    if RUN["b0"] is None:RUN["b0"]=RUN["b1"]=balance()
    for attempt in range(3):
        miss={k:v for k,v in need.items() if k not in CACHE[lang]}
        if not miss:break
        jobs=[]
        for kind in ("html","text","js"):
            ks=[k for k,v in miss.items() if v[0]==kind];cur=[];size=0
            for k in ks:
                cur.append(k);size+=len(miss[k][1])
                if len(cur)>=(40 if attempt==0 else 8) or size>6000:jobs.append((kind,cur));cur=[];size=0
            if cur:jobs.append((kind,cur))
        print(lang,"attempt",attempt,len(miss),"strings",len(jobs),"requests",flush=True)
        # Budget-aware scheduling: the first batch runs alone to measure cost; afterwards a batch is only started while
        # spent + average batch cost x (running batches + 1) stays below --max-credits, so the cap is not crossed.
        stop=False;done=0;queue=list(jobs);running={};ex=cf.ThreadPoolExecutor(4)
        while queue or running:
            spent=RUN["b0"]-RUN["b1"];avg=spent/RUN["batches"] if RUN["batches"] else None
            while queue and not stop and len(running)<(4 if RUN["batches"] else 1):
                if avg is not None and spent+avg*(len(running)+1)>=MAXC:stop=True;break
                kind,ks=queue.pop(0);running[ex.submit(translate_batch,lang,{k:miss[k][1] for k in ks},kind)]=1
            if not running:break
            fin,_=cf.wait(list(running),return_when=cf.FIRST_COMPLETED)
            for f in fin:
                running.pop(f)
                try:CACHE[lang].update(f.result())
                except Exception as e:print("batch fail",e)
                done+=1;RUN["batches"]+=1
            RUN["b1"]=balance()
        if stop:print(f"BUDGET STOP: spent {RUN['b0']-RUN['b1']:.2f} of {MAXC} credits; {len(queue)} batches not started",flush=True)
        ex.shutdown(wait=True)
        json.dump(CACHE[lang],open(f"i18n/{lang}.json","w"),ensure_ascii=False,indent=0,sort_keys=True)
        RUN["b1"]=balance()
        if stop or RUN["b0"]-RUN["b1"]>=MAXC:RUN["status"]="budget_stop";raise BudgetStop()
    left=[v for k,v in need.items() if k not in CACHE[lang]]
    if left:
        print(lang,"UNTRANSLATED (kept English):",len(left));[print("  ",x[0],x[1][:100]) for x in left[:10]]
# ---------- page processing
def pages():
    out=[]
    for f in glob.glob(D+"/**/*.html",recursive=True):
        rel=f[len(D)+1:]
        if rel.split("/")[0] in LANGS:continue
        out.append(rel)
    return sorted(out)
def path_of(rel):return "/" if rel in("index.html","404.html") else "/"+rel[:-len("index.html")]
def units(soup):
    found=[]
    for s in soup.find_all(string=True):
        if isinstance(s,Comment) or not has_text(s):continue
        if any(p.name in SKIPTXT for p in s.parents if p.name):continue
        if s.parent.name in("title","[document]","html","head"):continue
        e=s.parent
        while e.name in INLINE and e.parent and all((isinstance(c,NavigableString)) or c.name in INLINE or c.name=="svg" for c in e.parent.children) and e.parent.name not in("body","header","footer"):e=e.parent
        if not any(e is x for x in found):found.append(e)  # identity: bs4 Tag == compares content, so duplicate <option>s were skipped (FM-02)
    # drop units nested in other units
    fs=set(map(id,found));return [e for e in found if not any(id(p) in fs for p in e.parents)]
def inner(e):return e.decode_contents()
EXTJS=["ui.js","core.js"]
def collect_js(js):
    return [(a,b,r) for a,b,r in js_lits(js) if lit_candidate(r)]
def apply_js(js,lang):
    out=[];last=0
    for a,b,r in collect_js(js):
        q=r[0];src=unesc(q,r[1:-1]);t=CACHE[lang].get("j"+hk(src))
        out.append(js[last:a]);out.append(q+esc_for(q,t)+q if t else r);last=b
    out.append(js[last:]);return "".join(out)
def need_for_page(html_src,need):
    soup=BeautifulSoup(html_src,"html.parser")
    t=soup.title.string if soup.title else None
    if t:need["t"+hk(t)]=("text",t)
    for m in soup.find_all("meta"):
        if m.get("name")=="description" or m.get("property") in("og:title","og:description"):need["t"+hk(m["content"])]=("text",m["content"])
    for e in units(soup):
        fr=inner(e)
        if brand_only(e.get_text()):continue
        need["h"+hk(fr)]=("html",fr)
    for e in soup.find_all(True):
        for a in TATTR:
            if e.get(a) and has_text(e[a]) and not brand_only(e[a]):need["t"+hk(e[a])]=("text",e[a])
    for sc in soup.find_all("script"):
        if sc.get("src") or not sc.string:continue
        if sc.get("type")=="application/ld+json":
            j=json.loads(sc.string)
            for k in("name","description"):
                if k in j:need["t"+hk(j[k])]=("text",j[k])
            continue
        for a,b,r in collect_js(sc.string):src=unesc(r[0],r[1:-1]);need["j"+hk(src)]=("js",src)
def hreflang(path):
    return "".join(f'<link rel="alternate" hreflang="{l}" href="{SITE}{"" if l=="en" else "/"+l}{path}">' for l in ALL)+f'<link rel="alternate" hreflang="x-default" href="{SITE}{path}">'
LCSS="<style>.lsw{position:relative;margin-left:auto;margin-right:4px}.lsw summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:5px;padding:7px 9px;border:1px solid var(--line);border-radius:10px;font-size:13px;font-weight:600;color:var(--muted);white-space:nowrap}.lsw summary::-webkit-details-marker{display:none}.lsw[open] summary{color:var(--p);border-color:var(--p)}.lsw ul{position:absolute;right:0;top:calc(100% + 6px);background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,.12);list-style:none;margin:0;padding:6px;min-width:170px;z-index:50}.lsw li a{display:block;padding:8px 12px;border-radius:8px;color:var(--ink);text-decoration:none;font-size:14px}.lsw li a:hover,.lsw li a[aria-current]{background:var(--soft);color:var(--p)}header.top .w{gap:12px}@media(max-width:640px){.lsw summary{padding:6px 8px}}</style>"
GLOBE='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
def switcher(cur,path):
    return f"<details class='lsw'><summary aria-label='Language'>{GLOBE}{cur.upper()}</summary><ul>"+"".join(f"<li><a hreflang='{l}' lang='{l}' href='{'' if l=='en' else '/'+l}{path}'{' aria-current=\"true\"' if l==cur else ''}>{'English' if l=='en' else LANGS[l]}</a></li>" for l in ALL)+"</ul></details><script>(function(){var q=location.search+location.hash;if(q)document.querySelectorAll('.lsw li a').forEach(function(a){a.href=a.getAttribute('href')+q})})()</script>"
def add_common(html_src,lang,path):
    html_src=html_src.replace("</head>",hreflang(path)+LCSS+"</head>",1)
    return re.sub(r"(<header class=['\"]top['\"]><div class=['\"]w['\"]>.*?</a>)",lambda m:m.group(1)+switcher(lang,path),html_src,count=1,flags=re.S)
def localize(html_src,lang,path):
    C=CACHE[lang];soup=BeautifulSoup(html_src,"html.parser")
    soup.html["lang"]=lang
    if soup.title and soup.title.string:soup.title.string=C.get("t"+hk(soup.title.string),soup.title.string)
    for m in soup.find_all("meta"):
        if m.get("name")=="description" or m.get("property") in("og:title","og:description"):m["content"]=C.get("t"+hk(m["content"]),m["content"])
        if m.get("property")=="og:url":m["content"]=SITE+"/"+lang+path
    for l in soup.find_all("link",rel="canonical"):l["href"]=SITE+"/"+lang+path
    for e in units(soup):
        fr=inner(e);t=C.get("h"+hk(fr))
        if t:e.clear();e.append(BeautifulSoup(t,"html.parser"))
    for e in soup.find_all(True):
        for a in TATTR:
            if e.get(a) and ("t"+hk(e[a])) in C:e[a]=C["t"+hk(e[a])]
        if e.get("data-s"):
            e["data-s"]=(e.get_text(" ")+" "+e["data-s"]).lower()  # localized + English keywords both searchable
        h=e.get("href")
        if e.name=="a" and h and h.startswith("/") and not h.startswith("/assets/") and not e.get("hreflang"):e["href"]="/"+lang+h
    for sc in soup.find_all("script"):
        if sc.get("src"):
            b=sc["src"].rsplit("/",1)[-1]
            if b in EXTJS:sc["src"]=f"/assets/{lang}/{b}"
            continue
        if not sc.string:continue
        if sc.get("type")=="application/ld+json":
            j=json.loads(sc.string)
            for k in("name","description"):
                if k in j:j[k]=C.get("t"+hk(j[k]),j[k])
            if "url" in j:j["url"]=j["url"].replace(SITE,SITE+"/"+lang,1)
            j["inLanguage"]=lang;sc.string=json.dumps(j,ensure_ascii=False);continue
        sc.string=apply_js(sc.string,lang)
    return add_common(str(soup),lang,path)
if __name__=="__main__":
    _av=sys.argv[3:];_av=[a for j,a in enumerate(_av) if not(j and _av[j-1]=="--max-credits")]
    langs=[a for a in _av if not a.startswith("--")] or list(LANGS)
    P=pages();src={p:open(f"{D}/{p}").read() for p in P}
    need={}
    for p in P:need_for_page(src[p],need)
    ext={b:open(f"{D}/assets/{b}").read() for b in EXTJS if os.path.exists(f"{D}/assets/{b}")}
    for b,js in ext.items():
        for a,c,r in collect_js(js):s=unesc(r[0],r[1:-1]);need["j"+hk(s)]=("js",s)
    print(len(P),"pages",len(need),"unique strings")
    if ESTIMATE:
        tot=0
        for lang in langs:
            miss={k:v for k,v in need.items() if k not in CACHE[lang]};row=[]
            for kind in ("html","text","js"):
                m=[v[1] for v in miss.values() if v[0]==kind];row.append(f"{kind} {len(m)} strings/{sum(map(len,m))} chars")
            ch=sum(len(v[1]) for v in miss.values());reqs=sum(1 for _ in range(0,len(miss),40))+3;cr=project(ch,reqs) if miss else 0;tot+=cr
            RUN["strings"]+=len(miss);RUN["chars"]+=ch
            print(f"{lang}: {len(miss)} missing, {ch} chars ({'; '.join(row)}); projected ~{cr:.1f} credits")
        print(f"TOTAL: {RUN['strings']} strings, {RUN['chars']} chars, projected ~{tot:.1f} credits (no API call made)")
        RUN["status"]=f"estimate~{tot:.1f}";log_run("estimate",langs);sys.exit(0)
    try:
        for lang in langs:fill(lang,need)
    except BudgetStop:
        log_run("translate",langs);print(f"stopped by --max-credits {MAXC}: used {RUN['b0']-RUN['b1']:.2f} credits; partial cache saved");sys.exit(3)
    if TRANSLATE:log_run("translate",langs);print(f"Kie credits used: {(RUN['b0'] or 0)-(RUN['b1'] or 0):.2f} (balance {RUN['b1']})")
    for lang in langs:
        for p in P:
            o=f"{D}/{lang}/{p}";os.makedirs(os.path.dirname(o),exist_ok=True)
            open(o,"w").write(localize(src[p],lang,path_of(p)))
        for b,js in ext.items():
            os.makedirs(f"{D}/assets/{lang}",exist_ok=True);open(f"{D}/assets/{lang}/{b}","w").write(apply_js(js,lang))
    for p in P:open(f"{D}/{p}","w").write(add_common(src[p],"en",path_of(p)))
    # sitemaps: index + one per language with hreflang alternates
    urls=[path_of(p) for p in P if p!="404.html"]
    sm=lambda l:'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+"".join(f"<url><loc>{SITE}{'' if l=='en' else '/'+l}{u}</loc>"+"".join(f'<xhtml:link rel="alternate" hreflang="{x}" href="{SITE}{"" if x=="en" else "/"+x}{u}"/>' for x in ALL)+f'<xhtml:link rel="alternate" hreflang="x-default" href="{SITE}{u}"/></url>' for u in urls)+"</urlset>"
    for l in ALL:open(f"{D}/sitemap-{l}.xml","w").write(sm(l))
    open(f"{D}/sitemap.xml","w").write('<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+"".join(f"<sitemap><loc>{SITE}/sitemap-{l}.xml</loc></sitemap>" for l in ALL)+"</sitemapindex>")
    print("i18n done",langs)
