/* FileMoss document scanner core: edge detection, perspective warp, scan filters. Pure canvas/JS, no uploads. */
var Scan=(function(){var S={};
function gray(d,n){var g=new Float32Array(n);for(var i=0,j=0;i<n;i++,j+=4)g[i]=0.299*d[j]+0.587*d[j+1]+0.114*d[j+2];return g}
function boxBlur(a,w,h,r){var t=new Float32Array(w*h),o=new Float32Array(w*h),x,y,s,k;
 for(y=0;y<h;y++){s=0;for(x=-r;x<=r;x++)s+=a[y*w+Math.min(w-1,Math.max(0,x))];for(x=0;x<w;x++){t[y*w+x]=s/(2*r+1);s+=a[y*w+Math.min(w-1,x+r+1)]-a[y*w+Math.max(0,x-r)]}}
 for(x=0;x<w;x++){s=0;for(y=-r;y<=r;y++)s+=t[Math.min(h-1,Math.max(0,y))*w+x];for(y=0;y<h;y++){o[y*w+x]=s/(2*r+1);s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x]}}return o}
S.otsu=function(g){var hist=new Float64Array(256),n=g.length,i;for(i=0;i<n;i++)hist[Math.max(0,Math.min(255,g[i]|0))]++;var sum=0;for(i=0;i<256;i++)sum+=i*hist[i];
 var sB=0,wB=0,best=0,th=127;for(i=0;i<256;i++){wB+=hist[i];if(!wB)continue;var wF=n-wB;if(!wF)break;sB+=i*hist[i];var mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>best){best=v;th=i}}return th};
function hull(P){P.sort(function(a,b){return a[0]-b[0]||a[1]-b[1]});var cr=function(o,a,b){return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])},L=[],U=[],i;
 for(i=0;i<P.length;i++){while(L.length>=2&&cr(L[L.length-2],L[L.length-1],P[i])<=0)L.pop();L.push(P[i])}for(i=P.length-1;i>=0;i--){while(U.length>=2&&cr(U[U.length-2],U[U.length-1],P[i])<=0)U.pop();U.push(P[i])}L.pop();U.pop();return L.concat(U)}
function area(q){var a=0;for(var i=0;i<q.length;i++){var p=q[i],r=q[(i+1)%q.length];a+=p[0]*r[1]-r[0]*p[1]}return Math.abs(a)/2}
/* largest-area quadrilateral inscribed in the convex hull (exact search over hull vertices, hull is small) */
function bestQuad(H){var n=H.length;if(n<4)return null;var step=Math.max(1,Math.floor(n/60)),idx=[];for(var i=0;i<n;i+=step)idx.push(i);var m=idx.length,best=-1,bq=null;
 for(var a=0;a<m;a++)for(var c=a+2;c<m;c++){var A=H[idx[a]],C=H[idx[c]],b1=-1,bb=null,d1=-1,dd=null;
  for(var b=a+1;b<c;b++){var B=H[idx[b]],t=Math.abs((C[0]-A[0])*(B[1]-A[1])-(C[1]-A[1])*(B[0]-A[0]));if(t>b1){b1=t;bb=B}}
  for(var d=c+1;d<m+a;d++){var D=H[idx[d%m]],t2=Math.abs((C[0]-A[0])*(D[1]-A[1])-(C[1]-A[1])*(D[0]-A[0]));if(t2>d1){d1=t2;dd=D}}
  if(bb&&dd&&b1+d1>best){best=b1+d1;bq=[A,bb,C,dd]}}return bq}
S.order=function(q){var cx=0,cy=0;q.forEach(function(p){cx+=p[0]/4;cy+=p[1]/4});q=q.slice().sort(function(a,b){return Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx)});
 var k=0,mn=Infinity;q.forEach(function(p,i){if(p[0]+p[1]<mn){mn=p[0]+p[1];k=i}});return [0,1,2,3].map(function(i){return q[(k+i)%4]})}; /* tl,tr,br,bl (clockwise in screen coords) */
