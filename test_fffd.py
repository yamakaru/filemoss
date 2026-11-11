# T11-26: the replacement character U+FFFD in the CSV tools' warning and guide must survive translation and build.
import os,sys
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'dist');f=0
for t in ['merge-csv','remove-duplicate-rows']:
    en=open(os.path.join(D,t,'index.html'),encoding='utf-8').read().count('\ufffd')
    for l in ['es','pt','fr','de','it','id','vi','ja']:
        n=open(os.path.join(D,l,t,'index.html'),encoding='utf-8').read().count('\ufffd')
        if n!=en or en<1: f+=1;print('FAIL',l,t,'U+FFFD count',n,'en',en)
print('U+FFFD check', 'FAIL' if f else 'OK', f);sys.exit(1 if f else 0)
