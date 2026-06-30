const NIM_BASE = 'https://integrate.api.nvidia.com/v1';
const statusPill = document.getElementById('status-pill');
const statusDot = statusPill.querySelector('.status-dot');
const statusText = statusPill.querySelector('.status-text');
const cardStage = document.getElementById('card-stage');
const loader = document.getElementById('loader');
const modelCount = document.getElementById('model-count');

function setStatus(ok, msg) {
  statusDot.className = 'status-dot' + (ok ? '' : ' error');
  statusText.textContent = msg;
}

function formatDate(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function modelCategory(id) {
  const lower = id.toLowerCase();
  if (lower.includes('instruct') || lower.includes('chat')) return 'Instruction';
  if (lower.includes('code') || lower.includes('coder') || lower.includes('codestral')) return 'Code';
  if (lower.includes('embed') || lower.includes('retriever')) return 'Embedding';
  if (lower.includes('vision') || lower.includes('vlm') || lower.includes('fuyu') || lower.includes('kosmos')) return 'Vision';
  if (lower.includes('safety') || lower.includes('guard') || lower.includes('nemoguard')) return 'Safety';
  if (lower.includes('reward') || lower.includes('content')) return 'Safety';
  if (lower.includes('translate') || lower.includes('riva')) return 'Speech';
  if (lower.includes('deplot') || lower.includes('vila')) return 'Vision';
  if (lower.includes('phi') || lower.includes('gemma') || lower.includes('llama')) return 'Language';
  if (lower.includes('mixtral') || lower.includes('mistral') || lower.includes('ministral')) return 'Language';
  if (lower.includes('qwen') || lower.includes('yi-') || lower.includes('deepseek')) return 'Language';
  if (lower.includes('nemotron') || lower.includes('nemo')) return 'Language';
  if (lower.includes('glm') || lower.includes('kimi') || lower.includes('minimax') || lower.includes('step')) return 'Language';
  if (lower.includes('diffusion') || lower.includes('cosmos') || lower.includes('ising')) return 'Multimodal';
  if (lower.includes('palmyra') || lower.includes('granite') || lower.includes('dbrx')) return 'Language';
  return 'General';
}

function providerFromId(id) {
  return id.split('/')[0] || 'nvidia';
}

function randomSlice(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function fetchModels() {
  try {
    const res = await fetch(`${NIM_BASE}/models`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    throw err;
  }
}

function renderCard(model) {
  const provider = providerFromId(model.id);
  const cat = modelCategory(model.id);
  const tags = [cat, provider];
  if (model.id.includes('instruct') || model.id.includes('chat') || model.id.includes('it')) {
    tags.splice(1, 0, 'Chat');
  }
  if (model.id.includes('vision') || model.id.includes('vlm') || model.id.includes('multimodal')) {
    tags.splice(1, 0, 'Multimodal');
  }
  if (model.id.includes('flash')) tags.push('Fast');
  if (model.id.includes('mini')) tags.push('Lightweight');
  if (model.id.includes('large') || model.id.includes('max') || model.id.includes('ultra') || model.id.includes('super') || model.id.includes('maverick')) tags.push('High-Perf');

  const dateStr = formatDate(model.created || Math.floor(Date.now() / 1000));
  const shortId = model.id;

  return `
    <div class="model-card" id="model-card">
      <div class="card-header">
        <div>
          <div class="card-provider-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            ${provider}
          </div>
          <div class="card-model-id">
            ${shortId.split('/')[1] || shortId}
            <span class="suffix">/${shortId.split('/')[0]}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="card-btn" id="copy-btn" title="Copy model ID">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
          <button class="card-btn" id="refresh-btn" title="Pick another model">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
          </button>
        </div>
      </div>
      <div class="card-body">
        <p class="card-description">
          NVIDIA NIM inference microservice for <strong>${provider}</strong>.
          Production-grade model served through the OpenAI-compatible API at <strong>integrate.api.nvidia.com/v1</strong>.
        </p>
        <div class="card-stats">
          <div class="stat-item">
            <div class="stat-label">Model ID</div>
            <div class="stat-value">${shortId}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Owner</div>
            <div class="stat-value">${model.owned_by || 'nvidia-nim'}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Created</div>
            <div class="stat-value">${dateStr}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Category</div>
            <div class="stat-value">${cat}</div>
          </div>
        </div>
        <div class="card-tags">
          ${tags.map(t => `<span class="tag ${t === 'Fast' ? 'green' : t === 'High-Perf' ? 'purple' : ''}">${t}</span>`).join('')}
        </div>
      </div>
      <div class="card-glow-line"></div>
      <div class="card-footer">
        <div class="footer-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          OpenAI SDK Compatible
        </div>
        <div class="footer-right">
          <a class="footer-btn" href="https://build.nvidia.com/explore/discover" target="_blank" rel="noopener">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            API
          </a>
          <button class="footer-btn primary" onclick="document.getElementById('refresh-btn').click()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
            Explore Next
          </button>
        </div>
      </div>
    </div>
  `;
}

function showModel(model) {
  loader.style.display = 'none';
  cardStage.innerHTML = renderCard(model);
  requestAnimationFrame(() => {
    const card = document.getElementById('model-card');
    if (card) card.classList.add('visible');
  });

  document.getElementById('copy-btn')?.addEventListener('click', function() {
    navigator.clipboard.writeText(model.id).then(() => {
      this.classList.add('copied');
      this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        this.classList.remove('copied');
        this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
      }, 2000);
    }).catch(() => {});
  });

  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    const card = document.getElementById('model-card');
    if (card) {
      card.classList.remove('visible');
      await new Promise(r => setTimeout(r, 400));
    }
    cardStage.innerHTML = `<div class="loading-ring" id="loader">
      <div class="ring"></div><div class="ring"></div><div class="ring"></div>
      <p class="loading-msg">Picking another model..</p>
    </div>`;
    init();
  });
}

async function init() {
  try {
    const models = await fetchModels();
    setStatus(true, `${models.length} models live`);
    modelCount.textContent = models.length;
    const pick = models[Math.floor(Math.random() * models.length)]; // single card
    showModel(pick);
  } catch (err) {
    setStatus(false, 'Fetch failed — using fallback');
    modelCount.textContent = '—';
    loader.innerHTML = `<p class="loading-msg" style="color:#ef4444;font-size:15px">Could not reach NVIDIA NIM API. Check your connection.</p>`;
    // fallback demo card
    showModel({
      id: 'nvidia/llama-3.1-nemotron-70b-instruct',
      created: 1720000000,
      owned_by: 'nvidia'
    });
  }
}

init();
