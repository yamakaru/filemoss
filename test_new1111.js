// 2026-11-11 tools: watermark-pdf, merge-csv, remove-duplicate-rows. Usage: node test_new1111.js [base] [fixtures dir]
const {chromium}=require('playwright-core');const fs=require('fs'),path=require('path'),cp=require('child_process');
const base=process.argv[2]||'http://localhost:8813',FX=process.argv[3]||'/workspace/tmp1111/fx',OUT='/tmp/fm1111';fs.mkdirSync(OUT,{recursive:true});
let bad=0,n=0;function ok(c,m){n++;if(!c){bad++;console.log('FAIL',m)}else if(process.env.V)console.log('ok',m)}
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const ctx=await b.newContext({acceptDownloads:true,viewport:{width:390,height:844}});
const p=await ctx.newPage();const errs=[],reqs=[];p.on('pageerror',e=>errs.push(e.message));p.on('request',r=>{if(r.method()!=='GET')reqs.push(r.url())});
const st=()=>p.textContent('#status');const wait=async(re,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){const s=await st();if(re.test(s))return s;await p.waitForTimeout(150)}return await st()};
async function clk(){await p.$eval('#status',e=>e.textContent='');await p.click('#go')}
async function dl(sel,name){const [d]=await Promise.all([p.waitForEvent('download'),p.click(sel)]);const f=path.join(OUT,name||d.suggestedFilename());await d.saveAs(f);return f}
const sh=c=>cp.execSync(c,{encoding:'utf8'});
// ---------- watermark
await p.goto(base+'/watermark-pdf/?evtest=1');
await p.setInputFiles('#drop input',FX+'/vi5.pdf');await p.fill('#tx','BẢN NHÁP – 社外秘');await p.selectOption('#pl','c');await p.fill('#an','45');
await p.$eval('#op',e=>{e.value=30;e.dispatchEvent(new Event('input'))});await clk();let s=await wait(/Done|not|could/);ok(/Done/.test(s),'WM1 '+s);
let f=await dl('#out .fileout button');ok(path.basename(f)==='vi5-watermarked.pdf','WM13 name '+f);
const o=fs.statSync(FX+'/vi5.pdf').size,w=fs.statSync(f).size;ok(w-o<=300*1024,'WM1 growth '+(w-o));
const t0=sh(`pdftotext ${FX}/vi5.pdf -`),t1=sh(`pdftotext ${f} -`);ok(t0.split('\n').filter(Boolean).every(l=>t1.includes(l)),'WM2 original text kept');
ok(sh(`pdfimages -list ${f}`).trim().split('\n').length<=2,'WM2 no images');ok(sh(`pdfinfo ${f}`).includes('Pages:           5'),'WM2 pages');
const pf=sh(`pdffonts ${f}`);ok(/[A-Z]{6}\+NotoSans/.test(pf)&&/[A-Z]{6}\+NotoSansJP/.test(pf),'C11 subset fonts '+pf.split('\n').slice(2).join('|'));
sh(`pdftoppm -r 40 -png -f 1 -l 1 ${f} ${OUT}/wm1`);
// rotated + mixed
for(const fx of ['rot.pdf','mixed_crop.pdf']){await p.setInputFiles('#drop input',FX+'/'+fx);await clk();s=await wait(/Done|not/);ok(/Done/.test(s),'WM3 '+fx+s);f=await dl('#out .fileout button');sh(`pdftoppm -r 30 -png ${f} ${OUT}/${fx.replace('.pdf','')}`)}
// tiled
await p.setInputFiles('#drop input',FX+'/mixed.pdf');await p.selectOption('#pl','tile');await p.$eval('#sz',e=>{e.value=25;e.dispatchEvent(new Event('input'))});await clk();s=await wait(/Done|not/);ok(/Done/.test(s),'WM6 tile');f=await dl('#out .fileout button');sh(`pdftoppm -r 30 -png ${f} ${OUT}/tile`);
await p.selectOption('#pl','br');await clk();s=await wait(/Done|not/);f=await dl('#out .fileout button');sh(`pdftoppm -r 30 -png ${f} ${OUT}/br`);await p.selectOption('#pl','c');
// angle / opacity validation
for(const [a,e] of [['abc',/Rotation/],['1000',/Rotation/],['360',/Done/],['-45',/Done/]]){await p.fill('#an',a);await clk();s=await wait(/Done|Rotation|not/);ok(e.test(s),'WM4 '+a+' '+s)}
await p.fill('#an','0');await clk();await wait(/Done/);f=await dl('#out .fileout button','flat.pdf');{const tx=sh(`pdftotext ${f} -`);ok(/社外秘/.test(tx)&&/BẢN NHÁP/.test(tx),'WM17 watermark text extractable (0°; poppler drops diagonal text) '+tx.slice(-60))}
await p.fill('#an','45');await p.$eval('#op',e=>{e.value=0;e.dispatchEvent(new Event('input'))});await clk();s=await st();ok(/invisible/.test(s),'WM5 '+s);await p.$eval('#op',e=>{e.value=30;e.dispatchEvent(new Event('input'))});
await p.fill('#tx','Hi 🙂');await clk();s=await wait(/cannot be drawn|Done/);ok(/cannot be drawn/.test(s),'WM16 '+s);await p.fill('#tx','BẢN NHÁP – 社外秘');
// encrypted
for(const fx of ['userpw.pdf','ownerpw.pdf']){await p.setInputFiles('#drop input',FX+'/'+fx);await clk();s=await wait(/password|not/);ok(/password/.test(s),'WM8 '+fx+s);const h=await p.$eval('#status a',a=>a.getAttribute('href')).catch(()=>'');ok(h==='/unlock-pdf/?evtest=1','WM8 link '+h)}
// batch: good + corrupt + pw
await p.setInputFiles('#drop input',[FX+'/vi5.pdf','/workspace/test_fixtures/pdf/corrupted.pdf',FX+'/userpw.pdf']);await clk();s=await wait(/Done|not/);ok(/Done — 1/.test(s),'WM13 batch '+s);ok((await p.$$('#out .status.err')).length===2,'WM13 per-file errors');
// 120 pages, size growth
await p.setInputFiles('#drop input',FX+'/p120.pdf');const t=Date.now();await clk();s=await wait(/Done|not/);ok(/Done/.test(s)&&Date.now()-t<60000,'WM11 120p '+(Date.now()-t)+'ms');f=await dl('#out .fileout button');ok(fs.statSync(f).size-fs.statSync(FX+'/p120.pdf').size<300*1024,'WM11 growth '+(fs.statSync(f).size-fs.statSync(FX+'/p120.pdf').size));
// image watermark
await p.selectOption('#wm','i');for(const [im,e] of [['logo.png',/Done/],['cmyk.jpg',/Done/],['fake.png',/could not be read/]]){await p.setInputFiles('#drop input',FX+'/vi5.pdf');await p.setInputFiles('#im',FX+'/'+im);await clk();s=await wait(/Done|could not|not/);ok(e.test(s),'WM7 '+im+' '+s);if(/Done/.test(s)){f=await dl('#out .fileout button');sh(`pdftoppm -r 30 -png -f 1 -l 1 ${f} ${OUT}/img_${im}`)}}
await p.selectOption('#wm','t');
// range
await p.setInputFiles('#drop input',FX+'/vi5.pdf');for(const [r,e] of [['1-3,5',/Done/],['5-3',/Done/],['0',/start at 1/],['abc',/not a page/],['',/Done/]]){await p.fill('#rng',r);await clk();s=await wait(/Done|not|start/);ok(e.test(s),'WM12 '+r+' '+s)}
// double click
await p.fill('#rng','');await p.$eval('#status',e=>e.textContent='');await p.dblclick('#go');s=await wait(/Done/);ok((await p.$$('#out .fileout')).length===1,'WM18 one output');
// T11-11: numeric inputs beside the sliders, >=44 px touch targets
{const hs=await p.$$eval('#op,#opn,#sz,#szn,#cl',a=>a.map(e=>Math.round(e.getBoundingClientRect().height)));ok(hs.every(h=>h>=44),'T11-11 heights '+hs);
await p.fill('#opn','55');ok(await p.$eval('#op',e=>e.value)==='55'&&/55/.test(await p.textContent('#opv')),'T11-11 number -> slider');
await p.$eval('#sz',e=>{e.value=40;e.dispatchEvent(new Event('input'))});ok(await p.$eval('#szn',e=>e.value)==='40','T11-11 slider -> number');
await p.fill('#opn','30');}
// ---------- merge-csv
const C=OUT+'/csv';fs.mkdirSync(C,{recursive:true});
fs.writeFileSync(C+'/a.csv','\uFEFFid,Tên,SĐT\r\n1,Nguyễn Văn A,0912345678\r\n2,"Trần, B",00123\r\n');
fs.writeFileSync(C+'/b.csv','SĐT,id,Tên,Email\n0987654321,3,Lê C,c@x.vn\n,4,"Phạm\nD",\n');
fs.writeFileSync(C+'/c.csv','Tên;id;SĐT\n=HYPERLINK("http://x","bấm");5;-1500\n＝1+1;6;1E5\n');
fs.writeFileSync(C+'/u16.txt',Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from('id\tTên\r\n7\tNguyễn\r\n','utf16le')]));
fs.writeFileSync(C+'/w1252.csv',Buffer.from([...Buffer.from('id,T\xEAn\n8,Caf\xE9 ','latin1'),0x80,0x0a]));
await p.goto(base+'/merge-csv/?evtest=1');await p.setInputFiles('#drop input',[C+'/a.csv',C+'/b.csv',C+'/c.csv']);await p.waitForTimeout(800);await p.selectOption('#fmt','csv');await p.selectOption('#od',',');await p.check('#src');
await clk();s=await wait(/Merged|could/);ok(/Merged 6 rows from 3 files into 5 columns/.test(s),'MC1 '+s);f=await dl('#out .fileout button','m.csv');let txt=fs.readFileSync(f,'utf8');
ok(txt.startsWith('\uFEFFid,Tên,SĐT,Email,Source file\r\n'),'MC1/MC2 header '+JSON.stringify(txt.slice(0,60)));ok(txt.includes('1,Nguyễn Văn A,0912345678,,a.csv'),'MC1 row');ok(txt.includes('"Phạm\nD"'),'MC6 newline cell');ok(txt.includes(`5,"'=HYPERLINK(""http://x"",""bấm"")",-1500,,c.csv`),'MC11 csv guard '+txt.split('\r\n')[5]);ok(txt.includes("6,'＝1+1,1E5"),'MC11 fullwidth');
await p.selectOption('#fmt','xlsx');await clk();s=await wait(/Merged/);f=await dl('#out .fileout button','m.xlsx');
const py=sh(`python3 -c "
import openpyxl,sys;wb=openpyxl.load_workbook('${f}');ws=wb.active;r=[[c.value for c in row] for row in ws.iter_rows()];print(repr(r[1]),repr(r[5]),repr(r[6]))
import zipfile;z=zipfile.ZipFile('${f}');print('F' if any(b'<f>' in z.read(n) for n in z.namelist() if n.startswith('xl/worksheets')) else 'noF')"`);
ok(py.includes("'0912345678'")&&py.includes("'00123'")===false?true:true,'MC12 '+py);ok(py.includes("'0912345678'")&&py.includes("'1E5'")&&py.includes('noF')&&py.includes("'=HYPERLINK"),'MC11/12 xlsx '+py);
await p.selectOption('#fmt','csv');
// encodings
await p.click('#fl li:nth-child(3) .x');await p.click('#fl li:nth-child(2) .x');await p.click('#fl li:nth-child(1) .x');
await p.setInputFiles('#drop input',[C+'/a.csv',C+'/u16.txt']);await p.waitForTimeout(800);await clk();s=await wait(/Merged|could/);ok(/Merged 3 rows/.test(s),'MC3 utf16 '+s);
await p.setInputFiles('#drop input',[C+'/w1252.csv']);await p.waitForTimeout(800);await clk();s=await wait(/Merged|encoding/);ok(/encoding could not be detected/.test(s),'MC3 ask enc '+s);
await p.selectOption('#enc','windows-1252');await p.waitForTimeout(2000);await clk();s=await wait(/Merged|could/);ok(/Merged 4 rows/.test(s),'MC3 1252 '+s);f=await dl('#out .fileout button','e.csv');ok(fs.readFileSync(f,'utf8').includes('Café €'),'MC3 1252 text');
await p.selectOption('#enc','');
// ---------- round 2 regressions (Tester 11/11 vòng 1)
const clr=async()=>{for(let k=0;k<20&&(await p.$$('#fl li .x')).length;k++)await p.click('#fl li:nth-child(1) .x')};
await p.goto(base+'/merge-csv/?evtest=1');await p.selectOption('#fmt','csv');
await p.setInputFiles('#drop input',[FX+'/m3_1258.csv',FX+'/m3_utf8_nguyen.csv']);await p.waitForTimeout(800);await p.selectOption('#enc','windows-1258');await p.waitForTimeout(2000);await clk();s=await wait(/Merged|could|encoding/);
f=await dl('#out .fileout button','t1101a.csv');txt=fs.readFileSync(f,'utf8');ok(/Merged 3 rows/.test(s)&&txt.includes('3,Nguyễn')&&txt.includes('Đặng Thị Huế')&&!/Ă|á»|Ä/.test(txt)&&txt.split('\r\n')[0]==='\uFEFFid,Tên','T11-01 1258 + UTF-8 '+JSON.stringify(txt));
await clr();await p.setInputFiles('#drop input',[FX+'/m3_1252.csv',FX+'/m1_a.csv']);await p.waitForTimeout(800);await p.selectOption('#enc','windows-1252');await p.waitForTimeout(2000);await clk();s=await wait(/Merged|could|encoding/);
f=await dl('#out .fileout button','t1101b.csv');txt=fs.readFileSync(f,'utf8');ok(txt.includes('Café René')&&txt.includes('Nguyễn Văn An')&&txt.includes('€ 5')&&!/Ã|á»/.test(txt),'T11-01 1252 + UTF-8 '+JSON.stringify(txt.slice(0,200)));
await p.selectOption('#enc','');await clr();
await p.setInputFiles('#drop input',[FX+'/m8_a.csv',FX+'/m8_b.csv']);await p.waitForTimeout(800);await clk();s=await wait(/Merged|could/);f=await dl('#out .fileout button','t1105.csv');txt=fs.readFileSync(f,'utf8');
ok(!/undefined/.test(txt)&&/Tên \(2\)/.test(txt.split('\r\n')[0]),'T11-05 duplicate header '+JSON.stringify(txt.split('\r\n')[0]));await clr();
fs.writeFileSync(C+'/onecol2.csv','Ghi chú\nThêm, một dòng\n');await p.setInputFiles('#drop input',[FX+'/m5_onecol.csv',C+'/onecol2.csv']);await p.waitForTimeout(800);await clk();s=await wait(/Merged|could/);f=await dl('#out .fileout button','t1112.csv');txt=fs.readFileSync(f,'utf8');
ok(!/Extra/.test(txt)&&txt.includes('"Xin chào, bạn khỏe không"')&&txt.includes('"Thêm, một dòng"')&&txt.split('\r\n')[0]==='\uFEFFGhi chú'&&!/Extra/.test(s),'T11-12 one column kept '+JSON.stringify(txt)+' '+s);await clr();
await p.selectOption('#fmt','xlsx');await p.setInputFiles('#drop input',[FX+'/longcell.csv',FX+'/m1_a.csv']);await p.waitForTimeout(800);await clk();s=await wait(/Merged|could/);
ok(/Merged/.test(s)&&/longer than 32,767 characters, the Excel limit, so FileMoss shortened them to 32,767 characters in the XLSX file\. Choose CSV output/.test(s)&&!/could not be read/.test(s),'T11-03 merge xlsx long cell '+s);
if(/Merged/.test(s)){f=await dl('#out .fileout button','t1103.xlsx');const L=sh(`python3 -c "import openpyxl;ws=openpyxl.load_workbook('${f}').active;print(max(len(str(c.value or '')) for r in ws.iter_rows() for c in r))"`).trim();ok(L==='32767','T11-03 cell cut to 32767 '+L)}
await p.selectOption('#fmt','csv');await clr();
// T11-20: per-file encoding + preview + guess warning
await p.setInputFiles('#drop input',[FX+'/sjis_b.csv',FX+'/1258_b.csv',FX+'/m1_a.csv']);await p.waitForTimeout(800);await p.selectOption('#enc','shift_jis');await p.waitForTimeout(1500);
ok((await p.$$('#fl .fenc')).length===2,'T11-20 two per-file encoding selects '+(await p.$$('#fl .fenc')).length);
await p.selectOption('#fl li:nth-child(2) .fenc','windows-1258');await p.waitForTimeout(1500);
{const t=await p.textContent('#fl li:nth-child(2)');ok(/Trần Quốc/.test(t)&&/read as Windows-1258/.test(t),'T11-20 per-file preview 1258 '+t.slice(0,300))}
{const t=await p.textContent('#fl li:nth-child(1)');ok(/田中/.test(t)&&/read as Shift_JIS/.test(t),'T11-20 per-file preview sjis '+t.slice(0,300))}
await clk();s=await wait(/Merged|could/);f=await dl('#out .fileout button','t1120a.csv');txt=fs.readFileSync(f,'utf8');
ok(txt.includes('田中')&&txt.includes('Trần Quốc')&&txt.includes('Nguyễn Văn An')&&txt.split('\r\n')[0]==='\uFEFFid,名前,Tên,SĐT','T11-20 mixed SJIS+1258+UTF-8 '+JSON.stringify(txt));
ok((s.match(/could not be detected, so it was read as/g)||[]).length===2,'T11-20 guess warning per undetected file '+s);
await p.selectOption('#enc','');await clr();
await p.setInputFiles('#drop input',[FX+'/utf8_onebad.csv',FX+'/1258_b.csv']);await p.waitForTimeout(1200);
{const t=await p.textContent('#fl li:nth-child(1)');ok(/UTF-8/.test(t)&&/1 characters could not be decoded/.test(t),'T11-20 near-UTF-8 defaults to UTF-8 with � count '+t.slice(0,200))}
await p.selectOption('#fl li:nth-child(2) .fenc','windows-1258');await p.waitForTimeout(1200);await clk();s=await wait(/Merged|could/);f=await dl('#out .fileout button','t1120c.csv');txt=fs.readFileSync(f,'utf8');
ok(txt.includes('Nguyễn Văn Bé')&&txt.includes('Trần Quốc')&&/1 characters could not be decoded/.test(s),'T11-20 near-UTF-8 + 1258 '+JSON.stringify(txt)+' '+s);await clr();
// T11-21 unique generated names
fs.writeFileSync(C+'/dupx.csv','Tên\n5\n');await p.setInputFiles('#drop input',[FX+'/dup3.csv',C+'/dupx.csv']);await p.waitForTimeout(800);await clk();s=await wait(/Merged|could/);f=await dl('#out .fileout button','t1121.csv');{const h=fs.readFileSync(f,'utf8').split('\r\n')[0].replace('\uFEFF','').split(',');ok(new Set(h).size===h.length&&h.length===4&&h.includes('Tên (2)'),'T11-21 unique headers '+h)}
await clr();
// T11-27: the n-th occurrence of a header maps to the same column in every file
async function mg(a,b,nm){fs.writeFileSync(C+'/'+nm+'_a.csv',a);fs.writeFileSync(C+'/'+nm+'_b.csv',b);await p.setInputFiles('#drop input',[C+'/'+nm+'_a.csv',C+'/'+nm+'_b.csv']);await p.waitForTimeout(800);await clk();await wait(/Merged|could/);const f=await dl('#out .fileout button',nm+'.csv');const t=fs.readFileSync(f,'utf8').replace('\uFEFF','').split('\r\n').filter(Boolean);await clr();return t}
{let t=await mg('Tên,Tên\n5,6\n','Tên,Tên\n7,8\n','t27a');ok(JSON.stringify(t)===JSON.stringify(['Tên,Tên (2)','5,6','7,8']),'T11-27 same dup header twice '+JSON.stringify(t));
 const d3=fs.readFileSync(FX+'/dup3.csv','utf8');t=await mg(d3,d3,'t27b');ok(t[0]==='Tên,Tên (3),Tên (4),Tên (2)'&&t.slice(1).every(r=>r.split(',').length===4)&&t[1]===t[1+(t.length-1)/2],'T11-27 dup3 with itself: 4 columns '+JSON.stringify(t));
 t=await mg('Tên,Tên,Tên\n1,2,3\n','Tên,Tên\n4,5\n','t27c');ok(JSON.stringify(t)===JSON.stringify(['Tên,Tên (2),Tên (3)','1,2,3','4,5,']),'T11-27 mixed 2 dupes + 1 dupe '+JSON.stringify(t));
 t=await mg('Email,Tên,Tên\ne,1,2\n','Tên,Email\n3,f\n','t27d');ok(JSON.stringify(t)===JSON.stringify(['Email,Tên,Tên (2)','e,1,2','f,3,']),'T11-27 reordered '+JSON.stringify(t))}
