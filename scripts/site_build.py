"""Build ELPA from three HTML entrypoints with homepage-owned information views."""
import re
import shutil
import subprocess
import sys

PAGES = ("index", "guide", "practice", "sources", "submit")
SOURCE_FILES = ("index.html", "practice.html", "submit.html")
SOURCE_DIRS = ("question-bank", "data")
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
    clean_homepage, count = re.subn(
        r'\s*<template data-page="(?:guide|sources)">[\s\S]*?</template>',
        '', homepage,
    )
    if count != len(CONTENT_PAGES):
        raise ValueError("Expected one content template per information page")
    for page in PAGES:
        if page in CONTENT_PAGES:
            title, description, scripts = CONTENT_PAGES[page]
            fragment = re.search(
                r'<template data-page="' + page + r'">\s*(<main id="main">[\s\S]*?</main>)\s*</template>',
                homepage,
            )
            if not fragment:
                raise ValueError("Missing information page in homepage: " + page)
            html = replace_once(clean_homepage, r'<main id="main">[\s\S]*?</main>', fragment.group(1))
            html = replace_once(html, r'<title>.*?</title>', '<title>' + title + '</title>')
            html = replace_once(html, r'<meta name="description" content="[^"]*">',
                                '<meta name="description" content="' + description + '">')
            html = re.sub(r'<link rel="(?:preload|prefetch)"[^>]*>\s*', '', html)
            html = html.replace('class="elpa-body elpa-home"', 'class="elpa-body"', 1)
            tags = '\n'.join('<script src="' + name + '"></script>' for name in scripts)
            html = html.replace('<script src="./assets/js/index.js"></script>', tags, 1)
        else:
            html = clean_homepage if page == "index" else (root / (page + ".html")).read_text(encoding="utf-8")
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
