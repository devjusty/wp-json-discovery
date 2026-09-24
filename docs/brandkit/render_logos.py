#!/usr/bin/env python3
"""Rasterize locked SVG logo sources into consistent PNG brand exports."""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent
CHROME = "google-chrome"

CHARCOAL = "#0B0C0E"
CREAM = "#E8E4DC"
SIGNAL = "#5EB8C4"
PANEL = "#14161A"

# Locked geometry — same path in every export
# Square frame with shallow pointed brace notches on L/R (not an hourglass).
MARK_PATHS = """
  <path class="mark-frame" fill="none" stroke="var(--frame)" stroke-width="5.5"
    stroke-linecap="square" stroke-linejoin="miter"
    d="M 22 18 H 78 V 40 L 71.5 50 L 78 60 V 82 H 22 V 60 L 28.5 50 L 22 40 Z"/>
  <line class="mark-path" stroke="var(--path)" stroke-width="5.5" stroke-linecap="square"
    x1="34" y1="66" x2="48" y2="52"/>
  <circle class="mark-node" fill="var(--node)" cx="55.75" cy="44.25" r="4.35"/>
"""

WORDMARK_FONT = (
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
)


def mark_svg(frame: str, path: str, node: str, size: int = 100) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="{size}" height="{size}">
  <style>:root {{ --frame:{frame}; --path:{path}; --node:{node}; }}</style>
  {MARK_PATHS}
</svg>"""


def lockup_svg(fg: str, node: str | None = None, width: int = 720, height: int = 180) -> str:
    n = node or fg
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 180" width="{width}" height="{height}">
  <style>:root {{ --frame:{fg}; --path:{fg}; --node:{n}; }}</style>
  <g transform="translate(28,40) scale(1)">{MARK_PATHS}</g>
  <text x="152" y="108" fill="{fg}" font-family="{WORDMARK_FONT}"
    font-size="44" font-weight="560" letter-spacing="0.015em">WP JSON Discovery</text>
</svg>"""


def wordmark_svg(fg: str, width: int = 720, height: int = 180) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 180" width="{width}" height="{height}">
  <text x="360" y="104" text-anchor="middle" fill="{fg}" font-family="{WORDMARK_FONT}"
    font-size="48" font-weight="560" letter-spacing="0.015em">WP JSON Discovery</text>
</svg>"""


def app_icon_svg(size: int = 512) -> str:
    # Full-bleed square — OS applies mask. Mark inset for safe area.
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="{size}" height="{size}">
  <style>:root {{ --frame:{CREAM}; --path:{CREAM}; --node:{SIGNAL}; }}</style>
  <rect width="100" height="100" fill="{PANEL}"/>
  <g transform="translate(12,12) scale(0.76)">{MARK_PATHS}</g>
</svg>"""

def html_doc(svg: str, bg: str, width: int, height: int) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  html,body {{ margin:0; padding:0; background:{bg}; width:{width}px; height:{height}px; overflow:hidden; }}
  .stage {{ width:{width}px; height:{height}px; display:flex; align-items:center; justify-content:center; background:{bg}; }}
  svg {{ display:block; }}
