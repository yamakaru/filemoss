const {PDFDocument,rgb}=require('/workspace/deskkit/node_modules/pdf-lib');const fontkit=require('/workspace/deskkit/node_modules/@pdf-lib/fontkit');const fs=require('fs');
(async()=>{const d=await PDFDocument.create();d.registerFontkit(fontkit);const f=await d.embedFont(fs.readFileSync('/workspace/deskkit/fonts/NotoSans-sub.ttf'),{subset:true});
const R=(p,t,x,y,right)=>{const w=f.widthOfTextAtSize(t,9);p.drawText(t,{x:right?x-w:x,y,size:9,font:f})};
let bal=10000000,td=0,tc=0,n=0;const cols=[50,120,330,420,520];
for(let pg=0;pg<3;pg++){const p=d.addPage([595,842]);let y=800;if(pg==0){R(p,'SAO KÊ TÀI KHOẢN — Ngân hàng Mẫu',50,y);y-=20;R(p,'Thông tin giao dịch',120,y);y-=16;}
 R(p,'Ngày',cols[0],y);R(p,'Diễn giải',cols[1],y);R(p,'Ghi nợ',cols[2]+40,y,1);R(p,'Ghi có',cols[3]+40,y,1);R(p,'Số dư',cols[4]+40,y,1);y-=14;
 for(let i=0;i<20;i++){n++;const deb=(n%3==0)?0:(n*12345%900000)+1000, cre=(n%3==0)?(n*77777%3000000)+5000:0;bal+=cre-deb;td+=deb;tc+=cre;
  const fm=v=>v?v.toLocaleString('de-DE'):'';R(p,String((n%28)+1).padStart(2,'0')+'/10/2026',cols[0],y);R(p,(n%2?'Chuyển khoản tiền điện':'Thanh toa\u0301n hóa đơn')+' #'+n,cols[1],y);R(p,fm(deb),cols[2]+40,y,1);R(p,fm(cre),cols[3]+40,y,1);R(p,fm(bal),cols[4]+40,y,1);y-=14}
 if(pg==2){y-=6;R(p,'Tổng cộng',cols[1],y);R(p,td.toLocaleString('de-DE'),cols[2]+40,y,1);R(p,tc.toLocaleString('de-DE'),cols[3]+40,y,1)}}
const p=d.addPage([595,842]);let y=800;for(const s of ["1.234.567,89","1,234,567.89","-1.500","(1.500)","12%","₫1.000","0912345678","00123","1234567890123456","04/11/2026","2026-11-04"]){R(p,'Mẫu',50,y);R(p,s,200,y);y-=14}
fs.writeFileSync('stmt.pdf',await d.save());console.log('debit',td,'credit',tc);
const d2=await PDFDocument.create();d2.registerFontkit(fontkit);const f2=await d2.embedFont(fs.readFileSync('/workspace/deskkit/fonts/NotoSans-sub.ttf'));const q=d2.addPage();q.drawText('Đây là một đoạn văn không có bảng.',{x:50,y:700,size:12,font:f2});q.drawText('Dòng thứ hai.',{x:50,y:680,size:12,font:f2});d2.addPage();fs.writeFileSync('notable.pdf',await d2.save());
const d3=await PDFDocument.create();const im=await d3.embedJpg(fs.readFileSync('/workspace/deskkit/tests/samples/scan1.jpg'));const pp=d3.addPage([im.width/4,im.height/4]);pp.drawImage(im,{x:0,y:0,width:im.width/4,height:im.height/4});fs.writeFileSync('scan.pdf',await d3.save());
fs.writeFileSync('fake.pdf','hello this is text');fs.writeFileSync('zero.pdf','');const t=fs.readFileSync('ten.pdf');fs.writeFileSync('broken.pdf',Buffer.concat([t.slice(0,300),Buffer.from('garbage')]));
})();
