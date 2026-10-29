// End-to-end tests in real Chrome: every page loads without JS errors; every converter is fed real sample files
// and its downloaded output is verified (format magic bytes, page counts, dimensions, cell values, QR decode).
const {chromium}=require('playwright-core'),http=require('http'),fs=require('fs'),path=require('path');
const {PDFDocument}=require('pdf-lib'),XLSX=require('xlsx'),jsQR=require('jsqr');
const DIST=path.join(__dirname,'../dist'),S=path.join(__dirname,'samples'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.txt':'text/plain','.xml':'application/xml'};
const EVS=[];const srv=http.createServer((q,r)=>{if(q.url==='/api/e'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{try{EVS.push(JSON.parse(b))}catch(e){}r.writeHead(204);r.end()});return}let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(DIST,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
const LOC=!!process.env.LP;let n=0,fail=0;const ok=(name,c,info)=>{n++;if(!c){fail++;console.log('FAIL',name,info===undefined?'':info)}else console.log('ok  ',name)};
const magic=(b,kind)=>({jpg:b[0]==0xFF&&b[1]==0xD8,png:b.slice(1,4).toString()=='PNG',webp:b.slice(0,4).toString()=='RIFF'&&b.slice(8,12).toString()=='WEBP',pdf:b.slice(0,4).toString()=='%PDF',zip:b.slice(0,2).toString()=='PK'})[kind];
function dims(b){if(b[1]==0x50)return [b.readUInt32BE(16),b.readUInt32BE(20)];let i=2;while(i<b.length){if(b[i]!=0xFF)return null;const m=b[i+1],L=b.readUInt16BE(i+2);if(m>=0xC0&&m<=0xC3)return [b.readUInt16BE(i+7),b.readUInt16BE(i+5)];i+=2+L}return null}
(async()=>{await new Promise(r=>srv.listen(8765,r));const B=process.env.BASE||'http://localhost:8765';
const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const ctx=await br.newContext({acceptDownloads:true});
async function open(slug){const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error')p.errs.push(m.text())});await p.goto(B+(process.env.LP||'')+'/'+slug+'/');return p}
async function files(p,list){await p.setInputFiles('#drop input',list.map(f=>path.join(S,f)))}
async function dl(p,sel,i=0){await p.waitForSelector(sel,{timeout:60000});const [d]=await Promise.all([p.waitForEvent('download'),p.locator(sel).nth(i).click()]);const f=path.join(OUT,d.suggestedFilename());await d.saveAs(f);return [fs.readFileSync(f),d.suggestedFilename()]}
const pages=fs.readdirSync(DIST).filter(d=>!/^[a-z]{2}$/.test(d)&&fs.existsSync(path.join(DIST,d,'index.html')));
for(const s of ['',...pages]){const p=await open(s);await p.waitForTimeout(300);ok('loads without JS errors: /'+s,!p.errs.length,p.errs);await p.close()}
let p,b,name;
// image converters
for(const [slug,src,kind,ext] of [['heic-to-jpg','sample.heic','jpg','jpg'],['png-to-jpg','sample.png','jpg','jpg'],['jpg-to-png','sample.jpg','png','png'],['webp-to-jpg','sample.webp','jpg','jpg'],['webp-to-png','sample.webp','png','png']]){
 p=await open(slug);await files(p,[src]);[b,name]=await dl(p,'.fileout button');const d=dims(b);ok(`${slug}: output is ${kind}`,magic(b,kind),b.slice(0,8));ok(`${slug}: filename .${ext}`,name.endsWith('.'+ext),name);
 ok(`${slug}: dimensions kept`,src==='sample.heic'?d&&d[0]>100:d&&d[0]==800&&d[1]==600,d);ok(`${slug}: no errors`,!p.errs.length,p.errs);await p.close()}
// transparency -> white background on JPG
p=await open('png-to-jpg');await files(p,['sample.png']);await p.waitForSelector('.fileout');const px=await p.evaluate(async()=>{const im=await createImageBitmap(UI._items[0].blob),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);return [...x.getImageData(5,5,1,1).data]});ok('png-to-jpg: transparent → white',px[0]>245&&px[1]>245&&px[2]>245,px);await p.close();
// batch + zip
p=await open('png-to-jpg');await files(p,['sample.png','sample.png']);await p.waitForSelector('#out > .btn');[b]=await dl(p,'#out > .btn');ok('batch ZIP download',magic(b,'zip'));await p.close();
// compressor
p=await open('image-compressor');await files(p,['big.jpg']);[b]=await dl(p,'.fileout button');ok('compressor: smaller than original',b.length<fs.statSync(path.join(S,'big.jpg')).size*0.6,b.length);ok('compressor: jpg',magic(b,'jpg'));await p.close();
// resizer
p=await open('image-resizer');await files(p,['sample.png']);await p.fill('#w','400');await p.click('#go');[b]=await dl(p,'.fileout button');ok('resizer: 800x600 → 400x300 png',magic(b,'png')&&String(dims(b))=='400,300',dims(b));await p.close();
// jpg to pdf
p=await open('jpg-to-pdf');await files(p,['sample.jpg','sample.heic']);await p.click('#go');[b]=await dl(p,'.fileout button');let pd=await PDFDocument.load(b);ok('jpg-to-pdf: 2 pages',pd.getPageCount()==2);ok('jpg-to-pdf: page 1 landscape Letter',String(Object.values(pd.getPage(0).getSize()))=='792,612',pd.getPage(0).getSize());await p.close();
// merge
p=await open('merge-pdf');await files(p,['a3.pdf','b2.pdf']);await p.click('#go');[b]=await dl(p,'.fileout button');pd=await PDFDocument.load(b);ok('merge: 3+2 = 5 pages',pd.getPageCount()==5);await p.close();
p=await open('merge-pdf');await files(p,['a3.pdf','sample.jpg']);await p.click('#go');await p.waitForTimeout(800);ok('merge: invalid file reported',LOC?await p.$eval('#status',e=>e.classList.contains('err')&&e.textContent.trim().length>0):/not a valid PDF/.test(await p.textContent('#status')));await p.close();
// split
p=await open('split-pdf');await files(p,['a3.pdf']);await p.waitForFunction(()=>/3 pages/.test(document.querySelector('#info').textContent));await p.fill('#rg','1, 3');await p.check('#one');await p.click('#go');[b]=await dl(p,'.fileout button');pd=await PDFDocument.load(b);ok('split: pages 1,3 → 2-page PDF',pd.getPageCount()==2);
await p.uncheck('#one');await p.selectOption('#mode','each');await p.click('#go');await p.waitForTimeout(500);ok('split: each page → 3 files',await p.locator('.fileout').count()==3);
await p.selectOption('#mode','ranges');await p.fill('#rg','2-9');await p.click('#go');await p.waitForTimeout(300);ok('split: out-of-range error',LOC?await p.$eval('#status',e=>e.classList.contains('err')&&/9/.test(e.textContent)):/out of range/.test(await p.textContent('#status')));await p.close();
p=await open('rotate-pdf');await files(p,['a3.pdf']);await p.waitForFunction(()=>/3 pages/.test(document.querySelector('#info').textContent));await p.fill('#rg','2');await p.click('#go');[b]=await dl(p,'.fileout button');pd=await PDFDocument.load(b);ok('rotate: 3 pages, only page 2 at 90°',pd.getPageCount()==3&&pd.getPage(1).getRotation().angle==90&&pd.getPage(0).getRotation().angle==0,[0,1,2].map(i=>pd.getPage(i).getRotation().angle));await p.close();
p=await open('rotate-pdf');await files(p,['b2.pdf']);await p.waitForFunction(()=>/2 pages/.test(document.querySelector('#info').textContent));await p.selectOption('#ang','180');await p.click('#go');[b]=await dl(p,'.fileout button');pd=await PDFDocument.load(b);ok('rotate: all pages 180°',pd.getPageCount()==2&&pd.getPages().every(x=>x.getRotation().angle==180));await p.close();
p=await open('delete-pdf-pages');await files(p,['a3.pdf']);await p.waitForFunction(()=>/3 pages/.test(document.querySelector('#info').textContent));await p.fill('#rg','1, 3');await p.click('#go');[b]=await dl(p,'.fileout button');pd=await PDFDocument.load(b);ok('delete pages: 3 − 2 = 1 page',pd.getPageCount()==1);await p.close();
p=await open('delete-pdf-pages');await files(p,['b2.pdf']);await p.waitForFunction(()=>/2 pages/.test(document.querySelector('#info').textContent));await p.fill('#rg','1-end');await p.click('#go');await p.waitForTimeout(400);ok('delete pages: deleting all is refused',await p.$eval('#status',e=>e.classList.contains('err')&&e.textContent.trim().length>0));await p.close();
p=await open('password-generator');await p.waitForFunction(()=>document.querySelector('#pw').value.length>0);ok('password: 16 chars generated on load',(await p.$eval('#pw',e=>e.value)).length==16);await p.selectOption('#cnt','5');await p.waitForTimeout(100);ok('password: 5 lines',(await p.$eval('#pw',e=>e.value.split('\n').length))==5);await p.uncheck('#up');await p.uncheck('#lo');await p.uncheck('#sy');await p.uncheck('#di');await p.waitForTimeout(100);ok('password: no type selected → message',(await p.$eval('#pw',e=>e.value))===''&&(await p.$eval('#st',e=>e.textContent.trim().length))>0);ok('password: no errors',!p.errs.length,p.errs);await p.close();
// pdf to jpg
p=await open('pdf-to-jpg');await files(p,['a3.pdf']);await p.click('#go');await p.waitForFunction(()=>document.querySelectorAll('.fileout').length==3,null,{timeout:60000});[b]=await dl(p,'.fileout button');ok('pdf-to-jpg: 3 pages, 150 DPI = 1275x1650 JPG',magic(b,'jpg')&&String(dims(b))=='1275,1650',dims(b));ok('pdf-to-jpg: no errors',!p.errs.length,p.errs);await p.close();
// csv <-> excel
fs.writeFileSync(path.join(S,'t.csv'),'id;zip;name;amount\n1;00123;"Lee; Sam";42.5\n2;90210;Ana;7\n');
p=await open('csv-to-excel');await files(p,['t.csv']);[b]=await dl(p,'.fileout button');let wb=XLSX.read(b),ws=wb.Sheets[wb.SheetNames[0]];
ok('csv→xlsx: semicolon detected, leading zero kept as text',ws.B2.v==='00123'&&ws.B2.t==='s',ws.B2);ok('csv→xlsx: number stored as number',ws.D2.v===42.5&&ws.D2.t==='n',ws.D2);ok('csv→xlsx: quoted delimiter',ws.C2.v==='Lee; Sam',ws.C2);
const xf=path.join(S,'t.xlsx');fs.writeFileSync(xf,b);await p.click('.tab[data-m=x2c]');await files(p,['t.xlsx']);await p.waitForFunction(()=>/\.csv$/.test(document.querySelector('.fileout .fn')?.textContent||''));[b]=await dl(p,'.fileout button');
ok('xlsx→csv: content',b.toString('utf8').replace(/^\uFEFF/,'').split('\r\n')[1]==='1,00123,Lee; Sam,42.5',b.toString());await p.close();
// calculators via UI
async function val(p,sel){return (await p.textContent(sel)).trim()}
p=await open('hourly-to-salary-calculator');ok('salary: $25/h → $52,000.00',(await val(p,'#r')).includes('$52,000.00'));await p.close();
p=await open('meeting-cost-calculator');ok('meeting: default → $318.75',(await val(p,'#r')).includes('$318.75'));await p.close();
p=await open('business-days-calculator');ok('business days Nov 2026 → 19',(LOC?/[)）]\s*19/:/included\)19/).test(await val(p,'#r')),await val(p,'#r'));ok('add 10 bd → Nov 17',(await val(p,'#r')).includes('Nov 17, 2026'));await p.close();
p=await open('time-card-calculator');ok('time card default 5×8h → 40h, $800.00',(await val(p,'#r')).includes('40h 00m')&&(await val(p,'#r')).includes('$800.00'),await val(p,'#r'));await p.close();
p=await open('percentage-calculator');ok('percent: 15% of 200 = 30',(await val(p,'#r1'))==='= 30');ok('percent change 80→100',(await val(p,'#r3')).startsWith('= +25%'));await p.close();
p=await open('time-zone-meeting-planner');await p.selectOption('#z0','America/New_York');await p.selectOption('#z1','Europe/London');await p.selectOption('#z2','Asia/Kolkata');await p.fill('#d','2026-11-10');await p.fill('#tm','09:00');
let tz=await val(p,'#tz');ok('tz: 9 AM NY → 2 PM London, 7:30 PM India',tz.includes('2:00 PM')&&tz.includes('7:30 PM'),tz.slice(0,300));await p.close();
p=await open('word-counter');await p.fill('#t',"Hello world. It's a well-known test!\n\nSecond paragraph here?");ok('word counter: 9 words',(await val(p,'#st')).startsWith(LOC?'9':'9Words'),await val(p,'#st'));await p.close();
p=await open('case-converter');if(LOC)await p.fill('#t','the quick brown fox jumps over the lazy dog');await p.click('[data-m=title]');ok('case: title',(await p.inputValue('#o'))==='The Quick Brown Fox Jumps Over the Lazy Dog',await p.inputValue('#o'));await p.close();
p=await open('text-compare');ok('diff: default summary',LOC?/^\D*1\D+2\D*$/.test(await val(p,'#sum')):(await val(p,'#sum'))==='1 line(s) removed, 2 line(s) added.',await val(p,'#sum'));await p.close();
p=await open('csv-to-json');ok('csv→json default',JSON.parse(await p.inputValue('#o'))[1].name==='Lee, Sam');await p.close();
p=await open('email-signature-generator');ok('signature preview',(await val(p,'#pv')).includes('Jordan Smith'));await p.fill('#name','<script>x</script>');ok('signature escapes HTML',(await p.innerHTML('#pv')).includes('&lt;script&gt;'));await p.close();
// QR: decode PNG download with jsQR (pixels read in browser)
async function qrcheck(setup,exp,label){const p=await open('qr-code-generator');await setup(p);const [d]=await Promise.all([p.waitForEvent('download'),p.click('#png')]);const f=path.join(OUT,'qr.png');await d.saveAs(f);
 const px=await p.evaluate(async(b64)=>{const im=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob()),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);return {w:c.width,h:c.height,d:Array.from(x.getImageData(0,0,c.width,c.height).data)}},fs.readFileSync(f).toString('base64'));
 const r=jsQR(Uint8ClampedArray.from(px.d),px.w,px.h);ok('QR decodes: '+label,r&&r.data===exp,r&&r.data);await p.close()}
await qrcheck(async p=>{},'https://example.com','URL');
await qrcheck(async p=>{await p.selectOption('#ty','wifi');await p.fill('#ss','Office;5G');await p.fill('#pw','pa:ss')},'WIFI:T:WPA;S:Office\\;5G;P:pa\\:ss;;','Wi-Fi with escaping');
await qrcheck(async p=>{await p.selectOption('#ty','text');await p.fill('#tx','Xin chào – café ✓')},'Xin chào – café ✓','UTF-8 text');
{const A=new Set(EVS.map(e=>e.a)),bad=EVS.filter(e=>!/^[a-z0-9-]+$/.test(e.t)||Object.keys(e).some(k=>!['t','a','l','x'].includes(k)));n++;if(!(A.has('upload')&&A.has('process_done')&&A.has('download'))||bad.length){fail++;console.log('FAIL usage events',[...A],bad.slice(0,3))}else console.log('ok   usage events: '+EVS.length+' beacons, actions '+[...A].sort().join(','))}
await br.close();srv.close();console.log(fail?`browser: ${fail}/${n} FAILED`:`browser: all ${n} tests passed`);process.exit(fail?1:0)})().catch(e=>{console.error(e);process.exit(1)});
