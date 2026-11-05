"""ELPA pages: one authoritative shell and separate content-only pages."""
import re
import shutil
import subprocess
import sys

PAGES = ("index", "guide", "practice", "sources", "submit")
SOURCE_FILES = ("index.html", "practice.html", "submit.html")
SOURCE_DIRS = ("question-bank", "content/pages", "data")
CONTENT_PAGES = {
    "guide": ("考试与备考指南｜HKUST-ELPA",
              "HKUST-ELPA 非官方口语考试指南：常规 ELPA 与 Fast Track 流程、备考经验和练习入口。",
              ("./question-bank/taxonomy.js", "./question-bank/advice.js", "./assets/js/guide.js")),
    "sources": ("资料来源｜HKUST-ELPA",
                "HKUST-ELPA 非官方题目来源、资料说明与维护入口。", ()),
}


def replace_once(html, pattern, replacement):
    updated, count = re.subn(pattern, lambda _: replacement, html, count=1, flags=re.S)
    if count != 1:
        raise ValueError("Unexpected HTML structure: " + pattern)
    return updated


def navigation(nav, page):
    nav = nav.replace(' class="active"', '').replace(' aria-current="page"', '')
    if page == "submit":
        return (nav.replace('width="38" height="38"', 'width="29" height="29"')
                .replace('<a class="elpa-nav-submit"',
                         '<a class="elpa-nav-submit" aria-current="page"'))
    target = f'<a href="./{page}.html"'
    if target not in nav:
        raise ValueError("Missing navigation target: " + page)
    return nav.replace(target, target + ' class="active" aria-current="page"')


def build(root, destination, options):
    destination.mkdir()
    homepage = (root / "index.html").read_text(encoding="utf-8")
    nav = re.search(r'<nav class="elpa-nav"[\s\S]*?</nav>', homepage)
    footer = re.search(r'<footer class="elpa-footer"[\s\S]*?</footer>', homepage)
    if not nav or not footer:
        raise ValueError("Homepage must define navigation and footer")
    for page in PAGES:
        if page in CONTENT_PAGES:
            title, description, scripts = CONTENT_PAGES[page]
            content = (root / "content/pages" / (page + ".html")).read_text(encoding="utf-8").strip()
            if not content.startswith('<main id="main">') or not content.endswith("</main>"):
                raise ValueError("Invalid page content: " + page)
            html = replace_once(homepage, r'<main id="main">[\s\S]*?</main>', content)
            html = replace_once(html, r'<title>.*?</title>', '<title>' + title + '</title>')
            html = replace_once(html, r'<meta name="description" content="[^"]*">',
                                '<meta name="description" content="' + description + '">')
            html = re.sub(r'<link rel="(?:preload|prefetch)"[^>]*>\s*', '', html)
            html = html.replace('class="elpa-body elpa-home"', 'class="elpa-body"', 1)
            tags = '\n'.join('<script src="' + name + '"></script>' for name in scripts)
            html = html.replace('<script src="./assets/js/index.js"></script>', tags, 1)
        else:
            html = (root / (page + ".html")).read_text(encoding="utf-8")
        if page != "index":
            html = replace_once(html, r'<nav class="elpa-nav"[\s\S]*?</nav>|<!-- shared-nav -->',
                                navigation(nav.group(0), page))
            html = replace_once(html, r'<footer class="elpa-footer"[\s\S]*?</footer>|<!-- shared-footer -->',
                                footer.group(0))
        (destination / (page + ".html")).write_text(html, encoding="utf-8")
    for name in ("submission-config.js", "elpa_data.json"):
        shutil.copy2(root / "data" / name, destination / name)
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
