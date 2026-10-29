/* Anonymous, cookie-free tool-usage counter (shared by PorchMath and FileMoss).
 Stores: day, site, tool, action, language, country, bot flags, browser family. No IP, no inputs, no files.
 Rate limit: 30 events per IP per minute, counted in D1 (table rl) under a salted SHA-256 key; rows older than 2 minutes are deleted. */
const ACT=new Set(['calc','upload','process_done','download','copy']);const LANGS=new Set(['en','es','pt','fr','de','it','id','vi','ja']);
const RL_MAX=30;let READY=null;
function uaf(ua){ua=ua||'';if(!/^Mozilla\/5\.0 \(/.test(ua))return 'bot';if(/bot|crawl|spider|slurp|headless|python|curl|wget|go-http|java\/|node|axios|scrapy|phantom|lighthouse|pingdom|uptime|playwright|puppeteer|selenium|electron/i.test(ua))return 'bot';if(/Edg\//.test(ua))return 'edge';if(/OPR\/|Opera/.test(ua))return 'opera';if(/SamsungBrowser/.test(ua))return 'samsung';if(/Firefox|FxiOS/.test(ua))return 'firefox';if(/Chrome|CriOS/.test(ua))return 'chrome';if(/Safari/.test(ua))return 'safari';return 'other'}
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join('')}
function ready(env){if(!READY)READY=env.DB.prepare('CREATE TABLE IF NOT EXISTS rl(k TEXT PRIMARY KEY,m INTEGER NOT NULL,n INTEGER NOT NULL)').run().catch(e=>{READY=null;throw e});return READY}
async function ev(req,env,site,apex,TOOLS){
 const no=new Response(null,{status:204});
 if(req.method!=='POST'||!env.DB)return no;
 const own='https://'+apex,org=req.headers.get('origin'),ref=req.headers.get('referer')||'';
 if(org?org!==own:!(ref===own||ref.startsWith(own+'/')))return no;
 if(ref&&!(ref===own||ref.startsWith(own+'/')))return no;
 const len=+req.headers.get('content-length')||0;if(len>300)return no;
 let t;try{t=await req.text()}catch(e){return no}if(t.length>300)return no;
 let j;try{j=JSON.parse(t)}catch(e){return no}
 const tool=String(j.t||''),a=String(j.a||''),l=String(j.l||'en');
 if(!TOOLS.has(tool)||!ACT.has(a)||!LANGS.has(l))return no;
 const m=Math.floor(Date.now()/60000),ip=req.headers.get('cf-connecting-ip')||'';
 try{await ready(env);const k=site+':'+await sha(ip+'|'+m+'|'+(env.REPORT_KEY||'s'));
  const r=await env.DB.prepare('INSERT INTO rl(k,m,n) VALUES(?,?,1) ON CONFLICT(k) DO UPDATE SET n=n+1 RETURNING n').bind(k,m).first();
  if(Math.random()<0.05)await env.DB.prepare('DELETE FROM rl WHERE m<?').bind(m-2).run();
  if(!r||r.n>RL_MAX)return no}catch(e){return no}
 const cf=req.cf||{},bm=cf.botManagement||{};
 const score=typeof bm.score==='number'?bm.score:null;const vb=(bm.verifiedBot===true||!!cf.verifiedBotCategory)?1:0;
 let ua=uaf(req.headers.get('user-agent'));const sf=req.headers.get('sec-fetch-site');if(sf&&sf!=='same-origin')ua='bot';
 let test=0;try{test=/[?&]evtest=1(&|$)/.test(new URL(ref).search)?1:0}catch(e){}
 const day=new Date().toISOString().slice(0,10),ts=Date.parse(day);
 try{await env.DB.prepare('INSERT INTO ev(ts,day,site,tool,action,lang,country,bot_score,verified_bot,ua,test) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(ts,day,site,tool,a,l,String(cf.country||'').slice(0,2)||null,score,vb,ua,test).run()}catch(e){}
 return no}
async function usage(req,env,site){
 const k=env.REPORT_KEY;if(!k||req.headers.get('authorization')!=='Bearer '+k)return new Response('no',{status:404});
 const u=new URL(req.url),from=u.searchParams.get('from')||'2000-01-01',del=u.searchParams.get('delete_test'),dbd=u.searchParams.get('delete_bot_day');
 if(req.method==='POST'&&del==='1'){const r=await env.DB.prepare('DELETE FROM ev WHERE test=1 AND site=?').bind(site).run();return Response.json({deleted:r.meta.changes})}
 if(req.method==='POST'&&dbd&&/^\d{4}-\d{2}-\d{2}$/.test(dbd)){const r=await env.DB.prepare("DELETE FROM ev WHERE ua='bot' AND site=? AND day=?").bind(site,dbd).run();return Response.json({deleted:r.meta.changes})}
 const r=await env.DB.prepare('SELECT day,tool,action,test,verified_bot,bot_score IS NOT NULL AND bot_score<30 AS low,ua,COUNT(*) n FROM ev WHERE site=? AND day>=? GROUP BY 1,2,3,4,5,6,7 ORDER BY 1,2,3').bind(site,from).all();
 return Response.json({site,rows:r.results},{headers:{'cache-control':'no-store'}})}
