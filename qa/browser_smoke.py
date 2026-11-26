"""Run against a local checkout served at http://127.0.0.1:8080."""
from pathlib import Path
from shutil import which
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:8080"

def exercise(browser, width, folder):
    context = browser.new_context(viewport={"width": width, "height": 900}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE)
    expect(page.get_by_role("heading", name="Where are you starting?")).to_be_visible()
    expect(page.locator('.entry-paths a')).to_have_count(2)
    if width == 320:
        page.locator("#theme-toggle").click()
    Path("qa-artifacts").mkdir(exist_ok=True)
    page.screenshot(path=f"qa-artifacts/home-{width}.png")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.locator('.entry-paths a[href$="start=quick"]').click()
    expect(page.locator("#guide-heading")).to_have_text("Allocations")
    page.locator("#add-cluster").click()
    expect(page.locator("#dock-free")).to_have_text("3,805 GB")

    if width <= 760:
        expect(page.locator("#dock-cpu-metric")).to_be_hidden()
        page.locator("#dock-toggle").click()
        expect(page.locator("#dock-cpu-metric")).to_be_visible()
        page.locator("#dock-toggle").click()
    page.locator("#guide-step-4").click()
    decision = page.locator("#decision-result")
    expect(decision).to_contain_text("enough local storage for this layout")
    expect(decision).to_contain_text("CPU and memory allocations")
    expect(decision).to_contain_text("shared database storage")
    page.locator("#review-device-save").click()
    expect(page.locator("#review-device-status")).to_contain_text("Saved on this device")
    expect(page.locator("#plan-device-status")).to_contain_text("Saved on this device")
    Path("qa-artifacts").mkdir(exist_ok=True)
    decision.screenshot(path=f"qa-artifacts/verdict-{width}.png")
    decision.get_by_text("View calculation", exact=True).click()
    expect(decision.locator("tfoot")).to_contain_text("3,805")
    decision.get_by_text("How AVMC storage is calculated", exact=True).click()
    expect(decision).to_contain_text("289 GB fixed + 51.5 GB for 1 reserved ACD slot = 340.5 GB")
    decision.get_by_text("How AVMC storage is calculated", exact=True).click()
    if width < 600:
        expect(decision.locator("tbody .trace-field").first).to_be_visible()
        assert decision.locator(".table-wrap").evaluate("el => el.scrollWidth <= el.clientWidth + 1")
    expect(decision.locator("tbody tr")).to_have_count(2)
    expect(decision.locator("tbody tr").first).to_contain_text("1,902.5")
    Path("qa-artifacts").mkdir(exist_ok=True)
    decision.screenshot(path=f"qa-artifacts/review-{width}.png")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.locator("#guide-step-1").click()
    page.locator("#other-allocations > summary").click()
    other=page.locator('[data-node="0"][data-key="otherLocal"]')
    other.fill("2000")
    page.locator("#guide-step-4").click()
    expect(decision.locator("h3")).to_contain_text("DB server 1 is short by 97.5 GB")
    expect(decision).to_contain_text("1,805 GB")
    page.locator("#guide-step-1").click()
    other.fill("0")
    page.locator("#guide-step-3").click()
    page.get_by_role("button", name="Compare saved designs", exact=True).click()
    page.locator("#alternative-name").fill("Separate groups")
    page.locator('[data-scenario-action="capture"]').click()
    expect(page.locator("#scenario-comparison")).to_contain_text("3,805 GB free")
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
    # Exercise the workload route and the explicit shared-storage result.
    page.goto(BASE + "/planner.html?start=workload")
    expect(page.locator("#guide-heading")).to_have_text("Machine")
    page.locator("#guide-step-2").click()
    page.locator("#add-cluster").click()
    page.locator('[data-requirement][data-key="ecpu"]').fill("32")
    page.locator('[data-requirement][data-key="ramGB"]').fill("128")
    page.locator("#guide-step-3").click()
    page.locator("#suggest-sizing").click()
    expect(page.locator("#sizing-results")).to_contain_text("Smallest DB-server configuration that fits")
    expect(page.locator("#sizing-results")).to_contain_text("Shared database storage: not checked")
    Path("qa-artifacts").mkdir(exist_ok=True)
    choice = page.locator(".fit-choice button")
    expect(choice).to_be_visible()
    choice.scroll_into_view_if_needed()
    page.screenshot(path=f"qa-artifacts/db-server-fit-{width}.png")
    choice.click()
    expect(page.locator("#guide-heading")).to_have_text("Review")
    assert not errors, errors
    context.close()

with TemporaryDirectory() as folder, sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=which("google-chrome"))
    for width in (320, 390, 1280):
        exercise(browser, width, folder)
    browser.close()
