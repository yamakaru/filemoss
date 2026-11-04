/* FileMoss PDF -> Excel core. Reads pdf.js text positions, groups them into rows and columns, and types the cells:
   amounts become numbers (decimal comma or point), while IDs with leading zeros, long digit strings and dates stay text. */
(function(g){var X={};
var NF=function(s){return s.normalize?s.normalize('NFC'):s};
var DATE=/^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})(\s+\d{1,2}:\d{2}(:\d{2})?)?$/;
var CUR=/^(₫|đ|VND|VNĐ|\$|US\$|€|£|¥|円|R\$|Rp|USD|EUR|JPY)\s*|\s*(₫|đ|VND|VNĐ|\$|€|£|¥|円|USD|EUR|JPY)$/i;
function core(s){var neg=false,pct=false;s=s.replace(/[\u00a0\u202f\u2009]/g,' ').trim();
 if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1).trim()}
 for(var i=0;i<2;i++)s=s.replace(CUR,'').trim();
 if(/^[-−–+]/.test(s)){if(s[0]!=='+')neg=!neg;s=s.slice(1).trim()}
 for(var j=0;j<2;j++)s=s.replace(CUR,'').trim();
 if(/[-−]$/.test(s)&&/\d[-−]$/.test(s)){neg=!neg;s=s.slice(0,-1)}
 if(/%$/.test(s)){pct=true;s=s.slice(0,-1).trim()}
 s=s.replace(/(\d) (?=\d{3}(\D|$))/g,'$1');
 if(!/^\d[\d.,]*$/.test(s)||/[.,]$/.test(s))return null;return {s:s,neg:neg,pct:pct}}
/* which decimal separator does the document use? '.' / ',' / '' (unclear) */
X.decHint=function(list){var d=0,c=0;list.forEach(function(t){var k=core(String(t));if(!k)return;var s=k.s;
 if(/^\d{1,3}(\.\d{3})+,\d+$/.test(s)||/^\d+,\d{1,2}$/.test(s)||/^\d+,\d{4,}$/.test(s))c++;
 else if(/^\d{1,3}(,\d{3})+\.\d+$/.test(s)||/^\d+\.\d{1,2}$/.test(s)||/^\d+\.\d{4,}$/.test(s))d++});
 return c>d*3&&c?',':d>c*3&&d?'.':''};
/* one cell -> {t:'n',v,z?} or {t:'s',v} */
X.cell=function(raw,dec){var v=NF(String(raw)).replace(/\s+/g,' ').trim();if(!v)return null;
 if(DATE.test(v))return {t:'s',v:v};var k=core(v);if(!k)return {t:'s',v:v};var s=k.s;
 var digits=s.replace(/\D/g,'');if(/^0\d/.test(s)||digits.replace(/^0+/,'').length>15)return {t:'s',v:v};
 var hasD=s.indexOf('.')>=0,hasC=s.indexOf(',')>=0,num;
 if(hasD&&hasC){var dc=s.lastIndexOf('.')>s.lastIndexOf(',')?'.':',',th=dc==='.'?',':'.';var parts=s.split(dc);if(parts.length!==2)return {t:'s',v:v};
  if(!new RegExp('^\\d{1,3}(\\'+th+'\\d{3})*$').test(parts[0]))return {t:'s',v:v};num=parseFloat(parts[0].split(th).join('')+'.'+parts[1])}
 else if(hasD||hasC){var sp=hasD?'.':',',ps=s.split(sp);
  if(ps.length>2){if(!/^\d{1,3}$/.test(ps[0])||ps.slice(1).some(function(p){return p.length!==3}))return {t:'s',v:v};num=parseFloat(ps.join(''))}
  else if(ps[1].length===3&&/^\d{1,3}$/.test(ps[0])&&dec!==sp)num=parseFloat(ps.join(''));
  else num=parseFloat(ps[0]+'.'+ps[1])}
 else num=parseFloat(s);
 if(!isFinite(num))return {t:'s',v:v};if(k.neg)num=-num;
 var dp=(s.match(/[.,](\d+)$/)||[0,''])[1];if(k.pct){num=num/100;return {t:'n',v:+num.toPrecision(15),z:'0'+(dp&&!(hasD&&hasC)&&!(ps&&ps.length===2&&ps[1].length===3&&dec!==sp)?'.'+'0'.repeat(dp.length):'')+'%'}}
 return {t:'n',v:+num.toPrecision(15)}};
