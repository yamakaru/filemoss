/* FileMoss core logic – pure functions, shared by pages and tests. */
(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else root.DK=f();})(this,function(){
var DK={};
DK.esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
DK.fmt=function(x,d){if(!isFinite(x))return '—';d=d==null?2:d;return (+x).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:d})};
DK.money=function(x){if(!isFinite(x))return '—';return '$'+(+x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})};
/* ---------- text ---------- */
DK.countText=function(s){s=s||'';var w=(s.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-_.@]*/gu)||[]).length;
 var t=s.trim(),sent=t?(t.match(/[^.!?]*[\p{L}\p{N}][^.!?]*([.!?]+|$)/gu)||[]).filter(function(x){return x.trim()}).length:0;
 var para=t?t.split(/\n\s*\n/).filter(function(p){return p.trim()}).length:0;
 return {words:w,chars:[...s].length,charsNoSpaces:[...s.replace(/\s/g,'')].length,sentences:sent,paragraphs:para,lines:s?s.split(/\r?\n/).length:0,readMin:w/238,speakMin:w/140};};
var SMALL=/^(a|an|and|as|at|but|by|for|in|nor|of|on|or|per|so|the|to|up|via|vs?\.?|yet)$/i;
function words(s){return s.replace(/([a-z0-9])([A-Z])/g,'$1 $2').split(/[^\p{L}\p{N}]+/u).filter(Boolean)}
DK.convertCase=function(s,m){s=s||'';switch(m){
 case 'upper':return s.toUpperCase();
 case 'lower':return s.toLowerCase();
 case 'sentence':return s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu,function(a,b,c){return b+c.toUpperCase()}).replace(/\bi\b/g,'I');
 case 'capitalized':return s.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu,function(a,b,c){return b+c.toUpperCase()});
 case 'title':return s.split(/(\s+)/).map(function(w,i,arr){if(/^\s+$/.test(w)||!w)return w;var first=i===0,last=i===arr.length-1;var core=w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');
   if(!first&&!last&&SMALL.test(core))return w.toLowerCase();return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase().replace(/([-–—])(\p{L})/gu,function(a,b,c){return b+c.toUpperCase()})}).join('').replace(/(^|[:—]\s*)([a-z])/g,function(a,b,c){return b+c.toUpperCase()});
 case 'camel':return words(s).map(function(w,i){w=w.toLowerCase();return i?w.charAt(0).toUpperCase()+w.slice(1):w}).join('');
 case 'pascal':return words(s).map(function(w){w=w.toLowerCase();return w.charAt(0).toUpperCase()+w.slice(1)}).join('');
 case 'snake':return words(s).map(function(w){return w.toLowerCase()}).join('_');
 case 'kebab':return words(s).map(function(w){return w.toLowerCase()}).join('-');
 case 'constant':return words(s).map(function(w){return w.toUpperCase()}).join('_');
 case 'alternating':var k=0;return s.replace(/\p{L}/gu,function(c){return (k++%2)?c.toUpperCase():c.toLowerCase()});
 case 'inverse':return s.replace(/\p{L}/gu,function(c){var u=c.toUpperCase();return c===u?c.toLowerCase():u});
 default:return s;}};
/* line diff (LCS with common prefix/suffix trimming) */
DK.diffLines=function(a,b,opt){opt=opt||{};var A=a.split(/\r?\n/),B=b.split(/\r?\n/);
 var key=function(x){if(opt.ignoreWs)x=x.replace(/\s+/g,' ').trim();if(opt.ignoreCase)x=x.toLowerCase();return x};
 var KA=A.map(key),KB=B.map(key),p=0;while(p<A.length&&p<B.length&&KA[p]===KB[p])p++;
 var s=0;while(s<A.length-p&&s<B.length-p&&KA[A.length-1-s]===KB[B.length-1-s])s++;
 var a2=KA.slice(p,A.length-s),b2=KB.slice(p,B.length-s),n=a2.length,m=b2.length;
 if(n*m>25e6)throw new Error('Texts too different to compare (over 25 million line pairs).');
 var L=new Uint32Array((n+1)*(m+1)),W=m+1;
 for(var i=n-1;i>=0;i--)for(var j=m-1;j>=0;j--)L[i*W+j]=a2[i]===b2[j]?L[(i+1)*W+j+1]+1:Math.max(L[(i+1)*W+j],L[i*W+j+1]);
 var out=[],k;for(k=0;k<p;k++)out.push({t:'=',a:k+1,b:k+1,s:A[k]});
 i=0;j=0;while(i<n||j<m){if(i<n&&j<m&&a2[i]===b2[j]){out.push({t:'=',a:p+i+1,b:p+j+1,s:A[p+i]});i++;j++}
  else if(i<n&&(j===m||L[(i+1)*W+j]>=L[i*W+j+1])){out.push({t:'-',a:p+i+1,s:A[p+i]});i++}
  else{out.push({t:'+',b:p+j+1,s:B[p+j]});j++}}
 for(k=0;k<s;k++)out.push({t:'=',a:A.length-s+k+1,b:B.length-s+k+1,s:A[A.length-s+k]});
 return out;};
