// Phone-like photos: EXIF-rotated 12 MP JPEG, low-contrast desk, perspective tilt, in-plane & upside-down rotation, page without visible edges.
// Asserts the default flow (no clicks) yields an upright page whose OCR text lines are horizontal (< 1.5°).
const {chromium,devices}=require('playwright-core'),http=require('http'),fs=require('fs'),path=require('path');
const DIST=path.join(__dirname,'../dist'),S=path.join(__dirname,'samples');const Q=JSON.parse(fs.readFileSync(path.join(S,'scans.json')));
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm'};
const EVS=[];const srv=http.createServer((q,r)=>{if(q.url==='/api/e'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{try{EVS.push(JSON.parse(b))}catch(e){}r.writeHead(204);r.end()});return}let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(DIST,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
let n=0,fail=0;const ok=(name,c,info)=>{n++;if(!c)fail++;console.log(c?'ok  ':'FAIL',name,info===undefined?'':JSON.stringify(info))};
(async()=>{await new Promise(r=>srv.listen(8768,r));const B=process.env.BASE||'http://localhost:8768';
const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const ctx=await br.newContext({...devices['Pixel 7']});
const cases=[['scan1.jpg',['INVOICE','Northwind']],['scan2.jpg',['MEETING','budget']],['scan3_exif.jpg',['QUARTERLY','retention','Tuesday']],['scan4_upside.jpg',['QUARTERLY','retention','Tuesday']],['scan5_noedge.jpg',['QUARTERLY','retention','Tuesday']],['scan6_sideways.jpg',['QUARTERLY','retention','Tuesday']]];
for(const [f,words] of cases){const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(B+(process.env.LP||'')+'/document-scanner/');
 const t0=Date.now();await p.setInputFiles('#cam',path.join(S,f));await p.waitForFunction(()=>APP.pages.length===1,null,{timeout:120000});const ms=Date.now()-t0;
 const st=await p.evaluate(()=>{const x=APP.pages[0];return {auto:x.auto,q:x.quad,W:x.src.width,H:x.src.height,skew:x.skew,rot:x.rot,vis:!document.querySelector('#pc').closest('[hidden]'),adjHidden:document.querySelector('#adj').hidden}});
 ok(`${f}: processed automatically in ${ms} ms, straightened preview shown without any click`,st.vis&&st.adjHidden,{skew:st.skew,rot:st.rot,auto:st.auto});
 if(Q[f]){const sc=st.W/{'scan1.jpg':1500,'scan2.jpg':1600,'scan3_exif.jpg':3024,'scan4_upside.jpg':1500,'scan6_sideways.jpg':2000}[f];const err=Math.max(...Q[f].map(e=>Math.min(...st.q.map(d=>Math.hypot(e[0]*sc-d[0],e[1]*sc-d[1])))))/sc;
  ok(`${f}: edges detected${f.includes('exif')?' (EXIF orientation applied, 12 MP)':''}, max corner error ${err.toFixed(0)}px = ${(100*err/Math.hypot(st.W/sc,st.H/sc)).toFixed(2)}% of diagonal`,st.auto&&err/Math.hypot(st.W/sc,st.H/sc)<0.015)}
 const r=await p.evaluate(async()=>{const d=await Scan.ocr(APP.pages[0].out);return {text:d.text,lines:d.lines.filter(l=>l.text.trim().length>12).map(l=>{const b=l.baseline;return Math.atan2(b.y1-b.y0,b.x1-b.x0)*180/Math.PI})}},null);
 const worst=Math.max(...r.lines.map(Math.abs));ok(`${f}: ${r.lines.length} text lines, max baseline tilt ${worst.toFixed(2)}° (< 1.5°)`,r.lines.length>=2&&worst<1.5);
 const miss=words.filter(w=>!r.text.includes(w));ok(`${f}: page upright, OCR reads ${words.join(', ')}`,!miss.length,miss.length?r.text.slice(0,200):undefined);ok(`${f}: no JS errors`,!errs.length,errs);await p.close()}
await br.close();srv.close();console.log(fail?`phone photos: ${fail}/${n} FAILED`:`phone photos: all ${n} tests passed`);process.exit(fail?1:0)})().catch(e=>{console.error(e);process.exit(1)});
