"""A review page: each tile on a mock app bar, a repeated area with seam markers, the reference."""
import base64
import html
from io import BytesIO
from pathlib import Path

from PIL import Image


def _data_uri(path: Path, mime: str = "image/webp") -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def _thumb_uri(path: Path, width: int = 360) -> str:
    img = Image.open(path).convert("RGB")
    img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, "WEBP", quality=80)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


FONT = (
    Path(__file__).resolve().parents[3]
    / "node_modules/@fontsource/graduate/files/graduate-latin-400-normal.woff2"
)

# The app's wordmark (src/lib/ui/Wordmark.svelte), so previews look like the real top bar.
WORDMARK = "".join(
    f'<text x="{6.5 + o}" y="{34 + o}" font-family="Graduate, serif" font-size="30" '
    f'letter-spacing="1.2" stroke-linejoin="round" fill="{c}" stroke="{c}" stroke-width="{w}">'
    "MATCH SKETCH</text>"
    for c, w, o in (("#000", 9, 5), ("#000", 9, 0), ("#fff", 1.6, 0))
)
WORDMARK = f'<svg viewBox="0 0 288 45" width="288" height="45" style="overflow:visible">{WORDMARK}</svg>'


def _font_face() -> str:
    if not FONT.exists():
        return ""
    data = base64.b64encode(FONT.read_bytes()).decode()
    return f"@font-face {{ font-family: Graduate; src: url(data:font/woff2;base64,{data}) format('woff2'); }}"


def write_review(results: list[dict], out: Path) -> Path:
    """`results`: dicts with id, name, tile (Path), display_width, palette, reference (Path|None)."""
    cards = []
    for r in results:
        tile = _data_uri(r["tile"])
        w = r["display_width"]
        tw, th = Image.open(r["tile"]).size
        h = round((w // 2) * th / tw)
        swatches = "".join(
            f'<i style="background:{c}" title="{c}"></i>' for c in (r.get("palette") or [])
        )
        ref = (
            f'<figure><img src="{_thumb_uri(r["reference"])}" alt=""><figcaption>Reference</figcaption></figure>'
            if r.get("reference")
            else ""
        )
        cards.append(
            f"""<section><h2>{html.escape(r["name"])} <small>{r["id"]} · {r["size_kb"]} KB · seam {r["seam"]}</small></h2>
<div class="sw">{swatches}</div>
<div class="bar" style="background:url({tile}) 0 0/{w}px auto">{WORDMARK}<span></span><button>Theme</button></div>
<div class="row"><div class="area" style="background:url({tile}) 0 0/{w // 2}px auto;--w:{w // 2}px;--h:{h}px"></div>{ref}</div></section>"""
        )
    page = f"""<!doctype html><meta charset="utf-8"><title>Pattern review</title>
<style>
{_font_face()}
body {{ font: 14px system-ui; margin: 16px; display: grid; gap: 28px; }}
h2 {{ margin: 0 0 6px; font-size: 16px; }} small {{ color: #666; font-weight: 400; }}
.sw {{ display: flex; gap: 4px; margin-bottom: 8px; }} .sw i {{ width: 18px; height: 18px; border: 1px solid #0006; border-radius: 4px; }}
.bar {{ height: 76px; border: 3px solid #000; border-radius: 12px; display: flex; align-items: center; gap: 10px; padding: 0 14px; box-shadow: 4px 4px 0 #000; }}
.bar span {{ flex: 1; }} .bar button {{ min-height: 44px; border: 3px solid #000; border-radius: 10px; background: #fff; padding: 0 14px; box-shadow: 3px 3px 0 #000; font: 400 14px Graduate, serif; text-transform: uppercase; letter-spacing: .03em; }}
.row {{ display: grid; grid-template-columns: 1fr 200px; gap: 12px; margin-top: 12px; }}
.area {{ height: 260px; border: 2px solid #000; border-radius: 10px; position: relative; }}
.area::after {{ content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(90deg, transparent 0 calc(var(--w) - 1px), #f00a calc(var(--w) - 1px) var(--w)),
    repeating-linear-gradient(180deg, transparent 0 calc(var(--h) - 1px), #f00a calc(var(--h) - 1px) var(--h)); }}
figure {{ margin: 0; }} figure img {{ width: 200px; border: 2px solid #000; border-radius: 8px; }} figcaption {{ font-size: 12px; color: #666; }}
</style>
{"".join(cards)}"""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)
    return out
