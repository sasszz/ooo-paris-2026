// ── CONFIG ──
const ADMIN_PASSWORD = 'wesley2026';

// ── DATA ──
async function loadCheckins() {
  try {
    const r = await fetch('/.netlify/functions/checkins');
    if (!r.ok) throw 0;
    return await r.json();
  } catch(e) { console.warn('checkins load failed'); }
  return JSON.parse(localStorage.getItem('ooo_checkins') || '[]');
}

async function saveCheckins(list) {
  localStorage.setItem('ooo_checkins', JSON.stringify(list));
  try {
    await fetch('/.netlify/functions/checkins', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': ADMIN_PASSWORD },
      body: JSON.stringify(list)
    });
  } catch(e) { console.warn('checkins save failed'); }
}

// ── MAP ──
let map, markers, markerMap = {}, _checkinByTs = {}, _totalCroissants = 0;


function initMap() {
  map = L.map('map', { zoomControl: true, scrollWheelZoom: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', maxZoom: 18
  }).addTo(map);
  markers = L.featureGroup().addTo(map);
}

function makeIcon(isLatest) {
  const size = isLatest ? 16 : 13;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${isLatest ? '#7B6FCD' : '#6B5FB0'};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)${isLatest ? ';animation:mpulse 2s ease-in-out infinite' : ''}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2]
  });
}

function renderMap(checkins) {
  markers.clearLayers();
  markerMap = {};
  const geo = checkins.filter(c => c.lat != null && c.lng != null);
  if (!geo.length) { map.setView([20, 0], 2); return; }
  _totalCroissants = checkins.reduce((sum, c) => sum + (c.croissants || 0), 0);
  const totalCroissants = _totalCroissants;

  geo.forEach((c, i) => {
    const isLatest = i === geo.length - 1;
    const m = L.marker([c.lat, c.lng], { icon: makeIcon(isLatest) });
    const img = c.photoUrl ? `<img class="popup-img" src="${c.photoUrl}">` : '';
    const cap = c.caption ? `<div class="popup-cap">${c.caption.length > 70 ? c.caption.slice(0, 70) + '…' : c.caption}</div>` : '';
    const crois = c.croissants ? `<div class="popup-croissants">${'🥐'.repeat(c.croissants)}</div>` : '';
    m.bindPopup(
      `<div class="popup-card" onclick="openLightboxByTs(${c.timestamp})">${img}<div class="popup-loc">${c.location}</div>${cap}${crois}<div class="popup-time">${fmtShort(c.timestamp)}</div></div>`,
      { maxWidth: 260 }
    );
    markers.addLayer(m);
    markerMap[`${c.lat},${c.lng},${c.timestamp}`] = m;
    if (isLatest) { setTimeout(() => m.openPopup(), 300); }
  });

  const latestGeo = geo[geo.length - 1];
  map.setView([latestGeo.lat, latestGeo.lng], 11);
  let miles = 0;
  for (let i = 1; i < geo.length; i++) miles += haversineMiles(geo[i-1].lat, geo[i-1].lng, geo[i].lat, geo[i].lng);
  const cities = new Set(geo.map(c => { const p = c.location.split(', '); return p.length >= 3 ? p[p.length - 2].trim() : null; }).filter(Boolean));
  const countries = new Set(geo.map(c => c.location.split(', ').pop().trim()));
  const stats = { stops: geo.length, cities: cities.size, countries: countries.size, miles: Math.round(miles), croissants: totalCroissants };

  const badge = document.getElementById('map-badge');
  const serif = s => `<span style="color:#FFB3C6;text-transform:none">${s}</span>`;
  const num = n => `<span style="color:#FFB3C6;font-weight:700">${n}</span>`;
  const arrow = `▾`;
  const stopLabel = () => `${stats.stops} stops ${serif('and counting')} ${arrow}`;
  badge.style.display = 'inline-flex';
  badge.innerHTML = stopLabel();
  badge.onclick = () => {
    const open = badge.classList.toggle('expanded');
    if (open) {
      badge.innerHTML = `
        <div class="badge-stat">${num(stats.stops)} stops ${serif('and counting')}</div>
        <div class="badge-stat">${num(stats.cities)} cit${stats.cities !== 1 ? 'ies' : 'y'}</div>
        <div class="badge-stat">${num(stats.countries)} countr${stats.countries !== 1 ? 'ies' : 'y'}</div>
        <div class="badge-stat">${num(stats.miles.toLocaleString())} mi traveled</div>
        ${stats.croissants ? `<div class="badge-stat">${num(stats.croissants)} 🥐 eaten</div>` : ''}
      `;
    } else {
      badge.innerHTML = stopLabel();
    }
  };
  document.addEventListener('click', e => {
    if (!badge.contains(e.target)) {
      badge.classList.remove('expanded');
      badge.innerHTML = stopLabel();
    }
  }, { capture: true, once: false });

}