/* ---------- dates ---------- */
function D(y,m,d){return new Date(Date.UTC(y,m,d))}
function nth(y,m,wd,n){var d=D(y,m,1),off=(wd-d.getUTCDay()+7)%7;return D(y,m,1+off+7*(n-1))}
function last(y,m,wd){var d=D(y,m+1,0),off=(d.getUTCDay()-wd+7)%7;return D(y,m,d.getUTCDate()-off)}
function obs(d){var w=d.getUTCDay();return w===6?new Date(d-864e5):w===0?new Date(+d+864e5):d}
DK.usHolidays=function(y){var h=[['New Year\'s Day',obs(D(y,0,1))],['Martin Luther King Jr. Day',nth(y,0,1,3)],['Presidents\' Day (Washington\'s Birthday)',nth(y,1,1,3)],['Memorial Day',last(y,4,1)],['Juneteenth',obs(D(y,5,19))],['Independence Day',obs(D(y,6,4))],['Labor Day',nth(y,8,1,1)],['Columbus Day',nth(y,9,1,2)],['Veterans Day',obs(D(y,10,11))],['Thanksgiving Day',nth(y,10,4,4)],['Christmas Day',obs(D(y,11,25))]];
 var ny=obs(D(y+1,0,1));if(ny.getUTCFullYear()===y)h.push(['New Year\'s Day (observed)',ny]);
 return h.filter(function(x){return x[1].getUTCFullYear()===y}).map(function(x){return {name:x[0],date:iso(x[1])}})};
function iso(d){return d.toISOString().slice(0,10)}DK.iso=iso;
function parse(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!m)return null;var d=D(+m[1],+m[2]-1,+m[3]);return iso(d)===s?d:null}
DK.parseDate=parse;
function holSet(y1,y2){var S={};for(var y=y1;y<=y2;y++)DK.usHolidays(y).forEach(function(h){S[h.date]=h.name});return S}
/* inclusive of start and end, like Excel NETWORKDAYS */
DK.businessDays=function(a,b,o){o=o||{};var s=parse(a),e=parse(b);if(!s||!e)return null;var sign=1;if(e<s){var t=s;s=e;e=t;sign=-1}
 var H=o.holidays?holSet(s.getUTCFullYear(),e.getUTCFullYear()):{},extra={};(o.extra||[]).forEach(function(x){extra[x]=1});
 var wd=0,we=0,hol=[],tot=0;for(var d=new Date(s);d<=e;d=new Date(+d+864e5)){tot++;var w=d.getUTCDay(),k=iso(d);
  if(w===0||w===6){we++;continue}if(H[k]||extra[k]){hol.push({date:k,name:H[k]||'Custom day off'});continue}wd++}
 return {businessDays:wd*sign,totalDays:tot,weekendDays:we,holidays:hol}};
DK.addBusinessDays=function(a,n,o){o=o||{};var d=parse(a);if(!d||!isFinite(n))return null;n=Math.trunc(n);var step=n<0?-1:1,H=o.holidays?holSet(d.getUTCFullYear()-2,d.getUTCFullYear()+2+Math.ceil(Math.abs(n)/250)):{};
 var c=0;while(c<Math.abs(n)){d=new Date(+d+step*864e5);var w=d.getUTCDay();if(w===0||w===6||H[iso(d)])continue;c++}return iso(d)};
/* ---------- time card ---------- */
DK.parseTime=function(s){s=String(s||'').trim().toLowerCase();var m=/^(\d{1,2})(?::?(\d{2}))?\s*(a|am|p|pm)?$/.exec(s);if(!m)return null;var h=+m[1],mi=+(m[2]||0);if(mi>59)return null;
 if(m[3]){if(h<1||h>12)return null;if(h===12)h=0;if(m[3][0]==='p')h+=12}else if(h>23)return null;return h*60+mi};
DK.timecard=function(rows,rate,otAfter,otMult){var tot=0,out=[];rows.forEach(function(r){if(!String(r.in||'').trim()&&!String(r.out||'').trim()){out.push(0);return}var i=DK.parseTime(r.in),o=DK.parseTime(r.out);if(i==null||o==null){out.push(null);return}
 var m=o-i;if(m<=0)m+=1440;m-=(+r.brk||0);if(m<0)m=0;out.push(m/60);tot+=m});var h=tot/60,ot=otAfter>0?Math.max(0,h-otAfter):0,reg=h-ot;
 rate=+rate||0;otMult=otMult==null?1.5:+otMult;return {days:out,hours:h,regular:reg,overtime:ot,pay:reg*rate+ot*rate*otMult}};
