// Redirect/IndexNow host rules for _worker.js. Run after build.py. Never prints the key.
const fs=require('fs'),vm=require('vm'),path=require('path');
const key=fs.readFileSync(path.join(__dirname,'.indexnow_key'),'utf8').trim();
const workerPath=path.join(__dirname,'dist/_worker.js');
if(!fs.existsSync(workerPath)){console.error('missing dist/_worker.js — run python3 build.py first');process.exit(1)}
const src=fs.readFileSync(workerPath,'utf8').replace(/export default/,'this.__worker=');
const ctx={Response,URL,Headers,Request,console,JSON,Set,Map,String,Number,Promise,Uint8Array,TextEncoder,crypto:require('crypto').webcrypto,Date,Math};
vm.createContext(ctx);vm.runInContext(src,ctx);
const worker=ctx.__worker;
const keyPath='/'+key+'.txt';
const assetBody=key;
const env={ASSETS:{async fetch(req){
  const u=new URL(req.url);
  if(u.pathname===keyPath) return new Response(assetBody,{status:200,headers:{'content-type':'text/plain; charset=utf-8'}});
  return new Response('no',{status:404});
}}};
let fail=0,n=0;
const red=s=>String(s).split(key).join('[KEY]');
async function hit(url){
  const res=await worker.fetch(new Request(url),env);
  const loc=res.headers.get('location')||'';
  const ct=res.headers.get('content-type')||'';
  const body=Buffer.from(await res.arrayBuffer()).toString('utf8');
  return {status:res.status,loc,ct,body,eq:body===key};
}
async function check(url,exp,msg){
  n++;
  const r=await hit(url);
  const ok=exp(r);
  if(!ok){fail++;console.log('FAIL',msg,red(JSON.stringify({url,status:r.status,loc:r.loc,ct:r.ct,eq:r.eq,len:r.body.length})));}
}
(async()=>{
  await check('https://filemoss.pages.dev'+keyPath,r=>r.status===200&&r.eq&&/^text\/plain/i.test(r.ct)&&!r.loc,'pages.dev key 200 text/plain body=key');
  await check('https://www.filemoss.com'+keyPath,r=>r.status===200&&r.eq&&/^text\/plain/i.test(r.ct)&&!r.loc,'www key 200 text/plain body=key');
  await check('https://filemoss.com'+keyPath,r=>r.status===200&&r.eq&&/^text\/plain/i.test(r.ct),'apex key 200 via ASSETS');
  await check('https://filemoss.pages.dev/',r=>r.status===301&&r.loc==='https://filemoss.com/','pages.dev / 301');
  await check('https://filemoss.pages.dev/heic-to-jpg/',r=>r.status===301&&r.loc==='https://filemoss.com/heic-to-jpg/','pages.dev tool 301');
  await check('https://filemoss.pages.dev/heic-to-jpg/?q=1',r=>r.status===301&&r.loc==='https://filemoss.com/heic-to-jpg/?q=1','pages.dev query preserved');
  await check('https://filemoss.pages.dev/sitemap.xml',r=>r.status===301&&r.loc==='https://filemoss.com/sitemap.xml','pages.dev sitemap 301');
  await check('https://filemoss.pages.dev/robots.txt',r=>r.status===301&&r.loc==='https://filemoss.com/robots.txt','pages.dev robots 301');
  await check('https://www.filemoss.com/',r=>r.status===301&&r.loc==='https://filemoss.com/','www / 301 apex');
  await check('https://www.filemoss.com/heic-to-jpg/?x=2',r=>r.status===301&&r.loc==='https://filemoss.com/heic-to-jpg/?x=2','www path+query 301');
  // fallback if ASSETS misses the file
  const envMiss={ASSETS:{async fetch(){return new Response('',{status:404})}}};
  n++;
  const r=await worker.fetch(new Request('https://filemoss.pages.dev'+keyPath),envMiss);
  const body=Buffer.from(await r.arrayBuffer()).toString('utf8');
  if(!(r.status===200&&body===key&&/^text\/plain/i.test(r.headers.get('content-type')||''))){fail++;console.log('FAIL ASSETS 404 fallback');}
  console.log(fail?`${fail}/${n} canonical tests failed`:`canonical: all ${n} tests passed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
