'use strict';

const STORAGE_KEY = 'dienst-webapp-v1';
const BACKUP_DATE_KEY = 'dienst-last-backup';
const BACKUP_REMINDER_DAYS = 30;
const BACKUP_DISMISSED_KEY = 'dienst-backup-reminder-dismissed';
const APP_VERSION = '7.52';
const TARIFF_GROUPS = Object.freeze({
  I: { label: 'Ärztin/Arzt (Assistenzarzt)', stages: 6 },
  II: { label: 'Fachärztin/Facharzt', stages: 6 },
  III: { label: 'Oberärztin/Oberarzt', stages: 3 },
  IV: { label: 'Leitende Oberärztin/Leitender Oberarzt', stages: 2 }
});
function normalizeTariffGroup(value) { return Object.hasOwn(TARIFF_GROUPS, value) ? value : 'II'; }
function normalizeTariffStage(group, value) { const stage = Number(value); return Number.isInteger(stage) && stage >= 1 && stage <= TARIFF_GROUPS[normalizeTariffGroup(group)].stages ? stage : 1; }
function tariffGroupOptions(selected) { return Object.entries(TARIFF_GROUPS).map(([id, group]) => `<option value="${id}" ${id === normalizeTariffGroup(selected) ? 'selected' : ''}>Gruppe ${id} · ${group.label}</option>`).join(''); }
function tariffStageOptions(group, selected) { const normalizedGroup = normalizeTariffGroup(group), normalizedStage = normalizeTariffStage(normalizedGroup, selected); return Array.from({ length: TARIFF_GROUPS[normalizedGroup].stages }, (_, index) => { const stage = index + 1; return `<option value="${stage}" ${stage === normalizedStage ? 'selected' : ''}>Stufe ${stage}</option>`; }).join(''); }
const DEFAULT_DUTY_TIMES = {
  0: { start: '10:30', end: '07:15' }, // Sonntag
  1: { start: '15:45', end: '07:15' }, // Montag
  2: { start: '15:45', end: '07:15' }, // Dienstag
  3: { start: '15:45', end: '07:15' }, // Mittwoch
  4: { start: '15:45', end: '07:15' }, // Donnerstag
  5: { start: '15:45', end: '08:30' }, // Freitag
  6: { start: '10:30', end: '08:30' }  // Samstag
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
    return parsed && Array.isArray(parsed.duties) ? migrateState(parsed) : { duties: [], settings: normalizeSettings() };
  } catch {
    return { duties: [], settings: normalizeSettings() };
  }
}
function migrateState(data) {
  const settings=normalizeSettings(data.settings);
  return {...data,settings,duties:data.duties.map(duty=>{
    const day=parseLocalDate(duty.date).getDay();
    const schedule=settings.showCustomDutyTimes?settings.dutyTimes[day]:DEFAULT_DUTY_TIMES[day];
    return {...duty,schedule:duty.schedule || {...schedule}};
  })};
}
function normalizeSettings(settings = {}) {
  settings = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  const workHourlyRate = Number.isFinite(Number(settings.workHourlyRate)) ? Number(settings.workHourlyRate) : 50.96;
  const allowanceHourlyRate = Number.isFinite(Number(settings.allowanceHourlyRate)) ? Number(settings.allowanceHourlyRate) : 43.42;
  let rateHistory = Array.isArray(settings.rateHistory) ? settings.rateHistory
    .filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(item.validFrom) && Number.isFinite(Number(item.workHourlyRate)) && Number.isFinite(Number(item.allowanceHourlyRate)))
    .map(item => { const tariffGroup = normalizeTariffGroup(item.tariffGroup || settings.tariffGroup); return { ...item, validFrom: item.validFrom, workHourlyRate: Number(item.workHourlyRate), allowanceHourlyRate: Number(item.allowanceHourlyRate), tariffGroup, tariffStage: normalizeTariffStage(tariffGroup, item.tariffStage ?? settings.tariffStage) }; }) : [];
  if (!rateHistory.length) rateHistory = [{ validFrom: '1900-01-01', workHourlyRate, allowanceHourlyRate, tariffGroup: normalizeTariffGroup(settings.tariffGroup), tariffStage: normalizeTariffStage(settings.tariffGroup, settings.tariffStage) }];
  // Nutzerkorrektur 10.10.2026: Feiertagsarbeit erfolgt MIT Freizeitausgleich.
  // Einmalige Migration; Stundenwerte, Gültigkeitsdaten und andere Tarifdaten bleiben erhalten.
  const applyHolidayCorrection = settings.holidayRuleVersion !== 2;
  if (applyHolidayCorrection) rateHistory = rateHistory.map(item => ({...item, holidayTimeOff:'yes'}));
  // Abrechnung August 2026 bestätigt II/1 und diese drei Stundenwerte.
  // Nur eine fehlende Periode ergänzen; vorhandene Tarifhistorie niemals ersetzen.
  if (settings.tariffProfileVersion !== 1 && !rateHistory.some(item => item.validFrom >= '2026-03-01')) {
    const prior=rateHistory.at(-1);
    if(prior.workHourlyRate===50.96 && prior.allowanceHourlyRate===43.42) {
      rateHistory.push({validFrom:'2026-03-01',workHourlyRate:50.96,allowanceHourlyRate:43.42,
        supplementBaseRate:50.26,holidayTimeOff:'yes',tariffGroup:'II',tariffStage:1,ratesConfirmed:true,
        source:'Gehaltsabrechnung bestätigt, Stufe 1'});
    }
  }
  // Korrektur 7.44: Ältere Installationen konnten die bestätigte März-Periode
  // wegen einer bereits gesetzten Profilversion noch nicht erhalten. Ergänzt wird
  // ausschließlich das belegte Profil II/1 mit den identischen Stundenwerten.
  // Abweichende oder ausdrücklich angelegte Tarifperioden bleiben unangetastet.
  const applyAugust2026Correction=settings.august2026RateCorrectionVersion!==1;
  if(applyAugust2026Correction) {
    const augustDate='2026-08-01';
    const applicable=rateHistory.filter(item=>item.validFrom<=augustDate).at(-1);
    const profileIsConfirmedII1=applicable && normalizeTariffGroup(applicable.tariffGroup||settings.tariffGroup)==='II' && normalizeTariffStage('II',applicable.tariffStage ?? settings.tariffStage)===1;
    const valuesMatch=applicable && applicable.workHourlyRate===50.96 && applicable.allowanceHourlyRate===43.42;
    const hasMarch2026Period=rateHistory.some(item=>item.validFrom>='2026-03-01'&&item.validFrom<=augustDate);
    if(profileIsConfirmedII1 && valuesMatch && !hasMarch2026Period) {
      rateHistory.push({validFrom:'2026-03-01',workHourlyRate:50.96,allowanceHourlyRate:43.42,supplementBaseRate:50.26,holidayTimeOff:'yes',tariffGroup:'II',tariffStage:1,ratesConfirmed:true,source:'Gehaltsabrechnung August 2026 bestätigt'});
    } else if(profileIsConfirmedII1 && valuesMatch && (!(Number(applicable.supplementBaseRate)>0) || !applicable.ratesConfirmed)) {
      const index=rateHistory.indexOf(applicable);
      rateHistory[index]={...applicable,supplementBaseRate:50.26,holidayTimeOff:'yes',ratesConfirmed:true,source:applicable.source||'Gehaltsabrechnung August 2026 bestätigt'};
    }
  }
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
    ...settings,
    holidayRuleVersion: 2,
    tariffProfileVersion: 1,
    august2026RateCorrectionVersion: 1,
    tariffGroup: normalizeTariffGroup(latest.tariffGroup || settings.tariffGroup),
    tariffStage: normalizeTariffStage(latest.tariffGroup || settings.tariffGroup, latest.tariffStage ?? settings.tariffStage),
    employmentFraction: Number(settings.employmentFraction)>0 && Number(settings.employmentFraction)<=1 ? Number(settings.employmentFraction) : null,
    showPay: Boolean(settings.showPay),
    showTimeline: Boolean(settings.showTimeline),
    showCustomDutyTimes: Boolean(settings.showCustomDutyTimes),
    dutyTimes,
    workHourlyRate: latest.workHourlyRate,
    allowanceHourlyRate: latest.allowanceHourlyRate,
    rateHistory,
    supplementBaseRate: Number(latest.supplementBaseRate) > 0 ? Number(latest.supplementBaseRate) : null,
    holidayTimeOff: applyHolidayCorrection ? 'yes' : ['yes','no','unknown'].includes(settings.holidayTimeOff) ? settings.holidayTimeOff : 'yes',
    payroll: settings.payroll && typeof settings.payroll === 'object' && !Array.isArray(settings.payroll) ? settings.payroll : {}
  };
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch(error) { alert('Speichern fehlgeschlagen: Der lokale Speicher ist voll oder nicht verfügbar. Exportiere sofort eine Sicherung; die zuletzt eingegebenen Daten sind nur in dieser geöffneten App vorhanden.'); throw error; }
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
  if(duty.startOverride) return new Date(duty.startOverride);
  const date = parseLocalDate(duty.date);
  const schedule = duty.schedule ? {startHour:timeParts(duty.schedule.start).hour,startMinute:timeParts(duty.schedule.start).minute} : dutySchedule(duty.date);
  date.setHours(schedule.startHour, schedule.startMinute, 0, 0);
  return date;
}
function dutyEnd(duty) {
  if(duty.endOverride) return new Date(duty.endOverride);
  const date = parseLocalDate(duty.date);
  const schedule = duty.schedule ? {endHour:timeParts(duty.schedule.end).hour,endMinute:timeParts(duty.schedule.end).minute} : dutySchedule(duty.date);
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
function isOpenHouseEntry(entry) { return entry?.type === 'Im Haus' && !entry.end; }
function openHouseEntry(duty) { return (duty?.entries || []).find(isOpenHouseEntry) || null; }
function minutes(entry) {
  if (!entry?.start || !entry?.end) return 0;
  return Math.max(0, Math.round((new Date(entry.end) - new Date(entry.start)) / 60000));
}
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
function easterSunday(year) { const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return new Date(year,Math.floor(n/31)-1,n%31+1); }
function isNrwHoliday(date) { const key=localDateKey(date);if(['01-01','05-01','10-03','11-01','12-25','12-26'].includes(key.slice(5)))return true;const e=easterSunday(date.getFullYear());return [-2,1,39,50,60].some(n=>localDateKey(new Date(e.getFullYear(),e.getMonth(),e.getDate()+n))===key); }
function dutyAllowanceMultiplier(duty) { const date=parseLocalDate(duty.date),day=date.getDay(); return day===0||day===6||isNrwHoliday(date)?4:2; }
function ratesForDuty(duty) {
  const settings = state.settings || normalizeSettings();
  const history = Array.isArray(settings.rateHistory) && settings.rateHistory.length ? settings.rateHistory : [{ validFrom: '1900-01-01', workHourlyRate: settings.workHourlyRate, allowanceHourlyRate: settings.allowanceHourlyRate }];
  const applicable = history.filter(item => item.validFrom <= duty.date).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  return applicable || { validFrom: duty.date, workHourlyRate: 0, allowanceHourlyRate: 0, missing: true };
}
// Eine einzige Engine für Übersicht, Einzelvergütung, Export und Abgleich.
// Referenzwerte der AVR-Anlage 30, NRW, 40 Stunden. Eine Auswahl ersetzt keine
// bereits gespeicherte Tarifperiode; die Werte werden erst nach dem Speichern übernommen.
const TARIFF_REFERENCE = [
  {validFrom:'2025-11-01', monthly:{I:{1:5499.85,3:6034.28},II:{1:7258.93,3:8401.96}}},
  {validFrom:'2025-12-01', monthly:{I:{1:5609.85,3:6154.97},II:{1:7404.11,3:8570.00}}},
  {validFrom:'2026-03-01', monthly:{
    I:{1:5722.05,2:6046.42,3:6278.07,4:6679.58,5:7158.37,6:7355.29},
    II:{1:7552.19,2:8185.40,3:8741.40,4:9065.74,5:9382.33,6:9698.91},
    III:{1:9459.56,2:10015.53,3:10810.95},
    IV:{1:11127.50,2:11922.95}
  }}
];
function referenceRates(date, group, stage = 1) {
  const normalizedGroup=normalizeTariffGroup(group), normalizedStage=normalizeTariffStage(normalizedGroup, stage);
  const period=TARIFF_REFERENCE.filter(p=>p.validFrom<=date).at(-1), monthly=period?.monthly?.[normalizedGroup];
  if(!monthly || !monthly[normalizedStage] || date>'2026-12-31') return null;
  const divisor=40*4.348, allowance=monthly[normalizedStage]/divisor, stage3=monthly[3];
  if(!stage3) return {allowanceHourlyRate:allowance,workHourlyRate:null,supplementBaseRate:null,incompleteReason:'Für Gruppe IV ist in der AVR-Tabelle keine Stufe 3 ausgewiesen. Die Zuschlags-Bemessungsgrundlage wird deshalb nicht automatisch behauptet.'};
  const base=stage3/divisor;
  return {workHourlyRate: allowance+base*.15, allowanceHourlyRate:allowance, supplementBaseRate:base};
}
function cents(value) { return Math.round((value+Number.EPSILON)*100)/100; }
function eachWorkMinute(duty, callback) {
  for(const entry of duty.entries || []) {
    const start=new Date(entry.start).getTime(), end=new Date(entry.end).getTime();
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start) continue;
    for(let t=start;t<end;) {
      const next=Math.min(end,Math.floor(t/60000)*60000+60000);
      callback(new Date(t),(next-t)/60000,entry);
      t=next;
    }
  }
}
function minuteRules(d) {
  const modern=localDateKey(d)>='2025-10-01', clock=d.getHours()*60+d.getMinutes();
  return {night:clock>=(modern?1200:1260)||clock<360, nightRate:modern?.20:.15,
    midnight:clock<360 && localDateKey(d)>='2022-07-01',
    saturday:d.getDay()===6&&clock>=780&&clock<(modern?1200:1260), modern,
    sunday:d.getDay()===0, holiday:isNrwHoliday(d),
    specialDecember:d.getMonth()===11&&[24,31].includes(d.getDate())&&clock>=360};
}
function actualMinuteBuckets(duty) {
  const buckets={actual:0,night:0,midnight:0,saturday:0,sunday:0,holiday:0,specialDecember:0};
  eachWorkMinute(duty,(d,m)=>{const rules=minuteRules(d);buckets.actual+=m;
    for(const key of Object.keys(buckets)) if(key!=='actual'&&rules[key]) buckets[key]+=m;
  });
  return buckets;
}
function rbTier(duty, context=state.duties) {
  const month=duty.date.slice(0,7), saved=state.settings.payroll[month]||{};
  const list=context.filter(d=>d.date.slice(0,7)===month).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const ordinal=list.findIndex(d=>d.id===duty.id)+1;
  const fraction=ratesForDuty(duty).employmentFraction || state.settings.employmentFraction;
  const threshold=fraction ? Math.round(13*fraction) : 13;
  const percentage=duty.date>='2022-07-01'&&ordinal>threshold ? .10*(1+Math.floor((ordinal-threshold-1)/3)) : 0;
  const reasons=[];
  if(!fraction) reasons.push('Beschäftigungsumfang für RB-Staffelung ungeklärt');
  if(!saved.complete) reasons.push('Monat für RB-Staffelung noch nicht als vollständig bestätigt');
  if(list.some(d=>(dutyEnd(d)-dutyStart(d))/3600000>24)) reasons.push('Dienst über 24 Stunden: tarifliche Anzahl der Rufbereitschaften ungeklärt');
  return {ordinal,threshold,percentage,confirmed:!reasons.length,reasons};
}
function dutyPay(duty, context=state.duties) {
  const rates=ratesForDuty(duty), hours=dutyRoundedHours(duty), buckets=actualMinuteBuckets(duty);
  const reasons=[], completedEntries=(duty.entries||[]).filter(entry=>!isOpenHouseEntry(entry));
  if(openHouseEntry(duty)) reasons.push('Laufender Hauseinsatz wird erst nach dem Beenden vergütet');
  const entryDetails=completedEntries.map(entry=>({id:entry.id,type:entry.type,
    hours:entry.type==='Im Haus'?roundedHours(minutes(entry)):sum(duty,'Telefonisch')?phoneRoundedHours(duty)*minutes(entry)/sum(duty,'Telefonisch'):0,
    hoursPay:0,supplements:{night:0,saturday:0,sunday:0,holiday:0,specialDecember:0},specialRB:0,rbTimeExtras:0,tierPay:0,total:0}));
  const detailsById=new Map(entryDetails.map(e=>[e.id,e]));
  const supplements={night:0,saturday:0,sunday:0,holiday:0,specialDecember:0};
  const midnightByEntry=new Map(), workPeriods=new Map();
  eachWorkMinute(duty,(d,m,entry)=>{
    const r=ratesForDuty({date:localDateKey(d)}), rules=minuteRules(d), detail=detailsById.get(entry.id);
    if(r.missing) reasons.push('Historischer Stundenwert fehlt');
    if(!r.ratesConfirmed) reasons.push('Gespeicherte Stundenwerte / Eingruppierung noch nicht bestätigt');
    if(localDateKey(d)>'2026-12-31') reasons.push('Tarifstand ab 2027 noch nicht verifiziert');
    const periodKey=entry.id+'|'+r.validFrom;
    const period=workPeriods.get(periodKey)||{detail,minutes:0,rate:r.workHourlyRate};period.minutes+=m;workPeriods.set(periodKey,period);
    const base=Number(r.supplementBaseRate)>0?Number(r.supplementBaseRate):null;
    const timeOff=r.holidayTimeOff==='no'?'no':r.holidayTimeOff==='unknown'?'unknown':'yes';
    const part={night:0,saturday:0,sunday:0,holiday:0,specialDecember:0};
    if(base && rules.night) part.night=m/60*base*rules.nightRate;
    if(!base&&(rules.night||rules.sunday||rules.holiday||rules.specialDecember||(rules.saturday&&rules.modern))) reasons.push('Historische Bemessungsgrundlage der Zeitzuschläge fehlt');
    const candidates=[];
    if(rules.saturday) candidates.push(['saturday',rules.modern?(base||0)*.20:.64]);
    if(rules.sunday) candidates.push(['sunday',(base||0)*.25]);
    if(rules.holiday) {
      if(timeOff==='unknown') { reasons.push('Feiertags-Freizeitausgleich ungeklärt'); candidates.length=0; }
      else candidates.push(['holiday',(base||0)*(timeOff==='yes'?.35:1.35)]);
    }
    if(rules.specialDecember && !(rules.holiday&&timeOff==='unknown')) candidates.push(['specialDecember',(base||0)*.35]);
    if(candidates.length) {const [kind,value]=candidates.reduce((a,b)=>b[1]>a[1]?b:a);part[kind]+=m/60*value;}
    for(const key of Object.keys(part)){detail.supplements[key]+=part[key];supplements[key]+=part[key];}
    if(rules.midnight) {
      const item=midnightByEntry.get(entry.id)||{minutes:0,work:0,extras:0,rate:r.workHourlyRate};
      item.minutes+=m;item.work+=m/60*r.workHourlyRate;item.extras+=Object.values(part).reduce((a,b)=>a+b,0);midnightByEntry.set(entry.id,item);
    }
  });
  // Rundungsstunden werden bei Tarifwechsel anteilig nach echten Einsatzminuten verteilt.
  // Diese Aufteilung ist bei Grenzfällen vorläufig und wird ausdrücklich gekennzeichnet.
  for(const period of workPeriods.values()) {
    const entry=duty.entries.find(e=>e.id===period.detail.id), duration=(new Date(entry.end)-new Date(entry.start))/60000;
    period.detail.hoursPay+=duration>0?period.detail.hours*period.minutes/duration*period.rate:0;
  }
  if(new Set([...workPeriods.values()].map(p=>p.rate)).size>1) reasons.push('Tarifwechsel innerhalb eines Dienstes: Aufteilung der Rundungsstunden vorläufig');
  const hoursPay=entryDetails.reduce((a,e)=>a+e.hoursPay,0), multiplier=dutyAllowanceMultiplier(duty);
  const duration=(dutyEnd(duty)-dutyStart(duty))/3600000;
  const allowanceFactor=duration<12?Math.ceil(duration)*.125:multiplier;
  const allowance=allowanceFactor*rates.allowanceHourlyRate;
  if(rates.missing) reasons.push('Historischer Pauschalenwert fehlt');
  if(!rates.ratesConfirmed) reasons.push('Gespeicherte Stundenwerte / Eingruppierung noch nicht bestätigt');
  if(duration>24) reasons.push('Dienst über 24 Stunden: Pauschalenanzahl ungeklärt; bisherige Starttagspauschale als Vergleichswert');
  if(duty.date>'2026-12-31') reasons.push('Tarifstand ab 2027 noch nicht verifiziert');
  const midnightRatedMinutes=buckets.midnight>0?Math.max(60,buckets.midnight):0;
  // Die geprüfte Abrechnung rundet die bewerteten 50%-Stunden je Einsatz auf
  // zwei Dezimalstellen, bevor der Stundenwert angewandt wird (AiRB-Lohnart).
  // Zeitzuschlagszeiten bleiben davon unberührt.
  const midnightScale=buckets.midnight>0?midnightRatedMinutes/buckets.midnight:0;
  let specialRB=0;
  for(const detail of entryDetails) {
    const night=midnightByEntry.get(detail.id);
    if(night) detail.specialRB=cents(cents(.5*night.work*midnightScale/night.rate)*night.rate);
    specialRB+=detail.specialRB;
  }
  // Lohnarten der geprüften Abrechnung: Zusatz AiRB (2029) führt den
  // 50%-Überstundenanteil; 50%-Zeitanteile bleiben bei Nacht/Sonntag/Feiertag.
  const specialRBSupplements={night:0,saturday:0,sunday:0,holiday:0,specialDecember:0};
  eachWorkMinute(duty,(d,m,entry)=>{
    if(!minuteRules(d).midnight)return;
    const r=ratesForDuty({date:localDateKey(d)}), base=Number(r.supplementBaseRate)>0?Number(r.supplementBaseRate):0;
    const rules=minuteRules(d), detail=detailsById.get(entry.id), candidates=[];
    if(base){const value=m/60*base*rules.nightRate*.5;detail.supplements.night+=value;detail.rbTimeExtras+=value;supplements.night+=value;specialRBSupplements.night+=value;}
    if(rules.sunday && !(rules.holiday && r.holidayTimeOff==='unknown'))candidates.push(['sunday',base*.25]);
    if(rules.holiday && r.holidayTimeOff!=='unknown')candidates.push(['holiday',base*(r.holidayTimeOff==='no'?1.35:.35)]);
    if(candidates.length){const [kind,rate]=candidates.reduce((a,b)=>b[1]>a[1]?b:a);const value=m/60*rate*.5;detail.supplements[kind]+=value;detail.rbTimeExtras+=value;supplements[kind]+=value;specialRBSupplements[kind]+=value;}
  });
  const extra=Object.values(supplements).reduce((a,b)=>a+b,0), tier=rbTier(duty,context);
  if(tier.percentage) reasons.push(...tier.reasons);
  const tierBasis=allowance+hoursPay+extra-Object.values(specialRBSupplements).reduce((a,b)=>a+b,0);
  const tierPay=tier.confirmed?tier.percentage*tierBasis:0;
  for(const detail of entryDetails) {
    const extras=Object.values(detail.supplements).reduce((a,b)=>a+b,0);
    detail.tierPay=tier.confirmed?tier.percentage*(detail.hoursPay+extras-detail.rbTimeExtras):0;
    detail.total=detail.hoursPay+extras+detail.specialRB+detail.tierPay;
  }
  const incompleteReasons=[...new Set(reasons)], total=hoursPay+allowance+specialRB+extra+tierPay;
  return {hours,hoursPay,multiplier:allowanceFactor,allowance,total,rates,buckets,midnightRatedMinutes,specialRB,specialRBSupplements,supplements,tier,tierPay,entryDetails,
    incomplete:incompleteReasons.length>0,incompleteReasons};
}
function monthPay(duties) { return monthPayDetails(duties).total; }
function monthPayDetails(duties) {
  const result={actual:0,hours:0,hoursPay:0,allowance:0,specialRB:0,tierPay:0,total:0,incomplete:false,incompleteReasons:[],
    supplements:{night:0,saturday:0,sunday:0,holiday:0,specialDecember:0}};
  for(const duty of duties){const p=dutyPay(duty);result.actual+=p.buckets.actual;result.hours+=p.hours;
    for(const key of ['hoursPay','allowance','specialRB','tierPay']) result[key]+=p[key];
    for(const key of Object.keys(result.supplements)) result.supplements[key]+=p.supplements[key];
    result.incomplete ||= p.incomplete; result.incompleteReasons.push(...p.incompleteReasons);
  }
  for(const key of ['hoursPay','allowance','specialRB','tierPay']) result[key]=cents(result[key]);
  for(const key of Object.keys(result.supplements)) result.supplements[key]=cents(result.supplements[key]);
  result.total=cents(result.hoursPay+result.allowance+result.specialRB+result.tierPay+Object.values(result.supplements).reduce((a,b)=>a+b,0));
  result.incompleteReasons=[...new Set(result.incompleteReasons)];return result;
}
// Soll-Ist-Abgleich basiert ausschließlich auf monthPayDetails / dutyPay.
function payrollRows(monthDutiesList) {
  const m = monthPayDetails(monthDutiesList);
  return [
    ['hours', 'Vergütete Einsatzstunden', m.hours, 'h'],
    ['hoursPay', 'Einsatzvergütung', m.hoursPay, '€'],
    ['allowance', 'Rufbereitschaftspauschalen', m.allowance, '€'],
    ['night', 'Nachtzuschlag', m.supplements.night, '€'],
    ['specialRB', 'RB-Zuschlag 00–06', m.specialRB, '€'],
    ['tierPay', 'RB-Staffelzuschlag', m.tierPay, '€'],
    ['saturday', 'Samstag', m.supplements.saturday, '€'],
    ['sunday', 'Sonntag', m.supplements.sunday, '€'],
    ['holiday', 'Feiertag', m.supplements.holiday, '€'],
    ['specialDecember', '24./31. Dezember', m.supplements.specialDecember, '€'],
    ['total', 'Gesamt (berechenbare Positionen)', m.total, '€']
  ];
}
function payrollMonthKey(month) { return `${month.getFullYear()}-${pad(month.getMonth()+1)}`; }
function payrollDefaultPaymentMonth(month) { return payrollMonthKey(new Date(month.getFullYear(),month.getMonth()+1,1)); }
function openPayrollComparison() {
  const key = payrollMonthKey(selectedMonth), saved = state.settings.payroll[key] || {};
  const details = monthPayDetails(monthDuties());
  const rows = payrollRows(monthDuties());
  const euros = value => Number(value).toLocaleString('de-DE', {minimumFractionDigits:2,maximumFractionDigits:2});
  modalContent.innerHTML = `<div class="modal-body"><div class="modal-title">Gehaltsabrechnung prüfen</div>
    <div class="small-note">Leistungsmonat: ${fmtMonth(selectedMonth)}. Tatsächlich ausgezahlte Werte manuell eintragen. Ungeklärte Zuschläge bleiben vorläufig.</div>
    <div class="small-note"><strong>${details.incomplete ? 'Vorläufiger Vergleich – keine vollständige Anspruchsbestätigung' : 'Vergleich der erfassten RB-Bruttopositionen'}</strong>${details.incomplete ? ': '+escapeHtml(details.incompleteReasons.join('; ')) : ''}</div><label class="field"><span>Abrechnungsmonat</span><input id="payrollPaymentMonth" type="month" value="${escapeHtml(saved.paymentMonth || payrollDefaultPaymentMonth(selectedMonth))}"></label>
    <div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr><th>Position</th><th>App</th><th>Abrechnung</th><th>Differenz</th></tr></thead><tbody>
    ${rows.map(([id,label,expected,unit])=>`<tr><td>${label}</td><td>${unit==='€'?euros(expected):expected} ${unit}</td><td><input style="width:90px" type="number" inputmode="decimal" step="${unit==='€'?'0.01':'1'}" data-payroll="${id}" value="${escapeHtml(saved.values?.[id]??'')}" placeholder="–"></td><td data-difference="${id}">?</td></tr>`).join('')}
    </tbody></table></div><div class="small-note">Differenz = Gehaltsabrechnung minus App. Die App zeigt nur die derzeit berechenbaren Ansprüche; bei fehlenden Tarifgrundlagen ist das Ergebnis vorläufig.</div>
    <label class="settings-toggle-row"><span>Alle Rufbereitschaften dieses Leistungsmonats erfasst (für Staffelung)</span><input type="checkbox" id="payrollComplete" ${saved.complete?'checked':''}></label><div class="small-note">Brutto mit Brutto vergleichen. Fehlende Istwerte bleiben ungeprüft. Abweichende Lohnarten oder Nachzahlungen separat zuordnen.</div><div class="modal-actions"><button type="button" class="primary" id="savePayroll">Speichern</button><button type="button" class="secondary-button" id="closePayroll">Schließen</button></div></div>`;
  modal.showModal();
  const refresh = () => rows.forEach(([id,,expected,unit])=>{
    const el = modalContent.querySelector(`[data-payroll="${id}"]`), cell=modalContent.querySelector(`[data-difference="${id}"]`);
    if (!el.value.trim()) {cell.textContent='?';return;}
    const delta=Number(el.value)-expected;
    if (!Number.isFinite(delta)) {cell.textContent='Ungültig';return;}
    cell.textContent=`${Math.abs(delta)<(unit==='€'?.005:.001)?(details.incomplete?'≈':'✓'):'⚠'} ${unit==='€'?euros(delta):delta.toFixed(1)} ${unit}`;
    cell.title=`App-Sollwert: ${unit==='€'?euros(expected):expected} ${unit}; Istwert: ${el.value} ${unit}`;
  });
  modalContent.querySelectorAll('[data-payroll]').forEach(el=>el.addEventListener('input',refresh));refresh();
  document.getElementById('savePayroll').onclick=()=>{
    const values={};modalContent.querySelectorAll('[data-payroll]').forEach(el=>{if(el.value.trim()!==''&&Number.isFinite(Number(el.value)))values[el.dataset.payroll]=Number(el.value);});
    state.settings.payroll[key]={...saved,complete:document.getElementById('payrollComplete').checked,paymentMonth:document.getElementById('payrollPaymentMonth').value||payrollDefaultPaymentMonth(selectedMonth),values};
    saveState();modal.close();render();
  };
  document.getElementById('closePayroll').onclick=()=>modal.close();
}
function sortedDuties() { return [...state.duties].sort((a, b) => dutyStart(b) - dutyStart(a)); }
function activeDuty() { const now = new Date(); return sortedDuties().find(duty => dutyStart(duty) <= now && now < dutyEnd(duty)); }
function homeDuty(now = new Date()) {
  const active=sortedDuties().find(duty=>dutyStart(duty)<=now&&now<dutyEnd(duty));
  if(active) return {duty:active,planned:false};
  const running=sortedDuties().find(duty=>openHouseEntry(duty));
  if(running) return {duty:running,planned:false};
  const today=localDateKey(now);
  const planned=state.duties.find(duty=>duty.date===today&&dutyStart(duty)>now);
  return planned ? {duty:planned,planned:true} : {duty:null,planned:false};
}
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
  const {duty,planned}=homeDuty();
  return duty ? `${duty.id}|${planned?'planned':'active'}|${duty.date}|${duty.entries.length}|${sum(duty, 'Telefonisch')}|${sum(duty, 'Im Haus')}` : 'none';
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
  subtitle.textContent = 'Rufbereitschaft erfassen';
  const {duty,planned}=homeDuty();
  lastDutySignature = dutyViewSignature();
  if (!duty) {
    main.innerHTML = `
      <section class="empty-card">
        <div class="empty-icon">🚑</div>
        <div class="empty-title">Kein aktiver Dienst</div>
        <div class="empty-text">Lege einen Dienst an. Die Start- und Endzeit wird automatisch passend zum Wochentag berechnet.</div>
      </section>
      <button class="primary" id="newDuty" type="button">Neuen Dienst anlegen</button>
`;
    document.getElementById('newDuty').onclick = openNewDuty;
    return;
  }
  const entries = [...duty.entries].sort((a, b) => new Date(a.start) - new Date(b.start));
  const phoneMinutes = sum(duty, 'Telefonisch');
  const houseMinutes = sum(duty, 'Im Haus');
  const runningHouse = openHouseEntry(duty);
  main.innerHTML = `
    <section class="card hero">
      <div class="hero-kicker">${planned?'Heutige Rufbereitschaft geplant':'Aktuelle Rufbereitschaft'}</div>
      <div class="hero-date">${fmtDate(dutyStart(duty))}</div>
      <div class="hero-time">${dutyTimeText(duty)}</div>
      ${planned?`<div class="small-note">Beginnt heute um ${fmtTime(dutyStart(duty))} Uhr.</div>`:timelineHtml(duty)}
    </section>
    <section class="stats">
      <div class="stat"><div class="stat-label">Telefonisch</div><div class="stat-number">${phoneMinutes} Min.</div><div class="stat-detail">${hourLabel(roundedHours(phoneMinutes))} gerundet</div></div>
      <div class="stat"><div class="stat-label">Im Haus</div><div class="stat-number">${houseMinutes} Min.</div><div class="stat-detail">${hourLabel(houseRoundedHours(duty))} gerundet</div></div>
    </section>
    ${runningHouse ? `<button class="primary" id="finishHouseEntry" type="button">✓ Haus-Einsatz beenden</button><div class="small-note running-entry-note">Haus-Einsatz läuft seit ${fmtTime(new Date(runningHouse.start))} Uhr. Fahrt zur Klinik und Rückfahrt sind eingeschlossen.</div>` : `<button class="primary" id="newEntry" type="button">+ Einsatz hinzufügen</button>`}
    <div class="card-header">Einsätze</div>
    <section class="card">${entries.length ? entries.map(entry => entryRow(duty, entry, true)).join('') : '<div class="empty">Noch keine Einsätze</div>'}</section>
    ${state.settings.showPay ? payDetailCard(duty) : ''}
`;
  if (!runningHouse) document.getElementById('newEntry').onclick = () => openNewEntry(duty.id);
  if (runningHouse) document.getElementById('finishHouseEntry').onclick = () => finishHouseEntry(duty.id, runningHouse.id);
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
    ${state.settings.showPay ? `<section class="pay-month-card"><div><div class="pay-kicker">Vergütung ${fmtMonth(selectedMonth)}</div><div class="pay-subtitle">Summe aller erfassten Dienste</div></div><div class="pay-month-value">${fmtMoney(monthPay(duties))}</div><div class="small-note">${(() => { const m=monthPayDetails(duties);return `${duties.length} Rufbereitschaften · ${m.actual.toFixed(0)} tatsächliche Minuten · ${m.hours} vergütete Stunden · Einsatzvergütung ${fmtMoney(m.hoursPay)} · Pauschalen ${fmtMoney(m.allowance)} · Nacht ${fmtMoney(m.supplements.night)} · Staffel ${fmtMoney(m.tierPay)} · RB 00–06 ${fmtMoney(m.specialRB)} · Samstag ${fmtMoney(m.supplements.saturday)} · Sonntag ${fmtMoney(m.supplements.sunday)} · Feiertag ${fmtMoney(m.supplements.holiday)} · 24./31.12. ${fmtMoney(m.supplements.specialDecember)}`; })()}</div>${monthPayDetails(duties).incomplete ? `<div class="small-note">Vorläufiger Vergleichswert: ${escapeHtml(monthPayDetails(duties).incompleteReasons.join('; '))}.</div>` : ''}</section>` : ''}
    <div class="month-actions">
      <button class="action-button" id="exportCsv" type="button">CSV exportieren</button>
      <button class="action-button" id="printReport" type="button">PDF-Bericht</button>
      ${state.settings.showPay ? '<button class="action-button" id="payrollComparison" type="button">Gehaltsabrechnung prüfen</button>' : ''}
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
  if (state.settings.showPay) document.getElementById('payrollComparison').onclick = openPayrollComparison;
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
      <div class="hero-kicker">Rufbereitschaft</div>
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
  const line = (label,value) => `<div class="row"><div class="row-main"><div class="row-title">${label}</div></div><div class="row-value strong-value">${fmtMoney(value)}</div></div>`;
  return `<div class="card-header">Vergütung · Rufbereitschaft</div><section class="card pay-detail-card">
    ${line('Einsatzvergütung · '+pay.hours+' Stunden',pay.hoursPay)}
    ${line('RB-Pauschale · Faktor '+pay.multiplier,pay.allowance)}
    ${line('Nachtzuschlag inkl. RB-Zeitanteil · Nachtminuten '+Math.round(pay.buckets.night),pay.supplements.night)}
    ${line('Besonderer RB-Zuschlag 00–06 · '+pay.midnightRatedMinutes.toFixed(0)+' Bewertungsminuten',pay.specialRB)}
    ${line('Samstag',pay.supplements.saturday)}${line('Sonntag',pay.supplements.sunday)}
    ${line('Feiertag',pay.supplements.holiday)}${line('24./31. Dezember',pay.supplements.specialDecember)}
    ${line('RB-Staffel · Nr. '+pay.tier.ordinal+' · '+Math.round(pay.tier.percentage*100)+' %'+(pay.tier.confirmed?'':' (ungeklärt / nicht addiert)'),pay.tierPay)}
    ${line(pay.incomplete?'Gesamt · vorläufiger Vergleichswert':'Gesamt · erfasste RB-Bruttopositionen',pay.total)}
    <div class="small-note">Pauschale und ihr Staffelanteil gehören zum Dienst. Telefonvergütung wird anteilig nach Minuten aufgeteilt; kein zusätzlicher Stundenanspruch pro Telefonat. Zeitzuschläge gelten für echte Zeiten. Hauseinsatzzeiten einschließlich erforderlicher Wegezeiten erfassen.</div>
    <div class="small-note">Tatsächlich ${pay.buckets.actual.toFixed(0)} Min. · tariflich ${pay.hours} Std. · Rundungsgewinn ${(pay.hours*60-pay.buckets.actual).toFixed(0)} Min.</div>
    ${pay.incomplete?`<div class="small-note"><strong>Vorläufig, nicht vollständig:</strong> ${escapeHtml(pay.incompleteReasons.join('; '))}. Fehlende Positionen sind nicht in der Summe enthalten.</div>`:''}
  </section>`;
}

