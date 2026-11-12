# Headless-browser check of the static app: loads it, runs add / complete / delete for tasks,
# add a note, and generate an idea. Serve the folder first: python3 -m http.server 8765 (from the repo root).
import sys, json
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/"
results = []
def check(name, cond, detail=""):
    results.append(("PASS " if cond else "FAIL ") + name + (f" ({detail})" if detail and not cond else ""))

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(BASE + "#tasks")
    page.wait_for_selector("#task-form")
    page.wait_for_timeout(400)
    check("app name from config.json", page.inner_text("#app-name") == "MyStudio", page.inner_text("#app-name"))
    check("tasks view visible on load", page.is_visible("#view-tasks") and not page.is_visible("#view-notes"))
    page.fill("#task-input", "Write the README")
    page.press("#task-input", "Enter")
    page.fill("#task-input", "Buy a notebook")
    page.press("#task-input", "Enter")
    items = page.locator("#task-list .item")
    check("add two tasks", items.count() == 2, str(items.count()))
    check("count line says 2 open", "2 open" in page.inner_text("#task-count"))
    items.nth(0).locator(".toggle").check()
    check("complete a task (checkbox)", page.locator("#task-list .item.done").count() == 1)
    check("count line says 1 open, 1 done", "1 open, 1 done" in page.inner_text("#task-count"))
    page.locator("#task-list .item").nth(1).locator(".delete").click()
    check("delete a task", page.locator("#task-list .item").count() == 1)
    stored = page.evaluate("localStorage.getItem('mystudio.tasks.v1')")
    check("tasks saved in localStorage", stored and "Buy a notebook" in stored and "Write the README" not in stored)
    page.reload(); page.wait_for_selector("#task-form")
    check("tasks still there after reload", page.locator("#task-list .item").count() == 1)
    page.screenshot(path="/tmp/mystudio-tasks.png", full_page=True)

    page.click("a[data-view=notes]")
    page.wait_for_timeout(200)
    check("notes view via tab", page.is_visible("#view-notes") and not page.is_visible("#view-tasks"))
    page.fill("#note-title", "Idea log")
    page.fill("#note-body", "Portfolio site first, then Git.")
    page.click("#note-form button[type=submit]")
    check("save a note", page.locator("#note-list .item").count() == 1)
    check("note text shown", "Portfolio site first" in page.inner_text("#note-list"))
    page.reload(); page.wait_for_selector("#note-form"); page.click("a[data-view=notes]")
    check("note survives reload", page.locator("#note-list .item").count() == 1)

    page.click("a[data-view=ideas]")
    page.wait_for_timeout(300)
    page.click("#idea-next")
    idea = page.inner_text("#idea-text")
    check("idea generator shows an idea from the list", len(idea) > 10 and idea != "Tap the button for an idea.", idea)
    check("add idea as task enabled", page.is_enabled("#idea-save"))
    page.click("#idea-save")
    page.click("a[data-view=tasks]")
    page.wait_for_timeout(200)
    check("idea added to tasks", page.locator("#task-list .item").count() == 2)
    check("no JS errors", not errors, "; ".join(errors)[:300])
    page.screenshot(path="/tmp/mystudio-ideas.png", full_page=True)
    browser.close()

print("\n".join(results))
print(f"{sum(r.startswith('PASS') for r in results)} passed, {sum(r.startswith('FAIL') for r in results)} failed")
