'use strict';

const STORAGE_KEY = 'dienst-webapp-v1';
const BACKUP_DATE_KEY = 'dienst-last-backup';
const BACKUP_REMINDER_DAYS = 30;
const APP_VERSION = 6;
const state = loadState();
let currentView = 'dienst';
let selectedMonth = startOfMonth(new Date());
let selectedDutyId = null;

const main = document.getElementById('mainContent');
const title = document.getElementById('pageTitle');
const subtitle = document.getElementById('pageSubtitle');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const importInput = document.getElementById('importInput');
const updateBanner = document.getElementById('updateBanner');
const updateButton = document.getElementById('updateButton');
const backupReminder = document.getElementById('backupReminder');
const backupReminderButton = document.getElementById('backupReminderButton');

const nativeShowModal = modal.showModal.bind(modal);
modal.showModal = () => {
  document.body.classList.add('modal-open');
  nativeShowModal();
};
modal.addEventListener('close', () => document.body.classList.remove('modal-open'));

for (const button of document.querySelectorAll('.tab')) {
  button.addEventListener('click', () => {
    currentView = button.dataset.view;
    selectedDutyId = null;
    for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab === button);
    render();
  });
}
document.getElementById('menuButton').addEventListener('click', openMenu);
importInput.addEventListener('change', importBackup);
updateButton.addEventListener('click', applyUpdate);
backupReminderButton.addEventListener('click', openBackupMenu);

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && Array.isArray(parsed.duties) ? parsed : { duties: [] };
  } catch {
    return { duties: [] };
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  showBackupReminder();
}
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function pad(n) { return String(n).padStart(2, '0'); }
function localDateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function parseLocalDate(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function dutySchedule(dateKey) {
  const date = parseLocalDate(dateKey);
  const weekday = date.getDay();
  let startHour = 7, startMinute = 15, endHour = 7, endMinute = 15;
  if (weekday === 5) { endHour = 8; endMinute = 30; }
  else if (weekday === 6) { startHour = 8; startMinute = 30; endHour = 8; endMinute = 30; }
  else if (weekday === 0) { startHour = 8; startMinute = 30; }
  return { startHour, startMinute, endHour, endMinute };
}
function dutyStart(duty) {
  const date = parseLocalDate(duty.date);
  const schedule = dutySchedule(duty.date);
  date.setHours(schedule.startHour, schedule.startMinute, 0, 0);
  return date;
}
function dutyEnd(duty) {
  const date = parseLocalDate(duty.date);
  const schedule = dutySchedule(duty.date);
  date.setDate(date.getDate() + 1);
  date.setHours(schedule.endHour, schedule.endMinute, 0, 0);
  return date;
}
function dutyTimeText(duty) { return `${fmtTime(dutyStart(duty))} Uhr – ${fmtTime(dutyEnd(duty))} Uhr am Folgetag`; }
function scheduleText(dateKey) {
  const temp = { date: dateKey };
  return `${fmtTime(dutyStart(temp))} Uhr bis ${fmtTime(dutyEnd(temp))} Uhr am Folgetag`;
}
function fmtDate(date) { return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date); }
function fmtShortDate(date) { return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date); }
function fmtTime(date) { return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date); }
function fmtMonth(date) { return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(date); }
function minutes(entry) { return Math.max(0, Math.round((new Date(entry.end) - new Date(entry.start)) / 60000)); }
function sum(duty, type) { return duty.entries.filter(entry => entry.type === type).reduce((total, entry) => total + minutes(entry), 0); }
function roundedHours(minuteCount) { return Math.ceil(minuteCount / 60); }
function hourLabel(value) { return `${value} ${value === 1 ? 'Stunde' : 'Stunden'}`; }
function sortedDuties() { return [...state.duties].sort((a, b) => dutyStart(b) - dutyStart(a)); }
function activeDuty() { const now = new Date(); return sortedDuties().find(duty => dutyStart(duty) <= now && now < dutyEnd(duty)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function monthDuties() {
  return sortedDuties().filter(duty => {
    const date = dutyStart(duty);
    return date.getFullYear() === selectedMonth.getFullYear() && date.getMonth() === selectedMonth.getMonth();
  });
}
function monthTotals(duties) {
  return duties.reduce((totals, duty) => {
    totals.phoneMinutes += sum(duty, 'Telefonisch');
    totals.houseMinutes += sum(duty, 'Im Haus');
    totals.phoneHours += roundedHours(sum(duty, 'Telefonisch'));
    totals.houseHours += roundedHours(sum(duty, 'Im Haus'));
    return totals;
  }, { phoneMinutes: 0, houseMinutes: 0, phoneHours: 0, houseHours: 0 });
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isValidBackup(data) {
  if (!data || !Array.isArray(data.duties)) return false;
  return data.duties.every(duty => {
    if (!duty || typeof duty.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(duty.date) || !Array.isArray(duty.entries)) return false;
    return duty.entries.every(entry => {
      if (!entry || typeof entry.id !== 'string' || !['Telefonisch', 'Im Haus'].includes(entry.type) || (entry.note != null && typeof entry.note !== 'string')) return false;
      const start = new Date(entry.start);
      const end = new Date(entry.end);
      return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start;
    });
  });
}
function daysSince(dateString) {
  if (!dateString) return Infinity;
  const date = new Date(dateString);
  return Number.isFinite(date.getTime()) ? Math.floor((Date.now() - date.getTime()) / 86400000) : Infinity;
}
function showBackupReminder() {
  const hasData = state.duties.some(duty => duty.entries.length > 0);
  const overdue = daysSince(localStorage.getItem(BACKUP_DATE_KEY)) >= BACKUP_REMINDER_DAYS;
  backupReminder.hidden = !(hasData && overdue);
}

let waitingWorker = null;
function showUpdate(worker) { waitingWorker = worker; updateBanner.hidden = false; }
function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  else window.location.reload();
}

function render() {
  if (currentView === 'dienst') renderDuty();
  else if (selectedDutyId) renderDutyDetail(selectedDutyId);
  else renderMonth();
}

function renderDuty() {
  title.textContent = 'Dienst';
  subtitle.textContent = 'Bereitschaft erfassen';
  const duty = activeDuty();
  if (!duty) {
    main.innerHTML = `
      <section class="empty-card">
        <div class="empty-icon">🚑</div>
        <div class="empty-title">Kein aktiver Dienst</div>
        <div class="empty-text">Lege einen Dienst an. Die Start- und Endzeit wird automatisch passend zum Wochentag berechnet.</div>
      </section>
      <button class="primary" id="newDuty" type="button">Neuen Dienst anlegen</button>
      ${privacyNote()}`;
    document.getElementById('newDuty').onclick = openNewDuty;
    return;
  }
  const entries = [...duty.entries].sort((a, b) => new Date(a.start) - new Date(b.start));
  const phoneMinutes = sum(duty, 'Telefonisch');
  const houseMinutes = sum(duty, 'Im Haus');
  main.innerHTML = `
    <section class="card hero">
      <div class="hero-kicker">Aktueller Bereitschaftsdienst</div>
      <div class="hero-date">${fmtDate(dutyStart(duty))}</div>
      <div class="hero-time">${dutyTimeText(duty)}</div>
    </section>
    <button class="action-button duty-edit-button" id="editActiveDuty" type="button">Dienst bearbeiten</button>
    <section class="stats">
      <div class="stat"><div class="stat-label">Telefonisch</div><div class="stat-number">${phoneMinutes} Min.</div><div class="stat-detail">${hourLabel(roundedHours(phoneMinutes))} gerundet</div></div>
      <div class="stat"><div class="stat-label">Im Haus</div><div class="stat-number">${houseMinutes} Min.</div><div class="stat-detail">${hourLabel(roundedHours(houseMinutes))} gerundet</div></div>
    </section>
    <button class="primary" id="newEntry" type="button">+ Einsatz hinzufügen</button>
    <div class="card-header">Einsätze</div>
    <section class="card">${entries.length ? entries.map(entry => entryRow(duty, entry, true)).join('') : '<div class="empty">Noch keine Einsätze</div>'}</section>
    ${privacyNote()}`;
  document.getElementById('editActiveDuty').onclick = () => openEditDuty(duty.id);
  document.getElementById('newEntry').onclick = () => openNewEntry(duty.id);
  bindInteractiveEntries();
}

function renderMonth() {
  title.textContent = 'Monat';
  subtitle.textContent = 'Auswertung und Export';
  const duties = monthDuties();
  const totals = monthTotals(duties);
  const totalHours = totals.phoneHours + totals.houseHours;
  main.innerHTML = `
    <div class="month-controls">
      <button id="prevMonth" type="button" aria-label="Vorheriger Monat">‹</button>
      <div class="month-title">${fmtMonth(selectedMonth)}</div>
      <button id="nextMonth" type="button" aria-label="Nächster Monat">›</button>
    </div>
    <section class="month-summary">
      <div class="month-stat"><div class="month-stat-label">Telefonisch</div><div class="month-stat-value">${totals.phoneHours} Std.</div></div>
      <div class="month-stat"><div class="month-stat-label">Im Haus</div><div class="month-stat-value">${totals.houseHours} Std.</div></div>
      <div class="month-stat"><div class="month-stat-label">Gesamt</div><div class="month-stat-value">${totalHours} Std.</div></div>
    </section>
    <div class="month-actions">
      <button class="action-button" id="exportCsv" type="button">CSV exportieren</button>
      <button class="action-button" id="printReport" type="button">PDF-Bericht</button>
    </div>
    <div class="card-header">Dienste</div>
    <section class="swipe-list">${duties.length ? duties.map(duty => {
      const phone = sum(duty, 'Telefonisch');
      const house = sum(duty, 'Im Haus');
      const count = duty.entries.length;
      return `<div class="swipe-item" data-kind="duty" data-duty="${duty.id}">
        <button class="swipe-delete-action" type="button" aria-label="Dienst löschen">Löschen</button>
        <div class="swipe-content duty-row" role="button" tabindex="0">
          <div class="row-main">
            <div class="row-title">${fmtDate(dutyStart(duty))}</div>
            <div class="row-subtitle">${dutyTimeText(duty)}</div>
            <div class="duty-summary">${count} ${count === 1 ? 'Einsatz' : 'Einsätze'} · Telefonisch: ${phone} Min. · Im Haus: ${house} Min.</div>
          </div><span class="chevron">›</span>
        </div>
      </div>`;
    }).join('') : '<div class="card empty">Keine Dienste in diesem Monat</div>'}</section>
    ${privacyNote()}`;
  document.getElementById('prevMonth').onclick = () => { selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1); renderMonth(); };
  document.getElementById('nextMonth').onclick = () => { selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1); renderMonth(); };
  document.getElementById('exportCsv').onclick = exportMonthCsv;
  document.getElementById('printReport').onclick = printMonthReport;
  bindInteractiveDuties();
}

