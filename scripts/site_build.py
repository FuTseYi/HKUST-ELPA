"""ELPA business build: render pages and canonical question data."""
import shutil
import subprocess
import sys
import re

PAGES = ("index", "guide", "practice", "sources", "submit")
PUBLIC_FILES = ("submission-config.js", "elpa_data.json")
SOURCE_FILES = tuple(page + ".html" for page in PAGES) + PUBLIC_FILES
SOURCE_DIRS = ("question-bank",)


def build(root, destination, options):
    destination.mkdir()
    homepage = (root / "index.html").read_text(encoding="utf-8")
    transition = re.search(r'<style id="navigation-transition">.*?</style>', homepage, re.S)[0]
    nav = re.search(r'<nav class="elpa-nav".*?</nav>', homepage, re.S)[0]
    footer = re.search(r'<footer class="elpa-footer".*?</footer>', homepage, re.S)[0]
    nav = nav.replace(' class="active"', '').replace(' aria-current="page"', '')
    for page in PAGES:
        selected = nav
        if page == "submit":
            selected = selected.replace('width="38" height="38"', 'width="29" height="29"')
            selected = selected.replace('<a class="elpa-nav-submit"', '<a class="elpa-nav-submit" aria-current="page"')
        else:
            link = f'<a href="./{page}.html"'
            selected = selected.replace(link, link + ' class="active" aria-current="page"')
        source = (root / f"{page}.html").read_text(encoding="utf-8")
        source = re.sub(r'<style id="navigation-transition">.*?</style>\s*', "", source, flags=re.S)
        source = source.replace("<head>", "<head>\n" + transition, 1)
        source = re.sub(r'<nav class="elpa-nav".*?</nav>', lambda _: selected, source, count=1, flags=re.S)
        source = re.sub(r'<footer class="elpa-footer".*?</footer>', lambda _: footer, source, count=1, flags=re.S)
        (destination / f"{page}.html").write_text(source, encoding="utf-8")
    for name in PUBLIC_FILES:
        shutil.copy2(root / name, destination / name)
    shutil.copytree(root / "assets", destination / "assets")
    bank = destination / "question-bank"
    bank.mkdir()
    for document in (root / "question-bank").glob("*.md"):
        shutil.copy2(document, bank / document.name)
    subprocess.run([
        sys.executable, str(root / "scripts/build-question-data.py"),
        "--input", str(root / "question-bank"), "--output", str(bank),
    ], check=True)
    return ([f"{len(PAGES)} 个页面 / pages", "题库已验证 / question data verified"], [])
