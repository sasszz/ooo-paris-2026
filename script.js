// ── CONFIG ──
function getCfg() {
  return {
    apiKey:     localStorage.getItem('ooo_apikey')   || '',
    binId:      localStorage.getItem('ooo_binid')    || '',
    password:   localStorage.getItem('ooo_password') || 'vacation2025',
    returnDate: localStorage.getItem('ooo_return')   || '',
    contact:    localStorage.getItem('ooo_contact')  || '[your backup contact]',
  };
}

function saveConfig() {
  localStorage.setItem('ooo_apikey',   document.getElementById('cfg-apikey').value.trim());
  localStorage.setItem('ooo_binid',    document.getElementById('cfg-binid').value.trim());
  localStorage.setItem('ooo_password', document.getElementById('cfg-password').value || 'vacation2025');
  localStorage.setItem('ooo_return',   document.getElementById('cfg-return').value.trim());
  localStorage.setItem('ooo_contact',  document.getElementById('cfg-contact').value.trim());
  alert('Settings saved! Refresh to apply.');
}

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list)
    });
  } catch(e) { console.warn('checkins save failed'); }
}

// ── MAP ──
let map, markers;

function initMap() {
  map = L.map('map', { zoomControl: true, scrollWheelZoom: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', maxZoom: 18
  }).addTo(map);
  markers = L.featureGroup().addTo(map);
}

function makeIcon(isLatest) {
  const size = isLatest ? 16 : 11;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${isLatest ? '#c4602a' : '#8a7f72'};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)${isLatest ? ';animation:mpulse 2s ease-in-out infinite' : ''}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2]
  });
}

function renderMap(checkins) {
  markers.clearLayers();
  const geo = checkins.filter(c => c.lat != null && c.lng != null);
  if (!geo.length) { map.setView([20, 0], 2); return; }

  geo.forEach((c, i) => {
    const isLatest = i === geo.length - 1;
    const m = L.marker([c.lat, c.lng], { icon: makeIcon(isLatest) });
    const img = c.photoData ? `<img class="popup-img" src="${c.photoData}">` : '';
    const cap = c.caption ? `<div class="popup-cap">${c.caption.length > 70 ? c.caption.slice(0, 70) + '…' : c.caption}</div>` : '';
    m.bindPopup(
      `<div style="min-width:160px">${img}<div class="popup-loc">${c.location}</div>${cap}<div class="popup-time">${fmtShort(c.timestamp)}</div></div>`,
      { maxWidth: 230 }
    );
    markers.addLayer(m);
    if (isLatest) { setTimeout(() => m.openPopup(), 300); }
  });

  map.fitBounds(markers.getBounds(), { padding: [44, 44], maxZoom: 10 });
  const badge = document.getElementById('map-badge');
  badge.style.display = 'block';
  badge.textContent = `${geo.length} stop${geo.length !== 1 ? 's' : ''}`;
}

// ── PAGE RENDER ──
async function renderPage() {
  const cfg = getCfg();
  if (!cfg.apiKey || !cfg.binId) document.getElementById('setup-notice').style.display = 'block';
  document.getElementById('ooo-contact').textContent = cfg.contact;

  const checkins = await loadCheckins();
  document.getElementById('loading').style.display = 'none';
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
  if (cfg.returnDate) document.getElementById('back-date').textContent = cfg.returnDate;

  if (latest.photoData) {
    document.getElementById('photo-placeholder').style.display = 'none';
    const img = document.getElementById('checkin-photo');
    img.src = latest.photoData;
    img.style.display = 'block';
  }

  if (checkins.length > 1) {
    document.getElementById('history-section').style.display = 'block';
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    checkins.slice(0, -1).reverse().forEach(c => {
      const el = document.createElement('div');
      el.className = 'history-item';
      if (c.lat && c.lng) {
        el.onclick = () => { map.setView([c.lat, c.lng], 10); window.scrollTo({ top: 0, behavior: 'smooth' }); };
      }
      const thumb = c.photoData
        ? `<div class="history-thumb"><img src="${c.photoData}"></div>`
        : `<div class="history-thumb">📍</div>`;
      el.innerHTML = `${thumb}<div class="history-info"><div class="history-loc">${c.location}</div><div class="history-cap">${c.caption || ''}</div><div class="history-time">${fmtShort(c.timestamp)}</div></div>`;
      list.appendChild(el);
    });
  }

  document.getElementById('ooo-note').style.display = 'block';
}

// ── FORMATTERS ──
function fmtLong(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtShort(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── ADMIN ──
let unlocked = false;

function openAdmin() {
  const cfg = getCfg();
  ['cfg-apikey', 'cfg-binid', 'cfg-password', 'cfg-return', 'cfg-contact'].forEach((id, i) => {
    document.getElementById(id).value = [cfg.apiKey, cfg.binId, cfg.password, cfg.returnDate, cfg.contact][i];
  });
  document.getElementById('admin-overlay').classList.add('open');
  unlocked ? showPostView() : showLoginView();
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
  if (document.getElementById('pw-input').value === getCfg().password) {
    unlocked = true;
    showPostView();
  } else {
    document.getElementById('login-status').textContent = 'Incorrect password.';
  }
}

function toggleConfig() {
  document.getElementById('config-section').classList.toggle('open');
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

  let photoData = null;
  if (fileInput.files[0]) {
    try {
      photoData = await resizeImage(await fileToBase64(fileInput.files[0]), 1100, 0.78);
    } catch(e) { console.warn('image err', e); }
  }

  const entry = {
    location,
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    caption,
    photoData,
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
        input.value = item.display_name;
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
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
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
function fileToBase64(f) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function resizeImage(dataUrl, maxW, q) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      res(c.toDataURL('image/jpeg', q));
    };
    img.src = dataUrl;
  });
}

// ── INIT ──
initMap();
renderPage();