function renderDutyDetail(id) {
  const duty = state.duties.find(item => item.id === id);
  if (!duty) { selectedDutyId = null; renderMonth(); return; }
  title.textContent = fmtShortDate(dutyStart(duty));
  subtitle.textContent = 'Dienstübersicht';
  const entries = [...duty.entries].sort((a, b) => new Date(a.start) - new Date(b.start));
  const phoneMinutes = sum(duty, 'Telefonisch');
  const houseMinutes = sum(duty, 'Im Haus');
  const phoneHours = roundedHours(phoneMinutes);
  const houseHours = roundedHours(houseMinutes);
  const totalHours = phoneHours + houseHours;
  main.innerHTML = `
    <button class="text-button" id="backMonth" type="button">‹ Zurück zum Monat</button>
    <section class="card hero">
      <div class="hero-kicker">Bereitschaftsdienst</div>
      <div class="hero-date">${fmtDate(dutyStart(duty))}</div>
      <div class="hero-time">${dutyTimeText(duty)}</div>
    </section>
    <div class="card-header">Statistik</div>
    <section class="card">
      <div class="row"><div class="row-main"><div class="row-title">Telefonisch</div><div class="row-subtitle">${phoneMinutes} Minuten · separat aufgerundet</div></div><div class="row-value strong-value">${hourLabel(phoneHours)}</div></div>
      <div class="row"><div class="row-main"><div class="row-title">Im Haus</div><div class="row-subtitle">${houseMinutes} Minuten · separat aufgerundet</div></div><div class="row-value strong-value">${hourLabel(houseHours)}</div></div>
      <div class="row total-row"><div class="row-main"><div class="row-title">Gesamt</div><div class="row-subtitle">Summe der beiden gerundeten Werte</div></div><div class="row-value total-value">${hourLabel(totalHours)}</div></div>
    </section>
    <div class="card-header">Einsätze</div>
    <section class="card">${entries.length ? entries.map(entry => entryRow(duty, entry, true)).join('') : '<div class="empty">Keine Einsätze</div>'}</section>
    <div class="detail-actions">
      <button class="secondary-button" id="editDuty" type="button">Dienst bearbeiten</button>
      <button class="secondary-button danger-button" id="deleteDuty" type="button">Dienst löschen</button>
    </div>`;
  document.getElementById('backMonth').onclick = () => { selectedDutyId = null; renderMonth(); };
  document.getElementById('editDuty').onclick = () => openEditDuty(id);
  document.getElementById('deleteDuty').onclick = () => deleteDutyById(id);
  bindInteractiveEntries();
}

