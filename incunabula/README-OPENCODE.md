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
