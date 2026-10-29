/* FileMoss browser helpers. Everything runs locally; no file is uploaded. */
var UI=(function(){var U={};
U.$=function(s,r){return (r||document).querySelector(s)};
U.loadScript=function(src){return new Promise(function(ok,no){if(document.querySelector('script[src="'+src+'"]'))return ok();var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=function(){no(new Error('Could not load '+src))};document.head.appendChild(s)})};
U.drop=function(zone,opt){var inp=zone.querySelector('input[type=file]');
 function take(fl){var a=[].slice.call(fl||[]);if(!a.length)return;opt.onFiles(opt.multiple?a:[a[0]])}
 var busy=0;function pick(){if(busy||!inp.files||!inp.files.length)return;busy=1;var a=[].slice.call(inp.files);setTimeout(function(){try{inp.value=''}catch(e){}busy=0},0);take(a)}
 inp.addEventListener('change',pick);inp.addEventListener('input',pick);
 /* files chosen before this script was ready (slow first load) are picked up too */
 if(inp.files&&inp.files.length)setTimeout(pick,0);
 zone.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();inp.click()}});if(!zone.hasAttribute('tabindex'))zone.tabIndex=0;
 ['dragenter','dragover'].forEach(function(e){zone.addEventListener(e,function(ev){ev.preventDefault();zone.classList.add('over')})});
 ['dragleave','drop'].forEach(function(e){zone.addEventListener(e,function(ev){ev.preventDefault();zone.classList.remove('over')})});
 zone.addEventListener('drop',function(ev){take(ev.dataTransfer.files)})};
U.download=function(blob,name){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},4000)};
U.copy=function(text,btn){var CT={ok:'Copied',no:'Could not copy. Select the text and press Ctrl+C (or long-press and Copy).'};
 function say(ok){if(btn){if(!btn._o)btn._o=btn.textContent;clearTimeout(btn._t);btn.textContent=ok?'✓ '+CT.ok:btn._o;btn.classList.toggle('copied',ok);btn._t=setTimeout(function(){btn.textContent=btn._o;btn.classList.remove('copied')},ok?2000:4000)}
  var s=btn?btn._m:U.$('#status');if(btn&&!s){s=btn._m=document.createElement('span');s.className='cpm';s.setAttribute('role','status');s.setAttribute('aria-live','polite');btn.insertAdjacentElement('afterend',s)}if(s){s.textContent=ok?CT.ok:CT.no;s.className=(btn?'cpm':'status')+(ok?'':' err')}}
 function fallback(){var ta=document.createElement('textarea'),r=false;ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.top='0';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{ta.setSelectionRange(0,text.length)}catch(e){}try{r=document.execCommand('copy')}catch(e){}ta.remove();say(r)}
 if(navigator.clipboard&&navigator.clipboard.writeText&&window.isSecureContext!==false)navigator.clipboard.writeText(text).then(function(){say(true)},fallback);else fallback()};
U.status=function(msg,err){var s=U.$('#status');if(s){s.textContent=msg;s.className='status'+(err?' err':'')}};
/* results list with per-file download + zip */
U.results=function(items){var box=U.$('#out');box.innerHTML='';U._items=items;items.forEach(function(it,i){var row=document.createElement('div');row.className='fileout';
 row.innerHTML='<span class="fn"></span><span class="fs"></span><button class="btn sm" type="button">Download</button>';row.querySelector('.fn').textContent=it.name;row.querySelector('.fs').textContent=DK.fileSize(it.blob.size)+(it.note?' · '+it.note:'');
 row.querySelector('button').onclick=function(){U.download(it.blob,it.name)};box.appendChild(row)});
 if(items.length>1){var z=document.createElement('button');z.className='btn';z.type='button';z.textContent='Download all ('+items.length+') as ZIP';z.onclick=function(){U.zip(items)};box.appendChild(z)}};
U.zip=function(items,name){return U.loadScript('/assets/jszip.min.js').then(function(){var z=new JSZip(),used={};items.forEach(function(it){var n=it.name,k=1;while(used[n])n=it.name.replace(/(\.[^.]+)?$/,'-'+(++k)+'$1');used[n]=1;z.file(n,it.blob)});return z.generateAsync({type:'blob'})}).then(function(b){U.download(b,name||'filemoss-files.zip')})};
/* image decode incl. HEIC */
U.isHeic=function(f){return /\.(heic|heif)$/i.test(f.name)||/image\/hei[cf]/.test(f.type)};
U.decode=function(file){var p=U.isHeic(file)?U.loadScript('/assets/heic2any.min.js').then(function(){return heic2any({blob:file,toType:'image/png'})}).then(function(b){return Array.isArray(b)?b[0]:b}):Promise.resolve(file);
 return p.then(function(b){return new Promise(function(ok,no){var img=new Image();img.onload=function(){ok(img)};img.onerror=function(){no(new Error(file.name+': this file could not be read as an image'))};img.src=URL.createObjectURL(b)})})};
U.toBlob=function(img,o){o=o||{};var wh=DK.fitSize(img.naturalWidth,img.naturalHeight,o.w,o.h,o.keep!==false),c=document.createElement('canvas');c.width=wh[0];c.height=wh[1];var x=c.getContext('2d');
 if(o.type==='image/jpeg'||o.bg){x.fillStyle=o.bg||'#ffffff';x.fillRect(0,0,c.width,c.height)}x.imageSmoothingQuality='high';x.drawImage(img,0,0,c.width,c.height);
 return new Promise(function(ok,no){c.toBlob(function(b){b?ok(b):no(new Error('Your browser cannot encode '+o.type))},o.type,o.quality)})};
return U;})();