function entryRow(duty, entry, withDelete) {
  const start = new Date(entry.start);
  const end = new Date(entry.end);
  const badgeClass = entry.type === 'Telefonisch' ? 'type-phone' : 'type-house';
  const endDateText = localDateKey(start) === localDateKey(end) ? '' : ` (${fmtShortDate(end)})`;
  return `<div class="swipe-item entry-swipe-item" data-kind="entry" data-duty="${duty.id}" data-entry="${entry.id}">
    ${withDelete ? '<button class="swipe-delete-action" type="button" aria-label="Einsatz löschen">Löschen</button>' : ''}
    <div class="swipe-content row entry-row" role="button" tabindex="0">
      <div class="row-main">
        <div><span class="type-badge ${badgeClass}">${escapeHtml(entry.type)}</span></div>
        <div class="row-subtitle">${fmtDate(start)} von ${fmtTime(start)} bis ${fmtTime(end)}${endDateText}</div>
        ${entry.note ? `<div class="entry-note">Bemerkung: ${escapeHtml(entry.note)}</div>` : ''}
      </div>
      <div class="row-value">${minutes(entry)} Min.</div>
      <span class="chevron">›</span>
    </div>
  </div>`;
}

function haptic() {
  if (navigator.vibrate) navigator.vibrate(12);
}
function deleteDutyById(id) {
  if (!confirm('Diesen Dienst mit allen Einsätzen löschen?')) return;
  state.duties = state.duties.filter(item => item.id !== id);
  saveState();
  if (selectedDutyId === id) selectedDutyId = null;
  haptic();
  render();
}
function deleteEntryById(dutyId, entryId) {
  if (!confirm('Einsatz löschen?')) return;
  const duty = state.duties.find(item => item.id === dutyId);
  if (!duty) return;
  duty.entries = duty.entries.filter(entry => entry.id !== entryId);
  saveState();
  haptic();
  render();
}
function bindSwipeItem(item, onOpen, onDelete, onLongPress) {
  const content = item.querySelector('.swipe-content');
  const deleteButton = item.querySelector('.swipe-delete-action');
  if (!content) return;
  let startX = 0, startY = 0, currentX = 0, dragging = false, moved = false, longPressed = false;
  let timer = null;
  const close = () => { content.style.transform = ''; item.classList.remove('open'); };
  const begin = event => {
    const point = event.touches ? event.touches[0] : event;
    startX = point.clientX; startY = point.clientY; currentX = item.classList.contains('open') ? -92 : 0;
    dragging = true; moved = false; longPressed = false;
    timer = setTimeout(() => {
      if (!moved && dragging && onLongPress) { longPressed = true; dragging = false; close(); haptic(); onLongPress(); }
    }, 550);
  };
  const move = event => {
    if (!dragging) return;
    const point = event.touches ? event.touches[0] : event;
    const dx = point.clientX - startX, dy = point.clientY - startY;
    if (Math.abs(dx) > 7 || Math.abs(dy) > 7) { moved = true; clearTimeout(timer); }
    if (Math.abs(dy) > Math.abs(dx)) return;
    event.preventDefault();
    const x = Math.max(-108, Math.min(0, currentX + dx));
    content.style.transform = `translateX(${x}px)`;
  };
  const end = event => {
    clearTimeout(timer);
    if (!dragging) return;
    dragging = false;
    const point = event.changedTouches ? event.changedTouches[0] : event;
    const dx = point.clientX - startX;
    const finalX = currentX + dx;
    if (finalX < -45) { content.style.transform = 'translateX(-92px)'; item.classList.add('open'); }
    else close();
  };
  content.addEventListener('touchstart', begin, { passive: true });
  content.addEventListener('touchmove', move, { passive: false });
  content.addEventListener('touchend', end);
  content.addEventListener('pointerdown', event => { if (event.pointerType === 'mouse') begin(event); });
  content.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') move(event); });
  content.addEventListener('pointerup', event => { if (event.pointerType === 'mouse') end(event); });
  content.addEventListener('click', event => {
    if (moved || longPressed || item.classList.contains('open')) { event.preventDefault(); if (item.classList.contains('open')) close(); return; }
    onOpen();
  });
  content.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } });
  if (deleteButton) deleteButton.onclick = event => { event.stopPropagation(); onDelete(); };
}
function bindInteractiveDuties() {
  for (const item of document.querySelectorAll('.swipe-item[data-kind="duty"]')) {
    const id = item.dataset.duty;
    bindSwipeItem(item,
      () => { selectedDutyId = id; renderDutyDetail(id); },
      () => deleteDutyById(id),
      () => openDutyContextMenu(id));
  }
}
function bindInteractiveEntries() {
  for (const item of document.querySelectorAll('.swipe-item[data-kind="entry"]')) {
    const dutyId = item.dataset.duty, entryId = item.dataset.entry;
    bindSwipeItem(item,
      () => openEditEntry(dutyId, entryId),
      () => deleteEntryById(dutyId, entryId),
      () => openEntryContextMenu(dutyId, entryId));
  }
}
function openDutyContextMenu(dutyId) {
  modalContent.innerHTML = `<div class="modal-body action-sheet-body">
    <div class="modal-title">Dienst</div>
    <button type="button" class="secondary-button" id="contextEditDuty">Dienst bearbeiten</button>
    <button type="button" class="secondary-button danger-button" id="contextDeleteDuty">Dienst löschen</button>
    <button class="secondary-button">Abbrechen</button>
  </div>`;
  modal.showModal();
  document.getElementById('contextEditDuty').onclick = () => { modal.close(); openEditDuty(dutyId); };
  document.getElementById('contextDeleteDuty').onclick = () => { modal.close(); deleteDutyById(dutyId); };
}
function openEntryContextMenu(dutyId, entryId) {
  modalContent.innerHTML = `<div class="modal-body action-sheet-body">
    <div class="modal-title">Einsatz</div>
    <button type="button" class="secondary-button" id="contextEditEntry">Einsatz bearbeiten</button>
    <button type="button" class="secondary-button danger-button" id="contextDeleteEntry">Einsatz löschen</button>
    <button class="secondary-button">Abbrechen</button>
  </div>`;
  modal.showModal();
  document.getElementById('contextEditEntry').onclick = () => { modal.close(); openEditEntry(dutyId, entryId); };
  document.getElementById('contextDeleteEntry').onclick = () => { modal.close(); deleteEntryById(dutyId, entryId); };
}

