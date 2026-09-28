# Even Hub store listing — Orca Glass

- App name: Orca Glass
- Tagline (≤50): View and reply to Orca agent sessions
- Developer: 2ero20ne
- Privacy & terms: https://www.2ero20ne.com/orca-glass/privacy
- Source / setup: https://github.com/2ero20ne/orca-glass

## Description (English)

Keep an eye on your coding agents without going back to your desk.

Orca Glass connects your G2 to Orca running on your own Mac:

- Threads — every Claude Code / Codex session, which ones are waiting for you (●), and the latest answer. Tool output and thinking are filtered out.
- Reply — one-tap replies (Yes / No / Continue …), or speak a reply: it is transcribed on your Mac and shown on the glasses before you send it.
- New session — pick a workspace, agent, model and a first prompt.
- Usage — 5-hour and weekly limits per provider.
- English and Japanese.

Requires setup on your Mac. Orca Glass talks to a small open-source bridge on your Mac (github.com/2ero20ne/orca-glass). Ask your coding agent to "set up Orca Glass", then paste the pairing code into this app once. It works away from home: the bridge is reached through a Cloudflare Quick Tunnel and reconnects automatically when the tunnel address changes.

Your data stays yours: the developer runs no server and collects nothing. Voice is transcribed on your Mac and never leaves it.

## 説明(日本語)

席を離れても、コーディングエージェントの様子が分かります。

Orca Glass は、G2 と、あなたの Mac で動く Orca をつなぎます。

- スレッド — Claude Code / Codex のセッション一覧と、入力待ち(●)かどうか、最新の回答。ツールの出力や思考中の表示は省きます。
- 返信 — 「はい/いいえ/続けて」などをワンタップで。話して返信することもでき、Mac で文字にしてグラスで確認してから送ります。
- 新規セッション — 作業場所・エージェント・モデル・最初の指示を選んで起動。
- 使用量 — プロバイダーごとの5時間枠・週枠。
- 日本語・英語対応。

Mac 側の準備が必要です。Orca Glass は、あなたの Mac で動く小さなオープンソースの中継サーバ(github.com/2ero20ne/orca-glass)と通信します。コーディングエージェントに「Orca Glass をセットアップして」と頼み、出てきた接続コードをこのアプリに一度貼るだけです。外出先でも使えます(Cloudflare Quick Tunnel 経由。接続先が変わっても自動でつながり直します)。

開発者はサーバーを持たず、何も収集しません。音声はあなたの Mac で文字にし、外へは送りません。

## Review notes

- The app needs a companion bridge running on the user's own Mac (open source, linked above). Without it the app shows setup instructions.
- Network: the app contacts ntfy.sh (listed) to find the user's bridge URL, then the user's own Cloudflare Quick Tunnel URL (`https://<random>.trycloudflare.com`, different for every user, so it cannot be listed in the whitelist). All bridge requests require the user's token; URLs from ntfy are accepted only with a valid HMAC signature.
- Microphone: used only when the user chooses a voice reply; audio is sent to the user's own Mac for transcription.
- To review without a Mac: open the app and tap **Try the demo (no Mac needed)**. Every screen (threads, answer, replies, voice reply, new session, usage) works with sample data.

## Assets to prepare

- Cover image
- Screenshots of the glasses display (576×288): home (thread list), thread (answer), reply menu, voice confirm, new session, usage — in English
