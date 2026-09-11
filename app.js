'use strict';

const STORAGE_KEY = 'dienst-webapp-v1';
const BACKUP_DATE_KEY = 'dienst-last-backup';
const BACKUP_REMINDER_DAYS = 30;
const BACKUP_DISMISSED_KEY = 'dienst-backup-reminder-dismissed';
const APP_VERSION = '7.34';
const DEFAULT_DUTY_TIMES = {
  0: { start: '08:30', end: '07:15' }, // Sonntag
  1: { start: '07:15', end: '07:15' }, // Montag
  2: { start: '07:15', end: '07:15' }, // Dienstag
  3: { start: '07:15', end: '07:15' }, // Mittwoch
  4: { start: '07:15', end: '07:15' }, // Donnerstag
  5: { start: '07:15', end: '08:30' }, // Freitag
  6: { start: '08:30', end: '08:30' }  // Samstag
};
const WEEKDAY_NAMES = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
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
const backupReminderDismiss = document.getElementById('backupReminderDismiss');

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
document.getElementById('homeButton').addEventListener('click', goHome);
importInput.addEventListener('change', importBackup);
updateButton.addEventListener('click', applyUpdate);
backupReminderButton.addEventListener('click', openBackupMenu);
backupReminderDismiss.addEventListener('click', () => {
  localStorage.setItem(BACKUP_DISMISSED_KEY, new Date().toISOString());
  backupReminder.hidden = true;
});

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && Array.isArray(parsed.duties) ? { ...parsed, settings: normalizeSettings(parsed.settings) } : { duties: [], settings: normalizeSettings() };
  } catch {
    return { duties: [], settings: normalizeSettings() };
  }
}
function normalizeSettings(settings = {}) {
  const workHourlyRate = Number.isFinite(Number(settings.workHourlyRate)) ? Number(settings.workHourlyRate) : 50.96;
  const allowanceHourlyRate = Number.isFinite(Number(settings.allowanceHourlyRate)) ? Number(settings.allowanceHourlyRate) : 43.42;
  let rateHistory = Array.isArray(settings.rateHistory) ? settings.rateHistory
    .filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(item.validFrom) && Number.isFinite(Number(item.workHourlyRate)) && Number.isFinite(Number(item.allowanceHourlyRate)))
    .map(item => ({ validFrom: item.validFrom, workHourlyRate: Number(item.workHourlyRate), allowanceHourlyRate: Number(item.allowanceHourlyRate) })) : [];
  if (!rateHistory.length) rateHistory = [{ validFrom: '1900-01-01', workHourlyRate, allowanceHourlyRate }];
  rateHistory.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const latest = rateHistory[rateHistory.length - 1];
  const dutyTimes = {};
  for (let day = 0; day < 7; day++) {
    const candidate = settings.dutyTimes?.[day] || settings.dutyTimes?.[String(day)] || DEFAULT_DUTY_TIMES[day];
    const validStart = /^\d{2}:\d{2}$/.test(candidate?.start || '') ? candidate.start : DEFAULT_DUTY_TIMES[day].start;
    const validEnd = /^\d{2}:\d{2}$/.test(candidate?.end || '') ? candidate.end : DEFAULT_DUTY_TIMES[day].end;
    dutyTimes[day] = { start: validStart, end: validEnd };
  }
  return {
    showPay: Boolean(settings.showPay),
    showTimeline: Boolean(settings.showTimeline),
    showCustomDutyTimes: Boolean(settings.showCustomDutyTimes),
    dutyTimes,
    workHourlyRate: latest.workHourlyRate,
    allowanceHourlyRate: latest.allowanceHourlyRate,
    rateHistory
  };
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
function timeParts(value) {
  const [hour, minute] = String(value).split(':').map(Number);
  return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}
function dutySchedule(dateKey) {
  const date = parseLocalDate(dateKey);
  const weekday = date.getDay();
  const source = state.settings?.showCustomDutyTimes ? state.settings.dutyTimes?.[weekday] : DEFAULT_DUTY_TIMES[weekday];
  const fallback = DEFAULT_DUTY_TIMES[weekday];
  const start = timeParts(source?.start || fallback.start);
  const end = timeParts(source?.end || fallback.end);
  return { startHour: start.hour, startMinute: start.minute, endHour: end.hour, endMinute: end.minute };
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
function dutyProgress(duty, now = new Date()) {
  const start = dutyStart(duty).getTime();
  const end = dutyEnd(duty).getTime();
  if (end <= start) return 0;
  return Math.max(0, Math.min(1, (now.getTime() - start) / (end - start)));
}
function timelineHtml(duty) {
  if (!state.settings?.showTimeline) return '';
  const progress = dutyProgress(duty);
  const percent = Math.round(progress * 1000) / 10;
  return `<div class="duty-timeline" aria-label="Dienstfortschritt ${Math.round(progress * 100)} Prozent">
    <div class="timeline-track">
      <div class="timeline-fill" style="width:${percent}%"></div>
      <button class="timeline-ambulance-button" type="button" aria-label="Rettungswagen beschleunigen" style="left:${percent}%">
        <span class="timeline-dust timeline-dust-1" aria-hidden="true"></span>
        <span class="timeline-dust timeline-dust-2" aria-hidden="true"></span>
        <span class="timeline-dust timeline-dust-3" aria-hidden="true"></span>
        <img class="timeline-ambulance" src="icons/apple-touch-icon.png" alt="">
      </button>
    </div>
    <div class="timeline-labels"><span>${fmtTime(dutyStart(duty))}</span><span>${Math.round(progress * 100)} %</span><span>${fmtTime(dutyEnd(duty))}</span></div>
  </div>`;
}
function updateDutyTimeline() {
  if (currentView !== 'dienst' || !state.settings?.showTimeline) return;
  const duty = activeDuty();
  const track = document.querySelector('.timeline-track');
  const ambulanceButton = document.querySelector('.timeline-ambulance-button');
  const fill = document.querySelector('.timeline-fill');
  const labels = document.querySelector('.timeline-labels');
  if (!duty || !track || !ambulanceButton || !fill || !labels) return;
  const progress = dutyProgress(duty);
  const percent = Math.round(progress * 1000) / 10;
  fill.style.width = `${percent}%`;
  ambulanceButton.style.left = `${percent}%`;
  const spans = labels.querySelectorAll('span');
  if (spans[1]) spans[1].textContent = `${Math.round(progress * 100)} %`;
}
function bindTimelineBoost() {
  const button = document.querySelector('.timeline-ambulance-button');
  if (!button) return;
  let boostPx = 0;
  let resetTimer = null;
  let lastTouchEnd = 0;
  const boost = event => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    boostPx = Math.min(boostPx + 8, 28);
    button.style.setProperty('--boost-offset', `${boostPx}px`);
    button.classList.remove('boosting');
    void button.offsetWidth;
    button.classList.add('boosting');
    haptic();
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      boostPx = 0;
      button.style.setProperty('--boost-offset', '0px');
      button.classList.remove('boosting');
    }, 900);
  };
  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') event.preventDefault();
  }, { passive: false });
  button.addEventListener('touchstart', event => {
    event.preventDefault();
  }, { passive: false });
  button.addEventListener('touchend', event => {
    const now = Date.now();
    if (now - lastTouchEnd < 350) event.preventDefault();
    lastTouchEnd = now;
    boost(event);
  }, { passive: false });
  button.addEventListener('click', event => {
    if (event.detail > 1) event.preventDefault();
    if (event.pointerType === 'touch') return;
    boost(event);
  });
  button.addEventListener('dblclick', event => {
    event.preventDefault();
    event.stopPropagation();
  });
}
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
// Rufdienst-Regel:
// - Telefonisch: alle Telefonminuten eines Dienstes addieren und einmal auf volle Stunden aufrunden.
// - Im Haus: jeden einzelnen Hauseinsatz separat auf volle Stunden aufrunden und anschließend addieren.
function phoneRoundedHours(duty) { return roundedHours(sum(duty, 'Telefonisch')); }
function houseRoundedHours(duty) {
  return duty.entries
    .filter(entry => entry.type === 'Im Haus')
    .reduce((total, entry) => total + roundedHours(minutes(entry)), 0);
}
function hourLabel(value) { return `${value} ${value === 1 ? 'Stunde' : 'Stunden'}`; }
function fmtMoney(value) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value); }
function dutyRoundedHours(duty) { return phoneRoundedHours(duty) + houseRoundedHours(duty); }
function dutyAllowanceMultiplier(duty) { const day = parseLocalDate(duty.date).getDay(); return day === 0 || day === 6 ? 4 : 2; }
function ratesForDuty(duty) {
  const settings = state.settings || normalizeSettings();
  const history = Array.isArray(settings.rateHistory) && settings.rateHistory.length ? settings.rateHistory : [{ validFrom: '1900-01-01', workHourlyRate: settings.workHourlyRate, allowanceHourlyRate: settings.allowanceHourlyRate }];
  const applicable = history.filter(item => item.validFrom <= duty.date).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] || history[0];
  return applicable;
}
function dutyPay(duty) {
  const rates = ratesForDuty(duty);
  const hours = dutyRoundedHours(duty);
  const hoursPay = hours * rates.workHourlyRate;
  const multiplier = dutyAllowanceMultiplier(duty);
  const allowance = multiplier * rates.allowanceHourlyRate;
  return { hours, hoursPay, multiplier, allowance, total: hoursPay + allowance, rates };
}
function monthPay(duties) { return duties.reduce((total, duty) => total + dutyPay(duty).total, 0); }
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
    totals.phoneHours += phoneRoundedHours(duty);
    totals.houseHours += houseRoundedHours(duty);
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
  const dismissedRecently = daysSince(localStorage.getItem(BACKUP_DISMISSED_KEY)) < BACKUP_REMINDER_DAYS;
  backupReminder.hidden = !(hasData && overdue && !dismissedRecently);
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
function goHome() {
  if (modal.open) modal.close();
  currentView = 'dienst';
  selectedDutyId = null;
  for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.view === 'dienst');
  renderDuty();
}

