const PROVIDERS = [
  { id:'tokenrouter', name:'TokenRouter', color:'#0ea5e9', baseURL:'https://api.tokenrouter.com/v1', defaultModel:'z-ai/glm-5.3-free', icon:'https://www.tokenrouter.com/logo-without-title.png' },
  { id:'nvidia', name:'NVIDIA NIM', color:'#76b900', baseURL:'https://integrate.api.nvidia.com/v1', defaultModel:'meta/llama-3.3-70b-instruct', icon:'https://developer.download.nvidia.com/icons/m48-nim-256px-blk.png' },
  { id:'openrouter', name:'OpenRouter', color:'#8b5cf6', baseURL:'https://openrouter.ai/api/v1', defaultModel:'openai/gpt-4o-mini', icon:'https://openrouter.ai/brand/v2/openrouter-glyph-light.svg' },
  { id:'tokenharbor', name:'Token Harbor', color:'#f97316', baseURL:'https://tokenharbor.ai/v1', defaultModel:'deepseek-v4-flash' },
  { id:'tokenforge', name:'Token Forge', color:'#ef4444', baseURL:'https://tokenforge.ai.studio/v1', defaultModel:'claude-opus-5' },
  { id:'orcarouter', name:'OrcaRouter', color:'#f59e0b', baseURL:'https://www.orcarouter.ai/v1', defaultModel:'orcarouter/free', icon:'https://www.orcarouter.ai/orca-logo.png' },
  { id:'aihubmix', name:'AI Hub Mix', color:'#06b6d4', baseURL:'https://aihubmix.com/v1', defaultModel:'gpt-4o' },
  { id:'inception', name:'Inception', color:'#ff3b30', baseURL:'https://api.inceptionlabs.ai/v1', defaultModel:'mercury', icon:'' },
  { id:'kilo', name:'Kilo Gate', color:'#ff6a00', baseURL:'https://api.kilo.ai/api/gateway', noAuth:true, defaultModel:'anthropic/claude-sonnet-4.5', icon:'' },
];

