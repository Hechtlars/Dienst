// Runs the production app unchanged in a minimal non-rendering DOM host.
// This verifies calculations and migrations, not real-browser layout or PWA behaviour.
process.env.TZ='Europe/Berlin';
const fs=require('fs'),vm=require('vm'),path=require('path');
const project=path.resolve(__dirname,'..');
const elements=new Map();
function element(id='') {
 if(elements.has(id))return elements.get(id);
 const e={id,hidden:false,open:false,value:'',style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){},setAttribute(){},querySelectorAll(){return []},querySelector(){return element('child')},showModal(){this.open=true},close(){this.open=false},click(){},remove(){}};
 elements.set(id,e);return e;
}
const storage=new Map();
const context=vm.createContext({console,Intl,Date,Math,Number,String,Array,Object,Map,Set,JSON,Boolean,RegExp,Error,crypto:require('crypto').webcrypto,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},body:element('body'),visibilityState:'visible'},
 window:{addEventListener(){}},navigator:{},setInterval(){},setTimeout(){},clearTimeout(){},alert(){},confirm(){return true}});
vm.runInContext(fs.readFileSync(path.join(project,'app.js'),'utf8'),context);
const testSource=fs.readFileSync(path.join(__dirname,'run.cjs'),'utf8');
const start=testSource.indexOf('const checks=[];function check');
const end=testSource.indexOf('return checks;',start)+'return checks;'.length;
const checks=vm.runInContext('(function(){'+testSource.slice(start,end)+'})()',context);
const uiChecks=vm.runInContext(`(function(){
 const result=[];function check(name,condition){if(!condition)throw Error(name);result.push(name);}
 state.settings=normalizeSettings({showPay:true});state.duties=[];
 check('Bestätigte Periode ab März ergänzt',state.settings.rateHistory.some(r=>r.validFrom==='2026-03-01'&&r.holidayTimeOff==='yes'&&r.supplementBaseRate===50.26));
 openNewDuty();document.getElementById('dutyDate').value='2026-10-05';
 check('Neuer Dienst fragt nur Datum ab',!modalContent.innerHTML.includes('datetime-local')&&!modalContent.innerHTML.includes('actualDutyStart'));
 document.getElementById('saveDuty').onclick();check('Dienstformular speichert Dienst',state.duties.length===1&&state.duties[0].date==='2026-10-05');
 check('Neue Dienstgrenzen entsprechen Wochentagsvorgabe',dutyStart(state.duties[0]).getHours()===7&&dutyStart(state.duties[0]).getMinutes()===15&&localDateKey(dutyEnd(state.duties[0]))==='2026-10-06');
 const savedDuty=state.duties[0];
 openNewDuty();document.getElementById('dutyDate').value='';document.getElementById('saveDuty').onclick();check('Fehlendes Datum legt keinen Dienst an',state.duties.length===1&&document.getElementById('modalError').textContent.includes('Datum'));
 openNewDuty();document.getElementById('dutyDate').value=savedDuty.date;document.getElementById('saveDuty').onclick();check('Doppeltes Datum legt keinen Dienst an',state.duties.length===1&&document.getElementById('modalError').textContent.includes('bereits'));
 for(let day=6;day<=12;day++){
  const date='2026-10-'+pad(day),startTime=day===10||day===11?'08:30':'07:15',endTime=day===9||day===10?'08:30':'07:15';
  openNewDuty();document.getElementById('dutyDate').value=date;document.getElementById('saveDuty').onclick();
  const added=state.duties.find(d=>d.date===date);
  check('Datum allein speichert Wochentag '+parseLocalDate(date).getDay(),added&&added.startOverride===new Date(date+'T'+startTime).toISOString()&&added.endOverride===new Date('2026-10-'+pad(day+1)+'T'+endTime).toISOString());
 }
 state.duties=[savedDuty];
 state.settings.showCustomDutyTimes=true;state.settings.dutyTimes[2]={start:'18:20',end:'09:10'};
 openNewDuty();document.getElementById('dutyDate').value='2026-10-13';document.getElementById('dutyDate').onchange({target:{value:'2026-10-13'}});document.getElementById('saveDuty').onclick();
 const customDuty=state.duties.find(d=>d.date==='2026-10-13');
 check('Individuelle Dienstzeiten automatisch übernommen',dutyStart(customDuty).getHours()===18&&dutyStart(customDuty).getMinutes()===20&&dutyEnd(customDuty).getHours()===9&&localDateKey(dutyEnd(customDuty))==='2026-10-14'&&document.getElementById('dutyScheduleNote').textContent.includes('18:20'));
 state.settings.showCustomDutyTimes=false;state.duties=[savedDuty];
 openNewEntry(state.duties[0].id);document.getElementById('entryDate').value='2026-10-06';document.getElementById('entryStart').value='03:00';document.getElementById('entryEnd').value='03:10';document.getElementById('entryNote').value='Regression';document.getElementById('entryPatientIdPhoto').value='';
 document.getElementById('saveEntry').onclick();check('Einsatzformular speichert Nacht dem Dienst zu',state.duties[0].entries.length===1&&minutes(state.duties[0].entries[0])===10);
 const prior=JSON.stringify(savedDuty.entries),startBound=savedDuty.startOverride,endBound=savedDuty.endOverride;
 state.settings.showCustomDutyTimes=true;state.settings.dutyTimes[1]={start:'15:00',end:'15:00'};
 openEditDuty(savedDuty.id);check('Bearbeiten fragt keine zusätzlichen Uhrzeiten ab',!modalContent.innerHTML.includes('datetime-local'));
 document.getElementById('dutyDate').value=savedDuty.date;document.getElementById('saveDuty').onclick();
 check('Unverändertes Datum erhält Einsätze und gespeicherte Grenzen',JSON.stringify(savedDuty.entries)===prior&&savedDuty.startOverride===startBound&&savedDuty.endOverride===endBound);
 state.settings.showCustomDutyTimes=false;
 openEditDuty(savedDuty.id);document.getElementById('dutyDate').value='2026-10-07';document.getElementById('saveDuty').onclick();
 check('Datumänderung verschiebt Einsätze und erhält IDs',savedDuty.date==='2026-10-07'&&localDateKey(new Date(savedDuty.entries[0].start))==='2026-10-08'&&savedDuty.entries[0].id===JSON.parse(prior)[0].id&&savedDuty.startOverride===new Date('2026-10-07T07:15').toISOString());
 openEditDuty(savedDuty.id);document.getElementById('dutyDate').value='2026-10-05';document.getElementById('saveDuty').onclick();
 check('Datumänderung rückwärts erhält Einsatzinhalt',JSON.stringify(savedDuty.entries)===prior);
 state.settings.showCustomDutyTimes=true;state.settings.dutyTimes[4]={start:'07:15',end:'02:00'};
 const beforeRejectedEdit=JSON.stringify(savedDuty);
 openEditDuty(savedDuty.id);document.getElementById('dutyDate').value='2026-10-08';document.getElementById('saveDuty').onclick();
 check('Nicht passende Einsätze verhindern Änderung ohne Datenverlust',JSON.stringify(savedDuty)===beforeRejectedEdit&&document.getElementById('modalError').textContent.includes('keine Änderungen'));
 state.settings.showCustomDutyTimes=false;
 openEditEntry(state.duties[0].id,state.duties[0].entries[0].id);document.getElementById('entryDate').value='2026-10-06';document.getElementById('entryStart').value='03:00';document.getElementById('entryEnd').value='03:20';document.getElementById('entryNote').value='Geändert';document.getElementById('saveEntry').onclick();check('Einsatzformular Bearbeiten erhält ID',state.duties[0].entries.length===1&&minutes(state.duties[0].entries[0])===20);
 currentView='monat';selectedMonth=new Date(2026,9,1);renderMonth();check('Übersicht erzeugt Vergütung und Abgleich',main.innerHTML.includes('payrollComparison')&&main.innerHTML.includes('Rufbereitschaft'));
 renderDutyDetail(state.duties[0].id);check('Detail erzeugt Einzelvergütung',main.innerHTML.includes('entry-pay')&&main.innerHTML.includes('RB-Staffel'));
 openMenu();check('Einstellungen enthalten bestätigte FZA-Auswahl',modalContent.innerHTML.includes('Mit Freizeitausgleich (35 %)')&&modalContent.innerHTML.includes('Gruppe II'));
 check('Abrechnungsmonat Jahreswechsel',payrollDefaultPaymentMonth(new Date(2026,11,1))==='2027-01');
 return result;
})()`,context);
checks.push(...uiChecks);
fs.writeFileSync(path.join(__dirname,'core-results.json'),JSON.stringify({host:'Node production-script VM, Europe/Berlin',passed:checks.length,failed:0,checks},null,2));
console.log(checks.length+' calculation / tariff / migration checks passed');