function openNewDuty() {
  const now = new Date();
  const initialDate = localDateKey(now);
  modalContent.innerHTML = `<div class="modal-body">
    <div class="modal-title">Neuer Dienst</div>
    <label class="field"><span>Datum des Dienstbeginns</span><input id="dutyDate" type="date" value="${initialDate}"></label>
    <div class="small-note" id="dutyScheduleNote">Dienstzeit: ${scheduleText(initialDate)}.</div>
    <div id="modalError" class="error"></div>
    <div class="modal-actions"><button type="button" class="primary" id="saveDuty">Speichern</button><button class="secondary-button">Abbrechen</button></div>
  </div>`;
  modal.showModal();
  document.getElementById('dutyDate').onchange = event => {
    if (event.target.value) document.getElementById('dutyScheduleNote').textContent = `Dienstzeit: ${scheduleText(event.target.value)}.`;
  };
  document.getElementById('saveDuty').onclick = () => {
    const date = document.getElementById('dutyDate').value;
    if (!date) return;
    if (state.duties.some(duty => duty.date === date)) {
      document.getElementById('modalError').textContent = 'Für dieses Datum gibt es bereits einen Dienst.';
      return;
    }
    state.duties.push({ id: uid(), date, entries: [] });
    saveState();
    modal.close();
    render();
  };
}