/* detect document quad in an image/canvas. Returns [[x,y]x4] in source pixel coords, or null. */
function convex(q){var sg=0;for(var i=0;i<4;i++){var a=q[i],b=q[(i+1)%4],c=q[(i+2)%4],z=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(!z)return false;if(!sg)sg=z>0?1:-1;else if((z>0?1:-1)!==sg)return false}return true}
function minAngle(q){var m=180;for(var i=0;i<4;i++){var a=q[(i+3)%4],b=q[i],c=q[(i+1)%4],v1=[a[0]-b[0],a[1]-b[1]],v2=[c[0]-b[0],c[1]-b[1]],t=Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1])/(Math.hypot(v1[0],v1[1])*Math.hypot(v2[0],v2[1])||1))))*180/Math.PI;m=Math.min(m,t)}return m}
/* candidates: largest connected component of a binary mask -> hull -> best inscribed quad */
function comp(mask,w,h){var lab=new Int32Array(w*h).fill(-1),stack=new Int32Array(w*h),best=null,id=0;
 for(var s=0;s<w*h;s++){if(lab[s]>=0||!mask[s])continue;var sp=0,cnt=0,pts=[],touch=0;stack[sp++]=s;lab[s]=id;
  while(sp){var p=stack[--sp],px=p%w,py=(p-px)/w;cnt++;var edge=px===0||py===0||px===w-1||py===h-1;if(edge)touch++;
   if(edge||!mask[p-1]||!mask[p+1]||!mask[p-w]||!mask[p+w])pts.push([px,py]);
   if(px>0&&lab[p-1]<0&&mask[p-1]){lab[p-1]=id;stack[sp++]=p-1}if(px<w-1&&lab[p+1]<0&&mask[p+1]){lab[p+1]=id;stack[sp++]=p+1}if(py>0&&lab[p-w]<0&&mask[p-w]){lab[p-w]=id;stack[sp++]=p-w}if(py<h-1&&lab[p+w]<0&&mask[p+w]){lab[p+w]=id;stack[sp++]=p+w}}
  if((!best||cnt>best.n)&&touch<0.5*(2*w+2*h))best={n:cnt,pts:pts};id++}return best}
function evalMask(mask,w,h,bonus,out,G){var c=comp(mask,w,h);if(!c||c.n<0.08*w*h||c.n>0.97*w*h)return;var q=bestQuad(hull(c.pts));if(!q||!convex(q))return;var a=area(q),fill=c.n/a;if(fill>1.08||fill<0.6)return;var ma=minAngle(S.order(q));if(ma<35)return;
 var sup=G?support(S.order(q),G,w,h):1;out.push({q:q,a:a,sup:sup,score:a*fill*fill*Math.min(1,ma/60)*bonus*sup*sup*sup})}
