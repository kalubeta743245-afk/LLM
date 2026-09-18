const PROVIDERS = [
  { id:'mysitefree', name:'OpenCode Local Tunnel', color:'#16A34A', baseURL:'https://opencode.ai/zen/v1', noAuth:true, defaultModel:'llama-3.1-8b-fast', icon:'', builtIn:true },
  { id:'tokenrouter', name:'TokenRouter', color:'#2563eb', baseURL:'https://api.tokenrouter.com/v1', defaultModel:'z-ai/glm-5.3-free', icon:'https://www.tokenrouter.com/logo-without-title.png', builtIn:true },
  { id:'nvidia', name:'NVIDIA NIM', color:'#76b900', baseURL:'https://integrate.api.nvidia.com/v1', defaultModel:'meta/llama-3.3-70b-instruct', icon:'https://developer.download.nvidia.com/icons/m48-nim-256px-blk.png', builtIn:true },
  { id:'openrouter', name:'OpenRouter', color:'#8b5cf6', baseURL:'https://openrouter.ai/api/v1', defaultModel:'openai/gpt-4o-mini', icon:'https://openrouter.ai/brand/v2/openrouter-glyph-light.svg', builtIn:true },
  { id:'tokenharbor', name:'Token Harbor', color:'#f97316', baseURL:'https://tokenharbor.ai/v1', defaultModel:'deepseek-v4-flash', icon:'', builtIn:true },
  { id:'tokenforge', name:'Token Forge', color:'#ef4444', baseURL:'https://tokenforge.ai.studio/v1', defaultModel:'claude-opus-5', icon:'', builtIn:true },
  { id:'experientiallab', name:'Experiential Labs', color:'#6366f1', baseURL:'https://api.experientiallabs.ai/v1', defaultModel:'deepseek-v4-flash', icon:'', builtIn:true },
  { id:'orcarouter', name:'OrcaRouter', color:'#2e7cf6', baseURL:'https://www.orcarouter.ai/v1', defaultModel:'orcarouter/free', icon:'https://www.orcarouter.ai/orca-logo.png', builtIn:true },
  { id:'opencode', name:'OpenCode Zen', color:'#000000', baseURL:'https://opencode.ai/zen/v1', defaultModel:'gpt-5-nano', icon:'https://opencode.ai/favicon.ico', builtIn:true },
];

const SVG = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICON_BOLT = SVG('<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>');
const ICON_COPY = SVG('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>');
const ICON_RELOAD = SVG('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>');
const ICON_TRASH = SVG('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>');
const ICON_EDIT = SVG('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>');
const ICON_PLUS = SVG('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>');
const ICON_MENU = SVG('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>');
const ICON_CHECK = SVG('<polyline points="20 6 9 17 4 12"/>');

// Backend base: same host when served locally or via tunnel (CLI-backed free
// models live there); the Cloudflare Worker otherwise.
const API_BASE = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.hostname.endsWith('.trycloudflare.com'))
  ? location.origin
  : "https://ai.labai.workers.dev";
const api = (fn) => API_BASE + '/.netlify/functions/' + fn;

async function callGet(fn) {
  const r = await fetch(api(fn));
  return r.json().catch(() => ({}));
}

async function callFn(fn, body) {
  // Visitor bridge: if THEIR pc runs bridge.js, OpenCode Local Tunnel uses their
  // machine + their opencode CLI — the owner pc can stay off.
  if ((fn === 'chat' || fn === 'models') && body && body.providerId === 'mysitefree' && await bridgeAlive()) {
    try { return await bridgeFn(fn, body); } catch { /* fall through to cloud */ }
  }
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

const BRIDGE = 'http://127.0.0.1:8899';
let _bridgeAlive = null;
async function bridgeAlive() {
  if (_bridgeAlive !== null) return _bridgeAlive;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 1500);
    const r = await fetch(BRIDGE + '/ping', { signal: c.signal });
    clearTimeout(t);
    _bridgeAlive = r.ok;
  } catch { _bridgeAlive = false; }
  return _bridgeAlive;
}
async function bridgeFn(fn, body) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 170000);
  try {
    const r = await fetch(BRIDGE + '/.netlify/functions/' + fn, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: c.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok === false) throw new Error(d.error || ('bridge HTTP ' + r.status));
    return d;
  } finally { clearTimeout(t); }
}

async function keysCall(action, extra) {
  const r = await fetch(api('api-keys'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: localStorage.getItem('mlab_pw') || '', ...(extra || {}) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
  return d;
}

const $ = s => document.querySelector(s);
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const esc = s => { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; };
const mask = k => k.length > 16 ? k.slice(0, 8) + '…' + k.slice(-6) : k;

function copy(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '✓';
    setTimeout(() => btn.innerHTML = orig, 800);
  });
}

