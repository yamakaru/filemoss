/* FileMoss CSV kit (merge CSV, remove duplicate rows): encoding + delimiter detection, RFC 4180 parser, CSV/XLSX writer
   with spreadsheet-formula protection. Runs as a Web Worker (messages carry codes, never UI text) or as a plain script. */
(function(g){var K={};
K.ENCS=['utf-8','utf-16le','utf-16be','windows-1252','windows-1258','shift_jis'];
K.kind=function(b){if(b.length>=4&&b[0]==0x50&&b[1]==0x4b&&b[2]==3&&b[3]==4)return 'xlsx';if(b.length>=8&&b[0]==0xd0&&b[1]==0xcf&&b[2]==0x11&&b[3]==0xe0)return 'xls';
 /* T11-13: PDF / images are not spreadsheets */
 var h4=String.fromCharCode.apply(null,b.subarray(0,4));if(h4==='%PDF'||(b[0]==0x89&&h4.slice(1)==='PNG')||(b[0]==0xff&&b[1]==0xd8&&b[2]==0xff)||h4==='GIF8'||(h4==='RIFF'&&b.length>12&&String.fromCharCode(b[8],b[9],b[10],b[11])==='WEBP'))return 'bin';return 'text'};
K.bom=function(b){if(b[0]==0xef&&b[1]==0xbb&&b[2]==0xbf)return 'utf-8';if(b[0]==0xff&&b[1]==0xfe)return 'utf-16le';if(b[0]==0xfe&&b[1]==0xff)return 'utf-16be';return ''};
/* returns 'utf-8' | 'utf-16le' | 'utf-16be' | '' (unknown: ask the user) */
K.detectEnc=function(b){if(b[0]==0xef&&b[1]==0xbb&&b[2]==0xbf)return 'utf-8';if(b[0]==0xff&&b[1]==0xfe)return 'utf-16le';if(b[0]==0xfe&&b[1]==0xff)return 'utf-16be';
 var n=Math.min(b.length,4096),z0=0,z1=0;for(var i=0;i<n;i++)if(!b[i])(i%2?z1++:z0++);if(n>8&&z1>n/8&&z0<n/64)return 'utf-16le';if(n>8&&z0>n/8&&z1<n/64)return 'utf-16be';
 var c=b;if(b.length>65536){c=b.subarray(0,65536);var e=c.length;while(e>0&&(c[e-1]&0xc0)==0x80)e--;if(e>0&&c[e-1]>=0xc0)e--;c=c.subarray(0,e)}
 try{new TextDecoder('utf-8',{fatal:true}).decode(c);return 'utf-8'}catch(x){return ''}};
/* decode (to NFC unless nfc===false: remove-duplicate-rows keeps raw values and normalises only for comparison); bad = number of U+FFFD produced by undecodable bytes (shown to the user, never silently dropped) */
K.decode=function(b,enc,nfc){var t=new TextDecoder(enc||'utf-8').decode(b),t0=t.match(/\uFFFD/g);
 t=t.replace(/^\uFEFF/,'');var bad=t0?t0.length:0;return {text:nfc!==false&&t.normalize?t.normalize('NFC'):t,bad:bad}};
/* parse with quotes; stops after max records (preview/sniff). Returns array of arrays. */
K.parse=function(s,d,max,prog){var rows=[],row=[],f='',i=0,n=s.length,c,q=false,lastP=0;max=max||1e12;
 while(i<n){c=s.charCodeAt(i);
  if(q){if(c===34){if(s.charCodeAt(i+1)===34){f+='"';i+=2;continue}q=false;i++;continue}var j=s.indexOf('"',i);if(j<0){f+=s.slice(i);i=n;continue}f+=s.slice(i,j);i=j;continue}
  if(c===34&&f===''){q=true;i++;continue}
  if(s[i]===d){row.push(f);f='';i++;continue}
  if(c===13||c===10){row.push(f);f='';rows.push(row);row=[];i+=(c===13&&s.charCodeAt(i+1)===10)?2:1;if(rows.length>=max)return rows;if(prog&&i-lastP>2e6){lastP=i;prog(i/n)}continue}
  var k=i;while(k<n){var cc=s.charCodeAt(k);if(cc===13||cc===10||cc===34||s[k]===d)break;k++}if(k===i){f+=s[i];i++}else{f+=s.slice(i,k);i=k}}
 if(f!==''||row.length){row.push(f);rows.push(row)}
 while(rows.length&&rows[rows.length-1].length===1&&rows[rows.length-1][0]==='')rows.pop();return rows};
/* delimiter: the candidate giving the most rows with the same field count (>1) in the first 30 records */
K.sniff=function(s){var best=',',bs=-1,head=s.slice(0,65536);[',',';','\t','|'].forEach(function(d){var r=K.parse(head,d,30).filter(function(x){return x.length>1||x[0]!==''});if(r.length>1&&r.length<30)r=r;if(!r.length)return;
  var cnt={},mode=0,mc=0;r.forEach(function(x){cnt[x.length]=(cnt[x.length]||0)+1});for(var k in cnt)if(cnt[k]>mc||cnt[k]==mc&&+k>mode){mc=cnt[k];mode=+k}
  if(mode<2||r[0].length<2)return;var sc=mc/r.length*1000+mode;if(sc>bs){bs=sc;best=d}});return bs<0?'':best};
/* no delimiter found: one column (T11-12). U+0001 never occurs in text files */
K.ONE='\u0001';K.delimOf=function(t){var d=K.sniff(t);if(d)return d;var h=t.slice(0,65536);return /[,;\t|]/.test(h)?K.ONE:','};
/* OWASP CSV injection: cells starting with = + - @ tab CR (also full-width ＝＋－＠) get a leading apostrophe, except plain numbers */
K.danger=function(v){return /^[=+\-@\t\r\uFF1D\uFF0B\uFF0D\uFF20]/.test(v)&&!/^[-+]?\d[\d.,\s]*%?$/.test(v)};
K.csv=function(rows,d,guard){var re=new RegExp('["\\r\\n'+(d==='\t'?'\\t':d.replace(/[|\\]/g,'\\$&'))+']'),out=[];for(var r=0;r<rows.length;r++){var a=rows[r],l=[];for(var c=0;c<a.length;c++){var v=a[c]==null?'':String(a[c]);if(guard&&K.danger(v))v="'"+v;l.push(re.test(v)?'"'+v.replace(/"/g,'""')+'"':v)}out.push(l.join(d))}return '\uFEFF'+out.join('\r\n')+'\r\n'};
/* XLSX: every cell is written as text except plain, safe numbers (no leading zero, ≤15 digits) so IDs, dates and codes stay as typed */
K.num=function(v){return /^-?(0|[1-9]\d{0,14})(\.\d{1,10})?$/.test(v)&&String(+v)===v};
K.xlsx=function(X,rows,sheet){var ws={},R=rows.length,C=0;for(var r=0;r<R;r++){var a=rows[r];if(a.length>C)C=a.length;for(var c=0;c<a.length;c++){var v=a[c]==null?'':String(a[c]);if(v==='')continue;if(v.length>32767)v=v.slice(0,32767);ws[X.utils.encode_cell({r:r,c:c})]=K.num(v)?{t:'n',v:+v}:{t:'s',v:v}}}
 ws['!ref']=X.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(0,R-1),c:Math.max(0,C-1)}});var wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,sheet||'Sheet1');return X.write(wb,{type:'array',bookType:'xlsx',compression:true})};
K.readBook=function(X,b,sheet,nfc){var wb;try{wb=X.read(b,{type:'array',cellDates:true,cellNF:false,dense:false})}catch(e){throw new Error(/password|encrypt/i.test(e.message)?'xpw':'xbad')}
 var nm=wb.SheetNames.indexOf(sheet)>=0?sheet:wb.SheetNames[0];if(!nm)throw new Error('xbad');var ws=wb.Sheets[nm];
 var rows=X.utils.sheet_to_json(ws,{header:1,raw:false,defval:'',dateNF:'yyyy-mm-dd',blankrows:true});rows=rows.map(function(r){return r.map(function(v){v=v==null?'':String(v);return nfc!==false&&v.normalize?v.normalize('NFC'):v})});
 while(rows.length&&rows[rows.length-1].every(function(v){return v===''}))rows.pop();return {rows:rows,sheets:wb.SheetNames,sheet:nm}};
/* read one input -> {rows, enc, delim, bad, sheets} ; o: {enc, delim, sheet} */
K.read=function(X,b,o){o=o||{};var k=K.kind(b);if(!b.length)throw new Error('empty');if(k==='bin')throw new Error('notcsv');
 if(k!=='text'){if(!X)throw new Error('needx');var w=K.readBook(X,b,o.sheet,o.nfc);w.kind=k;w.bad=0;return w}
 var enc=K.detectEnc(b)||o.enc;if(!enc)throw new Error('enc');var d=K.decode(b,enc,o.nfc),delim=o.delim||K.delimOf(d.text);
 return {rows:K.parse(d.text,delim,0,o.prog),enc:enc,delim:delim,bad:d.bad,kind:'text'}};
K.info=function(X,b,o){var k=K.kind(b);if(!b.length)return {err:'empty'};if(k==='bin')return {kind:k,err:'notcsv'};if(k!=='text'){if(!X)return {kind:k,needx:1};try{var w=K.readBook(X,b,o&&o.sheet);return {kind:k,sheets:w.sheets,sheet:w.sheet,preview:w.rows.slice(0,4),cols:(w.rows[0]||[]).length}}catch(e){return {err:e.message}}}
 var enc=K.detectEnc(b)||(o&&o.enc),guess=enc||'';if(!enc)return {kind:'text',enc:'',err:'enc'};var head=b.subarray(0,Math.min(b.length,65536)),d=K.decode(head,enc),delim=(o&&o.delim)||K.delimOf(d.text),pv=K.parse(d.text,delim,5);
 return {kind:'text',enc:enc,delim:delim,preview:pv.slice(0,4),cols:(pv[0]||[]).length,bad:d.bad}};
function hnorm(h,ci){h=String(h).normalize?String(h).normalize('NFC'):String(h);h=h.replace(/^\uFEFF/,'').trim();return ci?h.toLowerCase().replace(/\s+/g,' '):h}
/* merge: files=[{rows,name}], o={by:'name'|'pos', ci, src, header:true} -> {rows, warn:{ragged,colsDiffer}, n} */
K.merge=function(files,o){var cols=[],idx={},out=[],ragged=0,colsDiffer=0,srcName=o.srcName||'Source file';
 if(o.by==='pos'){var w=0;files.forEach(function(f){var hl=(f.rows[0]||[]).length;if(w&&hl!==w)colsDiffer++;w=Math.max(w,hl)});var H=(files[0].rows[0]||[]).slice();while(H.length<w)H.push('');out.push(o.src?H.concat([srcName]):H);
  files.forEach(function(f){for(var r=1;r<f.rows.length;r++){var a=f.rows[r].slice();if(a.length!==(f.rows[0]||[]).length)ragged++;while(a.length<w)a.push('');out.push(o.src?a.concat([f.name]):a)}});return {rows:out,ragged:ragged,colsDiffer:colsDiffer,n:out.length-1}}
 var maps=files.map(function(f){var h=f.rows[0]||[],seen={},m=[];h.forEach(function(x,j){var k=hnorm(x,o.ci),lab=hnorm(x,false);if(k===''){k='\u0000col'+(j+1);lab='Column '+(j+1)}if(seen[k]){var nth=++seen[k];k=k+'\u0000'+nth;lab=lab+' ('+nth+')'}else seen[k]=1;if(!(k in idx)){idx[k]=cols.length;cols.push(lab)}m.push(idx[k])});return m});
 var W=cols.length;out.push(o.src?cols.concat([srcName]):cols.slice());
 files.forEach(function(f,fi){var m=maps[fi];for(var r=1;r<f.rows.length;r++){var a=f.rows[r],o2=new Array(W);for(var c=0;c<W;c++)o2[c]='';if(a.length!==m.length)ragged++;
  for(var c2=0;c2<a.length;c2++){if(c2<m.length)o2[m[c2]]=a[c2];else{var ek='\u0000extra'+(c2-m.length+1);if(!(ek in idx)){idx[ek]=cols.length;cols.push('Extra '+(c2-m.length+1));out[0].splice(o.src?out[0].length-1:out[0].length,0,'Extra '+(c2-m.length+1))}o2[idx[ek]]=a[c2]}}
  if(o.src)o2.push(f.name);out.push(o2)}});
 /* rows created before an Extra column appeared need padding */
 var WW=out[0].length;for(var r3=1;r3<out.length;r3++){var a3=out[r3];if(a3.length<WW){var s=o.src?a3.pop():null;while(a3.length<WW-(o.src?1:0))a3.push('');if(o.src)a3.push(s)}}
 return {rows:out,ragged:ragged,colsDiffer:0,n:out.length-1}};
/* dedupe: rows incl. header (o.header), o={keys:[col idx]|null, trim, collapse, ci, nfc, nfkc, empty, keep:'first'|'last', clean} */
K.norm=function(v,o){v=v==null?'':String(v);if(o.nfkc)v=v.normalize('NFKC');else if(o.nfc)v=v.normalize('NFC');if(o.trim)v=v.replace(/^\s+|\s+$/g,'');if(o.collapse)v=v.replace(/\s+/g,' ');if(o.ci)v=v.toLowerCase();return v};
K.dedupe=function(rows,o,prog){var H=o.header?rows[0]:null,start=o.header?1:0,keyOf={},keep=[],dup=[],empty=0,n=rows.length-start,ks=o.keys,sep='\u0001',firstAt={},rowsKept=[];
 var isEmpty=function(a){for(var c=0;c<a.length;c++)if(String(a[c]).replace(/\s+/g,'')!=='')return false;return true};
 var marks=new Uint8Array(rows.length),last={};
 for(var r=start;r<rows.length;r++){var a=rows[r];if(o.empty&&isEmpty(a)){marks[r]=2;empty++;continue}var key;if(ks){var p=[];for(var j=0;j<ks.length;j++)p.push(K.norm(a[ks[j]],o));key=p.join(sep)}else{var p2=[];for(var c=0;c<a.length;c++)p2.push(K.norm(a[c],o));while(p2.length&&p2[p2.length-1]==='')p2.pop();key=p2.join(sep)}
  if(o.keep==='last'){if(key in last)marks[last[key]]=1;last[key]=r}else{if(key in last)marks[r]=1;else last[key]=r}if(prog&&r%50000===0)prog(r/rows.length)}
 var clean=o.clean?function(a){return a.map(function(v){v=String(v==null?'':v);if(o.trim)v=v.replace(/^\s+|\s+$/g,'');if(o.collapse)v=v.replace(/\s+/g,' ');return v})}:function(a){return a};
 var outR=H?[H]:[],dupR=H?[H]:[];for(var r2=start;r2<rows.length;r2++){if(marks[r2]===0)outR.push(clean(rows[r2]));else if(marks[r2]===1)dupR.push(rows[r2])}
 return {rows:outR,dups:dupR,inN:n,dupN:dupR.length-(H?1:0),emptyN:empty,outN:outR.length-(H?1:0)}};
g.CSVK=K;if(typeof module!=='undefined')module.exports=K;
/* ---- worker protocol ---- */
if(typeof WorkerGlobalScope!=='undefined'&&g instanceof WorkerGlobalScope){var X=null;
 function lx(){if(!X){importScripts('/assets/xlsx.full.min.js'+(g.XQ||''));X=g.XLSX}return X}
 g.onmessage=function(ev){var m=ev.data,id=m.id;function P(f){g.postMessage({id:id,prog:f})}
  try{if(m.cmd==='info'){var b=new Uint8Array(m.buf),k=K.kind(b);g.postMessage({id:id,res:K.info(k==='xlsx'||k==='xls'?lx():null,b,m.o)});return}
   if(m.cmd==='merge'||m.cmd==='dedupe'){var files=[],bad=[];for(var i=0;i<m.files.length;i++){var f=m.files[i],bb=new Uint8Array(f.buf);try{var kk=K.kind(bb),r=K.read(kk==='xlsx'||kk==='xls'?lx():null,bb,{enc:f.enc,delim:f.delim,sheet:f.sheet,nfc:m.cmd==='merge',prog:function(x){P((i+x)/m.files.length*0.7)}});files.push({rows:r.rows,name:f.name,bad:r.bad,enc:r.enc,delim:r.delim})}catch(e){bad.push({name:f.name,code:e.message})}P((i+1)/m.files.length*0.7)}
    var info=files.map(function(f){return {name:f.name,bad:f.bad,rows:Math.max(0,f.rows.length-(m.o.header===false?0:1)),enc:f.enc,delim:f.delim}});
    if(!files.length){g.postMessage({id:id,res:{bad:bad,info:info}});return}
    var res,out={};if(m.cmd==='merge'){res=K.merge(files,m.o);out.main=res.rows}else{var all=files[0].rows;res=K.dedupe(all,m.o,function(x){P(0.7+x*0.2)});out.main=res.rows;out.dups=res.dups;delete res.rows;delete res.dups}
    var maxCell=0;out.main.forEach(function(a){for(var c=0;c<a.length;c++){var l=String(a[c]).length;if(l>maxCell)maxCell=l}});
    var enc=function(rows){return m.o.fmt==='xlsx'?K.xlsx(lx(),rows):new TextEncoder().encode(K.csv(rows,m.o.odelim||',',m.o.guard!==false)).buffer};
    if(m.o.fmt==='xlsx'&&out.main.length>1048576){g.postMessage({id:id,res:{bad:bad,info:info,tooMany:out.main.length}});return}
    var mainB=enc(out.main),dupB=out.dups&&out.dups.length>(m.o.header?1:0)?enc(out.dups):null;P(1);
    g.postMessage({id:id,res:{bad:bad,info:info,n:res.n,ragged:res.ragged,colsDiffer:res.colsDiffer,inN:res.inN,dupN:res.dupN,emptyN:res.emptyN,outN:res.outN,maxCell:maxCell,cols:(out.main[0]||[]).length,main:mainB,dups:dupB}},[mainB].concat(dupB?[dupB]:[]))}
  }catch(e){g.postMessage({id:id,err:/importScripts|NetworkError|load/i.test(String(e&&e.message||e))?'lib':'fail'})}}
 g.postMessage({ready:1})}
})(typeof self!=='undefined'?self:typeof window!=='undefined'?window:globalThis);