/* fraction of the quad's perimeter lying on a strong image edge */
function support(q,G,w,h){var hit=0,tot=0;for(var k=0;k<4;k++){var A=q[k],B=q[(k+1)%4],L=Math.hypot(B[0]-A[0],B[1]-A[1]),nx=-(B[1]-A[1])/L,ny=(B[0]-A[0])/L;for(var t=0.05;t<0.95;t+=0.9/40){var x=A[0]+(B[0]-A[0])*t,y=A[1]+(B[1]-A[1])*t,mx=0;for(var d=-3;d<=3;d++){var X=Math.round(x+nx*d),Y=Math.round(y+ny*d);if(X>0&&Y>0&&X<w-1&&Y<h-1)mx=Math.max(mx,G.m[Y*w+X])}tot++;if(mx>G.t)hit++}}return tot?hit/tot:0}
/* edge map (Sobel magnitude) closed into regions: robust for low-contrast backgrounds */
function grad(g,w,h){var m=new Float32Array(w*h),x,y;for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){var i=y*w+x,gx=g[i-w+1]+2*g[i+1]+g[i+w+1]-g[i-w-1]-2*g[i-1]-g[i+w-1],gy=g[i+w-1]+2*g[i+w]+g[i+w+1]-g[i-w-1]-2*g[i-w]-g[i-w+1];m[i]=Math.hypot(gx,gy)}return {m:m,t:Math.max(40,pctF(m,0.9))}}
function edgeMask(g,w,h){var m=new Float32Array(w*h),x,y,mx=0;for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){var i=y*w+x,gx=g[i-w+1]+2*g[i+1]+g[i+w+1]-g[i-w-1]-2*g[i-1]-g[i+w-1],gy=g[i+w-1]+2*g[i+w]+g[i+w+1]-g[i-w-1]-2*g[i-w]-g[i-w+1],v=Math.hypot(gx,gy);m[i]=v;if(v>mx)mx=v}
 var t=pctF(m,0.9),e=new Uint8Array(w*h);for(var i2=0;i2<w*h;i2++)e[i2]=m[i2]>t?1:0;
 /* fill: pixels not reachable from the border without crossing an edge = inside the document outline */
 var d=dilate(e,w,h,2),out=new Uint8Array(w*h).fill(1),st=[];for(x=0;x<w;x++){st.push(x,(h-1)*w+x)}for(y=0;y<h;y++){st.push(y*w,y*w+w-1)}
 while(st.length){var p=st.pop();if(!out[p]||d[p])continue;out[p]=0;var px=p%w;if(px>0)st.push(p-1);if(px<w-1)st.push(p+1);if(p>=w)st.push(p-w);if(p<w*(h-1))st.push(p+w)}return out}
function dilate(e,w,h,r){var o=new Uint8Array(w*h);for(var y=0;y<h;y++)for(var x=0;x<w;x++){if(!e[y*w+x])continue;for(var dy=-r;dy<=r;dy++)for(var dx=-r;dx<=r;dx++){var X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<w&&Y<h)o[Y*w+X]=1}}return o}
function pctF(a,p){var b=Array.prototype.slice.call(a).sort(function(x,y){return x-y});return b[Math.floor(p*(b.length-1))]}
/* detect document quad (multi-scale, multi-threshold, plus edge-based fallback). Returns [[x,y]x4] in source px or null. */
S.detect=function(src){var W=src.naturalWidth||src.width,H=src.naturalHeight||src.height,all=[];
 [360,560].forEach(function(T){var sc=Math.min(1,T/Math.max(W,H)),w=Math.max(8,Math.round(W*sc)),h=Math.max(8,Math.round(H*sc)),c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');x.drawImage(src,0,0,w,h);
  var g=boxBlur(gray(x.getImageData(0,0,w,h).data,w*h),w,h,2),th=S.otsu(g),loc=boxBlur(g,w,h,Math.round(Math.max(w,h)/8)),out=[],i,n=w*h;
  var G=grad(g,w,h);[th,th-18,th+18,th+36].forEach(function(t){var mb=new Uint8Array(n),md=new Uint8Array(n);for(i=0;i<n;i++){mb[i]=g[i]>t?1:0;md[i]=1-mb[i]}evalMask(mb,w,h,1.15,out,G);evalMask(md,w,h,0.9,out,G)});
  var ma=new Uint8Array(n);for(i=0;i<n;i++)ma[i]=g[i]>loc[i]+6?1:0;evalMask(ma,w,h,1,out,G);evalMask(edgeMask(g,w,h),w,h,0.95,out,G);
  out.forEach(function(o){o.q=o.q.map(function(p){return [Math.max(0,Math.min(W,(p[0]+0.5)/sc)),Math.max(0,Math.min(H,(p[1]+0.5)/sc))]});o.a/=sc*sc;o.score/=sc*sc;all.push(o)})});
 if(!all.length)return null;all.sort(function(a,b){return b.score-a.score});if(all[0].a<0.1*W*H||all[0].sup<0.45)return null;return S.order(all[0].q)};