// Icon for a custom provider: explicit logoUrl → own favicon → Google S2 → letter tile.
function iconCandidates(baseURL) {
  const out = [];
  try {
    const u = new URL(String(baseURL || '').trim());
    if (u.hostname) {
      out.push(u.origin + '/favicon.ico');
      out.push('https://www.google.com/s2/favicons?domain=' + encodeURIComponent(u.hostname) + '&sz=128');
    }
  } catch { /* letter tile */ }
  return out;
}
function letterTile(p, cls) {
  const t = el('div', cls, (p.name || '?').trim().charAt(0).toUpperCase());
  t.style.background = p.color || '#141414';
  return t;
}
function setLogo(img, p) {
  if (p.icon) {
    img.alt = p.name; img.loading = 'lazy';
    img.onerror = () => { img.replaceWith(letterTile(p, 'card-logo tile')); };
    img.src = p.icon;
    return;
  }
  const list = iconCandidates(p.baseURL);
  if (!list.length) { img.replaceWith(letterTile(p, 'card-logo tile')); return; }
  img.alt = p.name; img.loading = 'lazy';
  let i = 0;
  img.onerror = () => {
    i++;
    if (i < list.length) img.src = list[i];
    else img.replaceWith(letterTile(p, 'card-logo tile'));
  };
  img.src = list[0];
}

/* ─── Sidebar nav ─── */
let allProviders = [];

function buildNav() {
  const nav = $('#nav');
  nav.innerHTML = '';
  allProviders = [];
  PROVIDERS.forEach((p) => allProviders.push(p));
  allProviders.forEach((p, i) => {
    const item = el('div', 'nav-item' + (i === 0 ? ' active' : ''));
    item.dataset.pid = p.id;
    const nameSpan = el('span', null, p.name);
    const badge = el('span', 'nav-badge', '—');
    badge.id = 'nav-badge-' + p.id;
    if (p.icon) {
      const img = el('img', 'nav-icon');
      img.alt = '';
      img.onerror = () => { img.style.display = 'none'; };
      img.src = p.icon;
      item.append(img, nameSpan, badge);
    } else {
      const list = iconCandidates(p.baseURL);
      if (!list.length) {
        const t = letterTile(p, 'nav-icon tile-sm');
        t.style.color = '#fff';
        item.append(t, nameSpan, badge);
      } else {
        const img = el('img', 'nav-icon');
        img.alt = '';
        let i = 0;
        img.onerror = () => { i++; if (i < list.length) img.src = list[i]; else { img.remove(); const t = letterTile(p, 'nav-icon tile-sm'); t.style.color = '#fff'; item.prepend(t); } };
        img.src = list[0];
        item.append(img, nameSpan, badge);
      }
    }
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('card-' + p.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      closeMobileNav();
    });
    nav.appendChild(item);
  });

  // Model Manager nav item
  const dedupItem = el('div', 'nav-item');
  dedupItem.dataset.pid = 'dedup';
  const dedupName = el('span', null, 'Model Manager');
  dedupItem.append(dedupName);
  dedupItem.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    dedupItem.classList.add('active');
    document.getElementById('card-dedup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeMobileNav();
  });
  nav.appendChild(dedupItem);
}

function addCustomToNav(p) {
  allProviders.push(p);
  const nav = $('#nav');
  const item = el('div', 'nav-item');
  item.dataset.pid = p.id;
  const nameSpan = el('span', null, p.name);
  if (p.logoUrl) {
    const img = el('img', 'nav-icon');
    img.alt = '';
    img.onerror = () => { img.style.display = 'none'; };
    img.src = p.logoUrl;
    item.append(img, nameSpan);
  } else {
    const list = iconCandidates(p.baseURL);
    if (!list.length) {
      const t = letterTile(p, 'nav-icon tile-sm');
      t.style.color = '#fff';
      item.append(t, nameSpan);
    } else {
      const img = el('img', 'nav-icon');
      img.alt = '';
      let i = 0;
      img.onerror = () => { i++; if (i < list.length) img.src = list[i]; else { img.remove(); const t = letterTile(p, 'nav-icon tile-sm'); t.style.color = '#fff'; item.prepend(t); } };
      img.src = list[0];
      item.append(img, nameSpan);
    }
  }
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('card-' + p.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeMobileNav();
  });
  nav.appendChild(item);
}

const spy = new IntersectionObserver((es) => {
  es.forEach((e) => {
    if (e.isIntersecting) {
      const pid = e.target.id.replace('card-', '');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.pid === pid));
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

/* ─── Mobile nav ─── */
function closeMobileNav() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.remove('open');
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) overlay.remove();
}

function openMobileNav() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.add('open');
  const overlay = el('div', 'sidebar-overlay');
  overlay.onclick = closeMobileNav;
  document.body.appendChild(overlay);
}

