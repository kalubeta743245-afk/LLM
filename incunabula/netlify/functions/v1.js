// Incunabula as an OpenAI-compatible gateway.
//   GET  /v1/models                 — list every model as "<providerId>/<model>"
//   POST /v1/chat/completions       — {model:"<providerId>/<model>", messages:[...]}
// Auth: none — open gateway, no key needed.
// Non-streaming only. Reuses the existing chat/models handlers (ponytail).
const { cors, storeGet, storeSet, getAllProviders, providerFetch, getOpenCodeModels } = require('./_shared');
const chatFn = require('./chat').handler;
const modelsFn = require('./models').handler;

const err = (status, message, reqHeaders) => ({ statusCode: status, headers: cors(reqHeaders), body: JSON.stringify({ error: { message, type: 'invalid_request_error' } }) });

async function findKey(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!key) return null;
  const keys = await storeGet('api-keys', []);
  return keys.find((k) => k.key === key) || null;
}
function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

// Forgiving model resolution: when "provider/model" fails upstream, find the
// same (or closest) model id under any other provider and retry there, so
// third-party SDK clients never have to guess our exact catalogue strings.
function normModel(s) {
  return String(s || '').toLowerCase().replace(/:(free|batch)$/, '').replace(/-(free|latest)$/, '');
}
function findAlternateModel(model, excludePid, byModel) {
  // byModel is a Map(name -> Set(providerId)).
  const get = (name) => [...(byModel.get(name) || [])].filter((p) => p !== excludePid).sort();
  const names = [...byModel.keys()];
  // 1. Exact id under another provider.
  const exact = get(model);
  if (exact.length) return { providerId: exact[0], model };
  const norm = normModel(model);
  // 2. Same id modulo :free/-free/-latest suffixes.
  for (const name of names) {
    if (normModel(name) !== norm) continue;
    const owners = get(name);
    if (owners.length) return { providerId: owners[0], model: name };
  }
  // 3. Provider-prefix added/removed (nested "nvidia/..." catalogue ids).
  const allPids = new Set();
  for (const provs of byModel.values()) for (const p of provs) allPids.add(p);
  for (const pid of [...allPids].sort()) {
    const withPrefix = pid + '/' + model;
    if ((byModel.get(withPrefix) || new Set()).has(pid) && pid !== excludePid) {
      return { providerId: pid, model: withPrefix };
    }
    if (model.startsWith(pid + '/')) {
      const stripped = model.slice(pid.length + 1);
      const owners = get(stripped);
      if (owners.length) return { providerId: owners[0], model: stripped };
    }
  }
  // 4. Closest contains-match (longest catalogue name containing the request or vice versa).
  let best = null;
  for (const name of names) {
    const n = normModel(name);
    if (n === norm || n.includes(norm) || norm.includes(n)) {
      const owners = get(name);
      if (!owners.length) continue;
      if (!best || name.length > best.model.length) best = { providerId: owners[0], model: name };
    }
  }
  return best;
}
function isModelError(status, msg) {
  if (status === 404 || status === 410) return true; // not found / gone upstream
  return /unknown model|not found|no such model|does not exist|invalid model|model_not_found/i.test(String(msg || ''));
}
async function getModelIndex() {
  const CACHE_TTL = 5 * 60 * 1000;
  try {
    const cached = await storeGet('v1-model-index', null);
    if (cached && cached.at && (Date.now() - cached.at) < CACHE_TTL && cached.byName) {
      const byModel = new Map(Object.entries(cached.byName).map(([k, v]) => [k, new Set(v)]));
      return { byModel };
    }
  } catch { /* build fresh */ }
  const { byModel } = await collectModels();
  try {
    const plain = {};
    for (const [k, set] of byModel) plain[k] = [...set];
    await storeSet('v1-model-index', { at: Date.now(), byName: plain }).catch(() => {});
  } catch { /* cache optional */ }
  return { byModel };
}