/* pdf.js items -> lines of cells [{x0,x1,t}] */
X.lines=function(items){var it=items.filter(function(i){return i.str&&i.str.trim()}).map(function(i){var sz=Math.hypot(i.transform[2],i.transform[3])||Math.abs(i.transform[3])||10;return {x:i.transform[4],y:i.transform[5],w:i.width||sz*i.str.length*0.5,s:sz,t:i.str}});
 it.sort(function(a,b){return b.y-a.y||a.x-b.x});var L=[];it.forEach(function(i){var l=L.length?L[L.length-1]:null;if(l&&Math.abs(l.y-i.y)<Math.max(2,Math.min(l.s,i.s)*0.5))l.it.push(i);else L.push({y:i.y,s:i.s,it:[i]})});
 return L.map(function(l){l.it.sort(function(a,b){return a.x-b.x});var cells=[],c=null;l.it.forEach(function(i){var gap=c?i.x-c.x1:1e9;
  if(c&&gap<i.s*0.9){c.t+=(gap>i.s*0.15&&!/\s$/.test(c.t)&&!/^\s/.test(i.t)?' ':'')+i.t;c.x1=Math.max(c.x1,i.x+i.w)}else{c={x0:i.x,x1:i.x+i.w,t:i.t};cells.push(c)}});
  cells.forEach(function(c){c.t=NF(c.t).replace(/\s+/g,' ').trim()});return cells.filter(function(c){return c.t})}).filter(function(l){return l.length})};
/* column bands from the lines that look like table rows */
X.columns=function(lines){var multi=lines.filter(function(l){return l.length>=2});if(!multi.length)return null;
 var cnt={};multi.forEach(function(l){cnt[l.length]=(cnt[l.length]||0)+1});var best=0,bn=0;Object.keys(cnt).forEach(function(k){if(cnt[k]>bn||(cnt[k]===bn&&+k>best)){bn=cnt[k];best=+k}});
 var base=multi.filter(function(l){return l.length>=best});var iv=[];base.forEach(function(l){l.forEach(function(c){iv.push([c.x0,c.x1])})});
 iv.sort(function(a,b){return a[0]-b[0]});var cols=[];iv.forEach(function(v){var c=cols[cols.length-1];if(c&&v[0]<=c[1]+1)c[1]=Math.max(c[1],v[1]);else cols.push([v[0],v[1]])});
 /* cells of other rows that fall in a gap open a new column */
 multi.forEach(function(l){l.forEach(function(c){if(!cols.some(function(k){return c.x0<k[1]&&c.x1>k[0]})){cols.push([c.x0,c.x1]);cols.sort(function(a,b){return a[0]-b[0]})}})});return cols};
function assign(cols,c){var hit=[];cols.forEach(function(k,i){var ov=Math.min(c.x1,k[1])-Math.max(c.x0,k[0]);if(ov>0)hit.push(i)});
 if(!hit.length){var b=0,bd=1e9;cols.forEach(function(k,i){var d=Math.min(Math.abs(c.x0-k[1]),Math.abs(c.x1-k[0]),Math.abs((c.x0+c.x1)/2-(k[0]+k[1])/2));if(d<bd){bd=d;b=i}});return [b,b]}
 var a=hit[0],z=hit[hit.length-1];/* a cell that only touches neighbours slightly is not a span */
 if(z>a){var w=function(i){return Math.min(c.x1,cols[i][1])-Math.max(c.x0,cols[i][0])};var keep=hit.filter(function(i){return w(i)>=Math.min(4,(cols[i][1]-cols[i][0])*0.3)});a=keep[0]!=null?keep[0]:a;z=keep.length?keep[keep.length-1]:a}return [a,z]}
/* lines -> {rows:[[cell...]], merges:[]} */
X.grid=function(lines,cols){var rows=[],merges=[];if(!cols){lines.forEach(function(l){rows.push([l.map(function(c){return c.t}).join(' ')])});return {rows:rows,merges:merges,table:false}}
 lines.forEach(function(l){var r=[],ri=rows.length;l.forEach(function(c){var s=assign(cols,c),i=s[0];while(r[i]!=null&&i<cols.length)i++;if(r[i]!=null){r[s[0]]+=' '+c.t;return}r[i]=c.t;if(s[1]>i&&l.length<cols.length){var e=s[1];for(var k=i+1;k<=e;k++)if(r[k]!=null)e=k-1;if(e>i)merges.push({s:{r:ri,c:i},e:{r:ri,c:e}})}});rows.push(r)});
 return {rows:rows,merges:merges,table:true}};