/* ─── Provider card ─── */
function buildCard(p) {
  const card = el('div', 'card');
  card.id = 'card-' + p.id;
  const st = { all: [], sel: null, search: null };

  // header
  const header = el('div', 'card-head');
  const logo = el('img', 'card-logo');
  setLogo(logo, p);

  const brand = el('div', 'card-info');
  brand.appendChild(el('div', 'card-name', p.name));
  const urlRow = el('div', 'card-url');
  urlRow.title = p.baseURL;
  urlRow.appendChild(el('span', null, p.baseURL));
  const urlCopy = el('button', 'copy-btn', 'copy');
  urlCopy.onclick = () => copy(p.baseURL, urlCopy);
  urlRow.appendChild(urlCopy);
  brand.appendChild(urlRow);
  const badge = el('div', 'status', 'idle');
  badge.hidden = true;
  header.append(logo, brand, badge);

  // edit/delete for custom providers
  if (p.custom) {
    const actions = el('div', 'card-actions');
    const editBtn = el('button', 'icon-btn');
    editBtn.innerHTML = ICON_EDIT;
    editBtn.title = 'Edit provider';
    editBtn.onclick = (e) => { e.stopPropagation(); openEditDialog(p); };
    const delBtn = el('button', 'icon-btn');
    delBtn.innerHTML = ICON_TRASH;
    delBtn.title = 'Delete provider';
    delBtn.style.cssText = 'color:var(--red)';
    delBtn.onmouseover = () => delBtn.style.borderColor = 'var(--red)';
    delBtn.onmouseout = () => delBtn.style.borderColor = '';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      try {
        await callMethod('custom-providers', 'DELETE', { id: p.id });
        card.remove();
        const navItem = Array.from(document.querySelectorAll('.nav-item')).find(n => n.textContent.includes(p.name));
        if (navItem) navItem.remove();
        allProviders = allProviders.filter(x => x.id !== p.id);
      } catch (err) {}
    };
    actions.append(editBtn, delBtn);
    header.appendChild(actions);
  }

  // key
  const kr = el('div', 'key-row');
  kr.appendChild(el('span', 'key-lbl', 'Key'));
  if (p.custom && p.apiKey) {
    // Custom key stays server-side; show masked value only, never copyable.
    kr.appendChild(el('span', 'key-val', mask(p.apiKey)));
  } else if (p.custom) {
    kr.appendChild(el('span', 'key-val', 'no key — free'));
  } else if (p.noAuth) {
    kr.appendChild(el('span', 'key-val', 'no key needed — free'));
  } else {
    // Built-in providers: keys live in Cloudflare secrets, never in the UI.
    // After password unlock, revealServerKeys() upgrades this row.
    kr.id = 'key-row-' + p.id;
    kr.appendChild(el('span', 'key-val', 'managed by server'));
  }

  // tunnel row (OpenCode Local Tunnel only)
  let tunnelRow = null;
  if (p.id === 'mysitefree') {
    tunnelRow = el('div', 'key-row');
    tunnelRow.id = 'tunnel-row-' + p.id;
    const tlbl = el('span', 'key-lbl', 'Tunnel');
    const tval = el('span', 'key-val', 'checking…');
    tval.id = 'tunnel-url-val';
    const tdot = el('span', 'tunnel-dot');
    tdot.id = 'tunnel-dot';
    tdot.style.cssText = 'width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px;background:#888';
    tval.prepend(tdot);
    const tcheck = el('button', 'icon-btn');
    tcheck.innerHTML = ICON_CHECK;
    tcheck.title = 'Check tunnel status';
    tcheck.onclick = async () => {
      tdot.style.background = '#888';
      tval.childNodes[tval.childNodes.length - 1].textContent = 'checking…';
      try {
        const r = await fetch(BRIDGE + '/tunnel-status');
        const d = await r.json();
        tdot.style.background = d.alive ? '#22c55e' : '#ef4444';
        tval.childNodes[tval.childNodes.length - 1].textContent = d.tunnelUrl || 'none';
        tval.title = d.tunnelUrl || '';
        if (d.tunnelUrl) {
          let copyBtn = tval.querySelector('.copy-btn');
          if (!copyBtn) { copyBtn = el('button', 'copy-btn', 'copy'); copyBtn.style.marginLeft = '6px'; tval.appendChild(copyBtn); }
          copyBtn.onclick = () => copy(d.tunnelUrl, copyBtn);
        }
      } catch {
        tdot.style.background = '#ef4444';
        tval.childNodes[tval.childNodes.length - 1].textContent = 'unreachable';
      }
    };
    tunnelRow.append(tlbl, tval, tcheck);
  }

  // body
  const body = el('div', 'card-body');

  // model: search + select + copy
  const modelField = el('div', 'field');
  modelField.appendChild(el('label', 'field-label', 'Model'));
  const si = el('input', 'input');
  si.placeholder = 'Search models…';
  si.disabled = true;
  si.style.marginBottom = '6px';
  st.search = si;
  const sel = el('select', 'select');
  sel.appendChild(el('option', null, 'Loading…'));
  sel.disabled = true;
  st.sel = sel;
  const innerRow = el('div', 'model-row');
  innerRow.append(sel);
  const modelCopy = el('button', 'icon-btn');
  modelCopy.innerHTML = ICON_COPY;
  modelCopy.title = 'Copy model name';
  modelCopy.onclick = () => { if (sel.value) copy(sel.value, modelCopy); };
  innerRow.appendChild(modelCopy);
  modelField.append(si, innerRow);

  // prompt: pills + textarea
  const PROMPT_PRESETS = {
    'Ping': 'Reply with exactly: pong',
    'Hello': 'Say hello in one short sentence.',
    'Haiku': 'Write a haiku about code.',
    'Explain': 'Explain recursion in one short paragraph.',
  };
  const promptField = el('div', 'field');
  promptField.appendChild(el('label', 'field-label', 'Prompt'));
  const pillRow = el('div', 'preset-row');
  const taWrap = el('div', 'prompt-area');
  const ta = el('textarea', 'input');
  const savedPrompt = localStorage.getItem('mlab_prompt_' + p.id);
  ta.value = savedPrompt || PROMPT_PRESETS['Ping'];
  for (const [name, text] of Object.entries(PROMPT_PRESETS)) {
    const b = el('button', 'preset-pill', name);
    b.type = 'button';
    b.onclick = () => { ta.value = text; ta.focus(); markActive(name); };
    pillRow.appendChild(b);
  }
  function markActive(activeName) {
    pillRow.querySelectorAll('.preset-pill').forEach(b => b.classList.toggle('active', b.textContent === activeName));
  }
  ta.addEventListener('input', () => {
    localStorage.setItem('mlab_prompt_' + p.id, ta.value);
    const found = Object.entries(PROMPT_PRESETS).find(([, text]) => text === ta.value);
    markActive(found ? found[0] : null);
  });
  markActive((Object.entries(PROMPT_PRESETS).find(([, text]) => text === ta.value) || [])[0] || null);
  taWrap.append(ta);
  promptField.append(pillRow, taWrap);

  // buttons
  const br = el('div', 'btn-row');
  const loadBtn = el('button', 'btn btn-ghost');
  loadBtn.innerHTML = ICON_RELOAD + '<span>Models</span>';
  const testBtn = el('button', 'btn btn-primary');
  testBtn.innerHTML = ICON_BOLT + '<span>Test</span>';
  br.append(loadBtn, testBtn);

  // result
  const res = el('div', 'result');
  res.className = 'result placeholder'; res.textContent = 'Run a test to see the result here.';

  body.append(modelField, promptField, br, res);
  card.append(header, kr, ...(tunnelRow ? [tunnelRow] : []), body);

  // search handler
  si.addEventListener('input', () => {
    const q = si.value.toLowerCase();
    const filtered = q ? st.all.filter(m => m.toLowerCase().includes(q)) : st.all;
    sel.innerHTML = '';
    if (!filtered.length) { sel.appendChild(el('option', null, 'no match')); return; }
    for (const m of filtered) { const o = el('option', null, m); o.value = m; sel.appendChild(o); }
    const prev = sel.dataset.prev;
    if (prev && filtered.includes(prev)) sel.value = prev;
  });

  loadBtn.addEventListener('click', () => doLoad());
  testBtn.addEventListener('click', () => doTest());

  async function doLoad() {
    sel.disabled = true; si.disabled = true;
    badge.hidden = false; badge.className = 'status load'; badge.textContent = 'loading…';
    res.classList.remove('placeholder');
    res.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    try {
      const d = await callFn('models', { providerId: p.id });
      st.all = d.models;
      sel.innerHTML = '';
      for (const m of d.models) { const o = el('option', null, m); o.value = m; sel.appendChild(o); }
      if (p.defaultModel && d.models.includes(p.defaultModel)) sel.value = p.defaultModel;
      sel.dataset.prev = sel.value;
      sel.disabled = false; si.disabled = false; si.value = '';
      badge.className = 'status ok'; badge.textContent = p.name;
      res.className = 'result placeholder'; res.textContent = 'Pick a model and hit Test.';
      const nb = document.getElementById('nav-badge-' + p.id);
      if (nb) nb.textContent = d.count;
      // Auto-check tunnel status for OpenCode Local Tunnel
      if (p.id === 'mysitefree') {
        const tcheck = document.querySelector('#tunnel-row-' + p.id + ' .icon-btn');
        if (tcheck) tcheck.click();
      }
    } catch (e) {
      badge.className = 'status err'; badge.textContent = 'error';
      res.classList.remove('placeholder');
      res.className = 'result err'; res.textContent = '✗ ' + e.message;
    }
  }

  async function doTest() {
    const model = sel.value;
    if (!model || model === 'no match' || model === 'Loading…') return;
    sel.dataset.prev = model;
    testBtn.disabled = true;
    badge.hidden = false; badge.className = 'status load'; badge.textContent = 'testing…';
    res.classList.remove('placeholder');
    res.className = 'result'; res.textContent = 'Testing ' + model + '…';
    try {
      const d = await callFn('chat', { providerId: p.id, model, messages: [{ role: 'user', content: ta.value }], maxTokens: 128 });
      let html = '<div class="meta">' + esc(d.model || model) + ' · ' + (d.ms || '') + 'ms' + (d.via ? ' · ' + esc(d.via) : '') + '</div>';
      if (d.reasoning) html += '<div class="reasoning">' + esc(d.reasoning.slice(0, 400)) + '</div>';
      html += '<div>' + esc(d.content || '(empty)') + '</div>';
      res.classList.remove('placeholder');
      res.innerHTML = html;
      badge.className = 'status ok'; badge.textContent = d.ms + 'ms';
    } catch (e) {
      res.classList.remove('placeholder');
      res.className = 'result err'; res.textContent = '✗ ' + e.message;
      badge.className = 'status err'; badge.textContent = 'error';
    } finally { testBtn.disabled = false; }
  }

  doLoad();
  spy.observe(card);
  return card;
}

