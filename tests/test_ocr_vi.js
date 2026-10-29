// /vi/ OCR regression: default language, Vietnamese diacritics, localized status lines. Needs dist served on :8811 or B env.
const {chromium}=require('playwright-core'),http=require('http'),fs=require('fs'),path=require('path');
const DIST=path.join(__dirname,'../dist');
const srv=http.createServer((q,r)=>{let f=path.join(DIST,decodeURIComponent(q.url.split('?')[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.png':'image/png'}[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)}).listen(0);
(async()=>{const B='http://localhost:'+srv.address().port;const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage();const st=[],errs=[];p.on('pageerror',e=>errs.push(e.message));let fail=0;const ok=(m,c)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fail++};
await p.goto(B+'/vi/image-to-text/');ok('vi default OCR language is vie',await p.$eval('#ol',e=>e.value)==='vie');ok('vie+eng offered',await p.$('#ol option[value="vie+eng"]')!=null);
await p.exposeFunction('rec',s=>st.push(s));await p.evaluate(()=>new MutationObserver(()=>rec(document.querySelector('#status').textContent)).observe(document.querySelector('#status'),{childList:true,subtree:true,characterData:true}));
await p.setInputFiles('#drop input',path.join(__dirname,'samples/ocr_vi.png'));await p.waitForSelector('#res:not([hidden])',{timeout:120000});const t=await p.$eval('#txt',e=>e.value);console.log('     text:',t);
ok('Vietnamese lowercase diacritics exact',t.includes('Tiếng Việt: ăâđêôơư'));ok('uppercase ỢỨ',t.includes('ỢỨ'));
ok('status lines localized (no English Tesseract status)',st.length>0&&!st.some(s=>/traineddata|recognizing|Loading|Reading| of /.test(s)));ok('no JS errors',errs.length==0);
await b.close();srv.close();console.log(fail?fail+' OCR-vi tests failed':'ocr-vi: all tests passed');process.exit(fail?1:0)})();