// ── PAGE RENDER ──
async function renderPage() {
  const checkins = await loadCheckins();
  document.getElementById('loading').style.display = 'none';
  _checkinByTs = {};
  checkins.forEach(c => { _checkinByTs[c.timestamp] = c; });
  renderMap(checkins);

  if (!checkins.length) {
    document.getElementById('empty-state').style.display = 'block';
    return;
  }

  const latest = checkins[checkins.length - 1];
  document.getElementById('latest-section').style.display = 'block';
  document.getElementById('checkin-location').textContent = latest.location;
  document.getElementById('checkin-caption').textContent = latest.caption || '';
  document.getElementById('checkin-time').textContent = fmtLong(latest.timestamp);
  const croissantEl = document.getElementById('checkin-croissants');
  if (latest.croissants) { croissantEl.textContent = '🥐'.repeat(latest.croissants); croissantEl.style.display = 'block'; }
  else { croissantEl.style.display = 'none'; }

  const card = document.getElementById('checkin-card');
  if (latest.lat && latest.lng) {
    card.style.cursor = 'pointer';
    card.onclick = () => {
      map.setView([latest.lat, latest.lng], 13);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const m = markerMap[`${latest.lat},${latest.lng},${latest.timestamp}`];
      if (m) setTimeout(() => m.openPopup(), 350);
    };
  }

  if (latest.photoUrl) {
    document.getElementById('photo-placeholder').style.display = 'none';
    document.getElementById('checkin-caption').style.display = '';
    const img = document.getElementById('checkin-photo');
    img.src = latest.photoUrl;
    img.style.display = 'block';
  } else {
    const ph = document.getElementById('photo-placeholder');
    if (latest.caption) {
      ph.innerHTML = `<span>${latest.caption}</span>`;
      document.getElementById('checkin-caption').style.display = 'none';
    } else {
      ph.textContent = '🏝️';
    }
  }

  if (checkins.length > 1) {
    document.getElementById('history-section').style.display = 'block';
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    checkins.slice(0, -1).reverse().forEach(c => {
      const el = document.createElement('div');
      el.className = 'history-item';
      if (c.lat && c.lng) {
        el.onclick = () => {
          map.setView([c.lat, c.lng], 13);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          const m = markerMap[`${c.lat},${c.lng},${c.timestamp}`];
          if (m) setTimeout(() => m.openPopup(), 350);
        };
      }
      const ts = c.timestamp;
      const thumb = c.photoUrl
        ? `<div class="history-thumb" style="cursor:pointer" onclick="event.stopPropagation();openLightboxByTs(${ts})"><img src="${c.photoUrl}"></div>`
        : `<div class="history-thumb">📍</div>`;
      const croissantBit = c.croissants ? `<div class="history-croissants">${'🥐'.repeat(c.croissants)}</div>` : '';
      el.innerHTML = `${thumb}<div class="history-info"><div class="history-loc">${c.location}</div><div class="history-cap">${c.caption || ''}</div><div class="history-time">${fmtShort(c.timestamp)}</div></div>${croissantBit}`;
      list.appendChild(el);
    });
  }

  document.getElementById('ooo-note').style.display = 'block';
}

