// PDF→Word: converts sample PDFs in the browser and saves the .docx files. Usage: node test_pdf2word.js BASEURL SAMPLEDIR OUTDIR
const {chromium}=require('playwright-core');const fs=require('fs'),path=require('path');
const [base,dir,out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});let bad=0;const ST={};
for(const [vp,mob] of [[{width:1280,height:900},0],[{width:390,height:844},1]]){const ctx=await b.newContext({viewport:vp,acceptDownloads:true,isMobile:!!mob,hasTouch:!!mob});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.pdf'))){await pg.goto(base+'/pdf-to-word/?evtest=1');await pg.setInputFiles('input[type=file]',path.join(dir,f));await pg.click('#go');await pg.waitForFunction(()=>!document.querySelector('#go').disabled&&document.querySelector('#out .fileout'),null,{timeout:60000});
 const st=await pg.textContent('#status'),hint=await pg.$('.ocrhint a');const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#out .fileout button')]);const o=path.join(out,(mob?'m_':'')+f.replace('.pdf','.docx'));await dl.saveAs(o);
 const notes=await pg.$$eval('#out p.status',e=>e.map(x=>x.textContent));ST[(mob?'m_':'')+f]={status:st,ocrhint:!!hint,href:hint?await hint.getAttribute('href'):null,notes:notes};console.log((mob?'mobile ':'desktop ')+f,'|',st,'| ocrhint:',!!hint);}
if(mob){const small=await pg.evaluate(()=>[...document.querySelectorAll('#go,#out button,.ocrhint a,label.drop,#drop')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<44).map(e=>e.id||e.className||e.tagName));console.log('mobile <44px:',JSON.stringify(small));if(small.length)bad=1}
if(errs.length){console.log('ERR',errs);bad=1}await ctx.close()}
fs.writeFileSync(path.join(out,'_status.json'),JSON.stringify(ST,null,1));await b.close();process.exit(bad)})();
