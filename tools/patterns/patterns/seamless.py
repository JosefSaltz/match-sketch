"""Make a label map tile seamlessly by morphing shapes across each wrap seam."""
import numpy as np
from scipy import ndimage


def _sdf(labels: np.ndarray, n: int) -> np.ndarray:
    out = np.empty((n,) + labels.shape, np.float32)
    for k in range(n):
        mask = labels == k
        out[k] = ndimage.distance_transform_edt(~mask) - ndimage.distance_transform_edt(mask)
    return out


def _blend_columns(labels: np.ndarray, n: int, band: int) -> np.ndarray:
    d = _sdf(labels, n)
    width = labels.shape[1]
    x = np.arange(band) / band
    weight = x * x * (3 - 2 * x)
    mixed = (1 - weight) * d[:, :, width - band :] + weight * d[:, :, :band]
    seam = np.argmin(mixed, 0).astype(np.uint8)
    return np.concatenate([seam, labels[:, band : width - band]], 1)


def seamless(labels: np.ndarray, band: int, axes: tuple[int, ...] = (0, 1)) -> np.ndarray:
    """Blend the last `band` px into the first along each axis; the tile shrinks by `band` there."""
    n = int(labels.max()) + 1
    out = labels.astype(np.uint8)
    for axis in axes:
        out = _blend_columns(out, n, band) if axis == 1 else _blend_columns(out.T, n, band).T
    return np.ascontiguousarray(out)


def wrap_mismatch(labels: np.ndarray) -> float:
    """Share of positions where the tile's opposite edges disagree (0 = perfectly seamless)."""
    return float((np.mean(labels[:, 0] != labels[:, -1]) + np.mean(labels[0] != labels[-1])) / 2)


def neighbour_mismatch(labels: np.ndarray) -> float:
    """The same measure between ordinary neighbouring columns and rows, for comparison."""
    return float(
        (np.mean(labels[:, 1:] != labels[:, :-1]) + np.mean(labels[1:] != labels[:-1])) / 2
    )
