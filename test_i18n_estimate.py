"""T11-02 regression: --estimate on an already-built dist must not count the language switcher / hreflang links that
add_common() injected into the English pages. Checks every English page of dist/: strip_common() exactly undoes
add_common(), and the strings counted on the built page equal those counted on the clean page. No network, no key.
Usage: python3 test_i18n_estimate.py SITE_NAME BASE_URL   (run from the repo root, after a build)"""
import sys,runpy,os,glob
site,base=sys.argv[1],sys.argv[2]
sys.argv=["i18n.py",site,base]
G=runpy.run_path("i18n.py",run_name="i18n_test")
bad=0;n=0
for p in G["pages"]():
    built=open(f"dist/{p}",encoding="utf-8").read();path=G["path_of"](p);n+=1
    clean=G["strip_common"](built)
    if "<details class='lsw'>" in clean or 'hreflang="x-default"' in clean:bad+=1;print("BAD still has switcher",p);continue
    # (404 has its hreflang links removed later by seo_post, so the exact round-trip is checked only where they exist)
    if 'hreflang="x-default"' in built and G["add_common"](clean,"en",path)!=built:bad+=1;print("BAD round-trip",p);continue
    a={};c={};G["need_for_page"](clean,a);G["need_for_page"](G["strip_common"](G["add_common"](clean,"en",path)),c)
    if set(c)!=set(a):bad+=1;print("BAD count differs",p,len(a),len(c))
print(n,"pages","BAD",bad);sys.exit(1 if bad else 0)