/* ---- text-based deskew & orientation ---- */
function inkPoints(cv,maxDim){var k=Math.min(1,(maxDim||900)/Math.max(cv.width,cv.height)),w=Math.max(8,Math.round(cv.width*k)),h=Math.max(8,Math.round(cv.height*k)),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(cv,0,0,w,h);
 var g=gray(c.getContext('2d').getImageData(0,0,w,h).data,w*h),m=boxBlur(g,w,h,Math.max(4,Math.round(Math.max(w,h)/50))),P=[],mg=Math.round(Math.min(w,h)*0.03);
 for(var y=mg;y<h-mg;y++)for(var x=mg;x<w-mg;x++){var i=y*w+x;if(g[i]<m[i]*0.8&&g[i]<170&&m[i]>135)P.push(x,y)}return {P:P,w:w,h:h}}
function profScore(I,deg,vertical){var a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),P=I.P,D=Math.ceil(Math.hypot(I.w,I.h))+2,b=new Float64Array(2*D),i,v;
 for(i=0;i<P.length;i+=2){v=vertical?P[i]*c+P[i+1]*s:-P[i]*s+P[i+1]*c;b[(v+D)|0]++}var sc=0;for(i=1;i<b.length;i++){var d=b[i]-b[i-1];sc+=d*d}return sc}
function bestAngle(I,vertical,range){var best=0,bs=-1,a;for(a=-range;a<=range;a+=1){var t=profScore(I,a,vertical);if(t>bs){bs=t;best=a}}var c=best;for(a=c-1;a<=c+1;a+=0.1){var t2=profScore(I,a,vertical);if(t2>bs){bs=t2;best=a}}return {angle:Math.round(best*10)/10,score:bs}}
/* returns degrees to rotate (clockwise positive) so text lines become horizontal */
S.skew=function(cv){var I=inkPoints(cv);if(I.P.length<400)return 0;return -bestAngle(I,false,20).angle};
S.rotateFine=function(cv,deg,keep){if(!deg||Math.abs(deg)<0.05)return cv;var a=deg*Math.PI/180,W=cv.width,H=cv.height,nw=keep?W:Math.round(Math.abs(W*Math.cos(a))+Math.abs(H*Math.sin(a))),nh=keep?H:Math.round(Math.abs(W*Math.sin(a))+Math.abs(H*Math.cos(a)));
 var d=cv.getContext('2d').getImageData(0,0,W,H).data,r=0,g=0,b=0,n=0;for(var i=0;i<d.length;i+=4*97){var l=d[i]+d[i+1]+d[i+2];if(l>540){r+=d[i];g+=d[i+1];b+=d[i+2];n++}}
 var o=document.createElement('canvas');o.width=nw;o.height=nh;var x=o.getContext('2d');x.fillStyle=n?'rgb('+(r/n|0)+','+(g/n|0)+','+(b/n|0)+')':'#fff';x.fillRect(0,0,nw,nh);x.translate(nw/2,nh/2);x.rotate(a);x.imageSmoothingQuality='high';x.drawImage(cv,-W/2,-H/2);return o};
/* quarter turns (0-3, clockwise) needed so text is upright. Lines vs columns by projection profile; 180° by ascender/descender asymmetry. */
S.orient=function(cv){var I=inkPoints(cv,700);if(I.P.length<400)return 0;var hz=bestAngle(I,false,4).score,vt=bestAngle(I,true,4).score,q=0;
 if(vt>hz*1.3){q=1;cv=S.rotate(cv,1);I=inkPoints(cv,700)}
 return (q+(S.upsideDown(I)?2:0))%4};
