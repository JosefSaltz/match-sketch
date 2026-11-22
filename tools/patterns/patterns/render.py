"""Label maps -> shipped WebP tiles (and optional SVG masters)."""
import re
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

SIZE_BUDGET = 250_000


def _rgb_palette(palette: list[str]) -> np.ndarray:
    return np.array([[int(h[i : i + 2], 16) for i in (1, 3, 5)] for h in palette], np.uint8)


def render_webp(
    labels: np.ndarray,
    palette: list[str],
    out: Path,
    width: int,
    resample: str = "lanczos",
) -> Path:
    """Paint the labels, scale to `width`, and save as WebP within the size budget."""
    img = Image.fromarray(_rgb_palette(palette)[labels])
    height = round(labels.shape[0] * width / labels.shape[1])
    method = Image.NEAREST if resample == "nearest" else Image.LANCZOS
    img = img.resize((width, height), method)
    return save_webp(img, out)


def save_webp(img: Image.Image, out: Path) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    for quality in (82, 75, 68, 60):
        img.save(out, "WEBP", quality=quality, method=6)
        if out.stat().st_size <= SIZE_BUDGET:
            break
    return out


def trace_svg(labels: np.ndarray, palette: list[str], out: Path, margin: int = 48) -> Path:
    """A seamless vector master: trace the wrap-padded labels, then view only the central tile."""
    import vtracer

    height, width = labels.shape
    padded = np.pad(labels, margin, mode="wrap")
    with tempfile.TemporaryDirectory() as tmp:
        png, raw = Path(tmp) / "padded.png", Path(tmp) / "raw.svg"
        Image.fromarray(_rgb_palette(palette)[padded]).save(png)
        vtracer.convert_image_to_svg_py(
            str(png), str(raw), colormode="color", hierarchical="stacked", mode="spline",
            filter_speckle=8, color_precision=8, layer_difference=8, path_precision=1,
        )
        svg = raw.read_text()
    svg = re.sub(
        r"<svg[^>]*>",
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{margin} {margin} {width} {height}" '
        f'width="{width}" height="{height}">',
        svg,
        count=1,
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(svg)
    return out
