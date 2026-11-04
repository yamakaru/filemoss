/* FileMoss Unlock core: removes restrictions, or opens the file with the password the user typed, via qpdf (wasm).
   It never guesses, tries lists of passwords or cracks anything: exactly one attempt per click. */
(function(g){var U={};
function tail(b){var n=b.length,s='';for(var i=Math.max(0,n-4096);i<n;i++)s+=String.fromCharCode(b[i]);return s}
function has(b,str){var s='';for(var i=0;i<b.length;i+=65536){s=String.fromCharCode.apply(null,b.subarray(Math.max(0,i-16),Math.min(b.length,i+65536)));if(s.indexOf(str)>=0)return true}return false}
U.run=function(q,bytes,pw){var FS=q.FS,id=Math.random().toString(36).slice(2),i='/u'+id+'.pdf',o='/o'+id+'.pdf',res;
 function call(a){try{return q.callMain(a)}catch(e){return 2}}
 try{var t=tail(bytes);if(t.indexOf('startxref')<0||t.indexOf('%%EOF')<0)return {status:'damaged'};
  FS.writeFile(i,bytes);var rq=call(['--requires-password',i]);
  if(rq===3){var r=call(['--decrypt','--',i,o]);res=(r===0||r===3)?{status:'ok',owner:true}:{status:'damaged'}}
  else if(call(['--check',i])===0)res={status:'none'};
  else if(!has(bytes,'/Encrypt'))res={status:'damaged'};
  else if(!pw)res={status:'needpw'};
  else{var r2=call(['--decrypt','--password='+pw,'--',i,o]);res=(r2===0||r2===3)?{status:'ok'}:{status:'badpw'}}
  if(res.status==='ok'){res.bytes=FS.readFile(o);if(call(['--check',o])===2)res={status:'damaged'}}
 }catch(e){res={status:'damaged'}}
 finally{[i,o].forEach(function(p){try{FS.unlink(p)}catch(e){}})}
 return res};
g.UNLOCK=U;if(typeof module!=='undefined')module.exports=U})(typeof window!=='undefined'?window:globalThis);
