# My Site Free - OpenCode Provider

## Quick Start

Run `install-opencode-provider.bat` as Administrator to install the provider.

## What It Does

Installs "My Site Free" as a local provider in OpenCode with these models:
- mimo-v2.5-free
- deepseek-v4-flash-free
- big-pickle
- muse-spark-1.3-contributor-free
- muse-spark-1.2-contributor-free
- ling-3.0-flash-fin-free
- nemotron-3-ultra-free
- nemotron-3.5-lightning-free

## Requirements

- My Site Free bridge running on `localhost:8899` (auto-starts on boot)
- OpenCode installed

## How It Works

The provider connects to your local My Site Free bridge. A Cloudflare tunnel provides remote access at a permanent `.trycloudflare.com` address.

## Files

- `opencode-config.json` - Provider configuration
- `install-opencode-provider.bat` - Installer script

## Manual Install

Copy `opencode-config.json` to `~/.config/opencode/config.json` or merge its contents into your existing config.
