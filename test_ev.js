// Server-side tests for /api/e (ev_worker.js) with an in-memory D1 mock. Run: node test_ev.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'ev_worker.js'),'utf8')+';this.ev=ev;this.usage=usage;this.uaf=uaf;';
function mkdb(){const rl=new Map(),ev=[];return {rl,ev,prepare(sql){let a=[];const st={bind(...x){a=x;return st},
 async run(){if(/^CREATE/.test(sql))return {};if(/^DELETE FROM rl/.test(sql)){for(const [k,v] of rl)if(v.m<a[0])rl.delete(k);return {}}
  if(/^INSERT INTO ev/.test(sql)){ev.push(a);return {}}if(/^DELETE FROM ev/.test(sql)){return {meta:{changes:0}}}throw new Error('sql '+sql)},
 async first(){if(/^INSERT INTO rl/.test(sql)){const o=rl.get(a[0])||{m:a[1],n:0};o.n++;rl.set(a[0],o);return {n:o.n}}},
 async all(){return {results:[]}}};return st}}}
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
 await ctx.ev(req(good,{'cf-connecting-ip':'7.7.7.7'}),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===31,'other IP not limited');
 ok(![...db.rl.keys()].some(k=>k.includes('1.2.3.4')),'no raw IP in rate-limit keys');
 // method, size, bad json, no DB
 db=mkdb();env.DB=db;await ctx.ev(new Request('https://porchmath.com/api/e',{method:'GET'}),env,'porchmath','porchmath.com',TOOLS);await ctx.ev(req('x'.repeat(400)),env,'porchmath','porchmath.com',TOOLS);await ctx.ev(req('{bad'),env,'porchmath','porchmath.com',TOOLS);ok(db.ev.length===0,'GET/oversize/bad json rejected');
 const r=await ctx.ev(req(good),{},'porchmath','porchmath.com',TOOLS);ok(r.status===204,'no DB -> 204');
 // usage auth
 const u1=await ctx.usage(new Request('https://porchmath.com/api/usage'),env,'porchmath');ok(u1.status===404,'usage without key 404');
 const u2=await ctx.usage(new Request('https://porchmath.com/api/usage',{headers:{authorization:'Bearer k'}}),env,'porchmath');ok(u2.status===200,'usage with key 200');
 console.log(fail?`${fail}/${n} ev tests failed`:`ev: all ${n} tests passed`);process.exit(fail?1:0)})();
