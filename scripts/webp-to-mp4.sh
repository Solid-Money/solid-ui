#!/bin/bash
# Convert an OPAQUE animated WebP to H.264 mp4 for expo-video playback.
#
# For the transparent star loops use webp-to-hevc-alpha.sh instead — this
# script deliberately produces a plain opaque stream, which is hardware
# decoded on both iOS and Android and needs none of the premultiplied-alpha
# handling that HEVC-with-alpha does.
#
# ffmpeg can't decode animated WebP, so Pillow resamples the source's own
# timeline onto a constant 30fps grid and pipes raw RGB to ffmpeg. Resampling
# (rather than assuming a fixed frame duration) preserves TOTAL DURATION
# exactly, which matters: RewardsHelpModal hands the tiers slide off to its
# shader loop at the intro's exact length.
set -euo pipefail

SRC="$1"
DST="$2"
FPS="${3:-30}"

read -r W H N TOTAL < <(python3 -c "
import subprocess, re
from PIL import Image
im = Image.open('$SRC')
# Pillow reports duration 0 for these files, so read it from the container.
out = subprocess.run(['webpinfo', '$SRC'], capture_output=True, text=True).stdout
durs = [int(x) for x in re.findall(r'Duration: (\d+)', out)]
print(im.size[0], im.size[1], im.n_frames, sum(durs))
")

echo "$SRC: ${W}x${H}, ${N} frames, ${TOTAL}ms -> ${FPS}fps"

python3 -c "
import sys, subprocess, re
from PIL import Image

im = Image.open('$SRC')
out = subprocess.run(['webpinfo', '$SRC'], capture_output=True, text=True).stdout
durs = [int(x) for x in re.findall(r'Duration: (\d+)', out)]

# Cumulative end time of each source frame, so a wall-clock instant can be
# mapped back to the frame that should be on screen at that moment.
ends, acc = [], 0
for d in durs:
    acc += d
    ends.append(acc)
total = acc

cache_i, cache_px = -1, None
src_i = 0
# Derive the output frame count up front rather than accumulating a float
# step: accumulation drifts and can emit one frame too many, which shows up
# as a stutter every cycle on a looping clip.
n_out = int(round(total * $FPS / 1000.0))
for i in range(n_out):
    t = i * 1000.0 / $FPS
    while src_i < len(ends) - 1 and ends[src_i] <= t:
        src_i += 1
    if src_i != cache_i:
        im.seek(src_i)
        cache_px = im.convert('RGB').tobytes()
        cache_i = src_i
    sys.stdout.buffer.write(cache_px)
" | ffmpeg -hide_banner -loglevel warning -y \
  -f rawvideo -pix_fmt rgb24 -s "${W}x${H}" -r "$FPS" -i - \
  -c:v libx264 -crf 20 -preset slow -profile:v high -pix_fmt yuv420p \
  -movflags +faststart -an \
  "$DST"

echo "  -> $DST  $(du -h "$DST" | cut -f1)  $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$DST")s"
