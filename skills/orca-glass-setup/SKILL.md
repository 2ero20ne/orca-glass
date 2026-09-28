---
name: orca-glass-setup
description: Set up Orca Glass on this Mac so Even Realities G2 glasses can list, read, reply to and start Orca agent sessions. Use when the user asks to set up, start, re-pair, or troubleshoot Orca Glass, or mentions controlling Orca from G2 / Even Hub.
---

# Orca Glass setup

Orca Glass has two halves:

- **Glasses app** — installed by the user from Even Hub on their phone. Nothing to build here.
- **Mac bridge** (this repository) — a small Node server that wraps the `orca` CLI, plus a Cloudflare Quick Tunnel so the glasses can reach it from anywhere. The tunnel URL is announced to the app through ntfy.sh, signed with the bridge token, so the user pairs only once.

Do every step yourself; only stop for the user where a step says so.

## 0. Get the code into a stable folder

The bridge stores its token and pairing topic next to its code, so it must run from a folder that survives updates — **not** from the plugin cache (a plugin update replaces that folder and the user would have to pair again).

- If the current directory is already an `orca-glass` checkout, use it.
- Otherwise use `~/orca-glass`: clone it if missing (`git clone https://github.com/2ero20ne/orca-glass.git ~/orca-glass`), or `git -C ~/orca-glass pull` if it exists. Ask first if the user prefers another folder.

Run every command below from that folder.

## 1. Check prerequisites

```sh
sh scripts/doctor.sh
```

Fix each `NG` line:

- `node` — Node.js 20+ is required. If missing, tell the user and stop.
- `orca` / `orca runtime` — Orca must be installed and running. If missing, tell the user and stop; do not install Orca for them.
- `cloudflared` — `brew install cloudflared`
- `whisper-cli` — `brew install whisper-cpp` (needed only for voice replies)
- `whisper model` — `sh scripts/get-model.sh` downloads ~550 MB from Hugging Face. **Ask the user before downloading.** Voice replies are optional; everything else works without the model.

Run `sh scripts/doctor.sh` again until only optional items remain.

## 2. Configure (optional)

`bridge/config.json` holds the reply templates, agent list and first-prompt templates. Put machine-specific settings in `bridge/config.local.json` (not committed), for example Orca folder workspaces that are not git repos:

```json
{ "workspaces": [{ "id": "folder:<id from `orca terminal list --json`>", "name": "my-folder" }] }
```

## 3. Start

```sh
npm start
```

This runs the bridge on `127.0.0.1:8787` and the tunnel watcher. Keep it running (start it in the background if your harness supports that). Wait until the log shows a `publish ok` line from the tunnel watcher.

Explain to the user, in one short paragraph, what is now exposed: a random `*.trycloudflare.com` URL reaches the bridge; every API call needs the bridge token; ntfy.sh receives only the tunnel URL, a timestamp and a signature — never the token. Cloudflare Quick Tunnels are free, need no account and carry no uptime guarantee.

## 4. Pair

```sh
npm run pair
```

This copies a pairing code (`eho1.…`) to the clipboard. Tell the user: open Orca Glass in the Even app on the phone, paste the code into 接続コード / Pairing code, and tap save. With Universal Clipboard the Mac clipboard is available on the iPhone.

Do not print the pairing code in chat unless the clipboard copy failed; it contains the token.

## 5. Keep it running (ask first)

The bridge stops when this process ends or the Mac restarts. If the user wants it always on, offer to register it as a login item (for example a launchd agent that runs `npm start` in this directory with `KeepAlive`). **Ask before creating any launch agent** — it changes the user's system.

## Troubleshooting

- Glasses show "Mac につながりません": check that `npm start` is running and `tunnel/log.tsv` ends with `ok` lines.
- `origin-down` in `tunnel/log.tsv`: the bridge is not running on port 8787.
- Replies "選択肢が出ていません": numeric replies are only sent while the agent shows a `❯ 1.` style menu.
- A new session does not receive its first prompt: the agent is showing a trust / confirmation dialog in that folder. Answer it on the Mac once.
- To revoke access: delete `bridge/.token` and `bridge/.topic`, restart, and pair again.