X.key=function(r){return (r||[]).map(function(x){return (x||'').toLowerCase()}).join('\u0001')};
/* read all pages: [{lines, chars}] */
X.read=async function(pdf,onp,alive){var out=[];for(var p=1;p<=pdf.numPages;p++){if(alive&&!alive())return null;var pg=await pdf.getPage(p),tc=await pg.getTextContent();var L=X.lines(tc.items);out.push({lines:L,chars:L.reduce(function(a,l){return a+l.reduce(function(b,c){return b+c.t.replace(/\s/g,'').length},0)},0)});pg.cleanup&&pg.cleanup();if(onp)onp(p,pdf.numPages)}return out};
/* build sheets. mode 'one' (single sheet, repeated headers dropped) or 'pages' */
X.sheets=function(pages,mode,pageWord){var all=[];pages.forEach(function(p){p.lines.forEach(function(l){l.forEach(function(c){all.push(c.t)})})});var dec=X.decHint(all),res=[],used={};
 function nm(s){s=String(s).replace(/[\[\]:*?\/\\]/g,' ').replace(/^'+|'+$/g,'').trim().slice(0,31)||'Sheet';var b=s,k=1;while(used[s.toLowerCase()]){k++;s=b.slice(0,31-String(k).length-1)+' '+k}used[s.toLowerCase()]=1;return s}
 function typed(rows){return rows.map(function(r){var o=[];for(var i=0;i<r.length;i++)o[i]=r[i]==null?null:X.cell(r[i],dec);return o})}
 if(mode==='one'){var lines=[];pages.forEach(function(p){lines=lines.concat(p.lines)});var cols=X.columns(lines),hk=null,rows=[],merges=[];
  pages.forEach(function(p,pi){var gr=X.grid(p.lines,cols);var first=gr.rows.findIndex(function(r){return r.filter(function(x){return x!=null}).length>=2});
   if(pi===0&&first>=0)hk=X.key(gr.rows[first]);var off=rows.length,drop={};
   if(pi>0&&hk)gr.rows.forEach(function(r,i){if(X.key(r)===hk)drop[i]=1});
   var map={},n=0;gr.rows.forEach(function(r,i){if(drop[i])return;map[i]=off+n++;rows.push(r)});gr.merges.forEach(function(m){if(map[m.s.r]!=null)merges.push({s:{r:map[m.s.r],c:m.s.c},e:{r:map[m.s.r],c:m.e.c}})})});
  if(rows.length)res.push({name:nm('Sheet1'),rows:typed(rows),merges:merges,table:!!cols,pages:pages.length})}
 else pages.forEach(function(p,i){if(!p.lines.length)return;var gr=X.grid(p.lines,X.columns(p.lines));res.push({name:nm(pageWord+' '+(i+1)),rows:typed(gr.rows),merges:gr.merges,table:gr.table,page:i+1})});
 return res};
X.toSheet=function(XLSX,s){var ws={},R=0,C=0;s.rows.forEach(function(r,ri){r.forEach(function(c,ci){if(!c)return;var a=XLSX.utils.encode_cell({r:ri,c:ci});ws[a]=c;if(ri>R)R=ri;if(ci>C)C=ci})});
 ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:R,c:C}});if(s.merges.length)ws['!merges']=s.merges;
 var w=[];for(var i=0;i<=C;i++){var m=6;s.rows.forEach(function(r){if(r[i])m=Math.max(m,Math.min(60,String(r[i].v).length+2))});w.push({wch:m})}ws['!cols']=w;return ws};
X.book=function(XLSX,sheets){var wb=XLSX.utils.book_new();sheets.forEach(function(s){XLSX.utils.book_append_sheet(wb,X.toSheet(XLSX,s),s.name)});return wb};
g.PDFXL=X;if(typeof module!=='undefined')module.exports=X})(typeof window!=='undefined'?window:globalThis);
