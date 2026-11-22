"""Plaid tiles woven from a thread count (sett), as a 2/2 twill."""
from math import lcm

import numpy as np
from PIL import Image


def _rgb(hex_color: str) -> tuple[int, int, int]:
    return tuple(int(hex_color[i : i + 2], 16) for i in (1, 3, 5))


def plaid(sett: list[tuple[str, int]], thread_px: int) -> Image.Image:
    """Mirror the sett (as tartans are), repeat it to whole twill steps, and weave warp and weft.

    A thread crossing shows the warp color where (warp + weft index) mod 4 < 2, otherwise the
    weft color, so the tile is periodic by construction.
    """
    threads = [color for color, count in sett for _ in range(count)]
    threads = threads + threads[::-1]
    threads = threads * (lcm(len(threads), 4) // len(threads))
    colors = np.array([_rgb(c) for c in threads], np.uint8)
    i = np.arange(len(threads))
    warp_wins = ((i[None, :] + i[:, None]) % 4) < 2
    woven = np.where(warp_wins[..., None], colors[None, :, :], colors[:, None, :])
    big = np.repeat(np.repeat(woven, thread_px, axis=0), thread_px, axis=1)
    return Image.fromarray(big.astype(np.uint8))
