/* FileMoss stamp core (page numbers now, watermark next): draws text/images on each page in the page's
   visible orientation. Works on the visible area (CropBox) and honours /Rotate. Pure pdf-lib + fontkit. */
(function(g){var S={};
function E(code,a,b){var e=new Error(code);e.code=code;e.a=a;e.b=b;return e}
/* "1-3,5" -> [0,1,2,4]; empty -> all pages; "5-3" -> 3,4,5; errors carry codes for translated messages */
S.parseRanges=function(s,n){s=String(s==null?'':s).trim();var set={},out=[];if(!s){for(var i=0;i<n;i++)out.push(i);return out}
 s.split(/[,;]/).forEach(function(p){p=p.trim();if(!p)return;var m=/^(\d+)(?:\s*[-–]\s*(\d+|end))?$/i.exec(p);if(!m)throw E('range_bad',p);
  var a=+m[1],b=m[2]?(/end/i.test(m[2])?n:+m[2]):a;if(a>b){var t=a;a=b;b=t}if(a<1)throw E('range_zero',p);if(b>n)throw E('range_over',p,n);for(var k=a;k<=b;k++)set[k-1]=1});
 out=Object.keys(set).map(Number).sort(function(x,y){return x-y});if(!out.length)throw E('range_bad',s);return out};
S.fmt=function(tpl,n,p){return String(tpl).replace(/\{n\}/g,n).replace(/\{p\}/g,p)};
/* split text into runs by font that has the glyph */
function runs(text,fonts){var r=[];for(var ch of text){var cp=ch.codePointAt(0),fi=-1;for(var j=0;j<fonts.length;j++){if(fonts[j].fk.hasGlyphForCodePoint(cp)){fi=j;break}}if(fi<0){if(/\s/.test(ch))fi=0;else{ch='?';fi=0}}
 if(r.length&&r[r.length-1].f===fi)r[r.length-1].t+=ch;else r.push({f:fi,t:ch})}return r}
S.needsCJK=function(t){return /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/.test(t)};
/* geometry: visible box of the page, transform visible (u,v) -> user space for rotation r */
S.view=function(page){var b=page.getCropBox(),mb=page.getMediaBox();var x0=Math.max(b.x,mb.x),y0=Math.max(b.y,mb.y),x1=Math.min(b.x+b.width,mb.x+mb.width),y1=Math.min(b.y+b.height,mb.y+mb.height);
 if(x1<=x0||y1<=y0){x0=mb.x;y0=mb.y;x1=mb.x+mb.width;y1=mb.y+mb.height}var w=x1-x0,h=y1-y0,r=((page.getRotation().angle%360)+360)%360;
 return {r:r,W:r%180?h:w,H:r%180?w:h,map:function(u,v){return r===90?[x0+w-v,y0+u]:r===180?[x0+w-u,y0+h-v]:r===270?[x0+v,y0+h-u]:[x0+u,y0+v]}}};
function place(V,pos,bw,bh,m){var u=pos[1]==='l'?m:pos[1]==='r'?V.W-m-bw:(V.W-bw)/2,v=pos[0]==='t'?V.H-m-bh:m;
 u=Math.max(0,Math.min(u,V.W-bw));v=Math.max(0,Math.min(v,V.H-bh));return [u,v]}
/* opts: {fonts:[{pdf,fk}], text:{tpl,pos,size,color}, header, footer, logo:{img,pos,w,opacity}, pages:[idx], start, total, margin} */
S.apply=function(PDFLib,doc,o){var pages=doc.getPages(),T=o.total||pages.length,rgb=PDFLib.rgb,deg=PDFLib.degrees,c=o.color||[0,0,0];
 function text(page,V,str,pos,size,m,line){str=(str.normalize?str.normalize('NFC'):str);var rs=runs(str,o.fonts),wsum=0;rs.forEach(function(x){x.w=o.fonts[x.f].pdf.widthOfTextAtSize(x.t,size);wsum+=x.w});
  var bh=size*1.15;var w=wsum;var sc=1;if(w>V.W-2*Math.min(m,V.W/4)){sc=(V.W-2*Math.min(m,V.W/4))/w;size*=sc;w*=sc;bh*=sc;rs.forEach(function(x){x.w*=sc})}
  var p=place(V,pos,w,bh,m),u=p[0],v=p[1]+(pos[0]==='t'?-line*bh:line*bh)+size*0.22;v=Math.max(size*0.22,Math.min(v,V.H-size));
  rs.forEach(function(x){var q=V.map(u,v);page.drawText(x.t,{x:q[0],y:q[1],size:size,font:o.fonts[x.f].pdf,color:rgb(c[0],c[1],c[2]),rotate:deg(V.r)});u+=x.w})}
 o.pages.forEach(function(idx,k){var page=pages[idx],V=S.view(page),m=Math.min(o.margin||0,Math.min(V.W,V.H)/3),used={};
  function line(pos){var l=used[pos]||0;used[pos]=l+1;return l}
  if(o.text&&o.text.tpl)text(page,V,S.fmt(o.text.tpl,(o.start==null?1:o.start)+k,T),o.text.pos,o.text.size,m,line(o.text.pos));
  if(o.header)text(page,V,o.header,'tc',o.hsize||o.text.size,m,line('tc'));
  if(o.footer)text(page,V,o.footer,'bc',o.hsize||o.text.size,m,line('bc'));
  if(o.logo&&o.logo.img&&o.logo.opacity>0){var L=o.logo,iw=Math.min(L.w,V.W-2*m,V.W),ih=iw*L.img.height/L.img.width;if(ih>V.H/3){ih=V.H/3;iw=ih*L.img.width/L.img.height}
   var p=place(V,L.pos,iw,ih,m),q=V.map(p[0],p[1]);page.drawImage(L.img,{x:q[0],y:q[1],width:iw,height:ih,opacity:Math.min(1,L.opacity),rotate:deg(V.r)})}})};
g.STAMP=S;if(typeof module!=='undefined')module.exports=S})(typeof window!=='undefined'?window:globalThis);