const SVG = (i) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i}</svg>`;
const ICON = {
  bolt: SVG('<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>'),
  copy: SVG('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  reload: SVG('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>'),
  trash: SVG('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  edit: SVG('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
  plus: SVG('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
  check: SVG('<polyline points="20 6 9 17 4 12"/>'),
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

function copy(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = ICON.check;
    setTimeout(() => btn.innerHTML = orig, 800);
  });
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
function letterTile(p, cls) {
  const t = el('div', cls, (p.name || '?').trim().charAt(0).toUpperCase());
  t.style.background = p.color || '#141414';
  return t;
}
function setLogo(img, p) {
  if (p.icon) { img.alt = p.name; img.loading = 'lazy'; img.onerror = () => img.replaceWith(letterTile(p, 'card-logo tile')); img.src = p.icon; return; }
  const list = iconCandidates(p.baseURL);
  if (!list.length) { img.replaceWith(letterTile(p, 'card-logo tile')); return; }
  img.alt = p.name; img.loading = 'lazy';
  let i = 0;
  img.onerror = () => { i++; if (i < list.length) img.src = list[i]; else img.replaceWith(letterTile(p, 'card-logo tile')); };
  img.src = list[0];
}

/* ─── Sidebar ─── */
let allProviders = [];
function buildNav() {
  const nav = $('#nav');
  nav.innerHTML = '';
  allProviders = [...PROVIDERS];
  allProviders.forEach((p, i) => {
    const item = el('div', 'nav-item' + (i === 0 ? ' active' : ''));
    item.dataset.pid = p.id;
    const icon = el('div', 'nav-icon-circle');
    icon.style.background = p.color + '18';
    icon.style.color = p.color;
    icon.style.borderColor = p.color + '30';
    const letter = (p.name || '?').trim().charAt(0).toUpperCase();
    icon.textContent = letter;
    if (p.icon) {
      const img = el('img', 'nav-icon-img'); img.alt = '';
      img.onerror = () => { img.remove(); icon.textContent = letter; };
      img.src = p.icon; icon.textContent = ''; icon.appendChild(img);
    } else {
      const favs = iconCandidates(p.baseURL);
      if (favs.length) {
        const img = el('img', 'nav-icon-img'); img.alt = ''; let fi = 0;
        img.onerror = () => { fi++; if (fi < favs.length) img.src = favs[fi]; else { img.remove(); icon.textContent = letter; } };
        img.src = favs[0]; icon.textContent = ''; icon.appendChild(img);
      }
    }
    const nameSpan = el('span', 'nav-name', p.name);
    const badge = el('span', 'nav-badge', '—');
    badge.id = 'nav-badge-' + p.id;
    item.append(icon, nameSpan, badge);
    item.addEventListener('click', () => { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); item.classList.add('active'); document.getElementById('card-' + p.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); closeMobileNav(); });
    nav.appendChild(item);
  });
}
function addCustomToNav(p) {
  allProviders.push(p);
  const nav = $('#nav');
  const item = el('div', 'nav-item');
  item.dataset.pid = p.id;
  const icon = el('div', 'nav-icon-circle');
  icon.style.background = (p.color || '#60A5FA') + '18';
  icon.style.color = p.color || '#60A5FA';
  icon.style.borderColor = (p.color || '#60A5FA') + '30';
  const letter = (p.name || '?').trim().charAt(0).toUpperCase();
  icon.textContent = letter;
  const favs = iconCandidates(p.baseURL);
  if (favs.length) {
    const img = el('img', 'nav-icon-img'); img.alt=''; let fi=0;
    img.onerror = () => { fi++; if (fi < favs.length) img.src = favs[fi]; else { img.remove(); icon.textContent = letter; } };
    img.src = favs[0]; icon.textContent=''; icon.appendChild(img);
  }
  const nameSpan = el('span', 'nav-name', p.name);
  const badge = el('span', 'nav-badge', '—');
  badge.id = 'nav-badge-' + p.id;
  item.append(icon, nameSpan, badge);
  item.addEventListener('click', () => { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); item.classList.add('active'); document.getElementById('card-' + p.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); closeMobileNav(); });
  nav.appendChild(item);
}
const spy = new IntersectionObserver((es) => {
  es.forEach((e) => { if (e.isIntersecting) { const pid = e.target.id.replace('card-', ''); document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.pid === pid)); } });
}, { rootMargin: '-40% 0px -55% 0px' });

/* ─── Mobile ─── */
function closeMobileNav() { document.querySelector('.sidebar').classList.remove('open'); document.querySelector('.sidebar-overlay')?.remove(); }
function openMobileNav() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.add('open');
  const overlay = el('div', 'sidebar-overlay');
  overlay.onclick = closeMobileNav;
  document.body.appendChild(overlay);
}

/* ─── Model card ─── */
const FREE_RE = /free|pickle|:free$/i;
function isFreeModel(id) { return FREE_RE.test(id); }

function buildCard(p) {
  const card = el('div', 'card');
  card.id = 'card-' + p.id;
  const st = { all: [], filtered: [], freeOnly: true, vis: {}, sel: null };

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

  if (p.custom) {
    const actions = el('div', 'card-actions');
    const editBtn = el('button', 'icon-btn');
    editBtn.innerHTML = ICON.edit;
    editBtn.title = 'Edit';
    editBtn.onclick = (e) => { e.stopPropagation(); openEditDialog(p); };
    const delBtn = el('button', 'icon-btn icon-btn-danger');
    delBtn.innerHTML = ICON.trash;
    delBtn.title = 'Delete';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      try { await callMethod('custom-providers', 'DELETE', { id: p.id }); card.remove(); document.querySelector(`.nav-item[data-pid="${p.id}"]`)?.remove(); allProviders = allProviders.filter(x => x.id !== p.id); } catch {}
    };
    actions.append(editBtn, delBtn);
    header.appendChild(actions);
  }

  // body
  const body = el('div', 'card-body');

  // model section
  const modelField = el('div', 'field');
  const si = el('input', 'input');
  si.placeholder = 'Search models…';
  si.disabled = true;
  const freeRow = el('div', 'free-row');
  const freeLabel = el('label', 'toggle-label');
  const freeCb = el('input');
  freeCb.type = 'checkbox';
  freeCb.checked = true;
  freeCb.className = 'toggle-input';
  const freeTrack = el('span', 'toggle-track');
  const freeKnob = el('span', 'toggle-knob');
  freeTrack.appendChild(freeKnob);
  freeLabel.append(freeCb, freeTrack, el('span', null, 'Free only'));
  freeRow.appendChild(freeLabel);
  const sel = el('select', 'select');
  sel.appendChild(el('option', null, 'Loading…'));
  sel.disabled = true;
  st.sel = sel;
  const innerRow = el('div', 'model-row');
  innerRow.append(sel);
  const modelCopy = el('button', 'icon-btn');
  modelCopy.innerHTML = ICON.copy;
  modelCopy.title = 'Copy model';
  modelCopy.onclick = () => { if (sel.value) copy(sel.value, modelCopy); };
  innerRow.appendChild(modelCopy);
  modelField.append(si, freeRow, innerRow);

  // prompt
  const PROMPT_PRESETS = { 'Ping': 'Reply with exactly: pong', 'Hello': 'Say hello in one short sentence.', 'Haiku': 'Write a haiku about code.' };
  const promptField = el('div', 'field');
  const pillRow = el('div', 'preset-row');
  const taWrap = el('div', 'prompt-area');
  const ta = el('textarea', 'input');
  ta.value = localStorage.getItem('mlab_prompt_' + p.id) || PROMPT_PRESETS['Ping'];
  ta.rows = 2;
  for (const [name, text] of Object.entries(PROMPT_PRESETS)) {
    const b = el('button', 'preset-pill', name);
    b.type = 'button';
    b.onclick = () => { ta.value = text; ta.focus(); markActive(name); };
    pillRow.appendChild(b);
  }
  function markActive(n) { pillRow.querySelectorAll('.preset-pill').forEach(b => b.classList.toggle('active', b.textContent === n)); }
  ta.addEventListener('input', () => { localStorage.setItem('mlab_prompt_' + p.id, ta.value); const f = Object.entries(PROMPT_PRESETS).find(([, t]) => t === ta.value); markActive(f ? f[0] : null); });
  markActive((Object.entries(PROMPT_PRESETS).find(([, t]) => t === ta.value) || [])[0] || null);
  taWrap.append(ta);
  promptField.append(pillRow, taWrap);

  // buttons
  const br = el('div', 'btn-row');
  const loadBtn = el('button', 'btn btn-ghost');
  loadBtn.innerHTML = ICON.reload + '<span>Models</span>';
  const testBtn = el('button', 'btn btn-primary');
  testBtn.innerHTML = ICON.bolt + '<span>Test</span>';
  br.append(loadBtn, testBtn);

  // result
  const res = el('div', 'result placeholder');
  res.textContent = 'Run a test to see the result here.';

  body.append(modelField, promptField, br, res);
  card.append(header, body);

  // model list with toggles
  const modelList = el('div', 'model-list');
  modelList.style.display = 'none';
  body.appendChild(modelList);

  // filter
  function applyFilter() {
    const q = si.value.toLowerCase();
    let pool = st.freeOnly ? st.all.filter(m => isFreeModel(m)) : st.all;
    if (q) pool = pool.filter(m => m.toLowerCase().includes(q));
    st.filtered = pool;
    sel.innerHTML = '';
    if (!pool.length) { sel.appendChild(el('option', null, q ? 'no match' : 'no free models')); return; }
    for (const m of pool) { const o = el('option', null, m); o.value = m; sel.appendChild(o); }
    const prev = sel.dataset.prev;
    if (prev && pool.includes(prev)) sel.value = prev;
    renderModelList();
  }
  si.addEventListener('input', applyFilter);
  freeCb.addEventListener('change', () => { st.freeOnly = freeCb.checked; applyFilter(); });

  function renderModelList() {
    modelList.innerHTML = '';
    const toShow = st.freeOnly ? st.all.filter(m => isFreeModel(m)) : st.all;
    if (!toShow.length) { modelList.style.display = 'none'; return; }
    modelList.style.display = '';
    for (const m of toShow) {
      const row = el('div', 'model-row-item');
      const name = el('span', 'model-name', m);
      name.title = m;
      const switchLabel = el('label', 'toggle-label');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.className = 'toggle-input';
      cb.checked = st.vis[p.id + '/' + m] !== false;
      const track = el('span', 'toggle-track');
      const knob = el('span', 'toggle-knob');
      track.appendChild(knob);
      switchLabel.append(cb, track);
      cb.addEventListener('change', async () => {
        const key = p.id + '/' + m;
        st.vis[key] = cb.checked;
        try { await callMethod('model-visibility', 'POST', { providerId: p.id, model: m, enabled: cb.checked }); } catch { st.vis[key] = !cb.checked; cb.checked = !cb.checked; }
      });
      row.append(name, switchLabel);
      modelList.appendChild(row);
    }
  }

  loadBtn.addEventListener('click', () => doLoad());
  testBtn.addEventListener('click', () => doTest());

  async function doLoad() {
    sel.disabled = true; si.disabled = true;
    badge.hidden = false; badge.className = 'status load'; badge.textContent = 'loading…';
    res.className = 'result placeholder'; res.textContent = 'Loading…';
    modelList.innerHTML = '';
    try {
      const [d, visResp] = await Promise.all([callFn('models', { providerId: p.id }), callGet('model-visibility')]);
      st.all = d.models;
      st.vis = visResp.visibility || {};
      applyFilter();
      if (p.defaultModel && st.filtered.includes(p.defaultModel)) sel.value = p.defaultModel;
      sel.dataset.prev = sel.value;
      sel.disabled = false; si.disabled = false; si.value = '';
      badge.className = 'status ok'; badge.textContent = d.count + ' models';
      res.className = 'result placeholder'; res.textContent = 'Pick a model and hit Test.';
      const nb = document.getElementById('nav-badge-' + p.id);
      if (nb) nb.textContent = d.count;
    } catch (e) {
      badge.className = 'status err'; badge.textContent = 'error';
      res.className = 'result err'; res.textContent = '✗ ' + e.message;
    }
  }

  async function doTest() {
    const model = sel.value;
    if (!model || model === 'no match' || model === 'no free models' || model === 'Loading…') return;
    sel.dataset.prev = model;
    testBtn.disabled = true;
    badge.hidden = false; badge.className = 'status load'; badge.textContent = 'testing…';
    res.className = 'result'; res.textContent = 'Testing ' + model + '…';
    try {
      const d = await callFn('chat', { providerId: p.id, model, messages: [{ role: 'user', content: ta.value }], maxTokens: 128 });
      let html = '<div class="meta">' + esc(d.model || model) + ' · ' + (d.ms || '') + 'ms' + (d.via ? ' · ' + esc(d.via) : '') + '</div>';
      if (d.reasoning) html += '<div class="reasoning">' + esc(d.reasoning.slice(0, 400)) + '</div>';
      html += '<div>' + esc(d.content || '(empty)') + '</div>';
      res.className = 'result'; res.innerHTML = html;
      badge.className = 'status ok'; badge.textContent = d.ms + 'ms';
    } catch (e) {
      res.className = 'result err'; res.textContent = '✗ ' + e.message;
      badge.className = 'status err'; badge.textContent = 'error';
    } finally { testBtn.disabled = false; }
  }

  doLoad();
  spy.observe(card);
  return card;
}

/* ─── Edit dialog ─── */
let _dialogMode = 'add';
function openEditDialog(p) {
  const dlg = document.getElementById('prov-dialog');
  const title = dlg.querySelector('.dlg-title');
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
  try { const r = await fetch(api('auth'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) }); const d = await r.json().catch(() => ({})); return !!(r.ok && d.ok); } catch { return false; }
}

async function keysCall(action, extra){
  const r = await fetch(api('api-keys'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,password:localStorage.getItem('mlab_pw')||'',...(extra||{})})});
  const d = await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'HTTP '+r.status); return d;
}

function wireGateway(){
  const baseInput = document.getElementById('gw-base');
  const keyInput = document.getElementById('gw-key');
  if(!baseInput||!keyInput) return;
  baseInput.value = location.origin + '/v1';
  async function load(){
    try{ const d = await keysCall('ensure'); keyInput.value = (d.key&&d.key.key)||''; } catch{ keyInput.value=''; }
  }
  load();
  document.getElementById('gw-base-copy')?.addEventListener('click', (e)=>copy(baseInput.value, e.currentTarget));
  document.getElementById('gw-key-copy')?.addEventListener('click', (e)=>copy(keyInput.value, e.currentTarget));
  document.getElementById('gw-copy-all')?.addEventListener('click', async (e)=>{
    const btn=e.currentTarget;
    try{
      const d = await keysCall('provider-keys');
      const k = await keysCall('ensure');
      const uniKey=(k&&k.key&&k.key.key)?k.key.key:'';
      const uniBase=d.universal_base||location.origin+'/v1';
      const blocks=(d.providers||[]).map(p=>'# '+p.name+'\nBASE_URL='+p.baseURL+'\nAPI_KEY='+(p.key||'(none)'));
      const text='UNIVERSAL_BASE='+uniBase+'\nUNIVERSAL_KEY='+uniKey+(blocks.length?'\n\n'+blocks.join('\n\n'):'');
      copy(text, btn);
    }catch(ex){ copy(baseInput.value+'\n'+keyInput.value, btn); }
  });
}

function wireAllProviders(){
  const dlg=document.getElementById('all-dialog'); if(!dlg) return;
  const list=document.getElementById('all-list');
  const err=document.getElementById('all-err');
  const copyAllBtn=document.getElementById('all-copy');
  let cache={universal_base:'',providers:[]};
  const blockFor=(p)=>'# '+(p.name||p.id)+'\nBASE_URL='+(p.baseURL||'')+'\nAPI_KEY='+(p.key||'(none)');
  function render(providers){
    list.innerHTML='';
    if(!providers.length){ const empty=el('div',null,'No providers found.'); empty.style.cssText='font-size:13px;color:var(--text-3)'; list.appendChild(empty); return; }
    providers.forEach(p=>{
      const row=el('div'); row.style.cssText='border:1px solid var(--border);border-radius:var(--r-md);padding:8px 10px;background:var(--surface-raised)';
      const top=el('div'); top.style.cssText='display:flex;align-items:center;gap:8px';
      const nameEl=el('span',null,p.name||p.id); nameEl.style.cssText='font-weight:600;font-size:13px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      const cb=el('button','copy-btn','copy'); cb.onclick=()=>copy(blockFor(p),cb);
      top.append(nameEl,cb);
      const baseEl=el('div',null,p.baseURL||''); baseEl.style.cssText='font-family:var(--mono);font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px';
      const keyEl=el('div',null,p.key?mask(p.key):'(none)'); keyEl.style.cssText='font-family:var(--mono);font-size:11px;color:var(--text-4);margin-top:2px;word-break:break-all';
      row.append(top,baseEl,keyEl); list.appendChild(row);
    });
  }
  async function load(){
    err.textContent=''; list.innerHTML='<div style="font-size:13px;color:var(--text-3)">Loading…</div>';
    try{ const d=await keysCall('provider-keys'); cache.universal_base=d.universal_base||''; cache.providers=d.providers||[]; render(cache.providers);}catch(e){ list.innerHTML=''; err.textContent=e.message; }
  }
  document.getElementById('allprov-btn')?.addEventListener('click', ()=>{ load(); dlg.showModal(); });
  copyAllBtn?.addEventListener('click', async ()=>{
    err.textContent='';
    try{ const k=await keysCall('ensure'); const uniKey=(k&&k.key&&k.key.key)?k.key.key:''; const text='UNIVERSAL_BASE='+(cache.universal_base||'')+'\nUNIVERSAL_KEY='+uniKey+(cache.providers.length?'\n\n'+cache.providers.map(blockFor).join('\n\n'):''); copy(text, copyAllBtn);}catch(ex){ err.textContent=ex.message; }
  });
  document.getElementById('all-close')?.addEventListener('click', ()=>dlg.close());
  dlg.addEventListener('click',(e)=>{ if(e.target===dlg) dlg.close(); });
}

function buildUI() {
  buildNav();
  const grid = $('#cards');
  for (const p of PROVIDERS) grid.appendChild(buildCard(p));
  callGet('custom-providers').then((d) => {
    for (const c of (d.providers || [])) {
      const card = buildCard({ id: c.id, name: c.name, color: '#60A5FA', baseURL: c.baseURL, apiKey: c.apiKey, custom: true, defaultModel: '', icon: c.logoUrl || '' });
      grid.appendChild(card);
      addCustomToNav(c);
    }
  }).catch(() => {});
  wireGateway();
  wireAllProviders();
  wireDialog();
}

/* ─── Dialog wiring ─── */
function wireDialog() {
  const dlg = document.getElementById('prov-dialog');
  const err = document.getElementById('prov-err');
  const nameI = document.getElementById('prov-name');
  const baseI = document.getElementById('prov-base');
  const keyI = document.getElementById('prov-key');
  const saveBtn = document.getElementById('prov-save');
  const title = dlg.querySelector('.dlg-title');

  function reset() {
    _dialogMode = 'add';
    title.textContent = 'Add provider';
    err.textContent = '';
    nameI.value = ''; baseI.value = ''; keyI.value = '';
    saveBtn.disabled = false; saveBtn.textContent = 'Add provider';
  }

  document.getElementById('add-prov-btn').onclick = () => { reset(); dlg.showModal(); setTimeout(() => nameI.focus(), 50); };
  document.getElementById('prov-cancel').onclick = () => dlg.close();
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  const addHandler = async (e) => {
    e.preventDefault();
    if (_dialogMode === 'edit') return;
    const name = nameI.value.trim();
    const baseURL = baseI.value.trim();
    if (name.length < 2 || name.length > 40) { err.textContent = 'Name 2–40 chars.'; nameI.focus(); return; }
    try { const u = new URL(baseURL); if (!['http:', 'https:'].includes(u.protocol)) throw 0; } catch { err.textContent = 'Enter a valid URL.'; baseI.focus(); return; }
    err.textContent = '';
    saveBtn.disabled = true; saveBtn.textContent = 'Adding…';
    try {
      await callFn('custom-providers', { name, baseURL, apiKey: keyI.value.trim() });
      saveBtn.textContent = 'Added ✓';
      setTimeout(() => location.reload(), 400);
    } catch (ex) { err.textContent = ex.message; saveBtn.disabled = false; saveBtn.textContent = 'Add provider'; }
  };
  document.getElementById('prov-form').addEventListener('submit', addHandler);
}

let uiBuilt = false;
function unlock() {
  document.getElementById('lock').classList.add('hidden');
  if (!uiBuilt) { uiBuilt = true; buildUI(); }
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
document.getElementById('mobile-menu-btn').addEventListener('click', openMobileNav);
