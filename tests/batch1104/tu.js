const U=require('/workspace/deskkit/src/unlock.js');const Q=require('/workspace/deskkit/node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.js');const fs=require('fs');
(async()=>{const q=await Q({noInitialRun:true});
for(const [f,pw] of [['ten',''],['owner',''],['rc4_40',''],['rc4_40','x'],['rc4_40','u'],['rc4_128','u'],['aes128','u'],['aes256','sai'],['aes256','u'],['vi','mậtkhẩu 1'],['vi','matkhau 1'],['trunc_enc','u']]){const r=U.run(q,fs.readFileSync('/tmp/ft/'+f+'.pdf'),pw);console.log(f,pw,r.status,r.bytes&&r.bytes.length);if(r.bytes)fs.writeFileSync('/tmp/ft/out_'+f+'.pdf',r.bytes)}})();