S.upsideDown=function(I){var h=I.h,prof=new Float64Array(h),P=I.P,i;for(i=1;i<P.length;i+=2)prof[P[i]]++;var mx=0;for(i=0;i<h;i++)mx=Math.max(mx,prof[i]);var up=0,dn=0,y=0;
 while(y<h){if(prof[y]<mx*0.06){y++;continue}var y0=y;while(y<h&&prof[y]>=mx*0.06)y++;var y1=y,lm=0,j;if(y1-y0<4)continue;for(j=y0;j<y1;j++)lm=Math.max(lm,prof[j]);
  var c0=-1,c1=-1;for(j=y0;j<y1;j++)if(prof[j]>=lm*0.45){if(c0<0)c0=j;c1=j}var a=0,b=0,tot=0;for(j=y0;j<c0;j++)a+=prof[j];for(j=c1+1;j<y1;j++)b+=prof[j];for(j=y0;j<y1;j++)tot+=prof[j];if(tot){up+=a;dn+=b}}
 return dn>up*1.25};
S.fullQuad=function(W,H,inset){var m=inset||0;return [[m*W,m*H],[W-m*W,m*H],[W-m*W,H-m*H],[m*W,H-m*H]]};
function solve(A,b){var n=b.length,i,j,k;for(i=0;i<n;i++){var mx=i;for(k=i+1;k<n;k++)if(Math.abs(A[k][i])>Math.abs(A[mx][i]))mx=k;var t=A[i];A[i]=A[mx];A[mx]=t;t=b[i];b[i]=b[mx];b[mx]=t;
 for(k=i+1;k<n;k++){var f=A[k][i]/A[i][i];for(j=i;j<n;j++)A[k][j]-=f*A[i][j];b[k]-=f*b[i]}}var x=new Array(n);for(i=n-1;i>=0;i--){var s=b[i];for(j=i+1;j<n;j++)s-=A[i][j]*x[j];x[i]=s/A[i][i]}return x}
/* homography mapping points p[i] -> q[i] */
S.homography=function(p,q){var A=[],b=[];for(var i=0;i<4;i++){var x=p[i][0],y=p[i][1],u=q[i][0],v=q[i][1];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v)}var h=solve(A,b);h.push(1);return h};
/* true width:height of the paper from its perspective quad, assuming a pinhole camera centred on the image (Zhang & He, whiteboard scanning) */
S.aspect=function(q,W,H){var u0=W/2,v0=H/2,m1=[q[0][0],q[0][1],1],m2=[q[1][0],q[1][1],1],m3=[q[3][0],q[3][1],1],m4=[q[2][0],q[2][1],1];
 var cr=function(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]},dt=function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]};
 var k2=dt(cr(m1,m4),m3)/dt(cr(m2,m4),m3),k3=dt(cr(m1,m4),m2)/dt(cr(m3,m4),m2),n2=[k2*m2[0]-m1[0],k2*m2[1]-m1[1],k2*m2[2]-m1[2]],n3=[k3*m3[0]-m1[0],k3*m3[1]-m1[1],k3*m3[2]-m1[2]];
 var f2=-((n2[0]*n3[0]-(n2[0]*n3[2]+n2[2]*n3[0])*u0+n2[2]*n3[2]*u0*u0)+(n2[1]*n3[1]-(n2[1]*n3[2]+n2[2]*n3[1])*v0+n2[2]*n3[2]*v0*v0))/(n2[2]*n3[2]);
 var r;if(isFinite(f2)&&f2>0&&Math.abs(n2[2]*n3[2])>1e-12){var Q=function(n){var a=n[0]-u0*n[2],b=n[1]-v0*n[2];return (a*a+b*b)/f2+n[2]*n[2]};r=Math.sqrt(Q(n2)/Q(n3))}else r=Math.sqrt((n2[0]*n2[0]+n2[1]*n2[1])/(n3[0]*n3[0]+n3[1]*n3[1]));
 return isFinite(r)&&r>0.1&&r<10?r:null};
