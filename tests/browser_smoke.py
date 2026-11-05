"""End-to-end checks against the portable static site using Python Playwright."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGES_PREFIX = "/HKUST-ELPA"
WIDTHS = (320, 375, 390, 430, 700, 768, 1024, 1280)


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, raw):
        path = urlsplit(raw).path
        if path.startswith(PAGES_PREFIX + "/"):
            path = path[len(PAGES_PREFIX):]
        return super().translate_path(path)

    def log_request(self, *_):
        pass


def mock_externals(page):
    page.route("https://img.shields.io/**",
               lambda route: route.fulfill(status=200, content_type="image/svg+xml",
                                           body='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'))
    page.route("https://challenges.cloudflare.com/**",
               lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
    page.route("https://hkust-elpa-submissions.futseyi.workers.dev/**",
               lambda route: route.abort())


def page_context(browser, width, scripts=True, motion="reduce"):
    context = browser.new_context(
        viewport={"width": width, "height": 844 if width < 700 else 1050},
        is_mobile=width < 600, has_touch=width < 600,
        java_script_enabled=scripts, reduced_motion=motion,
        accept_downloads=True,
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    mock_externals(page)
    return context, page, errors


def assert_layout(page, label):
    dimensions = page.evaluate(
        "({width:document.documentElement.clientWidth, full:document.documentElement.scrollWidth})"
    )
    assert dimensions["full"] <= dimensions["width"] + 2, (label, dimensions)
    assert page.locator(".elpa-nav").count() == 1, label
    assert page.locator(".elpa-footer").count() == 1, label


def check_content(browser, base, width):
    context, page, errors = page_context(browser, width)
    try:
        page.goto(base + "/index.html", wait_until="load")
        assert page.locator(".elpa-home-journey li").count() == 4
        assert page.locator(".elpa-home-feature").count() == 4
        assert page.locator(".elpa-home-help[open]").count() == 0
        assert_layout(page, "home")
        page.goto(base + "/sources.html", wait_until="load")
        assert page.locator(".elpa-resource-tag").count() == 4
        assert page.locator("#official-sources").is_visible()
        assert_layout(page, "sources")
        page.evaluate("window.__sameDocument = true")
        page.locator('.elpa-nav-links a[href="./sources.html"]').click()
        assert page.evaluate("window.__sameDocument"), "Revisiting current route should not reload"
        page.goto(base + "/guide.html", wait_until="load")
        assert page.locator("#regularGuide").is_visible()
        assert not page.locator("#fastGuide").is_visible()
        page.locator("#guideFastTab").click()
        assert page.locator("#fastGuide").is_visible()
        assert page.locator("#guideFastTab").get_attribute("aria-pressed") == "true"
        assert "track=fast-track" in page.locator("#fastGuide .elpa-guide-practice").get_attribute("href")
        page.locator("#guideRegularTab").click()
        assert page.locator("#regularGuide").is_visible()
        assert_layout(page, "guide")
        page.goto(base + "/practice.html", wait_until="load")
        page.locator("#bankD .qcard").first.wait_for(timeout=20000)
        assert page.locator("#practiceLauncher").is_visible()
        assert_layout(page, "practice")
        buttons = page.locator("#bankD .qcard").first.locator(".q-actions button").evaluate_all(
            "items => items.map(b => ({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))"
        )
        assert len(buttons) >= 2 and all(b["w"] >= 60 and b["h"] >= 32 for b in buttons)
        if width == 390:
            check_practice(page, base)
        assert not errors, (browser.browser_type.name, width, errors)
        print(f"{browser.browser_type.name}: UI passed at {width}px")
    finally:
        context.close()


def check_practice(page, base):
    note = page.locator("#bankD .qcard .qnote").first
    note.locator(".note-toggle").click()
    note.locator("textarea").fill("Regression note from Python Playwright")
    page.reload(wait_until="load")
    page.locator("#bankD .qcard").first.wait_for()
    note = page.locator("#bankD .qcard .qnote").first
    note.locator(".note-toggle").click()
    assert note.locator("textarea").input_value() == "Regression note from Python Playwright"
    page.locator("#practiceLauncher").click()
    assert page.locator("#timerPanel").is_visible()
    assert page.locator("#timerDisplay").inner_text() == "01:00"
    page.locator("#timerDrill").click()
    page.locator(".qcard.drill-active").first.wait_for(timeout=10000)
    assert not page.locator("#timerPanel").is_visible()
    page.locator("#practiceLauncher").click()
    page.locator("#timerStartPause").click()
    page.wait_for_function("!document.getElementById('timerPanel').classList.contains('show')")
    page.locator("#practiceLauncher").click()
    page.locator("#timerStartPause").click()
    page.locator("#timerReset").click()
    page.goto(base + "/submit.html?kind=advice", wait_until="load")
    page.locator("#adviceTags input").first.check()
    page.locator("#adviceTitle").fill("Python browser test")
    page.locator("#adviceBody").fill("An original preparation strategy recorded only for a local preview.")
    page.locator("#previewButton").click()
    assert page.locator("#previewPanel").is_visible()
    page.locator("#adviceBody").fill("An updated strategy recorded only for a local preview.")
    assert not page.locator("#previewPanel").is_visible()
    page.locator("#previewButton").click()
    assert "updated strategy" in page.locator("#previewPanel").inner_text()
    page.reload(wait_until="load")
    assert page.locator("#adviceTitle").input_value() == "Python browser test"
    page.goto(base + "/submit.html?question=D-1&intent=supplement", wait_until="load")
    assert page.locator("#linkedQuestion").is_visible()
    page.locator("#submissionCampus").select_option("nansha")
    assert page.locator("#linkedQuestion").is_visible()
    page.locator("#submissionCampus").select_option("clear-water-bay")
    assert not page.locator("#linkedQuestion").is_visible()


def check_navigation(browser, origin):
    for prefix in ("", PAGES_PREFIX):
        for width in (390, 1440):
            for motion in ("reduce", "no-preference"):
                context, page, errors = page_context(browser, width, motion=motion)
                try:
                    base = origin + prefix
                    page.goto(base + "/sources.html", wait_until="load")
                    assert_layout(page, "source reload")
                    page.reload(wait_until="load")
                    page.evaluate("window.__sameDocument = true")
                    for _ in range(3):
                        page.locator('.elpa-nav-links a[href="./sources.html"]').click()
                        assert page.evaluate("window.__sameDocument")
                    for name in ("guide", "sources", "practice", "sources", "index", "sources"):
                        page.locator(f'.elpa-nav-links a[href="./{name}.html"]').click()
                        page.wait_for_url("**/" + name + ".html")
                        assert_layout(page, "navigation")
                        assert page.evaluate(
                            "getComputedStyle(document.querySelector('main')).viewTransitionName === 'none'"
                        )
                    assert not errors, (prefix, width, motion, errors)
                    page.goto(base + "/guide.html", wait_until="load")
                    page.evaluate("window.__persistentShell = document.querySelector('.elpa-nav')")
                    page.evaluate("window.__persistentFooter = document.querySelector('.elpa-footer')")
                    page.locator('.elpa-nav-links a[href="./practice.html"]').click()
                    page.wait_for_url("**/practice.html")
                    page.locator("#bankD .qcard").first.wait_for(timeout=20000)
                    assert page.evaluate("""() => document.querySelector('.elpa-nav') === window.__persistentShell
                        && document.querySelector('.elpa-footer') === window.__persistentFooter""")
                    page.go_back()
                    page.wait_for_url("**/guide.html")
                    assert page.locator("#regularGuide").is_visible()
                    assert page.evaluate("document.querySelector('.elpa-nav') === window.__persistentShell")
                    page.reload(wait_until="load")
                    assert page.locator("#regularGuide").is_visible()
                    assert_layout(page, "guide reload")
                finally:
                    context.close()


def check_without_scripts(browser, origin):
    context, page, _ = page_context(browser, 390, scripts=False)
    try:
        page.goto(origin + "/index.html", wait_until="load")
        page.locator('.elpa-nav-links a[href="./sources.html"]').click()
        page.wait_for_url("**/sources.html")
        assert page.locator("#official-sources").is_visible()
    finally:
        context.close()



def check_extended_behaviors(browser, origin):
    context, page, errors = page_context(browser, 390)
    try:
        page.goto(origin + "/guide.html", wait_until="load")
        assert page.locator("#guideAdviceList article").count() == 3
        assert page.locator("#guideAdviceFilters").is_visible()
        page.locator("#adviceTagFilter").select_option("speaking-strategy")
        assert page.locator("#guideAdviceList article").count() == 2
        page.locator("#adviceTagFilter").select_option("")
        page.locator("#guideFastTab").click()
        assert page.locator("#guideAdviceList article").count() == 0
        assert not page.locator("#guideAdviceFilters").is_visible()
        assert page.locator("#guideAdviceEmpty").is_visible()
        assert "kind=advice&track=fast-track" in page.locator("#guideAdviceShare").get_attribute("href")

        page.goto(origin + "/practice.html?campus=clear-water-bay", wait_until="load")
        for track in ("regular", "fast-track"):
            page.locator(f'[data-track="{track}"]').click()
            assert page.locator("#categoryEmpty").is_visible()
            assert page.locator("#timerDrill").is_disabled()
        page.locator('[data-campus="nansha"]').click()
        assert not page.locator("#categoryEmpty").is_visible()
        assert page.locator("#timerDrill").is_enabled()
        page.locator("#searchInput").fill("no-matching-question-for-draw")
        assert page.locator("#emptyState").is_visible()
        assert page.locator("#timerDrill").is_disabled()
        page.locator("#searchClear").click()
        assert page.locator("#timerDrill").is_enabled()

        page.goto(origin + "/practice.html?track=fast-track", wait_until="load")
        page.locator("#bankD .qcard").first.wait_for()
        questions = page.locator("#bankD .q-title > .en,#bankPast .q-title > .en").all_text_contents()
        assert questions
        page.locator("#searchInput").fill("no-matching-question-for-export")
        page.locator("#recordsMenuBtn").click()
        with page.expect_download() as download:
            page.locator("#recordsExportBtn").click()
        markdown = Path(download.value.path()).read_text(encoding="utf-8")
        import re
        exported = [re.sub(r"^### \d+\. ", "", line) for line in markdown.splitlines()
                    if re.match(r"^### \d+\. ", line)]
        assert exported == questions, "Markdown export must preserve the displayed question order"

        page.goto(origin + "/submit.html?question=D-1&intent=supplement", wait_until="load")
        page.locator("#submissionCampus").select_option("nansha")
        page.locator("#submissionSlot").select_option(index=1)
        page.locator("#supplementEn").fill("Draft-only alternative wording")
        page.locator("#addFollowup").click()
        page.locator('#followupList [data-lang="en"]').first.fill("First draft follow-up")
        page.locator("#addFollowup").click()
        page.locator('#followupList [data-lang="en"]').last.fill("Second draft follow-up")
        page.locator("#tabAdvice").click()
        page.locator("#adviceTags input").first.check()
        page.locator("#adviceTitle").fill("Recoverable advice draft")
        page.locator("#adviceBody").fill("Recoverable advice text from an isolated local browser test.")
        page.reload(wait_until="load")
        assert page.locator("#tabAdvice").get_attribute("aria-pressed") == "true"
        assert page.locator("#adviceTitle").input_value() == "Recoverable advice draft"
        page.locator("#tabQuestion").click()
        assert page.locator("#supplementEn").input_value() == "Draft-only alternative wording"
        assert page.locator('#followupList [data-lang="en"]').count() == 2
        assert not errors, (browser.browser_type.name, errors)
        print(f"{browser.browser_type.name}: advice, export, draft and empty-category regressions passed")
    finally:
        context.close()


def main():
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(Handler, directory=str(ROOT / "_site"))
    )
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as playwright:
            for engine in (playwright.chromium, playwright.webkit):
                browser = engine.launch(headless=True)
                try:
                    for width in WIDTHS:
                        check_content(browser, origin, width)
                    check_navigation(browser, origin)
                    check_without_scripts(browser, origin)
                    check_extended_behaviors(browser, origin)
                finally:
                    browser.close()
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


if __name__ == "__main__":
    main()
