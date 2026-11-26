"""Synthetic browser timing probe. Output is diagnostic; timings depend on runner load."""
from playwright.sync_api import sync_playwright, expect
from shutil import which
from time import perf_counter

def timed(label, action):
    start = perf_counter()
    action()
    print(f"5,000-row {label}: {1000*(perf_counter()-start):.0f} ms", flush=True)

header = "site,machine,avmc,acd,adb,ecpu,ram_gb"
csv = "\n".join([header] + [f"Lab,Design,Apps,Group{i//1000},DB{i},2,4" for i in range(5000)])
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path=which("google-chrome"))
    page=browser.new_page(viewport={"width":1280,"height":900})
    page.set_default_timeout(90000)
    page.goto("http://127.0.0.1:8080/planner.html?start=quick")
    expect(page.locator("#guide-heading")).to_have_text("Allocations")
    page.locator("#guide-step-1").click()
    for selector,value in [("#location","Lab"),("#site-name","Design")]:
        page.locator(selector).fill(value)
        page.locator(selector).press("Tab")
    page.locator("#guide-step-2").click()
    page.locator("#panel-import > summary").click()
    page.locator("#csv-text").fill(csv)
    page.locator("#csv-read").click()
    timed("preview", lambda: page.locator("#csv-preview").click())
    expect(page.locator("#csv-preview-results")).to_contain_text("5000 added")
    timed("apply", lambda: page.locator("#csv-apply").click())
    page.locator("#guide-step-3").click()
    page.locator("#jump-options").click()
    for name in ["Baseline","Alternative"]:
        page.locator("#alternative-name").fill(name)
        page.locator('[data-scenario-action="capture"]').click()
    page.locator("#guide-step-2").click()
    slots=page.locator('[data-cluster][data-key="slots"]').first
    timed("edit with two saved options", lambda: slots.fill("6"))
    expect(slots).to_have_value("6")
    browser.close()
