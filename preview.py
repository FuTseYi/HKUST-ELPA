#!/usr/bin/env python3
"""Build and locally preview the portable ELPA website."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
import time
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

SITE_LOCK = threading.RLock()


class PreviewHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        with SITE_LOCK:
            super().do_GET()

    def do_HEAD(self):
        with SITE_LOCK:
            super().do_HEAD()


ROOT = Path(__file__).resolve().parent
PAGES = ("index", "guide", "practice", "sources", "submit")
PUBLIC_FILES = ("submission-config.js", "elpa_data.json")


def build(destination: Path) -> None:
    destination = destination.resolve()
    generated_root = ROOT / "output"
    if destination == ROOT or (ROOT in destination.parents and
                               destination != generated_root and
                               generated_root not in destination.parents):
        raise ValueError("Refusing to replace source files")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".elpa-build-", dir=destination.parent) as temporary:
        staged = Path(temporary) / "site"
        staged.mkdir()
        for page in PAGES:
            shutil.copy2(ROOT / f"{page}.html", staged / f"{page}.html")
        for filename in PUBLIC_FILES:
            shutil.copy2(ROOT / filename, staged / filename)
        shutil.copytree(ROOT / "assets", staged / "assets")
        # Keep source reference documents available at their existing static URLs.
        bank = staged / "question-bank"
        bank.mkdir()
        for document in (ROOT / "question-bank").glob("*.md"):
            shutil.copy2(document, bank / document.name)
        subprocess.run([
            sys.executable, str(ROOT / "scripts" / "build-question-data.py"),
            "--input", str(ROOT / "question-bank"),
            "--output", str(bank),
        ], check=True)
        with SITE_LOCK:
            previous = Path(temporary) / "previous"
            if destination.exists():
                if not destination.is_dir():
                    raise ValueError(f"Output is not a directory: {destination}")
                destination.rename(previous)
            try:
                staged.rename(destination)
            except OSError:
                if previous.exists():
                    previous.rename(destination)
                raise


SITE = ROOT / "output" / "site"


def source_state():
    """Include source content and code; exclude generated output and dependencies."""
    sources = [ROOT / f"{page}.html" for page in PAGES]
    sources.extend(ROOT / name for name in PUBLIC_FILES)
    for directory in ("assets", "question-bank"):
        sources.extend((ROOT / directory).rglob("*"))
    sources.append(ROOT / "scripts" / "build-question-data.py")
    state = []
    for file in sources:
        if file.is_file():
            stat = file.stat()
            state.append((str(file), stat.st_mtime_ns, stat.st_size))
    return tuple(sorted(state))


def preview(port: int):
    """Serve the production build and rebuild after source edits."""
    build(SITE)
    server = ThreadingHTTPServer(("127.0.0.1", port),
                                 partial(PreviewHandler, directory=str(SITE)))
    print(f"ELPA preview: http://127.0.0.1:{port}/", flush=True)
    print("Saving a source file rebuilds the site; refresh the browser.", flush=True)
    previous = source_state()
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        while True:
            time.sleep(1)
            current = source_state()
            if current == previous:
                continue
            try:
                build(SITE)
            except (OSError, ValueError, subprocess.CalledProcessError) as error:
                print(f"Build failed; check source and save again: {error}", file=sys.stderr, flush=True)
            else:
                print("ELPA preview rebuilt.", flush=True)
            previous = current
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        server.server_close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-only", action="store_true", help="Build without serving")
    parser.add_argument("--output", type=Path, default=SITE, help="Build destination")
    parser.add_argument("--port", type=int, default=8765, help="Local server port")
    args = parser.parse_args()
    if args.build_only:
        build(args.output)
    elif args.output.resolve() != SITE.resolve():
        parser.error("--output requires --build-only")
    else:
        preview(args.port)


if __name__ == "__main__":
    main()
