// Server-side tests for /api/e (ev_worker.js) with an in-memory D1 mock. Run: node test_ev.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'ev_worker.js'),'utf8')+';this.ev=ev;this.usage=usage;this.uaf=uaf;this.rlsub=rlsub;';
// D1 mock modelling SQLite semantics that matter here: CREATE TABLE IF NOT EXISTS keeps an existing (possibly legacy) schema;
// ON CONFLICT(k) only merges when k is really the PRIMARY KEY; otherwise every INSERT adds a new row and RETURNING n gives 1.
function mkdb(legacy){const T={},ev=[];if(legacy)for(const t of legacy)T[t]={pk:false,rows:[]};
 const tbl=sql=>(sql.match(/\b(?:INTO|FROM|EXISTS)\s+(rl\w*)/)||[])[1];
 const db={T,ev,get rl(){const m=new Map();for(const t in T)for(const r of T[t].rows)m.set(r.k,r);return m},prepare(sql){let a=[];const st={bind(...x){a=x;return st},
 async run(){if(/^CREATE/.test(sql)){const t=tbl(sql);if(!T[t])T[t]={pk:/k TEXT PRIMARY KEY/.test(sql),rows:[]};return {}}
  if(/^DELETE FROM rl/.test(sql)){const t=T[tbl(sql)];if(!t)throw new Error('no such table');t.rows=t.rows.filter(r=>r.m>=a[0]);return {}}
  if(/^INSERT INTO ev/.test(sql)){ev.push(a);return {}}if(/^DELETE FROM ev/.test(sql)){return {meta:{changes:0}}}throw new Error('sql '+sql)},
 async first(){const t=T[tbl(sql)];if(/^(INSERT|SELECT)/.test(sql)&&!t)throw new Error('no such table');
  if(/^INSERT INTO rl/.test(sql)){let o=t.pk&&t.rows.find(r=>r.k===a[0]);if(!o){o={k:a[0],m:a[1],n:0};t.rows.push(o)}o.n++;return {n:o.n}}
  if(/^SELECT n FROM rl/.test(sql)){const o=t.rows.find(r=>r.k===a[0]);return o?{n:o.n}:null}},
 async all(){return {results:[]}}};return st}};return db}