DK.hm=function(h){if(h==null||!isFinite(h))return '—';var m=Math.round(h*60);return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'};
/* ---------- salary ---------- */
DK.salary=function(amount,per,hpw,wpy){hpw=+hpw;wpy=+wpy;var hrs=hpw*wpy,f={hour:1,day:hpw/5,week:hpw,biweek:hpw*2,semimonth:hrs/24,month:hrs/12,year:hrs}[per];
 var hourly=amount/f;return {hourly:hourly,daily:hourly*hpw/5,weekly:hourly*hpw,biweekly:hourly*hpw*2,semimonthly:hourly*hrs/24,monthly:hourly*hrs/12,annual:hourly*hrs}};
/* ---------- percent ---------- */
DK.pct={of:function(p,x){return p/100*x},what:function(x,y){return x/y*100},change:function(a,b){return (b-a)/Math.abs(a)*100},
 inc:function(x,p){return x*(1+p/100)},dec:function(x,p){return x*(1-p/100)},diff:function(a,b){return Math.abs(a-b)/((a+b)/2)*100}};
/* ---------- meeting cost ---------- */
DK.meetingCost=function(people,rate,isAnnual,minutes,perWeek){var h=isAnnual?rate/2080:rate,c=people*h*minutes/60;return {hourlyEach:h,perMeeting:c,perMinute:people*h/60,perYear:c*(perWeek||0)*52}};
/* ---------- time zones ---------- */
DK.tzOffset=function(tz,ms){var f=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
 var p={};f.formatToParts(new Date(ms)).forEach(function(x){p[x.type]=x.value});return (Date.UTC(+p.year,p.month-1,+p.day,+p.hour,+p.minute,+p.second)-Math.floor(ms/1000)*1000)/60000};
DK.zonedToUtc=function(date,time,tz){var d=parse(date),t=DK.parseTime(time);if(!d||t==null)return null;var guess=+d+t*60000;
 var o1=DK.tzOffset(tz,guess),u=guess-o1*60000,o2=DK.tzOffset(tz,u);if(o2!==o1)u=guess-o2*60000;return u};
DK.fmtZone=function(ms,tz){return new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(ms))};
DK.hourIn=function(ms,tz){return ((new Date(ms).getUTCHours()*60+new Date(ms).getUTCMinutes()+DK.tzOffset(tz,ms))%1440+1440)%1440/60};
/* ---------- CSV ---------- */
DK.detectDelim=function(s){var line=s.split(/\r?\n/).slice(0,5).join('\n'),best=',',bc=-1;[',',';','\t','|'].forEach(function(d){var c=line.split(d).length;if(c>bc){bc=c;best=d}});return best};
DK.parseCSV=function(s,delim){s=s.replace(/^\uFEFF/,'');delim=delim||DK.detectDelim(s);var rows=[],row=[],f='',q=false,i=0,c;
 for(;i<s.length;i++){c=s[i];if(q){if(c==='"'){if(s[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
  else if(c==='"'&&f==='')q=true;else if(c===delim){row.push(f);f=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f=''}else f+=c}
 if(f!==''||row.length){row.push(f);rows.push(row)}return rows};
DK.csvToJson=function(s,o){o=o||{};var r=DK.parseCSV(s,o.delim);if(!r.length)return [];var conv=function(v){if(!o.types)return v;if(/^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/.test(v))return +v;if(v==='true')return true;if(v==='false')return false;if(v==='')return null;return v};
 if(o.header===false)return r.map(function(x){return x.map(conv)});var h=r[0];return r.slice(1).filter(function(x){return !(x.length===1&&x[0]==='')}).map(function(x){var ob={};h.forEach(function(k,i){ob[k]=conv(x[i]==null?'':x[i])});return ob})};
DK.toCSV=function(rows,delim){delim=delim||',';return rows.map(function(r){return r.map(function(v){v=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);return /[",\r\n]/.test(v)||v.indexOf(delim)>-1?'"'+v.replace(/"/g,'""')+'"':v}).join(delim)}).join('\r\n')};
DK.jsonToCsv=function(txt,delim){var d=typeof txt==='string'?JSON.parse(txt):txt;if(!Array.isArray(d))d=[d];if(d.length&&Array.isArray(d[0]))return DK.toCSV(d,delim);
 var keys=[];d.forEach(function(o){Object.keys(o||{}).forEach(function(k){if(keys.indexOf(k)<0)keys.push(k)})});return DK.toCSV([keys].concat(d.map(function(o){return keys.map(function(k){return o[k]})})),delim)};
/* ---------- page ranges ---------- */
DK.parseRanges=function(s,n){var groups=[];String(s).split(/[,;]/).forEach(function(p){p=p.trim();if(!p)return;var m=/^(\d+)(?:\s*-\s*(\d+|end))?$/i.exec(p);if(!m)throw new Error('Invalid range: "'+p+'"');
 var a=+m[1],b=m[2]?(m[2].toLowerCase()==='end'?n:+m[2]):a;if(a<1||b<1||a>n||b>n)throw new Error('Page '+(a>n||a<1?a:b)+' is out of range (1–'+n+')');var g=[],st=a<=b?1:-1;for(var i=a;st>0?i<=b:i>=b;i+=st)g.push(i);groups.push(g)});
 if(!groups.length)throw new Error('Enter at least one page or range');return groups};
/* ---------- image helpers ---------- */
DK.fitSize=function(w,h,maxW,maxH,keep){maxW=+maxW||0;maxH=+maxH||0;if(!keep)return [Math.round(maxW||w),Math.round(maxH||h)];var r=Math.min(maxW?maxW/w:Infinity,maxH?maxH/h:Infinity);if(!isFinite(r))r=1;return [Math.max(1,Math.round(w*r)),Math.max(1,Math.round(h*r))]};
DK.fileSize=function(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB'};
DK.renameExt=function(name,ext){return name.replace(/\.[^./\\]+$/,'')+'.'+ext};
/* ---------- email signature ---------- */
DK.signature=function(o){var e=DK.esc,c=/^#[0-9a-f]{3,8}$/i.test(o.color||'')?o.color:'#1d4ed8',L=[];
 var link=function(h,t){return '<a href="'+e(h)+'" style="color:'+c+';text-decoration:none">'+e(t)+'</a>'};
 if(o.phone)L.push(link('tel:'+String(o.phone).replace(/[^\d+]/g,''),o.phone));if(o.email)L.push(link('mailto:'+o.email,o.email));
 if(o.website)L.push(link(/^https?:\/\//i.test(o.website)?o.website:'https://'+o.website,String(o.website).replace(/^https?:\/\//i,'')));
 var title=[o.title,o.company].filter(Boolean).map(e).join(' | ');
 return '<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#333333"><tr>'+
 (o.photo?'<td style="padding-right:14px;vertical-align:top"><img src="'+e(o.photo)+'" width="72" height="72" alt="" style="border-radius:50%;display:block"></td>':'')+
 '<td style="border-left:3px solid '+c+';padding-left:12px;vertical-align:top"><div style="font-size:16px;font-weight:bold;color:#111111">'+e(o.name||'')+'</div>'+
 (title?'<div style="color:#555555">'+title+'</div>':'')+(L.length?'<div style="margin-top:6px">'+L.join(' &nbsp;|&nbsp; ')+'</div>':'')+
 (o.address?'<div style="color:#777777">'+e(o.address)+'</div>':'')+'</td></tr></table>'};
/* ---------- delete pages / password ---------- */
DK.pagesExcept=function(groups,n){var r={},k=[];groups.forEach(function(g){g.forEach(function(x){r[x]=1})});for(var i=1;i<=n;i++)if(!r[i])k.push(i);if(!k.length)throw new Error('You cannot delete every page — keep at least one');return k};
DK.PW_SETS={lower:'abcdefghijklmnopqrstuvwxyz',upper:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',digits:'0123456789',symbols:'!@#$%^&*()-_=+[]{};:,.?/~'};
DK.randInt=function(max){var c=(typeof crypto!=='undefined'&&crypto.getRandomValues)?crypto:require('crypto').webcrypto,lim=Math.floor(4294967296/max)*max,a=new Uint32Array(1);do{c.getRandomValues(a)}while(a[0]>=lim);return a[0]%max};
DK.password=function(o){var len=Math.max(4,Math.min(128,Math.floor(+o.length||16))),sets=[];['lower','upper','digits','symbols'].forEach(function(k){if(o[k]){var s=DK.PW_SETS[k];if(o.noSimilar)s=s.replace(/[Il1O0o]/g,'');sets.push(s)}});
 if(!sets.length)throw new Error('Select at least one character type');var all=sets.join(''),ch=sets.map(function(s){return s[DK.randInt(s.length)]});while(ch.length<len)ch.push(all[DK.randInt(all.length)]);
 for(var i=ch.length-1;i>0;i--){var j=DK.randInt(i+1),t=ch[i];ch[i]=ch[j];ch[j]=t}return {password:ch.join(''),pool:all.length,bits:Math.round(len*Math.log2(all.length))}};
DK.pwStrength=function(bits){return bits<40?'Weak':bits<60?'Fair':bits<80?'Strong':'Very strong'};
return DK;});
