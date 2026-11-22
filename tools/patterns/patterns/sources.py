"""The pattern manifest (sources.json) and cached, checksummed downloads."""
import hashlib
import json
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

SUPPORTED_KINDS = {"photo", "flat", "grid", "plaid"}
USER_AGENT = "Mozilla/5.0 (compatible; pattern-tile-tool/0.1)"


@dataclass
class Source:
    file_page: str | None
    url: str | None
    author: str
    license: str
    sha256: str | None = None
    #: A user-supplied file kept in the git-ignored cache (no public URL).
    cache_file: str | None = None


@dataclass
class Entry:
    id: str
    name: str
    kind: str
    cleared: bool
    tile_width: int | None = None
    source: Source | None = None
    colors: int | None = None
    palette: list[str] | None = None
    crop: list[int] | None = None
    work_width: int | None = None
    seam_band: int | None = None
    sett: list[list] | None = None
    thread_px: int | None = None
    medians: list[int] | None = None
    min_px: int | None = None
    flatten: bool = True
    #: Tile width in CSS px in the app (the shipped file is usually 2x for sharp screens).
    display_width: int | None = None
    cells: list[int] | None = None
    cell_px: int | None = None
    coverage: float | None = None
    seed: int | None = None
    notes: str = ""
    extra: dict = field(default_factory=dict)


def load_manifest(path: Path) -> list[Entry]:
    entries = []
    for raw in json.loads(path.read_text())["patterns"]:
        raw = dict(raw)
        source = raw.pop("source", None)
        known = {k: raw.pop(k) for k in list(raw) if k in Entry.__dataclass_fields__}
        entries.append(Entry(**known, source=Source(**source) if source else None, extra=raw))
    return entries


def _download(url: str, attempts: int = 4) -> bytes:
    """GET the URL. Uses curl when installed (some image hosts throttle Python's client), else
    urllib with polite retries: honours Retry-After on 429/503, else waits 5, 10, 20 s."""
    if shutil.which("curl"):
        done = subprocess.run(
            ["curl", "-sSfL", "--retry", "3", "-A", USER_AGENT, url], capture_output=True, check=True
        )
        return done.stdout
    for attempt in range(attempts):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as err:
            if err.code not in (429, 503) or attempt == attempts - 1:
                raise
            wait = int(err.headers.get("Retry-After") or 5 * 2**attempt)
            print(f"  server busy ({err.code}); retrying in {wait} s")
            time.sleep(wait)
    raise RuntimeError("unreachable")


def fetch(entry: Entry, cache_dir: Path) -> Path:
    """Download the entry's source once into `cache_dir` and check it against its sha256."""
    if not entry.source or not (entry.source.url or entry.source.cache_file):
        raise ValueError(f"{entry.id}: no source")
    if entry.source.cache_file:
        path = cache_dir / entry.source.cache_file
        if not path.exists():
            raise FileNotFoundError(f"{entry.id}: put the user-supplied file at {path}")
    else:
        path = cache_dir / f"{entry.id}{Path(entry.source.url.split('?')[0]).suffix}"
    if not path.exists():
        cache_dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(_download(entry.source.url))
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if entry.source.sha256 and digest != entry.source.sha256:
        raise ValueError(f"{entry.id}: checksum mismatch ({digest}); the source changed")
    if not entry.source.sha256:
        print(f"  {entry.id}: record sha256 {digest} in sources.json")
    return path
