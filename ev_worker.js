const ACT=new Set(['calc','upload','process_done','download','copy']);const LANGS=new Set(['en','es','pt','fr','de','it','id','vi','ja']);
const RL=new Map();let RLmin=0;
function uaf(ua){ua=ua||'';if(/bot|crawl|spider|slurp|headless|python|curl|wget|go-http|java\/|node|axios|scrapy|phantom|lighthouse|pingdom|uptime/i.test(ua))return 'bot';if(/Edg\//.test(ua))return 'edge';if(/OPR\/|Opera/.test(ua))return 'opera';if(/SamsungBrowser/.test(ua))return 'samsung';if(/Firefox|FxiOS/.test(ua))return 'firefox';if(/Chrome|CriOS/.test(ua))return 'chrome';if(/Safari/.test(ua))return 'safari';return 'other'}
async function ev(req,env,site){
 const no=new Response(null,{status:204});
 if(req.method!=='POST'||!env.DB)return no;
 const ip=req.headers.get('cf-connecting-ip')||'';const m=Math.floor(Date.now()/60000);if(m!==RLmin){RL.clear();RLmin=m}const c=(RL.get(ip)||0)+1;RL.set(ip,c);if(c>30)return no;
 const len=+req.headers.get('content-length')||0;if(len>300)return no;
 let t;try{t=await req.text()}catch(e){return no}if(t.length>300)return no;
 let j;try{j=JSON.parse(t)}catch(e){return no}
 const tool=String(j.t||''),a=String(j.a||''),l=String(j.l||'en');
 if(!/^[a-z0-9-]{2,60}$/.test(tool)||!ACT.has(a)||!LANGS.has(l))return no;
 const cf=req.cf||{},bm=cf.botManagement||{};
 const score=typeof bm.score==='number'?bm.score:null;const vb=(bm.verifiedBot===true||!!cf.verifiedBotCategory)?1:0;
 const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
 try{await env.DB.prepare('INSERT INTO ev(ts,day,site,tool,action,lang,country,bot_score,verified_bot,ua,test) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(now,day,site,tool,a,l,String(cf.country||'').slice(0,2)||null,score,vb,uaf(req.headers.get('user-agent')),j.x===1?1:0).run()}catch(e){}
 return no}
async function usage(req,env,site){
 const k=env.REPORT_KEY;if(!k||req.headers.get('authorization')!=='Bearer '+k)return new Response('no',{status:404});
 const u=new URL(req.url),from=u.searchParams.get('from')||'2000-01-01',del=u.searchParams.get('delete_test');
 if(req.method==='POST'&&del==='1'){const r=await env.DB.prepare('DELETE FROM ev WHERE test=1 AND site=?').bind(site).run();return Response.json({deleted:r.meta.changes})}
 const r=await env.DB.prepare('SELECT day,tool,action,test,verified_bot,bot_score IS NOT NULL AND bot_score<30 AS low,ua,COUNT(*) n FROM ev WHERE site=? AND day>=? GROUP BY 1,2,3,4,5,6,7 ORDER BY 1,2,3').bind(site,from).all();
 return Response.json({site,rows:r.results},{headers:{'cache-control':'no-store'}})}
