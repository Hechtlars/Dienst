const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const results=[];
async function run(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',error:e.message});throw e;}}
(async()=>{
 for(const [browserType,width] of [[chromium,1280],[chromium,390],[webkit,390]]){
  const label=browserType.name()+'-'+width;
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext({viewport:{width,height:844},timezoneId:'Europe/Berlin',acceptDownloads:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765');
  await run(label+' Tarif, Rechnung, Migration',async()=>{
   const checks=await page.evaluate(()=>{
    const checks=[];function check(name,condition){if(!condition)throw Error(name);checks.push(name);}
    function near(a,b){return Math.abs(a-b)<.000001;}
    const rate={validFrom:'1900-01-01',workHourlyRate:50.96,allowanceHourlyRate:43.42,supplementBaseRate:50.26,holidayTimeOff:'no',ratesConfirmed:true,employmentFraction:1};
    state.settings=normalizeSettings({tariffProfileVersion:1,holidayRuleVersion:2,august2026RateCorrectionVersion:1,showPay:true,rateHistory:[rate],employmentFraction:1,payroll:{}});
    const entry=(id,start,end,type='Telefonisch')=>({id,type,start:new Date(start).toISOString(),end:new Date(end).toISOString(),note:''});
    const duty=(date,entries=[])=>({id:date,date,entries,startOverride:new Date(date+'T07:15').toISOString(),endOverride:new Date(new Date(date+'T07:15').getTime()+24*3600000).toISOString()});
    let d=duty('2026-10-05',[entry('a','2026-10-05T19:00','2026-10-05T19:10'),entry('b','2026-10-05T19:20','2026-10-05T19:30')]);state.duties=[d];
    let p=dutyPay(d);check('Telefonpool 20 Minuten = 1 Stunde',p.hours===1&&near(p.hoursPay,50.96));
    check('Telefonpool Einzelanteile',p.entryDetails.every(e=>near(e.hoursPay,25.48)));
    d.entries.push(entry('c','2026-10-05T20:00','2026-10-05T20:10','Im Haus'),entry('e','2026-10-05T21:00','2026-10-05T22:10','Im Haus'));
    p=dutyPay(d);check('Haus einzeln 10 + 70 = 3 Stunden',houseRoundedHours(d)===3&&p.hours===4);
    check('Mo-Pauschale Faktor 2',near(p.allowance,86.84));
    d=duty('2026-10-10',[]);state.duties=[d];check('Sa-Pauschale Faktor 4',near(dutyPay(d).allowance,173.68));
    d=duty('2026-10-03',[]);check('NRW Feiertagspauschale',near(dutyPay(d).allowance,173.68));
    check('NRW bewegliche Feiertage',isNrwHoliday(new Date('2026-04-03T12:00'))&&isNrwHoliday(new Date('2026-04-06T12:00'))&&isNrwHoliday(new Date('2026-05-14T12:00'))&&isNrwHoliday(new Date('2026-05-25T12:00'))&&isNrwHoliday(new Date('2026-06-04T12:00')));
    check('Karfreitag nicht Ostersonntag',!isNrwHoliday(new Date('2026-04-05T12:00')));
    const corrected=normalizeSettings({tariffProfileVersion:1,rateHistory:[rate],holidayTimeOff:'no'});check('Nutzerkorrektur FZA historisch ohne Änderung der Stundensätze',corrected.holidayTimeOff==='yes'&&corrected.rateHistory[0].holidayTimeOff==='yes'&&corrected.rateHistory[0].workHourlyRate===50.96);
    state.settings=corrected;d=duty('2026-05-01',[entry('h','2026-05-01T11:00','2026-05-01T12:00')]);state.duties=[d];check('Feiertag mit FZA 35 %',near(dutyPay(d).supplements.holiday,50.26*.35));
    state.settings=normalizeSettings({tariffProfileVersion:1,holidayRuleVersion:2,august2026RateCorrectionVersion:1,showPay:true,rateHistory:[rate],employmentFraction:1,payroll:{}});
    d=duty('2026-10-05',[entry('n','2026-10-06T03:00','2026-10-06T03:10')]);state.duties=[d];p=dutyPay(d);
    check('Nacht nur tatsächliche 10 Minuten',near(p.supplements.night,50.26*.2/6*1.5));
    check('Zusatz AiRB 50 % separat von Zeitlohnarten',near(p.specialRB,.5*50.96)&&p.midnightRatedMinutes===60);
    d.entries=[entry('n','2026-10-06T03:00','2026-10-06T04:10')];p=dutyPay(d);check('Sonder-RB rundet bewertete Stunden vor Stundenwert',p.midnightRatedMinutes===70&&near(p.specialRB,cents(.58*50.96)));
    const legacyAugust=normalizeSettings({tariffProfileVersion:1,holidayRuleVersion:2,tariffGroup:'II',tariffStage:1,rateHistory:[{validFrom:'1900-01-01',workHourlyRate:50.96,allowanceHourlyRate:43.42,tariffGroup:'II',tariffStage:1,holidayTimeOff:'yes',ratesConfirmed:false}]});
    const augustRate=legacyAugust.rateHistory.filter(r=>r.validFrom<='2026-08-01').at(-1);check('Migration ergänzt belegte August-2026-Basis ohne alte Periode zu ändern',augustRate.validFrom==='2026-03-01'&&augustRate.supplementBaseRate===50.26&&augustRate.ratesConfirmed&&legacyAugust.rateHistory[0].supplementBaseRate===undefined);
    const otherProfile=normalizeSettings({tariffProfileVersion:1,holidayRuleVersion:2,tariffGroup:'III',tariffStage:1,rateHistory:[{validFrom:'1900-01-01',workHourlyRate:50.96,allowanceHourlyRate:43.42,tariffGroup:'III',tariffStage:1,holidayTimeOff:'yes',ratesConfirmed:false}]});check('Migration überschreibt abweichendes Profil nicht',otherProfile.rateHistory.length===1&&otherProfile.rateHistory[0].supplementBaseRate===undefined&&!otherProfile.rateHistory[0].ratesConfirmed);
    state.settings=legacyAugust;const aug25=duty('2026-08-25',[entry('a','2026-08-26T00:00','2026-08-26T02:16')]),aug27=duty('2026-08-27',[entry('b','2026-08-28T05:50','2026-08-28T06:00')]);state.duties=[aug25,aug27];check('August AiRB ergibt Abrechnungsbetrag 83,06 EUR',near(monthPayDetails(state.duties).specialRB,83.06));
    state.settings=normalizeSettings({tariffProfileVersion:1,holidayRuleVersion:2,august2026RateCorrectionVersion:1,showPay:true,rateHistory:[rate],employmentFraction:1,payroll:{}});
    d.entries=[entry('n','2026-10-05T23:50','2026-10-06T00:10')];p=dutyPay(d);check('Mitternachtsgrenze',p.buckets.midnight===10&&p.buckets.night===20);
    d=duty('2025-09-30',[entry('n','2025-09-30T20:00','2025-09-30T21:00')]);state.duties=[d];check('Historisch Nacht erst 21 Uhr',dutyPay(d).supplements.night===0);
    d.entries=[entry('n','2025-09-30T21:00','2025-09-30T22:00')];check('Historisch 15 %',near(dutyPay(d).supplements.night,50.26*.15));
    d=duty('2025-10-01',[entry('n','2025-10-01T20:00','2025-10-01T21:00')]);state.duties=[d];check('Ab Oktober 20 Uhr und 20 %',near(dutyPay(d).supplements.night,50.26*.20));
    d=duty('2025-09-27',[entry('n','2025-09-27T20:00','2025-09-27T21:00')]);state.duties=[d];check('Historisch Samstag 0,64 EUR bis 21',near(dutyPay(d).supplements.saturday,.64));
    d=duty('2026-10-10',[entry('n','2026-10-10T13:00','2026-10-10T14:00')]);state.duties=[d];check('Samstag ab Oktober 20 %',near(dutyPay(d).supplements.saturday,10.052));
    d=duty('2026-11-01',[entry('n','2026-11-01T14:00','2026-11-01T15:00')]);state.duties=[d];p=dutyPay(d);check('Feiertag ohne FZA schlägt Sonntag',near(p.supplements.holiday,50.26*1.35)&&p.supplements.sunday===0);
    d=duty('2026-12-24',[entry('n','2026-12-24T07:00','2026-12-24T08:00')]);state.duties=[d];check('24 Dezember ab 6 Uhr',near(dutyPay(d).supplements.specialDecember,50.26*.35));
    d=duty('2026-12-31',[entry('n','2027-01-01T02:00','2027-01-01T02:10')]);state.duties=[d];check('Ab 2027 verifiziert nicht behauptet',dutyPay(d).incomplete);
    d=duty('2026-10-05',[]);d.endOverride=new Date('2026-10-05T18:45').toISOString();state.duties=[d];check('11,5 Stunden = 12 angefangene x 12,5 %',near(dutyPay(d).allowance,12*.125*43.42));
    d.endOverride=new Date('2026-10-05T19:15').toISOString();check('12 Stunden = Tagespauschale',near(dutyPay(d).allowance,86.84));
    state.duties=Array.from({length:20},(_,i)=>duty('2026-10-'+pad(i+1),[entry('x'+i,'2026-10-'+pad(i+1)+'T14:00','2026-10-'+pad(i+1)+'T14:10')]));
    state.settings.payroll['2026-10']={complete:true};
    check('13. RB ohne Staffel',dutyPay(state.duties[12]).tierPay===0);
    check('14. und 16. RB 10 %',dutyPay(state.duties[13]).tier.percentage===.1&&dutyPay(state.duties[15]).tier.percentage===.1);
    check('17. RB 20 % und 20. 30 %',dutyPay(state.duties[16]).tier.percentage===.2&&near(dutyPay(state.duties[19]).tier.percentage,.3));
    p=dutyPay(state.duties[13]);check('Staffelbasis inkl Pauschale und §7.3-Einsatz',near(p.tierPay,.1*(p.allowance+p.hoursPay+Object.values(p.supplements).reduce((a,b)=>a+b,0))));
    const before=p.total;state.duties.reverse();check('Staffel unabhängig von Speicherreihenfolge',near(dutyPay(state.duties.find(d=>d.date==='2026-10-14')).total,before));
    state.settings.payroll['2026-10'].complete=false;check('Unvollständiger Monat: Staffel ausgeschlossen',dutyPay(state.duties.find(d=>d.date==='2026-10-14')).tierPay===0);
    state.settings.payroll['2026-10'].complete=true;state.settings.rateHistory[0].employmentFraction=.5;check('50 % Grenze 7, Zuschlag ab 8',dutyPay(state.duties.find(d=>d.date==='2026-10-08')).tier.percentage===.1);
    state.settings.rateHistory[0].employmentFraction=1;
    const m=monthPayDetails(state.duties),rows=payrollRows(state.duties);check('Gehaltsabgleich gleiche Engine',near(rows.find(r=>r[0]==='total')[2],m.total));
    check('Monat cents Komponenten ergeben Gesamt',near(m.total,cents(m.hoursPay+m.allowance+m.specialRB+m.tierPay+Object.values(m.supplements).reduce((a,b)=>a+b,0))));
    check('Einzelanteile ergeben Dienst abzüglich Pauschalenanteil',state.duties.every(d=>{const p=dutyPay(d);return near(p.entryDetails.reduce((a,e)=>a+e.total,0),p.total-p.allowance-(p.tier.confirmed?p.tier.percentage*p.allowance:0));}));
    const old={customRoot:'erhalten',duties:[{id:'old',date:'2026-10-05',entries:[{...entry('oldEntry','2026-10-05T19:00','2026-10-05T19:10'),patientId:'123456789',patientIdPhoto:'data:image/jpeg;base64,test',custom:'keep'}]}],settings:{custom:'keep',showPay:true,workHourlyRate:50.96,allowanceHourlyRate:43.42,rateHistory:[{...rate,custom:'keep'}],payroll:{'2026-10':{values:{total:123}}}}};
    const migrated=migrateState(old);check('Migration erhält Einträge exakt',JSON.stringify(migrated.duties[0].entries)===JSON.stringify(old.duties[0].entries));
    check('Migration erhält Historie und unbekannte Daten',migrated.settings.rateHistory[0].custom==='keep'&&migrated.settings.custom==='keep'&&migrated.customRoot==='erhalten');
    check('Migration idempotent',JSON.stringify(migrateState(migrated))===JSON.stringify(migrated));
    state.settings=migrated.settings;state.duties=migrated.duties;const oldStart=dutyStart(state.duties[0]).getTime();state.settings.showCustomDutyTimes=true;state.settings.dutyTimes[1]={start:'12:00',end:'12:00'};check('Historische Dienstzeiten bleiben',dutyStart(state.duties[0]).getTime()===oldStart);
    check('Backup Rundlauf valid',isValidBackup(JSON.parse(JSON.stringify(migrated))));
    check('Defektes Backup abgelehnt',!isValidBackup({duties:[{id:'bad',date:'2026-10-05',entries:[{id:'x',type:'Telefonisch',start:'invalid',end:'invalid'}]}]}));
    state.settings=normalizeSettings({tariffProfileVersion:1,holidayRuleVersion:2,rateHistory:[{...rate,validFrom:'2026-03-01'}]});check('Vor erster Tarifperiode kein zukünftiger Satz',ratesForDuty({date:'2025-01-01'}).missing===true);
    check('Referenz NRW erster Schritt November',referenceRates('2025-10-31','II')===null&&referenceRates('2025-11-01','II').allowanceHourlyRate>41);
    check('Referenz Facharzt Basis',near(referenceRates('2026-03-01','II').supplementBaseRate,8741.4/173.92));
    check('Referenz EG I eigenständig',near(referenceRates('2026-03-01','I').allowanceHourlyRate,5722.05/173.92));
    state.settings=normalizeSettings({tariffProfileVersion:1,holidayRuleVersion:2,august2026RateCorrectionVersion:1,rateHistory:[{...rate,supplementBaseRate:null}]});d=duty('2026-10-05',[entry('n','2026-10-06T03:00','2026-10-06T03:10')]);state.duties=[d];check('Unbekannter Zuschlag nicht hinzugefügt',dutyPay(d).supplements.night===0&&dutyPay(d).incomplete);
    state.settings=normalizeSettings({tariffProfileVersion:1,holidayRuleVersion:2,showPay:true,rateHistory:[rate],employmentFraction:1});state.duties=[];saveState();render();return checks;
   });
   checks.forEach(name=>results.push({name:label+' '+name,status:'PASS'}));
  });
  await run(label+' UI Tarifparameter speichern',async()=>{
   await page.click('#menuButton');await page.selectOption('#tariffGroup','II');await page.fill('#rateValidFrom','2026-03-01');await page.click('#fillReference');
   assert.equal(await page.inputValue('#workHourlyRate'),'50.96');assert.equal(await page.inputValue('#supplementBaseRate'),'50.26');await page.fill('#employmentFraction','100');await page.check('#ratesConfirmed');await page.click('#savePaySettings');
   await page.click('#menuButton');assert.match(await page.textContent('#modalContent'),/Vergütung anzeigen/);assert.equal(await page.isChecked('#showPayToggle'),true);
   await page.locator('label:has(#showPayToggle)').click();assert.equal(await page.evaluate(()=>state.settings.showPay),false);assert.equal(await page.locator('.pay-detail-card').count(),0);
   await page.locator('label:has(#showPayToggle)').click();assert.equal(await page.evaluate(()=>state.settings.showPay),true);
   await page.selectOption('#tariffGroup','III');assert.equal(await page.locator('#tariffStage option').count(),3);await page.selectOption('#tariffStage','2');await page.click('#fillReference');assert.equal(await page.inputValue('#workHourlyRate'),'66.91');assert.equal(await page.inputValue('#allowanceHourlyRate'),'57.59');
   await page.locator('#modalContent .modal-body > .secondary-button').last().click();
  });
  await run(label+' UI Dienst und Einsatz anlegen/bearbeiten',async()=>{
   await page.click('#newDuty');assert.equal(await page.locator('#modalContent input[type="datetime-local"]').count(),0);await page.fill('#dutyDate','2026-10-05');await page.dispatchEvent('#dutyDate','change');
   await page.locator('#saveDuty').scrollIntoViewIfNeeded();
   assert.ok(await page.evaluate(()=>{const b=document.getElementById('saveDuty').getBoundingClientRect(),r=document.getElementById('modalContent').getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom+1;}),'Speichern muss im Dialog erreichbar sein');
   await page.click('#saveDuty');
   await page.click('[data-view="monat"]');await page.evaluate(()=>{selectedMonth=new Date(2026,9,1);renderMonth();});await page.click('[data-kind="duty"] .swipe-content');await page.click('#newHistoricalEntry');
   await page.fill('#entryDate','2026-10-06');await page.fill('#entryStart','03:00');await page.fill('#entryEnd','03:10');await page.fill('#entryNote','Test');await page.click('#saveEntry');assert.match(await page.textContent('#mainContent'),/50,96/);
   await page.click('[data-kind="entry"] .swipe-content');await page.fill('#entryNote','Bearbeitet');await page.click('#saveEntry');assert.match(await page.textContent('#mainContent'),/Bearbeitet/);
  });
  await run(label+' UI Abgleich speichern und Folgemonat',async()=>{
   await page.click('#backMonth');await page.click('#payrollComparison');assert.equal(await page.inputValue('#payrollPaymentMonth'),'2026-11');await page.fill('[data-payroll="total"]','160');await page.check('#payrollComplete');await page.click('#savePayroll');await page.click('#payrollComparison');assert.equal(await page.inputValue('[data-payroll="total"]'),'160');await page.click('#closePayroll');
  });
  await run(label+' UI CSV / PDF / Backup exportieren und importieren',async()=>{
   let [download]=await Promise.all([page.waitForEvent('download'),page.click('#exportCsv')]);const csv=await fs.promises.readFile(await download.path(),'utf8');assert.match(csv,/Einsatzvergütung EUR/);assert.match(csv,/Bearbeitet/);
   const [popup]=await Promise.all([page.waitForEvent('popup'),page.click('#printReport')]);await popup.waitForLoadState();assert.match(await popup.textContent('body'),/Besonderer RB-Zuschlag/);assert.match(await popup.textContent('body'),/Bearbeitet/);await popup.close();
   await page.click('#menuButton');await page.click('#openBackup');[download]=await Promise.all([page.waitForEvent('download'),page.click('#exportBackup')]);const backup=await fs.promises.readFile(await download.path());const parsed=JSON.parse(backup);assert.equal(parsed.settings.payroll['2026-10'].values.total,160);
   page.once('dialog',d=>d.accept());await page.setInputFiles('#importInput',{name:'backup.json',mimeType:'application/json',buffer:backup});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>state.duties[0].entries[0].note),'Bearbeitet');
  });
  // Confirm dialog for delete handled explicitly, then undo.
  if(await page.evaluate(()=>state.duties.length)){
   page.once('dialog',d=>d.accept());await page.evaluate(()=>deleteDutyById(state.duties[0].id));await page.click('#undoToastButton');assert.equal(await page.evaluate(()=>state.duties.length),1);
  }
  await page.click('#homeButton');assert.match(await page.textContent('#mainContent'),/Kein aktiver Dienst|Aktuelle Rufbereitschaft/);
  await run(label+' UI Foto Ausschnitt und Speicherung',async()=>{
   await page.evaluate(()=>{openNewEntry(state.duties[0].id);const c=document.createElement('canvas');c.width=1200;c.height=600;c.getContext('2d').fillRect(0,0,1200,600);patientPhotoTempImage=c.toDataURL('image/jpeg');openPatientPhotoCrop();});
   await page.waitForFunction(()=>document.getElementById('ppImage').naturalWidth>0);await page.click('#ppCropSave');assert.match(await page.inputValue('#entryPatientIdPhoto'),/^data:image\/jpeg;base64,/);await page.evaluate(()=>modal.close());
  });
  await run(label+' UI Breite, Fehlerfreiheit und Offline',async()=>{
   await page.click('[data-view="monat"]');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   // Regression: the monthly amount and both long notes must fit inside
   // the card, including the viewport width shown in the iPhone report.
   for(const testWidth of [320,390,430,768]) {
    await page.setViewportSize({width:testWidth,height:844});
    const layout=await page.evaluate(()=>{
     const card=document.querySelector('.pay-month-card'),bounds=card.getBoundingClientRect();
     const parts=[...card.children].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
     return {bounds:{left:bounds.left,right:bounds.right,bottom:bounds.bottom},parts,scrollWidth:card.scrollWidth,clientWidth:card.clientWidth};
    });
    assert.ok(layout.scrollWidth<=layout.clientWidth+1,'Vergütungskarte läuft horizontal über bei '+testWidth);
    assert.ok(layout.parts.every(p=>p.left>=layout.bounds.left&&p.right<=layout.bounds.right+1&&p.bottom<=layout.bounds.bottom+1),'Vergütungstext außerhalb der Karte bei '+testWidth);
    assert.ok(layout.parts[2].top>=Math.max(layout.parts[0].bottom,layout.parts[1].bottom),'Aufschlüsselung muss unter Titel und Betrag stehen');
    if(layout.parts[3])assert.ok(layout.parts[3].top>=layout.parts[2].bottom,'Tarifhinweis muss unter Aufschlüsselung stehen');
   }
   await page.setViewportSize({width,height:844});
   await page.screenshot({path:path.join(__dirname,label+'.png'),fullPage:true});
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForTimeout(200);await context.setOffline(true);await page.reload();assert.match(await page.textContent('#mainContent'),/Dienst|Rufbereitschaft/);await context.setOffline(false);
   assert.deepEqual(errors,[]);
  });
  await browser.close();
 }
 fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length}));
})().catch(e=>{fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify(results,null,2));console.error(e);process.exit(1);});
