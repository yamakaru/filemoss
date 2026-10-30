import sys,json
from playwright.sync_api import sync_playwright
# Usage: python3 test_search_ux.py [FILEMOSS_BASE] [PORCHMATH_BASE]  (default: live sites; serve dist/ locally to test before deploy)
FM,PM=(sys.argv[1:3]+["https://filemoss.com/","https://porchmath.com/"][len(sys.argv[1:3]):])[:2];E="?evtest=1";bad=0
S=[(FM+"vi/","ghép pdf",True),(FM+"vi/","ghep pdf",True),(FM,"imgae",True),(PM+"vi/","be tong",True),(PM+"vi/","bê tông",True),(PM,"gạch",False),(FM,"merge",True),(FM,"compress pdf",False),(FM+"vi/","nén pdf",False),(PM,"concret",True),(FM,"ocr",True)]
SM="""()=>{const t=[...document.querySelectorAll('a,button,input:not([type=file]),select,summary,label[for]:not(.sr),[role=button]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!='hidden'});return t.filter(e=>{const r=e.getBoundingClientRect();return r.height<44||r.width<44}).map(e=>{const r=e.getBoundingClientRect();return e.tagName+' "'+(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,15)+'" '+Math.round(r.width)+'x'+Math.round(r.height)})}"""
with sync_playwright() as p:
  b=p.chromium.launch();pg=b.new_page();errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
  for u,q,exp in S:
    pg.goto(u+E);pg.type('#q',q,delay=20);pg.wait_for_timeout(300)
    r=pg.evaluate("()=>[[...document.querySelectorAll('#all .card')].filter(c=>!c.hidden).map(c=>c.querySelector('h3').innerText),!document.getElementById('none').hidden]")
    ok=(len(r[0])>0)==exp and r[1]==(not exp); bad+=not ok
    print('OK ' if ok else 'BAD',u,q,r[0][:4],'msg' if r[1] else '')
  for w in (360,390,820):
    m=b.new_page(viewport={'width':w,'height':800},is_mobile=True,has_touch=True)
    for u in [FM,FM+"vi/",PM,PM+"vi/",FM+"merge-pdf/",PM+"concrete-calculator/",PM+"vi/concrete-calculator/"]:
      m.goto(u+E);s=m.evaluate(SM);sw=m.evaluate("document.documentElement.scrollWidth");bad+=bool(s)+(sw>w)
      print(w,u,'small',s[:6],'overflow' if sw>w else '')
    m.goto(FM+"merge-pdf/"+E);m.set_input_files("input[type=file]",["/workspace/test_fixtures/pdf/standard_10p.pdf","/workspace/test_fixtures/pdf/single_page.pdf"]);m.wait_for_timeout(1500)
    s=m.evaluate(SM);bad+=bool(s);print(w,'merge after files small',s[:8])
  print("js errors",errs);print("BAD COUNT",bad);sys.exit(1 if bad or errs else 0)
