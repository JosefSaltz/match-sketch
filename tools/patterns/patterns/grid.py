"""Grid patterns (Desert Night): an exact grid plus real rubble shapes scattered evenly.

The grid is measured from a fabric photo and redrawn exactly; the rubble blobs are traced from
the photo and placed evenly on a wrap-around tile that is a whole number of cells, so the tile
is seamless by construction.
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def _light_mask(img: Image.Image) -> np.ndarray:
    g = np.asarray(img.convert("L").filter(ImageFilter.MedianFilter(5))).astype(float)
    g = g / np.maximum(ndimage.gaussian_filter(g, 120), 1) * g.mean()
    hist, edges = np.histogram(g, 256)
    w = np.cumsum(hist)
    m = np.cumsum(hist * edges[:-1])
    otsu = edges[np.argmax((m[-1] * w / w[-1] - m) ** 2 / (w * (w[-1] - w) + 1e-9))]
    return g >= otsu


def _period(profile: np.ndarray) -> float:
    """The grid's period in px: an FFT estimate refined by folding the profile."""
    spectrum = np.abs(np.fft.rfft(profile - profile.mean()))
    guess = len(profile) / (np.argmax(spectrum[3:]) + 3)
    best, period = -1.0, guess
    for p in np.arange(guess - 1.0, guess + 1.0, 0.005):
        idx = ((np.arange(len(profile)) % p) / p * 64).astype(int)
        bins = np.bincount(idx, weights=profile, minlength=64) / np.maximum(
            np.bincount(idx, minlength=64), 1
        )
        if bins.max() - bins.min() > best:
            best, period = bins.max() - bins.min(), p
    return float(period)


def _blobs(light: np.ndarray, px: float, py: float) -> tuple[list[np.ndarray], float, float]:
    """Rubble = dark areas thicker than a grid line, each kept as a shape; plus cell fractions."""
    comp, n = ndimage.label(light)
    areas = ndimage.sum(light, comp, range(1, n + 1))
    med = np.median(areas[areas > 0.1 * px * py])
    full = np.nonzero((areas > 0.7 * med) & (areas < 1.3 * med))[0] + 1
    boxes = ndimage.find_objects(comp)
    bw = np.median([boxes[i - 1][1].stop - boxes[i - 1][1].start for i in full])
    bh = np.median([boxes[i - 1][0].stop - boxes[i - 1][0].start for i in full])
    line_half = max(px - bw, py - bh) / 2
    dark = ~light
    # A grid crossing's centre is line_half * sqrt(2) from light; anything thicker is rubble.
    core = ndimage.distance_transform_edt(dark) > line_half * 1.7
    grow = int(np.ceil(line_half * 1.7)) + 1
    yy, xx = np.mgrid[-grow : grow + 1, -grow : grow + 1]
    rubble = ndimage.binary_dilation(core, structure=(xx * xx + yy * yy) <= grow * grow) & dark
    rubble = ndimage.gaussian_filter(rubble.astype(float), 2) > 0.5
    comp, n = ndimage.label(rubble)
    shapes = []
    for i, sl in enumerate(ndimage.find_objects(comp), start=1):
        piece = comp[sl] == i
        if piece.sum() >= 0.9 * px * py:
            shapes.append(piece)
    return shapes, bw / px, bh / py


def grid_tile(
    img: Image.Image,
    cells: tuple[int, int] = (64, 40),
    cell_px: int = 40,
    coverage: float = 0.10,
    seed: int = 7,
) -> np.ndarray:
    """Labels for a seamless tile, `cells` (x, y) cells of `cell_px`: 0 = light cell, 1 = dark."""
    light = _light_mask(img)
    px, py = _period(light.mean(0)), _period(light.mean(1))
    shapes, fx, fy = _blobs(light, px, py)
    if not shapes:
        raise ValueError("no rubble found in the reference")
    library = [
        ndimage.zoom(s.astype(float), (cell_px / py, cell_px / px), order=1) > 0.5 for s in shapes
    ]
    library = [s for s in library if s.sum() > 0.6 * cell_px * cell_px] or library
    rng = np.random.default_rng(seed)
    tw, th = cells[0] * cell_px, cells[1] * cell_px
    count = max(1, round(coverage * tw * th / np.mean([s.sum() for s in library])))
    spacing = np.sqrt(tw * th / count) * 0.75
    points: list[np.ndarray] = []
    for _ in range(200_000):
        if len(points) >= count:
            break
        p = rng.uniform(0, [tw, th])
        if all(
            min(abs(p[0] - q[0]), tw - abs(p[0] - q[0])) ** 2
            + min(abs(p[1] - q[1]), th - abs(p[1] - q[1])) ** 2
            >= spacing**2
            for q in points
        ):
            points.append(p)
    rubble = np.zeros((th, tw), bool)
    order = rng.permutation(len(library))
    for k, p in enumerate(points):
        shape = np.rot90(library[order[k % len(library)]], rng.integers(4))
        if rng.random() < 0.5:
            shape = shape[:, ::-1]
        h, w = shape.shape
        ys = (int(p[1]) - h // 2 + np.arange(h)) % th
        xs = (int(p[0]) - w // 2 + np.arange(w)) % tw
        rubble[np.ix_(ys, xs)] |= shape
    cw, ch = round(cell_px * fx), round(cell_px * fy)
    ox, oy = (cell_px - cw) // 2, (cell_px - ch) // 2
    gx = ((np.arange(tw) - ox) % cell_px) < cw
    gy = ((np.arange(th) - oy) % cell_px) < ch
    cell_light = gy[:, None] & gx[None, :] & ~rubble
    return np.where(cell_light, 0, 1).astype(np.uint8)