const mkctx=()=>{const c={crypto:require('crypto').webcrypto,TextEncoder,Response,URL,Date,Math,console,JSON,Set,Map,String,Number,Promise,Uint8Array};vm.createContext(c);vm.runInContext(src,c);return c};let ctx=mkctx();
const TOOLS=new Set(['brick-calculator','merge-pdf']);
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
function req(body,h={}){const hd=Object.assign({'content-type':'text/plain','origin':'https://porchmath.com','referer':'https://porchmath.com/brick-calculator/','user-agent':UA,'cf-connecting-ip':'1.2.3.4','sec-fetch-site':'same-origin'},h);for(const k in hd)if(hd[k]===null)delete hd[k];
 return new Request('https://porchmath.com/api/e',{method:'POST',headers:hd,body:typeof body==='string'?body:JSON.stringify(body)})}
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('FAIL',m)}};
const good={t:'brick-calculator',a:'calc',l:'vi'};
(async()=>{
 let db=mkdb(),env={DB:db,REPORT_KEY:'k'};
 await ctx.ev(req(good),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===1,'valid event stored');
 const row=db.ev[0];ok(row[2]==='porchmath'&&row[3]==='brick-calculator'&&row[4]==='calc'&&row[5]==='vi','row fields');ok(row[9]==='chrome','ua chrome');ok(row[10]===0,'test=0');ok(row[0]===Date.parse(row[1]),'ts is day-level');
 // allowlist
 db=mkdb();env.DB=db;await ctx.ev(req({t:'evil-tool',a:'calc',l:'en'}),env,'porchmath','porchmath.com',TOOLS);await ctx.ev(req({t:'merge-pdf',a:'nope',l:'en'}),env,'porchmath','porchmath.com',TOOLS);await ctx.ev(req({t:'merge-pdf',a:'calc',l:'xx'}),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===0,'unknown slug, action and language rejected');
 db=mkdb();env.DB=db;await ctx.ev(req({t:'evil-tool',a:'calc',l:'en'}),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===0,'unknown slug rejected');
 // origin / referer
 db=mkdb();env.DB=db;
 await ctx.ev(req(good,{origin:'https://evil.com'}),env,'porchmath','porchmath.com',TOOLS);
 await ctx.ev(req(good,{origin:null,referer:null}),env,'porchmath','porchmath.com',TOOLS);
 await ctx.ev(req(good,{origin:null,referer:'https://porchmath.com.evil.com/x'}),env,'porchmath','porchmath.com',TOOLS);
 await ctx.ev(req(good,{origin:'https://filemoss.com',referer:'https://filemoss.com/'}),env,'porchmath','porchmath.com',TOOLS);
 ok(db.ev.length===0,'foreign/missing origin rejected');
 await ctx.ev(req(good,{origin:null}),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===1,'same-site referer without origin accepted');
 // client x flag ignored, evtest from referer
 db=mkdb();env.DB=db;await ctx.ev(req({...good,x:1}),env,'porchmath','porchmath.com',TOOLS);ok(db.ev[0][10]===0,'client x flag ignored');
 await ctx.ev(req(good,{'cf-connecting-ip':'9.9.9.9',referer:'https://porchmath.com/brick-calculator/?evtest=1'}),env,'porchmath','porchmath.com',TOOLS);ok(db.ev[1][10]===1,'evtest=1 page marks test');
 // bots
 db=mkdb();env.DB=db;
 for(const [ua,i] of [['python-requests/2.31',1],['curl/8.0',2],['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0 Safari/537.36',3],['',4]])await ctx.ev(req(good,{'user-agent':ua,'cf-connecting-ip':'5.5.5.'+i}),env,'porchmath','porchmath.com',TOOLS);
 await ctx.ev(req(good,{'sec-fetch-site':'cross-site','cf-connecting-ip':'6.6.6.6'}),env,'porchmath','porchmath.com',TOOLS);
 ok(db.ev.length===5&&db.ev.every(r=>r[9]==='bot'),'non-browser traffic marked bot');
 // rate limit: 80 events in one minute from one IP -> at most 30 stored, also across "isolates" (fresh module state)
 db=mkdb();env.DB=db;for(let i=0;i<80;i++){if(i===40)ctx=mkctx();await ctx.ev(req(good),env,'porchmath','porchmath.com',TOOLS)}ok(db.ev.length===30,'rate limit 30/min shared via D1, got '+db.ev.length);
 // regression (live bug 29 Oct): legacy rl table without a PRIMARY KEY made ON CONFLICT a no-op -> every hit stored
 db=mkdb(['rl']);env.DB=db;ctx=mkctx();for(let i=0;i<40;i++)await ctx.ev(req(good),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===30,'legacy rl table: 40 hits -> 30 stored, got '+db.ev.length);
 // regression: 40 hits within 60 s that straddle a minute boundary (20 + 20) must not all be stored
 {const RD=Date.now;db=mkdb();env.DB=db;ctx=mkctx();const base=Math.floor(RD()/60000)*60000;
  for(let i=0;i<40;i++){const t=base+(i<20?59000:61000);ctx.Date.now=()=>t;await ctx.ev(req(good),env,'porchmath','porchmath.com',TOOLS)}
  ok(db.ev.length===30,'rolling minute across boundary: 40 -> 30 stored, got '+db.ev.length);
  // two minutes later the window is free again
  const t2=base+190000;ctx.Date.now=()=>t2;const before=db.ev.length;await ctx.ev(req(good),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===before+1,'window frees after 2 min');ctx.Date.now=RD}
 {const b=db.ev.length;await ctx.ev(req(good,{'cf-connecting-ip':'7.7.7.7'}),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===b+1,'other IP not limited')}
 ok(![...db.rl.keys()].some(k=>k.includes('1.2.3.4')),'no raw IP in rate-limit keys');
 // method, size, bad json, no DB
 db=mkdb();env.DB=db;await ctx.ev(new Request('https://porchmath.com/api/e',{method:'GET'}),env,'porchmath','porchmath.com',TOOLS);await ctx.ev(req('x'.repeat(400)),env,'porchmath','porchmath.com',TOOLS);await ctx.ev(req('{bad'),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===0,'GET/oversize/bad json rejected');
 const r=await ctx.ev(req(good),{},'porchmath','porchmath.com',TOOLS);ok(r.status===204,'no DB -> 204');
 // usage auth
 const u1=await ctx.usage(new Request('https://porchmath.com/api/usage'),env,'porchmath');ok(u1.status===404,'usage without key 404');
 const u2=await ctx.usage(new Request('https://porchmath.com/api/usage',{headers:{authorization:'Bearer k'}}),env,'porchmath');ok(u2.status===200,'usage with key 200');
 // rotating Cloudflare/WARP egress (live bug 29 Oct: each hit had a new 2a09:bac?:... address) shares one bucket
 db=mkdb();env.DB=db;for(let i=0;i<40;i++)await ctx.ev(req(good,{'cf-connecting-ip':'2a09:bac'+(1+i%5)+':'+(0xd450+i).toString(16)+':'+i+'::'+i}),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===30,'rotating WARP IPv6: 40 -> 30 stored, got '+db.ev.length);
 db=mkdb();env.DB=db;for(let i=0;i<40;i++){const r=req(good,{'cf-connecting-ip':'198.51.100.'+i});Object.defineProperty(r,'cf',{value:{asn:13335}});await ctx.ev(r,env,'porchmath','porchmath.com',TOOLS)}ok(db.ev.length===30,'AS13335 shares one bucket, got '+db.ev.length);
 ok(ctx.rlsub('2001:db8:1:2:aaaa::1')===ctx.rlsub('2001:db8:1:2:bbbb::9'),'IPv6 same /64 shares bucket');ok(ctx.rlsub('2001:db8:1:2::1')!==ctx.rlsub('2001:db8:1:3::1'),'other /64 separate');
 console.log(fail?`${fail}/${n} ev tests failed`:`ev: all ${n} tests passed`);process.exit(fail?1:0)})();
