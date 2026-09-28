# Orca Glass

Control [Orca](https://github.com/stablyai/orca) agent sessions from **Even Realities G2** glasses — from anywhere.

- **Threads** — see every Claude / Codex session, which ones are waiting for you, and the latest answer (tool output and thinking filtered out)
- **Reply** — one-tap templates, or **voice** (transcribed on your own Mac with whisper.cpp, then confirmed on the glasses)
- **New session** — pick workspace, agent, model and a first prompt
- **Usage** — 5-hour / weekly limits per provider
- **English / 日本語** — follows the phone language (or pick one); reply templates, prompts and voice recognition switch too

| Threads | Latest answer | Reply |
| --- | --- | --- |
| ![Threads](store/screenshots/1-threads.png) | ![Answer](store/screenshots/2-answer.png) | ![Reply](store/screenshots/3-reply.png) |
| **Usage** | **New session** | **Phone: setup** |
| ![Usage](store/screenshots/4-usage.png) | ![New session](store/screenshots/5-new-session.png) | <img src="store/screenshots/phone-setup.png" width="220" alt="Phone setup screen"> |

<sub>Glasses screens (576×288) from the built-in demo with sample data — tap **Try the demo** in the app to see them without a Mac.</sub>

```
G2 ⇄ Even app (Orca Glass) ⇄ Cloudflare Quick Tunnel ⇄ Mac bridge ⇄ orca CLI
                     ↑ tunnel URL announced via ntfy.sh, signed with your token
```

## Setup

1. Install **Orca Glass** from Even Hub on your phone.
2. Install this skill in your coding agent and ask it to set things up.
   - Claude Code: `/plugin marketplace add 2ero20ne/orca-glass` → `/plugin install orca-glass@orca-glass` → "Set up Orca Glass"
   - Other agents: clone this repo and point your agent at `skills/orca-glass-setup/SKILL.md`
3. Paste the pairing code the agent gives you into Orca Glass on the phone. That's it — it reconnects automatically when the tunnel URL changes.

Just want to look? Tap **Try the demo** in the app — no Mac needed.

Manual setup: `sh scripts/doctor.sh`, then `npm start`, then `npm run pair`.

## What leaves your Mac

| Where | What |
| --- | --- |
| Cloudflare Quick Tunnel (`*.trycloudflare.com`) | Bridge traffic. Every API call requires your token. Free, no account, **no uptime guarantee**. |
| ntfy.sh (random topic) | Tunnel URL + timestamp + HMAC signature. **Never the token.** The app ignores unsigned or wrongly signed URLs. |
| Nowhere | Voice. Audio is transcribed locally by whisper.cpp. |

Only fixed templates and text you confirm on the glasses are ever typed into your agents.

## Requirements

macOS, Node.js 20+, Orca (running), `cloudflared`, and for voice `whisper-cpp` + a ~550 MB model (`sh scripts/get-model.sh`).

## License

MIT
