"""Checks PDF→Word output with python-docx and a LibreOffice round trip. Usage: check_docx.py OUTDIR"""
import sys,glob,os,subprocess,docx,tempfile
D=sys.argv[1];ok=1
def chk(c,m):
    global ok
    print(('PASS ' if c else 'FAIL ')+m);ok&=bool(c)
for f in sorted(glob.glob(D+'/*.docx')):
    d=docx.Document(f);n=os.path.basename(f);txt='\n'.join(p.text for p in d.paragraphs);heads=[p.text for p in d.paragraphs if p.style.name.startswith('Heading')]
    imgs=len(d.inline_shapes);tabs=d.tables
    if 'vi_contract' in n:
        chk('Hợp đồng dịch vụ thiết kế' in heads,n+' H1 with diacritics '+repr(heads[:2]))
        chk(any('Điều 2' in h for h in heads),n+' H2 Điều 2')
        chk('Nguyễn Văn Đức' in txt and 'thỏa thuận' in txt and 'Tòa án có thẩm quyền' in txt,n+' Vietnamese body text')
        chk(tabs and len(tabs[0].rows)==4 and len(tabs[0].columns)==4 and tabs[0].cell(1,0).text=='Thiết kế logo' and tabs[0].cell(3,3).text=='2.500.000',n+' table 4x4')
        chk(imgs>=1,n+' image count %d'%imgs)
    if 'en_report' in n:
        chk('Quarterly Report' in heads,n+' H1');chk(tabs and tabs[0].cell(2,0).text=='Europe',n+' table');chk(imgs>=1,n+' image')
    if 'scan' in n:chk(imgs>=1 and len(txt.strip())==0,n+' scan → image only')
    t=tempfile.mkdtemp();r=subprocess.run(['soffice','--headless','--convert-to','pdf','--outdir',t,f],capture_output=True,timeout=120)
    p=glob.glob(t+'/*.pdf');chk(p and os.path.getsize(p[0])>1000,n+' LibreOffice opens & re-exports PDF')
    if p and 'vi_contract' in n:
        o=subprocess.run(['pdftotext',p[0],'-'],capture_output=True,text=True).stdout;chk('Nguyễn Văn Đức' in o,n+' round-trip text keeps diacritics')
sys.exit(0 if ok else 1)