// iOS kann eine installierte Web-App im Hintergrund einfrieren und beim Öffnen
// exakt an derselben Stelle fortsetzen. Deshalb prüfen wir zeitabhängige Ansichten
// beim Wiederkehren in die App und regelmäßig erneut.
let lastDutySignature = '';
function dutyViewSignature() {
  const duty = activeDuty();
  return duty ? `${duty.id}|${duty.date}|${duty.entries.length}|${sum(duty, 'Telefonisch')}|${sum(duty, 'Im Haus')}` : 'none';
}
function refreshTimeSensitiveView(force = false) {
  if (document.visibilityState === 'hidden') return;
  if (currentView !== 'dienst') return;
  const signature = dutyViewSignature();
  if (force || signature !== lastDutySignature) {
    lastDutySignature = signature;
    renderDuty();
  } else {
    updateDutyTimeline();
  }
}

function renderDuty() {
  title.textContent = 'Dienst';
  subtitle.textContent = 'Bereitschaft erfassen';
  const duty = activeDuty();
  lastDutySignature = dutyViewSignature();
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
      ${timelineHtml(duty)}
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
  bindTimelineBoost();
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
      <div class="month-stat">
        <div class="month-stat-label">Dienste</div>
        <div class="month-stat-value">${duties.length}</div>
      </div>
      <div class="month-stat">
        <div class="month-stat-label">Stunden</div>
        <div class="month-stat-value">${totalHours} Std.</div>
      </div>
      <div class="month-stat">
        <div class="month-stat-label">Aufteilung</div>
        <div class="month-stat-breakdown"><span>Telefonisch <strong>${totals.phoneHours} Std.</strong></span><span>Im Haus <strong>${totals.houseHours} Std.</strong></span></div>
      </div>
    </section>
    ${state.settings.showPay ? `<section class="pay-month-card"><div><div class="pay-kicker">Vergütung ${fmtMonth(selectedMonth)}</div><div class="pay-subtitle">Summe aller erfassten Dienste</div></div><div class="pay-month-value">${fmtMoney(monthPay(duties))}</div></section>` : ''}
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
  const phoneHours = phoneRoundedHours(duty);
  const houseHours = houseRoundedHours(duty);
  const totalHours = phoneHours + houseHours;
  main.innerHTML = `
    <button class="text-button" id="backMonth" type="button">‹ Zurück zur Übersicht</button>
    <section class="card hero">
      <div class="hero-kicker">Bereitschaftsdienst</div>
      <div class="hero-date">${fmtDate(dutyStart(duty))}</div>
      <div class="hero-time">${dutyTimeText(duty)}</div>
    </section>
    <div class="card-header">Statistik</div>
    <section class="card">
      <div class="row"><div class="row-main"><div class="row-title">Telefonisch</div><div class="row-subtitle">${phoneMinutes} Minuten · gemeinsam aufgerundet</div></div><div class="row-value strong-value">${hourLabel(phoneHours)}</div></div>
      <div class="row"><div class="row-main"><div class="row-title">Im Haus</div><div class="row-subtitle">${houseMinutes} Minuten · jeder Einsatz einzeln aufgerundet</div></div><div class="row-value strong-value">${hourLabel(houseHours)}</div></div>
      <div class="row total-row"><div class="row-main"><div class="row-title">Gesamt</div><div class="row-subtitle">Telefon gesamt gerundet + Hauseinsätze einzeln gerundet</div></div><div class="row-value total-value">${hourLabel(totalHours)}</div></div>
    </section>
    <div class="card-header">Einsätze</div>
    <button class="primary" id="newHistoricalEntry" type="button">+ Einsatz hinzufügen</button>
    <section class="card">${entries.length ? entries.map(entry => entryRow(duty, entry, true)).join('') : '<div class="empty">Noch keine Einsätze</div>'}</section>
    ${state.settings.showPay ? payDetailCard(duty) : ''}
    <div class="detail-actions">
      <button class="secondary-button" id="editDuty" type="button">Dienst bearbeiten</button>
      <button class="secondary-button danger-button" id="deleteDuty" type="button">Dienst löschen</button>
    </div>`;
  document.getElementById('backMonth').onclick = () => { selectedDutyId = null; renderMonth(); };
  document.getElementById('newHistoricalEntry').onclick = () => openNewEntry(id);
  document.getElementById('editDuty').onclick = () => openEditDuty(id);
  document.getElementById('deleteDuty').onclick = () => deleteDutyById(id);
  bindInteractiveEntries();
}