function openEditDuty(dutyId) {
  const duty = state.duties.find(item => item.id === dutyId);
  if (!duty) return;
  modalContent.innerHTML = `<div class="modal-body">
    <div class="modal-title">Dienst bearbeiten</div>
    <label class="field"><span>Datum des Dienstbeginns</span><input id="dutyDate" type="date" value="${duty.date}"></label>
    <div class="small-note" id="dutyScheduleNote">Dienstzeit: ${scheduleText(duty.date)}.</div>
    <div class="small-note">Vorhandene Einsätze bleiben erhalten. Beim Speichern wird geprüft, ob sie weiterhin innerhalb des Dienstes liegen.</div>
    <div id="modalError" class="error"></div>
    <div class="modal-actions"><button type="button" class="primary" id="saveDuty">Änderungen speichern</button><button class="secondary-button">Abbrechen</button></div>
  </div>`;
  modal.showModal();
  document.getElementById('dutyDate').onchange = event => {
    if (event.target.value) document.getElementById('dutyScheduleNote').textContent = `Dienstzeit: ${scheduleText(event.target.value)}.`;
  };
  document.getElementById('saveDuty').onclick = () => {
    const date = document.getElementById('dutyDate').value;
    const error = document.getElementById('modalError');
    error.textContent = '';
    if (!date) { error.textContent = 'Bitte ein Datum auswählen.'; return; }
    if (state.duties.some(item => item.id !== dutyId && item.date === date)) {
      error.textContent = 'Für dieses Datum gibt es bereits einen Dienst.';
      return;
    }
    const previousDate = duty.date;
    const dayDifference = Math.round((parseLocalDate(date) - parseLocalDate(previousDate)) / 86400000);
    const previousEntries = duty.entries.map(entry => ({ ...entry }));
    duty.date = date;
    duty.entries = duty.entries.map(entry => {
      const start = new Date(entry.start);
      const end = new Date(entry.end);
      start.setDate(start.getDate() + dayDifference);
      end.setDate(end.getDate() + dayDifference);
      return { ...entry, start: start.toISOString(), end: end.toISOString() };
    });
    const entriesFit = duty.entries.every(entry => {
      const start = new Date(entry.start);
      const end = new Date(entry.end);
      return start >= dutyStart(duty) && start < dutyEnd(duty) && end <= dutyEnd(duty);
    });
    if (!entriesFit) {
      duty.date = previousDate;
      duty.entries = previousEntries;
      error.textContent = 'Mindestens ein Einsatz passt zeitlich nicht zur neuen Dienstzeit. Es wurden keine Änderungen gespeichert.';
      return;
    }
    saveState();
    modal.close();
    render();
  };
}

