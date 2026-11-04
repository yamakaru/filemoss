const PDFLib=require('/workspace/deskkit/node_modules/pdf-lib');const fontkit=require('/workspace/deskkit/node_modules/@pdf-lib/fontkit');const S=require('/workspace/deskkit/src/stamp.js');const fs=require('fs');
(async()=>{const src=fs.readFileSync(process.argv[2]||'ten.pdf');const doc=await PDFLib.PDFDocument.load(src,{updateMetadata:false});doc.registerFontkit(fontkit);
const tpl='Trang {n} / {p} – Hợp đồng ữ ỷ Ặ ページ';const fonts=[];for(const f of ['NotoSans-sub','NotoSansJP-sub']){if(f.includes('JP')&&!S.needsCJK(tpl))continue;const b=fs.readFileSync('/workspace/deskkit/fonts/'+f+'.ttf');fonts.push({pdf:await doc.embedFont(b,{subset:true}),fk:fontkit.create(b)})}
const png=await doc.embedPng(fs.readFileSync('/workspace/deskkit/tests/samples/sample.png'));
S.apply(PDFLib,doc,{fonts,text:{tpl,pos:'br',size:12},header:'Header Tiếng Việt',footer:'Footer',logo:{img:png,pos:'tl',w:60,opacity:.5},pages:S.parseRanges('',doc.getPageCount()),start:1,margin:28});
const out=await doc.save();fs.writeFileSync('st.pdf',out);console.log(src.length,out.length);})();