function entryRow(duty, entry, withDelete) {
  const start = new Date(entry.start);
  const running = isOpenHouseEntry(entry);
  const end = running ? null : new Date(entry.end);
  const badgeClass = entry.type === 'Telefonisch' ? 'type-phone' : 'type-house';
  const entryPay=state.settings.showPay&&!running?dutyPay(duty).entryDetails.find(e=>e.id===entry.id):null;
  const endDateText = !running&&localDateKey(start) !== localDateKey(end) ? ` (${fmtShortDate(end)})` : '';
  return `<div class="swipe-item entry-swipe-item" data-kind="entry" data-duty="${duty.id}" data-entry="${entry.id}">
    ${withDelete ? '<button class="swipe-delete-action" type="button" aria-label="Einsatz löschen">Löschen</button>' : ''}
    <div class="swipe-content row entry-row" role="button" tabindex="0">
      <div class="row-main">
        <div><span class="type-badge ${badgeClass}">${escapeHtml(entry.type)}</span></div>
        <div class="row-subtitle">${running ? `${fmtDate(start)} seit ${fmtTime(start)} Uhr · läuft` : `${fmtDate(start)} von ${fmtTime(start)} bis ${fmtTime(end)}${endDateText}`}</div>
        ${entry.patientId ? `<div class="entry-note">Patienten-ID: ${escapeHtml(entry.patientId)}</div>` : ''}
        ${entry.patientIdPhoto ? `<button type="button" class="entry-photo-link" data-photo-duty="${escapeHtml(duty.id)}" data-photo-entry="${escapeHtml(entry.id)}">📷 Patienten-ID anzeigen</button>` : ''}
        ${entry.note ? `<div class="entry-note">Bemerkung: ${escapeHtml(entry.note)}</div>` : ''}
        ${entryPay ? `<div class="entry-pay">${fmtMoney(entryPay.total)}${dutyPay(duty).incomplete?' · vorläufig':''}<small>Basis ${fmtMoney(entryPay.hoursPay)} · Zeit ${fmtMoney(Object.values(entryPay.supplements).reduce((a,b)=>a+b,0))} · RB 00–06 ${fmtMoney(entryPay.specialRB)} · Staffel ${fmtMoney(entryPay.tierPay)}${entry.type==='Telefonisch'?' · Anteil am Telefonpool':''}</small></div>`:''}
      </div>
      <div class="row-value">${running ? 'Läuft' : `${minutes(entry)} Min.${entry.type === 'Im Haus' ? `<span class="entry-rounded-hours">${hourLabel(roundedHours(minutes(entry)))} gerundet</span>` : ''}`}</div>
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
function startHouseEntry(dutyId, startedAt = new Date()) {
  const duty = state.duties.find(item => item.id === dutyId);
  if (!duty || openHouseEntry(duty)) return;
  if (startedAt < dutyStart(duty) || startedAt >= dutyEnd(duty)) return;
  duty.entries.push({ id: uid(), type: 'Im Haus', start: startedAt.toISOString(), note: '' });
  saveState(); haptic(); render();
}
function finishHouseEntry(dutyId, entryId, finishedAt = new Date()) {
  const duty = state.duties.find(item => item.id === dutyId);
  const entry = duty?.entries.find(item => item.id === entryId && isOpenHouseEntry(item));
  if (!duty || !entry) return;
  if (finishedAt <= new Date(entry.start)) { alert('Das Ende muss nach dem Start liegen.'); return; }
  if (finishedAt > dutyEnd(duty)) {
    openEditEntry(dutyId, entryId);
    document.getElementById('modalError').textContent = `Das aktuelle Ende liegt nach dem Dienstende um ${fmtTime(dutyEnd(duty))} Uhr. Bitte die Zeit prüfen und manuell speichern.`;
    return;
  }
  entry.end = finishedAt.toISOString();
  saveState(); haptic(); render();
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

function scheduledDutyBounds(date) {
  return {startOverride:dutyStart({date}).toISOString(),endOverride:dutyEnd({date}).toISOString()};
}
function weekendDutyDates(selectedDate) {
  const selected=parseLocalDate(selectedDate), day=selected.getDay();
  if(![0,5,6].includes(day)) return [selectedDate];
  const friday=new Date(selected);
  friday.setDate(friday.getDate()-(day===0?2:day===6?1:0));
  return [0,1,2].map(offset=>{const date=new Date(friday);date.setDate(date.getDate()+offset);return localDateKey(date);});
}
function openNewDuty() {
  modal.classList.add('duty-date-dialog');
  const now = new Date();
  const initialDate = localDateKey(now);
  modalContent.innerHTML = `<div class="modal-body">
    <div class="modal-title">Neuer Dienst</div>
    <label class="field"><span>Datum des Dienstbeginns</span><input id="dutyDate" type="date" value="${initialDate}"></label>
    <div class="small-note" id="dutyScheduleNote">Dienstzeit: ${scheduleText(initialDate)}.</div>
    <label class="settings-toggle-row weekend-duty-option" id="weekendDutyOption" hidden><span><strong>Gesamtes Wochenende anlegen</strong><small>Freitag bis Sonntag als drei getrennte Dienste anlegen.</small></span><input type="checkbox" id="addWeekendDuties" aria-label="Gesamtes Wochenende anlegen"></label>
    <div id="modalError" class="error"></div>
    <div class="modal-actions"><button type="button" class="primary" id="saveDuty">Speichern</button><button class="secondary-button">Abbrechen</button></div>
  </div>`;
  modal.showModal();
  const updateWeekendOption=date=>{
    const option=document.getElementById('weekendDutyOption'), toggle=document.getElementById('addWeekendDuties');
    const day=date?parseLocalDate(date).getDay():-1;
    const isWeekendDay=[0,5,6].includes(day);
    option.hidden=!isWeekendDay;
    if(!isWeekendDay) toggle.checked=false;
  };
  updateWeekendOption(initialDate);
  document.getElementById('dutyDate').onchange = event => {
    if (event.target.value) document.getElementById('dutyScheduleNote').textContent = `Dienstzeit: ${scheduleText(event.target.value)}.`;
    updateWeekendOption(event.target.value);
  };
  document.getElementById('saveDuty').onclick = () => {
    const date = document.getElementById('dutyDate').value;
    if (!date) { document.getElementById('modalError').textContent = 'Bitte ein Datum auswählen.'; return; }
    const dates=document.getElementById('addWeekendDuties').checked?weekendDutyDates(date):[date];
    const existing=dates.filter(candidate=>state.duties.some(duty=>duty.date===candidate));
    if (existing.length) {
      document.getElementById('modalError').textContent = existing.length===1 ? `Für den ${fmtShortDate(parseLocalDate(existing[0]))} gibt es bereits einen Dienst.` : 'Mindestens einer der Wochenenddienste existiert bereits. Es wurde nichts angelegt.';
      return;
    }
    for(const dutyDate of dates) state.duties.push({id:uid(),date:dutyDate,...scheduledDutyBounds(dutyDate),entries:[]});
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
    <div class="small-note" id="dutyScheduleNote">Dienstzeit: ${dutyTimeText(duty)}.</div>
    <div class="small-note">Vorhandene Einsätze bleiben erhalten. Beim Speichern wird geprüft, ob sie weiterhin innerhalb des Dienstes liegen.</div>
    <div id="modalError" class="error"></div>
    <div class="modal-actions"><button type="button" class="primary" id="saveDuty">Änderungen speichern</button><button class="secondary-button">Abbrechen</button></div>
  </div>`;
  modal.showModal();
  document.getElementById('dutyDate').onchange = event => {
    if (event.target.value) document.getElementById('dutyScheduleNote').textContent = `Dienstzeit: ${event.target.value===duty.date ? dutyTimeText(duty) : scheduleText(event.target.value)}.`;
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
    const bounds=date===duty.date ? {startOverride:dutyStart(duty).toISOString(),endOverride:dutyEnd(duty).toISOString()} : scheduledDutyBounds(date);
    const previousBounds={startOverride:duty.startOverride,endOverride:duty.endOverride};
    const previousDate = duty.date;
    const dayDifference = Math.round((parseLocalDate(date) - parseLocalDate(previousDate)) / 86400000);
    const previousEntries = duty.entries.map(entry => ({ ...entry }));
    duty.date = date;
    Object.assign(duty,bounds);
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
      Object.assign(duty,previousBounds);
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
    <label class="field" id="entryEndField"><span>Endzeit</span><input id="entryEnd" type="time" value="${pad(defaultEnd.getHours())}:${pad(defaultEnd.getMinutes())}"></label>
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
  const updateEntryTypeUi = () => {
    const house = type === 'Im Haus';
    document.getElementById('entryEndField').hidden = house;
    document.getElementById('saveEntry').textContent = house ? 'Im Haus starten' : 'Speichern';
  };
  for (const button of modalContent.querySelectorAll('[data-type]')) {
    button.onclick = () => {
      type = button.dataset.type;
      for (const item of modalContent.querySelectorAll('[data-type]')) item.classList.toggle('selected', item === button);
      updateEntryTypeUi();
    };
  }
  document.getElementById('saveEntry').onclick = () => {
    const date = document.getElementById('entryDate').value;
    const startTime = document.getElementById('entryStart').value;
    const endTime = document.getElementById('entryEnd').value;
    const note = document.getElementById('entryNote').value.trim();
    const error = document.getElementById('modalError');
    error.textContent = '';
    if (!date || !startTime || (type === 'Telefonisch' && !endTime)) { error.textContent = 'Bitte Datum und Zeiten ausfüllen.'; return; }
    if (type === 'Im Haus' && openHouseEntry(duty)) { error.textContent = 'Ein Hauseinsatz läuft bereits. Bitte diesen zuerst beenden.'; return; }
    const startDate = new Date(`${date}T${startTime}:00`);
    const endDate = type === 'Telefonisch' ? new Date(`${date}T${endTime}:00`) : null;
    if (endDate && endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
    if (startDate < dutyStart(duty) || startDate >= dutyEnd(duty)) { error.textContent = 'Die Startzeit muss innerhalb dieses Dienstes liegen.'; return; }
    if (endDate && endDate > dutyEnd(duty)) { error.textContent = `Die Endzeit darf nicht nach dem Dienstende um ${fmtTime(dutyEnd(duty))} Uhr liegen.`; return; }
    const patientIdPhoto = document.getElementById('entryPatientIdPhoto')?.value || '';
    duty.entries.push({ id: uid(), type, start: startDate.toISOString(), ...(endDate ? {end:endDate.toISOString()} : {}), patientIdPhoto, note });
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
  const start = new Date(entry.start), running = isOpenHouseEntry(entry), end = running ? null : new Date(entry.end);
  modalContent.innerHTML = `<div class="modal-body entry-form-body">
    <div class="modal-title">Einsatz bearbeiten</div>
    <div class="segment"><button type="button" class="${type === 'Telefonisch' ? 'selected' : ''}" data-type="Telefonisch">Telefonisch</button><button type="button" class="${type === 'Im Haus' ? 'selected' : ''}" data-type="Im Haus">Im Haus</button></div>
    <label class="field"><span>Datum</span><input id="entryDate" type="date" value="${localDateKey(start)}"></label>
    <label class="field"><span>Startzeit</span><input id="entryStart" type="time" value="${pad(start.getHours())}:${pad(start.getMinutes())}"></label>
    <label class="field"><span>${running ? 'Endzeit (noch offen)' : 'Endzeit'}</span><input id="entryEnd" type="time" value="${running ? '' : `${pad(end.getHours())}:${pad(end.getMinutes())}`}"></label>
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
    if (!date || !startTime || (!endTime && !(running && type === 'Im Haus'))) { error.textContent = 'Bitte Datum und Zeiten ausfüllen.'; return; }
    const startDate = new Date(`${date}T${startTime}:00`), endDate = endTime ? new Date(`${date}T${endTime}:00`) : null;
    if (endDate && endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
    if (startDate < dutyStart(duty) || startDate >= dutyEnd(duty)) { error.textContent = 'Die Startzeit muss innerhalb dieses Dienstes liegen.'; return; }
    if (endDate && endDate > dutyEnd(duty)) { error.textContent = `Die Endzeit darf nicht nach dem Dienstende um ${fmtTime(dutyEnd(duty))} Uhr liegen.`; return; }
    if (type === 'Im Haus' && !running && openHouseEntry(duty)) { error.textContent = 'Ein Hauseinsatz läuft bereits. Bitte diesen zuerst beenden.'; return; }
    const patientIdPhoto = document.getElementById('entryPatientIdPhoto')?.value || '';
    Object.assign(entry, { type, start: startDate.toISOString(), ...(endDate ? {end:endDate.toISOString()} : {}), patientIdPhoto, note });
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
      <span><strong>Vergütung anzeigen</strong><small>Berechnung und Beträge in Dienst- und Monatsansicht ein- oder ausblenden</small></span>
      <input id="showPayToggle" class="switch-input" type="checkbox" ${settings.showPay ? 'checked' : ''}>
      <span class="switch" aria-hidden="true"></span>
    </label>
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
        <span><strong>Zeitstrahl anzeigen</strong><small>Optionale Fortschrittsanzeige des aktuellen Dienstes</small></span>
        <input id="showTimelineToggle" class="switch-input" type="checkbox" ${settings.showTimeline ? 'checked' : ''}>
        <span class="switch" aria-hidden="true"></span>
      </label>
    </div>
    <div id="dutyTimeSettings" class="duty-time-settings" ${settings.showCustomDutyTimes ? '' : 'hidden'}>
      <div class="small-note">Die Endzeit gilt jeweils für den Folgetag. Änderungen werden für neue Dienste vorgeschlagen; gespeicherte Dienstgrenzen bleiben erhalten.</div>
      ${[1,2,3,4,5,6,0].map(day => `<div class="weekday-time-row"><strong>${WEEKDAY_NAMES[day]}</strong><label><span>Start</span><input id="dutyStart-${day}" type="time" value="${settings.dutyTimes[day].start}"></label><label><span>Ende</span><input id="dutyEnd-${day}" type="time" value="${settings.dutyTimes[day].end}"></label></div>`).join('')}
      <button type="button" class="primary settings-save" id="saveDutyTimeSettings">Dienstzeiten speichern</button>
    </div>
    <div id="paySettings" class="pay-settings" ${settings.showPay ? '' : 'hidden'}>
      <div class="small-note"><strong>Bestätigter Ausgangswert: Facharzt, Gruppe II, Stufe 1.</strong> Feiertagsarbeit mit Freizeitausgleich: 35 %. Die bestehenden Tarifzeiträume und Stundenwerte bleiben erhalten. Die Referenzwerte gelten für NRW und 40 Stunden; unvollständige Tarifkombinationen werden nicht als gesicherter Anspruch berechnet.</div>
      <label class="field"><span>Tarifgruppe</span><select id="tariffGroup">${tariffGroupOptions(settings.tariffGroup)}</select></label>
      <label class="field"><span>Stufe</span><select id="tariffStage">${tariffStageOptions(settings.tariffGroup, settings.tariffStage)}</select></label>
      <label class="field"><span>Beschäftigungsumfang (%) · für RB-Staffelung</span><input type="number" id="employmentFraction" min="1" max="100" step="1" value="${settings.employmentFraction?settings.employmentFraction*100:''}" placeholder="Noch ungeklärt"></label>
      <button type="button" class="secondary-button" id="fillReference">NRW-Tarifwerte für Gültig-ab-Datum vorschlagen</button>
      <label class="settings-toggle-row"><span>Stundenwerte und Tarifgruppe für diesen Zeitraum geprüft</span><input type="checkbox" id="ratesConfirmed"></label>
      <label class="field"><span>Einsatzstundenwert Rufbereitschaft · einschließlich Überstundenzuschlag</span><div class="money-input"><input id="workHourlyRate" type="number" inputmode="decimal" min="0" step="0.01" value="${settings.workHourlyRate.toFixed(2)}"><span>€ / Std.</span></div></label>
      <label class="field"><span>Stundenwert für Rufbereitschaftspauschale</span><div class="money-input"><input id="allowanceHourlyRate" type="number" inputmode="decimal" min="0" step="0.01" value="${settings.allowanceHourlyRate.toFixed(2)}"><span>€ / Std.</span></div></label>
      <label class="field"><span>Zeitzuschlags-Bemessungsgrundlage (AVR § 7 Abs. 1, Tabellenentgelt Stufe 3 / Monatsdivisor)</span><div class="money-input"><input id="supplementBaseRate" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Noch nicht hinterlegt" value="${settings.supplementBaseRate ?? ''}"><span>€ / Std.</span></div></label>
      <label class="field"><span>Feiertagsarbeit</span><select id="holidayTimeOff"><option value="unknown" ${settings.holidayTimeOff==='unknown'?'selected':''}>Freizeitausgleich ungeklärt</option><option value="yes" ${settings.holidayTimeOff==='yes'?'selected':''}>Mit Freizeitausgleich (35 %)</option><option value="no" ${settings.holidayTimeOff==='no'?'selected':''}>Ohne Freizeitausgleich (135 %)</option></select></label>
      <label class="field"><span>Gültig ab</span><input id="rateValidFrom" type="date" value="${localDateKey(new Date())}"></label>
      <div class="small-note">Neue Löhne gelten erst ab diesem Datum. Frühere Dienste werden weiterhin mit dem damals gültigen Satz berechnet. Speichere bei einer Lohnerhöhung einfach den neuen Satz mit dem passenden Datum.</div>
      ${settings.rateHistory.length > 1 ? `<div class="rate-history"><strong>Gespeicherte Lohnzeiträume</strong>${settings.rateHistory.filter(r => r.validFrom !== '1900-01-01').slice().reverse().map(r => `<div class="rate-history-row"><span>ab ${fmtShortDate(parseLocalDate(r.validFrom))} · Gruppe ${normalizeTariffGroup(r.tariffGroup)} / Stufe ${normalizeTariffStage(r.tariffGroup, r.tariffStage)}</span><span>${fmtMoney(r.workHourlyRate)} / ${fmtMoney(r.allowanceHourlyRate)}</span></div>`).join('')}</div>` : ''}
      <div class="small-note">Pauschale: Montag–Freitag 200 %, Samstag/Sonntag/NRW-Feiertag 400 % nach Starttag. Unter 12 Std.: je angefangener Stunde 12,5 %. Die Einsatzstunden werden wie bisher je Dienstart auf volle Stunden aufgerundet und anschließend addiert.</div>
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
  const tariffGroupSelect = document.getElementById('tariffGroup');
  const tariffStageSelect = document.getElementById('tariffStage');
  tariffGroupSelect.onchange = () => { tariffStageSelect.innerHTML = tariffStageOptions(tariffGroupSelect.value, 1); };
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
    state.settings.showPay = toggle.checked;
    saveState();
    paySettings.hidden = !toggle.checked;
    render();
  };
  document.getElementById('fillReference').onclick=()=>{
    const r=referenceRates(document.getElementById('rateValidFrom').value,tariffGroupSelect.value,tariffStageSelect.value);
    if(!r){alert('Für diese Tarifgruppe, Stufe und diesen Zeitraum liegt kein vollständig verifizierter Referenzwert vor. Stundenwerte bitte anhand der Abrechnung hinterlegen.');return;}
    for(const key of ['workHourlyRate','allowanceHourlyRate','supplementBaseRate']) if(Number.isFinite(r[key])) document.getElementById(key).value=r[key].toFixed(2);
    document.getElementById('ratesConfirmed').checked=false;
    if(r.incompleteReason) alert(r.incompleteReason);
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
    const baseRaw = document.getElementById('supplementBaseRate').value;
    const supplementBaseRate = baseRaw === '' ? null : Number(baseRaw);
    if (supplementBaseRate !== null && (!Number.isFinite(supplementBaseRate) || supplementBaseRate <= 0)) {
      alert('Bitte gültige Bemessungsgrundlage eingeben oder leer lassen.'); return;
    }
    const tariffGroup=tariffGroupSelect.value;
    const tariffStage=normalizeTariffStage(tariffGroup, tariffStageSelect.value);
    const fractionRaw=document.getElementById('employmentFraction').value;
    const fraction=fractionRaw===''?null:Number(fractionRaw)/100;
    if(fraction!==null&&(!Number.isFinite(fraction)||fraction<=0||fraction>1)){alert('Beschäftigungsumfang von 1 bis 100 % eingeben.');return;}
    const ratesConfirmed=document.getElementById('ratesConfirmed').checked;
        if(existingIndex>=0&&!confirm('Dieser Gültig-ab-Zeitraum existiert bereits. Seine Stundenwerte ersetzen? Andere Zeiträume bleiben erhalten.'))return;
    const newRate = { ...(existingIndex>=0?history[existingIndex]:{}), tariffGroup, tariffStage, employmentFraction:fraction,ratesConfirmed,validFrom, workHourlyRate: workRate, allowanceHourlyRate: allowanceRate, supplementBaseRate, holidayTimeOff: document.getElementById('holidayTimeOff').value };
    if (existingIndex >= 0) history[existingIndex] = newRate; else history.push(newRate);
    history.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    state.settings = normalizeSettings({ ...state.settings, showPay: toggle.checked,tariffGroup,tariffStage,employmentFraction:fraction, rateHistory: history, supplementBaseRate, holidayTimeOff: document.getElementById('holidayTimeOff').value });
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
    ${privacyNote()}
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
      const restored=migrateState({...data,settings:parsed.settings || state.settings});
      state.duties = restored.duties;
      state.settings = restored.settings;
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
  const rows = [['Dienst', 'Dienstbeginn', 'Dienstende', 'Dienstart', 'Datum', 'Start', 'Ende', 'Minuten', 'Patienten-ID', 'Bemerkung', 'Gerundete Stunden je Dienstart','Einsatzvergütung EUR (ohne Pauschale)','Status']];
  for (const duty of duties) {
    const rounded = { 'Telefonisch': phoneRoundedHours(duty), 'Im Haus': houseRoundedHours(duty) };
    if (!duty.entries.length) rows.push([fmtShortDate(dutyStart(duty)), fmtTime(dutyStart(duty)), fmtTime(dutyEnd(duty)), '', '', '', '', '0', '', '', '0']);
    for (const entry of [...duty.entries].sort((a, b) => new Date(a.start) - new Date(b.start))) {
      const start = new Date(entry.start);
      const running=isOpenHouseEntry(entry), end = running ? null : new Date(entry.end), detail=state.settings.showPay&&!running?dutyPay(duty).entryDetails.find(e=>e.id===entry.id):null;
      rows.push([fmtShortDate(dutyStart(duty)), fmtTime(dutyStart(duty)), fmtTime(dutyEnd(duty)), entry.type, fmtShortDate(start), fmtTime(start), running?'offen':`${fmtTime(end)}${localDateKey(start) === localDateKey(end) ? '' : ` (${fmtShortDate(end)})`}`, minutes(entry), entry.patientId || '', entry.note || '', rounded[entry.type],detail?cents(detail.total):'',running?'Offen':state.settings.showPay?(dutyPay(duty).incomplete?'Vorläufig':'Berechenbar'):'']);
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
      const running=isOpenHouseEntry(entry), entryEnd = running ? null : new Date(entry.end), detail=state.settings.showPay&&!running?dutyPay(duty).entryDetails.find(e=>e.id===entry.id):null;
      return `<tr>
        <td data-label="Art">${escapeHtml(entry.type)}</td>
        <td data-label="Datum">${fmtDate(entryStart)}</td>
        <td data-label="Beginn">${fmtTime(entryStart)}</td>
        <td data-label="Ende">${running?'läuft':fmtTime(entryEnd)}</td>
        <td data-label="Dauer">${running?'noch offen':`${minutes(entry)} Min.${entry.type === 'Im Haus' ? `<span class="entry-rounded-hours">${hourLabel(roundedHours(minutes(entry)))} gerundet</span>` : ''}`}</td>
        <td data-label="Patienten-ID">${escapeHtml(entry.patientId || '–')}${/^data:image\/(jpeg|png|webp);base64,/.test(entry.patientIdPhoto||'')?`<img alt="Patienten-ID-Ausschnitt" style="display:block;max-width:150px;max-height:60px" src="${escapeHtml(entry.patientIdPhoto)}">`:''}</td>
        <td data-label="Bemerkung">${escapeHtml(entry.note || '–')}${detail?`<br>Vergütung ${fmtMoney(detail.total)} · ${dutyPay(duty).incomplete?'vorläufig':'ohne Pauschale'}`:running?'<br>Vergütung erst nach Beenden':''}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="7" class="muted">Keine Einsätze erfasst</td></tr>';
    const pay = state.settings.showPay ? dutyPay(duty) : null;
    return `<section class="duty-block">
      <div class="duty-heading"><div><h2>${fmtDate(dutyStart(duty))}</h2><div class="muted">${dutyTimeText(duty)}</div></div><div class="duty-total">${dutyRoundedHours(duty)} Std.</div></div>
      <div class="duty-summary"><span>Telefonisch: <strong>${phoneMinutes} Min. / ${phoneRoundedHours(duty)} Std.</strong></span><span>Im Haus: <strong>${houseMinutes} Min. / ${houseRoundedHours(duty)} Std.</strong></span>${pay ? `<span>Vergütung: <strong>${fmtMoney(pay.total)}</strong></span>` : ''}</div>
      ${pay?payDetailCard(duty):''}
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
      // Eine fehlende Verbindung darf den Offline-Neustart nicht mit einer
      // unbehandelten Promise-Rejection abbrechen. Updates werden online geprüft.
      if (navigator.onLine) registration.update().catch(() => {});
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


// Ein Tipp auf den sichtbaren, abgedunkelten Hintergrund verwirft den geöffneten
// Dialog wie „Abbrechen“. Gespeichert wird ausschließlich über die Speichern-Buttons.
modal.addEventListener('click', event => {
  if (event.target === modal) {
    modal.close();
  }
});
modal.addEventListener('close', () => {
  closePatientPhotoCamera();
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
    d.addEventListener('close', closePatientPhotoCamera, {once:true});
    d.showModal();
    await video.play();
  } catch (e) {
    closePatientPhotoCamera();
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
  d.addEventListener('close',()=>{patientPhotoTempImage='';img.removeAttribute('src');patientPhotoDrag=null;});

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

