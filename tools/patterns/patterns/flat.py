"""Flat digital swatches: exact colors, and any repeat the swatch already contains."""
import numpy as np
from PIL import Image

from .separate import _order_light_to_dark


def flat_labels(img: Image.Image, colors: int) -> tuple[np.ndarray, list[str]]:
    """The swatch's `colors` most common exact colors; every pixel maps to the nearest one."""
    a = np.asarray(img.convert("RGB")).astype(int)
    flat = a.reshape(-1, 3)
    values, counts = np.unique(flat, axis=0, return_counts=True)
    palette = values[np.argsort(-counts)[:colors]]
    labels = np.argmin(((flat[:, None, :] - palette[None]) ** 2).sum(-1), 1).reshape(a.shape[:2])
    return _order_light_to_dark(labels, list(palette))


def _mismatch(a: np.ndarray, shift: int) -> float:
    return float(np.mean(a[:-shift] != a[shift:]))


def find_period(labels: np.ndarray, axis: int, max_mismatch: float = 0.02) -> int | None:
    """The smallest shift along `axis` after which the swatch repeats itself, or None."""
    a = labels if axis == 0 else labels.T
    n = a.shape[0]
    step = 4 if n > 600 else 1
    small = a[::step, ::step]
    m = small.shape[0]
    min_overlap = max(m // 8, 8)
    for shift in range(max(2, m // 5), m - min_overlap + 1):
        if _mismatch(small, shift) <= max_mismatch:
            if step == 1:
                return shift
            candidates = range(max(1, shift * step - step), min(n - 1, shift * step + step) + 1)
            best = min(candidates, key=lambda s: _mismatch(a, s))
            return best if _mismatch(a, best) <= max_mismatch else None
    return None
