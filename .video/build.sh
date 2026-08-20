#!/usr/bin/env bash
# Full build: picture + sound -> final deliverables, in one sequential pass.
# Chained deliberately: separate waiter shells that poll with `pgrep -f render.mjs`
# deadlock, because a waiter's own command line contains that literal string.
set -euo pipefail
cd "$(dirname "$0")"

export CHROMIUM_PATH=${CHROMIUM_PATH:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}

echo "[1/4] sound design"
node audio.mjs

echo "[2/4] 4:5 master (1080x1350)"
node render.mjs --width=1080 --height=1350 --fps=60 --sub=2 --crf=16 \
  --out=out/solid-rewards-4x5.mp4
node mux.mjs out/solid-rewards-4x5.mp4 out/sound.wav out/solid-rewards-4x5-final.mp4
echo "[2/4] done -> out/solid-rewards-4x5-final.mp4"

echo "[3/4] 9:16 vertical (1080x1920)"
node render.mjs --width=1080 --height=1920 --fps=60 --sub=2 --crf=16 \
  --out=out/solid-rewards-9x16.mp4
node mux.mjs out/solid-rewards-9x16.mp4 out/sound.wav out/solid-rewards-9x16-final.mp4
echo "[3/4] done -> out/solid-rewards-9x16-final.mp4"

echo "[4/4] all deliverables built"
ls -la out/*-final.mp4
