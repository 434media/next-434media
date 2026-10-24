"""Rebuild The Feed's sidebar video derivatives from their source.

Source: digitalcanvas.mov in the groovy-ego-462522-v2 bucket (HEVC, 888x444,
6 s, 10.6 MB), which browsers other than Safari cannot play. Output: the two
encodings in public/thefeed/ that the page serves (Display and Design Standard
3.0: MP4 H.264 High yuv420p and WebM VP9, index first, quality target with a
ceiling, AAC / Opus 128 kbps), plus three poster candidates in a contact sheet
for the founder to pick from.

    python3 scripts/thefeed/build-video.py /path/to/digitalcanvas.mov [--sheet out.jpg]

ffmpeg comes from imageio-ffmpeg (see CLAUDE.md, Environment).
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
OUT = Path(__file__).resolve().parents[2] / "public" / "thefeed"


def run(*args: str) -> None:
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def main() -> None:
    src = sys.argv[1]
    sheet = sys.argv[sys.argv.index("--sheet") + 1] if "--sheet" in sys.argv else None
    OUT.mkdir(parents=True, exist_ok=True)
    run("-i", src, "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "23",
        "-maxrate", "2500k", "-bufsize", "5000k", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", str(OUT / "thefeed-digitalcanvas.mp4"))
    run("-i", src, "-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-crf", "34", "-b:v", "2500k",
        "-row-mt", "1", "-c:a", "libopus", "-b:a", "128k", str(OUT / "thefeed-digitalcanvas.webm"))
    if sheet:
        with tempfile.TemporaryDirectory() as tmp:
            frames = []
            for label, t in (("A", 1), ("B", 3), ("C", 5)):
                frame = f"{tmp}/{label}.jpg"
                run("-ss", str(t), "-i", src, "-frames:v", "1", "-q:v", "2", frame)
                frames.append((label, t, frame))
            inputs = [arg for _, _, f in frames for arg in ("-i", f)]
            labels = ";".join(
                f"[{i}]drawtext=text='{label}  ({t}s)':fontcolor=white:fontsize=36:x=20:y=20:"
                f"box=1:boxcolor=black@0.6[{label}]"
                for i, (label, t, _) in enumerate(frames)
            )
            run(*inputs, "-filter_complex", f"{labels};[A][B][C]vstack=3", sheet)
    for f in sorted(OUT.iterdir()):
        print(f"{f.name}\t{f.stat().st_size} bytes")


if __name__ == "__main__":
    main()
