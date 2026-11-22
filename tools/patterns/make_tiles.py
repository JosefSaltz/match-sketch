"""Build theme tiles from sources.json.

    uv run make_tiles.py dpm buffalo-check --preview   # build into out/, write out/review.html
    uv run make_tiles.py --all --ship                       # also copy cleared tiles to static/themes

Tiles always land in tools/patterns/out/ first. `--ship` copies only entries marked cleared into
the app, after the user has approved them (spec §6.7); uncleared sources never reach the repo.
"""
import argparse
import shutil
import sys
from pathlib import Path

from PIL import Image

from patterns.plaid import plaid
from patterns.preview import write_review
from patterns.render import render_webp, save_webp, trace_svg
from patterns.seamless import neighbour_mismatch, seamless, wrap_mismatch
from patterns.separate import photo_labels
from patterns.sources import SUPPORTED_KINDS, fetch, load_manifest

HERE = Path(__file__).parent
CACHE, OUT = HERE / ".cache", HERE / "out"
STATIC = HERE.parent.parent / "static" / "themes"


def build(entry, svg: bool) -> dict:
    out = OUT / f"{entry.id}.webp"
    reference = None
    if entry.kind == "plaid":
        img = plaid([(c, n) for c, n in entry.sett], entry.thread_px)
        save_webp(img, out)
        seam = "n/a (woven)"
        palette = sorted({c for c, _ in entry.sett})
        display = img.width
    else:
        reference = fetch(entry, CACHE)
        src = Image.open(reference)
        labels, sampled = photo_labels(
            src, entry.colors, entry.work_width, tuple(entry.crop) if entry.crop else None
        )
        labels = seamless(labels, entry.seam_band, axes=(0, 1))
        palette = entry.palette or sampled
        render_webp(labels, palette, out, entry.tile_width)
        display = entry.tile_width // 2
        seam = f"{wrap_mismatch(labels):.3f} vs {neighbour_mismatch(labels):.3f} interior"
        if svg:
            trace_svg(labels, palette, OUT / f"{entry.id}.svg")
    size_kb = round(out.stat().st_size / 1024)
    print(f"  {entry.id}: {out.relative_to(HERE)} {size_kb} KB, seam {seam}, palette {palette}")
    return dict(
        id=entry.id, name=entry.name, tile=out, size_kb=size_kb, seam=seam,
        palette=palette, display_width=display, reference=reference, cleared=entry.cleared,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("ids", nargs="*")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--preview", action="store_true", help="write out/review.html")
    parser.add_argument("--ship", action="store_true", help="copy cleared tiles into static/themes")
    parser.add_argument("--svg", action="store_true", help="also write vector masters to out/")
    args = parser.parse_args()

    entries = load_manifest(HERE / "sources.json")
    wanted = entries if args.all else [e for e in entries if e.id in args.ids]
    missing = set(args.ids) - {e.id for e in entries}
    if missing:
        print(f"unknown ids: {', '.join(sorted(missing))}", file=sys.stderr)
        return 2
    results = []
    for entry in wanted:
        if entry.kind not in SUPPORTED_KINDS:
            print(f"  {entry.id}: skipped ({entry.kind!r} sources are not supported yet)")
            continue
        if entry.kind != "plaid" and not (entry.source and entry.source.url):
            print(f"  {entry.id}: skipped (no downloadable source)")
            continue
        results.append(build(entry, args.svg))
    if args.preview and results:
        print(f"review page: {write_review(results, OUT / 'review.html')}")
    if args.ship:
        STATIC.mkdir(parents=True, exist_ok=True)
        for r in results:
            if r["cleared"]:
                shutil.copy(r["tile"], STATIC / r["tile"].name)
                print(f"  shipped {r['id']} -> static/themes/{r['tile'].name}")
            else:
                print(f"  {r['id']}: not shipped (source not cleared)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