/* ─── Model Manager card ─── */
function buildDedupCard() {
  const card = el('div', 'card');
  card.id = 'card-dedup';
  card.style.cssText = 'grid-column:1/-1';

  const header = el('div', 'card-head');
  header.style.cssText = 'display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border)';
  const title = el('div', 'card-info');
  title.appendChild(el('div', 'card-name', 'Model Manager'));
  const countBadge = el('span', 'status', 'loading…');
  countBadge.style.marginLeft = '8px';
  header.append(title, countBadge);

  const body = el('div', 'card-body');
  body.style.cssText = 'padding:16px 20px 20px';
  const list = el('div', 'dedup-list');
  body.appendChild(list);

  card.append(header, body);

  async function load() {
    countBadge.className = 'status load';
    countBadge.textContent = 'loading…';
    list.innerHTML = '';
    try {
      const d = await callGet('model-dedup');
      const groups = d.groups || [];
      countBadge.textContent = groups.length + ' duplicate' + (groups.length !== 1 ? 's' : '');
      countBadge.className = 'status' + (groups.length ? ' ok' : '');

      if (!groups.length) {
        list.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:20px 0;text-align:center">No duplicate models found. Each model is available on only one provider.</div>';
        return;
      }

      for (const g of groups) {
        const row = el('div', 'dedup-row');
        const nameEl = el('span', 'dedup-model', g.model);
        nameEl.title = g.model;
        row.appendChild(nameEl);
        const chipRow = el('div', 'dedup-chips');
        for (const p of g.providers) {
          const chip = el('button', 'dedup-chip');
          chip.dataset.model = g.model;
          chip.dataset.pid = p.id;
          chip.style.cssText = 'background:' + (p.color || '#666') + '22;border:1px solid ' + (p.color || '#666') + '66;color:' + (p.color || '#666');
          if (p.name) chip.title = p.name + (p.enabled ? ' (enabled)' : ' (disabled)');
          chip.textContent = p.name || p.id;
          if (!p.enabled) {
            chip.classList.add('dedup-chip-off');
          }
          chip.addEventListener('click', () => toggleChip(chip));
          chipRow.appendChild(chip);
        }
        row.appendChild(chipRow);
        list.appendChild(row);
      }
    } catch (e) {
      countBadge.textContent = 'error';
      countBadge.className = 'status err';
      list.innerHTML = '<div class="result err">✗ ' + esc(e.message) + '</div>';
    }
  }

  async function toggleChip(chip) {
    const model = chip.dataset.model;
    const pid = chip.dataset.pid;
    const wasOn = !chip.classList.contains('dedup-chip-off');
    // Optimistic UI
    chip.classList.toggle('dedup-chip-off', wasOn);
    chip.style.opacity = wasOn ? '0.4' : '1';
    chip.style.filter = wasOn ? 'grayscale(1)' : '';
    try {
      const d = await callMethod('model-dedup', 'POST', { model, providerId: pid, enabled: !wasOn });
      // Rebuild chips from response
      if (d.ok && d.group) {
        const row = chip.closest('.dedup-row');
        const chipRow = row.querySelector('.dedup-chips');
        chipRow.innerHTML = '';
        for (const p of d.group.providers) {
          const c = el('button', 'dedup-chip');
          c.dataset.model = d.group.model;
          c.dataset.pid = p.id;
          c.style.cssText = 'background:' + (p.color || '#666') + '22;border:1px solid ' + (p.color || '#666') + '66;color:' + (p.color || '#666');
          if (p.name) c.title = p.name + (p.enabled ? ' (enabled)' : ' (disabled)');
          c.textContent = p.name || p.id;
          if (!p.enabled) c.classList.add('dedup-chip-off');
          c.addEventListener('click', () => toggleChip(c));
          chipRow.appendChild(c);
        }
      }
    } catch {
      // Revert on failure
      chip.classList.toggle('dedup-chip-off', !wasOn);
      chip.style.opacity = wasOn ? '1' : '0.4';
      chip.style.filter = wasOn ? '' : 'grayscale(1)';
    }
  }

  load();
  return card;
}

