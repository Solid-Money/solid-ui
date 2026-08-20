#!/usr/bin/env bash
# Build the Solid app promo video (frames -> mp4).
#
#   ./build.sh                 # vertical 1080x1920
#   ./build.sh wide            # 16:9 1920x1080
#   ./build.sh vertical 30     # explicit fps
#
# Requires: npm install (playwright-core + Mona Sans come from package.json),
# a chromium for Playwright, ffmpeg on PATH (or $FFMPEG), and python3 with
# numpy for the optional audio bed.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$HERE/../.."
FORMAT="${1:-vertical}"
FPS="${2:-30}"
BUILD="$HERE/build"
FRAMES="$BUILD/frames-$FORMAT"
FFMPEG="${FFMPEG:-ffmpeg}"

case "$FORMAT" in
  vertical) LABEL="vertical-1080x1920" ;;
  wide)     LABEL="wide-1920x1080" ;;
  *) echo "unknown format '$FORMAT' (vertical|wide)" >&2; exit 1 ;;
esac

echo "==> copying Mona Sans from node_modules"
mkdir -p "$HERE/fonts"
for w in 400Regular 500Medium 600SemiBold 700Bold 800ExtraBold; do
  src="$ROOT/node_modules/@expo-google-fonts/mona-sans/$w/MonaSans_$w.ttf"
  if [ ! -f "$src" ]; then
    echo "missing $src — run 'npm install' in the repo root first" >&2
    exit 1
  fi
  cp "$src" "$HERE/fonts/"
done

echo "==> rendering frames ($FORMAT @ ${FPS}fps)"
rm -rf "$FRAMES"
(cd "$ROOT" && node "$HERE/render.js" "$FORMAT" "$FRAMES" "$FPS")

echo "==> generating audio bed"
AUDIO="$BUILD/bed.wav"
if python3 -c "import numpy" 2>/dev/null; then
  python3 "$HERE/audio.py" "$AUDIO"
else
  echo "    numpy not available — skipping audio bed"
  AUDIO=""
fi

mkdir -p "$BUILD/out"
SILENT="$BUILD/out/solid-promo-$LABEL.mp4"
echo "==> encoding $SILENT"
"$FFMPEG" -y -hide_banner -loglevel error \
  -framerate "$FPS" -i "$FRAMES/f%05d.jpg" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r "$FPS" \
  -movflags +faststart "$SILENT"

if [ -n "$AUDIO" ]; then
  WITH="$BUILD/out/solid-promo-$LABEL-with-audio.mp4"
  echo "==> encoding $WITH"
  "$FFMPEG" -y -hide_banner -loglevel error \
    -framerate "$FPS" -i "$FRAMES/f%05d.jpg" -i "$AUDIO" \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r "$FPS" \
    -c:a aac -b:a 192k -ac 2 -shortest -movflags +faststart "$WITH"
fi

echo "==> done: $BUILD/out"
ls -lh "$BUILD/out"