// Fetch every provider's model list once. Returns the ordered entries plus a
// modelName -> Set(providerId) index used for alias disambiguation.
// OpenCode models are fetched dynamically from the Zen API (auto-updates).
async function collectModels() {
  const providers = await getAllProviders();
  const settled = await Promise.all(providers.map((p) =>
    withTimeout(modelsFn({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ providerId: p.id }) }), 15000)
      .then((r) => ({ p, r }))
      .catch(() => null)
  ));
  const entries = [];
  const byModel = new Map();
  for (const s of settled) {
    if (!s) continue;
    try {
      const d = JSON.parse(s.r.body || '{}');
      for (const m of (d.models || [])) {
        const name = String(m);
        entries.push({ providerId: s.p.id, model: name });
        if (!byModel.has(name)) byModel.set(name, new Set());
        byModel.get(name).add(s.p.id);
      }
    } catch { /* skip failed provider */ }
  }
  // Inject dynamic OpenCode Zen models (auto-updates when new models release).
  const openCodeModels = await getOpenCodeModels().catch(() => []);
  const openCodePid = 'opencode';
  for (const m of openCodeModels) {
    if (byModel.has(m) && byModel.get(m).has(openCodePid)) continue;
    entries.push({ providerId: openCodePid, model: m });
    if (!byModel.has(m)) byModel.set(m, new Set());
    byModel.get(m).add(openCodePid);
  }
  // Apply dedup config: remove disabled providers from byModel.
  try {
    const dedupConfig = await storeGet('model-dedup-config', {});
    if (dedupConfig && Object.keys(dedupConfig).length) {
      for (const [model, provConfig] of Object.entries(dedupConfig)) {
        const owners = byModel.get(model);
        if (!owners) continue;
        for (const [pid, enabled] of Object.entries(provConfig)) {
          if (enabled === false) owners.delete(pid);
        }
      }
    }
  } catch { /* dedup config is optional */ }

  return { entries, byModel };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(event.headers) };
  const path = (event.path || '').replace(/\/+$/, '') || '/v1';

  // No key needed — open gateway. A valid Bearer key is still accepted
  // (for usage tracking) but never required.
  const keyEntry = await findKey(event).catch(() => null);

  if (event.httpMethod === 'GET' && (path === '/v1/models' || path === '/v1')) {
    // Fast path: serve the cached catalogue (5-min TTL in KV). Building it
    // fans out to every provider and can take 10s+ cold.
    const CACHE_TTL = 5 * 60 * 1000;
    try {
      const cached = await storeGet('v1-models-cache', null);
      if (cached && cached.at && (Date.now() - cached.at) < CACHE_TTL && Array.isArray(cached.data) && cached.data.length) {
        if (keyEntry) {
          keyEntry.lastUsed = Date.now();
          const keys = await storeGet('api-keys', []);
          await storeSet('api-keys', keys.map((k) => (k.id === keyEntry.id ? keyEntry : k))).catch(() => {});
        }
        return { statusCode: 200, headers: { ...cors(event.headers), 'X-Cache': 'HIT' }, body: JSON.stringify({ object: 'list', data: cached.data }) };
      }
    } catch { /* build fresh */ }
    const { entries: rawEntries, byModel } = await collectModels();
    // Filter entries: only keep entries whose provider is still in byModel for that model.
    const entries = rawEntries.filter((e) => {
      const owners = byModel.get(e.model);
      return owners && owners.has(e.providerId);
    });
    // Same exact name from 2+ providers: sort provider ids, aliases get -1..-N.
    const rank = new Map();
    for (const [name, set] of byModel) {
      if (set.size < 2) continue;
      const ids = [...set].sort();
      ids.forEach((pid, i) => rank.set(pid + '/' + name, { n: i + 1, total: ids.length }));
    }
    const data = [];
    for (const e of entries) {
      const r = rank.get(e.providerId + '/' + e.model);
      // Canonical entries keep their EXACT names: "<providerId>/<model>".
      const info = { id: e.providerId + '/' + e.model, object: 'model', owned_by: e.providerId };
      if (r) { info.p_index = r.n; info.p_count = r.total; }
      data.push(info);
      // Duplicates also get callable aliases "<model>-1" … "<model>-N".
      if (r) data.push({ id: e.model + '-' + r.n, object: 'model', owned_by: e.providerId, alias_of: e.providerId + '/' + e.model });
    }
    if (keyEntry) {
      keyEntry.lastUsed = Date.now();
      const keys = await storeGet('api-keys', []);
      await storeSet('api-keys', keys.map((k) => (k.id === keyEntry.id ? keyEntry : k))).catch(() => {});
    }
    if (data.length) {
      await storeSet('v1-models-cache', { at: Date.now(), data }).catch(() => {});
    }
    return { statusCode: 200, headers: { ...cors(event.headers), 'X-Cache': 'MISS' }, body: JSON.stringify({ object: 'list', data }) };
  }

  if (event.httpMethod === 'POST' && path === '/v1/chat/completions') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return err(400, 'Bad request — body must be JSON'); }
    const full = String(body.model || '');
    let providerId = '';
    let model = '';
    const slash = full.indexOf('/');
    if (slash === -1) {
      // Bare name. Exact match wins first (so real names ending in digits
      // still work), then "<model>-N" aliases for duplicated names.
      const { byModel } = await getModelIndex();
      const direct = [...(byModel.get(full) || [])].sort();
      if (direct.length === 1) {
        providerId = direct[0];
        model = full;
      } else if (direct.length > 1) {
        return err(400, 'Ambiguous model "' + full + '" — use one of: ' + direct.map((_, i) => full + '-' + (i + 1)).join(', '));
      } else {
        const alias = full.match(/^(.*)-(\d+)$/);
        if (!alias) return err(400, 'model must look like "<providerId>/<model>" — see GET /v1/models');
        const ids = [...(byModel.get(alias[1]) || [])].sort();
        const n = parseInt(alias[2], 10);
        if (!ids[n - 1]) return err(400, 'Unknown model alias: ' + full);
        providerId = ids[n - 1];
        model = alias[1];
      }
    } else {
      providerId = full.slice(0, slash);
      model = full.slice(slash + 1);
      if (!model) return err(400, 'model must look like "<providerId>/<model>"');
    }
    const providers = await getAllProviders();
    let provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      // Unknown prefix: third-party clients send the raw upstream id
      // ("z-ai/glm-5.3-flash-free"). Search every catalogue for the FULL
      // string and route to its owner — like other OpenAI-compatible bases.
      const { byModel } = await getModelIndex();
      const owners = [...(byModel.get(full) || [])].sort();
      if (owners.length === 1) {
        providerId = owners[0];
        model = full;
        provider = providers.find((p) => p.id === providerId);
      } else if (owners.length > 1) {
        return err(400, 'Ambiguous model "' + full + '" — use one of: ' + owners.map((pid) => pid + '/' + full).join(', '));
      } else {
        return err(404, 'Unknown provider: ' + providerId);
      }
    }
    // Thin pipe: forward the client's body verbatim to the real provider
    // (only the model id is swapped for the resolved upstream id) and hand
    // back the provider's own status + body untouched. No reshaping — every
    // provider here already speaks OpenAI.
    // Usage tracking never blocks the hot path (waitUntil when available).
    const touchKey = () => {
      if (!keyEntry) return;
      const p = (async () => {
        try {
          keyEntry.lastUsed = Date.now();
          const keys = await storeGet('api-keys', []);
          await storeSet('api-keys', keys.map((k) => (k.id === keyEntry.id ? keyEntry : k))).catch(() => {});
        } catch { /* usage tracking never breaks a call */ }
      })();
      try {
        if (event._ctx && typeof event._ctx.waitUntil === 'function') event._ctx.waitUntil(p.catch(() => {}));
        else p.catch(() => {});
      } catch { /* ignore */ }
    };
    const pipeOnce = async (prov, upstreamModel) => {
      const { url, headers } = providerFetch(prov);
      let upstream;
      try {
        upstream = await fetch(url, {
          method: 'POST', headers,
          body: JSON.stringify({ ...body, model: upstreamModel }),
        });
      } catch (e) {
        const err2 = new Error('Upstream unreachable: ' + (e.message || e));
        err2.status = 502;
        throw err2;
      }
      if (body.stream) {
        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text().catch(() => '');
          let msg = 'HTTP ' + upstream.status;
          try { const j = JSON.parse(t); msg = (j.error && (j.error.message || j.error)) || msg; } catch { /* raw */ }
          const e = new Error(String(msg).slice(0, 300));
          e.status = upstream.status;
          throw e;
        }
        touchKey();
        return { statusCode: 200, stream: upstream.body, headers: cors(event.headers) };
      }
      const text = await upstream.text().catch(() => '');
      touchKey();
      return { statusCode: upstream.status, body: text, headers: cors(event.headers) };
    };
    const modelFailed = (status, msg) => isModelError(status, msg && (msg.message || msg));

    // Candidate upstream targets, tried in order until one stops failing
    // with a model error:
    //   1. stripped id at the named provider ("pid/rest" -> model "rest")
    //   2. full id at the named provider (catalogues with nested ids like
    //      "orcarouter/free" — this is what the site cards send, verbatim)
    //   3. same/closest id at any other provider (cross-provider fallback)
    const candidates = [{ provider, model }];
    if (!provider.localBridge && full !== model) {
      candidates.push({ provider, model: full });
    }
    let alternatesLoaded = false;

    let lastErr = null;
    let ci = 0;
    while (true) {
      // Lazily append the cross-provider alternate only after the direct
      // candidates fail, so the hot path never pays for the index lookup.
      if (ci >= candidates.length) {
        if (alternatesLoaded) break;
        alternatesLoaded = true;
        const { byModel } = await getModelIndex();
        const alt = findAlternateModel(model, providerId, byModel);
        if (alt) {
          const altProvider = providers.find((p) => p.id === alt.providerId);
          if (altProvider && !altProvider.localBridge) candidates.push({ provider: altProvider, model: alt.model });
        }
        if (ci >= candidates.length) break;
      }
      const cand = candidates[ci++];
      // CLI-backed free tier can't pipe (no OpenAI endpoint) — adapter instead.
      if (cand.provider.localBridge) {
        const r = await chatFn({
          httpMethod: 'POST', headers: {},
          body: JSON.stringify({ ...body, providerId: cand.provider.id, model: cand.model }),
        });
        const d = JSON.parse(r.body || '{}');
        if (r.statusCode === 200 && d.ok !== false) {
          touchKey();
          return {
            statusCode: 200,
            headers: cors(event.headers),
            body: JSON.stringify({
              id: d.id || ('chatcmpl-' + Date.now().toString(36)),
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: full,
              choices: [{ index: 0, message: { role: 'assistant', content: d.content || '' }, finish_reason: d.finishReason || 'stop' }],
              usage: d.usage || undefined,
            }),
          };
        }
        if (!modelFailed(r.statusCode, d.error)) {
          return err(r.statusCode === 200 ? 500 : r.statusCode, d.error || 'Upstream request failed');
        }
        lastErr = { status: r.statusCode, msg: d.error };
        continue;
      }
      if (body.stream && cand.provider.noAuth) {
        lastErr = { status: 400, msg: 'Streaming is not supported for provider "' + cand.provider.id + '"' };
        continue;
      }
      try {
        const out = await pipeOnce(cand.provider, cand.model);
        if (out.stream) return out;
        if (out.statusCode >= 200 && out.statusCode < 300) return out;
        let msg = '';
        try { const j = JSON.parse(out.body || '{}'); msg = (j.error && (j.error.message || j.error)) || ''; } catch { /* raw */ }
        if (!modelFailed(out.statusCode, msg)) {
          return { statusCode: out.statusCode, body: out.body, headers: cors(event.headers) };
        }
        lastErr = { status: out.statusCode, msg };
      } catch (e) {
        if (!modelFailed(e.status, e.message)) throw e;
        lastErr = { status: (e && e.status) || 500, msg: (e && e.message) || '' };
      }
    }
    if (lastErr && lastErr.status === 404) {
      return err(404, 'Model "' + full + '" not available on any provider right now');
    }
    return err(
      (lastErr && lastErr.status === 200 ? 500 : (lastErr && lastErr.status)) || 500,
      (lastErr && (lastErr.msg && (lastErr.msg.message || lastErr.msg))) || 'Upstream request failed'
    );
  }
  return err(404, 'Use GET /v1/models or POST /v1/chat/completions');
};