function payDetailCard(duty) {
  const pay = dutyPay(duty);
  const settings = state.settings;
  const dayText = pay.multiplier === 4 ? 'Samstag/Sonntag · 400 %' : 'Montag–Freitag · 200 %';
  return `<div class="card-header">Vergütung</div>
    <section class="card pay-detail-card">
      <div class="row"><div class="row-main"><div class="row-title">Arbeit in RB</div><div class="row-subtitle">${pay.hours} Std. × ${fmtMoney(pay.rates.workHourlyRate)}</div></div><div class="row-value strong-value">${fmtMoney(pay.hoursPay)}</div></div>
      <div class="row"><div class="row-main"><div class="row-title">Rufbereitschaft Pauschale</div><div class="row-subtitle">${dayText} von ${fmtMoney(pay.rates.allowanceHourlyRate)}</div></div><div class="row-value strong-value">${fmtMoney(pay.allowance)}</div></div>
      <div class="row total-row"><div class="row-main"><div class="row-title">Gesamtvergütung</div><div class="row-subtitle">Pauschale + gerundete Arbeit in RB</div></div><div class="row-value total-value">${fmtMoney(pay.total)}</div></div>
    </section>`;
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
        ${entry.patientId ? `<div class="entry-note">Patienten-ID: ${escapeHtml(entry.patientId)}</div>` : ''}
        ${entry.patientIdPhoto ? `<button type="button" class="entry-photo-link" data-photo-duty="${escapeHtml(duty.id)}" data-photo-entry="${escapeHtml(entry.id)}">📷 Patienten-ID anzeigen</button>` : ''}
        ${entry.note ? `<div class="entry-note">Bemerkung: ${escapeHtml(entry.note)}</div>` : ''}
      </div>
      <div class="row-value">${minutes(entry)} Min.${entry.type === 'Im Haus' ? `<span class="entry-rounded-hours">${hourLabel(roundedHours(minutes(entry)))} gerundet</span>` : ''}</div>
      <span class="chevron">›</span>
    </div>
  </div>`;
}

function haptic() {
  if (navigator.vibrate) navigator.vibrate(12);
}
let undoTimer = null;
function showUndoToast(message, undoAction) {
  const toast = document.getElementById('undoToast');
  const text = document.getElementById('undoToastText');
  const button = document.getElementById('undoToastButton');
  if (!toast || !text || !button) return;
  clearTimeout(undoTimer);
  text.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('visible'));
  button.onclick = () => {
    clearTimeout(undoTimer);
    undoAction();
    toast.classList.remove('visible');
    setTimeout(() => { toast.hidden = true; }, 220);
  };
  undoTimer = setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => { toast.hidden = true; }, 220);
  }, 8000);
}
function deleteDutyById(id) {
  if (!confirm('Diesen Dienst mit allen Einsätzen löschen?')) return;
  const index = state.duties.findIndex(item => item.id === id);
  if (index < 0) return;
  const [removed] = state.duties.splice(index, 1);
  saveState();
  if (selectedDutyId === id) selectedDutyId = null;
  haptic();
  render();
  showUndoToast('Dienst gelöscht', () => {
    state.duties.splice(Math.min(index, state.duties.length), 0, removed);
    saveState();
    haptic();
    render();
  });
}
function deleteEntryById(dutyId, entryId) {
  if (!confirm('Einsatz löschen?')) return;
  const duty = state.duties.find(item => item.id === dutyId);
  if (!duty) return;
  const index = duty.entries.findIndex(entry => entry.id === entryId);
  if (index < 0) return;
  const [removed] = duty.entries.splice(index, 1);
  saveState();
  haptic();
  render();
  showUndoToast('Einsatz gelöscht', () => {
    duty.entries.splice(Math.min(index, duty.entries.length), 0, removed);
    saveState();
    haptic();
    render();
  });
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
      if (!moved && dragging && onLongPress) {
        // Das Menü erst nach dem Loslassen öffnen. So liegt der Finger nicht bereits
        // auf „Bearbeiten“ und iOS startet keine Textauswahl im neuen Dialog.
        longPressed = true;
        dragging = false;
        close();
        haptic();
      }
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
    if (longPressed) {
      // Erst jetzt – nach touchend/pointerup – wird das Kontextmenü angezeigt.
      setTimeout(() => onLongPress && onLongPress(), 0);
      return;
    }
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
    if (event.target.closest?.('.entry-photo-link')) return;
    if (moved || longPressed || item.classList.contains('open')) { event.preventDefault(); if (item.classList.contains('open')) close(); return; }
    onOpen();
  });
  content.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } });
  content.addEventListener('contextmenu', event => event.preventDefault());
  content.addEventListener('selectstart', event => event.preventDefault());
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
  modal.classList.add('action-sheet-open');
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
  modal.classList.add('action-sheet-open');
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
  modal.classList.add('duty-date-dialog');
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
    currentView = 'dienst';
    selectedDutyId = null;
    for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.view === 'dienst');
    refreshTimeSensitiveView(true);
  };
}

function openEditDuty(dutyId) {
  modal.classList.add('duty-date-dialog');
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
  const defaultEnd = new Date(defaultDate.getTime() + 10 * 60000);
  modalContent.innerHTML = `<div class="modal-body entry-form-body">
    <div class="modal-title">Neuer Einsatz</div>
    <div class="segment"><button type="button" class="selected" data-type="Telefonisch">Telefonisch</button><button type="button" data-type="Im Haus">Im Haus</button></div>
    <label class="field"><span>Datum</span><input id="entryDate" type="date" value="${localDateKey(defaultDate)}"></label>
    <label class="field"><span>Startzeit</span><input id="entryStart" type="time" value="${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}"></label>
    <label class="field"><span>Endzeit</span><input id="entryEnd" type="time" value="${pad(defaultEnd.getHours())}:${pad(defaultEnd.getMinutes())}"></label>
    <label class="field"><span>Patienten-ID (optional)</span>
      <div class="patient-photo-entry-row">
        <button type="button" class="patient-scan-button" id="scanPatientId" aria-label="Patienten-ID fotografieren"><svg class="patient-camera-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.3 6.5 9.5 4.8h5L15.7 6.5H18a3 3 0 0 1 3 3v7.2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9.5a3 3 0 0 1 3-3h2.3Z"/>
          <circle cx="12" cy="13" r="3.6"/>
        </svg><span>Foto aufnehmen</span></button>
        <button type="button" class="patient-info-button" id="patientScanInfo" aria-label="Information zur Patienten-ID">i</button>
      </div>
      <input type="hidden" id="entryPatientIdPhoto">
      <div id="entryPatientIdPhotoPreviewWrap" class="patient-id-photo-preview-wrap" hidden>
        <div class="patient-id-photo-preview-label">Gespeicherter Ausschnitt</div>
        <img id="entryPatientIdPhotoPreview" class="patient-id-photo-preview" alt="Foto der Patienten-ID">
        <button type="button" id="removePatientIdPhoto" class="secondary-button patient-id-photo-remove">Foto entfernen</button>
      </div>
    </label>
    <label class="field"><span>Bemerkung (optional)</span><textarea id="entryNote" rows="3" maxlength="200" placeholder="z. B. OP"></textarea></label>
    <div id="modalError" class="error"></div>
    <div class="modal-actions"><button type="button" class="primary" id="saveEntry">Speichern</button><button class="secondary-button">Abbrechen</button></div>
  </div>`;
  modal.showModal();
  if (typeof entry !== 'undefined' && entry?.patientIdPhoto) {
    const photoInput = document.getElementById('entryPatientIdPhoto');
    const photoPreview = document.getElementById('entryPatientIdPhotoPreview');
    const photoWrap = document.getElementById('entryPatientIdPhotoPreviewWrap');
    if (photoInput) photoInput.value = entry.patientIdPhoto;
    if (photoPreview) photoPreview.src = entry.patientIdPhoto;
    if (photoWrap) photoWrap.hidden = false;
  }
  bindPatientIdTools();
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
    if (!date || !startTime || !endTime) { error.textContent = 'Bitte Datum und Zeiten ausfüllen.'; return; }
    const startDate = new Date(`${date}T${startTime}:00`);
    const endDate = new Date(`${date}T${endTime}:00`);
    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
    if (startDate < dutyStart(duty) || startDate >= dutyEnd(duty)) { error.textContent = 'Die Startzeit muss innerhalb dieses Dienstes liegen.'; return; }
    if (endDate > dutyEnd(duty)) { error.textContent = `Die Endzeit darf nicht nach dem Dienstende um ${fmtTime(dutyEnd(duty))} Uhr liegen.`; return; }
    const patientIdPhoto = document.getElementById('entryPatientIdPhoto')?.value || '';
    duty.entries.push({ id: uid(), type, start: startDate.toISOString(), end: endDate.toISOString(), patientIdPhoto, note });
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
    <label class="field"><span>Patienten-ID (optional)</span>
      <div class="patient-photo-entry-row">
        <button type="button" class="patient-scan-button" id="scanPatientId" aria-label="Patienten-ID fotografieren"><svg class="patient-camera-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.3 6.5 9.5 4.8h5L15.7 6.5H18a3 3 0 0 1 3 3v7.2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9.5a3 3 0 0 1 3-3h2.3Z"/>
          <circle cx="12" cy="13" r="3.6"/>
        </svg><span>Foto aufnehmen</span></button>
        <button type="button" class="patient-info-button" id="patientScanInfo" aria-label="Information zur Patienten-ID">i</button>
      </div>
      <input type="hidden" id="entryPatientIdPhoto">
      <div id="entryPatientIdPhotoPreviewWrap" class="patient-id-photo-preview-wrap" hidden>
        <div class="patient-id-photo-preview-label">Gespeicherter Ausschnitt</div>
        <img id="entryPatientIdPhotoPreview" class="patient-id-photo-preview" alt="Foto der Patienten-ID">
        <button type="button" id="removePatientIdPhoto" class="secondary-button patient-id-photo-remove">Foto entfernen</button>
      </div>
    </label>
    <label class="field"><span>Bemerkung (optional)</span><textarea id="entryNote" rows="3" maxlength="200" placeholder="z. B. OP">${escapeHtml(entry.note || '')}</textarea></label>
    <div id="modalError" class="error"></div>
    <div class="modal-actions"><button type="button" class="primary" id="saveEntry">Änderungen speichern</button><button class="secondary-button">Abbrechen</button></div>
  </div>`;
  modal.showModal();
  if (typeof entry !== 'undefined' && entry?.patientIdPhoto) {
    const photoInput = document.getElementById('entryPatientIdPhoto');
    const photoPreview = document.getElementById('entryPatientIdPhotoPreview');
    const photoWrap = document.getElementById('entryPatientIdPhotoPreviewWrap');
    if (photoInput) photoInput.value = entry.patientIdPhoto;
    if (photoPreview) photoPreview.src = entry.patientIdPhoto;
    if (photoWrap) photoWrap.hidden = false;
  }
  bindPatientIdTools();
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
    if (!date || !startTime || !endTime) { error.textContent = 'Bitte Datum und Zeiten ausfüllen.'; return; }
    const startDate = new Date(`${date}T${startTime}:00`), endDate = new Date(`${date}T${endTime}:00`);
    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
    if (startDate < dutyStart(duty) || startDate >= dutyEnd(duty)) { error.textContent = 'Die Startzeit muss innerhalb dieses Dienstes liegen.'; return; }
    if (endDate > dutyEnd(duty)) { error.textContent = `Die Endzeit darf nicht nach dem Dienstende um ${fmtTime(dutyEnd(duty))} Uhr liegen.`; return; }
    const patientIdPhoto = document.getElementById('entryPatientIdPhoto')?.value || '';
    Object.assign(entry, { type, start: startDate.toISOString(), end: endDate.toISOString(), patientIdPhoto, note });
    saveState(); haptic(); modal.close(); render();
  };
}


