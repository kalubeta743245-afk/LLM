// Incunabula as an OpenAI-compatible gateway.
//   GET  /v1/models                 — list every active model under its public name
//   POST /v1/chat/completions       — {model:"<publicName>", messages:[...]}
// Public names are provider-free: the model id by default, or the custom
// display name when the owner set one. Provider routing stays internal.
// Responses are scrubbed on the way out, so a client only ever sees the
// public name and "incunabula" as the owner — never the real provider.
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
async function loadAliases() {
  try {
    const a = await storeGet('model-aliases', {});
    return (a && typeof a === 'object') ? a : {};
  } catch { return {}; }
}
// Public model name: the custom display name when set, otherwise the plain
// model id. The routing provider prefix is never part of the public name.
function publicName(providerId, model, aliases) {
  const a = aliases[providerId + '/' + model];
  if (typeof a === 'string' && a) return a;
  return String(model);
}

// The only model identity a client may see is the public name, and the only
// provider identity is "incunabula". Upstream bodies are OpenAI-shaped but
// still carry the real model id plus a "provider" field, so scrub on the way
// out. Sanitizing is best-effort by construction: any failure returns the
// original body/bytes, because a working response outranks a clean one.
const OWNER = 'incunabula';
function sanitizeChatBody(text, publicModel) {
  try {
    let obj;
    try { obj = JSON.parse(text); } catch { return text; } // raw/non-JSON upstream
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return text;
    if (obj.error) return text; // errors pass through untouched (retry logic reads them)
    obj.model = publicModel;
    delete obj.provider; // OpenAI shape carries no provider field
    if ('owned_by' in obj) obj.owned_by = OWNER;
    return JSON.stringify(obj);
  } catch { return text; }
}

// One text chunk of an SSE frame: swap the upstream model id for the public
// name and drop "provider" fields (plus the comma it leaves behind, so the
// frame stays parseable JSON). Chunk boundaries can split a token, so a leak
// can survive — accepted, and any throw returns the chunk unchanged.
function rewriteChunk(text, needle, publicModel) {
  try {
    let out = String(text);
    if (needle && publicModel && needle !== publicModel) out = out.split(needle).join(publicModel);
    out = out.replace(/,?\s*"provider"\s*:\s*"[^"]*"/g, '');
    out = out.replace(/,\s*(?=[}\]])/g, '').replace(/{\s*,/g, '{').replace(/,\s*}/g, '}');
    return out;
  } catch { return text; }
}

// Best-effort streaming scrub: chunks are forwarded as they arrive, rewritten
// only by rewriteChunk. Never buffered as a whole, never fatal — streaming
// keeps working even when the rewrite cannot.
function scrubStream(source, upstreamModel, publicModel) {
  try {
    if (!source || typeof source.getReader !== 'function') return source;
    if (typeof ReadableStream !== 'function') return source;
    const reader = source.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    return new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) { controller.close(); return; }
          let text;
          try { text = decoder.decode(value, { stream: true }); } catch { controller.enqueue(value); return; }
          let out;
          try { out = rewriteChunk(text, upstreamModel, publicModel); } catch { out = text; }
          controller.enqueue(encoder.encode(out));
        } catch (e) {
          try { controller.error(e); } catch { /* stream already settled */ }
        }
      },
      cancel(reason) { try { return reader.cancel(reason); } catch { /* ignore */ } },
    });
  } catch { return source; }
}

