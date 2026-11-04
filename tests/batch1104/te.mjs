import * as pdfjs from '/workspace/deskkit/node_modules/pdfjs-dist/legacy/build/pdf.mjs';import fs from 'fs';import {createRequire} from 'module';const require=createRequire(import.meta.url);
const X=require('/workspace/deskkit/src/pdfxl.js');const XLSX=require('/workspace/deskkit/node_modules/xlsx');
const f=process.argv[2],mode=process.argv[3]||'one';const pdf=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(f)),verbosity:0}).promise;
const pages=await X.read(pdf);console.log('chars',pages.map(p=>p.chars).join(','));const sh=X.sheets(pages,mode,'Page');
const wb=X.book(XLSX,sh);XLSX.writeFile(wb,'/tmp/ft/out.xlsx');for(const s of sh){console.log('==',s.name,s.table,s.rows.length,JSON.stringify(s.merges));s.rows.slice(0,6).forEach(r=>console.log(JSON.stringify(r)))}