/* ─── Edit dialog ─── */
function openEditDialog(p) {
  const dlg = document.getElementById('prov-dialog');
  const title = dlg.querySelector('.dlg-title');
  const sub = dlg.querySelector('.dlg-sub');
  const nameI = document.getElementById('prov-name');
  const baseI = document.getElementById('prov-base');
  const keyI = document.getElementById('prov-key');
  const saveBtn = document.getElementById('prov-save');
  const err = document.getElementById('prov-err');

  title.textContent = 'Edit provider';
  if (sub) sub.textContent = 'Update this shared provider for all visitors.';
  nameI.value = p.name;
  baseI.value = p.baseURL;
  keyI.value = p.apiKey || '';
  err.textContent = '';
  saveBtn.disabled = false; saveBtn.textContent = 'Save changes';

  const origSubmit = dlg._editSubmit;
  if (origSubmit) saveBtn.removeEventListener('click', origSubmit);

  function cleanup() {
    title.textContent = 'Add shared provider';
    sub.textContent = 'Visible to every visitor. Any OpenAI-compatible endpoint.';
    if (origSubmit) saveBtn.addEventListener('click', origSubmit);
  }

  const handler = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = nameI.value.trim();
    const baseURL = baseI.value.trim();
    if (name.length < 2 || name.length > 40) { err.textContent = 'Name must be 2–40 characters.'; return; }
    try { new URL(baseURL); } catch { err.textContent = 'Enter a valid URL.'; return; }
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    try {
      await callMethod('custom-providers', 'PUT', { id: p.id, name, baseURL, apiKey: keyI.value.trim() });
      cleanup();
      dlg.close();
      location.reload();
    } catch (ex) {
      err.textContent = ex.message;
      saveBtn.disabled = false; saveBtn.textContent = 'Save changes';
    }
  };
  saveBtn.addEventListener('click', handler, { once: true });
  dlg.showModal();
  nameI.focus();
}