function bindPatientIdTools() {
  const photoButton = document.getElementById('scanPatientId');
  const infoButton = document.getElementById('patientScanInfo');
  if (photoButton) photoButton.onclick = openPatientPhotoCamera;
  if (infoButton) infoButton.onclick = showPatientPhotoInfo;
}

function showPatientPhotoInfo() {
  alert('Patienten-ID fotografieren\n\nEs gibt keine Texterkennung und keine automatische Auswahl. Nach der Aufnahme legst du den Ausschnitt selbst fest. Gespeichert wird ausschließlich dieser kleine Bildausschnitt lokal zusammen mit dem jeweiligen Einsatz. Das vollständige Foto wird danach verworfen.');
}

function privacyNote() {
  return `<div class="privacy-note"><span aria-hidden="true">🔒</span><span>Alle Dienste und Einsätze werden ausschließlich lokal auf diesem Gerät gespeichert. Es findet keine Cloud-Synchronisierung und keine Übertragung an GitHub statt.</span></div>`;
}

function openMenu() {
  const settings = state.settings || normalizeSettings();
  modalContent.innerHTML = `<div class="modal-body">
    <div class="modal-title">Mehr</div>
    <div class="modal-section-title">Einstellungen</div>
    <label class="settings-toggle-row">
      <span><strong>Individuelle Dienstzeiten</strong><small>Start- und Endzeit für jeden Wochentag selbst festlegen</small></span>
      <input id="showCustomDutyTimesToggle" class="switch-input" type="checkbox" ${settings.showCustomDutyTimes ? 'checked' : ''}>
      <span class="switch" aria-hidden="true"></span>
    </label>
    <button type="button" class="advanced-options-button" id="advancedOptionsButton" aria-expanded="false">
      <span>Erweiterte Optionen</span><span class="advanced-options-chevron">›</span>
    </button>
    <div id="advancedOptions" class="advanced-options" hidden>
      <label class="settings-toggle-row">
        <span><strong>Stundenlohn anzeigen</strong><small>Optionale Vergütungsberechnung</small></span>
        <input id="showPayToggle" class="switch-input" type="checkbox" ${settings.showPay ? 'checked' : ''}>
        <span class="switch" aria-hidden="true"></span>
      </label>
      <label class="settings-toggle-row">
        <span><strong>Zeitstrahl anzeigen</strong><small>Optionale Fortschrittsanzeige des aktuellen Dienstes</small></span>
        <input id="showTimelineToggle" class="switch-input" type="checkbox" ${settings.showTimeline ? 'checked' : ''}>
        <span class="switch" aria-hidden="true"></span>
      </label>
    </div>
    <div id="dutyTimeSettings" class="duty-time-settings" ${settings.showCustomDutyTimes ? '' : 'hidden'}>
      <div class="small-note">Die Endzeit gilt jeweils für den Folgetag. Änderungen wirken auf die Dienstzeiten des gewählten Wochentags.</div>
      ${[1,2,3,4,5,6,0].map(day => `<div class="weekday-time-row"><strong>${WEEKDAY_NAMES[day]}</strong><label><span>Start</span><input id="dutyStart-${day}" type="time" value="${settings.dutyTimes[day].start}"></label><label><span>Ende</span><input id="dutyEnd-${day}" type="time" value="${settings.dutyTimes[day].end}"></label></div>`).join('')}
      <button type="button" class="primary settings-save" id="saveDutyTimeSettings">Dienstzeiten speichern</button>
    </div>
    <div id="paySettings" class="pay-settings" ${settings.showPay ? '' : 'hidden'}>
      <label class="field"><span>Stundenlohn Bereitschaftsdienst</span><div class="money-input"><input id="workHourlyRate" type="number" inputmode="decimal" min="0" step="0.01" value="${settings.workHourlyRate.toFixed(2)}"><span>€ / Std.</span></div></label>
      <label class="field"><span>Stundenlohn für Dienstpauschale</span><div class="money-input"><input id="allowanceHourlyRate" type="number" inputmode="decimal" min="0" step="0.01" value="${settings.allowanceHourlyRate.toFixed(2)}"><span>€ / Std.</span></div></label>
      <label class="field"><span>Gültig ab</span><input id="rateValidFrom" type="date" value="${localDateKey(new Date())}"></label>
      <div class="small-note">Neue Löhne gelten erst ab diesem Datum. Frühere Dienste werden weiterhin mit dem damals gültigen Satz berechnet. Speichere bei einer Lohnerhöhung einfach den neuen Satz mit dem passenden Datum.</div>
      ${settings.rateHistory.length > 1 ? `<div class="rate-history"><strong>Gespeicherte Lohnzeiträume</strong>${settings.rateHistory.filter(r => r.validFrom !== '1900-01-01').slice().reverse().map(r => `<div class="rate-history-row"><span>ab ${fmtShortDate(parseLocalDate(r.validFrom))}</span><span>${fmtMoney(r.workHourlyRate)} / ${fmtMoney(r.allowanceHourlyRate)}</span></div>`).join('')}</div>` : ''}
      <div class="small-note">Pauschale: Montag–Freitag 200 % dieses Satzes, Samstag/Sonntag 400 %. Die Einsatzstunden werden wie bisher je Dienstart auf volle Stunden aufgerundet und anschließend addiert.</div>
      <button type="button" class="primary settings-save" id="savePaySettings">Einstellungen speichern</button>
    </div>
    <div class="modal-section-title">Lokale Daten</div>
    <button type="button" class="secondary-button" id="openBackup">Datensicherung</button>
    <div class="modal-section-title">Hinweis</div>
    <div class="privacy-note"><span aria-hidden="true">🔒</span><span>Auch die Lohnangaben werden ausschließlich lokal auf diesem Gerät gespeichert und nicht an GitHub oder einen Server übertragen.</span></div>
    <div class="app-version-label">Dienst · Version ${APP_VERSION}</div>
    <button class="secondary-button">Schließen</button>
  </div>`;
  modal.showModal();
  const advancedOptionsButton = document.getElementById('advancedOptionsButton');
  const advancedOptions = document.getElementById('advancedOptions');
  advancedOptionsButton.onclick = () => {
    const willOpen = advancedOptions.hidden;
    advancedOptions.hidden = !willOpen;
    advancedOptionsButton.setAttribute('aria-expanded', String(willOpen));
    advancedOptionsButton.classList.toggle('open', willOpen);
  };
  const toggle = document.getElementById('showPayToggle');
  const paySettings = document.getElementById('paySettings');
  const timelineToggle = document.getElementById('showTimelineToggle');
  timelineToggle.onchange = () => {
    state.settings.showTimeline = timelineToggle.checked;
    saveState();
    render();
  };
  const customDutyTimesToggle = document.getElementById('showCustomDutyTimesToggle');
  const dutyTimeSettings = document.getElementById('dutyTimeSettings');
  customDutyTimesToggle.onchange = () => {
    dutyTimeSettings.hidden = !customDutyTimesToggle.checked;
    if (!customDutyTimesToggle.checked) {
      state.settings.showCustomDutyTimes = false;
      saveState();
      render();
    }
  };
  document.getElementById('saveDutyTimeSettings').onclick = () => {
    const dutyTimes = {};
    for (let day = 0; day < 7; day++) {
      const startValue = document.getElementById(`dutyStart-${day}`).value;
      const endValue = document.getElementById(`dutyEnd-${day}`).value;
      if (!/^\d{2}:\d{2}$/.test(startValue) || !/^\d{2}:\d{2}$/.test(endValue)) {
        alert(`Bitte gültige Start- und Endzeiten für ${WEEKDAY_NAMES[day]} eingeben.`);
        return;
      }
      dutyTimes[day] = { start: startValue, end: endValue };
    }
    state.settings = normalizeSettings({ ...state.settings, showCustomDutyTimes: customDutyTimesToggle.checked, dutyTimes });
    saveState();
    haptic();
    modal.close();
    render();
  };
  toggle.onchange = () => {
    paySettings.hidden = !toggle.checked;
    if (!toggle.checked) {
      state.settings.showPay = false;
      saveState();
      render();
    }
  };
  document.getElementById('savePaySettings').onclick = () => {
    const workRate = Number(document.getElementById('workHourlyRate').value.replace?.(',', '.') ?? document.getElementById('workHourlyRate').value);
    const allowanceRate = Number(document.getElementById('allowanceHourlyRate').value.replace?.(',', '.') ?? document.getElementById('allowanceHourlyRate').value);
    if (!Number.isFinite(workRate) || workRate < 0 || !Number.isFinite(allowanceRate) || allowanceRate < 0) {
      alert('Bitte gültige Stundenlöhne eingeben.');
      return;
    }
    const validFrom = document.getElementById('rateValidFrom').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) {
      alert('Bitte ein gültiges Datum für „Gültig ab“ auswählen.');
      return;
    }
    const history = Array.isArray(state.settings.rateHistory) ? [...state.settings.rateHistory] : [];
    const existingIndex = history.findIndex(item => item.validFrom === validFrom);
    const newRate = { validFrom, workHourlyRate: workRate, allowanceHourlyRate: allowanceRate };
    if (existingIndex >= 0) history[existingIndex] = newRate; else history.push(newRate);
    history.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    state.settings = normalizeSettings({ ...state.settings, showPay: toggle.checked, rateHistory: history });
    saveState();
    haptic();
    modal.close();
    render();
  };
  document.getElementById('openBackup').onclick = () => { modal.close(); openBackupMenu(); };
}
function openBackupMenu() {
  modalContent.innerHTML = `<div class="modal-body">
    <div class="modal-title backup-title">Datensicherung <button type="button" class="info-button" id="backupInfo" aria-label="Information zur Datensicherung">i</button></div>
    <button type="button" class="secondary-button" id="exportBackup">Sicherung exportieren</button>
    <button type="button" class="secondary-button" id="importBackup">Sicherung importieren</button>
    <div class="small-note">Die Sicherungsdatei wird von dir selbst gespeichert. Es erfolgt kein automatischer Cloud-Upload.</div>
    <button class="secondary-button">Schließen</button>
  </div>`;
  modal.showModal();
  document.getElementById('exportBackup').onclick = exportBackup;
  document.getElementById('importBackup').onclick = () => { modal.close(); importInput.click(); };
  document.getElementById('backupInfo').onclick = openBackupInfo;
}
function openBackupInfo() {
  modalContent.innerHTML = `<div class="modal-body">
    <div class="modal-title">Wie funktioniert die Sicherung?</div>
    <div class="backup-info-text">
      <p><strong>Automatisch gespeichert:</strong> Deine Dienste und Einsätze werden beim Speichern automatisch lokal auf diesem Gerät abgelegt.</p>
      <p><strong>Sicherung exportieren:</strong> Erstellt zusätzlich eine Sicherungsdatei. Du entscheidest selbst, wo du sie speicherst. Es gibt keinen automatischen Cloud-Upload.</p>
      <p><strong>Sicherung importieren:</strong> Damit kannst du deine Daten nach einem Verlust der lokalen Daten oder auf einem anderen Gerät wiederherstellen.</p>
    </div>
    <button type="button" class="secondary-button" id="backToBackup">Zurück</button>
    <button class="secondary-button">Schließen</button>
  </div>`;
  document.getElementById('backToBackup').onclick = openBackupMenu;
}
function exportBackup() {
  const backup = { version: APP_VERSION, exportedAt: new Date().toISOString(), duties: state.duties, settings: state.settings };
  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `Dienst-Sicherung-${localDateKey(new Date())}.json`);
  localStorage.setItem(BACKUP_DATE_KEY, new Date().toISOString());
  localStorage.removeItem(BACKUP_DISMISSED_KEY);
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
      if (parsed.settings) state.settings = normalizeSettings(parsed.settings);
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
  const rows = [['Dienst', 'Dienstbeginn', 'Dienstende', 'Dienstart', 'Datum', 'Start', 'Ende', 'Minuten', 'Patienten-ID', 'Bemerkung', 'Gerundete Stunden je Dienstart']];
  for (const duty of duties) {
    const rounded = { 'Telefonisch': phoneRoundedHours(duty), 'Im Haus': houseRoundedHours(duty) };
    if (!duty.entries.length) rows.push([fmtShortDate(dutyStart(duty)), fmtTime(dutyStart(duty)), fmtTime(dutyEnd(duty)), '', '', '', '', '0', '', '', '0']);
    for (const entry of [...duty.entries].sort((a, b) => new Date(a.start) - new Date(b.start))) {
      const start = new Date(entry.start);
      const end = new Date(entry.end);
      rows.push([fmtShortDate(dutyStart(duty)), fmtTime(dutyStart(duty)), fmtTime(dutyEnd(duty)), entry.type, fmtShortDate(start), fmtTime(start), `${fmtTime(end)}${localDateKey(start) === localDateKey(end) ? '' : ` (${fmtShortDate(end)})`}`, minutes(entry), entry.patientId || '', entry.note || '', rounded[entry.type]]);
    }
  }
  const csv = '\ufeff' + rows.map(row => row.map(csvEscape).join(';')).join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `Dienst-${selectedMonth.getFullYear()}-${pad(selectedMonth.getMonth() + 1)}.csv`);
}
function printMonthReport() {
  const duties = monthDuties().slice().reverse();
  if (!duties.length) { alert('Für diesen Monat sind keine Dienste vorhanden.'); return; }
  const totals = monthTotals(duties);
  const dutySections = duties.map(duty => {
    const phoneMinutes = sum(duty, 'Telefonisch');
    const houseMinutes = sum(duty, 'Im Haus');
    const entries = [...duty.entries].sort((a, b) => new Date(a.start) - new Date(b.start));
    const entryRows = entries.length ? entries.map(entry => {
      const entryStart = new Date(entry.start);
      const entryEnd = new Date(entry.end);
      return `<tr>
        <td data-label="Art">${escapeHtml(entry.type)}</td>
        <td data-label="Datum">${fmtDate(entryStart)}</td>
        <td data-label="Beginn">${fmtTime(entryStart)}</td>
        <td data-label="Ende">${fmtTime(entryEnd)}</td>
        <td data-label="Dauer">${minutes(entry)} Min.${entry.type === 'Im Haus' ? `<span class="entry-rounded-hours">${hourLabel(roundedHours(minutes(entry)))} gerundet</span>` : ''}</td>
        <td data-label="Patienten-ID">${escapeHtml(entry.patientId || '–')}</td>
        <td data-label="Bemerkung">${escapeHtml(entry.note || '–')}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="7" class="muted">Keine Einsätze erfasst</td></tr>';
    const pay = state.settings.showPay ? dutyPay(duty) : null;
    return `<section class="duty-block">
      <div class="duty-heading"><div><h2>${fmtDate(dutyStart(duty))}</h2><div class="muted">${dutyTimeText(duty)}</div></div><div class="duty-total">${dutyRoundedHours(duty)} Std.</div></div>
      <div class="duty-summary"><span>Telefonisch: <strong>${phoneMinutes} Min. / ${phoneRoundedHours(duty)} Std.</strong></span><span>Im Haus: <strong>${houseMinutes} Min. / ${houseRoundedHours(duty)} Std.</strong></span>${pay ? `<span>Vergütung: <strong>${fmtMoney(pay.total)}</strong></span>` : ''}</div>
      <table class="entries"><thead><tr><th>Art</th><th>Datum</th><th>Beginn</th><th>Ende</th><th>Dauer</th><th>Patienten-ID</th><th>Bemerkung</th></tr></thead><tbody>${entryRows}</tbody></table>
    </section>`;
  }).join('');
  const report = window.open('', '_blank');
  if (!report) { alert('Bitte Pop-ups für den PDF-Bericht erlauben.'); return; }
  const monthPayHtml = state.settings.showPay ? `<div class="box">Vergütung<strong>${fmtMoney(monthPay(duties))}</strong></div>` : '';
  report.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Dienst – ${fmtMonth(selectedMonth)}</title><style>
    *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;margin:0;color:#111;background:#f4f5f7}.toolbar{position:sticky;top:0;z-index:5;display:flex;gap:10px;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:rgba(255,255,255,.94);border-bottom:1px solid #ddd;backdrop-filter:blur(18px)}button{border:0;border-radius:12px;padding:11px 15px;font:inherit;font-weight:700}.back{background:#e9eaed;color:#111}.print{background:#0a84ff;color:#fff}.page{max-width:920px;margin:0 auto;padding:26px 24px 50px;background:#fff;min-height:100vh}h1{margin:0 0 4px}.intro{color:#666;margin:0}.summary{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}.box{border:1px solid #ddd;border-radius:12px;padding:11px 15px;min-width:130px}.box strong{display:block;font-size:21px;margin-top:4px}.duty-block{margin:26px 0;break-inside:avoid-page}.duty-heading{display:flex;justify-content:space-between;gap:15px;align-items:flex-end;border-bottom:2px solid #222;padding-bottom:8px}.duty-heading h2{font-size:18px;margin:0 0 3px}.duty-total{font-size:20px;font-weight:800;white-space:nowrap}.muted{color:#666}.duty-summary{display:flex;flex-wrap:wrap;gap:12px 24px;padding:10px 0;font-size:13px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left;vertical-align:top}th{background:#f3f4f6}.entries{margin-top:3px;max-width:100%;table-layout:fixed}th,td{overflow-wrap:anywhere;word-break:break-word}
    @media(max-width:600px){
      html,body{max-width:100%;overflow-x:hidden}
      .page{width:100%;max-width:100%;padding:20px 12px 42px}
      .toolbar{padding-left:10px;padding-right:10px}
      .toolbar button{min-width:0;padding:10px 12px}
      .summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .box{min-width:0}
      .duty-block{overflow:visible}
      .duty-heading{align-items:flex-start}
      .duty-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
      .entries{display:block;width:100%;min-width:0;table-layout:auto}
      .entries thead{display:none}
      .entries tbody,.entries tr,.entries td{display:block;width:100%}
      .entries tr{margin:10px 0 14px;border:1px solid #e1e2e5;border-radius:12px;overflow:hidden;background:#fff}
      .entries td{display:grid;grid-template-columns:105px minmax(0,1fr);gap:10px;padding:8px 10px;border-bottom:1px solid #ececef;font-size:13px}
      .entries td:last-child{border-bottom:0}
      .entries td::before{content:attr(data-label);font-weight:700;color:#555}
      .entries td[colspan]{display:block;text-align:left}
      .entries td[colspan]::before{content:none}
    }
    @media print{body{background:#fff}.toolbar{display:none!important}.page{max-width:none;padding:0;min-height:0}.duty-block{break-inside:avoid-page}body{margin:0}@page{margin:14mm}}
  </style></head><body><div class="toolbar"><button class="back" id="backBtn" type="button">‹ Zurück zur App</button><button class="print" id="printBtn" type="button">PDF erstellen / Drucken</button></div><main class="page"><h1>Dienst – ${fmtMonth(selectedMonth)}</h1><p class="intro">Monatsbericht · lokal auf dem Gerät erstellt</p><div class="summary"><div class="box">Telefonisch<strong>${totals.phoneHours} Std.</strong></div><div class="box">Im Haus<strong>${totals.houseHours} Std.</strong></div><div class="box">Gesamt<strong>${totals.phoneHours + totals.houseHours} Std.</strong></div>${monthPayHtml}</div>${dutySections}</main><script>
    document.getElementById('printBtn').onclick=()=>window.print();
    document.getElementById('backBtn').onclick=()=>{ if(window.opener){window.close(); setTimeout(()=>{try{window.opener.focus()}catch(e){}},0);} else if(history.length>1){history.back();} else {location.href='./';} };
  <\/script></body></html>`);
  report.document.close();
}

// Beim Zurückkehren aus dem Hintergrund oder nach dem Entsperren aktualisieren.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshTimeSensitiveView(true);
});
window.addEventListener('pageshow', () => refreshTimeSensitiveView(true));
window.addEventListener('focus', () => refreshTimeSensitiveView(true));

// Ein laufender Prozess muss nicht neu gestartet werden, wenn eine Dienstgrenze
// (07:15 / 08:30) überschritten wird. Ein kurzer, lokaler Check genügt.
setInterval(() => refreshTimeSensitiveView(false), 30000);

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


// Version 6.1: Aktion-Menüs durch Tippen auf den abgedunkelten Hintergrund schließen.
modal.addEventListener('click', event => {
  if (event.target === modal && modal.classList.contains('action-sheet-open')) {
    modal.close();
  }
});
modal.addEventListener('close', () => {
  stopPatientKamera();
  modal.classList.remove('action-sheet-open');
  modal.classList.remove('duty-date-dialog');
});


let patientPhotoStream = null;
let patientPhotoTempImage = '';
let patientPhotoCrop = { x: .08, y: .36, w: .84, h: .28 };
let patientPhotoDrag = null;

function patientPhotoUi() {
  let d = document.getElementById('patientPhotoCamera');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'patientPhotoCamera';
  d.className = 'patient-photo-camera';
  d.innerHTML = `
    <div class="pp-camera">
      <div class="pp-head"><button type="button" id="ppClose" aria-label="Schließen">×</button><strong>Patienten-ID fotografieren</strong><span></span></div>
      <div class="pp-video-wrap"><video id="ppVideo" autoplay playsinline muted></video></div>
      <p class="pp-help">Die Patienten-ID gut sichtbar fotografieren. Den genauen Ausschnitt legst du anschließend selbst fest.</p>
      <button type="button" id="ppTake" class="primary">Foto aufnehmen</button>
    </div>`;
  document.body.appendChild(d);
  d.querySelector('#ppClose').onclick = closePatientPhotoCamera;
  d.querySelector('#ppTake').onclick = takePatientPhoto;
  return d;
}

async function openPatientPhotoCamera() {
  const d = patientPhotoUi();
  const video = d.querySelector('#ppVideo');
  try {
    patientPhotoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal:'environment' }, width:{ideal:1920}, height:{ideal:1080} },
      audio:false
    });
    video.srcObject = patientPhotoStream;
    d.showModal();
    await video.play();
  } catch (e) {
    console.error(e);
    alert('Die Kamera konnte nicht geöffnet werden. Bitte den Kamerazugriff für diese Webseite erlauben.');
  }
}