S.outSize=function(q,maxDim,W,H){var d=function(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])},w=Math.max(d(q[0],q[1]),d(q[3],q[2])),h=Math.max(d(q[0],q[3]),d(q[1],q[2]));
 var r=W&&H?S.aspect(q,W,H):null,naive=w/h;if(r&&Math.abs(Math.log(r/naive))<0.35){if(w/h>r)h=w/r;else w=h*r}var s=Math.min(1,(maxDim||2400)/Math.max(w,h));return [Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s))]};
S.warp=function(src,q,maxDim){var W=src.naturalWidth||src.width,H=src.naturalHeight||src.height,sz=S.outSize(q,maxDim,W,H),ow=sz[0],oh=sz[1];
 var ic=document.createElement('canvas');ic.width=W;ic.height=H;var ix=ic.getContext('2d');ix.drawImage(src,0,0);var sd=ix.getImageData(0,0,W,H).data;
 var hm=S.homography([[0,0],[ow,0],[ow,oh],[0,oh]],q),oc=document.createElement('canvas');oc.width=ow;oc.height=oh;var ox=oc.getContext('2d'),od=ox.createImageData(ow,oh),D=od.data;
 for(var y=0;y<oh;y++)for(var x=0;x<ow;x++){var X=x+0.5,Y=y+0.5,z=hm[6]*X+hm[7]*Y+1,sx=(hm[0]*X+hm[1]*Y+hm[2])/z-0.5,sy=(hm[3]*X+hm[4]*Y+hm[5])/z-0.5;
  var x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0;if(x0<0){x0=0;fx=0}if(y0<0){y0=0;fy=0}if(x0>=W-1){x0=W-2;fx=1}if(y0>=H-1){y0=H-2;fy=1}
  var i00=(y0*W+x0)*4,i10=i00+4,i01=i00+W*4,i11=i01+4,o=(y*ow+x)*4;for(var c=0;c<3;c++)D[o+c]=(sd[i00+c]*(1-fx)+sd[i10+c]*fx)*(1-fy)+(sd[i01+c]*(1-fx)+sd[i11+c]*fx)*fy;D[o+3]=255}
 ox.putImageData(od,0,0);return oc};
/* filters: original | enhance (magic color) | gray | bw */
S.filter=function(cv,mode){if(mode==='original')return cv;var w=cv.width,h=cv.height,x=cv.getContext('2d'),id=x.getImageData(0,0,w,h),d=id.data,n=w*h,g=gray(d,n),i,j;
 if(mode==='gray'){var lo=pct(g,0.01),hi=pct(g,0.99);for(i=0,j=0;i<n;i++,j+=4){var v=clamp((g[i]-lo)*255/Math.max(1,hi-lo));d[j]=d[j+1]=d[j+2]=v}}
 else{var r=Math.max(8,Math.round(Math.max(w,h)/40)),bg=bgEstimate(g,w,h,r);
  if(mode==='bw'){var m=boxBlur(g,w,h,Math.max(6,Math.round(Math.max(w,h)/60)));for(i=0,j=0;i<n;i++,j+=4){var nv=g[i]/Math.max(1,bg[i]),v2=(g[i]<m[i]*0.88&&nv<0.8)?0:255;d[j]=d[j+1]=d[j+2]=v2}}
  else{for(i=0,j=0;i<n;i++,j+=4){var f=255/Math.max(30,bg[i]);for(var c=0;c<3;c++){var t=d[j+c]*f;t=(t-25)*1.15;d[j+c]=clamp(t>238?255:t)}}}}
 x.putImageData(id,0,0);return cv};
