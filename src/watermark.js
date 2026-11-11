/* FileMoss watermark core: text (Noto Sans / Noto Sans JP, embedded once as subsets) or one image, drawn as vector
   content on each selected page in the page's visible orientation (CropBox + /Rotate, via STAMP.view). */
(function(g){var W={};
function runs(text,fonts){var r=[];for(var ch of text){var cp=ch.codePointAt(0),fi=-1;for(var j=0;j<fonts.length;j++)if(fonts[j].fk.hasGlyphForCodePoint(cp)){fi=j;break}
 if(fi<0)fi=0;if(r.length&&r[r.length-1].f===fi)r[r.length-1].t+=ch;else r.push({f:fi,t:ch})}return r}
/* characters no embedded font can draw (spaces are always fine) */
W.missing=function(text,fonts){var m=[];for(var ch of text){if(/\s/.test(ch))continue;var cp=ch.codePointAt(0);if(!fonts.some(function(f){return f.fk.hasGlyphForCodePoint(cp)})&&m.indexOf(ch)<0)m.push(ch)}return m};
W.hex=function(h){var m=/^#?([0-9a-f]{6})$/i.exec(h||'');var n=m?parseInt(m[1],16):0x808080;return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
/* angle in degrees: number from -360 to 360 (360 = 0); returns null when invalid */
W.angle=function(s){s=String(s==null?'':s).trim().replace(',','.');if(!/^-?\d+(\.\d+)?$/.test(s))return null;var a=+s;if(a<-360||a>360)return null;return a%360};
function rot(a,x,y){var c=Math.cos(a),s=Math.sin(a);return [x*c-y*s,x*s+y*c]}
/* o: {fonts, text, img, size (% of visible page width), opacity 0..1, angle, color [r,g,b], place: c|tile|tl|tc|tr|ml|mr|bl|bc|br, pages} */
W.apply=function(PDFLib,doc,o){var pages=doc.getPages(),deg=PDFLib.degrees,col=PDFLib.rgb(o.color[0],o.color[1],o.color[2]),A=o.angle*Math.PI/180,rs=o.text?runs(o.text.normalize('NFC'),o.fonts):null,w1=0;
 if(rs)rs.forEach(function(x){x.w1=o.fonts[x.f].pdf.widthOfTextAtSize(x.t,1);w1+=x.w1});
 o.pages.forEach(function(idx){var page=pages[idx],V=STAMP.view(page),bw0,bh0,iw,ih,sc;
  /* item box (unrotated) for this page, then shrink until the rotated box fits inside 92 % of the visible page */
  if(rs){var size=V.W*o.size/100/w1;iw=w1*size;ih=size}else{iw=V.W*o.size/100;ih=iw*o.img.height/o.img.width}
  var bw=Math.abs(iw*Math.cos(A))+Math.abs(ih*Math.sin(A)),bh=Math.abs(iw*Math.sin(A))+Math.abs(ih*Math.cos(A));sc=Math.min(1,V.W*0.92/bw,V.H*0.92/bh);iw*=sc;ih*=sc;bw*=sc;bh*=sc;
  var m=Math.min(36,Math.min(V.W,V.H)/12),P=o.place,cs=[];
  if(P==='tile'){var dx=bw+Math.max(ih,bw*0.25),dy=bh+Math.max(ih*1.5,bh*0.4),nx=Math.ceil(V.W/2/dx)+1,ny=Math.ceil(V.H/2/dy)+1;for(var i=-nx;i<=nx;i++)for(var j=-ny;j<=ny;j++){var cu=V.W/2+i*dx+(j%2?dx/2:0),cv=V.H/2+j*dy;if(cu+bw/2>0&&cu-bw/2<V.W&&cv+bh/2>0&&cv-bh/2<V.H)cs.push([cu,cv])}}
  else if(P==='c')cs.push([V.W/2,V.H/2]);
  else{var cu2=P[1]==='l'?m+bw/2:P[1]==='r'?V.W-m-bw/2:V.W/2,cv2=P[0]==='t'?V.H-m-bh/2:P[0]==='b'?m+bh/2:V.H/2;cs.push([cu2,cv2])}
  cs.forEach(function(c){
   if(rs){var size2=ih,d=rot(A,-iw/2,-size2*0.35),u=c[0]+d[0],v=c[1]+d[1];
    rs.forEach(function(x){var q=V.map(u,v),xw=x.w1*size2;page.drawText(x.t,{x:q[0],y:q[1],size:size2,font:o.fonts[x.f].pdf,color:col,opacity:o.opacity,rotate:deg(o.angle+V.r)});var a=rot(A,xw,0);u+=a[0];v+=a[1]})}
   else{var d2=rot(A,-iw/2,-ih/2),q2=V.map(c[0]+d2[0],c[1]+d2[1]);page.drawImage(o.img,{x:q2[0],y:q2[1],width:iw,height:ih,opacity:o.opacity,rotate:deg(o.angle+V.r)})}})})};
g.WMK=W;if(typeof module!=='undefined')module.exports=W})(typeof window!=='undefined'?window:globalThis);
