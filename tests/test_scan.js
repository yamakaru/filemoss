// Document scanner + OCR end-to-end tests in headless Chrome (desktop + mobile viewport).
const {chromium,devices}=require('playwright-core'),http=require('http'),fs=require('fs'),path=require('path'),{PDFDocument}=require('pdf-lib');
const DIST=path.join(__dirname,'../dist'),S=path.join(__dirname,'samples'),OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm'};
const EVS=[];const srv=http.createServer((q,r)=>{if(q.url==='/api/e'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{try{EVS.push(JSON.parse(b))}catch(e){}r.writeHead(204);r.end()});return}let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(DIST,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
let n=0,fail=0;const ok=(name,c,info)=>{n++;if(!c){fail++;console.log('FAIL',name,info===undefined?'':JSON.stringify(info))}else console.log('ok  ',name,info===undefined?'':JSON.stringify(info))};
const Q=JSON.parse(fs.readFileSync(path.join(S,'scans.json')));
(async()=>{await new Promise(r=>srv.listen(8767,r));const B=process.env.BASE||'http://localhost:8767';
const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
async function open(ctx,slug){const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.goto(B+(process.env.LP||'')+'/'+slug+'/');return p}
async function dl(p,sel){await p.waitForSelector(sel,{timeout:180000});const [d]=await Promise.all([p.waitForEvent('download'),p.locator(sel).first().click()]);const f=path.join(OUT,d.suggestedFilename());await d.saveAs(f);return fs.readFileSync(f)}
const ctx=await br.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});
let p=await open(ctx,'document-scanner');
await p.setInputFiles('#up',['scan1.jpg','scan2.jpg'].map(f=>path.join(S,f)));await p.waitForFunction(()=>APP.pages.length===2,null,{timeout:60000});
const got=await p.evaluate(()=>APP.pages.map(x=>({q:x.quad,auto:x.auto,W:x.src.width,H:x.src.height})));
['scan1.jpg','scan2.jpg'].forEach((f,i)=>{const g=got[i],exp=Q[f],err=Math.max(...exp.map((e,k)=>Math.hypot(e[0]-g.q[k][0],e[1]-g.q[k][1])));const diag=Math.hypot(g.W,g.H);
 ok(`edge detection ${f}: quad found, max corner error ${err.toFixed(1)}px (${(100*err/diag).toFixed(2)}% of diagonal)`,g.auto&&err/diag<0.015)});
const outsz=await p.evaluate(()=>APP.pages.map(x=>[x.out.width,x.out.height]));ok('perspective crop recovers true 8.5×11 aspect (±2%)',outsz.every(s=>Math.abs(s[0]/s[1]/(8.5/11)-1)<0.02),outsz);
// filter check: B&W gives only black/white pixels, paper becomes white
const fl=await p.evaluate(async()=>{const r={};for(const f of ['bw','enhance','gray','original']){document.querySelector('#flt').value=f;document.querySelector('#flt').dispatchEvent(new Event('change'));const o=APP.pages[APP.cur].out,d=o.getContext('2d').getImageData(0,0,o.width,o.height).data;let bw=0,white=0,t=d.length/4;for(let i=0;i<d.length;i+=4){if(d[i]===0||d[i]===255)bw++;if(d[i]>240&&d[i+1]>240&&d[i+2]>240)white++}r[f]={bw:bw/t,white:white/t}}return r});
ok('B&W filter is pure black/white',fl.bw.bw>0.999,fl.bw);ok('Magic color whitens paper (>80% near-white)',fl.enhance.white>0.8,fl.enhance);ok('Original keeps shading (fewer white px than enhance)',fl.original.white<fl.enhance.white,fl.original);
await p.selectOption('#flt','enhance');
// rotate, reorder
await p.click('#rr');let rs=await p.evaluate(()=>[APP.pages[APP.cur].out.width,APP.pages[APP.cur].out.height]);ok('rotate swaps dimensions',rs[0]>rs[1],rs);await p.click('#rl');
const nm0=await p.evaluate(()=>APP.pages.map(x=>x.name).join());await p.locator('.pg').nth(1).locator('button').first().click();ok('reorder pages',await p.evaluate(()=>APP.pages.map(x=>x.name).join())==='scan2.jpg,scan1.jpg',nm0);
// drag a corner
await p.click('#adjb');await p.locator('#ec').scrollIntoViewIfNeeded();const before=await p.evaluate(()=>APP.pages[APP.cur].quad.map(v=>v.slice()));const bb=await p.locator('#ec').boundingBox();const sc=await p.evaluate(()=>document.querySelector('#ec').getBoundingClientRect().width/APP.pages[APP.cur].src.width);
const c0=[bb.x+before[0][0]*sc,bb.y+before[0][1]*sc];await p.mouse.move(c0[0],c0[1]);await p.mouse.down();await p.mouse.move(c0[0]+30,c0[1]+25,{steps:5});await p.mouse.up();
const after=await p.evaluate(()=>APP.pages[APP.cur].quad);ok('drag corner moves it',Math.hypot(after[0][0]-before[0][0],after[0][1]-before[0][1])>20);await p.click('#auto');
// PDF
let b=await dl(p,'.fileout button').catch(()=>null);await p.click('#pdf');b=await dl(p,'.fileout button');let pd=await PDFDocument.load(b);ok('PDF valid with 2 pages',pd.getPageCount()===2);ok('PDF page is US Letter',String(Object.values(pd.getPage(0).getSize()))==='612,792',pd.getPage(0).getSize());
await p.selectOption('#ps','a4');await p.click('#pdf');await p.waitForTimeout(1500);b=await dl(p,'.fileout button');pd=await PDFDocument.load(b);ok('A4 PDF',Math.round(pd.getPage(0).getSize().width)===595);
await p.click('#jpg');await p.waitForFunction(()=>document.querySelectorAll('.fileout').length===2);b=await dl(p,'.fileout button');ok('JPG export',b[0]===0xFF&&b[1]===0xD8);
// OCR text
await p.click('#ocr');await p.waitForFunction(()=>!document.querySelector('#txtw').hidden,null,{timeout:240000});const txt=await p.inputValue('#txt');
for(const w of ['MEETING','kickoff','budget','INVOICE','Northwind','4,800.00'])ok('OCR (scanned photo) finds "'+w+'"',txt.includes(w));
// searchable PDF -> extract text with pdf.js in page
await p.selectOption('#ps','letter');await p.check('#srch');await p.click('#pdf');await p.waitForFunction((w)=>(document.querySelector('.fileout .fs')?.textContent||'').includes(w),process.env.LP?JSON.parse(fs.readFileSync(path.join(__dirname,'../i18n',process.env.LP.slice(1)+'.json')))['j'+require('crypto').createHash('sha1').update(' · searchable').digest('hex').slice(0,16)].trim():'searchable',{timeout:240000});b=await dl(p,'.fileout button');
const ptxt=await p.evaluate(async(b64)=>{const m=await import('/assets/pdf.min.mjs');m.GlobalWorkerOptions.workerSrc='/assets/pdf.worker.min.mjs';const d=await m.getDocument({data:Uint8Array.from(atob(b64),c=>c.charCodeAt(0))}).promise;let t='';for(let i=1;i<=d.numPages;i++){const c=await (await d.getPage(i)).getTextContent();t+=c.items.map(x=>x.str).join(' ')+'\n'}return t},b.toString('base64'));
ok('searchable PDF contains text layer ("INVOICE", "Northwind")',/INVOICE/.test(ptxt)&&/Northwind/.test(ptxt),ptxt.slice(0,120));
ok('scanner: no JS errors',!p.errs.length,p.errs);await p.close();
// image to text
p=await open(ctx,'image-to-text');await p.setInputFiles('#drop input',path.join(S,'ocr_clean.png'));await p.waitForFunction(()=>!document.querySelector('#res').hidden,null,{timeout:240000});const t2=await p.inputValue('#txt');
ok('image-to-text exact lines',t2.includes('INVOICE 10457')&&t2.includes('Total amount due: $4,800.00')&&t2.includes('Payment terms: Net 30'),t2);ok('image-to-text: no JS errors',!p.errs.length,p.errs);await p.close();
// mobile
const mctx=await br.newContext({...devices['iPhone 13'],acceptDownloads:true});p=await open(mctx,'document-scanner');
ok('mobile: camera input uses rear camera',await p.getAttribute('#cam','capture')==='environment');
await p.setInputFiles('#cam',path.join(S,'scan1.jpg'));await p.waitForFunction(()=>APP.pages.length===1,null,{timeout:60000});
const ov=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,vw:innerWidth,cw:document.querySelector('#ec').getBoundingClientRect().width}));ok('mobile: no horizontal overflow, editor fits screen',ov.sw<=ov.vw&&ov.cw<=ov.vw,ov);
await p.click('#adjb');const mb=await p.locator('#ec').boundingBox(),mq=await p.evaluate(()=>APP.pages[0].quad.map(v=>v.slice())),ms=await p.evaluate(()=>document.querySelector('#ec').getBoundingClientRect().width/APP.pages[0].src.width);
const cx=mb.x+mq[2][0]*ms,cy=mb.y+mq[2][1]*ms;await p.dispatchEvent('#ec','pointerdown',{clientX:cx,clientY:cy,pointerId:1,isPrimary:true,pointerType:'touch'});await p.dispatchEvent('#ec','pointermove',{clientX:cx-20,clientY:cy-20,pointerId:1,pointerType:'touch'});await p.dispatchEvent('#ec','pointerup',{clientX:cx-20,clientY:cy-20,pointerId:1,pointerType:'touch'});
const mq2=await p.evaluate(()=>APP.pages[0].quad);ok('mobile: touch-drag corner',Math.hypot(mq2[2][0]-mq[2][0],mq2[2][1]-mq[2][1])>10);
await p.click('#pdf');b=await dl(p,'.fileout button');ok('mobile: PDF export',(await PDFDocument.load(b)).getPageCount()===1);await p.screenshot({path:path.join(OUT,'scanner_mobile.png'),fullPage:false});ok('mobile: no JS errors',!p.errs.length,p.errs);
await br.close();srv.close();console.log(fail?`scanner: ${fail}/${n} FAILED`:`scanner: all ${n} tests passed`);process.exit(fail?1:0)})().catch(e=>{console.error(e);process.exit(1)});