function openNewEntry(dutyId) {
  const duty = state.duties.find(item => item.id === dutyId);
  if (!duty) return;
  let type = 'Telefonisch';
  const start = dutyStart(duty);
  const now = new Date();
  const defaultDate = now >= start && now < dutyEnd(duty) ? now : start;
  const defaultEnd = new Date(defaultDate.getTime() + 15 * 60000);
  modalContent.innerHTML = `<div class="modal-body entry-form-body">
    <div class="modal-title">Neuer Einsatz</div>
    <div class="segment"><button type="button" class="selected" data-type="Telefonisch">Telefonisch</button><button type="button" data-type="Im Haus">Im Haus</button></div>
    <label class="field"><span>Datum</span><input id="entryDate" type="date" value="${localDateKey(defaultDate)}"></label>
    <label class="field"><span>Startzeit</span><input id="entryStart" type="time" value="${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}"></label>
    <label class="field"><span>Endzeit</span><input id="entryEnd" type="time" value="${pad(defaultEnd.getHours())}:${pad(defaultEnd.getMinutes())}"></label>
    <label class="field"><span>Bemerkung (optional)</span><textarea id="entryNote" rows="3" maxlength="200" placeholder="z. B. OP"></textarea></label>
    <div id="modalError" class="error"></div>
    <div class="modal-actions"><button type="button" class="primary" id="saveEntry">Speichern</button><button class="secondary-button">Abbrechen</button></div>
  </div>`;
  modal.showModal();
  for (const button of modalContent.querySelectorAll('[data-type]')) {
    button.onclick = () => {
      type = button.dataset.type;
      for (const item of modalContent.querySelectorAll('[data-type]')) item.classList.toggle('selected', item === button);
    };
  }
  document.getElementById('saveEntry').onclick = () => {
    const date = document.getElementById('entryDate').value;
    const startTime = document.getElementById('entryStart').value;
    const endTime = document.getElementById('entryEnd').value;
    const note = document.getElementById('entryNote').value.trim();
    const error = document.getElementById('modalError');
    error.textContent = '';
    if (!date || !startTime || !endTime) { error.textContent = 'Bitte alle Felder ausfüllen.'; return; }
    const startDate = new Date(`${date}T${startTime}:00`);
    const endDate = new Date(`${date}T${endTime}:00`);
    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
    if (startDate < dutyStart(duty) || startDate >= dutyEnd(duty)) { error.textContent = 'Die Startzeit muss innerhalb dieses Dienstes liegen.'; return; }
    if (endDate > dutyEnd(duty)) { error.textContent = `Die Endzeit darf nicht nach dem Dienstende um ${fmtTime(dutyEnd(duty))} Uhr liegen.`; return; }
    duty.entries.push({ id: uid(), type, start: startDate.toISOString(), end: endDate.toISOString(), note });
    saveState();
    modal.close();
    render();
  };
}

