'use strict';

const STORAGE_KEY = 'dienst-webapp-v1';
const state = loadState();
let currentView = 'dienst';
let selectedMonth = startOfMonth(new Date());

const main = document.getElementById('mainContent');
const title = document.getElementById('pageTitle');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const importInput = document.getElementById('importInput');

document.querySelectorAll('.tab').forEach(button => {
  button.addEventListener('click', () => {
    currentView = button.dataset.view;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === button));
    render();
  });
});
document.getElementById('backupButton').addEventListener('click', openBackupMenu);
importInput.addEventListener('change', importBackup);

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && Array.isArray(parsed.duties) ? parsed : { duties: [] };
  } catch { return { duties: [] }; }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function pad(n) { return String(n).padStart(2, '0'); }
function localDateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`; }
function parseLocalDate(key) { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function dutyStart(duty) { const d = parseLocalDate(duty.date); d.setHours(8,0,0,0); return d; }
function dutyEnd(duty) { const d = parseLocalDate(duty.date); d.setDate(d.getDate()+1); d.setHours(8,0,0,0); return d; }
function fmtDate(d) { return new Intl.DateTimeFormat('de-DE', {day:'numeric', month:'long', year:'numeric'}).format(d); }
function fmtShortDate(d) { return new Intl.DateTimeFormat('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'}).format(d); }
function fmtTime(d) { return new Intl.DateTimeFormat('de-DE', {hour:'2-digit', minute:'2-digit'}).format(d); }
function fmtMonth(d) { return new Intl.DateTimeFormat('de-DE', {month:'long', year:'numeric'}).format(d); }
function minutes(entry) { return Math.max(0, Math.floor((new Date(entry.end)-new Date(entry.start))/60000)); }
function sum(duty, type) { return duty.entries.filter(e=>e.type===type).reduce((a,e)=>a+minutes(e),0); }
function roundedHours(minuteCount) { return Math.ceil(minuteCount / 60); }
function hourLabel(value) { return `${value} ${value === 1 ? 'Stunde' : 'Stunden'}`; }
function sortedDuties() { return [...state.duties].sort((a,b)=>dutyStart(b)-dutyStart(a)); }
function activeDuty() { const now = new Date(); return sortedDuties().find(d=>dutyStart(d)<=now && now<dutyEnd(d)); }
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function render() {
  if (currentView === 'dienst') renderDuty(); else renderMonth();
}

function renderDuty() {
  title.textContent = 'Dienst';
  const duty = activeDuty();
  if (!duty) {
    main.innerHTML = `<div class="empty">Aktuell läuft kein Dienst.</div><button class="primary" id="newDuty">Neuen Dienst anlegen</button>`;
    document.getElementById('newDuty').onclick = openNewDuty;
    return;
  }
  const entries = [...duty.entries].sort((a,b)=>new Date(a.start)-new Date(b.start));
  main.innerHTML = `
    <section class="card hero">
      <div class="hero-date">${fmtDate(dutyStart(duty))}</div>
      <div class="hero-time">08:00 Uhr – 08:00 Uhr am Folgetag</div>
    </section>
    <section class="stats">
      <div class="stat"><div class="stat-label">Telefonisch</div><div class="stat-number">${sum(duty,'Telefonisch')} Min.</div></div>
      <div class="stat"><div class="stat-label">Im Haus</div><div class="stat-number">${sum(duty,'Im Haus')} Min.</div></div>
    </section>
    <button class="primary" id="newEntry">+ Einsatz hinzufügen</button>
    <div class="card-header">Einsätze</div>
    <section class="card">${entries.length ? entries.map(e=>entryRow(duty,e,true)).join('') : '<div class="empty">Noch keine Einsätze</div>'}</section>`;
  document.getElementById('newEntry').onclick = ()=>openNewEntry(duty.id);
  bindDeletes();
}

function renderMonth() {
  title.textContent = 'Monat';
  const duties = sortedDuties().filter(d=>{
    const x=dutyStart(d); return x.getFullYear()===selectedMonth.getFullYear() && x.getMonth()===selectedMonth.getMonth();
  });
  main.innerHTML = `
    <div class="month-controls"><button id="prevMonth">‹</button><div class="month-title">${fmtMonth(selectedMonth)}</div><button id="nextMonth">›</button></div>
    <section class="card">${duties.length ? duties.map(d=>`
      <div class="row duty-row" data-duty="${d.id}">
        <div class="row-main"><div class="row-title">${fmtDate(dutyStart(d))}</div><div class="row-subtitle">Telefonisch: ${sum(d,'Telefonisch')} Min. · Im Haus: ${sum(d,'Im Haus')} Min.</div></div><span class="chevron">›</span>
      </div>`).join('') : '<div class="empty">Keine Dienste in diesem Monat</div>'}</section>`;
  document.getElementById('prevMonth').onclick=()=>{selectedMonth=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth()-1,1);renderMonth();};
  document.getElementById('nextMonth').onclick=()=>{selectedMonth=new Date(selectedMonth.getFullYear(),selectedMonth.getMonth()+1,1);renderMonth();};
  document.querySelectorAll('.duty-row').forEach(row=>row.onclick=()=>renderDutyDetail(row.dataset.duty));
}

function renderDutyDetail(id) {
  const duty=state.duties.find(d=>d.id===id); if(!duty) return;
  title.textContent=fmtShortDate(dutyStart(duty));
  const entries=[...duty.entries].sort((a,b)=>new Date(a.start)-new Date(b.start));
  const phoneMinutes=sum(duty,'Telefonisch');
  const houseMinutes=sum(duty,'Im Haus');
  const phoneHours=roundedHours(phoneMinutes);
  const houseHours=roundedHours(houseMinutes);
  const totalHours=phoneHours+houseHours;
  main.innerHTML=`
    <button class="secondary-button" id="backMonth">‹ Zurück zum Monat</button>
    <div class="card-header">Statistik</div>
    <section class="card">
      <div class="row"><div class="row-main"><div class="row-title">Telefonisch</div><div class="row-subtitle">${phoneMinutes} Min. · auf volle Stunden gerundet</div></div><div class="row-value strong-value">${hourLabel(phoneHours)}</div></div>
      <div class="row"><div class="row-main"><div class="row-title">Im Haus</div><div class="row-subtitle">${houseMinutes} Min. · auf volle Stunden gerundet</div></div><div class="row-value strong-value">${hourLabel(houseHours)}</div></div>
      <div class="row total-row"><div class="row-main"><div class="row-title">Gesamt</div><div class="row-subtitle">Summe der beiden aufgerundeten Werte</div></div><div class="row-value total-value">${hourLabel(totalHours)}</div></div>
    </section>
    <div class="card-header">Einsätze</div>
    <section class="card">${entries.length ? entries.map(e=>entryRow(duty,e,true)).join('') : '<div class="empty">Keine Einsätze</div>'}</section>
    <button class="secondary-button danger-button" id="deleteDuty">Dienst löschen</button>`;
  document.getElementById('backMonth').onclick=renderMonth;
  document.getElementById('deleteDuty').onclick=()=>{ if(confirm('Diesen Dienst mit allen Einsätzen löschen?')) { state.duties=state.duties.filter(d=>d.id!==id);saveState();renderMonth(); } };
  bindDeletes();
}

function entryRow(duty,e,withDelete) {
  const s=new Date(e.start), end=new Date(e.end);
  return `<div class="row"><div class="row-main"><div class="row-title">${escapeHtml(e.type)}</div><div class="row-subtitle">${fmtDate(s)} von ${fmtTime(s)} bis ${fmtTime(end)}</div></div><div class="row-value">${minutes(e)} Min.</div>${withDelete?`<button class="delete" data-duty="${duty.id}" data-entry="${e.id}">Löschen</button>`:''}</div>`;
}
function bindDeletes(){document.querySelectorAll('.delete').forEach(b=>b.onclick=()=>{if(confirm('Einsatz löschen?')){const d=state.duties.find(x=>x.id===b.dataset.duty);d.entries=d.entries.filter(e=>e.id!==b.dataset.entry);saveState();render();}});}

function openNewDuty() {
  const now=new Date();
  modalContent.innerHTML=`<div class="modal-body"><div class="modal-title">Neuer Dienst</div><label class="field"><span>Datum</span><input id="dutyDate" type="date" value="${localDateKey(now)}"></label><div id="modalError" class="error"></div><div class="modal-actions"><button type="button" class="primary" id="saveDuty">Speichern</button><button class="secondary-button">Abbrechen</button></div></div>`;
  modal.showModal();
  document.getElementById('saveDuty').onclick=()=>{
    const date=document.getElementById('dutyDate').value;
    if(!date) return;
    if(state.duties.some(d=>d.date===date)){document.getElementById('modalError').textContent='Für dieses Datum gibt es bereits einen Dienst.';return;}
    state.duties.push({id:uid(),date,entries:[]});saveState();modal.close();render();
  };
}

function openNewEntry(dutyId) {
  const duty=state.duties.find(d=>d.id===dutyId); if(!duty) return;
  let type='Telefonisch';
  const start=dutyStart(duty); const today=new Date(); const defaultDate=(today>=start&&today<dutyEnd(duty))?today:start; const defaultEnd=new Date(defaultDate.getTime()+15*60000);
  modalContent.innerHTML=`<div class="modal-body"><div class="modal-title">Neuer Einsatz</div>
    <div class="segment"><button type="button" class="selected" data-type="Telefonisch">Telefonisch</button><button type="button" data-type="Im Haus">Im Haus</button></div>
    <label class="field"><span>Datum</span><input id="entryDate" type="date" value="${localDateKey(defaultDate)}"></label>
    <label class="field"><span>Startzeit</span><input id="entryStart" type="time" value="${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}"></label>
    <label class="field"><span>Endzeit</span><input id="entryEnd" type="time" value="${pad(defaultEnd.getHours())}:${pad(defaultEnd.getMinutes())}"></label>
    <div id="modalError" class="error"></div><div class="modal-actions"><button type="button" class="primary" id="saveEntry">Speichern</button><button class="secondary-button">Abbrechen</button></div></div>`;
  modal.showModal();
  modalContent.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{type=b.dataset.type;modalContent.querySelectorAll('[data-type]').forEach(x=>x.classList.toggle('selected',x===b));});
  document.getElementById('saveEntry').onclick=()=>{
    const date=document.getElementById('entryDate').value, st=document.getElementById('entryStart').value, et=document.getElementById('entryEnd').value;
    const err=document.getElementById('modalError'); err.textContent='';
    if(!date||!st||!et){err.textContent='Bitte alle Felder ausfüllen.';return;}
    const startDate=new Date(`${date}T${st}:00`); let endDate=new Date(`${date}T${et}:00`);
    if(endDate<=startDate) endDate.setDate(endDate.getDate()+1);
    if(startDate<dutyStart(duty)||startDate>=dutyEnd(duty)){err.textContent='Die Startzeit muss innerhalb dieses Dienstes liegen.';return;}
    if(endDate>dutyEnd(duty)){err.textContent='Die Endzeit darf nicht nach dem Dienstende um 08:00 Uhr liegen.';return;}
    duty.entries.push({id:uid(),type,start:startDate.toISOString(),end:endDate.toISOString()});saveState();modal.close();render();
  };
}

function openBackupMenu(){
  modalContent.innerHTML=`<div class="modal-body"><div class="modal-title">Datensicherung</div><button type="button" class="secondary-button" id="exportBackup">Sicherung exportieren</button><button type="button" class="secondary-button" id="importBackup">Sicherung importieren</button><button class="secondary-button">Schließen</button></div>`;
  modal.showModal();
  document.getElementById('exportBackup').onclick=exportBackup;
  document.getElementById('importBackup').onclick=()=>{modal.close();importInput.click();};
}
function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Dienst-Sicherung-${localDateKey(new Date())}.json`;a.click();URL.revokeObjectURL(a.href);modal.close();}
async function importBackup(event){const file=event.target.files[0];event.target.value='';if(!file)return;try{const parsed=JSON.parse(await file.text());if(!parsed||!Array.isArray(parsed.duties))throw new Error();if(confirm('Vorhandene Daten durch diese Sicherung ersetzen?')){state.duties=parsed.duties;saveState();render();}}catch{alert('Die Sicherungsdatei ist ungültig.');}}

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js'));
render();
