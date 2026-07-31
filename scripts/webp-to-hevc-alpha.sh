#!/bin/bash
# Convert an animated WebP (with alpha) to HEVC-with-alpha .mov for iOS.
#
# ffmpeg can't decode animated WebP, so Pillow coalesces the blend-chained
# frames and pipes raw RGBA into ffmpeg. hevc_videotoolbox only emits an alpha
# layer when the input pix_fmt is bgra; -alpha_quality controls that layer.
# -tag:v hvc1 is required or AVFoundation won't play the file.
set -euo pipefail

SRC="$1"
DST="$2"

read -r W H N DUR < <(python3 -c "
from PIL import Image
im = Image.open('$SRC')
im.seek(0)
print(im.size[0], im.size[1], im.n_frames, im.info.get('duration', 17))
")

echo "$SRC: ${W}x${H}, ${N} frames, ${DUR}ms/frame"

python3 -c "
import sys
from PIL import Image

# AVFoundation reads these files as PREMULTIPLIED alpha: ffmpeg writes no
# alpha-mode tag in the format description, and premultiplied is the default
# assumption. Pillow hands back straight alpha, so RGB has to be multiplied
# through by A here — otherwise every semi-transparent edge pixel composites
# far too bright and the star renders with a white halo and hard, blocky edges.
# Compositing over black is exactly that multiply; the original alpha is then
# reattached unchanged.
im = Image.open('$SRC')
black = Image.new('RGBA', im.size, (0, 0, 0, 255))
for i in range($N):
    im.seek(i)
    frame = im.convert('RGBA')
    premultiplied = Image.alpha_composite(black, frame)
    premultiplied.putalpha(frame.getchannel('A'))
    sys.stdout.buffer.write(premultiplied.tobytes())
" | ffmpeg -hide_banner -loglevel warning -y \
  -f rawvideo -pix_fmt rgba -s "${W}x${H}" -r "1000/${DUR}" -i - \
  -c:v hevc_videotoolbox -alpha_quality 0.9 -tag:v hvc1 \
  -pix_fmt bgra -allow_sw 1 -q:v 55 \
  "$DST"

echo "  -> $DST  $(du -h "$DST" | cut -f1)"