// ── FORMATTERS ──
function fmtLong(ts) {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function fmtShort(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── ADMIN ──
let unlocked = false;

function openAdmin() {
  unlocked = false;
  document.getElementById('pw-input').value = '';
  document.getElementById('login-status').textContent = '';
  document.getElementById('admin-overlay').classList.add('open');
  showLoginView();
}

function closeAdmin() {
  document.getElementById('admin-overlay').classList.remove('open');
}

function showLoginView() {
  document.getElementById('login-view').style.display = 'block';
  document.getElementById('post-view').style.display = 'none';
}

function showPostView() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('post-view').style.display = 'block';
}

function doLogin() {
  if (document.getElementById('pw-input').value === ADMIN_PASSWORD) {
    unlocked = true;
    showPostView();
  } else {
    document.getElementById('login-status').textContent = 'Incorrect password.';
  }
}

function adjustCroissants(delta) {
  const el = document.getElementById('croissant-count');
  el.textContent = Math.max(0, parseInt(el.textContent) + delta);
}

function previewPhoto(e) {
  const f = e.target.files[0];
  if (!f) return;
  const img = document.getElementById('preview-img');
  img.src = URL.createObjectURL(f);
  img.style.display = 'block';
}

// ── POST CHECK-IN ──
async function postCheckin() {
  const location = document.getElementById('post-location').value.trim();
  const lat = parseFloat(document.getElementById('post-lat').value);
  const lng = parseFloat(document.getElementById('post-lng').value);
  const caption = document.getElementById('post-caption').value.trim();
  const fileInput = document.getElementById('photo-file');
  const status = document.getElementById('post-status');
  const btn = document.getElementById('post-btn');

  if (!location) {
    status.innerHTML = '<span class="status-err">Please enter a location name.</span>';
    return;
  }

  btn.disabled = true;
  status.innerHTML = 'Uploading…';

  let photoUrl = null;
  if (fileInput.files[0]) {
    if (fileInput.files[0].size > 5 * 1024 * 1024) {
      status.innerHTML = '<span class="status-err">Photo must be under 5MB.</span>';
      btn.disabled = false;
      return;
    }
    try {
      status.innerHTML = 'Uploading photo…';
      photoUrl = await uploadToCloudinary(fileInput.files[0]);
    } catch(e) {
      console.warn('photo upload failed', e);
      status.innerHTML = '<span class="status-err">Photo upload failed. Try again.</span>';
      btn.disabled = false;
      return;
    }
  }

  const croissants = parseInt(document.getElementById('croissant-count').textContent) || 0;
  const entry = {
    location,
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    caption,
    photoUrl,
    croissants: croissants || undefined,
    timestamp: Date.now()
  };

  const list = await loadCheckins();
  list.push(entry);
  if (list.length > 20) list.splice(0, list.length - 20);
  await saveCheckins(list);

  status.innerHTML = '<span class="status-ok">✓ Posted! Refreshing…</span>';
  setTimeout(() => {
    closeAdmin();
    ['post-location', 'post-lat', 'post-lng', 'post-caption'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('croissant-count').textContent = '0';
    document.getElementById('photo-file').value = '';
    document.getElementById('preview-img').style.display = 'none';
    document.getElementById('post-status').innerHTML = '';
    btn.disabled = false;
    renderPage();
  }, 1200);
}

// ── LOCATION AUTOCOMPLETE ──
(function() {
  let debounceTimer = null;
  let activeIndex = -1;

  const input = document.getElementById('post-location');
  const list  = document.getElementById('location-suggestions');

  function showSuggestions(items) {
    list.innerHTML = '';
    activeIndex = -1;
    if (!items.length) { list.classList.remove('open'); return; }
    items.forEach((item, i) => {
      const li = document.createElement('li');
      const parts = item.display_name.split(', ');
      const main = parts[0];
      const sub  = parts.slice(1, 3).join(', ');
      li.innerHTML = `<div class="sug-main">${main}</div>${sub ? `<div class="sug-sub">${sub}</div>` : ''}`;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        const a = item.address || {};
        const place = item.display_name.split(', ')[0];
        const city = a.city || a.town || a.village || a.municipality || a.county || '';
        const country = a.country || '';
        input.value = [place, city, country].filter(Boolean).join(', ');
        document.getElementById('post-lat').value = parseFloat(item.lat).toFixed(6);
        document.getElementById('post-lng').value = parseFloat(item.lon).toFixed(6);
        list.classList.remove('open');
      });
      list.appendChild(li);
    });
    list.classList.add('open');
  }

  async function fetchSuggestions(q) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      showSuggestions(data);
    } catch(e) { /* silently ignore network errors */ }
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < 3) { list.classList.remove('open'); return; }
    debounceTimer = setTimeout(() => fetchSuggestions(q), 350);
  });

  input.addEventListener('keydown', e => {
    const items = list.querySelectorAll('li');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      items[activeIndex].dispatchEvent(new MouseEvent('mousedown'));
      return;
    } else if (e.key === 'Escape') {
      list.classList.remove('open'); return;
    } else { return; }
    items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.location-autocomplete')) list.classList.remove('open');
  });
})();