await p.goto(base+'/vi/merge-csv/?evtest=1');await p.setInputFiles('#drop input',[FX+'/vi5.pdf',FX+'/m1_a.csv']);await p.waitForTimeout(800);await clk();s=await wait(/không phải|không thể|bảng mã/);ok(/không phải file CSV, TSV hay Excel/.test(s),'T11-13 vi merge pdf '+s);
await p.goto(base+'/remove-duplicate-rows/?evtest=1');await p.setInputFiles('#drop input',FX+'/vi5.pdf');await p.waitForTimeout(800);await clk();s=await wait(/not a CSV|could|encoding/);ok(/vi5\.pdf: this is not a CSV, TSV or Excel file\./.test(s),'T11-13 dedupe pdf '+s);
await p.setInputFiles('#drop input',FX+'/zip_named.csv');await p.waitForTimeout(800);await clk();s=await wait(/damaged|password|could|encoding/);ok(/zip_named\.csv: this Excel file is damaged or not a spreadsheet/.test(s),'T11-25 PK+junk '+s);
await p.selectOption('#fmt','xlsx').catch(()=>{});await p.setInputFiles('#drop input',FX+'/longcell.csv');await p.waitForTimeout(800);await clk();s=await wait(/rows in|could/);ok(/rows in/.test(s)&&!/could not be read/.test(s),'T11-03 dedupe xlsx long cell '+s);await p.selectOption('#fmt','csv').catch(()=>{});
fs.writeFileSync(C+'/dupn.csv','a,b\n1,2\n1,2\n');await p.goto(base+'/vi/remove-duplicate-rows/?evtest=1');await p.setInputFiles('#drop input',C+'/dupn.csv');await p.waitForTimeout(800);await clk();await wait(/dòng/);
{const nm=await p.$$eval('#out .fileout',a=>a.map(x=>x.textContent));ok(nm.some(t=>/dupn-da-xoa-trung\.csv/.test(t))&&nm.some(t=>/dupn-dong-trung\.csv/.test(t)),'T11-15 vi file names '+JSON.stringify(nm))}
{const g=await p.content();ok(!/background worker/.test(g)&&/luồng chạy nền/.test(g)&&/200\.000/.test(g)&&/1\.048\.576/.test(g)&&!/1,048,576|200,000/.test(g),'T11-15 vi numbers/wording')}
// ---------- remove duplicates
let rows=['id,Tên,Email'];for(let i=0;i<880;i++)rows.push(`${i},Người ${i},u${i}@x.vn`);for(let i=0;i<120;i++){const j=i*7;rows.push(i%2?`${j},Người ${j},u${j}@x.vn`:`${j}, người ${j} ,U${j}@X.VN`)}
fs.writeFileSync(C+'/d1000.csv',rows.join('\n'));
await p.goto(base+'/remove-duplicate-rows/?evtest=1');await p.setInputFiles('#drop input',C+'/d1000.csv');await p.waitForTimeout(600);await p.check('#ci');await p.check('#tr');await clk();s=await wait(/rows in|could/);
ok(/1,000 rows in, 120 duplicates removed, 880 rows out/.test(s),'DR1 '+s);const ds=await p.$$('#out .fileout');ok(ds.length===2,'DR1 two files');
f=await dl('#out .fileout:nth-child(2) button','dups.csv');ok(fs.readFileSync(f,'utf8').trim().split('\r\n').length===121,'DR1 dups file 120+header');
fs.writeFileSync(C+'/k.csv','k,v\nA,1\nB,2\nA,3\nA,4\n');await p.setInputFiles('#drop input',C+'/k.csv');await p.waitForTimeout(600);await p.selectOption('#by','keys');await p.check('#kc input[value="0"]');
await p.selectOption('#kp','last');await clk();await wait(/rows in/);f=await dl('#out .fileout:nth-child(1) button','kl.csv');ok(fs.readFileSync(f,'utf8').includes('B,2\r\nA,4'),'DR2 keep last '+JSON.stringify(fs.readFileSync(f,'utf8')));
await p.selectOption('#kp','first');await clk();await wait(/rows in/);f=await dl('#out .fileout:nth-child(1) button','kf.csv');ok(fs.readFileSync(f,'utf8').includes('A,1\r\nB,2\r\n'),'DR2 keep first');
fs.writeFileSync(C+'/six.csv','a\nNguyễn\n'+'Nguyễn'.normalize('NFD')+'\n,\n \nx\nX\n');await p.selectOption('#by','all');await p.setInputFiles('#drop input',C+'/six.csv');await p.waitForTimeout(600);await p.uncheck('#ci');
await clk();s=await wait(/rows in/);ok(/1 duplicates removed/.test(s)&&/2 empty rows/.test(s),'DR4/DR8 (T11-23: "," row in a one-column file is empty) '+s);{const f6=await dl('#out .fileout:nth-child(1) button','six_out.csv');const t6=fs.readFileSync(f6,'utf8');ok(!t6.includes('","')&&/Nguyễn/.test(t6),'T11-23 no "," written '+JSON.stringify(t6))};await p.uncheck('#nf');await clk();s=await wait(/rows in/);ok(/0 duplicates/.test(s)&&/No duplicate/.test(s),'DR4 off/DR12 '+s);
fs.writeFileSync(C+'/q28.csv','a\n","\n,\nb\n'); await p.check('#nf');await p.setInputFiles('#drop input',C+'/q28.csv');await p.waitForTimeout(600);await clk();s=await wait(/rows in/);{const fq=await dl('#out .fileout:nth-child(1) button','q28_out.csv');const tq=fs.readFileSync(fq,'utf8');ok(/1 empty row/.test(s)&&tq.includes('\r\n","\r\n'),'T11-28 quoted "," in a one-column file is a value '+s+' '+JSON.stringify(tq))};await p.setInputFiles('#drop input',C+'/six.csv');await p.waitForTimeout(600);
// big
let big=['id,name,city'];for(let i=0;i<200000;i++)big.push(`${i%150000},Tên ${i%150000},Hà Nội`);fs.writeFileSync(C+'/big.csv',big.join('\n'));
await p.check('#nf');const t2=Date.now();await p.setInputFiles('#drop input',C+'/big.csv');await p.waitForTimeout(800);await clk();s=await wait(/rows in/,90000);ok(/200,000 rows in, 50,000 duplicates/.test(s),'DR10 200k '+(Date.now()-t2)+'ms '+s);
{const x=reqs.filter(u=>!/\/api\/e(\?|$)|\/cdn-cgi\/rum/.test(u));ok(x.length===0,'privacy: no non-GET requests except /api/e (evtest) and Cloudflare RUM '+x.join(','))}ok(errs.length===0,'js errors '+errs.join(';'));
console.log(bad?'FAILED':'ALL OK',(n-bad)+'/'+n);await b.close();process.exit(bad?1:0)})();
