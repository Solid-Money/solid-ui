#!/usr/bin/env python3
"""
webp_to_lottie

Extract PNG frames from an (animated) WebP -- or from a video file (WebM, MP4,
MOV, GIF, ...) -- and assemble them into a Lottie JSON where each frame is
embedded as a base64 PNG asset shown for exactly one frame. This matches the
format of assets/animations/star-*.json.

For WebP/GIF/APNG, frames are decoded and fully composited onto the canvas by
Pillow (partial frames with offsets / blend / dispose are handled correctly).
For video containers (WebM, MP4, ...), frames are extracted with ffmpeg,
preserving alpha when the source has it.

Requirements:
    pip install Pillow          # for WebP/GIF inputs
    ffmpeg on PATH              # for video inputs (WebM, MP4, ...)

Usage:
    python3 scripts/webp_to_lottie.py <input> [output.json] [--fps N] [--save-frames DIR]

Examples:
    python3 scripts/webp_to_lottie.py star.webp
    python3 scripts/webp_to_lottie.py star.webm assets/animations/star-4.json --fps 30
    python3 scripts/webp_to_lottie.py star.webp --save-frames ./frames
"""

import argparse
import base64
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile

VIDEO_EXTS = {".webm", ".mp4", ".mov", ".mkv", ".avi", ".m4v"}


def _probe_video_fps(path: str) -> float | None:
    """Return the video's frame rate via ffprobe, or None if unavailable."""
    if not shutil.which("ffprobe"):
        return None
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=r_frame_rate",
                "-of", "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            check=True, capture_output=True, text=True,
        ).stdout.strip()
        num, _, den = out.partition("/")
        den = den or "1"
        val = float(num) / float(den)
        return val if val > 0 else None
    except Exception:  # noqa: BLE001
        return None


def _probe_codec(path: str) -> str | None:
    """Return the video stream's codec name via ffprobe, or None."""
    if not shutil.which("ffprobe"):
        return None
    try:
        return subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=codec_name",
                "-of", "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            check=True, capture_output=True, text=True,
        ).stdout.strip() or None
    except Exception:  # noqa: BLE001
        return None