// ── HELPERS ──
async function uploadToCloudinary(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', 'ooo-paris-trip-2026');
  const r = await fetch('https://api.cloudinary.com/v1_1/dpf8t8yta/image/upload', {
    method: 'POST',
    body: form
  });
  if (!r.ok) throw new Error('Cloudinary upload failed');
  return (await r.json()).secure_url;
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── LIGHTBOX ──
function openLightbox(c) {
  const img = document.getElementById('lightbox-img');
  if (c.photoUrl) { img.src = c.photoUrl; img.style.display = 'block'; }
  else { img.style.display = 'none'; }
  document.getElementById('lightbox-location').textContent = c.location;
  const cap = document.getElementById('lightbox-caption');
  cap.textContent = c.caption || '';
  cap.style.display = c.caption ? 'block' : 'none';
  const timeEl = document.getElementById('lightbox-time');
  const croissantHtml = c.croissants ? `<span class="lightbox-croissant-inline">🥐 × ${c.croissants}</span>` : '';
  timeEl.innerHTML = `<span>${fmtLong(c.timestamp)}</span>${croissantHtml}`;
  document.getElementById('lightbox-croissants').style.display = 'none';
  document.getElementById('lightbox').classList.add('open');
}
function openLightboxByTs(ts) { openLightbox(_checkinByTs[ts]); }
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox-img').src = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ── FLIP COUNTDOWN ──
(function() {
  const TARGET = new Date('2026-06-22T00:00:00');
  const cards = {
    days:  document.getElementById('flip-days'),
    hours: document.getElementById('flip-hours'),
    mins:  document.getElementById('flip-mins'),
    secs:  document.getElementById('flip-secs'),
  };
  const prev = { days: null, hours: null, mins: null, secs: null };

  function flipCard(card, oldVal, newVal) {
    const fTop = card.querySelector('.flip-fold-top');
    const fBot = card.querySelector('.flip-fold-bot');
    fTop.querySelector('span').textContent = oldVal;
    fBot.querySelector('span').textContent = newVal;
    fTop.classList.remove('go');
    fBot.classList.remove('go');
    void fTop.offsetWidth;
    fTop.classList.add('go');
    fBot.classList.add('go');
    // Update statics only after each half has animated away
    setTimeout(() => { card.querySelector('.flip-upper span').textContent = newVal; }, 280);
    setTimeout(() => { card.querySelector('.flip-lower span').textContent = newVal; }, 560);
  }

  function tick() {
    const diff = TARGET - new Date();
    if (diff <= 0) return;
    const vals = {
      days:  String(Math.floor(diff / 86400000)).padStart(2, '0'),
      hours: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0'),
      mins:  String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
      secs:  String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
    };
    for (const [key, val] of Object.entries(vals)) {
      if (val === prev[key]) continue;
      const card = cards[key];
      if (prev[key] === null) {
        card.querySelectorAll('span').forEach(s => s.textContent = val);
      } else {
        flipCard(card, prev[key], val);
      }
      prev[key] = val;
    }
  }

  tick();
  setInterval(tick, 1000);
})();

// ── CROISSANT POPUP ──
const CROISSANT_MSGS = [
  "Félicitations! You found the secret croissant.",
  "The croissant spins because it's trying to find its way back to the boulangerie.",
  "Fun fact: the croissant was actually invented in Austria. Don't tell the French.",
  "At this rate, Lucie may need a second suitcase just for croissants.",
  "Lucie is somewhere in France right now, probably holding a croissant.",
  "You caught it! The croissant was not expecting this.",
  "A croissant a day keeps the sadness away. Science has not confirmed this, but Lucie believes it.",
  "The word croissant means 'crescent' in French. The moon is also beautiful. Coincidence? Non.",
  "You have found the golden croissant. You will have good luck today!",
  "In a parallel universe, Lucie is eating a croissant right now. In this universe: also yes.",
  "Congratulations! You are the most dedicated croissant-clicker on the internet.",
  "They say patience is a virtue. They clearly haven't waited for croissants to come out of the oven.",
  "Mon dieu! You clicked the croissant!",
  "The croissant does not judge. The croissant only nourishes.",
  "This croissant has traveled far to reach you. From France, to this screen, to your cursor.",
  "The croissant has no enemies... except for people who haven't tried one yet...",
  "Real croissants: crescent-shaped, flaky, buttery. Grocery store croissants: we don't talk about those.",
  "You are now a member of the Croissant Lover club. Welcome! We've been expecting you.",
  "The secret to a perfect croissant is time. Also butter. Mostly butter.",
  "Lucie counted. There is no such thing as too many croissants.",
];
let _lastCroissantMsg = -1;
let _croissantPopupJustOpened = false;

function openCroissantPopup() {
  let idx;
  do { idx = Math.floor(Math.random() * CROISSANT_MSGS.length); } while (idx === _lastCroissantMsg);
  _lastCroissantMsg = idx;
  document.getElementById('croissant-popup-msg').textContent = CROISSANT_MSGS[idx];
  document.getElementById('croissant-popup').classList.add('open');
  const bouncer = document.getElementById('bouncing-croissant');
  if (bouncer) bouncer.remove();
  _croissantPopupJustOpened = true;
  setTimeout(() => { _croissantPopupJustOpened = false; }, 300);
}
function closeCroissantPopup() {
  if (_croissantPopupJustOpened) return;
  document.getElementById('croissant-popup').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCroissantPopup(); });

