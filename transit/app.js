'use strict';
// Kav: a public transit planner. Routing, stops and live times come from Transitous
// (https://transitous.org), a free, community-run MOTIS server fed by open GTFS data.
const API = 'https://api.transitous.org/api';

/* ---------------- storage ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('kav.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('kav.' + k, JSON.stringify(v)); } catch {} },
};

/* ---------------- i18n ---------------- */
const T = {
  en: {
    whereTo: 'Where to?', home: 'Home', work: 'Work', setHome: 'Set home', setWork: 'Set work',
    myLoc: 'Current location', chooseMap: 'Choose on map', usePoint: 'Use this point', movePin: 'Move the map to put the pin on the place',
    nearby: 'Nearby stops', recents: 'Recent', favStops: 'Saved stops', from: 'Starting point', to: 'Destination',
    now: 'Leave now', depart: 'Depart at', arrive: 'Arrive by', later: 'Later options', noRoutes: 'No routes found. Try another time or place.',
    walk: 'Walk', walkOnly: 'Walk only', min: n => `${n} min`, hmin: (h, m) => m ? `${h} h ${m} min` : `${h} h`,
    inMin: n => n <= 0 ? 'now' : `in ${n} min`, stops: n => n === 1 ? '1 stop' : `${n} stops`, towards: h => `to ${h}`,
    arrive2: 'Arrive', start: 'Start', end: 'End', live: 'Live', departures: 'Departures',
    noDeps: 'No departures found for the next hours.', dirHere: 'Directions', save: 'Save stop', saved: 'Saved',
    offline: "Can't reach the transit server.", retry: 'Retry', needLoc: 'Allow location access to see stops near you.',
    walkTo: s => `Walk to ${s}`, waitFor: l => `Wait for ${l}`, rideTo: s => `Ride to ${s}`,
    offIn: n => n <= 0 ? 'Get off here' : n === 1 ? 'Get off at the next stop' : `Get off in ${n} stops`,
    arrived: "You've arrived", getOffNow: 'Get off at the next stop!', away: d => `${d} away`,
    transfers: n => n === 0 ? 'Direct' : n === 1 ? '1 transfer' : `${n} transfers`, searchPh: 'Search a place, address or stop',
    m: n => `${n} m`, km: n => `${n} km`, stopCode: c => `Stop ${c}`, step: (i, n) => `Step ${i} of ${n}`,
    route: 'Route', arrivesIn: n => n <= 0 ? 'Arriving now' : `Arrives in ${n} min`, leaves: n => n <= 0 ? 'leaving now' : `leaves in ${n} min`,
    noResults: 'No matches', locating: 'Finding your location…', noLoc: 'Location is unavailable. Pick a starting point.',
    stopsOnMap: 'Zoom in on the map to see stops', prev: 'Back', next: 'Next', trip: 'Line', delayed: n => `${n} min late`, early: n => `${n} min early`,
    onTime: 'On time', noData: 'Data: Transitous · OpenStreetMap',
  },
  he: {
    whereTo: 'לאן?', home: 'בית', work: 'עבודה', setHome: 'הגדרת בית', setWork: 'הגדרת עבודה',
    myLoc: 'המיקום שלי', chooseMap: 'בחירה במפה', usePoint: 'בחירת הנקודה', movePin: 'הזיזו את המפה כדי לשים את הסיכה על המקום',
    nearby: 'תחנות קרובות', recents: 'חיפושים אחרונים', favStops: 'תחנות שמורות', from: 'נקודת מוצא', to: 'יעד',
    now: 'יציאה עכשיו', depart: 'יציאה ב־', arrive: 'הגעה עד', later: 'אפשרויות מאוחרות יותר', noRoutes: 'לא נמצאו מסלולים. נסו שעה או מקום אחר.',
    walk: 'הליכה', walkOnly: 'הליכה בלבד', min: n => `${n} דק׳`, hmin: (h, m) => m ? `${h} שע׳ ${m} דק׳` : `${h} שע׳`,
    inMin: n => n <= 0 ? 'עכשיו' : `בעוד ${n} דק׳`, stops: n => n === 1 ? 'תחנה אחת' : `${n} תחנות`, towards: h => `אל ${h}`,
    arrive2: 'הגעה', start: 'יוצאים לדרך', end: 'סיום', live: 'בזמן אמת', departures: 'יציאות קרובות',
    noDeps: 'לא נמצאו יציאות בשעות הקרובות.', dirHere: 'מסלול לכאן', save: 'שמירת תחנה', saved: 'שמורה',
    offline: 'אין חיבור לשרת התחבורה.', retry: 'לנסות שוב', needLoc: 'אפשרו גישה למיקום כדי לראות תחנות קרובות.',
    walkTo: s => `ללכת אל ${s}`, waitFor: l => `לחכות לקו ${l}`, rideTo: s => `לנסוע עד ${s}`,
    offIn: n => n <= 0 ? 'לרדת כאן' : n === 1 ? 'לרדת בתחנה הבאה' : `לרדת בעוד ${n} תחנות`,
    arrived: 'הגעתם!', getOffNow: 'לרדת בתחנה הבאה!', away: d => `במרחק ${d}`,
    transfers: n => n === 0 ? 'ישיר' : n === 1 ? 'החלפה אחת' : `${n} החלפות`, searchPh: 'חיפוש מקום, כתובת או תחנה',
    m: n => `${n} מ׳`, km: n => `${n} ק״מ`, stopCode: c => `תחנה ${c}`, step: (i, n) => `שלב ${i} מתוך ${n}`,
    route: 'מסלול', arrivesIn: n => n <= 0 ? 'מגיע עכשיו' : `מגיע בעוד ${n} דק׳`, leaves: n => n <= 0 ? 'יוצא עכשיו' : `יוצא בעוד ${n} דק׳`,
    noResults: 'לא נמצאו תוצאות', locating: 'מאתר את המיקום שלך…', noLoc: 'המיקום לא זמין. בחרו נקודת מוצא.',
    stopsOnMap: 'הגדילו את המפה כדי לראות תחנות', prev: 'הקודם', next: 'הבא', trip: 'קו', delayed: n => `איחור ${n} דק׳`, early: n => `${n} דק׳ מוקדם`,
    onTime: 'בזמן', noData: 'נתונים: Transitous · OpenStreetMap',
  },
};
let lang = store.get('lang', (navigator.language || '').toLowerCase().startsWith('he') ? 'he' : 'en');
const t = (k, ...a) => { const v = T[lang][k] ?? T.en[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  $('#lang').textContent = lang === 'he' ? 'EN' : 'עב';
}

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const minsUntil = iso => Math.round((Date.parse(iso) - Date.now()) / 60000);
const fmts = {};
function fmtTime(iso, tz) {
  if (!iso) return '';
  const key = lang + (tz || '');
  fmts[key] ??= new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz || undefined });
  try { return fmts[key].format(new Date(iso)); } catch { return ''; }
}
function dur(sec) { const m = Math.max(1, Math.round(sec / 60)); return m < 60 ? t('min', m) : t('hmin', Math.floor(m / 60), m % 60); }
function dist(m) { return m < 1000 ? t('m', Math.max(10, Math.round(m / 10) * 10)) : t('km', (m / 1000).toFixed(1)); }
function haversine(a, b) {
  const R = 6371e3, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// Google encoded polyline; arithmetic (not bitwise) so precision 7 does not overflow.
function decode(str, precision = 6) {
  const f = 10 ** precision, out = []; let i = 0, lat = 0, lon = 0;
  const next = () => { let r = 0, s = 1, b; do { b = str.charCodeAt(i++) - 63; r += (b & 31) * s; s *= 32; } while (b >= 32); return r % 2 ? -(r + 1) / 2 : r / 2; };
  while (i < str.length) { lat += next(); lon += next(); out.push([lat / f, lon / f]); }
  return out;
}
const cleanHeadsign = h => String(h || '').replace(/_/g, ' – ');
// Israeli MOT descriptions look like "רחוב: אבן גבירול 89 עיר: תל אביב יפו רציף:  קומה:"
function cleanDesc(d) {
  if (!d) return '';
  const m = d.match(/רחוב:\s*(.*?)\s*עיר:\s*(.*?)\s*רציף:\s*(.*?)\s*קומה:/);
  if (m) return [m[1], m[2], m[3] && (lang === 'he' ? 'רציף ' : 'Platform ') + m[3]].filter(Boolean).join(', ');
  return d.length > 80 ? '' : d;
}
function areaName(p) {
  const a = (p.areas || []).find(a => a.default) || (p.areas || []).slice().sort((x, y) => y.adminLevel - x.adminLevel)[0];
  return a ? a.name : '';
}
function placeLabel(m) {
  if (m.type === 'ADDRESS' && m.street) return `${m.street} ${m.houseNumber || ''}`.trim();
  return m.name;
}

const MODE = {
  BUS: ['🚌', '#0f8a5f'], COACH: ['🚌', '#e67700'], TRAM: ['🚊', '#d6336c'], SUBWAY: ['🚇', '#7048e8'], METRO: ['🚇', '#7048e8'],
  RAIL: ['🚆', '#1c6dd0'], HIGHSPEED_RAIL: ['🚄', '#1c6dd0'], LONG_DISTANCE: ['🚆', '#1c6dd0'], NIGHT_RAIL: ['🚆', '#1c6dd0'],
  REGIONAL_FAST_RAIL: ['🚆', '#1c6dd0'], REGIONAL_RAIL: ['🚆', '#1c6dd0'], SUBURBAN: ['🚈', '#1c6dd0'], FERRY: ['⛴️', '#0b7285'],
  FUNICULAR: ['🚞', '#5c940d'], AERIAL_LIFT: ['🚡', '#5c940d'], CABLE_CAR: ['🚡', '#5c940d'], AIRPLANE: ['✈️', '#495057'],
  WALK: ['🚶', '#868e96'], BIKE: ['🚲', '#868e96'], CAR: ['🚗', '#868e96'],
};
const modeIco = m => (MODE[m] || ['🚍'])[0];
function legColor(l) {
  const bg = l.routeColor && /^[0-9a-f]{6}$/i.test(l.routeColor) && l.routeColor.toLowerCase() !== 'ffffff' ? '#' + l.routeColor : (MODE[l.mode] || [0, '#495057'])[1];
  const fg = l.routeTextColor && /^[0-9a-f]{6}$/i.test(l.routeTextColor) && l.routeColor ? '#' + l.routeTextColor : '#ffffff';
  return { bg, fg };
}
function lineChip(l) {
  const { bg, fg } = legColor(l);
  const name = l.routeShortName || l.displayName || l.tripShortName || '';
  return `<span class="line" style="background:${bg};color:${fg}">${modeIco(l.mode)} ${esc(name)}</span>`;
}
// Delay label for a time pair, or empty when not live.
function liveLabel(realTime, actual, scheduled) {
  if (!realTime) return '';
  const d = Math.round((Date.parse(actual) - Date.parse(scheduled)) / 60000);
  if (d >= 2) return `<span class="late">${t('delayed', d)}</span>`;
  if (d <= -2) return `<span class="live">${t('early', -d)}</span>`;
  return `<span class="live">${t('live')}</span>`;
}

async function api(path, { timeout = 20000, signal } = {}) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeout);
  signal?.addEventListener('abort', () => ctl.abort());
  try {
    const r = await fetch(API + path, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(tm); }
}
const spinner = '<div class="spin" role="progressbar"></div>';
const errBox = () => `<div class="err"><span>${t('offline')}</span><button class="btn ghost" data-act="retry">${t('retry')}</button></div>`;

