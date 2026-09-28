#!/bin/sh
# 必要なものが揃っているかを確かめる(何もインストールしない)
ok=0
check() { if command -v "$1" >/dev/null 2>&1; then echo "OK   $1"; else echo "NG   $1 — $2"; ok=1; fi; }
check node "Node.js 20 以上を入れてください"
check orca "Orca を入れて CLI を有効にしてください (https://github.com/stablyai/orca)"
check cloudflared "brew install cloudflared"
check whisper-cli "brew install whisper-cpp(音声返信を使う場合)"
M=$(node -e 'import("./bridge/whisper.mjs").then(m=>console.log(m.MODEL))' 2>/dev/null)
if [ -f "$M" ]; then echo "OK   whisper model"; else echo "NG   whisper model — sh scripts/get-model.sh(約550MB、音声返信を使う場合)"; fi
orca status >/dev/null 2>&1 && echo "OK   orca runtime" || { echo "NG   orca runtime — Orca を起動してください"; ok=1; }
exit $ok
