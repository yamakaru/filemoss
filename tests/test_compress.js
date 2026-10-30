// compress-pdf browser test. Usage: node tests/test_compress.js SAMPLES_DIR [BASE]
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path'),{PDFDocument}=require('pdf-lib');
const S=process.argv[2]||'/workspace/audits/samples',B=process.argv[3]||'http://localhost:8811',Q=process.env.Q||'';let bad=0;
function ok(n,c,x){console.log((c?'PASS ':'FAIL ')+n+(x?' — '+x:''));if(!c)bad++}
(async()=>{const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
for(const mob of [false,true]){const ctx=await br.newContext(mob?{viewport:{width:375,height:740},hasTouch:true,isMobile:true,acceptDownloads:true}:{acceptDownloads:true});
async function run(file,lv,lp=''){const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.goto(B+lp+'/compress-pdf/'+Q);await p.setInputFiles('#drop input',path.join(S,file));if(lv)await p.selectOption('#lv',lv);
await p.click('#go');await p.waitForFunction(()=>!document.querySelector('#go').disabled&&(document.querySelector('#status.err')||!document.querySelector('#sz').hidden),null,{timeout:180000});
const r={st:(await p.textContent('#status')).trim(),err:await p.$('#status.err')!==null,shown:!(await p.$eval('#sz',e=>e.hidden)),s:await p.$$eval('#sz td',t=>t.map(x=>x.textContent)),errs:p.errs};
if(await p.$('.fileout button')){const [d]=await Promise.all([p.waitForEvent('download'),p.locator('.fileout button').first().click()]);const f=path.join('/tmp',d.suggestedFilename());await d.saveAs(f);r.out=fs.readFileSync(f);r.name=d.suggestedFilename()}await p.close();return r}
const tag=mob?'[mobile] ':'',orig=fs.statSync(path.join(S,'photos_10mb.pdf')).size;
for(const lv of (mob?['medium']:['low','medium','strong'])){const r=await run('photos_10mb.pdf',lv);const pct=r.out?Math.round((1-r.out.length/orig)*100):0;let pages=0,txt='';try{pages=(await PDFDocument.load(r.out)).getPageCount()}catch(e){}
console.log(`MEASURE ${tag}${lv}: ${orig} -> ${r.out&&r.out.length} bytes = ${pct}% saved; table ${r.s.join(' / ')}`);ok(tag+lv+' shows before/after/%',r.shown&&r.s.length==3&&/%/.test(r.s[2]));ok(tag+lv+' output valid PDF, 4 pages',pages==4);ok(tag+lv+' no page errors',!r.errs.length,r.errs.join(';'));
if(lv=='medium')ok(tag+'medium saves >=30%',pct>=30,pct+'%')}
if(mob)continue;
const t=await run('text_only.pdf','strong');ok('text-only: warned + original kept',t.err&&t.out&&t.out.equals(fs.readFileSync(path.join(S,'text_only.pdf'))),t.st);
const e=await run('encrypted.pdf');ok('encrypted: clear error',e.err&&/password/i.test(e.st)&&!e.out,e.st);
const c=await run('corrupt.pdf');ok('corrupt: clear error',c.err&&/damaged/i.test(c.st)&&!c.out,c.st);
const v=await run('photos_10mb.pdf','medium','/vi');ok('vi page works',v.out&&v.shown&&/Xong/.test(v.st),v.st);
const ve=await run('encrypted.pdf',null,'/vi');ok('vi encrypted error translated',ve.err&&!/password/.test(ve.st),ve.st);}
await br.close();console.log('BAD',bad);process.exit(bad?1:0)})();
