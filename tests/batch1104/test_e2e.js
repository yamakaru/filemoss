// E2E for add-page-numbers-to-pdf, unlock-pdf, pdf-to-excel (en + vi), overflow at 375/390.
const {chromium}=require('playwright-core'),http=require('http'),fs=require('fs'),path=require('path');
const {PDFDocument}=require('pdf-lib'),XLSX=require('xlsx');
const DIST=path.join(__dirname,'../../dist'),S=__dirname,OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{if(q.url.startsWith('/api/')){r.writeHead(204);return r.end()}let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(DIST,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
let n=0,fail=0;const ok=(name,c,info)=>{n++;if(!c){fail++;console.log('FAIL',name,info===undefined?'':JSON.stringify(info))}else console.log('ok  ',name)};
(async()=>{await new Promise(r=>srv.listen(8766,r));const B='http://localhost:8766';
const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const ctx=await br.newContext({acceptDownloads:true});
async function open(u){const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.goto(B+u+'?evtest=1');return p}
const files=(p,l)=>p.setInputFiles('#drop input',l.map(f=>path.join(S,f)));
async function dl(p,i=0){await p.waitForSelector('.fileout button',{timeout:60000});const [d]=await Promise.all([p.waitForEvent('download'),p.locator('.fileout button').nth(i).click()]);const f=path.join(OUT,d.suggestedFilename());await d.saveAs(f);return [fs.readFileSync(f),d.suggestedFilename()]}
const st=p=>p.textContent('#status');
const waitSt=(p,re)=>p.waitForFunction(r=>new RegExp(r).test(document.querySelector('#status').textContent),re.source,{timeout:60000});
// overflow
for(const L of ['','/vi','/ja','/de'])for(const s of ['add-page-numbers-to-pdf','unlock-pdf','pdf-to-excel'])for(const w of [375,390]){const p=await ctx.newPage();await p.setViewportSize({width:w,height:800});await p.goto(B+L+'/'+s+'/?evtest=1');const sw=await p.evaluate(()=>document.documentElement.scrollWidth);ok(`overflow ${L||'/en'}/${s} @${w}`,sw<=w,sw);await p.close()}
// page numbers
let p=await open('/add-page-numbers-to-pdf/');await files(p,['ten.pdf']);await p.click('#go');let [b,name]=await dl(p);let d=await PDFDocument.load(b);ok('numbers: 10 pages, name',d.getPageCount()==10&&name=='ten-numbered.pdf',name);ok('numbers: title kept',d.getTitle()=='Hop dong');ok('numbers: no errors',!p.errs.length,p.errs);
{const {execFileSync}=require('child_process');const q=await open('/ja/add-page-numbers-to-pdf/');await files(q,['ten.pdf']);await q.fill('#ft','ありがとう');await q.click('#go');const [jb]=await dl(q);const jf=path.join(OUT,'ja-numbered.pdf');fs.writeFileSync(jf,jb);const r=execFileSync('python3',[path.join(S,'fontcheck.py'),jf,'ページありがとう']).toString().trim();ok('FM-01 ja glyphs intact + FM-04 subset tag',r=='OK',r);
execFileSync('pdftoppm',['-r','40','-f','1','-l','1','-png',jf,path.join(OUT,'ja')]);await q.close();}
for(const L of ['es','pt','fr','de','it','id','vi','ja']){const h=fs.readFileSync(path.join(DIST,L,'add-page-numbers-to-pdf/index.html'),'utf8');ok('FM-02 options translated '+L,!/>(Bottom|Top) (left|center|right)</.test(h))}
await p.fill('#rng','abc');await p.click('#go');await p.waitForTimeout(500);ok('numbers: bad range msg',/not a page/.test(await st(p)),await st(p));
await p.fill('#rng','12');await p.click('#go');await p.waitForTimeout(500);ok('numbers: range over msg',/beyond/.test(await st(p)),await st(p));await p.close();
p=await open('/add-page-numbers-to-pdf/');await files(p,['ten.pdf','broken.pdf','aes256.pdf']);await p.click('#go');[b,name]=await dl(p);ok('numbers: good file still output',name=='ten-numbered.pdf',name);ok('numbers: per-file errors shown',/broken.pdf/.test(await p.textContent('#out'))&&/aes256.pdf/.test(await p.textContent('#out')),await p.textContent('#out'));await p.close();
p=await open('/vi/add-page-numbers-to-pdf/');await files(p,['zero.pdf']);await p.waitForTimeout(800);ok('vi numbers: empty msg vi',/rỗng/.test(await st(p)),await st(p));await files(p,['fake.pdf']);await p.waitForTimeout(800);ok('vi numbers: fake msg vi',/không phải/.test(await st(p)),await st(p));await p.close();
// unlock
for(const [f,pw] of [['owner.pdf',null],['aes256.pdf','u'],['rc4_40.pdf','u'],['vi.pdf','mậtkhẩu 1']]){p=await open('/unlock-pdf/');await files(p,[f]);
 if(pw){await p.waitForSelector('#pw',{state:'visible',timeout:60000});await p.fill('#pw','wrong');await p.click('#go');await waitSt(p,/Wrong password/);ok('unlock: wrong pw '+f,true);await p.fill('#pw',pw);await p.click('#go')}
 [b,name]=await dl(p);d=await PDFDocument.load(b);ok('unlock: '+f+' → '+name,d.getPageCount()==10&&!d.isEncrypted,name);ok('unlock no errors '+f,!p.errs.length,p.errs);await p.close()}
p=await open('/unlock-pdf/');await files(p,['ten.pdf']);await waitSt(p,/nothing to unlock/);ok('unlock: none',true);await files(p,['trunc_enc.pdf']);await waitSt(p,/damaged/);ok('unlock: damaged + clean state',(await p.$$('.fileout')).length==0);await p.close();
p=await open('/vi/unlock-pdf/');await files(p,['aes128.pdf']);await waitSt(p,/cần mật khẩu/);ok('vi unlock needpw',true);ok('vi never crack note',/không bao giờ dò, bẻ/.test(await p.textContent('main')));await p.close();
// excel
p=await open('/pdf-to-excel/');await files(p,['stmt.pdf']);await p.click('#go');[b,name]=await dl(p);const wb=XLSX.read(b);const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true});
let nums=0;rows.forEach(r=>r.forEach(c=>{if(typeof c=='number')nums++}));ok('excel: xlsx with numbers '+name,nums>10,nums);ok('excel: NFC',rows.flat().every(c=>typeof c!='string'||c==c.normalize('NFC')));ok('excel no errors',!p.errs.length,p.errs);await p.close();
p=await open('/pdf-to-excel/');await files(p,['scan.pdf']);await p.click('#go').catch(()=>{});await waitSt(p,/scanned/);ok('excel: scan msg',true);await p.close();
p=await open('/vi/pdf-to-excel/');await files(p,['scan.pdf']);await p.click('#go').catch(()=>{});await waitSt(p,/Ảnh sang chữ/);ok('vi excel scan msg vi',true);await p.close();
console.log(`\n${n-fail}/${n} passed`);await br.close();srv.close();process.exit(fail?1:0)})().catch(e=>{console.error(e);process.exit(2)});
