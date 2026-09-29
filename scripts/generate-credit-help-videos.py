"""Crop the actual Figma timeline exports for the native Spend Mode help pager.

The source MP4s are exports of Figma frames 27048:3993, 27217:1250, and
27245:1250. They contain the entire mock phone screen. This keeps only the
animated illustration; the app renders its own text, controls, and status bar.
Run from the repository root with ffmpeg installed.
"""

from pathlib import Path
import subprocess


SOURCE = Path("assets/animations/figma-credit-help-source")
DESTINATION = Path("assets/animations")
POSTER_SECONDS = {"two-ways": 3.0, "keep-earning": 3.8, "repay-anytime": 3.7}


def repair_channel(channel: str) -> str:
    """Interpolate through Figma's split Repay text as the card moves."""
    sample = lambda x: f"{channel}({x},Y)"
    button = f"{sample(525)}*(725-X)/190+{sample(735)}*(X-535)/190"
    overflow = f"{sample(580)}*(670-X)/80+{sample(680)}*(X-590)/80"
    # The card enters from below; its label settles at the exported position.
    shift = "if(lt(T,0.4),53*exp(-10*T),0)"
    return (
        f"if(between(X,535,725)*between(Y,602+{shift},693+{shift}),{button},"
        f"if(between(X,590,670)*between(Y,694+{shift},755+{shift}),{overflow},"
        f"{channel}(X,Y)))"
    )


for name, poster_second in POSTER_SECONDS.items():
    source = SOURCE / f"figma-credit-help-{name}.mp4"
    output = DESTINATION / f"credit-help-{name}.mp4"
    dimensions = subprocess.check_output(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0",
            str(source),
        ],
        text=True,
    ).strip()
    width, height = map(int, dimensions.split("x"))
    if width < 1000:
        raise ValueError(f"{source} needs a 3× Figma timeline export")

    # The source is a complete 419×1132 phone screen exported at 3×. Keep only
    # the animated illustration and retain its original pixel density.
    scale = height / 1132
    even = lambda value: round(value / 2) * 2
    illustration_top = even(170 * scale)
    illustration_height = even(440 * scale)
    filter_graph = f"crop=iw:{illustration_height}:0:{illustration_top}"
    command = ["ffmpeg", "-loglevel", "error", "-y", "-i", str(source)]
    if name == "repay-anytime":
        # Figma's video exporter wraps the button label into "Repa" / "y".
        # Remove the split source text across the entire button animation,
        # then draw the correct label at the button's animated position.
        command += ["-loop", "1", "-framerate", "30", "-i", str(SOURCE / "repay-label.png")]
        repair = ":".join(f"{channel}='{repair_channel(channel)}'" for channel in "rgb")
        command += [
            "-filter_complex",
            f"[0:v]{filter_graph},format=gbrp,"
            f"geq={repair}:enable='lte(t,2.24)',format=yuv420p[base];"
            "[1:v]format=rgba,"
            "fade=t=in:st=0:d=0.08:alpha=1,"
            "fade=t=out:st=2.10:d=0.09:alpha=1[label];"
            "[base][label]overlay=x=0:"
            "y='if(lt(t,0.4),53*exp(-10*t),0)':"
            "eval=frame:shortest=1:enable='between(t,0.03,2.19)'[out]",
            "-map", "[out]",
        ]
    else:
        command += ["-vf", filter_graph]
    command += [
        "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "12",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output),
    ]
    subprocess.run(command, check=True)
    subprocess.run(
        [
            "ffmpeg", "-loglevel", "error", "-y", "-ss", str(poster_second),
            "-i", str(output), "-frames:v", "1",
            str(DESTINATION / f"credit-help-{name}-poster.png"),
        ],
        check=True,
    )
