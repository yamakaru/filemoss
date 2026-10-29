// Unit tests for src/core.js. Expected values computed by hand / from official sources (OPM holiday calendar, IANA tz rules).
const DK=require('../src/core.js'),assert=require('assert');let n=0,fail=0;
function t(name,got,exp){n++;try{assert.deepStrictEqual(got,exp)}catch(e){fail++;console.log('FAIL',name,'\n  got',JSON.stringify(got),'\n  exp',JSON.stringify(exp))}}
function near(name,got,exp,eps=1e-6){t(name,Math.abs(got-exp)<eps?exp:got,exp)}
// word counter
let c=DK.countText("Hello world. It's a well-known test!\n\nSecond paragraph here?");
t('words',c.words,9);t('sentences',c.sentences,3);t('paragraphs',c.paragraphs,2);t('chars',c.chars,60);t('charsNoSpaces',c.charsNoSpaces,51);
t('empty',DK.countText('').words,0);t('empty sent',DK.countText('   ').sentences,0);t('emoji only',DK.countText('👍 👍').words,0);t('email one word',DK.countText('mail me at a.b@c.com now').words,5);
near('read time',DK.countText('w '.repeat(476)).readMin,2);
// case converter
t('title',DK.convertCase('the lord of the rings: the return of the king','title'),'The Lord of the Rings: The Return of the King');
t('title last small',DK.convertCase('what are you looking for','title'),'What Are You Looking For');
t('sentence',DK.convertCase('HELLO THERE. HOW ARE YOU? i AM FINE','sentence'),'Hello there. How are you? I am fine');
t('camel',DK.convertCase('Hello big World','camel'),'helloBigWorld');t('pascal',DK.convertCase('hello big world','pascal'),'HelloBigWorld');
t('snake from camel',DK.convertCase('helloBigWorld','snake'),'hello_big_world');t('kebab',DK.convertCase('Hello, Big World!','kebab'),'hello-big-world');
t('constant',DK.convertCase('max retry count','constant'),'MAX_RETRY_COUNT');t('upper',DK.convertCase('abc é','upper'),'ABC É');t('capitalized',DK.convertCase("it's a dog's life",'capitalized'),"It's A Dog's Life");
// diff
t('NFD words',DK.countText('Tiếng Việt đường phố nhiều ơn'.normalize('NFD')).words,6);
t('NFD chars',DK.countText('Tiếng Việt'.normalize('NFD')).chars,10);
t('NFD snake',DK.convertCase('đường Ơn'.normalize('NFD'),'snake'),'duong_on');t('NFC snake',DK.convertCase('đường Ơn','snake'),'duong_on');
t('NFD camel',DK.convertCase('đường Ơn'.normalize('NFD'),'camel'),'duongOn');t('Đ constant',DK.convertCase('Đà Nẵng xanh','constant'),'DA_NANG_XANH');
t('NFD upper stays NFC',DK.convertCase('đường'.normalize('NFD'),'upper'),'ĐƯỜNG');
t('diff NFC vs NFD',DK.diffLines('Tiếng Việt đường','Tiếng Việt đường'.normalize('NFD')).every(x=>x.t==='='),true);
t('diff',DK.diffLines('a\nb\nc','a\nx\nc').map(x=>x.t+x.s),['=a','-b','+x','=c']);
t('diff same',DK.diffLines('a\nb','a\nb').every(x=>x.t==='='),true);
t('diff ws',DK.diffLines('a  b','a b',{ignoreWs:true}).map(x=>x.t),['=']);
t('diff add end',DK.diffLines('a','a\nb').map(x=>x.t+x.s),['=a','+b']);
// holidays (OPM federal holiday calendars)
t('hol 2026',DK.usHolidays(2026).map(h=>h.date),['2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25']);
t('hol 2027',DK.usHolidays(2027).map(h=>h.date),['2027-01-01','2027-01-18','2027-02-15','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-10-11','2027-11-11','2027-11-25','2027-12-24','2027-12-31']);
t('hol 2022 (Jan1 Sat observed Dec 31 2021 belongs to 2021)',DK.usHolidays(2021).slice(-1)[0].date,'2021-12-31');
t('workdays 2026',DK.businessDays('2026-01-01','2026-12-31',{holidays:true}).businessDays,250);
t('weekdays 2026',DK.businessDays('2026-01-01','2026-12-31').businessDays,261);
t('nov 2026',DK.businessDays('2026-11-02','2026-11-30',{holidays:true}).businessDays,19); // 21 weekdays - Veterans - Thanksgiving
t('same day sat',DK.businessDays('2026-10-24','2026-10-24').businessDays,0);t('reverse',DK.businessDays('2026-10-23','2026-10-19').businessDays,-5);
t('extra day off',DK.businessDays('2026-11-23','2026-11-27',{holidays:true,extra:['2026-11-27']}).businessDays,3);
t('bad date',DK.businessDays('2026-02-30','2026-03-01'),null);
t('add 10 bd',DK.addBusinessDays('2026-11-02',10,{holidays:true}),'2026-11-17'); // skips Nov 11
t('add 1 over thanksgiving',DK.addBusinessDays('2026-11-25',1,{holidays:true}),'2026-11-27');
t('add -1',DK.addBusinessDays('2026-10-19',-1),'2026-10-16');
// time parsing & time card
t('pt',[DK.parseTime('9:00 AM'),DK.parseTime('12am'),DK.parseTime('12:30 pm'),DK.parseTime('1730'),DK.parseTime('5:30pm'),DK.parseTime('25:00'),DK.parseTime('13pm'),DK.parseTime('')],[540,0,750,1050,1050,null,null,null]);
let tc=DK.timecard(Array(5).fill({in:'8:00 AM',out:'5:30 PM',brk:30}),20,40,1.5);t('tc hours',tc.hours,45);t('tc ot',tc.overtime,5);t('tc pay',tc.pay,40*20+5*30);
t('empty days',DK.timecard([{in:'9:00',out:'17:00',brk:0},{in:'',out:'',brk:0}],10,40).hours,8);t('overnight',DK.timecard([{in:'10:00 PM',out:'6:00 AM',brk:0}],10,40).hours,8);t('hm',DK.hm(7.75),'7h 45m');
// salary
let s=DK.salary(25,'hour',40,52);t('annual',s.annual,52000);t('biweekly',s.biweekly,2000);near('monthly',s.monthly,52000/12);near('semimonthly',s.semimonthly,52000/24);
near('75k hourly',DK.salary(75000,'year',40,52).hourly,36.0576923077,1e-6);t('weekly to annual',DK.salary(1000,'week',40,52).annual,52000);
// percent
t('of',DK.pct.of(15,200),30);t('what',DK.pct.what(30,120),25);t('change',DK.pct.change(80,100),25);t('change neg base',DK.pct.change(-50,-25),50);near('inc',DK.pct.inc(50,10),55);t('dec',DK.pct.dec(50,10),45);t('diff',DK.pct.diff(40,60),40);
// meeting
let m=DK.meetingCost(6,85000*1.3,true,60,1);near('meeting',m.perMeeting,318.75);near('meeting yr',m.perYear,16575);t('hourly',DK.meetingCost(4,50,false,30,0).perMeeting,100);
// time zones (DST: US starts 2026-03-08, EU 2026-03-29)
t('NY EDT',new Date(DK.zonedToUtc('2026-03-09','09:00','America/New_York')).toISOString(),'2026-03-09T13:00:00.000Z');
t('NY EST',new Date(DK.zonedToUtc('2026-03-06','09:00','America/New_York')).toISOString(),'2026-03-06T14:00:00.000Z');
t('London GMT gap week',new Date(DK.zonedToUtc('2026-03-20','12:00','Europe/London')).toISOString(),'2026-03-20T12:00:00.000Z');
t('Kolkata',new Date(DK.zonedToUtc('2026-07-01','09:30','Asia/Kolkata')).toISOString(),'2026-07-01T04:00:00.000Z');
t('Sydney AEDT',new Date(DK.zonedToUtc('2026-01-15','09:00','Australia/Sydney')).toISOString(),'2026-01-14T22:00:00.000Z');
t('hourIn',DK.hourIn(Date.UTC(2026,6,1,4,0),'Asia/Kolkata'),9.5);t('hourIn LA',DK.hourIn(Date.UTC(2026,6,1,16,0),'America/Los_Angeles'),9);
// csv
t('csv quotes',DK.parseCSV('a,b\n"x, y","he said ""hi"""\n"multi\nline",2'),[['a','b'],['x, y','he said "hi"'],['multi\nline','2']]);
t('csv semicolon',DK.parseCSV('a;b\n1;2'),[['a','b'],['1','2']]);t('csv crlf bom',DK.parseCSV('\uFEFFa,b\r\n1,2\r\n'),[['a','b'],['1','2']]);
t('csv json types',DK.csvToJson('id,zip,ok,v\n1,00123,true,\n',{types:true}),[{id:1,zip:'00123',ok:true,v:null}]);
t('json csv',DK.jsonToCsv('[{"a":1,"b":"x,y"},{"a":2,"c":"q\\"t"}]'),'a,b,c\r\n1,"x,y",\r\n2,,"q""t"');
t('roundtrip',DK.csvToJson(DK.jsonToCsv([{n:'Lee, Sam',e:'line\nbreak'}])),[{n:'Lee, Sam',e:'line\nbreak'}]);
// ranges
t('ranges',DK.parseRanges('1-3, 5, 8-end',9),[[1,2,3],[5],[8,9]]);t('ranges reverse',DK.parseRanges('3-1',3),[[3,2,1]]);
let err=null;try{DK.parseRanges('1-12',10)}catch(e){err=e.message}t('range oor',err,'Page 12 is out of range (1–10)');
err=null;try{DK.parseRanges('abc',10)}catch(e){err=e.message}t('range bad',err,'Invalid range: "abc"');
// image fit
t('fit',DK.fitSize(4000,3000,1200,0,true),[1200,900]);t('fit both',DK.fitSize(4000,3000,1000,1000,true),[1000,750]);t('stretch',DK.fitSize(4000,3000,500,500,false),[500,500]);t('ext',DK.renameExt('IMG_01.HEIC','jpg'),'IMG_01.jpg');
// signature escaping
let sg=DK.signature({name:'<b>Eve</b>',email:'e@x.com',website:'x.com',phone:'(555) 123-4567',color:'red;x'});
t('sig esc',sg.includes('&lt;b&gt;Eve'),true);t('sig color fallback',sg.includes('#1d4ed8'),true);t('sig tel',sg.includes('href="tel:5551234567"'),true);t('sig web',sg.includes('href="https://x.com"'),true);
// delete pages / password generator
t('pagesExcept',DK.pagesExcept([[2],[5,6]],7),[1,3,4,7]);t('pagesExcept none',DK.pagesExcept([[9]],3),[1,2,3]);
t('pagesExcept all throws',(()=>{try{DK.pagesExcept([[1,2,3]],3);return 'no'}catch(e){return 'threw'}})(),'threw');
{let ok1=true,ok2=true,ok3=true,seen=new Set();for(let i=0;i<300;i++){const r=DK.password({length:12,upper:true,lower:true,digits:true,symbols:true});const p=r.password;seen.add(p);
 if(p.length!==12||!/[A-Z]/.test(p)||!/[a-z]/.test(p)||!/[0-9]/.test(p)||!/[^A-Za-z0-9]/.test(p))ok1=false;
 const q=DK.password({length:20,lower:true,digits:true,noSimilar:true}).password;if(/[Il1O0oA-Z]/.test(q)||/[^a-z0-9]/.test(q)||q.length!==20)ok2=false;}
 t('pw has every selected type',ok1,true);t('pw noSimilar & only chosen sets',ok2,true);t('pw unique',seen.size,300);}
