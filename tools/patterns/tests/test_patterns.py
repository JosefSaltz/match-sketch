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