let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 3500);
}
function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'he' ? 'he-IL' : 'en-US';
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch {}
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
}

/* ---------------- state ---------------- */
const HERE = { here: true };
const S = {
  here: null, geoErr: null,
  from: HERE, to: null,
  timeMode: 'now', time: null,
  results: null,
};
const placeName = p => !p ? '' : p.here ? t('myLoc') : p.name;
const placeParam = p => p.here ? (S.here ? `${S.here.lat},${S.here.lon}` : null) : (p.type === 'STOP' && p.id ? p.id : `${p.lat},${p.lon}`);
const placeCoords = p => p.here ? S.here : p;
function addRecent(p) {
  if (!p || p.here) return;
  const r = store.get('recents', []).filter(x => !(x.name === p.name && Math.abs(x.lat - p.lat) < 1e-5));
  r.unshift({ name: p.name, lat: p.lat, lon: p.lon, type: p.type, id: p.id, sub: p.sub });
  store.set('recents', r.slice(0, 8));
}
const stopCache = {};

/* ---------------- map ---------------- */
const map = L.map('map', { zoomControl: false, attributionControl: true }).setView(store.get('view', [32.0853, 34.7818]), store.get('zoom', 15));
map.attributionControl.setPrefix(false);
const darkQ = matchMedia('(prefers-color-scheme: dark)');
// OpenStreetMap's standard tiles need no key; dark mode darkens them with a CSS filter (see index.html).
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://transitous.org/sources/">Transitous</a>',
}).addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const stopsLayer = L.layerGroup().addTo(map);
let meMarker = null, meCircle = null;
const casing = () => darkQ.matches ? '#0f1412' : '#ffffff';