t('pw bits 16 all',DK.password({length:16,upper:true,lower:true,digits:true,symbols:true}).bits,Math.round(16*Math.log2(26+26+10+25)));
t('pw length clamp',DK.password({length:2,digits:true}).password.length,4);
t('pw none throws',(()=>{try{DK.password({length:8});return 'no'}catch(e){return 'threw'}})(),'threw');
t('pw strength',[DK.pwStrength(30),DK.pwStrength(50),DK.pwStrength(70),DK.pwStrength(100)],['Weak','Fair','Strong','Very strong']);
{const cnt=new Array(10).fill(0);for(let i=0;i<20000;i++)cnt[DK.randInt(10)]++;t('randInt uniform-ish',cnt.every(x=>x>1700&&x<2300),true);}
t('ocrClean joins split accented capitals',DK.ocrClean('Tiếng Việt: Ắ Ằ Ä Ã Ặ x'),'Tiếng Việt: ẮẰÄÃẶ x');t('ocrClean keeps lowercase pairs',DK.ocrClean('ở ă'),'ở ă');
t('ocrClean NFC',DK.ocrClean('Vie\u0302\u0323t'),'Việt');t('ocrClean leaves ASCII letters',DK.ocrClean('I A B C test'),'I A B C test');t('ocrClean collapses spaces',DK.ocrClean('a  b\t\tc  \nx'),'a b c\nx');
t('ocrClean vie maps ä→ă',DK.ocrClean('Tiếng Việt: äâđ Ä','vie'),'Tiếng Việt: ăâđ Ă');t('ocrClean deu keeps ä',DK.ocrClean('Mädchen','deu'),'Mädchen');
t('viSyllable đã',DK.viSyllable('đã'),true);t('viSyllable ngã',DK.viSyllable('ngã'),true);t('viSyllable người',DK.viSyllable('người'),true);t('viSyllable ãã… invalid',DK.viSyllable('ããđêôơư'),false);
(function(){function sym(t,ch){return {text:t,choices:ch}}function D(words){return {text:words.map(w=>w.text).join(' ')+'\n',blocks:[{paragraphs:[{lines:[{words:words}]}]}]}}
var a=D([{text:'xãã',symbols:[sym('x',[{text:'x',confidence:99}]),sym('ã',[{text:'ã',confidence:83},{text:'ă',confidence:75}]),sym('ã',[{text:'ã',confidence:82},{text:'â',confidence:80}])]}]);t('ocrFixVi repairs invalid token',DK.ocrFixVi(a).text,'xăâ\n');
var b=D([{text:'đã',symbols:[sym('đ',[{text:'đ',confidence:99}]),sym('ã',[{text:'ã',confidence:83},{text:'ă',confidence:80}])]}]);t('ocrFixVi keeps valid đã',DK.ocrFixVi(b).text,'đã\n');
var c=D([{text:'xã',symbols:[sym('x',[{text:'x',confidence:99}]),sym('ã',[{text:'ã',confidence:90},{text:'ă',confidence:50}])]},{text:'ããa',symbols:[sym('ã',[{text:'ã',confidence:90},{text:'ă',confidence:60}]),sym('ã',[{text:'ã',confidence:90}]),sym('a',[{text:'a',confidence:90}])]}]);t('ocrFixVi needs close alternative',DK.ocrFixVi(c).text,'xã ããa\n');})();
console.log(fail?`${fail}/${n} core tests FAILED`:`core: all ${n} tests passed`);process.exit(fail?1:0);