function openEditEntry(dutyId, entryId) {
  const duty = state.duties.find(item => item.id === dutyId);
  const entry = duty?.entries.find(item => item.id === entryId);
  if (!duty || !entry) return;
  let type = entry.type;
  const start = new Date(entry.start), end = new Date(entry.end);
  modalContent.innerHTML = `<div class="modal-body entry-form-body">
    <div class="modal-title">Einsatz bearbeiten</div>
    <div class="segment"><button type="button" class="${type === 'Telefonisch' ? 'selected' : ''}" data-type="Telefonisch">Telefonisch</button><button type="button" class="${type === 'Im Haus' ? 'selected' : ''}" data-type="Im Haus">Im Haus</button></div>
    <label class="field"><span>Datum</span><input id="entryDate" type="date" value="${localDateKey(start)}"></label>
    <label class="field"><span>Startzeit</span><input id="entryStart" type="time" value="${pad(start.getHours())}:${pad(start.getMinutes())}"></label>
    <label class="field"><span>Endzeit</span><input id="entryEnd" type="time" value="${pad(end.getHours())}:${pad(end.getMinutes())}"></label>
    <label class="field"><span>Bemerkung (optional)</span><textarea id="entryNote" rows="3" maxlength="200" placeholder="z. B. OP">${escapeHtml(entry.note || '')}</textarea></label>
    <div id="modalError" class="error"></div>
    <div class="modal-actions"><button type="button" class="primary" id="saveEntry">Änderungen speichern</button><button class="secondary-button">Abbrechen</button></div>
  </div>`;
  modal.showModal();
  for (const button of modalContent.querySelectorAll('[data-type]')) button.onclick = () => {
    type = button.dataset.type;
    for (const item of modalContent.querySelectorAll('[data-type]')) item.classList.toggle('selected', item === button);
  };
  document.getElementById('saveEntry').onclick = () => {
    const date = document.getElementById('entryDate').value;
    const startTime = document.getElementById('entryStart').value;
    const endTime = document.getElementById('entryEnd').value;
    const note = document.getElementById('entryNote').value.trim();
    const error = document.getElementById('modalError'); error.textContent = '';
    if (!date || !startTime || !endTime) { error.textContent = 'Bitte alle Felder ausfüllen.'; return; }
    const startDate = new Date(`${date}T${startTime}:00`), endDate = new Date(`${date}T${endTime}:00`);
    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
    if (startDate < dutyStart(duty) || startDate >= dutyEnd(duty)) { error.textContent = 'Die Startzeit muss innerhalb dieses Dienstes liegen.'; return; }
    if (endDate > dutyEnd(duty)) { error.textContent = `Die Endzeit darf nicht nach dem Dienstende um ${fmtTime(dutyEnd(duty))} Uhr liegen.`; return; }
    Object.assign(entry, { type, start: startDate.toISOString(), end: endDate.toISOString(), note });
    saveState(); haptic(); modal.close(); render();
  };
}

function privacyNote() {
  return `<div class="privacy-note"><span aria-hidden="true">🔒</span><span>Alle Dienste und Einsätze werden ausschließlich lokal auf diesem Gerät gespeichert. Es findet keine Cloud-Synchronisierung und keine Übertragung an GitHub statt.</span></div>`;
}