// Turn internal {providerId, model} entries into the public /v1/models list.
// Names shared by several providers get ordered "-1".." -N" suffixes so every
// listed id stays uniquely callable.
function buildPublicList(entries, aliases) {
  const groups = new Map();
  for (const e of entries) {
    const name = publicName(e.providerId, e.model, aliases);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(e);
  }
  const data = [];
  for (const [name, group] of groups) {
    group.sort((a, b) => (a.providerId < b.providerId ? -1 : a.providerId > b.providerId ? 1 : 0));
    if (group.length === 1) {
      data.push({ id: name, object: 'model', owned_by: 'incunabula' });
      continue;
    }
    group.forEach((_, i) => {
      data.push({ id: name + '-' + (i + 1), object: 'model', owned_by: 'incunabula', p_index: i + 1, p_count: group.length });
    });
  }
  return data;
}
// Resolve a display alias back to its canonical "pid/model" id. Also accepts
// the ordered "<alias>-N" ids published for names shared by several providers.
// Aliases are additive: anything that is not an alias value passes through.
// Callers may pass a preloaded alias map so the store is only read once.
async function resolveAliasId(name, preloaded) {
  const aliases = preloaded || await loadAliases();
  const keys = Object.keys(aliases).sort();
  const byValue = new Map();
  for (const k of keys) {
    const v = aliases[k];
    if (typeof v !== 'string' || !v) continue;
    if (!byValue.has(v)) byValue.set(v, []);
    byValue.get(v).push(k);
  }
  if (byValue.has(name)) return byValue.get(name)[0];
  const suffix = name.match(/^(.*)-(\d+)$/);
  if (suffix && byValue.has(suffix[1])) {
    const group = byValue.get(suffix[1]);
    const n = parseInt(suffix[2], 10);
    if (group[n - 1]) return group[n - 1];
  }
  return name;
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
  // Apply per-model visibility. Free models are on by default; paid models
  // stay off until explicitly enabled (stored true wins either way).
  try {
    const vis = await storeGet('model-visibility', {}) || {};
    const FREE_RE = /free|pickle|:free$/i;
    const visible = (pid, name) => {
      const key = pid + '/' + name;
      if (key in vis) return vis[key] === true;
      return FREE_RE.test(String(name));
    };
    for (let i = entries.length - 1; i >= 0; i--) {
      if (!visible(entries[i].providerId, entries[i].model)) entries.splice(i, 1);
    }
    for (const [name, owners] of byModel) {
      for (const pid of [...owners]) {
        if (!visible(pid, name)) owners.delete(pid);
      }
    }
  } catch { /* visibility is optional */ }
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
    // Fast path: reuse the cached internal entries (5-min TTL). Public names
    // are rebuilt on every request so a rename takes effect immediately.
    const CACHE_TTL = 5 * 60 * 1000;
    const aliases = await loadAliases();
    let entries = null;
    try {
      const cached = await storeGet('v1-models-cache', null);
      if (cached && cached.at && (Date.now() - cached.at) < CACHE_TTL && Array.isArray(cached.entries) && cached.entries.length) {
        entries = cached.entries;
      }
    } catch { /* build fresh */ }
    const cacheHit = !!entries;
    if (!entries) {
      const collected = await collectModels();
      // Only keep entries whose provider is still enabled for that model.
      entries = collected.entries.filter((e) => {
        const owners = collected.byModel.get(e.model);
        return owners && owners.has(e.providerId);
      });
      if (entries.length) {
        await storeSet('v1-models-cache', { at: Date.now(), entries }).catch(() => {});
      }
    }
    const data = buildPublicList(entries, aliases);
    if (keyEntry) {
      keyEntry.lastUsed = Date.now();
      const keys = await storeGet('api-keys', []);
      await storeSet('api-keys', keys.map((k) => (k.id === keyEntry.id ? keyEntry : k))).catch(() => {});
    }
    return { statusCode: 200, headers: { ...cors(event.headers), 'X-Cache': cacheHit ? 'HIT' : 'MISS' }, body: JSON.stringify({ object: 'list', data }) };
  }

  if (event.httpMethod === 'POST' && path === '/v1/chat/completions') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return err(400, 'Bad request — body must be JSON'); }
    // Client-visible name as typed, captured before alias resolution so the
    // response can be rewritten to it. Alias map is read once and reused for
    // both the reverse lookup and the public-name computation.
    const requestedName = String(body.model || '').trim();
    const aliases = await loadAliases();
    let full = String(body.model || '');
    full = await resolveAliasId(full, aliases);
    let providerId = '';
    let model = '';
    const slash = full.indexOf('/');
    if (slash === -1) {
      // Public name, no slash. Exact catalogue match wins first (so real
      // names ending in digits still work), then ordered "-1".." -N" ids.
      const { byModel } = await getModelIndex();
      const direct = [...(byModel.get(full) || [])].sort();
      if (direct.length === 1) {
        providerId = direct[0];
        model = full;
      } else if (direct.length > 1) {
        return err(400, 'Ambiguous model "' + full + '" — use one of: ' + direct.map((_, i) => full + '-' + (i + 1)).join(', '));
      } else {
        const suffix = full.match(/^(.*)-(\d+)$/);
        if (!suffix) return err(400, 'Unknown model "' + full + '" — see GET /v1/models');
        const ids = [...(byModel.get(suffix[1]) || [])].sort();
        const n = parseInt(suffix[2], 10);
        if (!ids[n - 1]) return err(400, 'Unknown model "' + full + '" — see GET /v1/models');
        providerId = ids[n - 1];
        model = suffix[1];
      }
    } else {
      providerId = full.slice(0, slash);
      model = full.slice(slash + 1);
      if (!model) return err(400, 'model must look like "<model>" or "<model>-N" — see GET /v1/models');
    }
    const providers = await getAllProviders();
    let provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      // No provider owns that prefix: the whole string is the model id.
      const { byModel } = await getModelIndex();
      const owners = [...(byModel.get(full) || [])].sort();
      if (owners.length === 1) {
        providerId = owners[0];
        model = full;
        provider = providers.find((p) => p.id === providerId);
      } else if (owners.length > 1) {
        return err(400, 'Ambiguous model "' + full + '" — use one of: ' + owners.map((_, i) => full + '-' + (i + 1)).join(', '));
      } else {
        return err(404, 'Unknown model: ' + full);
      }
    }
    // Authoritative public name for this call: stored custom display name
    // first, then the name the client typed, then the plain (routing-prefix
    // stripped) model id. This is the only model identity we ever return.
    const publicModel = publicName(providerId, model, aliases) || requestedName || String(model);
    // Thin pipe: forward the client's body verbatim to the real provider
    // (only the model id is swapped for the resolved upstream id) and hand
    // back the provider's own status + body, with the real model id and
    // provider name scrubbed. No reshaping — every provider here already
    // speaks OpenAI.
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
        return { statusCode: 200, stream: scrubStream(upstream.body, upstreamModel, publicModel), headers: cors(event.headers) };
      }
      const text = await upstream.text().catch(() => '');
      touchKey();
      return { statusCode: upstream.status, body: sanitizeChatBody(text, publicModel), headers: cors(event.headers) };
    };
    const modelFailed = (status, msg) => isModelError(status, msg && (msg.message || msg));

    // Candidate upstream targets, tried in order until one stops failing
    // with a model error:
    //   1. stripped id at the named provider ("pid/rest" -> model "rest")
    //   2. full id at the named provider (catalogues with nested ids like
    //      "orcarouter/free" — this is what the site cards send, verbatim)
    //   3. same/closest id at any other provider (cross-provider fallback)
    try {
      const vis = await storeGet('model-visibility', {});
      if (vis && (vis[providerId + '/' + model] === false || vis[providerId + '/' + full] === false)) {
        return err(404, 'Model "' + full + '" is deactivated');
      }
    } catch { /* ignore */ }
    const candidates = [{ provider, model }];
    if (full !== model) {
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
        // A public name may itself start with a provider id ("nvidia/…"
        // listed by another station). Try that exact owner first.
        const owners = [...(byModel.get(full) || [])].filter((p) => p !== providerId).sort();
        if (owners.length) {
          const ownerProvider = providers.find((p) => p.id === owners[0]);
          if (ownerProvider) candidates.push({ provider: ownerProvider, model: full });
        }
        const alt = findAlternateModel(model, providerId, byModel);
        if (alt) {
          const altProvider = providers.find((p) => p.id === alt.providerId);
          if (altProvider) candidates.push({ provider: altProvider, model: alt.model });
        }
        if (ci >= candidates.length) break;
      }
      const cand = candidates[ci++];
      if (body.stream && cand.provider.noAuth) {
        lastErr = { status: 400, msg: 'Streaming is not supported for this model' };
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
