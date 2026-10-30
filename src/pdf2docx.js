/* FileMoss PDF -> DOCX (runs in the browser). Uses pdf.js (Apache-2.0) to read text, fonts and images,
   pdf-lib (MIT, optional) to read marked-content ActualText and original JPEG bytes, and JSZip (MIT) to write .docx. */
(function(){
var X=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'')};
function mul(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]}
// Private-use bullets from Symbol/Wingdings/OpenSymbol fonts
var PUA={'\uf0b7':'•','\uf0a7':'▪','\uf0d8':'➢','\uf076':'❖','\uf0fc':'✓','\uf0a8':'□','\uf06e':'■','\uf0e0':'→','\uf0d2':'•','\uf02d':'–','\uf0bf':'•','\uf0a2':'•','\ue000':'•'};
var CJK=/[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/;function jn(a,b){return a+(CJK.test(a.slice(-1))||CJK.test(b.charAt(0))?'':' ')+b}
function clean(s){return s.replace(/[\uf000-\uf0ff\ue000]/g,function(c){return PUA[c]||''}).replace(/[\u0000-\u001f\u007f\ufffe\uffff]/g,'')}
/* ---------- content-stream scan: ActualText of each BDC/BMC, in order ---------- */
function pdfStr(b){if(b.length>=2&&b.charCodeAt(0)===254&&b.charCodeAt(1)===255){var o='';for(var i=2;i+1<b.length;i+=2)o+=String.fromCharCode(b.charCodeAt(i)<<8|b.charCodeAt(i+1));return o}return b}
function markedActual(s){var out=[],st=[],i=0,n=s.length,WS=/[\s\0]/,DL='()<>[]{}/%';
function rd(){while(i<n){var c=s[i];if(WS.test(c)){i++;continue}if(c==='%'){while(i<n&&s[i]!=='\n'&&s[i]!=='\r')i++;continue}break}if(i>=n)return null;var c=s[i];
if(c==='('){var d=1,o='';i++;while(i<n&&d>0){c=s[i++];if(c==='\\'){var e=s[i++];if(e==='n')o+='\n';else if(e==='r')o+='\r';else if(e==='t')o+='\t';else if(e==='b')o+='\b';else if(e==='f')o+='\f';else if(/[0-7]/.test(e)){var oc=e;while(oc.length<3&&/[0-7]/.test(s[i]))oc+=s[i++];o+=String.fromCharCode(parseInt(oc,8)&255)}else if(e==='\r'||e==='\n'){if(e==='\r'&&s[i]==='\n')i++}else o+=e}else{if(c==='(')d++;else if(c===')'){d--;if(!d)break}o+=c}}return {v:o}}
if(c==='<'&&s[i+1]==='<'){i+=2;return {t:'<<'}}if(c==='>'&&s[i+1]==='>'){i+=2;return {t:'>>'}}
if(c==='<'){var j=s.indexOf('>',i);var h=s.slice(i+1,j<0?n:j).replace(/\s/g,'');i=j<0?n:j+1;if(h.length%2)h+='0';var o2='';for(var k=0;k<h.length;k+=2)o2+=String.fromCharCode(parseInt(h.substr(k,2),16));return {v:o2}}
if(c==='['||c===']'||c==='{'||c==='}'){i++;return {t:c}}
var j2=i+1;while(j2<n&&!WS.test(s[j2])&&DL.indexOf(s[j2])<0)j2++;var w=s.slice(i,j2);i=j2;if(c==='/')return {v:{name:w.slice(1)}};if(/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w))return {v:+w};return {op:w}}
while(true){var t=rd();if(!t)break;
if(t.t==='<<'||t.t==='['){st.push(t);continue}
if(t.t==='>>'){var d={},kv=[];while(st.length&&st[st.length-1].t!=='<<')kv.unshift(st.pop());st.pop();for(var q=0;q+1<kv.length;q+=2)if(kv[q].v&&kv[q].v.name)d[kv[q].v.name]=kv[q+1].v;st.push({v:d});continue}
if(t.t===']'){var arr=[];while(st.length&&st[st.length-1].t!=='[')arr.unshift(st.pop().v);st.pop();st.push({v:arr});continue}
if(t.op){if(t.op==='BI'){var ei=s.indexOf('ID',i);var m=/\sEI(?=[\s\0]|$)/g;m.lastIndex=ei<0?i:ei+2;var r=m.exec(s);i=r?r.index+3:n}
else if(t.op==='BDC'){var p=st.length?st[st.length-1].v:null;out.push(p&&typeof p==='object'&&typeof p.ActualText==='string'?pdfStr(p.ActualText):null)}
else if(t.op==='BMC')out.push(null);
st.length=0;continue}
st.push(t)}
return out}
var PL=null;async function plDoc(raw){if(!raw)return null;if(PL)return PL;PL=(async function(){try{if(!window.PDFLib)await new Promise(function(ok,no){var sc=document.createElement('script');sc.src='/assets/pdf-lib.min.js';sc.onload=ok;sc.onerror=no;document.head.appendChild(sc)});return await PDFLib.PDFDocument.load(raw,{ignoreEncryption:true,updateMetadata:false,throwOnInvalidObject:false})}catch(e){return null}})();return PL}
function plContent(doc,pi){try{var L=window.PDFLib,pg=doc.getPage(pi),c=pg.node.Contents();if(!c)return '';var arr=c instanceof L.PDFArray?c.asArray().map(function(r){return doc.context.lookup(r)}):[c],out='';
arr.forEach(function(st){var b=st instanceof L.PDFRawStream?L.decodePDFRawStream(st).decode():st.getContents?st.getContents():new Uint8Array(0);var t='';for(var k=0;k<b.length;k+=8192)t+=String.fromCharCode.apply(null,b.subarray(k,k+8192));out+=t+'\n'});return out}catch(e){return null}}
function plJpegs(doc,pi){var out=[];try{var L=window.PDFLib,N=L.PDFName.of,pg=doc.getPage(pi),res=pg.node.Resources(),xo=res&&res.lookup(N('XObject'));if(!(xo instanceof L.PDFDict))return out;
xo.keys().forEach(function(k){var o=xo.lookup(k);if(!(o instanceof L.PDFRawStream))return;var d=o.dict;if(String(d.get(N('Subtype')))!=='/Image')return;var f=d.lookup(N('Filter'));if(f instanceof L.PDFArray)f=f.size()===1?f.lookup(0):null;if(!f||String(f)!=='/DCTDecode')return;
if(d.get(N('SMask'))||d.get(N('Mask'))||d.get(N('Decode')))return;var cs=d.lookup(N('ColorSpace')),ok=false;if(cs&&(String(cs)==='/DeviceRGB'||String(cs)==='/DeviceGray'))ok=true;else if(cs instanceof L.PDFArray&&String(cs.lookup(0))==='/ICCBased'){var ic=cs.lookup(1),nn=ic&&ic.dict&&ic.dict.lookup(N('N'));ok=nn&&(nn.asNumber()===3||nn.asNumber()===1)}if(!ok)return;
var w=d.lookup(N('Width')),h=d.lookup(N('Height'));out.push({w:w&&w.asNumber(),h:h&&h.asNumber(),bytes:o.contents})})}catch(e){}return out}
/* ---------- images ---------- */
async function imgEnc(im){var w=im.width,h=im.height;if(!w||!h)return null;var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');
if(im.bitmap)x.drawImage(im.bitmap,0,0);else if(im.data){var D=x.createImageData(w,h),s=im.data,n=w*h,k;if(im.kind===3||s.length>=n*4)D.data.set(s.subarray(0,n*4));else if(im.kind===2||s.length>=n*3)for(k=0;k<n;k++){D.data[k*4]=s[k*3];D.data[k*4+1]=s[k*3+1];D.data[k*4+2]=s[k*3+2];D.data[k*4+3]=255}else{var rb=(w+7)>>3;for(k=0;k<n;k++){var y=(k/w)|0,xx=k%w,v=(s[y*rb+(xx>>3)]>>(7-(xx&7)))&1?255:0;D.data[k*4]=D.data[k*4+1]=D.data[k*4+2]=v;D.data[k*4+3]=255}}x.putImageData(D,0,0)}else return null;
// lossless PNG; only very large opaque images fall back to high-quality JPEG to keep the .docx reasonable
var opaque=true;try{var d=x.getImageData(0,0,w,h).data;for(var i=3;i<d.length;i+=4*Math.max(1,(d.length/4/5000)|0))if(d[i]<255){opaque=false;break}}catch(e){}
var jpg=opaque&&w*h>4e6,b=await new Promise(function(r){c.toBlob(r,jpg?'image/jpeg':'image/png',0.95)});c.width=c.height=0;return b?{bytes:new Uint8Array(await b.arrayBuffer()),ext:jpg?'jpeg':'png',w:w,h:h}:null}
async function pageScan(pj,p,vt,acts){var ol=await p.getOperatorList(),O=pj.OPS,st=[],m=vt.slice(),out=[],G=[],NGc=0,FB={};
var T={tm:[1,0,0,1,0,0],x:0,y:0,lx:0,ly:0,lead:0,font:null,fid:'',fs:0,cs:0,ws:0,hs:1,rise:0},mk=[],mi=0,useA=acts&&acts.length===ol.fnArray.filter(function(f){return f===O.beginMarkedContent||f===O.beginMarkedContentProps}).length;
function font(id){try{return p.commonObjs.has(id)?p.commonObjs.get(id):null}catch(e){return null}}
function cl(o){return {tm:o.tm,x:o.x,y:o.y,lx:o.lx,ly:o.ly,lead:o.lead,font:o.font,fid:o.fid,fs:o.fs,cs:o.cs,ws:o.ws,hs:o.hs,rise:o.rise}}
function mv(dx,dy){T.x=T.lx+=dx;T.y=T.ly+=dy}
for(var i=0;i<ol.fnArray.length;i++){var f=ol.fnArray[i],a=ol.argsArray[i];
if(f===O.save){st.push([m.slice(),cl(T)])}else if(f===O.restore){var sv=st.pop();if(sv){m=sv[0];T=sv[1]}else m=vt.slice()}else if(f===O.transform)m=mul(m,a);
else if(f===O.paintFormXObjectBegin){st.push([m.slice(),cl(T)]);if(a&&a[0])m=mul(m,Array.from(a[0]))}else if(f===O.paintFormXObjectEnd){var sv2=st.pop();if(sv2){m=sv2[0];T=sv2[1]}}
else if(f===O.beginText){T.tm=[1,0,0,1,0,0];T.x=T.lx=T.y=T.ly=0}
else if(f===O.setTextMatrix){var tmv=a.length===1?Array.from(a[0]):Array.from(a);T.tm=tmv;T.x=T.lx=T.y=T.ly=0}
else if(f===O.moveText)mv(a[0],a[1]);else if(f===O.setLeadingMoveText){T.lead=a[1];mv(a[0],a[1])}else if(f===O.nextLine)mv(0,T.lead);else if(f===O.setLeading)T.lead=-a[0];
else if(f===O.setFont){T.fid=a[0];T.font=font(a[0]);T.fs=Math.abs(a[1])}else if(f===O.setCharSpacing)T.cs=a[0];else if(f===O.setWordSpacing)T.ws=a[0];else if(f===O.setHScale)T.hs=a[0]/100;else if(f===O.setTextRise)T.rise=a[0];
else if(f===O.beginMarkedContent||f===O.beginMarkedContentProps){var ac=useA?acts[mi++]:null;var outer=mk.some(function(q){return q!=null&&q!==false});mk.push(outer?false:ac);if(ac!=null&&!outer)mk.span=[]}
else if(f===O.endMarkedContent){var top=mk.pop();if(top!=null&&top!==false&&mk.span){var sp=mk.span;mk.span=null;if(sp.length){var x1=Math.max.apply(0,sp.map(function(g){return g.x+g.w}));G.push({x:sp[0].x,y:sp[0].y,w:x1-sp[0].x,s:top,sz:sp[0].sz,f:sp[0].f,at:true})}}}
else if((f===O.showText||f===O.showSpacedText)&&T.font&&T.fs){var gl=a[0],fm=(T.font.fontMatrix||[0.001,0,0,0.001,0,0]),M=mul(m,T.tm),S=0,sc=Math.hypot(M[0],M[1]),szv=T.fs*Math.hypot(M[2],M[3])*(fm[3]/0.001||1);if(T.font.isType3Font)szv=T.fs*Math.hypot(M[2],M[3]);
for(var k=0;k<gl.length;k++){var g=gl[k];if(typeof g==='number'){S-=g*T.fs/1000;continue}if(!g)continue;var X=T.x+T.hs*S,Y=T.y+T.rise,px=M[0]*X+M[2]*Y+M[4],py=M[1]*X+M[3]*Y+M[5],adv=(g.width||0)*T.fs*fm[0]+((g.isSpace?T.ws:0)+T.cs);
var rec={x:px,y:py,w:Math.max(0,(g.width||0)*T.fs*fm[0])*T.hs*sc,s:g.unicode||'',sz:Math.abs(szv),f:T.fid};if(!g.isSpace&&!/^[\s\p{P}\p{S}\d]$/u.test(g.unicode||'x'))if(!/^\p{Co}$/u.test(g.unicode))NGc++;if(!g.isSpace&&!/^\s+$/.test(g.unicode||'x')){var fb=FB[T.fid]||(FB[T.fid]=[0,0,0,0,0,0,(T.font&&T.font.name)||'']);fb[0]++;var u0=g.unicode||'';if(/\p{L}/u.test(u0))fb[2]++;else if(/^[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]$/.test(u0)&&!/^[.,_\-]$/.test(u0))fb[3]++;else if(/^[\p{Co}\p{S}]$/u.test(u0))fb[4]++;if(/^[\d.,_\-]$/.test(u0))fb[5]++;if(!g.unicode||/^[\u0000-\u001f\u007f-\u009f\ufffd]+$/.test(g.unicode))fb[1]++}if(mk.span)mk.span.push(rec);else G.push(rec);S+=adv}T.x+=S*T.hs}
else if(f===O.paintImageXObject||f===O.paintInlineImageXObject||f===O.paintImageXObjectRepeat){var im=null;try{if(f===O.paintInlineImageXObject)im=a[0];else{var id=a[0];im=await new Promise(function(res,rej){var to=setTimeout(function(){rej(new Error('t'))},5000);(id.startsWith('g_')?p.commonObjs:p.objs).get(id,function(v){clearTimeout(to);res(v)})})}}catch(e){}
if(im){var xs=[m[4],m[4]+m[0],m[4]+m[2],m[4]+m[0]+m[2]],ys=[m[5],m[5]+m[1],m[5]+m[3],m[5]+m[1]+m[3]],x0=Math.min.apply(0,xs),x1b=Math.max.apply(0,xs),y0=Math.min.apply(0,ys),y1=Math.max.apply(0,ys);
if(x1b-x0>8&&y1-y0>8)out.push({im:im,w:x1b-x0,h:y1-y0,top:y0,x:x0})}}}
G.forEach(function(g){g.s=clean(g.s).normalize('NFC')});return {fb:FB,ng:NGc,imgs:out,glyphs:G.filter(function(g){return g.s})}}
/* ---------- text lines (viewport coordinates: y grows downwards) ---------- */
function applyActual(items,acts){// replace text inside marked-content spans that carry /ActualText
if(!acts)return items;var out=[],stack=[],mi=0;
items.forEach(function(it){if(it.type==='beginMarkedContent'||it.type==='beginMarkedContentProps'){var a=acts[mi++];var outer=stack.some(function(s){return s.a!=null});stack.push({a:outer?null:a,got:[]});return}
if(it.type==='endMarkedContent'){var s=stack.pop();if(s&&s.a!=null&&s.got.length){var g=s.got.filter(function(q){return q.str.trim()}),f=g[0]||s.got[0],x1=Math.max.apply(0,s.got.map(function(q){return q.transform[4]+q.width}));out.push({str:s.a,transform:f.transform,width:x1-f.transform[4],fontName:f.fontName,hasEOL:false,at:true})}else if(s&&s.a!=null&&!s.got.length&&s.a.trim()){}return}
if(it.type)return;var top=null;for(var k=stack.length-1;k>=0;k--)if(stack[k].a!=null){top=stack[k];break}if(top)top.got.push(it);else out.push(it)});
return out}
var MC=null;function glyphW(c,st){var fam=st&&/serif/i.test(st.fontFamily||'')&&!/sans/i.test(st.fontFamily||'')?'serif':st&&/mono/i.test(st.fontFamily||'')?'monospace':'sans-serif';if(!MC){try{MC=document.createElement('canvas').getContext('2d')}catch(e){MC=0}}if(!MC)return /\s/.test(c)?0.28:/[il.,:;'|!]/.test(c)?0.28:/[mwMW]/.test(c)?0.85:0.55;MC.font='100px '+fam;return MC.measureText(c).width/100||0.5}
function lines(items,vt,ph,styles,glyphs){styles=styles||{};var L=[];items.forEach(function(it){if(it.type||!it.str)return;var t=mul(vt,it.transform),sz=Math.hypot(t[2],t[3])||Math.hypot(t[0],t[1]),s=clean(it.str).normalize('NFC');if(!s)return;
var y=t[5],x=t[4],w=it.width*(Math.hypot(t[0],t[1])/(Math.hypot(it.transform[0],it.transform[1])||1));
var l=null;for(var j=L.length-1;j>=Math.max(0,L.length-8);j--)if(Math.abs(L[j].y-y)<Math.min(sz,L[j].sz)*0.45){l=L[j];break}if(!l){l={y:y,sz:sz,it:[]};L.push(l)}l.sz=Math.max(l.sz,sz);l.it.push({x:x,w:w,s:s,sz:sz,f:it.fontName,at:it.at})});
L.forEach(function(l){var it=l.it;it.sort(function(a,b){return a.x-b.x});
// glyphs from a fallback font drawn inside another run (LibreOffice does this for Vietnamese): merge by x position
var ov=false;for(var i=0;i<it.length&&!ov;i++)for(var i2=i+1;i2<it.length&&it[i2].x<it[i].x+it[i].w-Math.max(1,it[i].sz*0.3);i2++)if(it[i2].f!==it[i].f&&(it[i2].s.trim()||it[i].s.trim())&&(it[i2].s.trim()&&it[i].s.trim()||true)){ov=true;break}
if(!ov&&it.some(function(g){return g.at}))ov=true;if(ov&&glyphs&&glyphs.length){var xr=Math.max.apply(0,it.map(function(g){return g.x+g.w}));var gs=glyphs.filter(function(g){return !g.u&&Math.abs(g.y-l.y)<l.sz*0.45&&g.x>=it[0].x-2&&g.x<=xr+2});if(gs.length){gs.forEach(function(g){g.u=1});var ch=gs.map(function(g){return {x:g.x,w:g.w,s:g.s,sz:g.sz,f:g.f,at:g.at}});var MK=/^[\u0300-\u036f\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]+$/;ch.forEach(function(c){if(!MK.test(c.s))return;var cx=c.x+c.w/2,b=null;ch.forEach(function(o){if(o===c||MK.test(o.s)||!o.s.trim()||o.x>cx+0.5)return;if(!b||o.x>b.x)b=o});if(b){b.s=(b.s+c.s).normalize('NFC');c.s=''}});ch=ch.filter(function(c){return c.s});
ch=ch.filter(function(c){if(c.s.trim())return true;var cx=c.x+c.w/2;return !ch.some(function(o){return o.f!==c.f&&o.s.trim()&&cx>o.x&&cx<o.x+o.w})});
ch.sort(function(a,b){return a.x-b.x});it=ch}else ov=false}else ov=false
var segs=[],cur=null,sp=false,realSp=function(a,b2){return !!glyphs&&glyphs.some(function(q){return q.s===' '&&Math.abs(q.y-l.y)<l.sz*0.45&&q.x>=a-1.5&&q.x<=b2+0.5})};it.forEach(function(g){if(!g.s.trim()){if(ov||g.w>l.sz*0.1)sp=true;return}var gap=cur?g.x-cur.x1:0;if(!cur||gap>l.sz*1.1){cur={x0:g.x,x1:g.x+g.w,t:g.s,f:g.f,sz:g.sz};segs.push(cur)}else{var th=ov||g.at||cur.at?0.45:0.15,cj=CJK.test(cur.t.slice(-1))||CJK.test(g.s.charAt(0));if((cj?(realSp(cur.x1,g.x)||gap>l.sz*0.5):(sp||gap>l.sz*th))&&!/\s$/.test(cur.t)&&!/^\s/.test(g.s))cur.t+=' ';cur.t+=g.s;cur.x1=Math.max(cur.x1,g.x+g.w)}cur.at=g.at;sp=false});
segs.forEach(function(s){s.t=s.t.replace(/\s+/g,' ').trim().normalize('NFC')});segs=segs.filter(function(s){return s.t});if(segs.length)l.tsp=realSp(segs[segs.length-1].x1,1e9);
// a lone bullet / number in its own column belongs to the text after it
if(segs.length>=2&&/^([•▪◦●○■□‣∙·➢❖✓→\-–*]|\(?\d{1,3}[.)]|\(?[a-z][.)]|[ivx]{1,4}[.)])$/i.test(segs[0].t)&&segs[1].x0-segs[0].x1<l.sz*4){segs[1].t=segs[0].t+' '+segs[1].t;segs[1].tx=segs[1].x0;segs[1].x0=segs[0].x0;segs.shift()}
if(segs.length>1&&segs.every(function(s){return /^[*·•\-–—~=_ ]+$/.test(s.t)})){segs[0].t=segs.map(function(s){return s.t}).join('   ');segs[0].x1=segs[segs.length-1].x1;segs=[segs[0]]}l.segs=segs;l.x0=segs.length?segs[0].x0:0;l.x1=segs.length?segs[segs.length-1].x1:0;l.text=segs.map(function(s){return s.t}).join('\t')});
return L.filter(function(l){return l.segs.length}).sort(function(a,b){return a.y-b.y})}
function isBold(f,styles,fonts){var n=((fonts[f]&&fonts[f].name)||'')+' '+((styles[f]&&styles[f].fontFamily)||'');return /bold|black|heavy|semibold|demi/i.test(n)||(fonts[f]&&fonts[f].bold)}
/* ---------- column detection: a vertical gutter in the middle of the page ---------- */
function columns(L,pw){var segs=[];L.forEach(function(l){l.segs.forEach(function(s){segs.push(s)})});if(L.length<10)return null;
var B=2,nb=Math.ceil(pw/B)+1,cov=new Array(nb).fill(0);segs.forEach(function(s){for(var b=Math.max(0,Math.floor(s.x0/B));b<=Math.min(nb-1,Math.floor(s.x1/B));b++)cov[b]++});
var best=null,lim=Math.max(1,Math.round(L.length*0.04));for(var b=Math.floor(pw*0.3/B);b<Math.ceil(pw*0.7/B);b++){if(cov[b]>lim)continue;var e=b;while(e+1<nb&&cov[e+1]<=lim&&(e+1)*B<pw*0.75)e++;if((e-b+1)*B>=10&&(!best||e-b>best[1]-best[0]))best=[b,e];b=e}
if(!best)return null;var g0=best[0]*B,g1=(best[1]+1)*B,gm=(g0+g1)/2,lw=[],rw=[];segs.forEach(function(s){if(s.x1<=gm)lw.push(s.x1-s.x0);else if(s.x0>=gm)rw.push(s.x1-s.x0)});
function med(a){a=a.slice().sort(function(x,y){return x-y});return a[a.length>>1]||0}
if(lw.length<8||rw.length<8||med(lw)<pw*0.22||med(rw)<pw*0.22)return null;return gm}
function orderCols(L,gm){var out=[],band=0,last=null;L.forEach(function(l){var cross=l.segs.some(function(s){return s.x0<gm&&s.x1>gm});
if(cross){band++;out.push({l:l,band:band,col:0});band++;return}var left=l.segs.filter(function(s){return s.x1<=gm}),right=l.segs.filter(function(s){return s.x0>=gm});
[[left,0],[right,1]].forEach(function(p){if(!p[0].length)return;var nl={y:l.y,sz:l.sz,segs:p[0],x0:p[0][0].x0,x1:p[0][p[0].length-1].x1,text:p[0].map(function(s){return s.t}).join('\t'),col:p[1]};out.push({l:nl,band:band,col:p[1]})})});
return out}
/* ---------- convert ---------- */
async function convert(pj,data,onp){var raw=data.byteLength<=150e6?data.slice(0):null;PL=null;
var pdf=await pj.getDocument({data:data,isOffscreenCanvasSupported:false,isImageDecoderSupported:false}).promise,N=pdf.numPages,blocks=[],media=[],chars=0,allSz=[],imgCount=0,textPages=0,scanPages=0,multiCol=[],allText=[],NG=0,FBD={};
for(var pn=1;pn<=N;pn++){if(onp)onp(pn,N);var p=await pdf.getPage(pn),vp=p.getViewport({scale:1}),vt=vp.transform,pw=vp.width,ph=vp.height,tc=await p.getTextContent({includeMarkedContent:true}),fonts={};
var items=tc.items,acts=null;if(items.some(function(i){return i.type==='beginMarkedContentProps'&&!i.id})){var doc=await plDoc(raw);if(doc){var cs=plContent(doc,pn-1);if(cs){var a=markedActual(cs),nm=items.filter(function(i){return i.type==='beginMarkedContent'||i.type==='beginMarkedContentProps'}).length;if(a.length===nm&&a.some(function(v){return v!=null}))acts=a}}}
var scn=await pageScan(pj,p,vt,acts),imgs=scn.imgs;NG+=scn.ng||0;for(var fk in scn.fb){var fd=FBD[fk]||(FBD[fk]=[0,0,0,0,0,0,scn.fb[fk][6]]);for(var fi=0;fi<6;fi++)fd[fi]+=scn.fb[fk][fi]}items=applyActual(items,acts);
var L=lines(items,vt,ph,tc.styles,scn.glyphs),pchars=0;L.forEach(function(l){l.segs.forEach(function(s){if(!(s.f in fonts)){try{fonts[s.f]=p.commonObjs.has(s.f)?p.commonObjs.get(s.f):null}catch(e){fonts[s.f]=null}}s.b=isBold(s.f,tc.styles,fonts)});pchars+=l.text.length;allText.push(l.text);allSz.push([l.sz,l.text.length])});chars+=pchars;if(L.length)textPages++;
var big=imgs.some(function(g){return g.w*g.h>pw*ph*0.5});if(pchars<5&&big)scanPages++;
var gm=columns(L,pw),ord;if(gm){multiCol.push(pn);ord=orderCols(L,gm)}else ord=L.map(function(l){return {l:l,band:0,col:0}});
var cw=pw-108,chH=ph-108-30,pb=ord.map(function(o,k){return {k:'line',y:o.l.y,l:o.l,band:o.band,col:o.col,n:k}});
var jp=null;
for(var q=0;q<imgs.length;q++){var g=imgs[q],r=null;
if(raw&&!jp){var dd=await plDoc(raw);jp=dd?plJpegs(dd,pn-1):[]}
var hit=(jp||[]).filter(function(j){return j.w===g.im.width&&j.h===g.im.height});if(hit.length===1)r={bytes:hit[0].bytes,ext:'jpeg',w:g.im.width,h:g.im.height};
if(!r)r=await imgEnc(g.im);if(!r)continue;imgCount++;media.push(r);var sc=Math.min(1,cw/g.w,chH/g.h);
var band=0,col=0;if(gm){col=g.x+g.w/2>gm?1:0;var prev=null;pb.forEach(function(b){if(b.k==='line'&&b.y<=g.top)prev=b});band=prev?prev.band:0;if(g.w>pw*0.5)col=0}
pb.push({k:'img',y:g.top,id:media.length,w:g.w*sc,h:g.h*sc,band:band,col:col})}
pb.sort(function(a,b){return a.band-b.band||a.col-b.col||a.y-b.y||(a.k==='img'?-1:1)});
blocks.push({page:pn,items:pb,pw:pw,ph:ph});p.cleanup()}
await pdf.destroy();PL=null;
var tot=0,acc={};allSz.forEach(function(s){var k=Math.round(s[0]*2)/2;acc[k]=(acc[k]||0)+s[1];tot+=s[1]});var body=12,bm=0;for(var k in acc)if(acc[k]>bm){bm=acc[k];body=+k}
return {blocks:blocks,media:media,body:body,chars:chars,pages:N,images:imgCount,textPages:textPages,scanPages:scanPages,multiCol:multiCol,garbled:fontBad(FBD)||fontJunk(FBD)||latinOdd(allText.join(' '))||!fontClean(FBD)&&garbled(allText.join('\n'),NG),glyphs:NG}}
/* text that came out of fonts without a usable ToUnicode map */
// per-font check: a font whose glyphs mostly decode to control chars / nothing has no usable ToUnicode.
// Warn when such fonts draw >=12% of glyphs, or when any one of them draws >=5 glyphs.
function fontBad(F){var tot=0,bg=0,any=false;for(var k in F){tot+=F[k][0];if(F[k][0]>=5&&F[k][1]>=0.5*F[k][0]){bg+=F[k][0];if(F[k][1]>=5)any=true}}return tot>0&&(bg/tot>=0.12||any)}
// fonts that decode every glyph to a real (non-control) character are trusted: PUA icons and math symbols are fine
// text fonts (not symbol/PUA/math fonts) whose ToUnicode decodes mostly to ASCII punctuation/symbols instead of letters
function fontJunk(F){var x=0,L=0,P=0;for(var k in F){var f=F[k],m=f[0]-f[5];if(/symbol|wingding|dingbat|math|webding/i.test(f[6])||f[4]>=0.5*f[0])continue;if(m>=30&&(f[3]>0.4*m||f[2]<0.3*m))return true;x+=m;L+=f[2];P+=f[3]}return x>=30&&(P>0.4*x||L<0.3*x)}
// shifted-letter maps (e.g. Caesar +3): Latin text with almost no vowels
function latinOdd(t){var s=t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z]/g,'').toLowerCase();if(s.length<100)return false;return (s.match(/[aeiouy]/g)||[]).length/s.length<0.2}
function fontClean(F){var tot=0;for(var k in F){tot+=F[k][0];if(F[k][1])return false}return tot>=30}
function garbled(t,ng){var s=t.replace(/\s+/g,'').replace(/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e\d]/g,'').replace(/[\p{Co}\p{S}]/gu,'').replace(/([.·…_\-–—=*•])\1{2,}\d*/g,''),n=s.length;if(ng>=30&&(s.match(/\p{L}/gu)||[]).length<0.4*ng)return true;if(n<40)return false;var bad=(s.match(/[\u0000-\u001f\u0080-\u009f\ufffd\ue000-\uf8ff]/g)||[]).length,let=(s.match(/\p{L}/gu)||[]).length;
if(bad/n>0.05||let/n<0.45)return true;
var w=t.match(/\p{L}{2,}/gu)||[];if(w.length<10)return false;var ok=0;w.forEach(function(x){var lx=x.toLowerCase();if(/[aeiouyàáâãèéêìíòóôõùúýăđơưạ-ỹ\u0400-\u04ff\u0370-\u03ff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\u0600-\u06ff\u0900-\u097f\u0e00-\u0e7f]/.test(lx)&&!/[a-z][A-Z]/.test(x.slice(1)))ok++});
return ok/w.length<0.6}
/* ---------- docx ---------- */
function run(t,b,sz,body){return '<w:r><w:rPr>'+(b?'<w:b/>':'')+(sz&&Math.abs(sz-body)>0.6?'<w:sz w:val="'+Math.round(sz*2)+'"/>':'')+'</w:rPr><w:t xml:space="preserve">'+X(t)+'</w:t></w:r>'}
var BUL=/^([•▪◦●○■□‣∙·➢❖✓→\-–*])\s+(\S.*)$/,NUM=/^\(?(\d{1,3}|[a-z]|[ivx]{1,4})([.)])\s+(\S.*)$/i;
var LEAD=/^(.*?\S)\s*(?:[.·…_]\s?){3,}\s*(\d{1,4}|[ivxlc]{1,6})$/i;
function sect(pg){var w=Math.round(pg.pw*20),h=Math.round(pg.ph*20);return '<w:sectPr><w:pgSz w:w="'+w+'" w:h="'+h+'"'+(w>h?' w:orient="landscape"':'')+'/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'}
function build(res){var body=res.body,xml=[],nums=[],brk=false;
function P(inner,ppr){var pp=(brk?'<w:pageBreakBefore/>':'')+(ppr||'');brk=false;xml.push('<w:p>'+(pp?'<w:pPr>'+pp+'</w:pPr>':'')+inner+'</w:p>')}
function seq(a,b){if(/^\d+$/.test(a))return +b===+a+1;if(/^[a-z]$/i.test(a)&&/^[a-z]$/i.test(b))return b.toLowerCase().charCodeAt(0)===a.toLowerCase().charCodeAt(0)+1;return /^[ivx]+$/i.test(b)}
res.blocks.forEach(function(pg,pi){var it=pg.items,i=0,cwT=Math.round((pg.pw-108)*20);
if(pi>0){var pv=res.blocks[pi-1];if(Math.round(pv.pw)!==Math.round(pg.pw)||Math.round(pv.ph)!==Math.round(pg.ph)){if(brk)P('');xml.push('<w:p><w:pPr>'+sect(pv)+'</w:pPr></w:p>');brk=false}else{if(brk)P('');brk=true}}
var minX=Infinity;it.forEach(function(b){if(b.k==='line')minX=Math.min(minX,b.l.x0)});
while(i<it.length){var b=it[i];if(b.k==='img'){var cx=Math.round(b.w*12700),cy=Math.round(b.h*12700);P('<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+b.id+'" name="Picture '+b.id+'"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="'+b.id+'" name="image'+b.id+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg'+b.id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>','<w:spacing w:after="0"/>');i++;continue}
var l=b.l,isLine=function(k){return k<it.length&&it[k].k==='line'};function collect(i0){var l0=it[i0].l,isB=BUL.test(l0.text),j=i0,items=[];while(isLine(j)){var ll=it[j].l,m=ll.segs.length===1&&(isB?BUL.exec(ll.text):NUM.exec(ll.text));if(!m){var last=items[items.length-1];if(last&&ll.segs.length===1&&ll.y>last.yl&&ll.y-last.yl<ll.sz*1.7&&ll.x0>last.x+2&&Math.abs(ll.sz-last.sz)<0.6&&!BUL.test(ll.text)&&!NUM.test(ll.text)){last.t=jn(last.t,ll.text);last.yl=ll.y;j++;continue}break}var pv=items[items.length-1];if(pv){var same=Math.abs(ll.x0-pv.x)<4,sib=null;for(var q2=items.length-1;q2>=0;q2--)if(Math.abs(items[q2].x-ll.x0)<4){sib=items[q2];break}if(ll.y-pv.yl>ll.sz*3||ll.y<=pv.yl||(ll.x0<items[0].x-4)||(sib&&(isB?m[1]!==sib.mk:!seq(sib.mk,m[1])))||(!sib&&ll.x0<pv.x-4)||(!isB&&!sib&&!/^(1|a|i)$/i.test(m[1]))||(isB&&!sib&&!same&&!/[•▪◦●○■□‣∙➢❖✓→\-–*]/.test(m[1]))){break}}items.push({x:ll.x0,t:isB?m[2]:m[3],mk:isB?m[1]:m[1],sep:isB?'':m[2],y:ll.y,yl:ll.y,sz:ll.sz,b:ll.segs[0].b});j++}return {items:items,j:j,isB:isB,real:isB&&/[•▪◦●○■□‣∙➢❖✓→]/.test(items[0]?items[0].mk:'')}}
// table of contents line: "Title ...... 12" (one or two segments)
var tm=l.segs.length<=2&&LEAD.exec(l.text.replace('\t',' '));if(!tm&&l.segs.length===2&&/^(\d{1,4}|[ivxlc]{1,6})$/i.test(l.segs[1].t)&&/[.·…_]{3,}$/.test(l.segs[0].t))tm=[0,l.segs[0].t.replace(/[\s.·…_]+$/,''),l.segs[1].t];
if(tm){P(run(tm[1],l.segs[0].b,l.sz,body)+'<w:r><w:tab/></w:r>'+run(tm[2],l.segs[0].b,l.sz,body),'<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="'+cwT+'"/></w:tabs><w:spacing w:after="60"/>'+(l.x0-minX>12?'<w:ind w:left="'+Math.round((l.x0-minX)*20)+'"/>':''));i++;continue}
// list item
var hd=l.sz/body>=1.25||(l.sz/body>=1.08&&l.segs[0].b),bm=!hd&&l.segs.length===1&&/[\p{L}\p{N}]/u.test(l.text.slice(2))&&(BUL.exec(l.text)||NUM.exec(l.text));
var LC=collect(i);if(bm&&(LC.real||LC.items.length>=2)){var isB=LC.isB,items=LC.items,j=LC.j;var x0s=items.map(function(q){return q.x}).sort(function(a,c){return a-c})[0],kind=isB?'b':/^\d+$/.test(items[0].mk)?'d':/^[ivx]+$/i.test(items[0].mk)&&items[0].mk.toLowerCase()==='i'?'r':/^[a-z]$/i.test(items[0].mk)?'l':'d';
var start=kind==='d'?parseInt(items[0].mk,10)||1:kind==='l'?items[0].mk.toLowerCase().charCodeAt(0)-96:1;nums.push({kind:kind,start:start,sep:items[0].sep||'.'});var nid=nums.length;
items.forEach(function(q){var lv=Math.max(0,Math.min(2,Math.round((q.x-x0s)/18)));P(run(q.t,q.b,q.sz,body),'<w:numPr><w:ilvl w:val="'+lv+'"/><w:numId w:val="'+nid+'"/></w:numPr><w:spacing w:after="40"/>')});i=j;continue}
// table: >=2 consecutive lines, same number (>=2) of aligned segments, not prose
if(l.segs.length>=2){var j=i,nc=l.segs.length,rows=[];while(isLine(j)&&it[j].l.segs.length===nc&&!LEAD.test(it[j].l.text.replace('\t',' '))&&(!rows.length||it[j].l.y-rows[rows.length-1].y<it[j].l.sz*4)){rows.push(it[j].l);j++}
if(rows.length>=2){var cols=rows[0].segs.map(function(s){return s.x0});var ok=rows.every(function(r){return r.segs.every(function(s,c){return Math.abs(s.x0-cols[c])<Math.max(12,r.sz*1.5)})});
var numLast=rows.every(function(r){return /^(\d{1,4}|[ivxlc]{1,6})$/i.test(r.segs[nc-1].t)})&&nc===2&&rows.every(function(r){return r.segs[0].t.length>15});
var lab=nc===2&&rows.every(function(r){return /^((chapter|part|section|book|appendix|chương|phần|mục|kapitel|teil|chapitre|partie|capítulo|parte|глава|часть)\s+)?([0-9]{1,3}|[ivxlc]{1,6})[.:)]?$/i.test(r.segs[0].t)});
if(ok&&lab){rows.forEach(function(r){P(run(r.segs[0].t,r.segs[0].b,r.sz,body)+'<w:r><w:tab/></w:r>'+run(r.segs[1].t,r.segs[1].b,r.sz,body),'<w:tabs><w:tab w:val="left" w:pos="'+Math.max(200,Math.round((cols[1]-minX)*20))+'"/></w:tabs><w:spacing w:after="60"/>')});i=j;continue}
if(ok&&numLast){rows.forEach(function(r){P(run(r.segs[0].t,r.segs[0].b,r.sz,body)+'<w:r><w:tab/></w:r>'+run(r.segs[1].t,r.segs[1].b,r.sz,body),'<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="'+cwT+'"/></w:tabs><w:spacing w:after="60"/>')});i=j;continue}
if(ok){if(brk){P('');}var tw=cwT,cw=Math.floor(tw/nc);xml.push('<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="'+tw+'" w:type="dxa"/><w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(function(e){return '<w:'+e+' w:val="single" w:sz="4" w:space="0" w:color="999999"/>'}).join('')+'</w:tblBorders></w:tblPr><w:tblGrid>'+new Array(nc+1).join('<w:gridCol w:w="'+cw+'"/>')+'</w:tblGrid>'+rows.map(function(r){return '<w:tr>'+r.segs.map(function(s){return '<w:tc><w:tcPr><w:tcW w:w="'+cw+'" w:type="dxa"/></w:tcPr><w:p>'+run(s.t,s.b,s.sz,body)+'</w:p></w:tc>'}).join('')+'</w:tr>'}).join('')+'</w:tbl><w:p/>');i=j;continue}}}
// paragraph: merge following lines of similar size, close spacing, single segment
var ratio=l.sz/body,head=ratio>=1.6?1:ratio>=1.25?2:(ratio>=1.08&&l.segs.every(function(s){return s.b})&&l.text.length<90)?3:0,ps=[l],j2=i+1;
while(isLine(j2)){var n2=it[j2].l,prev=ps[ps.length-1],dy=n2.y-prev.y;if(n2.segs.length!==1||l.segs.length!==1||Math.abs(n2.sz-l.sz)>0.6||dy<=0||dy>l.sz*(CJK.test(prev.text+n2.text)?1.85:1.65)+0.3||head||((BUL.test(n2.text)||NUM.test(n2.text))&&(function(){var c=collect(j2);return c.real||c.items.length>=2})())||LEAD.test(n2.text)||it[j2].col!==b.col)break;ps.push(n2);j2++}
var runs=[];ps.forEach(function(pl,k){pl.segs.forEach(function(s,si){var t=s.t;if(k>0&&si===0){var last=runs[runs.length-1];if(last&&/-$/.test(last.t)&&/^[a-zà-ỹ]/.test(t))last.t=last.t.slice(0,-1);else if(ps[k-1].tsp||!(last&&CJK.test(last.t.slice(-1))||CJK.test(t.charAt(0))))t=' '+t}else if(si>0)t='\t'+t;runs.push({t:t,b:s.b,sz:s.sz})})});
var r=runs.map(function(u){return run(u.t,u.b&&!head,head?0:u.sz,body)}).join('');P(r,head?'<w:pStyle w:val="Heading'+head+'"/>':'');i=j2}
if(!it.length&&pi>0)P('')});
if(brk)P('');
return {xml:xml.join(''),nums:nums}}
function numberingXml(nums,W){var lv=function(k,fmt,txt,ind){return '<w:lvl w:ilvl="'+k+'"><w:start w:val="1"/><w:numFmt w:val="'+fmt+'"/><w:lvlText w:val="'+txt+'"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="'+(720+k*360)+'" w:hanging="360"/></w:pPr>'+(fmt==='bullet'?'<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr>':'')+'</w:lvl>'};
var abs=function(id,f){return '<w:abstractNum w:abstractNumId="'+id+'"><w:multiLevelType w:val="hybridMultilevel"/>'+[0,1,2].map(function(k){return f(k)}).join('')+'</w:abstractNum>'};
var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="'+W+'">'+abs(0,function(k){return lv(k,'bullet',['•','◦','▪'][k])})+abs(1,function(k){return lv(k,['decimal','lowerLetter','lowerRoman'][k],'%'+(k+1)+'.')})+abs(2,function(k){return lv(k,['decimal','lowerLetter','lowerRoman'][k],'%'+(k+1)+')')})+abs(3,function(k){return lv(k,['lowerLetter','lowerRoman','decimal'][k],'%'+(k+1)+'.')})+abs(4,function(k){return lv(k,['lowerLetter','lowerRoman','decimal'][k],'%'+(k+1)+')')})+abs(5,function(k){return lv(k,['lowerRoman','lowerLetter','decimal'][k],'%'+(k+1)+'.')});
nums.forEach(function(n,i){var a=n.kind==='b'?0:n.kind==='d'?(n.sep===')'?2:1):n.kind==='l'?(n.sep===')'?4:3):5;x+='<w:num w:numId="'+(i+1)+'"><w:abstractNumId w:val="'+a+'"/>'+(n.kind!=='b'?'<w:lvlOverride w:ilvl="0"><w:startOverride w:val="'+n.start+'"/></w:lvlOverride>':'')+'</w:num>'});
return x+'</w:numbering>'}
async function toDocx(res,JSZip,meta){var z=new JSZip(),W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships',F=function(n,d){z.file(n,d,{createFolders:false})};meta=meta||{};
var B=build(res),now=new Date().toISOString().replace(/\.\d+Z$/,'Z');
F('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
F('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+R+'/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="'+R+'/extended-properties" Target="docProps/app.xml"/></Relationships>');
F('docProps/core.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>'+X(meta.title||'')+'</dc:title><dc:creator></dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">'+now+'</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">'+now+'</dcterms:modified></cp:coreProperties>');
F('docProps/app.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>FileMoss PDF to Word</Application><Pages>'+res.pages+'</Pages></Properties>');
var rels='<Relationship Id="rIdStyles" Type="'+R+'/styles" Target="styles.xml"/><Relationship Id="rIdNum" Type="'+R+'/numbering" Target="numbering.xml"/>';res.media.forEach(function(m,i){F('word/media/image'+(i+1)+'.'+m.ext,m.bytes);rels+='<Relationship Id="rIdImg'+(i+1)+'" Type="'+R+'/image" Target="media/image'+(i+1)+'.'+m.ext+'"/>'});
F('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels+'</Relationships>');
F('word/numbering.xml',numberingXml(B.nums,W));
var bs=Math.round(res.body*2)||24,H=function(n,sz){return '<w:style w:type="paragraph" w:styleId="Heading'+n+'"><w:name w:val="heading '+n+'"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="'+(n-1)+'"/></w:pPr><w:rPr><w:b/><w:sz w:val="'+sz+'"/></w:rPr></w:style>'};
F('word/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="'+W+'"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="'+bs+'"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'+H(1,Math.round(bs*1.8))+H(2,Math.round(bs*1.4))+H(3,Math.round(bs*1.15))+'<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>');
var lastPg=res.blocks[res.blocks.length-1]||{pw:612,ph:792};
F('word/document.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="'+W+'" xmlns:r="'+R+'" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+B.xml+sect(lastPg)+'</w:body></w:document>');
return z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'})}
window.PDF2DOCX={convert:convert,toDocx:toDocx,_markedActual:markedActual};
})();