function closePatientPhotoCamera() {
  if (patientPhotoStream) patientPhotoStream.getTracks().forEach(t => t.stop());
  patientPhotoStream = null;
  const d=document.getElementById('patientPhotoCamera');
  if (d?.open) d.close();
}

function takePatientPhoto() {
  const video=document.getElementById('ppVideo');
  if (!video?.videoWidth) return;
  const canvas=document.createElement('canvas');
  const factor=Math.min(1,1600/video.videoWidth);
  canvas.width=Math.round(video.videoWidth*factor);
  canvas.height=Math.round(video.videoHeight*factor);
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  patientPhotoTempImage=canvas.toDataURL('image/jpeg',.78);
  closePatientPhotoCamera();
  openPatientPhotoCrop();
}

function patientPhotoCropUi() {
  let d = document.getElementById('patientPhotoCrop');
  if (d) return d;

  d = document.createElement('dialog');
  d.id = 'patientPhotoCrop';
  d.className = 'patient-photo-crop';
  d.innerHTML = `
    <div class="pp-crop-shell">
      <div class="pp-head pp-crop-head">
        <button type="button" id="ppCropCancel">Abbrechen</button>
        <strong>Ausschnitt festlegen</strong>
        <button type="button" id="ppCropSave">Übernehmen</button>
      </div>
      <p class="pp-help">
        Verschiebe den weißen Rahmen auf die Patienten-ID. Die Eckpunkte lassen sich zum Verkleinern oder Vergrößern ziehen.
      </p>
      <div id="ppStage" class="pp-stage">
        <img id="ppImage" alt="">
        <div id="ppBox" class="pp-box" aria-label="Auswahlrahmen">
          <i data-h="tl"></i><i data-h="tr"></i><i data-h="bl"></i><i data-h="br"></i>
        </div>
      </div>
      <p class="pp-help pp-crop-hint">
        Der Rahmen bleibt vollständig innerhalb des aufgenommenen Fotos. Gespeichert wird nur der ausgewählte Ausschnitt.
      </p>
    </div>`;

  document.body.appendChild(d);

  const stage = d.querySelector('#ppStage');
  const img = d.querySelector('#ppImage');
  const box = d.querySelector('#ppBox');

  const imageRectInStage = () => {
    const sr = stage.getBoundingClientRect();
    if (!img.naturalWidth || !img.naturalHeight || !sr.width || !sr.height) {
      return { left: 0, top: 0, width: sr.width || 1, height: sr.height || 1 };
    }

    const imageAspect = img.naturalWidth / img.naturalHeight;
    const stageAspect = sr.width / sr.height;

    let width, height, left, top;
    if (imageAspect > stageAspect) {
      width = sr.width;
      height = width / imageAspect;
      left = 0;
      top = (sr.height - height) / 2;
    } else {
      height = sr.height;
      width = height * imageAspect;
      top = 0;
      left = (sr.width - width) / 2;
    }
    return { left, top, width, height };
  };

  const render = () => {
    const ir = imageRectInStage();
    box.style.left = `${ir.left + patientPhotoCrop.x * ir.width}px`;
    box.style.top = `${ir.top + patientPhotoCrop.y * ir.height}px`;
    box.style.width = `${patientPhotoCrop.w * ir.width}px`;
    box.style.height = `${patientPhotoCrop.h * ir.height}px`;
  };

  const normalizedPoint = (clientX, clientY) => {
    const sr = stage.getBoundingClientRect();
    const ir = imageRectInStage();
    return {
      x: Math.max(0, Math.min(1, (clientX - sr.left - ir.left) / Math.max(1, ir.width))),
      y: Math.max(0, Math.min(1, (clientY - sr.top - ir.top) / Math.max(1, ir.height)))
    };
  };

  const beginDrag = (clientX, clientY, handle, pointerId = null) => {
    const p = normalizedPoint(clientX, clientY);
    patientPhotoDrag = {
      h: handle || 'move',
      x: p.x,
      y: p.y,
      r: { ...patientPhotoCrop },
      pointerId
    };
  };

  const updateDrag = (clientX, clientY) => {
    if (!patientPhotoDrag) return;
    const p = normalizedPoint(clientX, clientY);
    const q = patientPhotoDrag;
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const r = q.r;
    const minW = 0.12;
    const minH = 0.06;

    let left = r.x;
    let top = r.y;
    let right = r.x + r.w;
    let bottom = r.y + r.h;

    if (q.h === 'move') {
      left = Math.max(0, Math.min(1 - r.w, r.x + dx));
      top = Math.max(0, Math.min(1 - r.h, r.y + dy));
      patientPhotoCrop = { x: left, y: top, w: r.w, h: r.h };
    } else {
      if (q.h.includes('l')) left = Math.max(0, Math.min(right - minW, r.x + dx));
      if (q.h.includes('r')) right = Math.min(1, Math.max(left + minW, r.x + r.w + dx));
      if (q.h.includes('t')) top = Math.max(0, Math.min(bottom - minH, r.y + dy));
      if (q.h.includes('b')) bottom = Math.min(1, Math.max(top + minH, r.y + r.h + dy));
      patientPhotoCrop = { x: left, y: top, w: right - left, h: bottom - top };
    }
    render();
  };

  box.addEventListener('pointerdown', (e) => {
    const handle = e.target?.dataset?.h || 'move';
    beginDrag(e.clientX, e.clientY, handle, e.pointerId);
    try { box.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });

  box.addEventListener('pointermove', (e) => {
    if (!patientPhotoDrag || patientPhotoDrag.pointerId !== e.pointerId) return;
    updateDrag(e.clientX, e.clientY);
    e.preventDefault();
  });

  const finishPointer = (e) => {
    if (!patientPhotoDrag) return;
    try { box.releasePointerCapture(e.pointerId); } catch (_) {}
    patientPhotoDrag = null;
  };

  box.addEventListener('pointerup', finishPointer);
  box.addEventListener('pointercancel', finishPointer);

  box.addEventListener('touchstart', (e) => {
    if (!e.touches?.length) return;
    const t = e.touches[0];
    beginDrag(t.clientX, t.clientY, e.target?.dataset?.h || 'move', 'touch');
    e.preventDefault();
  }, { passive: false });

  box.addEventListener('touchmove', (e) => {
    if (!patientPhotoDrag || patientPhotoDrag.pointerId !== 'touch' || !e.touches?.length) return;
    const t = e.touches[0];
    updateDrag(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });

  box.addEventListener('touchend', () => { patientPhotoDrag = null; }, { passive: false });
  box.addEventListener('touchcancel', () => { patientPhotoDrag = null; }, { passive: false });

  d.querySelector('#ppCropCancel').onclick = () => {
    patientPhotoTempImage = '';
    patientPhotoDrag = null;
    d.close();
  };
  d.querySelector('#ppCropSave').onclick = savePatientPhotoCrop;

  d._render = render;
  window.addEventListener('resize', render);
  return d;
}

function openPatientPhotoCrop() {
  const d=patientPhotoCropUi(), img=d.querySelector('#ppImage');
  patientPhotoCrop={x:.18,y:.40,w:.64,h:.18};
  img.src=patientPhotoTempImage;
  img.onload=()=>d._render();
  d.showModal();
}

function savePatientPhotoCrop() {
  const d = document.getElementById('patientPhotoCrop');
  const img = d?.querySelector('#ppImage');
  if (!d || !img?.naturalWidth || !img?.naturalHeight) return;

  // patientPhotoCrop is now defined directly in image coordinates (0..1).
  const sx = Math.round(patientPhotoCrop.x * img.naturalWidth);
  const sy = Math.round(patientPhotoCrop.y * img.naturalHeight);
  const sw = Math.max(1, Math.round(patientPhotoCrop.w * img.naturalWidth));
  const sh = Math.max(1, Math.round(patientPhotoCrop.h * img.naturalHeight));

  const out = document.createElement('canvas');
  const scale = Math.min(1, 700 / sw);
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));

  const ctx = out.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);

  const data = out.toDataURL('image/jpeg', .62);
  const input = document.getElementById('entryPatientIdPhoto');
  const preview = document.getElementById('entryPatientIdPhotoPreview');
  const wrap = document.getElementById('entryPatientIdPhotoPreviewWrap');

  if (input) input.value = data;
  if (preview) preview.src = data;
  if (wrap) wrap.hidden = false;

  patientPhotoTempImage = '';
  d.close();
}

