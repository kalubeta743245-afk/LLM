# Galaxy LLM Backend

An OpenAI-compatible API gateway built with **Node.js + Express** that serves the
**Meteor** model. Under the hood, requests are proxied to upstream providers
(via [OpenRouter](https://openrouter.ai)) using the `openai` SDK.

## Served model

| Served name | Upstream                     | Profile                                   |
|-------------|------------------------------|-------------------------------------------|
| `meteor`    | Cohere North Mini Code       | Fast, low latency, snappy first response. |

Clients send `"meteor"` as the `model` field. The real upstream id is never
exposed. If a client omits `model` or sends an unknown name, `meteor` is used.

> Prototype stage: runs locally. Database, real auth, and deployment are planned
> for a later phase (see `## Roadmap`).

## Features

- **OpenAI-compatible** `POST /v1/chat/completions` and `GET /v1/models`.
- **Streaming** (`stream: true`) and non-streaming responses.
- **Model aliasing** — clients call `model: "meteor"`. The real upstream model
  id is never exposed.
- **Always-on default system prompt** — a built-in system prompt is injected on
  every request and is *never* overwritten. Any system message the client sends
  is **appended after** the default (see `## The default system prompt`).
- **`/ui` command** — prefix any user message with `/ui` to activate UI/UX
  generation mode. A specialized UI/UX design philosophy prompt is injected and
  the model responds with concrete, actionable design output (see `## /ui command`).
- **Optional backend key** gate for light protection during prototyping.
- Clean seams for adding a database and JWT auth later.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env      # (Windows: copy .env.example .env)
# then edit .env and set OPENROUTER_API_KEY

# 3. Run in dev mode (hot reload)
npm run dev
#   or: npm start
```

Server listens on `http://localhost:3000`.

## Endpoints

| Method | Path                   | Description                              |
|--------|------------------------|------------------------------------------|
| GET    | `/health`              | Liveness probe.                          |
| GET    | `/v1/models`           | Lists the served model (`meteor`).       |
| POST   | `/v1/chat/completions` | OpenAI-compatible chat completion.       |

### Example: list models

```bash
curl http://localhost:3000/v1/models
```

### Example: chat (non-streaming)

```bash
curl -X POST http://localhost:3000/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"meteor\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello!\"}]}"
```

### Example: chat (streaming)

```bash
curl -N -X POST http://localhost:3000/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"meteor\",\"stream\":true,\"messages\":[{\"role\":\"user\",\"content\":\"Count to 5.\"}]}"
```

### Example: with a client-supplied system prompt

```bash
curl -X POST http://localhost:3000/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"meteor\",\"messages\":[{\"role\":\"system\",\"content\":\"Answer in pirate speak.\"},{\"role\":\"user\",\"content\":\"Ahoy!\"}]}"
```
The default system prompt is still applied first; the pirate instruction is
appended after it.

## The `/ui` command

When a user message starts with `/ui`, the backend activates **UI/UX generation
mode**: a comprehensive design philosophy prompt is injected and the `/ui` prefix
is stripped from the message. Without `/ui`, only the simple default system
prompt applies.

```bash
curl -X POST http://localhost:3000/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"meteor\",\"messages\":[{\"role\":\"user\",\"content\":\"/ui Design a login screen for a mobile banking app\"}]}"
```

Behavior:
- `/ui` is detected on the **last user message** only (per-request, not a persistent toggle).
- The UI/UX prompt is injected as an **additional system message** after the always-on default.
- The `/ui` prefix is stripped; the model sees only the design request.
- Normal messages (without `/ui`) work exactly as before with the simple default prompt.

## The default system prompt

This backend injects a fixed default system prompt on **every** request:

- If the client sends **no** system message → only the default applies.
- If the client sends **its own** system message(s) → those are **appended after**
  the default; the default is never removed or modified.
- User / assistant / tool messages keep their original order after the system
  block.
- If `/ui` is used, the UI/UX prompt is also appended (after any client system
  messages, before conversation).

The default text lives in `src/config/index.js` (`DEFAULT_SYSTEM_PROMPT`).
The UI/UX prompt also lives there (`UI_UX_GENERATION_PROMPT`).

## Roadmap (Phase 2)

- [ ] Database (persist conversations / logs).
- [ ] Real authentication (JWT).
- [ ] Deployment (containerize + host).

These are intentionally scaffolded as future additions; the current prototype
runs without them.