function clamp(v){return v<0?0:v>255?255:v}
function pct(g,p){var h=new Uint32Array(256);for(var i=0;i<g.length;i++)h[g[i]|0]++;var t=g.length*p,s=0;for(i=0;i<256;i++){s+=h[i];if(s>=t)return i}return 255}
/* paper brightness: max-filter on a small image (removes text), then blur, then upsample */
function bgEstimate(g,w,h,r){var sw=Math.max(4,Math.round(w/r*4)),sh=Math.max(4,Math.round(h/r*4)),s=new Float32Array(sw*sh),x,y;
 for(y=0;y<sh;y++)for(x=0;x<sw;x++){var x0=Math.floor(x*w/sw),x1=Math.floor((x+1)*w/sw),y0=Math.floor(y*h/sh),y1=Math.floor((y+1)*h/sh),mx=0;for(var yy=y0;yy<y1;yy+=1)for(var xx=x0;xx<x1;xx+=1){var v=g[yy*w+xx];if(v>mx)mx=v}s[y*sw+x]=mx}
 var t=new Float32Array(sw*sh);for(y=0;y<sh;y++)for(x=0;x<sw;x++){var mm=0;for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++){var X=Math.min(sw-1,Math.max(0,x+dx)),Y=Math.min(sh-1,Math.max(0,y+dy));if(s[Y*sw+X]>mm)mm=s[Y*sw+X]}t[y*sw+x]=mm}
 t=boxBlur(t,sw,sh,2);var o=new Float32Array(w*h);for(y=0;y<h;y++){var fy=Math.min(sh-1.001,Math.max(0,(y+0.5)*sh/h-0.5)),y0=Math.floor(fy),ay=fy-y0;for(x=0;x<w;x++){var fx=Math.min(sw-1.001,Math.max(0,(x+0.5)*sw/w-0.5)),x0=Math.floor(fx),ax=fx-x0;
  o[y*w+x]=(t[y0*sw+x0]*(1-ax)+t[y0*sw+x0+1]*ax)*(1-ay)+(t[(y0+1)*sw+x0]*(1-ax)+t[(y0+1)*sw+x0+1]*ax)*ay}}return o}
S.rotate=function(cv,quarter){quarter=((quarter%4)+4)%4;if(!quarter)return cv;var o=document.createElement('canvas');o.width=quarter%2?cv.height:cv.width;o.height=quarter%2?cv.width:cv.height;var x=o.getContext('2d');x.translate(o.width/2,o.height/2);x.rotate(quarter*Math.PI/2);x.drawImage(cv,-cv.width/2,-cv.height/2);return o};
S.clone=function(cv){var o=document.createElement('canvas');o.width=cv.width;o.height=cv.height;o.getContext('2d').drawImage(cv,0,0);return o};
/* OCR (lazy-loaded tesseract.js, self-hosted; one worker per language) */
S.OCRL={en:'eng',vi:'vie',es:'spa',pt:'por',fr:'fra',de:'deu',it:'ita',id:'ind',ja:'jpn'};
S.ocrDefault=function(){var l=(document.documentElement.lang||'en').slice(0,2).toLowerCase();return S.OCRL[l]||'eng'};
var workers={};S.ocrWorker=function(lang){lang=lang||S.ocrDefault();if(workers[lang])return workers[lang];var w=workers[lang]=UI.loadScript('/assets/tess/tesseract.min.js').then(function(){return Tesseract.createWorker(lang,1,{workerPath:'/assets/tess/worker.min.js',corePath:'/assets/tess/',langPath:'/assets/tess/lang',gzip:true,logger:function(m){S._onp&&S._onp(m)}}).then(function(w){return /^vie/.test(lang)?w.setParameters({lstm_choice_mode:'2'}).then(function(){return w}):w})});w.catch(function(){delete workers[lang]});return w};
S.ocr=function(img,onProgress,lang){S._onp=onProgress;return S.ocrWorker(lang).then(function(w){return w.recognize(img)}).then(function(r){var d=r.data;if(d&&/^vie/.test(lang||S.ocrDefault())&&typeof DK!='undefined'&&DK.ocrFixVi)DK.ocrFixVi(d);if(d&&typeof d.text=='string'&&typeof DK!='undefined'&&DK.ocrClean)d.text=DK.ocrClean(d.text,lang||S.ocrDefault());return d})};
return S;})();
