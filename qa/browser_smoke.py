"""Run against a local checkout served at http://127.0.0.1:8080."""
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:8080"

def exercise(browser, width, folder):
    context = browser.new_context(viewport={"width": width, "height": 900}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.get_by_role("link", name="Check local capacity", exact=True).click()
    expect(page.locator("#guide-heading")).to_have_text("Allocations")
    page.locator("#add-cluster").click()
    expect(page.locator("#dock-free")).to_have_text("3,805 GB")

    page.locator("#guide-step-3").click()
    page.locator("#panel-scenarios > summary").click()
    page.locator("#alternative-name").fill("Separate groups")
    page.locator('[data-scenario-action="capture"]').click()
    page.locator("#decision-note").fill("Confirm the switchover group before deployment.")
    with page.expect_download() as received:
        page.locator("#compare-export").click()
    report = Path(folder) / "comparison.html"
    received.value.save_as(report)
    text = report.read_text()
    assert "Separate groups" in text and "Confirm the switchover group" in text
    assert "Local storage by server" in text and "<script" not in text.lower()

    page.locator("#plan-save-device").click()
    expect(page.locator("#plan-device-status")).to_contain_text("Saved on this device")
    page.locator("#plan-menu > summary").click()
    with page.expect_download() as backup:
        page.locator("#save").click()
    file = Path(folder) / "plan.json"
    backup.value.save_as(file)
    page.locator("#backup-confirm-button").click()
    page.reload()
    expect(page.locator("#plan-library")).to_be_visible()
    page.locator('[data-plan-action="open"]').click()
    expect(page.locator("#dock-free")).to_have_text("3,805 GB")
    page.locator("#import").set_input_files(file)
    expect(page.locator("#message")).to_contain_text("Opened the JSON plan")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert not errors, errors
    context.close()

with TemporaryDirectory() as folder, sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    for width in (390, 1280):
        exercise(browser, width, folder)
    browser.close()
