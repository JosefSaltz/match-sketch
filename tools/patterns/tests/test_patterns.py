import numpy as np
from helpers import PALETTE4, colors_of, random_blobs

from patterns.plaid import plaid
from patterns.render import render_webp
from patterns.seamless import neighbour_mismatch, seamless, wrap_mismatch


def test_seam_blend_makes_wrap_as_smooth_as_the_interior():
    labels = random_blobs(seed=1, size=(400, 600), colors=4)
    assert wrap_mismatch(labels) > 2 * neighbour_mismatch(labels)  # the input has real seams
    tile = seamless(labels, band=60, axes=(0, 1))
    assert tile.shape == (340, 540)
    assert wrap_mismatch(tile) <= 1.5 * neighbour_mismatch(tile)


def test_plaid_tile_is_periodic_and_uses_only_sett_colors():
    img = plaid([("#b3141b", 8), ("#1a1a1a", 8)], thread_px=4)
    assert colors_of(img) <= {(0xB3, 0x14, 0x1B), (0x1A, 0x1A, 0x1A)}
    assert img.width == img.height == 2 * (8 + 8) * 4
    # A 2/2 twill repeats every 4 threads, so a seamless tile holds a multiple of 4 threads.
    assert (img.width // 4) % 4 == 0


def test_plaid_pads_the_repeat_to_whole_twill_steps():
    img = plaid([("#b3141b", 3), ("#1a1a1a", 2)], thread_px=2)
    assert (img.width // 2) % 4 == 0
    assert img.width == img.height


def test_tile_stays_under_the_size_budget(tmp_path):
    labels = random_blobs(seed=3, size=(900, 1300), colors=4)
    out = render_webp(labels, PALETTE4, tmp_path / "t.webp", width=1600)
    assert out.stat().st_size <= 250_000


def test_photo_labels_keeps_small_distinct_colors_apart_from_a_dominant_one():
    # Chocolate Chip: a tan ground covers most of the cloth; dark brown and the black and white
    # "rocks" are small. Each must still come out as its own color.
    from PIL import Image

    from patterns.separate import photo_labels

    rng = np.random.default_rng(5)
    colors = ["#b39b85", "#c9b9a5", "#8f6550", "#6a4a3e", "#ded5d0", "#3a3030"]
    rgb = np.array([[int(h[i : i + 2], 16) for i in (1, 3, 5)] for h in colors])
    labels = np.zeros((400, 600), np.uint8)  # mostly ground
    labels[40:160, 40:260] = 1
    labels[220:330, 300:520] = 2
    labels[60:120, 380:470] = 3
    for k, count in ((4, 40), (5, 25)):  # small rocks
        for y, x in rng.integers([10, 10], [390, 590], size=(count, 2)):
            labels[y - 4 : y + 4, x - 4 : x + 4] = k
    noisy = rgb[labels] + rng.normal(0, 4, (400, 600, 3))
    img = Image.fromarray(np.clip(noisy, 0, 255).astype(np.uint8))
    _, palette = photo_labels(img, 6, 600, medians=(3,), min_px=12, flatten=False)
    found = np.array([[int(h[i : i + 2], 16) for i in (1, 3, 5)] for h in palette])
    for want in rgb:
        assert np.min(np.abs(found - want).sum(1)) < 30, f"missing {want}"


def test_find_period_spots_a_repeat_already_in_the_swatch():
    from patterns.flat import find_period

    one = random_blobs(seed=6, size=(150, 400), colors=4)
    stacked = np.concatenate([one, one, one[:60]], axis=0)  # repeats every 150 rows
    assert find_period(stacked, axis=0) == 150
    assert find_period(stacked, axis=1) is None


def test_flat_labels_use_the_swatch_colors_exactly():
    from PIL import Image

    from patterns.flat import flat_labels

    labels = random_blobs(seed=7, size=(200, 300), colors=4)
    rgb = np.array([[int(h[i : i + 2], 16) for i in (1, 3, 5)] for h in PALETTE4], np.uint8)
    img = rgb[labels].copy()
    img[0, :20] = [10, 200, 10]  # a few stray anti-aliased pixels
    found, palette = flat_labels(Image.fromarray(img), colors=4)
    assert sorted(palette) == sorted(PALETTE4)
    assert found.shape == labels.shape


def _grid_photo(seed: int) -> "Image.Image":
    """A DNC-like fabric photo: light cells in a dark grid, plus a few dark rubble blobs."""
    from PIL import Image

    rng = np.random.default_rng(seed)
    period, cell = 20, 13
    h, w = 600, 800
    y, x = np.mgrid[:h, :w]
    light = ((x % period) < cell) & ((y % period) < cell)
    for cy, cx in rng.integers([40, 40], [h - 40, w - 40], size=(12, 2)):
        light &= (y - cy) ** 2 / 1600 + (x - cx) ** 2 / 2500 > 1  # blobs ~ 4-5 cells across
    rgb = np.where(light[..., None], [150, 152, 130], [40, 44, 30]).astype(np.uint8)
    return Image.fromarray(rgb)


def test_grid_tile_is_whole_cells_seamless_and_spreads_the_rubble():
    from patterns.grid import grid_tile

    tile = grid_tile(_grid_photo(8), cells=(32, 20), cell_px=20, coverage=0.10, seed=3)
    assert tile.shape == (20 * 20, 32 * 20)
    assert wrap_mismatch(tile) <= 1.5 * neighbour_mismatch(tile)
    dark_cells = np.mean(tile.reshape(20, 20, 32, 20).min(axis=(1, 3)) == 1)  # fully dark cells
    assert 0.03 <= dark_cells <= 0.25
