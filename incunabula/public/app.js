const PROVIDERS = [
  { id:'tokenrouter', name:'TokenRouter', color:'#0ea5e9', baseURL:'https://api.tokenrouter.com/v1', defaultModel:'z-ai/glm-5.3-free', icon:'https://www.tokenrouter.com/logo-without-title.png' },
  { id:'nvidia', name:'NVIDIA NIM', color:'#76b900', baseURL:'https://integrate.api.nvidia.com/v1', defaultModel:'meta/llama-3.3-70b-instruct', icon:'https://developer.download.nvidia.com/icons/m48-nim-256px-blk.png' },
  { id:'tokenharbor', name:'Token Harbor', color:'#f97316', baseURL:'https://tokenharbor.ai/v1', defaultModel:'deepseek-v4-flash' },
  { id:'tokenforge', name:'Token Forge', color:'#ef4444', baseURL:'https://tokenforge.ai.studio/v1', defaultModel:'claude-opus-5' },
  { id:'orcarouter', name:'OrcaRouter', color:'#f59e0b', baseURL:'https://www.orcarouter.ai/v1', defaultModel:'orcarouter/free', icon:'https://www.orcarouter.ai/orca-logo.png' },
  { id:'inception', name:'Inception', color:'#ff3b30', baseURL:'https://api.inceptionlabs.ai/v1', defaultModel:'mercury', icon:'https://inceptionlabs.ai/favicon.ico' },
  { id:'kilo', name:'Kilo Gate', color:'#ff6a00', baseURL:'https://api.kilo.ai/api/gateway', noAuth:true, defaultModel:'anthropic/claude-sonnet-4.5', icon:'https://kilo.ai/favicon.ico' },
  { id:'apinex', name:'APInex', color:'#5C766D', baseURL:'https://api.apinex.bond/v1', defaultModel:'free/deepseek-v4.1-flash', icon:'https://www.google.com/s2/favicons?domain=apinex.bond&sz=128' },
];

