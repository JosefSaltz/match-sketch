"""Split a reference image into a few flat colors (a label map)."""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


def kmeans(
    x: np.ndarray, k: int, weights: np.ndarray | None = None, iters: int = 30, seed: int = 0,
    tries: int = 5,
) -> np.ndarray:
    """Weighted k-means with k-means++ seeding (best of `tries`)."""
    w = np.ones(len(x)) if weights is None else np.asarray(weights, float)
    rng = np.random.default_rng(seed)
    best, best_cost = None, np.inf
    for _ in range(tries):
        centers = [x[rng.choice(len(x), p=w / w.sum())]]
        for _ in range(1, k):
            d2 = np.min(((x[:, None] - np.array(centers)[None]) ** 2).sum(-1), 1) * w
            centers.append(x[rng.choice(len(x), p=d2 / d2.sum())])
        centers = np.array(centers)
        for _ in range(iters):
            assign = np.argmin(((x[:, None] - centers[None]) ** 2).sum(-1), 1)
            centers = np.stack(
                [
                    np.average(x[assign == i], axis=0, weights=w[assign == i])
                    if np.any(assign == i)
                    else centers[i]
                    for i in range(k)
                ]
            )
        cost = (np.min(((x[:, None] - centers[None]) ** 2).sum(-1), 1) * w).sum()
        if cost < best_cost:
            best, best_cost = centers, cost
    return best


def _assign(rgb: np.ndarray, k: int) -> np.ndarray:
    """Cluster the distinct colors present (Lab rounded to 3 units), each weighted by the square
    root of its pixel count, then label every pixel by its nearest cluster. Square-root weights
    keep a large ground color from outvoting small distinct ones (a camo's white rocks) without
    letting the many in-between colors along shape edges form clusters of their own."""
    flat = rgb.reshape(-1, 3).astype(float)
    lab = srgb_to_lab(flat)
    bins, counts = np.unique(np.round(lab / 3), axis=0, return_counts=True)
    if len(bins) > 20_000:
        keep = np.argsort(-counts)[:20_000]
        bins, counts = bins[keep], counts[keep]
    centers = kmeans(bins * 3, k, weights=np.sqrt(counts))
    return np.argmin(((lab[:, None] - centers[None]) ** 2).sum(-1), 1).reshape(rgb.shape[:2])


def _hex(c) -> str:
    return "#%02x%02x%02x" % tuple(int(v) for v in c)


def _order_light_to_dark(labels: np.ndarray, palette: list) -> tuple[np.ndarray, list[str]]:
    order = np.argsort([-(np.asarray(p) @ [0.299, 0.587, 0.114]) for p in palette])
    remap = np.empty(len(palette), int)
    remap[order] = np.arange(len(palette))
    return remap[labels].astype(np.uint8), [_hex(palette[i]) for i in order]


def photo_labels(
    img: Image.Image,
    colors: int,
    work_width: int,
    crop: tuple[int, int, int, int] | None = None,
    medians: tuple[int, ...] = (7, 5),
    min_px: int = 60,
    flatten: bool = True,
) -> tuple[np.ndarray, list[str]]:
    """Reference image -> label map: even out lighting (fabric photos only; it would pull a
    digital swatch's large patches toward the average), denoise, k-means, drop specks.

    Returns the labels (light to dark) and each color sampled from the untouched photo.
    """
    img = img.convert("RGB")
    if crop:
        img = img.crop(crop)
    img = img.resize((work_width, round(img.height * work_width / img.width)), Image.LANCZOS)
    original = np.asarray(img).astype(float)
    flat = original
    if flatten:
        light = np.stack([ndimage.gaussian_filter(original[..., c], 120) for c in range(3)], -1)
        flat = np.clip(original / light * light.reshape(-1, 3).mean(0), 0, 255)
    den = Image.fromarray(flat.astype(np.uint8))
    for size in medians:
        den = den.filter(ImageFilter.MedianFilter(size))
    labels = _assign(np.asarray(den), colors)
    for k in range(colors):
        comp, count = ndimage.label(labels == k)
        sizes = ndimage.sum(np.ones_like(comp), comp, range(1, count + 1))
        labels[np.isin(comp, np.nonzero(sizes < min_px)[0] + 1)] = -1
    holes = labels < 0
    if holes.any():
        _, (iy, ix) = ndimage.distance_transform_edt(holes, return_indices=True)
        labels = labels[iy, ix]
    palette = [np.median(original.reshape(-1, 3)[labels.ravel() == k], 0) for k in range(colors)]
    return _order_light_to_dark(labels, palette)