function sheetH() { return $('#sheet').offsetHeight; }
function fitTo(latlngs, maxZoom = 17) {
  if (!latlngs.length) return;
  map.fitBounds(L.latLngBounds(latlngs), { paddingTopLeft: [40, 80], paddingBottomRight: [40, sheetH() + 30], maxZoom });
}
// Center a point in the part of the map that is not covered by the sheet.
function centerOn(lat, lon, zoom = map.getZoom()) {
  const p = map.project([lat, lon], zoom).add([0, sheetH() / 2]);
  map.setView(map.unproject(p, zoom), zoom);
}
const pinIcon = e => L.divIcon({ className: '', html: `<div class="pin">${e}</div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
function endpoints(a, b) {
  if (a) L.marker([a.lat, a.lon], { icon: L.divIcon({ className: '', html: '<div class="me" style="background:#0b7a5b"></div>', iconSize: [18, 18] }), interactive: false }).addTo(routeLayer);
  if (b) L.marker([b.lat, b.lon], { icon: pinIcon('📍'), interactive: false }).addTo(routeLayer);
}
function legPoints(l) {
  return l.legGeometry?.points ? decode(l.legGeometry.points, l.legGeometry.precision || 6) : [[l.from.lat, l.from.lon], [l.to.lat, l.to.lon]];
}
function drawItin(it) {
  const pts = [];
  for (const l of it.legs) {
    const ll = legPoints(l); pts.push(...ll);
    if (l.mode === 'WALK' || l.mode === 'BIKE') {
      L.polyline(ll, { color: '#6b7680', weight: 5, dashArray: '1 10', lineCap: 'round', interactive: false }).addTo(routeLayer);
    } else {
      const c = legColor(l).bg;
      L.polyline(ll, { color: casing(), weight: 10, interactive: false }).addTo(routeLayer);
      L.polyline(ll, { color: c, weight: 6, interactive: false }).addTo(routeLayer);
      for (const p of [l.from, l.to]) L.circleMarker([p.lat, p.lon], { radius: 6, color: c, weight: 3, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(p.name).addTo(routeLayer);
    }
  }
  const first = it.legs[0].from, last = it.legs.at(-1).to;
  endpoints(first, last);
  return pts;
}
function drawMe() {
  if (!S.here) return;
  const ll = [S.here.lat, S.here.lon];
  if (!meMarker) {
    meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18, 18] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
    meCircle = L.circle(ll, { radius: S.here.acc || 30, color: '#1c7ed6', weight: 1, fillOpacity: .08, interactive: false }).addTo(map);
  } else { meMarker.setLatLng(ll); meCircle.setLatLng(ll).setRadius(S.here.acc || 30); }
}

// Stops are drawn on the map when the home screen is open and the map is zoomed in.
let stopsTimer, stopsCtl;
function refreshMapStops() {
  clearTimeout(stopsTimer);
  stopsTimer = setTimeout(async () => {
    if (curView().name !== 'home' || map.getZoom() < 16) { stopsLayer.clearLayers(); return; }
    const b = map.getBounds();
    stopsCtl?.abort(); stopsCtl = new AbortController();
    try {
      const list = await api(`/v1/map/stops?min=${b.getSouth()},${b.getWest()}&max=${b.getNorth()},${b.getEast()}`, { signal: stopsCtl.signal });
      if (curView().name !== 'home') return;
      stopsLayer.clearLayers();
      for (const s of list.slice(0, 400)) {
        stopCache[s.stopId] = s;
        const c = (MODE[(s.modes || [])[0]] || [0, '#0f8a5f'])[1];
        L.circleMarker([s.lat, s.lon], { radius: 7, color: c, weight: 3, fillColor: '#fff', fillOpacity: 1 })
          .bindTooltip(esc(s.name), { direction: 'top', offset: [0, -6] })
          .on('click', () => go('stop', { id: s.stopId }))
          .addTo(stopsLayer);
      }
    } catch {}
  }, 350);
}
map.on('moveend', () => {
  const c = map.getCenter();
  store.set('view', [c.lat, c.lng]); store.set('zoom', map.getZoom());
  refreshMapStops();
});

/* ---------------- location ---------------- */
let hereListeners = new Set();
function startGeo() {
  if (!navigator.geolocation) { S.geoErr = 1; return; }
  navigator.geolocation.watchPosition(p => {
    const first = !S.here;
    S.here = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
    S.geoErr = null;
    drawMe();
    if (first && curView().name === 'home') centerOn(S.here.lat, S.here.lon, 16);
    hereListeners.forEach(f => f(first));
  }, err => {
    S.geoErr = err.code;
    hereListeners.forEach(f => f(false));
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}

/* ---------------- sheet ---------------- */
const SNAP = { peek: () => 170, half: () => innerHeight * 0.48, full: () => innerHeight - 64 - safeTop() };
function safeTop() { return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0; }
let snap = 'half';
function setSnap(s) {
  snap = s;
  document.documentElement.style.setProperty('--h', Math.round(SNAP[s]()) + 'px');
}
(function sheetDrag() {
  const sheet = $('#sheet'), grab = $('#grab'), bar = $('#bar');
  let y0 = null, h0 = 0, moved = false;
  const down = e => { y0 = e.clientY; h0 = sheet.offsetHeight; moved = false; sheet.classList.add('dragging'); e.target.setPointerCapture?.(e.pointerId); };
  const move = e => {
    if (y0 == null) return;
    const dy = y0 - e.clientY; if (Math.abs(dy) > 4) moved = true;
    const h = Math.min(SNAP.full(), Math.max(110, h0 + dy));
    document.documentElement.style.setProperty('--h', h + 'px');
  };
  const up = () => {
    if (y0 == null) return; y0 = null; sheet.classList.remove('dragging');
    if (!moved) { setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half'); return; }
    const h = sheet.offsetHeight;
    const best = Object.keys(SNAP).sort((a, b) => Math.abs(SNAP[a]() - h) - Math.abs(SNAP[b]() - h))[0];
    setSnap(best);
  };
  for (const el of [grab]) { el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); }
  bar.addEventListener('pointerdown', e => { if (!e.target.closest('button')) down(e); });
  bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  addEventListener('resize', () => setSnap(snap));
})();

/* ---------------- router ---------------- */
const stack = [];
let cleanup = null, token = 0;
const curView = () => stack.at(-1) || { name: 'home', params: {} };
const alive = tk => tk === token;
function go(name, params = {}, { replace = false } = {}) {
  if (replace) stack.pop();
  stack.push({ name, params });
  show();
}
function back() { if (stack.length > 1) { stack.pop(); show(); } }
function show() {
  try { cleanup?.(); } catch {}
  cleanup = null; hereListeners.clear();
  routeLayer.clearLayers();
  document.body.classList.remove('picking');
  const v = curView(); const tk = ++token;
  $('#bar').hidden = stack.length <= 1;
  $('#title').textContent = '';
  $('#body').scrollTop = 0;
  cleanup = VIEWS[v.name](v.params, tk) || null;
  refreshMapStops();
}
const setTitle = s => { $('#title').innerHTML = s; };
const body = () => $('#body');

/* ---------------- views ---------------- */
const VIEWS = {};

VIEWS.home = (p, tk) => {
  const homeP = store.get('home'), workP = store.get('work'), favs = store.get('favStops', []), recents = store.get('recents', []);
  const shortcut = (key, place, setLabel, icon) => place
    ? `<button class="chip-btn" data-act="goSaved" data-arg="${key}">${icon} ${t(key)}<span class="edit" data-act="search" data-arg="${key}" aria-label="edit">✎</span></button>`
    : `<button class="chip-btn" data-act="search" data-arg="${key}">${icon} ${setLabel}</button>`;
  body().innerHTML = `
    <button class="search-pill" data-act="search" data-arg="to">🔍 <span>${t('whereTo')}</span></button>
    <div class="chips">${shortcut('home', homeP, t('setHome'), '🏠')}${shortcut('work', workP, t('setWork'), '💼')}</div>
    ${favs.length ? `<h3>${t('favStops')}</h3><div class="list">${favs.map(s => stopRow(s)).join('')}</div>` : ''}
    ${recents.length ? `<h3>${t('recents')}</h3><div class="list">${recents.map((r, i) => `
      <button class="row" data-act="goRecent" data-arg="${i}"><span class="ico">🕘</span><span class="main"><b>${esc(r.name)}</b>${r.sub ? `<span>${esc(r.sub)}</span>` : ''}</span></button>`).join('')}</div>` : ''}
    <h3>${t('nearby')}</h3><div id="nearby" class="list">${S.here ? spinner : `<p class="muted">${S.geoErr ? t('needLoc') : t('locating')}</p>`}</div>
    <p class="muted small">${t('stopsOnMap')}</p>
    <p class="credit">${t('noData')}</p>`;
  let loaded = false;
  const load = async () => {
    if (!S.here || loaded) { if (!S.here && S.geoErr && alive(tk)) $('#nearby').innerHTML = `<p class="muted">${t('needLoc')}</p>`; return; }
    loaded = true;
    const { lat, lon } = S.here, dLat = 0.0045, dLon = 0.0045 / Math.cos(lat * Math.PI / 180);
    try {
      const list = await api(`/v1/map/stops?min=${lat - dLat},${lon - dLon}&max=${lat + dLat},${lon + dLon}`);
      if (!alive(tk)) return;
      list.forEach(s => { s.d = haversine(S.here, s); stopCache[s.stopId] = s; });
      list.sort((a, b) => a.d - b.d);
      $('#nearby').innerHTML = list.length ? list.slice(0, 12).map(s => stopRow(s, s.d)).join('') : `<p class="muted">${t('noDeps')}</p>`;
    } catch { if (alive(tk)) { loaded = false; $('#nearby').innerHTML = errBox(); } }
  };
  hereListeners.add(load); load();
};
function stopRow(s, d) {
  stopCache[s.stopId] ??= s;
  const sub = [d != null ? dist(d) : '', s.stopCode ? t('stopCode', s.stopCode) : '', cleanDesc(s.description)].filter(Boolean).join(' · ');
  return `<button class="row" data-act="stop" data-arg="${esc(s.stopId)}"><span class="ico">${(s.modes || ['BUS']).map(modeIco).slice(0, 2).join('')}</span>
    <span class="main"><b>${esc(s.name)}</b><span>${esc(sub)}</span></span></button>`;
}

let searchResults = [];
VIEWS.search = ({ field }, tk) => {
  setTitle(esc(field === 'from' ? t('from') : field === 'to' ? t('to') : field === 'home' ? t('setHome') : t('setWork')));
  setSnap('full');
  body().innerHTML = `<div class="searchbox"><input id="q" type="search" placeholder="${t('searchPh')}" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false"></div><div id="sr" class="list"></div>`;
  const q = $('#q'), sr = $('#sr');
  const defaults = () => {
    const homeP = store.get('home'), workP = store.get('work');
    const rows = [];
    if (field !== 'home' && field !== 'work') rows.push(`<button class="row" data-act="pickHere"><span class="ico">◎</span><span class="main"><b>${t('myLoc')}</b></span></button>`);
    rows.push(`<button class="row" data-act="pickMap"><span class="ico">🗺️</span><span class="main"><b>${t('chooseMap')}</b></span></button>`);
    searchResults = [];
    if (field === 'from' || field === 'to') {
      if (homeP) { searchResults.push(homeP); rows.push(resultRow(homeP, searchResults.length - 1, '🏠', t('home'))); }
      if (workP) { searchResults.push(workP); rows.push(resultRow(workP, searchResults.length - 1, '💼', t('work'))); }
      for (const s of store.get('favStops', [])) { const pl = { name: s.name, lat: s.lat, lon: s.lon, type: 'STOP', id: s.stopId }; searchResults.push(pl); rows.push(resultRow(pl, searchResults.length - 1, '⭐')); }
    }
    for (const r of store.get('recents', [])) { searchResults.push(r); rows.push(resultRow(r, searchResults.length - 1, '🕘')); }
    sr.innerHTML = rows.join('');
  };
  defaults();
  let timer, ctl;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    const text = q.value.trim();
    if (text.length < 2) { ctl?.abort(); defaults(); return; }
    timer = setTimeout(async () => {
      ctl?.abort(); ctl = new AbortController();
      const bias = S.here ? `&place=${S.here.lat},${S.here.lon}&placeBias=5` : (() => { const c = map.getCenter(); return `&place=${c.lat},${c.lng}&placeBias=2`; })();
      try {
        const res = await api(`/v1/geocode?text=${encodeURIComponent(text)}&language=${lang}${bias}`, { signal: ctl.signal });
        if (!alive(tk) || q.value.trim() !== text) return;
        searchResults = res.slice(0, 12).map(m => ({ name: placeLabel(m), lat: m.lat, lon: m.lon, type: m.type, id: m.id, sub: [m.type === 'ADDRESS' ? '' : '', areaName(m)].filter(Boolean).join(', ') }));
        sr.innerHTML = searchResults.length ? searchResults.map((m, i) => resultRow(m, i, m.type === 'STOP' ? '🚏' : m.type === 'ADDRESS' ? '🏠' : '📍')).join('') : `<p class="muted">${t('noResults')}</p>`;
      } catch (e) { if (e.name !== 'AbortError' && alive(tk)) sr.innerHTML = errBox(); }
    }, 250);
  });
  setTimeout(() => q.focus(), 50);
  return () => { clearTimeout(timer); ctl?.abort(); };
};
function resultRow(m, i, icon, label) {
  return `<button class="row" data-act="pick" data-arg="${i}"><span class="ico">${icon}</span><span class="main"><b>${esc(label || m.name)}</b>${label ? `<span>${esc(m.name)}</span>` : m.sub ? `<span>${esc(m.sub)}</span>` : ''}</span></button>`;
}
function choose(field, place) {
  while (['search', 'pick'].includes(curView().name)) stack.pop();
  if (field === 'home' || field === 'work') {
    store.set(field, { name: place.name, lat: place.lat, lon: place.lon, type: place.type, id: place.id });
    show(); return;
  }
  S[field] = place; addRecent(place);
  if (field === 'to' && !S.from) S.from = HERE;
  S.results = null;
  if (curView().name === 'plan') show(); else go('plan');
}

