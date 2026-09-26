# OpenCode Local Tunnel - OpenCode Provider

Installs "OpenCode Local Tunnel" as a local provider in OpenCode with these models:

- mimo-v2.5-free
- deepseek-v4-flash-free
- big-pickle
- muse-spark-1.3-contributor-free
- muse-spark-1.2-contributor-free
- ling-3.0-flash-fin-free
- nemotron-3-ultra-free
- nemotron-3.5-lightning-free

## Prerequisites

- Node.js 18+
- OpenCode CLI: `npm i -g opencode-ai`
- OpenCode Local Tunnel bridge running on `localhost:8899` (auto-starts on boot)

## Install

Run `install-opencode-provider.bat` as administrator.

The provider connects to your local OpenCode Local Tunnel bridge. A Cloudflare tunnel provides remote access at a permanent `.trycloudflare.com` address.

## Usage

1. Start the bridge: `node bridge.js` (or it auto-starts on boot)
2. Open OpenCode CLI
3. Select "OpenCode Local Tunnel" as provider
4. Pick a free model and chat

All prompts run through YOUR local OpenCode CLI - nothing leaves your PC.

## CORS-bypass proxy (`/api/proxy`)

Browser-only workaround for calling **any public url** from a page whose origin
that target does not send CORS headers for. Point the client at this app's own
origin instead; the proxy forwards the call and hands the response back with
CORS headers attached, so the browser accepts it.

Same handler on every runtime (Cloudflare Worker, Netlify, `node server.js`):

- `/api/proxy?url=<absolute-url>`
- `/.netlify/functions/proxy?url=<absolute-url>`
- same routes with the target in an `x-proxy-url` header — needed on the
  Cloudflare Worker, whose `/api/(.+)` route keeps the query string out of the
  function event. Browsers can set that header after the `204` preflight.

Prefix any url:

```bash
curl "https://<this-app>/api/proxy?url=https://xpart.netlify.app/v1/models"
curl "https://<this-app>/api/proxy?url=https://xpart.netlify.app/aichat"
curl "https://<this-app>/api/proxy?url=https://api.github.com/repos/anthropics/anthropic-sdk-typescript"

# POST with a body, the form the Worker needs
curl -X POST https://<this-app>/api/proxy \
  -H 'x-proxy-url: https://xpart.netlify.app/api/thing' \
  -H 'authorization: Bearer <key>' \
  -H 'content-type: application/json' \
  -d '{"hello":"world"}'
```

URL-encode the target when it carries its own `?` or `&`, otherwise the outer
query parser splits it (`%3F` for a nested `?`).

In the browser:

```js
await fetch('/api/proxy?url=' + encodeURIComponent('https://xpart.netlify.app/api/thing'))
  .then((r) => r.json());
```

**Open to any public target.** `http:`/`https:` only, any host, any port, any
path, any subdomain. Two guards remain and neither affects normal use: private
and loopback destinations are refused (`403`) *before* any socket is opened —
loopback, RFC1918, link-local (which is where cloud metadata at
`169.254.169.254` lives), CGNAT, multicast, unique-local IPv6, and the
`.local`/`.internal`/`.localhost` suffixes — and redirect hops are re-checked
against the same rule, so a public target cannot bounce the proxy into an
internal one. A path-style (`/api/proxy/https/host/rest`) form is deliberately
not supported; pass the absolute URL in `?url=` or the header instead.

Other limits: 4 MB max request body (`413`), 60 s per-request timeout (`504`),
max 3 redirect hops, `OPTIONS` returns `204`. Client headers are forwarded
except `host`, `origin`, `referer`, `cookie`, hop-by-hop headers and `cf-*`;
responses are UTF-8 text (a non-text body is refused with `502` rather than
returned corrupted).