</style></head>
<body><div class="stage">{svg}</div></body></html>"""


def chrome_screenshot(html: str, out: Path, width: int, height: int) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "page.html"
        page.write_text(html, encoding="utf-8")
        # Chrome writes screenshot.png into cwd when --screenshot is used with a path
        screenshot = Path(tmp) / "shot.png"
        cmd = [
            CHROME,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            f"--window-size={width},{height}",
            f"--screenshot={screenshot}",
            page.as_uri(),
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        out.write_bytes(screenshot.read_bytes())


def write_source_svgs() -> None:
    """Canonical sources — cream on transparent (currentColor via explicit cream)."""
    (OUT / "logo-mark.svg").write_text(mark_svg(CREAM, CREAM, CREAM), encoding="utf-8")
    (OUT / "logo-lockup.svg").write_text(lockup_svg(CREAM, SIGNAL), encoding="utf-8")
    (OUT / "logo-wordmark.svg").write_text(wordmark_svg(CREAM), encoding="utf-8")
    (OUT / "logo-app-icon.svg").write_text(app_icon_svg(512), encoding="utf-8")


def dual_matte_transparent(on_black: Image.Image, on_white: Image.Image) -> Image.Image:
    """Rebuild RGBA from matched black/white composites (preserves SVG antialiasing).

    white - black = (1 - a) * 255 → a = 1 - mean(w - b) / 255
    Color recovers as black / a when a > 0.
    """
    if on_black.size != on_white.size:
        raise ValueError("matte size mismatch")

    size = on_black.size
    black = on_black.convert("RGB").tobytes()
    white = on_white.convert("RGB").tobytes()
    out = bytearray(size[0] * size[1] * 4)
    pixels = size[0] * size[1]

    for i in range(pixels):
        bi = i * 3
        oi = i * 4
        br, bg, bb = black[bi], black[bi + 1], black[bi + 2]
        wr, wg, wb = white[bi], white[bi + 1], white[bi + 2]
        a = 1.0 - ((wr - br) + (wg - bg) + (wb - bb)) / (3.0 * 255.0)
        if a < 0.004:
            continue
        if a > 1.0:
            a = 1.0
        out[oi] = min(255, round(br / a))
        out[oi + 1] = min(255, round(bg / a))
        out[oi + 2] = min(255, round(bb / a))
        out[oi + 3] = round(a * 255)

    return Image.frombytes("RGBA", size, bytes(out))


def render_transparent_mark(
    out: Path,
    frame: str,
    path_c: str,
    node: str,
    size: int = 1024,
) -> None:
    """Chrome-quality SVG mark with true alpha (dual matte)."""
    svg = mark_svg(frame, path_c, node, size)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        black_path = tmp_path / "black.png"
        white_path = tmp_path / "white.png"
        chrome_screenshot(html_doc(svg, "#000000", size, size), black_path, size, size)
        chrome_screenshot(html_doc(svg, "#FFFFFF", size, size), white_path, size, size)
        result = dual_matte_transparent(Image.open(black_path), Image.open(white_path))
        result.save(out, "PNG")


def main() -> None:
    write_source_svgs()

    exports = [
        # mark dark / light / mono
        ("logo-mark-dark.png", mark_svg(CREAM, CREAM, CREAM, 640), CHARCOAL, 640, 640),
        ("logo-mark-light.png", mark_svg(CHARCOAL, CHARCOAL, CHARCOAL, 640), CREAM, 640, 640),
        ("logo-mark-mono.png", mark_svg("#000000", "#000000", "#000000", 640), "#FFFFFF", 640, 640),
        # lockups
        ("logo-lockup-dark.png", lockup_svg(CREAM, SIGNAL, 1280, 320), CHARCOAL, 1280, 320),
        ("logo-lockup-light.png", lockup_svg(CHARCOAL, SIGNAL, 1280, 320), CREAM, 1280, 320),
        # wordmarks
        ("logo-wordmark-dark.png", wordmark_svg(CREAM, 1280, 320), CHARCOAL, 1280, 320),
        ("logo-wordmark-light.png", wordmark_svg(CHARCOAL, 1280, 320), CREAM, 1280, 320),
        # app icon (full bleed, panel already in SVG)
        ("logo-app-icon.png", app_icon_svg(1024), PANEL, 1024, 1024),
    ]

    manifest = []
    for name, svg, bg, w, h in exports:
        path = OUT / name
        chrome_screenshot(html_doc(svg, bg, w, h), path, w, h)
        manifest.append({"file": name, "width": w, "height": h, "background": bg})
        print(f"wrote {path.name} ({w}×{h})")

    # Transparent mark variants — same Chrome geometry as solid marks
    transparent = [
        ("logo-mark-cream.png", CREAM, CREAM, CREAM),
        ("logo-mark-charcoal.png", CHARCOAL, CHARCOAL, CHARCOAL),
        ("logo-mark-signal-node.png", CREAM, CREAM, SIGNAL),
    ]
    for name, frame, path_c, node in transparent:
        path = OUT / name
        render_transparent_mark(path, frame, path_c, node, size=1024)
        manifest.append({"file": name, "width": 1024, "height": 1024, "background": "transparent"})
        print(f"wrote {path.name} (1024×1024 transparent)")

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("sources: logo-mark.svg, logo-lockup.svg, logo-wordmark.svg, logo-app-icon.svg")


if __name__ == "__main__":
    main()
