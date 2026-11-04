const X=require('/workspace/deskkit/src/pdfxl.js');
for(const s of ["1.234.567,89","1,234,567.89","-1.500","(1.500)","12%","₫1.000","0912345678","00123","1234567890123456","04/11/2026","2026-11-04","1.5","1,5","12,5%","0,5","2.000.000 đ","-","Hợp đồng","3","1 234,56","USD 12.00","100.000","1.000.000,00"])console.log(JSON.stringify(s),JSON.stringify(X.cell(s,'')),JSON.stringify(X.cell(s,',')))
