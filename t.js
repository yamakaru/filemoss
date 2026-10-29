/* Anonymous, cookie-free tool-usage counter: tool name + action + language only. No files, no input values, no identifiers. */
(function(){try{var d=document,w=window,l=(d.documentElement.lang||'en').slice(0,2),p=location.pathname.split('/').filter(Boolean);if(p[0]===l)p.shift();var t=p[0]||'';if(!/^[a-z0-9-]{2,60}$/.test(t)||/^(about|privacy|contact)$/.test(t))return;
var s={},x=/[?&]evtest=1/.test(location.search)?1:0;
function f(a){try{if(s[a])return;s[a]=1;var b=JSON.stringify({t:t,a:a,l:l,x:x});if(navigator.sendBeacon&&navigator.sendBeacon('/api/e',new Blob([b],{type:'text/plain'})))return;if(w.fetch)fetch('/api/e',{method:'POST',body:b,keepalive:true,credentials:'omit'}).catch(function(){})}catch(e){}}
w.MTrack=f;
d.addEventListener('submit',function(e){var g=e.target;if(g&&g.classList&&!g.classList.contains('search'))f('calc')},true);
d.addEventListener('change',function(e){var g=e.target;if(g&&g.type==='file'&&g.files&&g.files.length)f('upload')},true);
d.addEventListener('drop',function(e){if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length)f('upload')},true);
var U=w.UI;if(U){['results','download','copy'].forEach(function(k){var o=U[k];if(typeof o!=='function')return;U[k]=function(){f(k==='results'?'process_done':k);return o.apply(this,arguments)}});
 d.addEventListener('input',function(e){var g=e.target;if(!d.querySelector('main input[type=file]')&&g&&g.type!=='file'&&g.closest&&g.closest('main')&&!g.closest('.search,form[role=search],.lsw'))f('calc')},true);
 d.addEventListener('click',function(e){var g=e.target&&e.target.closest&&e.target.closest('main button');if(g&&!d.querySelector('main input[type=file]')&&!g.closest('#out'))f('calc')},true)}
}catch(e){}})();
