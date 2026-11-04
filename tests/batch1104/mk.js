const {PDFDocument,StandardFonts,degrees}=require('/workspace/deskkit/node_modules/pdf-lib');
const Q=require('/workspace/deskkit/node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.js');const fs=require('fs');
(async()=>{
const d=await PDFDocument.create();const f=await d.embedFont(StandardFonts.Helvetica);d.setTitle('Hop dong');d.setAuthor('Linh');
for(let i=1;i<=10;i++){const p=d.addPage(i==3?[1190.55,841.89]:i==4?[612,792]:[595.28,841.89]);p.drawText('Body page '+i,{x:60,y:700,size:20,font:f});
 if(i==5)p.setRotation(degrees(90));if(i==6)p.setRotation(degrees(180));if(i==7)p.setRotation(degrees(270));if(i==8)p.setCropBox(50,100,400,500);}
fs.writeFileSync('ten.pdf',await d.save());
const q=await Q({noInitialRun:true,print:()=>{},printErr:()=>{}});q.FS.writeFile('/in.pdf',fs.readFileSync('ten.pdf'));
const enc=[['rc4_40','u','o','40'],['rc4_128','u','o','128','--use-aes=n'],['aes128','u','o','128','--use-aes=y'],['aes256','u','o','256'],['owner','','own','256'],['vi','mậtkhẩu 1','o','256']];
for(const [n,u,o,b,...x] of enc){const r=q.callMain(['--allow-weak-crypto','--encrypt',u,o,b,...x,...(n=='owner'?['--print=none','--extract=n']:[]),'--','/in.pdf','/'+n+'.pdf']);fs.writeFileSync(n+'.pdf',q.FS.readFile('/'+n+'.pdf'));console.log(n,r)}
const a=fs.readFileSync('aes256.pdf');fs.writeFileSync('trunc_enc.pdf',a.slice(0,a.length*0.6|0));
})();