function showPatientPhoto(src) {
  let d=document.getElementById('ppViewer');
  if(!d){
    d=document.createElement('dialog'); d.id='ppViewer'; d.className='pp-viewer';
    d.innerHTML=`<div><button type="button" id="ppViewerClose">×</button><img id="ppViewerImg" alt="Patienten-ID"></div>`;
    document.body.appendChild(d);
    d.querySelector('#ppViewerClose').onclick=()=>d.close();
  }
  d.querySelector('#ppViewerImg').src=src; d.showModal();
}

document.addEventListener('click', e => {
  const viewButton = e.target.closest?.('.entry-photo-link');
  if (viewButton) {
    e.preventDefault();
    e.stopPropagation();
    const duty = state.duties.find(item => item.id === viewButton.dataset.photoDuty);
    const entry = duty?.entries.find(item => item.id === viewButton.dataset.photoEntry);
    if (entry?.patientIdPhoto) showPatientPhoto(entry.patientIdPhoto);
    return;
  }
  if (e.target?.id === 'removePatientIdPhoto') {
    const input = document.getElementById('entryPatientIdPhoto');
    const preview = document.getElementById('entryPatientIdPhotoPreview');
    const wrap = document.getElementById('entryPatientIdPhotoPreviewWrap');
    if (input) input.value = '';
    if (preview) preview.removeAttribute('src');
    if (wrap) wrap.hidden = true;
  }
});