VIEWS.pick = ({ field }, tk) => {
  setTitle(esc(t('chooseMap')));
  setSnap('peek');
  document.body.classList.add('picking');
  body().innerHTML = `<p class="muted small" style="margin:0 0 8px">${t('movePin')}</p><button class="btn wide" data-act="usePoint" data-arg="${field}">📍 ${t('usePoint')}</button>`;
};
// The pin sits at the center of the visible map area (above the sheet).
function pickedLatLng() {
  const s = map.getSize();
  return map.containerPointToLatLng([s.x / 2, (s.y - sheetH()) / 2]);
}

VIEWS.plan = (p, tk) => {
  setTitle(esc(t('route')));
  if (snap === 'full' || snap === 'peek') setSnap('half');
  const tmChip = m => `<button class="chip-btn ${S.timeMode === m ? 'on' : ''}" data-act="timeMode" data-arg="${m}">${t(m)}</button>`;
  const tv = S.time ? new Date(S.time.getTime() - S.time.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  body().innerHTML = `
    <div class="od">
      <button class="od-row" data-act="search" data-arg="from"><span class="dot"></span>${S.from ? `<span>${esc(placeName(S.from))}</span>` : `<span class="ph">${t('from')}</span>`}</button>
      <button class="od-row" data-act="search" data-arg="to"><span class="dot d"></span>${S.to ? `<span>${esc(placeName(S.to))}</span>` : `<span class="ph">${t('to')}</span>`}</button>
      <button class="swap" data-act="swap" aria-label="swap">⇅</button>
    </div>
    <div class="when">${tmChip('now')}${tmChip('depart')}${tmChip('arrive')}
      ${S.timeMode !== 'now' ? `<input type="datetime-local" id="tt" value="${tv}">` : ''}</div>
    <div id="res">${spinner}</div>`;
  $('#tt')?.addEventListener('change', e => { if (e.target.value) { S.time = new Date(e.target.value); S.results = null; show(); } });
  const a = S.from && placeCoords(S.from), b = S.to && placeCoords(S.to);
  endpoints(a, b);
  if (a && b) fitTo([[a.lat, a.lon], [b.lat, b.lon]], 15);
  const run = async (more) => {
    const res = $('#res');
    if (!S.from || !S.to) { res.innerHTML = ''; return; }
    const fp = placeParam(S.from), tp = placeParam(S.to);
    if (!fp || !tp) { res.innerHTML = `<p class="muted">${S.geoErr ? t('noLoc') : t('locating')}</p>`; return; }
    if (S.results && !more) { renderResults(); return; }
    let q = `/v5/plan?fromPlace=${encodeURIComponent(fp)}&toPlace=${encodeURIComponent(tp)}&language=${lang}`;
    if (S.timeMode !== 'now' && S.time) q += `&time=${S.time.toISOString()}&arriveBy=${S.timeMode === 'arrive'}`;
    if (more) q += `&pageCursor=${encodeURIComponent(S.results.next)}`;
    if (more) $('#more').outerHTML = spinner;
    try {
      const d = await api(q, { timeout: 30000 });
      if (!alive(tk)) return;
      if (more) { S.results.its.push(...d.itineraries); S.results.next = d.nextPageCursor; }
      else S.results = { its: d.itineraries || [], direct: (d.direct || []).filter(x => x.legs?.length === 1 && x.legs[0].mode === 'WALK'), next: d.nextPageCursor, key: fp + tp };
      renderResults();
    } catch { if (alive(tk)) res.innerHTML = errBox(); }
  };
  const renderResults = () => {
    const { its, direct, next } = S.results;
    const tz = its[0]?.legs[0]?.from?.tz;
    let h = '';
    if (direct[0] && direct[0].duration <= 3600) {
      h += `<button class="card" data-act="itin" data-arg="d0"><div class="card-top"><b>🚶 ${t('walkOnly')}</b><span class="dur">${dur(direct[0].duration)}</span></div><div class="sub">${dist(direct[0].legs[0].distance || 0)}</div></button>`;
    }
    h += its.map((it, i) => itinCard(it, i, tz)).join('');
    if (!its.length && !direct.length) h = `<p class="muted">${t('noRoutes')}</p>`;
    if (next && its.length) h += `<button id="more" class="btn ghost wide" data-act="more">${t('later')}</button>`;
    $('#res').innerHTML = h;
  };
  VIEWS.plan.more = () => run(true);
  hereListeners.add(first => { if (S.from?.here && !S.results) run(false); });
  run(false);
};
function itinCard(it, i, tz) {
  const legs = it.legs.filter(l => !(l.mode === 'WALK' && l.duration < 60 && it.legs.length > 1));
  const parts = legs.map(l => l.mode === 'WALK' ? `<span class="walk">🚶<small>${Math.round(l.duration / 60)}</small></span>` : lineChip(l));
  const ft = it.legs.find(l => l.mode !== 'WALK');
  let sub = t('transfers', it.transfers);
  if (ft) {
    const n = minsUntil(ft.startTime);
    sub = `${liveLabel(ft.realTime, ft.startTime, ft.scheduledStartTime)} ${n >= 0 && n < 90 ? esc(t('leaves', n)) : fmtTime(ft.startTime, tz)} · ${esc(ft.from.name)} · ${t('transfers', it.transfers)}`;
  }
  return `<button class="card" data-act="itin" data-arg="${i}">
    <div class="card-top"><b>${fmtTime(it.startTime, tz)} – ${fmtTime(it.endTime, tz)}</b><span class="dur">${dur(it.duration)}</span></div>
    <div class="legs">${parts.join('<span class="sep">›</span>')}</div><div class="sub">${sub}</div></button>`;
}
const getItin = arg => String(arg).startsWith('d') ? S.results?.direct[+arg.slice(1)] : S.results?.its[+arg];

VIEWS.itin = ({ i }, tk) => {
  const it = getItin(i);
  if (!it) { back(); return; }
  const tz = it.legs[0].from.tz;
  setTitle(`<span dir="ltr">${fmtTime(it.startTime, tz)} – ${fmtTime(it.endTime, tz)}</span> · ${dur(it.duration)}`);
  setSnap('half');
  fitTo(drawItin(it));
  let h = `<div class="btns"><button class="btn" data-act="nav" data-arg="${i}">▶ ${t('start')}</button></div><ol class="tl">`;
  it.legs.forEach((l, k) => {
    const fromName = k === 0 ? placeName(S.from) : l.from.name;
    h += `<li class="place"><span class="t">${fmtTime(l.startTime, tz)}</span><span class="rail"></span><div class="c">${esc(fromName)}</div></li>`;
    if (l.mode === 'WALK' || l.mode === 'BIKE') {
      h += `<li class="seg walk"><span class="t"></span><span class="rail"></span><div class="c">🚶 ${t('walk')} ${dur(l.duration)} · ${dist(l.distance || 0)}</div></li>`;
    } else {
      const stops = l.intermediateStops || [];
      const c = legColor(l).bg;
      h += `<li class="seg" style="--c:${c}"><span class="t"></span><span class="rail"></span><div class="c">
        <div class="head"><button class="line" style="border:0;background:${c};color:${legColor(l).fg}" data-act="trip" data-arg="${esc(l.tripId)}">${modeIco(l.mode)} ${esc(l.routeShortName || l.displayName || '')}</button>
          <span>${esc(t('towards', cleanHeadsign(l.headsign)))}</span></div>
        <div>${esc(l.agencyName || '')} ${liveLabel(l.realTime, l.startTime, l.scheduledStartTime)}</div>
        <details><summary>${t('stops', stops.length + 1)} · ${dur(l.duration)}</summary><ol>
          ${stops.map(s => `<li><span>${esc(s.name)}</span><span class="muted">${fmtTime(s.departure || s.arrival, tz)}</span></li>`).join('')}
        </ol></details></div></li>`;
    }
  });
  const last = it.legs.at(-1);
  h += `<li class="place"><span class="t">${fmtTime(last.endTime, tz)}</span><span class="rail"></span><div class="c">${esc(placeName(S.to) || last.to.name)}</div></li></ol>`;
  body().innerHTML = h;
};

VIEWS.stop = ({ id }, tk) => {
  const s0 = stopCache[id];
  setTitle(esc(s0?.name || ''));
  if (snap === 'peek') setSnap('half');
  const favs = store.get('favStops', []);
  const isFav = favs.some(f => f.stopId === id);
  body().innerHTML = `<div class="stop-head"><div class="sub" id="ssub">${esc([s0?.stopCode && t('stopCode', s0.stopCode), cleanDesc(s0?.description)].filter(Boolean).join(' · '))}</div>
    <div class="btns"><button class="btn" data-act="dirTo" data-arg="${esc(id)}">↱ ${t('dirHere')}</button>
    <button class="btn ghost" data-act="fav" data-arg="${esc(id)}">${isFav ? '★ ' + t('saved') : '☆ ' + t('save')}</button></div></div>
    <h3>${t('departures')}</h3><div id="deps" class="list">${spinner}</div>`;
  let marked = false;
  const mark = s => {
    if (marked || !s) return; marked = true;
    L.circleMarker([s.lat, s.lon], { radius: 10, color: (MODE[(s.modes || [])[0]] || [0, '#0f8a5f'])[1], weight: 4, fillColor: '#fff', fillOpacity: 1 }).addTo(routeLayer);
    centerOn(s.lat, s.lon, Math.max(map.getZoom(), 17));
  };
  mark(s0);
  const load = async () => {
    try {
      const d = await api(`/v5/stoptimes?stopId=${encodeURIComponent(id)}&n=24&language=${lang}`);
      if (!alive(tk)) return;
      const pl = d.place || d.stopTimes?.[0]?.place;
      if (pl) {
        stopCache[id] = { ...(stopCache[id] || {}), ...pl, stopId: id };
        if (!s0) { setTitle(esc(pl.name)); $('#ssub').textContent = [pl.stopCode && t('stopCode', pl.stopCode), cleanDesc(pl.description)].filter(Boolean).join(' · '); }
        mark(pl);
      }
      const list = (d.stopTimes || []).filter(x => !x.place?.cancelled && minsUntil(x.place.departure || x.place.arrival) > -2);
      $('#deps').innerHTML = list.length ? list.map(x => depRow(x)).join('') : `<p class="muted">${t('noDeps')}</p>`;
    } catch { if (alive(tk)) $('#deps').innerHTML = errBox(); }
  };
  load();
  const iv = setInterval(load, 30000);
  return () => clearInterval(iv);
};
function depRow(x) {
  const p = x.place, when = p.departure || p.arrival, sch = p.scheduledDeparture || p.scheduledArrival;
  const n = minsUntil(when);
  const big = n < 60 ? (n <= 0 ? (lang === 'he' ? 'עכשיו' : 'Now') : t('min', n)) : fmtTime(when, p.tz);
  const live = x.realTime ? liveLabel(true, when, sch) : `<span class="muted">${fmtTime(when, p.tz)}</span>`;
  const leg = { ...x, mode: x.mode };
  return `<button class="row dep" data-act="trip" data-arg="${esc(x.tripId)}"><span>${lineChip(leg)}</span>
    <span class="main"><b>${esc(cleanHeadsign(x.headsign))}</b><span>${esc(x.agencyName || '')}${p.track ? ' · ' + esc(p.track) : ''}</span></span>
    <span class="end"><b>${big}</b><span>${live}</span></span></button>`;
}

VIEWS.trip = ({ id }, tk) => {
  if (snap === 'peek') setSnap('half');
  body().innerHTML = spinner;
  const load = async (first) => {
    try {
      const d = await api(`/v5/trip?tripId=${encodeURIComponent(id)}&language=${lang}`);
      if (!alive(tk)) return;
      const l = d.legs[0], tz = l.from.tz, c = legColor(l);
      setTitle(`${lineChip(l)} <span style="font-weight:600">${esc(cleanHeadsign(l.headsign))}</span>`);
      const all = [l.from, ...(l.intermediateStops || []), l.to];
      const now = Date.now();
      let nextIdx = all.findIndex(s => Date.parse(s.departure || s.arrival) > now);
      if (nextIdx < 0) nextIdx = all.length;
      body().innerHTML = `<div class="muted small" style="margin-bottom:6px">${esc(l.agencyName || '')} ${liveLabel(l.realTime, l.startTime, l.scheduledStartTime)}</div>
        <div class="list trip-stops" style="--c:${c.bg}">${all.map((s, k) => `
        <button class="row ${k < nextIdx ? 'past' : k === nextIdx ? 'next' : ''}" data-act="stop" data-arg="${esc(s.stopId)}" ${k === nextIdx ? 'id="nextStop"' : ''}>
          <span class="ico"></span><span class="main"><b>${esc(s.name)}</b></span>
          <span class="end">${fmtTime(s.departure || s.arrival, tz)}</span></button>`).join('')}</div>`;
      all.forEach(s => { stopCache[s.stopId] ??= s; });
      if (first) {
        const ll = legPoints(l);
        L.polyline(ll, { color: casing(), weight: 10, interactive: false }).addTo(routeLayer);
        L.polyline(ll, { color: c.bg, weight: 6, interactive: false }).addTo(routeLayer);
        all.forEach((s, k) => L.circleMarker([s.lat, s.lon], { radius: 5, color: c.bg, weight: 3, fillColor: k < nextIdx ? c.bg : '#fff', fillOpacity: 1 }).bindTooltip(esc(s.name)).addTo(routeLayer));
        fitTo(ll, 16);
        $('#nextStop')?.scrollIntoView({ block: 'center' });
      }
    } catch { if (alive(tk) && first) body().innerHTML = errBox(); }
  };
  load(true);
  const iv = setInterval(() => load(false), 30000);
  return () => clearInterval(iv);
};

/* ---- live step-by-step guidance ---- */
VIEWS.nav = ({ i }, tk) => {
  const it = getItin(i);
  if (!it) { back(); return; }
  const tz = it.legs[0].from.tz;
  // Drop the tiny walks MOTIS adds between a stop and itself.
  const legs = it.legs.filter(l => !(l.mode === 'WALK' && l.duration < 60 && (l.distance || 0) < 40 && it.legs.length > 1));
  let cur = 0, prog = 0, alerted = -1, follow = true, wake = null;
  setTitle(esc(t('route')));
  setSnap('half');
  fitTo(drawItin(it));
  map.once('dragstart', () => { follow = false; });
  try { navigator.wakeLock?.request('screen').then(w => { wake = w; }).catch(() => {}); } catch {}

  const stopsOf = l => [l.from, ...(l.intermediateStops || []), l.to];
  // Where along a ride are we? Prefer GPS (nearest stop ahead), else the timetable.
  const progress = l => {
    const all = stopsOf(l);
    let idx = 0;
    const now = Date.now();
    all.forEach((s, k) => { if (Date.parse(s.departure || s.arrival) <= now) idx = k; });
    if (S.here && (S.here.acc || 99) < 150) {
      let best = -1, bd = 250;
      all.forEach((s, k) => { if (k >= prog) { const d = haversine(S.here, s); if (d < bd) { bd = d; best = k; } } });
      if (best >= 0) idx = best;
    }
    return Math.max(prog, idx);
  };
  const tick = () => {
    if (!alive(tk)) return;
    const l = legs[cur];
    if (!l) return render();
    const now = Date.now();
    if (l.mode === 'WALK' || l.mode === 'BIKE') {
      const near = S.here && haversine(S.here, l.to) < 35;
      const late = now > Date.parse(l.endTime) + 60000 && !S.here;
      if ((near || late) && cur < legs.length - 1) { cur++; prog = 0; }
      else if (near && cur === legs.length - 1) { cur = legs.length; speak(t('arrived')); }
    } else {
      const started = now >= Date.parse(l.startTime) - 30000 || (S.here && haversine(S.here, l.from) > 300);
      if (started) prog = progress(l);
      const left = stopsOf(l).length - 1 - prog;
      if (left === 1 && alerted !== cur) { alerted = cur; speak(`${t('getOffNow')} ${l.to.name}`); toast(`🔔 ${t('getOffNow')} ${l.to.name}`); }
      const atEnd = left <= 0 && (now > Date.parse(l.endTime) || (S.here && haversine(S.here, l.to) < 60));
      if (atEnd) { cur++; prog = 0; if (cur >= legs.length) speak(t('arrived')); }
    }
    render();
  };
  const render = () => {
    const l = legs[cur];
    let h = '';
    if (!l) {
      h = `<div class="nav-card"><div class="big">🎉 ${t('arrived')}</div><div class="meta">${esc(placeName(S.to))}</div></div>
           <div class="btns"><button class="btn" data-act="back">${t('end')}</button></div>`;
    } else {
      const step = `<div class="step">${t('step', cur + 1, legs.length)}</div>`;
      if (l.mode === 'WALK' || l.mode === 'BIKE') {
        const target = cur === legs.length - 1 ? placeName(S.to) : l.to.name;
        const d = S.here ? haversine(S.here, l.to) : l.distance || 0;
        const nl = legs[cur + 1];
        h = `<div class="nav-card">${step}<div class="big">🚶 ${esc(t('walkTo', target))}</div>
          <div class="meta"><span>${t('away', dist(d))}</span>${nl ? `<span>·</span>${lineChip(nl)}<span>${esc(t('leaves', minsUntil(nl.startTime)))}</span>` : ''}</div></div>`;
      } else {
        const all = stopsOf(l), left = all.length - 1 - prog;
        const waiting = Date.now() < Date.parse(l.startTime) && prog === 0;
        const name = l.routeShortName || l.displayName || '';
        h = `<div class="nav-card">${step}`;
        if (waiting) {
          const n = minsUntil(l.startTime);
          h += `<div class="big">${modeIco(l.mode)} ${esc(t('waitFor', name))}</div>
            <div class="meta">${lineChip(l)}<span>${esc(t('towards', cleanHeadsign(l.headsign)))}</span></div>
            <div class="meta" style="margin-top:8px"><span class="count">${n <= 0 ? '0' : n}</span><span>${esc(t('arrivesIn', n))} ${liveLabel(l.realTime, l.startTime, l.scheduledStartTime)}</span></div>
            <div class="muted small">${esc(l.from.name)} · ${fmtTime(l.startTime, tz)}</div>`;
        } else {
          h += `<div class="big ${left <= 1 ? 'alert' : ''}">${esc(t('offIn', left))}</div>
            <div class="meta">${lineChip(l)}<span>${esc(t('rideTo', l.to.name))}</span><span class="muted">${fmtTime(l.endTime, tz)}</span></div>
            <ol class="next-stops">${all.slice(prog + 1, prog + 5).map((s, k) => `<li class="${prog + 1 + k === all.length - 1 ? 'off' : ''}"><span>${esc(s.name)}</span><span class="muted">${fmtTime(s.arrival || s.departure, tz)}</span></li>`).join('')}</ol>`;
        }
        h += `</div>`;
      }
      h += `<div class="btns"><button class="btn ghost" data-act="navStep" data-arg="-1" ${cur === 0 ? 'disabled' : ''}>${t('prev')}</button>
        <button class="btn ghost" data-act="navStep" data-arg="1">${t('next')}</button>
        <button class="btn ghost" data-act="back">✕ ${t('end')}</button></div>`;
    }
    body().innerHTML = h;
  };
  VIEWS.nav.step = d => { cur = Math.max(0, Math.min(legs.length, cur + d)); prog = 0; render(); };
  // Keep live times fresh for the leg in progress.
  const refresh = async () => {
    const l = legs[cur];
    if (!l || !l.tripId) return;
    try {
      const d = await api(`/v5/trip?tripId=${encodeURIComponent(l.tripId)}`);
      const tl = d.legs?.[0]; if (!tl || !alive(tk)) return;
      const by = {}; [tl.from, ...(tl.intermediateStops || []), tl.to].forEach(s => { by[s.stopId] = s; });
      const upd = s => { const n = by[s.stopId]; if (n) { s.arrival = n.arrival || s.arrival; s.departure = n.departure || s.departure; } };
      stopsOf(l).forEach(upd);
      l.startTime = l.from.departure || l.startTime; l.endTime = l.to.arrival || l.endTime; l.realTime = tl.realTime;
      render();
    } catch {}
  };
  hereListeners.add(() => { if (follow && S.here) centerOn(S.here.lat, S.here.lon, Math.max(map.getZoom(), 16)); tick(); });
  tick();
  const iv = setInterval(tick, 5000), iv2 = setInterval(refresh, 30000);
  refresh();
  return () => { clearInterval(iv); clearInterval(iv2); try { wake?.release(); } catch {} };
};

/* ---------------- actions ---------------- */
const ACT = {
  back,
  retry: () => show(),
  lang: () => { lang = lang === 'he' ? 'en' : 'he'; store.set('lang', lang); applyLang(); show(); },
  locate: () => {
    if (S.here) centerOn(S.here.lat, S.here.lon, Math.max(map.getZoom(), 16));
    else toast(S.geoErr ? t('needLoc') : t('locating'));
  },
  search: field => go('search', { field }),
  pick: i => { const field = curView().params.field; choose(field, searchResults[+i]); },
  pickHere: () => choose(curView().params.field, HERE),
  pickMap: () => go('pick', { field: curView().params.field }),
  usePoint: async field => {
    const c = pickedLatLng();
    let name = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
    try {
      const r = await api(`/v1/reverse-geocode?place=${c.lat},${c.lng}&language=${lang}`, { timeout: 6000 });
      const m = r.find(x => x.type === 'ADDRESS') || r[0];
      if (m && haversine({ lat: c.lat, lon: c.lng }, m) < 150) name = placeLabel(m);
    } catch {}
    setSnap('half');
    choose(field, { name, lat: c.lat, lon: c.lng });
  },
  goSaved: (key, el, e) => {
    if (e.target.closest('.edit')) return go('search', { field: key });
    S.from = HERE; S.to = store.get(key); S.results = null; go('plan');
  },
  goRecent: i => { S.from = HERE; S.to = store.get('recents', [])[+i]; S.results = null; go('plan'); },
  swap: () => { [S.from, S.to] = [S.to, S.from]; S.results = null; show(); },
  timeMode: m => {
    S.timeMode = m;
    if (m !== 'now' && !S.time) { S.time = new Date(Math.ceil(Date.now() / 300000) * 300000); }
    S.results = null; show();
  },
  more: () => VIEWS.plan.more?.(),
  itin: i => go('itin', { i }),
  nav: i => go('nav', { i }),
  navStep: d => VIEWS.nav.step?.(+d),
  stop: id => go('stop', { id }),
  trip: id => { if (id) go('trip', { id }); },
  dirTo: id => {
    const s = stopCache[id]; if (!s) return;
    S.from = HERE; S.to = { name: s.name, lat: s.lat, lon: s.lon, type: 'STOP', id }; S.results = null;
    addRecent(S.to); go('plan');
  },
  fav: id => {
    const s = stopCache[id]; if (!s) return;
    let favs = store.get('favStops', []);
    if (favs.some(f => f.stopId === id)) favs = favs.filter(f => f.stopId !== id);
    else favs.unshift({ stopId: id, name: s.name, lat: s.lat, lon: s.lon, stopCode: s.stopCode, description: s.description, modes: s.modes });
    store.set('favStops', favs.slice(0, 20));
    show();
  },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  // The ✎ inside a shortcut chip has its own action.
  const inner = e.target.closest('.edit[data-act]');
  const target = inner || el;
  const fn = ACT[target.dataset.act];
  if (!fn) return;
  e.preventDefault(); e.stopPropagation();
  fn(target.dataset.arg, target, e);
});

/* ---------------- start ---------------- */
// iOS exposes the status-bar inset through CSS env(); read it once for sheet sizing.
(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden'; document.body.appendChild(d); document.documentElement.style.setProperty('--sat', d.offsetHeight + 'px'); d.remove(); })();
applyLang();
setSnap('half');
go('home');
startGeo();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