def extract_video_frames(path: str):
    """Yield (png_bytes, w, h, duration_ms) for each frame of a video via ffmpeg.

    duration_ms is None (fps comes from the container, handled by the caller).
    """
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "ffmpeg is required for video inputs but was not found on PATH.\n"
            "Install it with: brew install ffmpeg"
        )
    # VP8/VP9 carry alpha as side data that ffmpeg's *native* decoders silently
    # drop -- only the libvpx decoders expose it. Force libvpx so transparency
    # in WebM (yuva420p) survives; other codecs decode alpha fine natively.
    codec = _probe_codec(path)
    input_decoder = {"vp9": ["-c:v", "libvpx-vp9"], "vp8": ["-c:v", "libvpx"]}.get(codec, [])

    tmp = tempfile.mkdtemp(prefix="webp2lottie-")
    try:
        # -pix_fmt rgba preserves alpha when the source stream carries it.
        subprocess.run(
            [
                "ffmpeg", "-y",
                *input_decoder,
                "-i", path,
                "-fps_mode", "passthrough",
                "-pix_fmt", "rgba",
                os.path.join(tmp, "frame_%05d.png"),
            ],
            check=True, capture_output=True, text=True,
        )
        from PIL import Image  # only needed to read back dimensions

        files = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
        for name in files:
            data = open(os.path.join(tmp, name), "rb").read()
            with Image.open(io.BytesIO(data)) as im:
                w, h = im.size
            yield data, w, h, None
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def extract_image_frames(path: str):
    """Yield (png_bytes, w, h, duration_ms) for each frame of a WebP/GIF/APNG."""
    from PIL import Image, ImageSequence

    with Image.open(path) as im:
        for frame in ImageSequence.Iterator(im):
            duration = int(frame.info.get("duration", 0) or 0)
            rgba = frame.convert("RGBA")  # fully composited canvas-sized frame
            buf = io.BytesIO()
            rgba.save(buf, format="PNG")
            yield buf.getvalue(), rgba.width, rgba.height, (duration or None)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert an (animated) WebP into a frame-sequence Lottie JSON."
    )
    parser.add_argument("input", help="Path to the input .webp file")
    parser.add_argument(
        "output",
        nargs="?",
        help="Output .json path (default: alongside input with .json extension)",
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=None,
        help="Frames per second. Default: derived from the WebP frame durations, "
        "falling back to 60.",
    )
    parser.add_argument(
        "--save-frames",
        metavar="DIR",
        help="Also write the extracted PNG frames to this directory.",
    )
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}", file=sys.stderr)
        return 1

    output = args.output or (os.path.splitext(args.input)[0] + ".json")
    ext = os.path.splitext(args.input)[1].lower()
    is_video = ext in VIDEO_EXTS

    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        print(
            "Error: Pillow is required. Install it with:\n"
            "    python3 -m pip install Pillow",
            file=sys.stderr,
        )
        return 1

    print(f"Extracting frames from {args.input} ...")

    if args.save_frames:
        os.makedirs(args.save_frames, exist_ok=True)

    try:
        frames = extract_video_frames(args.input) if is_video else extract_image_frames(args.input)
    except Exception as exc:  # noqa: BLE001
        print(f"Error: could not open input: {exc}", file=sys.stderr)
        return 1

    assets = []
    layers = []
    durations_ms = []
    width = height = 0

    try:
        for i, (png_bytes, w, h, duration) in enumerate(frames):
            durations_ms.append(duration or 0)
            if i == 0:
                width, height = w, h

            if args.save_frames:
                with open(os.path.join(args.save_frames, f"frame_{i:05d}.png"), "wb") as fh:
                    fh.write(png_bytes)

            b64 = base64.b64encode(png_bytes).decode("ascii")

            assets.append(
                {
                    "id": f"image_{i}",
                    "w": w,
                    "h": h,
                    "e": 1,
                    "u": "",
                    "p": f"data:image/png;base64,{b64}",
                }
            )
            layers.append(
                {
                    "ddd": 0,
                    "ind": i + 1,
                    "ty": 2,  # image layer
                    "refId": f"image_{i}",
                    "ks": {
                        "o": {"k": 100},
                        "r": {"k": 0},
                        "p": {"k": [w / 2, h / 2, 0]},
                        "a": {"k": [w / 2, h / 2, 0]},
                        "s": {"k": [100, 100, 100]},
                    },
                    "ao": 0,
                    "ip": i,
                    "op": i + 1,
                    "st": i,
                    "bm": 0,
                }
            )
    except subprocess.CalledProcessError as exc:
        print(f"Error: ffmpeg failed:\n{exc.stderr}", file=sys.stderr)
        return 1

    frame_count = len(assets)
    if frame_count == 0:
        print("Error: no frames were extracted.", file=sys.stderr)
        return 1

    # Determine fps: explicit flag > container/frame timing > default 60.
    if args.fps is not None:
        fps = args.fps
    elif is_video:
        probed = _probe_video_fps(args.input)
        fps = round(probed) if probed else 60
    else:
        valid = [d for d in durations_ms if d > 0]
        avg = sum(valid) / len(valid) if valid else 0
        fps = round(1000 / avg) if avg > 0 else 60

    lottie = {
        "v": "5.7.4",
        "fr": fps,
        "ip": 0,
        "op": frame_count,
        "w": width,
        "h": height,
        "assets": assets,
        "layers": layers,
        "markers": [],
    }

    with open(output, "w") as fh:
        json.dump(lottie, fh, separators=(",", ":"))

    size_mb = os.path.getsize(output) / 1024 / 1024
    print(
        f"Wrote {output} "
        f"({frame_count} frames, {width}x{height}, {fps}fps, {size_mb:.1f} MB)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