const SVG = (i) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${i}</svg>`;
const ICON = {
  bolt: SVG('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  copy: SVG('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  reload: SVG('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>'),
  trash: SVG('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'),
  edit: SVG('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
  check: SVG('<polyline points="20 6 9 17 4 12"/>'),
  search: SVG('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  plus: SVG('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  key: SVG('<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'),
  lock: SVG('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  unlock: SVG('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
  terminal: SVG('<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>'),
  layers: SVG('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
  github: SVG('<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>'),
  external: SVG('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
  menu: SVG('<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>'),
  x: SVG('<path d="M18 6L6 18"/><path d="M6 6l12 12"/>'),
  zap: SVG('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  shield: SVG('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  refresh: SVG('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'),
  power: SVG('<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>'),
  book: SVG('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  cpu: SVG('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/>'),
  radio: SVG('<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/>'),
  eye: SVG('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: SVG('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'),
  copyCheck: SVG('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/><polyline points="9 14 11 16 15 12"/>'),
  reset: SVG('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><line x1="8" y1="15" x2="16" y2="15"/>'),
  link: SVG('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
};

const API_BASE = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.hostname.endsWith('.trycloudflare.com'))
  ? location.origin
  : "https://ai.labai.workers.dev";
const api = (fn) => API_BASE + '/.netlify/functions/' + fn;

async function callGet(fn) { const r = await fetch(api(fn)); return r.json().catch(() => ({})); }
async function callFn(fn, body) {
  const r = await fetch(api(fn), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
  return d;
}
async function callMethod(fn, method, body) {
  const r = await fetch(api(fn), { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
  return d;
}

const $ = s => document.querySelector(s);
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const esc = s => { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; };
const mask = k => k.length > 16 ? k.slice(0, 8) + '…' + k.slice(-6) : k;

let _toastTimer = null;
function toast(msg, kind) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg;
  t.className = kind ? kind : '';
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function copy(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = ICON.check;
    setTimeout(() => btn.innerHTML = orig, 800);
    toast('Copied', 'ok');
  }).catch(() => toast('Copy failed', 'err'));
}

function iconCandidates(baseURL) {
  const out = [];
  try {
    const u = new URL(String(baseURL || '').trim());
    if (u.hostname) {
      out.push(u.origin + '/favicon.ico');
      out.push('https://www.google.com/s2/favicons?domain=' + encodeURIComponent(u.hostname) + '&sz=128');
    }
  } catch {}
  return out;
}

function fillMonogram(box, p) {
  const letter = (p.name || '?').trim().charAt(0).toUpperCase();
  box.style.color = p.color || '#F2F0EB';
  box.style.borderColor = (p.color || '#fff') + '55';
  box.style.background = (p.color || '#fff') + '14';
  box.textContent = letter;
  const tryIcon = (srcs) => {
    if (!srcs.length) return;
    box.textContent = '';
    const img = el('img'); img.alt = '';
    let i = 0;
    img.onerror = () => { i++; if (i < srcs.length) img.src = srcs[i]; else { img.remove(); box.textContent = letter; } };
    img.src = srcs[0];
    box.appendChild(img);
  };
  const list = p.icon ? [p.icon, ...iconCandidates(p.baseURL)] : iconCandidates(p.baseURL);
  tryIcon(list);
}

/* ─── Left sidebar nav ─── */
let allProviders = [];
function navItem(p, active) {
  const item = el('button', 'nav-item' + (active ? ' active' : ''));
  item.type = 'button';
  item.dataset.pid = p.id;
  const ico = el('span', 'nav-ico');
  const letter = (p.name || '?').trim().charAt(0).toUpperCase();
  ico.style.color = p.color || '#B8B5AE';
  ico.style.background = (p.color || '#fff') + '18';
  ico.style.borderColor = (p.color || '#fff') + '30';
  ico.textContent = letter;
  if (p.icon) {
    ico.textContent = '';
    const img = el('img'); img.alt = '';
    let i = 0;
    const srcs = [p.icon, ...iconCandidates(p.baseURL)];
    img.onerror = () => { i++; if (i < srcs.length) img.src = srcs[i]; else { img.remove(); ico.textContent = letter; } };
    img.src = srcs[0];
    ico.appendChild(img);
  } else {
    const favs = iconCandidates(p.baseURL);
    if (favs.length) {
      ico.textContent = '';
      const img = el('img'); img.alt = '';
      let i = 0;
      img.onerror = () => { i++; if (i < favs.length) img.src = favs[i]; else { img.remove(); ico.textContent = letter; } };
      img.src = favs[0];
      ico.appendChild(img);
    }
  }
  const name = el('span', 'nav-name', p.name);
  const badge = el('span', 'nav-badge', '—');
  badge.id = 'nav-badge-' + p.id;
  item.append(ico, name, badge);
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('card-' + p.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeSidebar();
  });
  return item;
}
function buildNav() {
  const nav = $('#nav');
  nav.innerHTML = '';
  allProviders = [...PROVIDERS];
  allProviders.forEach((p, i) => nav.appendChild(navItem(p, i === 0)));
}
function addCustomToNav(p) {
  allProviders.push(p);
  $('#nav').appendChild(navItem({ ...p, color: p.color || '#60A5FA' }, false));
}
const spy = new IntersectionObserver((es) => {
  es.forEach((e) => {
    if (e.isIntersecting) {
      const pid = e.target.id.replace('card-', '');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.pid === pid));
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

/* ─── Sidebar open/close (mobile) ─── */
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('on');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('on');
}
function wireSidebar() {
  document.getElementById('menu-btn')?.addEventListener('click', openSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
}

/* ─── Keys ─── */
const FREE_RE = /free|pickle|:free$/i;
function isFreeModel(id) { return FREE_RE.test(String(id)); }

let PROVIDER_KEYS = {};
async function loadProviderKeys() {
  try {
    const d = await keysCall('provider-keys');
    const map = {};
    for (const p of (d.providers || [])) map[p.id] = p.key || '';
    PROVIDER_KEYS = map;
    return d;
  } catch { return null; }
}

function metaValue(k, shown, copyVal, copyable, emptyText) {
  const item = el('span', 'st-meta-item');
  item.appendChild(el('span', 'st-meta-k', k));
  const v = el('span', 'st-meta-v' + (shown ? '' : ' empty'), shown || emptyText || '');
  v.title = shown || emptyText || '';
  item.appendChild(v);
  if (copyable) {
    const btn = el('button', 'icon-btn');
    btn.type = 'button';
    btn.innerHTML = ICON.copy;
    btn.title = 'Copy ' + k.toLowerCase();
    btn.disabled = !copyVal;
    btn.onclick = () => { if (copyVal) copy(copyVal, btn); };
    item.appendChild(btn);
  }
  return item;
}

function section(label, right) {
  const s = el('div', 'st-section');
  const lab = el('div', 'st-label');
  lab.appendChild(el('span', null, label));
  if (right) lab.appendChild(right);
  s.appendChild(lab);
  return s;
}

function setBusy(btn, busy) {
  btn.classList.toggle('is-busy', busy);
  btn.disabled = busy;
}

/* ─── Station card ─── */
function buildCard(p, index) {
  const station = el('article', 'station' + (index === 0 ? ' wide' : ''));
  station.id = 'card-' + p.id;
  const st = { all: [], filtered: [], freeOnly: true, vis: {}, aliases: {}, sel: null };
  const apiKey = p.apiKey || PROVIDER_KEYS[p.id] || '';
  const keyOf = (m) => p.id + '/' + m;
  const isOn = (m) => (keyOf(m) in st.vis) ? !!st.vis[keyOf(m)] : isFreeModel(m);
  const aliasOf = (m) => st.aliases[keyOf(m)] || '';

  // Shared display-name save path (inline editor + reset button). Empty alias
  // clears the override and puts the plain model id back. opts:
  //   locks  - buttons disabled while the POST is in flight
  //   okMsg  - success toast (defaults to saved/cleared wording)
  //   errMsg - failure toast (defaults to the server message)
  //   snap   - re-render on failure, so a row-level control snaps back
  //            (never set for the inline editor: it owns the live row)
  async function saveAlias(m, alias, opts) {
    const o = opts || {};
    const locks = o.locks || [];
    for (const b of locks) b.disabled = true;
    try {
      await callMethod('model-visibility', 'POST', { providerId: p.id, model: m, alias });
      if (alias) st.aliases[keyOf(m)] = alias;
      else delete st.aliases[keyOf(m)];
      applySelect();
      renderModelList();
      toast(o.okMsg || (alias ? 'Display name saved' : 'Display name cleared'), 'ok');
    } catch (ex) {
      for (const b of locks) b.disabled = false;
      if (o.snap) { applySelect(); renderModelList(); }
      toast(o.errMsg || ex.message || 'Save failed', 'err');
    }
  }

  /* header */
  const head = el('header', 'st-head');
  const idRow = el('div', 'st-id');
  const mono = el('div', 'st-mono');
  fillMonogram(mono, p);
  const idMeta = el('div', 'st-idmeta');
  idMeta.appendChild(el('div', 'st-name', p.name));
  const badge = el('span', 'st-badge', 'idle');
  badge.hidden = true;
  idMeta.appendChild(badge);
  idRow.append(mono, idMeta);
  head.appendChild(idRow);

  if (p.custom) {
    const tools = el('div', 'st-tools');
    const editBtn = el('button', 'icon-btn');
    editBtn.innerHTML = ICON.edit;
    editBtn.title = 'Edit';
    editBtn.onclick = (e) => { e.stopPropagation(); openEditDialog(p); };
    const delBtn = el('button', 'icon-btn danger');
    delBtn.innerHTML = ICON.trash;
    delBtn.title = 'Delete';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      try {
        await callMethod('custom-providers', 'DELETE', { id: p.id });
        station.remove();
        document.querySelector(`.nav-item[data-pid="${p.id}"]`)?.remove();
        allProviders = allProviders.filter(x => x.id !== p.id);
        toast('Provider deleted', 'ok');
      } catch (ex) { toast(ex.message || 'Delete failed', 'err'); }
    };
    tools.append(editBtn, delBtn);
    head.appendChild(tools);
  }

  /* quiet credential line */
  const creds = el('div', 'st-meta');
  creds.appendChild(metaValue('Base', p.baseURL, p.baseURL, true, 'unset'));
  if (!p.noAuth) creds.appendChild(metaValue('Key', apiKey ? mask(apiKey) : '', apiKey, true, 'no key'));

  /* workbench body */
  const body = el('div', 'st-body');
  const main = el('div', 'st-main');

  /* model catalog + activation */
  const cat = section('Model catalog');
  const searchWrap = el('div', 'field-row');
  const si = el('input', 'input');
  si.placeholder = 'Search full catalog to activate…';
  si.disabled = true;
  si.autocomplete = 'off';
  si.spellcheck = false;
  si.setAttribute('aria-label', 'Search models');
  si.style.flex = '1 1 200px';
  searchWrap.appendChild(si);

  const freeLabel = el('label', 'toggle');
  const freeCb = el('input');
  freeCb.type = 'checkbox';
  freeCb.checked = true;
  freeCb.className = 'toggle-input';
  const freeTrack = el('span', 'tg-track');
  freeTrack.appendChild(el('span', 'tg-knob'));
  freeLabel.append(freeCb, freeTrack, el('span', null, 'Free only'));
  searchWrap.appendChild(freeLabel);
  cat.appendChild(searchWrap);

  const modelList = el('div', 'model-list');
  modelList.hidden = true;
  cat.appendChild(modelList);

  const pickRow = el('div', 'field-row');
  const sel = el('select', 'select');
  sel.appendChild(el('option', null, 'Loading…'));
  sel.disabled = true;
  sel.setAttribute('aria-label', 'Active models');
  sel.style.flex = '1 1 200px';
  st.sel = sel;
  pickRow.appendChild(sel);
  const modelCopy = el('button', 'icon-btn');
  modelCopy.innerHTML = ICON.copy;
  modelCopy.title = 'Copy model id';
  modelCopy.onclick = () => { const mid = customModel.value.trim() || sel.value; if (mid) copy(mid, modelCopy); };
  pickRow.appendChild(modelCopy);
  cat.appendChild(pickRow);

  const customRow = el('div', 'field-row');
  const customModel = el('input', 'input');
  customModel.placeholder = 'Custom model id (optional)…';
  customModel.autocomplete = 'off';
  customModel.spellcheck = false;
  customModel.style.fontFamily = 'var(--mono)';
  customModel.style.fontSize = '12px';
  customModel.style.flex = '1 1 200px';
  customModel.title = 'Type any model id to probe — works even if it is not in the catalog';
  const clearCustom = el('button', 'btn btn-xs', 'clear');
  clearCustom.type = 'button';
  clearCustom.onclick = () => { customModel.value = ''; sel.focus(); };
  customRow.append(customModel, clearCustom);
  customModel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); testBtn.click(); }
  });
  cat.appendChild(customRow);
  main.appendChild(cat);

  /* prompt skills */
  const probe = section('Prompt skills');
  const pills = el('div', 'pills');
  const PROMPT_PRESETS = { 'Ping': 'Reply with exactly: pong', 'Hello': 'Say hello in one short sentence.', 'Haiku': 'Write a haiku about code.' };
  const ta = el('textarea', 'input');
  ta.value = localStorage.getItem('mlab_prompt_' + p.id) || PROMPT_PRESETS['Ping'];
  ta.rows = 3;
  ta.placeholder = 'Prompt…';
  for (const [name, text] of Object.entries(PROMPT_PRESETS)) {
    const b = el('button', 'pill', name);
    b.type = 'button';
    b.onclick = () => { ta.value = text; ta.focus(); markActive(name); };
    pills.appendChild(b);
  }
  function markActive(n) {
    pills.querySelectorAll('.pill').forEach(b => b.classList.toggle('on', b.textContent === n));
  }
  ta.addEventListener('input', () => {
    localStorage.setItem('mlab_prompt_' + p.id, ta.value);
    const f = Object.entries(PROMPT_PRESETS).find(([, t]) => t === ta.value);
    markActive(f ? f[0] : null);
  });
  markActive((Object.entries(PROMPT_PRESETS).find(([, t]) => t === ta.value) || [])[0] || null);

  const actions = el('div', 'probe-bar');
  const loadBtn = el('button', 'btn btn-sm');
  loadBtn.innerHTML = ICON.refresh + '<span>Refresh models</span>';
  loadBtn.title = 'Reload the model catalog from this provider';
  const testBtn = el('button', 'btn btn-solid btn-sm');
  testBtn.innerHTML = ICON.bolt + '<span>Run probe</span>';
  testBtn.title = 'Send the prompt to the selected model';
  actions.append(loadBtn, testBtn);

  probe.append(pills, ta, actions);
  main.appendChild(probe);
  body.appendChild(main);

  /* output */
  const outSec = section('Output');
  outSec.classList.add('st-section-out');
  const res = el('div', 'output hollow');
  res.textContent = 'No probe yet. Pick a model and run.';
  outSec.appendChild(res);
  body.appendChild(outSec);

  station.append(head, creds, body);

  function applySelect() {
    const prev = sel.value;
    const pool = st.all.filter(m => isOn(m) && (!st.freeOnly || isFreeModel(m)));
    st.filtered = pool;
    sel.innerHTML = '';
    if (!pool.length) {
      const o = el('option', null, st.all.length ? 'no active models' : 'no models');
      o.value = '';
      sel.appendChild(o);
    } else {
      for (const m of pool) {
        const o = el('option', null, aliasOf(m) || m);
        o.value = m;
        sel.appendChild(o);
      }
      if (prev && pool.includes(prev)) sel.value = prev;
    }
    sel.dataset.prev = sel.value;
  }

  function openAliasEdit(row, m, btn) {
    if (row.querySelector('.ali-edit')) return;
    const nameEl = row.querySelector('.mname');
    const renEl = row.querySelector('.mrenamed');
    if (nameEl) nameEl.hidden = true;
    if (renEl) renEl.hidden = true;
    btn.hidden = true;
    // Same rule for the reset control; both exit paths re-render the row.
    const resetEl = row.querySelector('.m-reset-btn');
    if (resetEl) resetEl.style.display = 'none';

    const wrap = el('span', 'ali-edit');
    const input = el('input', 'ali-input');
    input.type = 'text';
    input.value = aliasOf(m);
    input.placeholder = 'Display name — blank clears';
    input.maxLength = 64;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Display name for ' + m);
    const okBtn = el('button', 'icon-btn');
    okBtn.type = 'button';
    okBtn.innerHTML = ICON.check;
    okBtn.title = 'Save display name';
    const xBtn = el('button', 'icon-btn');
    xBtn.type = 'button';
    xBtn.innerHTML = ICON.x;
    xBtn.title = 'Cancel';

    async function post(alias) {
      await saveAlias(m, alias, { locks: [okBtn, xBtn], errMsg: 'Save failed' });
    }
    function revert() {
      renderModelList();
      applySelect();
    }
    const save = () => post(input.value.trim());
    okBtn.onclick = save;
    xBtn.onclick = revert;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      else if (e.key === 'Escape') { e.preventDefault(); revert(); }
    });

    wrap.append(input, okBtn, xBtn);
    row.insertBefore(wrap, btn);
    input.focus();
    input.select();
  }

  function modelRow(m) {
    const row = el('div', 'mrow');
    const active = isOn(m);
    if (!active) row.classList.add('is-off');
    const name = el('span', 'mname' + (isFreeModel(m) ? ' free' : ''), m);
    name.title = m;
    row.appendChild(name);
    const al = aliasOf(m);
    if (al) {
      const ren = el('span', 'mrenamed', 'renamed');
      ren.title = 'Display name: ' + al;
      row.appendChild(ren);
    }
    const key = keyOf(m);
    const editBtn = el('button', 'icon-btn m-alias-btn');
    editBtn.type = 'button';
    editBtn.innerHTML = ICON.edit;
    editBtn.title = 'Edit display name';
    editBtn.hidden = !active;
    editBtn.onclick = () => openAliasEdit(row, m, editBtn);
    // m-alias-btn is reused for the 26px icon sizing + the [hidden] rule,
    // since the shared stylesheet cannot be edited from here.
    let resetBtn = null;
    if (al) {
      resetBtn = el('button', 'icon-btn m-reset-btn m-alias-btn');
      resetBtn.type = 'button';
      resetBtn.innerHTML = ICON.reset;
      resetBtn.title = 'Reset to default name';
      resetBtn.setAttribute('aria-label', 'Reset display name for ' + m);
      resetBtn.hidden = !active;
      resetBtn.onclick = (e) => {
        e.stopPropagation();
        saveAlias(m, '', { locks: [resetBtn], okMsg: 'Default name restored', snap: true });
      };
    }
    const showRowTools = (on) => { editBtn.hidden = !on; if (resetBtn) resetBtn.hidden = !on; };
    const switchLabel = el('label', 'toggle');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.className = 'toggle-input';
    cb.checked = active;
    cb.setAttribute('aria-label', 'Activate ' + m);
    const track = el('span', 'tg-track');
    track.appendChild(el('span', 'tg-knob'));
    switchLabel.append(cb, track);
    cb.addEventListener('change', async () => {
      st.vis[key] = cb.checked;
      row.classList.toggle('is-off', !cb.checked);
      showRowTools(cb.checked);
      applySelect();
      try { await callMethod('model-visibility', 'POST', { providerId: p.id, model: m, enabled: cb.checked }); }
      catch {
        st.vis[key] = !cb.checked;
        cb.checked = !cb.checked;
        row.classList.toggle('is-off', !cb.checked);
        showRowTools(cb.checked);
        applySelect();
        toast('Save failed', 'err');
      }
    });
    if (resetBtn) row.append(editBtn, resetBtn, switchLabel);
    else row.append(editBtn, switchLabel);
    return row;
  }

  function renderModelList() {
    modelList.innerHTML = '';
    if (!st.all.length) { modelList.hidden = true; return; }
    const q = si.value.trim().toLowerCase();
    const rows = st.all.filter(m => !q || m.toLowerCase().includes(q) || aliasOf(m).toLowerCase().includes(q));
    modelList.hidden = false;
    if (!rows.length) {
      modelList.appendChild(el('div', 'm-empty', 'No models match “' + si.value.trim() + '”'));
      return;
    }
    for (const m of rows) modelList.appendChild(modelRow(m));
  }

  si.addEventListener('input', renderModelList);
  freeCb.addEventListener('change', () => { st.freeOnly = freeCb.checked; applySelect(); });

  loadBtn.addEventListener('click', () => doLoad());
  testBtn.addEventListener('click', () => doTest());

  async function doLoad() {
    sel.disabled = true; si.disabled = true;
    setBusy(loadBtn, true);
    station.classList.add('is-probing');
    badge.hidden = false; badge.className = 'st-badge load'; badge.textContent = 'loading';
    res.className = 'output hollow loading'; res.textContent = 'Fetching catalog…';
    modelList.innerHTML = ''; modelList.hidden = true;
    try {
      const [d, visResp] = await Promise.all([callFn('models', { providerId: p.id }), callGet('model-visibility')]);
      st.all = d.models || [];
      st.vis = visResp.visibility || {};
      st.aliases = visResp.aliases || {};
      si.value = '';
      applySelect();
      if (p.defaultModel && st.filtered.includes(p.defaultModel)) sel.value = p.defaultModel;
      sel.dataset.prev = sel.value;
      sel.disabled = false; si.disabled = false;
      renderModelList();
      badge.className = 'st-badge ok'; badge.textContent = d.count + ' models';
      res.className = 'output hollow'; res.textContent = 'Catalog ready. Run a probe.';
      const nb = document.getElementById('nav-badge-' + p.id);
      if (nb) nb.textContent = d.count;
      station.classList.remove('is-probing');
      station.classList.add('is-ok');
      setTimeout(() => station.classList.remove('is-ok'), 600);
    } catch (e) {
      badge.className = 'st-badge err'; badge.textContent = 'error';
      res.className = 'output err'; res.textContent = '✗ ' + e.message;
      station.classList.remove('is-probing');
      station.classList.add('is-err');
      setTimeout(() => station.classList.remove('is-err'), 450);
    } finally {
      setBusy(loadBtn, false);
      station.classList.remove('is-probing');
    }
  }

  async function doTest() {
    const model = (customModel.value || '').trim() || sel.value;
    if (!model || model === 'Loading…') return;
    if (!customModel.value.trim()) sel.dataset.prev = model;
    setBusy(testBtn, true);
    station.classList.add('is-probing');
    badge.hidden = false; badge.className = 'st-badge load'; badge.textContent = 'probing';
    res.className = 'output loading'; res.textContent = '→ ' + model;
    try {
      const d = await callFn('chat', { providerId: p.id, model, messages: [{ role: 'user', content: ta.value }], maxTokens: 128 });
      let html = '<div class="body-in"><div class="meta"><span>' + esc(d.model || model) + '</span><span>' + (d.ms || '') + 'ms</span>' + (d.via ? '<span>' + esc(d.via) + '</span>' : '') + '</div>';
      if (d.reasoning) html += '<div class="thought">' + esc(d.reasoning.slice(0, 400)) + '</div>';
      html += '<div>' + esc(d.content || '(empty)') + '</div></div>';
      res.className = 'output'; res.innerHTML = html;
      badge.className = 'st-badge ok'; badge.textContent = d.ms + 'ms';
      station.classList.remove('is-probing');
      station.classList.add('is-ok');
      setTimeout(() => station.classList.remove('is-ok'), 600);
    } catch (e) {
      res.className = 'output err'; res.textContent = '✗ ' + e.message;
      badge.className = 'st-badge err'; badge.textContent = 'error';
      station.classList.remove('is-probing');
      station.classList.add('is-err');
      setTimeout(() => station.classList.remove('is-err'), 450);
    } finally {
      setBusy(testBtn, false);
      station.classList.remove('is-probing');
    }
  }

  doLoad();
  spy.observe(station);
  return station;
}

/* ─── Edit dialog ─── */
let _dialogMode = 'add';
function openEditDialog(p) {
  const dlg = document.getElementById('prov-dialog');
  const title = document.getElementById('prov-dlg-title');
  const nameI = document.getElementById('prov-name');
  const baseI = document.getElementById('prov-base');
  const keyI = document.getElementById('prov-key');
  const saveBtn = document.getElementById('prov-save');
  const err = document.getElementById('prov-err');

  _dialogMode = 'edit';
  title.textContent = 'Edit provider';
  nameI.value = p.name;
  baseI.value = p.baseURL;
  keyI.value = p.apiKey || '';
  err.textContent = '';
  saveBtn.disabled = false; saveBtn.textContent = 'Save changes';

  const handler = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const name = nameI.value.trim();
    const baseURL = baseI.value.trim();
    if (name.length < 2 || name.length > 40) { err.textContent = 'Name 2–40 chars.'; return; }
    try { new URL(baseURL); } catch { err.textContent = 'Enter a valid URL.'; return; }
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    try {
      await callMethod('custom-providers', 'PUT', { id: p.id, name, baseURL, apiKey: keyI.value.trim() });
      dlg.close(); location.reload();
    } catch (ex) { err.textContent = ex.message; saveBtn.disabled = false; saveBtn.textContent = 'Save changes'; }
  };
  if (dlg._editHandler) saveBtn.removeEventListener('click', dlg._editHandler);
  dlg._editHandler = handler;
  saveBtn.addEventListener('click', handler);
  dlg.showModal();
  nameI.focus();
}

/* ─── Auth ─── */
async function verifyPassword(pw) {
  try {
    const r = await fetch(api('auth'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    const d = await r.json().catch(() => ({}));
    return !!(r.ok && d.ok);
  } catch { return false; }
}

async function keysCall(action, extra) {
  const r = await fetch(api('api-keys'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: localStorage.getItem('mlab_pw') || '', ...(extra || {}) })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
  return d;
}

function wireGateway() {
  const baseInput = document.getElementById('gw-base');
  const keyInput = document.getElementById('gw-key');
  if (!baseInput || !keyInput) return;
  baseInput.value = location.origin + '/v1';
  let keyId = null;
  async function load() {
    try {
      const d = await keysCall('ensure');
      keyInput.value = (d.key && d.key.key) || '';
      keyId = (d.key && d.key.id) || null;
    } catch { keyInput.value = ''; keyId = null; }
  }
  load();
  document.getElementById('gw-base-copy')?.addEventListener('click', (e) => copy(baseInput.value, e.currentTarget));
  document.getElementById('gw-key-copy')?.addEventListener('click', (e) => copy(keyInput.value, e.currentTarget));
  document.getElementById('gw-key-del')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!keyId || btn.disabled) return;
    setBusy(btn, true);
    try {
      await keysCall('revoke', { id: keyId });
      await load();
      toast('Key deleted — new key generated', 'ok');
    } catch (ex) { toast(ex.message || 'Delete failed', 'err'); }
    finally { setBusy(btn, false); }
  });
}

/* ─── Universal proxy console ─── */
// Hands out a ready-made prefixed base for any path on the proxied host. One
// composition rule feeds both the copyable base and the probe request, so what
// you copy is exactly what Test asks for.
function wireProxyPanel() {
  const baseOut = document.getElementById('px-base');
  const target = document.getElementById('px-target');
  const sub = document.getElementById('px-path');
  const out = document.getElementById('px-out');
  const pillsBox = document.getElementById('px-pills');
  const testBtn = document.getElementById('px-test');
  const modeLabel = document.getElementById('px-mode-label');
  const modeBox = document.getElementById('px-universal');
  const modeOut = document.getElementById('px-mode');
  const noteUni = document.getElementById('px-note-universal');
  const noteX = document.getElementById('px-note-xpart');
  if (!baseOut || !target || !sub) return;

  // 'aichat' and '/aichat' are the same sub base, and '/' collapses to nothing
  // so 'https://xpart.netlify.app' never turns into a double slash.
  function subPath() {
    let p = String(sub.value || '').trim();
    if (p && p.charAt(0) !== '/') p = '/' + p;
    return p.replace(/\/+$/, '');
  }
  // A target carrying its own ?query has to be encoded or it would spill out of
  // the proxy's own query string.
  const needsEncode = () => /[?#&]/.test(String(target.value || ''));
  function proxyUrl(extra) {
    let joined = String(target.value || '').trim().replace(/\/+$/, '') + subPath() + String(extra || '');
    if (needsEncode()) joined = encodeURIComponent(joined);
    return location.origin + '/api/proxy?url=' + joined;
  }
  function sync() {
    baseOut.value = proxyUrl('');
    baseOut.title = baseOut.value;
    const cur = subPath() || '/';
    if (pillsBox) pillsBox.querySelectorAll('.pill').forEach(b => b.classList.toggle('on', b.dataset.path === cur));
  }

  target.addEventListener('input', sync);
  sub.addEventListener('input', sync);
  pillsBox?.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill || !pillsBox.contains(pill)) return;
    sub.value = pill.dataset.path || '/';
    sync();
  });
  document.getElementById('px-base-copy')?.addEventListener('click', (e) => copy(baseOut.value, e.currentTarget));
  testBtn?.addEventListener('click', async () => {
    if (!String(target.value || '').trim()) {
      if (out) { out.className = 'output err'; out.textContent = '✗ Set a target host first.'; }
      toast('Set a target host first', 'err');
      return;
    }
    // The probe path is the trailing slash: it asks for the very resource the
    // base names, so a good copy and a good probe stay the same request.
    const url = proxyUrl('/');
    setBusy(testBtn, true);
    if (out) { out.className = 'output loading'; out.textContent = 'Probing ' + url + '…'; }
    const started = Date.now();
    try {
      const r = await fetch(url, { method: 'GET' });
      const ms = Date.now() - started;
      const raw = await r.text().catch(() => '');
      const type = (r.headers.get('content-type') || 'unknown').split(';')[0].trim();
      if (out) {
        out.className = 'output';
        out.innerHTML = '<div class="body-in"><div class="meta">'
          + '<span' + (r.ok ? '' : ' class="px-bad"') + '>HTTP ' + r.status + (r.statusText ? ' ' + esc(r.statusText) : '') + '</span>'
          + '<span>' + ms + 'ms</span><span>' + esc(type) + '</span></div>'
          + '<div class="px-url">' + esc(url) + '</div>'
          + '<div>' + esc(raw ? raw.slice(0, 400) : '(empty body)') + (raw.length > 400 ? '…' : '') + '</div></div>';
      }
    } catch (ex) {
      if (out) { out.className = 'output err'; out.textContent = '✗ ' + ((ex && ex.message) || 'Request failed'); }
      toast((ex && ex.message) || 'Probe failed', 'err');
    } finally {
      setBusy(testBtn, false);
    }
  });

  /* Server-side proxy mode (xpart | universal). The mode lives on the server, so
     the switch ships disabled and only ever shows what the server confirmed: the
     read below decides the initial position, and every write falls back to the
     last confirmed mode instead of the click. This endpoint sits on this origin
     (not the Netlify function base), so it is fetched directly. */
  if (modeBox) {
    const modeUrl = location.origin + '/api/proxy';
    let current = 'xpart';

    async function modeCall(next) {
      const r = next
        ? await fetch(modeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mode', mode: next, password: localStorage.getItem('mlab_pw') || '' }) })
        : await fetch(modeUrl + '?action=mode');
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(d.error || (r.status === 401 ? 'Wrong password' : 'HTTP ' + r.status));
        err.status = r.status;
        throw err;
      }
      return d;
    }
    // Renders one authoritative mode. Anything the server does not confirm as
    // 'universal' falls back to the default 'xpart'.
    function paint(mode) {
      const m = mode === 'universal' ? 'universal' : 'xpart';
      current = m;
      modeBox.checked = m === 'universal';
      if (modeOut) { modeOut.textContent = m; modeOut.removeAttribute('aria-busy'); }
      if (noteUni) noteUni.hidden = m !== 'universal';
      if (noteX) noteX.hidden = m === 'universal';
      modeLabel?.classList.remove('is-busy');
      return m;
    }
    function lock(on) {
      modeBox.disabled = on;
      modeLabel?.classList.toggle('is-busy', !!on);
    }

    async function load() {
      try {
        const d = await modeCall();
        paint(d.mode);
      } catch {
        paint('xpart');
      } finally {
        lock(false);
      }
    }
    load();

    modeBox.addEventListener('change', async () => {
      const next = modeBox.checked ? 'universal' : 'xpart';
      const prev = current;
      lock(true);
      try {
        const d = await modeCall(next);
        toast('Proxy mode: ' + paint(d.mode), 'ok');
      } catch (ex) {
        paint(prev);
        toast((ex && ex.message) || 'Mode change failed', 'err');
      } finally {
        lock(false);
      }
    });
  }

  sync();
}

function wireAllProviders() {
  const dlg = document.getElementById('all-dialog'); if (!dlg) return;
  const list = document.getElementById('all-list');
  const err = document.getElementById('all-err');
  const copyAllBtn = document.getElementById('all-copy');
  let cache = { universal_base: '', providers: [] };
  const blockFor = (p) => '# ' + (p.name || p.id) + '\nBASE_URL=' + (p.baseURL || '') + '\nAPI_KEY=' + (p.key || '(none)');
  function render(providers) {
    list.innerHTML = '';
    if (!providers.length) { list.appendChild(el('div', 'ap-empty', 'No providers found.')); return; }
    providers.forEach(p => {
      const row = el('div', 'ap-row');
      const top = el('div', 'ap-top');
      const nameEl = el('span', 'ap-name', p.name || p.id);
      const cb = el('button', 'btn btn-xs', 'copy');
      cb.onclick = () => copy(blockFor(p), cb);
      top.append(nameEl, cb);
      const baseEl = el('div', 'ap-line', p.baseURL || '');
      const keyEl = el('div', 'ap-line dim', p.key ? mask(p.key) : '(none)');
      row.append(top, baseEl, keyEl);
      list.appendChild(row);
    });
  }
  async function load() {
    err.textContent = '';
    list.innerHTML = '<div class="ap-empty">Loading…</div>';
    try {
      const d = await keysCall('provider-keys');
      cache.universal_base = d.universal_base || '';
      cache.providers = d.providers || [];
      render(cache.providers);
    } catch (e) { list.innerHTML = ''; err.textContent = e.message; }
  }
  document.getElementById('allprov-btn')?.addEventListener('click', () => { load(); dlg.showModal(); });
  copyAllBtn?.addEventListener('click', async () => {
    err.textContent = '';
    try {
      const k = await keysCall('ensure');
      const uniKey = (k && k.key && k.key.key) ? k.key.key : '';
      const text = 'UNIVERSAL_BASE=' + (cache.universal_base || '') + '\nUNIVERSAL_KEY=' + uniKey + (cache.providers.length ? '\n\n' + cache.providers.map(blockFor).join('\n\n') : '');
      copy(text, copyAllBtn);
    } catch (ex) { err.textContent = ex.message; }
  });
  document.getElementById('all-close')?.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

function buildUI() {
  buildNav();
  wireSidebar();
  const grid = $('#cards');
  PROVIDERS.forEach((p, i) => grid.appendChild(buildCard(p, i)));
  callGet('custom-providers').then((d) => {
    for (const c of (d.providers || [])) {
      const card = buildCard({
        id: c.id, name: c.name, color: '#60A5FA', baseURL: c.baseURL,
        apiKey: c.apiKey || PROVIDER_KEYS[c.id] || '', custom: true,
        defaultModel: '', icon: c.logoUrl || ''
      }, 99);
      grid.appendChild(card);
      addCustomToNav(c);
    }
  }).catch(() => {});
  wireGateway();
  wireAllProviders();
  wireProxyPanel();
  wireDialog();
}

function openProvDialog() {
  const dlg = document.getElementById('prov-dialog');
  const title = document.getElementById('prov-dlg-title');
  const err = document.getElementById('prov-err');
  const nameI = document.getElementById('prov-name');
  const saveBtn = document.getElementById('prov-save');
  _dialogMode = 'add';
  title.textContent = 'Add provider';
  err.textContent = '';
  nameI.value = '';
  document.getElementById('prov-base').value = '';
  document.getElementById('prov-key').value = '';
  saveBtn.disabled = false; saveBtn.textContent = 'Add provider';
  dlg.showModal();
  setTimeout(() => nameI.focus(), 50);
}

function wireDialog() {
  const dlg = document.getElementById('prov-dialog');
  const err = document.getElementById('prov-err');
  const nameI = document.getElementById('prov-name');
  const baseI = document.getElementById('prov-base');
  const keyI = document.getElementById('prov-key');
  const saveBtn = document.getElementById('prov-save');

  document.getElementById('add-prov-btn').onclick = openProvDialog;
  document.getElementById('top-add-btn').onclick = openProvDialog;
  document.getElementById('prov-cancel').onclick = () => dlg.close();
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  const addHandler = async (e) => {
    e.preventDefault();
    if (_dialogMode === 'edit') return;
    const name = nameI.value.trim();
    const baseURL = baseI.value.trim();
    if (name.length < 2 || name.length > 40) { err.textContent = 'Name 2–40 chars.'; nameI.focus(); return; }
    try { const u = new URL(baseURL); if (!['http:', 'https:'].includes(u.protocol)) throw 0; }
    catch { err.textContent = 'Enter a valid URL.'; baseI.focus(); return; }
    err.textContent = '';
    saveBtn.disabled = true; saveBtn.textContent = 'Adding…';
    try {
      await callFn('custom-providers', { name, baseURL, apiKey: keyI.value.trim() });
      saveBtn.textContent = 'Added';
      toast('Provider added', 'ok');
      setTimeout(() => location.reload(), 400);
    } catch (ex) { err.textContent = ex.message; saveBtn.disabled = false; saveBtn.textContent = 'Add provider'; }
  };
  document.getElementById('prov-form').addEventListener('submit', addHandler);
}

let uiBuilt = false;
async function unlock() {
  document.getElementById('lock').classList.add('hidden');
  if (!uiBuilt) { uiBuilt = true; await loadProviderKeys(); buildUI(); }
}

async function initGate() {
  const saved = localStorage.getItem('mlab_pw');
  if (saved && await verifyPassword(saved)) { unlock(); return; }
  if (saved) localStorage.removeItem('mlab_pw');
  const input = document.getElementById('lock-input');
  const btn = document.getElementById('lock-btn');
  const err = document.getElementById('lock-err');
  async function tryUnlock() {
    const pw = input.value;
    if (!pw) return;
    btn.disabled = true;
    const ok = await verifyPassword(pw);
    btn.disabled = false;
    if (ok) { localStorage.setItem('mlab_pw', pw); err.textContent = ''; unlock(); }
    else { err.textContent = 'Wrong password'; input.select(); }
  }
  btn.onclick = tryUnlock;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
  input.focus();
}

initGate();
