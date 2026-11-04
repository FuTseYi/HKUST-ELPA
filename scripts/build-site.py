#!/usr/bin/env python3
"""Build a portable static ELPA site from reviewed JSON and source assets."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
PAGES = ("index", "guide", "practice", "sources", "submit")
PUBLIC_FILES = ("submission-config.js", "elpa_data.json")


def build(destination: Path) -> None:
    destination = destination.resolve()
    if destination == ROOT or ROOT in destination.parents and destination.name == "assets":
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
        if destination.exists():
            if not destination.is_dir():
                raise ValueError(f"Output is not a directory: {destination}")
            shutil.rmtree(destination)
        shutil.move(str(staged), str(destination))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "output" / "site")
    args = parser.parse_args()
    build(args.output)


if __name__ == "__main__":
    main()