// ── CROISSANT RAIN ──
function startBouncingCroissant() {
  const el = document.createElement('div');
  el.id = 'bouncing-croissant';
  el.textContent = '🥐';
  el.addEventListener('pointerdown', e => { e.stopPropagation(); openCroissantPopup(); });
  document.body.appendChild(el);

  const size = 52;
  let x = Math.random() * (window.innerWidth - size);
  let y = Math.random() * (window.innerHeight - size);
  let vx = (Math.random() > 0.5 ? 1 : -1) * 1.1;
  let vy = (Math.random() > 0.5 ? 1 : -1) * 1.1;
  let angle = 0;

  function frame() {
    x += vx;
    y += vy;
    angle += 1.2;
    if (x <= 0) { x = 0; vx = Math.abs(vx); }
    else if (x >= window.innerWidth - size) { x = window.innerWidth - size; vx = -Math.abs(vx); }
    if (y <= 0) { y = 0; vy = Math.abs(vy); }
    else if (y >= window.innerHeight - size) { y = window.innerHeight - size; vy = -Math.abs(vy); }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = `rotate(${angle}deg)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function rainCroissants() {
  const count = 35;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'croissant-rain-item';
    el.textContent = '🥐';
    el.style.left = (Math.random() * 100) + 'vw';
    el.style.fontSize = (1.2 + Math.random() * 1.6) + 'rem';
    const duration = 2.5 + Math.random() * 2.5;
    const delay = Math.random() * 2.5;
    el.style.animationDuration = duration + 's';
    el.style.animationDelay = delay + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), (duration + delay) * 1000 + 200);
  }
  setTimeout(startBouncingCroissant, 8000);
}

// ── MAP SCROLL BUTTON (mobile only) ──
(function() {
  const btn = document.getElementById('map-scroll-btn');
  const mapWrap = document.getElementById('map-wrap');
  if (window.matchMedia('(max-width:900px)').matches) {
    new IntersectionObserver(([entry]) => {
      btn.style.display = entry.isIntersecting ? 'flex' : 'none';
    }, { threshold: 0.1 }).observe(mapWrap);
  }
})();

// ── INIT ──
initMap();
renderPage();
rainCroissants();