/* ─── Auth ─── */
async function verifyPassword(pw) {
  try {
    const r = await fetch(api('auth'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const d = await r.json().catch(() => ({}));
    return !!(r.ok && d.ok);
  } catch { return false; }
}

function buildUI() {
  buildNav();
  const grid = $('#cards');
  for (const p of PROVIDERS) grid.appendChild(buildCard(p));
  // Shared custom providers
  callGet('custom-providers').then((d) => {
    for (const c of (d.providers || [])) {
      const card = buildCard({
        id: c.id, name: c.name, color: '#0066FF',
        baseURL: c.baseURL, apiKey: c.apiKey, custom: true, defaultModel: '',
        icon: c.logoUrl || '',
      });
      grid.appendChild(card);
      addCustomToNav(c);
    }
  }).catch(() => {});
  // Model Manager card (dedup)
  grid.appendChild(buildDedupCard());
  // Visitor count
  callGet('visits').then((v) => {
    if (v && v.ok) document.getElementById('visits').innerHTML = `<b>${v.count}</b> visitors`;
  }).catch(() => {});
  wireDialog();
  wireKeys();
  wireAll();
}

/* ─── API keys dialog (Incunabula as an OpenAI gateway) ─── */
function timeAgo(ts) {
  if (!ts) return 'never used';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function wireKeys() {
  const dlg = document.getElementById('keys-dialog');
  const err = document.getElementById('keys-err');
  const baseI = document.getElementById('keys-base-val');
  const keyI = document.getElementById('keys-key-val');
  let keyId = null;

  function show(k) {
    keyId = k ? k.id : null;
    keyI.value = k ? k.key : '';
  }

  async function load() {
    err.textContent = '';
    try {
      const d = await keysCall('ensure');
      show(d.key);
    } catch (e) { err.textContent = e.message; show(null); }
  }

  document.getElementById('keys-btn').onclick = () => {
    baseI.value = location.origin + '/v1';
    load();
    dlg.showModal();
  };
  document.getElementById('keys-base-copy').onclick = (e) => copy(baseI.value, e.target);
  document.getElementById('keys-key-copy').onclick = (e) => copy(keyI.value, e.target);
  document.getElementById('keys-key-del').onclick = async () => {
    if (!keyId) return;
    err.textContent = '';
    try {
      const r = await keysCall('revoke', { id: keyId });
      // Deleting the prebuilt key auto-creates a fresh one.
      if (r.newKey) show(r.newKey);
      else load();
    } catch (e) { err.textContent = e.message; }
  };
  document.getElementById('keys-close').onclick = () => dlg.close();
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

/* ─── All providers dialog (copy base URLs + keys for every provider) ─── */
function wireAll() {
  const dlg = document.getElementById('all-dialog');
  const list = document.getElementById('all-list');
  const err = document.getElementById('all-err');
  const copyAllBtn = document.getElementById('all-copy');
  if (!dlg || !list) return;
  let cache = { universal_base: '', providers: [] };
  const blockFor = (p) => '# ' + (p.name || p.id || 'provider') + '\nBASE_URL=' + (p.baseURL || '') + '\nAPI_KEY=' + (p.key || '(none)');

  function render(providers) {
    list.innerHTML = '';
    if (!providers.length) {
      const empty = el('div', null, 'No providers found.');
      empty.style.cssText = 'font-size:13px;color:var(--muted)';
      list.appendChild(empty);
      return;
    }
    providers.forEach((p) => {
      const row = el('div');
      row.style.cssText = 'border:1px solid var(--border);border-radius:6px;padding:8px 10px;background:var(--surface-2)';
      const top = el('div');
      top.style.cssText = 'display:flex;align-items:center;gap:8px';
      const nameEl = el('span', null, p.name || p.id || 'provider');
      nameEl.style.cssText = 'font-weight:700;font-size:13px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      nameEl.title = p.name || p.id || '';
      const cb = el('button', 'copy-btn', 'copy');
      cb.onclick = () => copy(blockFor(p), cb);
      top.append(nameEl, cb);
      const baseEl = el('div', null, p.baseURL || '');
      baseEl.style.cssText = 'font-family:var(--mono);font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px';
      baseEl.title = p.baseURL || '';
      const keyEl = el('div', null, p.key ? mask(p.key) : '(none)');
      keyEl.style.cssText = 'font-family:var(--mono);font-size:11px;color:var(--faint);margin-top:2px;word-break:break-all';
      row.append(top, baseEl, keyEl);
      list.appendChild(row);
    });
  }

  async function load() {
    err.textContent = '';
    list.innerHTML = '<div style="font-size:13px;color:var(--muted)">' + esc('Loading…') + '</div>';
    try {
      const d = await keysCall('provider-keys');
      cache.universal_base = d.universal_base || '';
      cache.providers = d.providers || [];
      render(cache.providers);
    } catch (e) {
      list.innerHTML = '';
      err.textContent = e.message;
    }
  }

  document.getElementById('allprov-btn').onclick = () => {
    load(); // fetch live on EVERY open, never cached
    dlg.showModal();
  };
  copyAllBtn.onclick = async () => {
    err.textContent = '';
    try {
      const k = await keysCall('ensure');
      const universalKey = (k && k.key && k.key.key) ? k.key.key : '';
      const blocks = cache.providers.map(blockFor);
      const text = 'UNIVERSAL_BASE=' + (cache.universal_base || '') + '\nUNIVERSAL_KEY=' + (universalKey || '') + (blocks.length ? '\n\n' + blocks.join('\n\n') : '');
      copy(text, copyAllBtn);
    } catch (ex) { err.textContent = ex.message; }
  };
  document.getElementById('all-close').onclick = () => dlg.close();
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

function wireDialog() {
  const dlg = document.getElementById('prov-dialog');
  const err = document.getElementById('prov-err');
  const nameI = document.getElementById('prov-name');
  const baseI = document.getElementById('prov-base');
  const keyI = document.getElementById('prov-key');
  const saveBtn = document.getElementById('prov-save');
  const title = dlg.querySelector('.dlg-title');
  const sub = dlg.querySelector('.dlg-sub');

  function reset() {
    title.textContent = 'Add provider';
    if (sub) sub.textContent = '';
    err.textContent = '';
    nameI.value = ''; baseI.value = ''; keyI.value = '';
    saveBtn.disabled = false; saveBtn.textContent = 'Add provider';
  }

  document.getElementById('add-prov-btn').onclick = () => { reset(); dlg.showModal(); setTimeout(() => nameI.focus(), 50); };
  document.getElementById('prov-cancel').onclick = () => dlg.close();
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  const addHandler = async (e) => {
    e.preventDefault();
    const name = nameI.value.trim();
    const baseURL = baseI.value.trim();
    if (name.length < 2 || name.length > 40) { err.textContent = 'Name must be 2–40 characters.'; nameI.focus(); return; }
    try {
      const u = new URL(baseURL);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('proto');
    } catch { err.textContent = 'Enter a valid URL — https://api.example.com/v1'; baseI.focus(); return; }
    err.textContent = '';
    saveBtn.disabled = true; saveBtn.textContent = 'Adding…';
    try {
      await callFn('custom-providers', { name, baseURL, apiKey: keyI.value.trim() });
      try { await keysCall('ensure'); } catch { /* gateway key already exists */ }
      saveBtn.textContent = 'Added ✓';
      setTimeout(() => location.reload(), 400);
    } catch (ex) {
      err.textContent = ex.message;
      saveBtn.disabled = false; saveBtn.textContent = 'Add provider';
    }
  };
  document.getElementById('prov-form').addEventListener('submit', addHandler);
}

let uiBuilt = false;
let serverKeys = null; // provider keys from Cloudflare secrets, password-gated

function showUpdateLoader() {
  const existing = document.getElementById('update-loader');
  if (existing) return;
  const overlay = document.createElement('div');
  overlay.id = 'update-loader';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:200;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px';
  overlay.innerHTML = `
    <div style="width:48px;height:48px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite"></div>
    <div style="font-size:15px;font-weight:600;color:var(--text)">Checking OpenCode updates…</div>
    <div id="update-status" style="font-size:12px;font-family:var(--mono);color:var(--muted)"></div>
  `;
  const style = document.createElement('style');
  style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  overlay.appendChild(style);
  document.body.appendChild(overlay);
}

function hideUpdateLoader() {
  const overlay = document.getElementById('update-loader');
  if (overlay) overlay.remove();
}

function setUpdateStatus(text) {
  const el = document.getElementById('update-status');
  if (el) el.textContent = text;
}

async function runBridgeUpdate() {
  showUpdateLoader();
  try {
    setUpdateStatus('Checking version…');
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 180000);
    const r = await fetch(BRIDGE + '/api/update', { method: 'POST', signal: c.signal });
    clearTimeout(t);
    const d = await r.json().catch(() => ({}));
    if (d.updated) {
      setUpdateStatus('Updated to ' + d.after + ' — ' + d.count + ' free models');
    } else {
      setUpdateStatus('Up to date (' + d.after + ') — ' + d.count + ' free models');
    }
    await new Promise(ok => setTimeout(ok, 800));
  } catch {
    setUpdateStatus('Bridge offline — skipped');
    await new Promise(ok => setTimeout(ok, 600));
  }
  hideUpdateLoader();
}

function unlock() {
  document.getElementById('lock').classList.add('hidden');
  if (!uiBuilt) { uiBuilt = true; buildUI(); }
  revealServerKeys();
  // Instant update: show loader → check version → update if needed → fetch models.
  if (bridgeAlive()) runBridgeUpdate();
}

// After correct password: fetch live provider keys from secrets and upgrade
// the "managed by server" rows to masked value + copy button.
async function revealServerKeys() {
  try {
    const d = await keysCall('provider-keys');
    if (!d || !d.keys) return;
    serverKeys = d.keys;
    for (const [pid, key] of Object.entries(serverKeys)) {
      if (!key) continue;
      const row = document.getElementById('key-row-' + pid);
      if (!row) continue;
      row.innerHTML = '';
      row.appendChild(el('span', 'key-lbl', 'Key'));
      row.appendChild(el('span', 'key-val', mask(key)));
      const kb = el('button', 'copy-btn', 'copy');
      kb.onclick = () => copy(key, kb);
      row.appendChild(kb);
    }
  } catch { /* stay masked */ }
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
    if (ok) {
      localStorage.setItem('mlab_pw', pw);
      err.textContent = '';
      unlock();
    } else {
      err.textContent = '✗ Wrong password';
      input.select();
    }
  }
  btn.onclick = tryUnlock;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
  input.focus();
}

initGate();
document.getElementById('mobile-menu-btn').addEventListener('click', openMobileNav);