function openMenu() {
  modalContent.innerHTML = `<div class="modal-body">
    <div class="modal-title">Mehr</div>
    <div class="modal-section-title">Lokale Daten</div>
    <button type="button" class="secondary-button" id="openBackup">Datensicherung</button>
    <div class="modal-section-title">Hinweis</div>
    <div class="privacy-note"><span aria-hidden="true">🔒</span><span>Die App speichert alle persönlichen Einträge nur im lokalen Browser-Speicher dieses Geräts. GitHub enthält ausschließlich den Programmcode.</span></div>
    <button class="secondary-button">Schließen</button>
  </div>`;
  modal.showModal();
  document.getElementById('openBackup').onclick = () => { modal.close(); openBackupMenu(); };
}
function openBackupMenu() {
  modalContent.innerHTML = `<div class="modal-body">
    <div class="modal-title">Datensicherung</div>
    <button type="button" class="secondary-button" id="exportBackup">Sicherung exportieren</button>
    <button type="button" class="secondary-button" id="importBackup">Sicherung importieren</button>
    <div class="small-note">Die Sicherungsdatei wird von dir selbst gespeichert. Es erfolgt kein automatischer Cloud-Upload.</div>
    <button class="secondary-button">Schließen</button>
  </div>`;
  modal.showModal();
  document.getElementById('exportBackup').onclick = exportBackup;
  document.getElementById('importBackup').onclick = () => { modal.close(); importInput.click(); };
}
function exportBackup() {
  const backup = { version: APP_VERSION, exportedAt: new Date().toISOString(), duties: state.duties };
  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `Dienst-Sicherung-${localDateKey(new Date())}.json`);
  localStorage.setItem(BACKUP_DATE_KEY, new Date().toISOString());
  showBackupReminder();
  modal.close();
}
async function importBackup(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const data = Array.isArray(parsed.duties) ? parsed : null;
    if (!isValidBackup(data)) throw new Error('invalid');
    const dutyCount = data.duties.length;
    const entryCount = data.duties.reduce((count, duty) => count + duty.entries.length, 0);
    if (confirm(`Die Sicherung enthält ${dutyCount} Dienste und ${entryCount} Einsätze. Vorhandene lokale Daten wirklich ersetzen?`)) {
      state.duties = data.duties;
      saveState();
      localStorage.setItem(BACKUP_DATE_KEY, new Date().toISOString());
      showBackupReminder();
      render();
    }
  } catch {
    alert('Die Sicherungsdatei ist ungültig oder beschädigt. Es wurden keine Daten verändert.');
  }
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function exportMonthCsv() {
  const duties = monthDuties().slice().reverse();
  if (!duties.length) { alert('Für diesen Monat sind keine Dienste vorhanden.'); return; }
  const rows = [['Dienst', 'Dienstbeginn', 'Dienstende', 'Dienstart', 'Datum', 'Start', 'Ende', 'Minuten', 'Bemerkung', 'Gerundete Stunden je Dienstart']];
  for (const duty of duties) {
    const rounded = { 'Telefonisch': roundedHours(sum(duty, 'Telefonisch')), 'Im Haus': roundedHours(sum(duty, 'Im Haus')) };
    if (!duty.entries.length) rows.push([fmtShortDate(dutyStart(duty)), fmtTime(dutyStart(duty)), fmtTime(dutyEnd(duty)), '', '', '', '', '0', '', '0']);
    for (const entry of [...duty.entries].sort((a, b) => new Date(a.start) - new Date(b.start))) {
      const start = new Date(entry.start);
      const end = new Date(entry.end);
      rows.push([fmtShortDate(dutyStart(duty)), fmtTime(dutyStart(duty)), fmtTime(dutyEnd(duty)), entry.type, fmtShortDate(start), fmtTime(start), `${fmtTime(end)}${localDateKey(start) === localDateKey(end) ? '' : ` (${fmtShortDate(end)})`}`, minutes(entry), entry.note || '', rounded[entry.type]]);
    }
  }
  const csv = '\ufeff' + rows.map(row => row.map(csvEscape).join(';')).join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `Dienst-${selectedMonth.getFullYear()}-${pad(selectedMonth.getMonth() + 1)}.csv`);
}
function printMonthReport() {
  const duties = monthDuties().slice().reverse();
  if (!duties.length) { alert('Für diesen Monat sind keine Dienste vorhanden.'); return; }
  const totals = monthTotals(duties);
  const rows = duties.map(duty => {
    const phoneMinutes = sum(duty, 'Telefonisch');
    const houseMinutes = sum(duty, 'Im Haus');
    return `<tr><td>${fmtDate(dutyStart(duty))}</td><td>${phoneMinutes} Min.</td><td>${roundedHours(phoneMinutes)} Std.</td><td>${houseMinutes} Min.</td><td>${roundedHours(houseMinutes)} Std.</td><td>${roundedHours(phoneMinutes) + roundedHours(houseMinutes)} Std.</td></tr>`;
  }).join('');
  const report = window.open('', '_blank');
  if (!report) { alert('Bitte Pop-ups für den PDF-Bericht erlauben.'); return; }
  report.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Dienst – ${fmtMonth(selectedMonth)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;margin:36px;color:#111}h1{margin-bottom:4px}p{color:#666;margin-top:0}table{width:100%;border-collapse:collapse;margin-top:24px;font-size:13px}th,td{border-bottom:1px solid #ddd;padding:10px 7px;text-align:left}th{background:#f3f4f6}.summary{display:flex;gap:12px;margin-top:20px}.box{border:1px solid #ddd;border-radius:10px;padding:12px 16px}.box strong{display:block;font-size:22px;margin-top:5px}@media print{body{margin:18mm}}</style></head><body><h1>Dienst – ${fmtMonth(selectedMonth)}</h1><p>Monatsbericht · lokal auf dem Gerät erstellt</p><div class="summary"><div class="box">Telefonisch<strong>${totals.phoneHours} Std.</strong></div><div class="box">Im Haus<strong>${totals.houseHours} Std.</strong></div><div class="box">Gesamt<strong>${totals.phoneHours + totals.houseHours} Std.</strong></div></div><table><thead><tr><th>Dienst</th><th>Telefonisch</th><th>Gerundet</th><th>Im Haus</th><th>Gerundet</th><th>Gesamt</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  report.document.close();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js');
      registration.update();
      if (registration.waiting) showUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch (error) {
      console.warn('Offline-Modus konnte nicht aktiviert werden.', error);
    }
  });
}

showBackupReminder();
render();
