"""Synthetic inputs for the pattern tool's tests (no downloads)."""
import numpy as np
from PIL import Image
from scipy import ndimage

PALETTE4 = ["#c8ae5c", "#336530", "#644c2a", "#202927"]


def random_blobs(seed: int, size: tuple[int, int], colors: int) -> np.ndarray:
    """A camo-like label map: smoothed noise split into `colors` bands; not periodic at its edges."""
    rng = np.random.default_rng(seed)
    noise = ndimage.gaussian_filter(rng.random(size), sigma=min(size) / 25)
    edges = np.quantile(noise, np.linspace(0, 1, colors + 1)[1:-1])
    return np.digitize(noise, edges).astype(np.uint8)


def colors_of(img: Image.Image) -> set[tuple[int, int, int]]:
    return {tuple(c) for c in np.asarray(img.convert("RGB")).reshape(-1, 3)}
