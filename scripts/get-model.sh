#!/bin/sh
# 音声返信用の whisper モデル(large-v3-turbo q5_0、約550MB)を公式配布元から取得する
set -e
DIR="$HOME/.cache/orca-glass"
mkdir -p "$DIR"
curl -L --fail -o "$DIR/ggml-large-v3-turbo-q5_0.bin.part" \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
mv "$DIR/ggml-large-v3-turbo-q5_0.bin.part" "$DIR/ggml-large-v3-turbo-q5_0.bin"
echo "saved: $DIR/ggml-large-v3-turbo-q5_0.bin"
