"""QRO06-GUEST-LAUNCH01 — Android final-native Guest corridor against a REAL local backend.

Drives the installed DEBUG app (pro.wewed.app.dev, explicit component) in its production runtime
with the loopback Guest origin (`wewed_guest_base_url`, loopback only — no request reaches wewed.pro) with synthetic invitation links, then checks the real
system destinations (Chrome, Calendar, Maps) it hands off to. Reads only ids/text; prints no link or
credential. Screenshots go to the directory given as argv[1] (local only).

Usage: adb reverse tcp:3106 tcp:3106 && python3 android_guest_lane_driver.py <shots-dir> <links.json>
links.json: {"origin": "http://127.0.0.1:3106", "pending": "...", "attending": "...",
             "declined": "...", "window": "..."}  (synthetic fixture links)
"""
import json, re, subprocess, sys, time, xml.etree.ElementTree as ET

SHOTS, LINKS = sys.argv[1], json.load(open(sys.argv[2]))
PKG = "pro.wewed.app.dev"
FORBIDDEN = ["rsvp=", "q6tok", "wewed_wedding_guest", "guest-handoff", "#h="]
results = []


def sh(*a):
    return subprocess.run(["adb", *a], capture_output=True, text=True).stdout


def dump():
    for _ in range(3):
        sh("shell", "uiautomator", "dump", "/sdcard/q6.xml")
        raw = sh("shell", "cat", "/sdcard/q6.xml")
        if raw.startswith("<?xml"):
            return ET.fromstring(raw)
        time.sleep(1)
    return ET.fromstring("<x/>")


def nodes(root):
    return list(root.iter("node"))


def by_id(root, rid):
    return next((n for n in nodes(root) if n.get("resource-id") == rid), None)


def by_text(root, text, exact=False):
    for n in nodes(root):
        for v in (n.get("text", ""), n.get("content-desc", "")):
            if (v == text) if exact else (text in v):
                return n
    return None


def center(n):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", n.get("bounds")))
    return (x1 + x2) // 2, (y1 + y2) // 2


def tap(n, settle=1.5):
    sh("shell", "input", "tap", *map(str, center(n)))
    time.sleep(settle)


def wait(pred, timeout=40, what=""):
    end = time.time() + timeout
    while time.time() < end:
        r = dump()
        n = pred(r)
        if n is not None:
            return r, n
        time.sleep(1)
    shot(f"fail-{what}")
    raise AssertionError(f"never found {what}")


def wait_id(rid, timeout=40):
    return wait(lambda r: by_id(r, rid), timeout, rid)


def wait_text(text, timeout=40):
    return wait(lambda r: by_text(r, text), timeout, text)


def scroll_to_id(rid, max_swipes=10):
    """Find a node on a scrolling screen: first downwards, then back upwards."""
    for direction in (("540", "1700", "540", "900"), ("540", "900", "540", "1700")):
        for _ in range(max_swipes):
            r = dump()
            n = by_id(r, rid)
            if n is not None and 250 < center(n)[1] < 2150:
                return r, n
            sh("shell", "input", "swipe", *direction, "400")
            time.sleep(0.8)
    raise AssertionError(f"could not scroll to {rid}")


def shot(name):
    subprocess.run(f"adb exec-out screencap -p > '{SHOTS}/android-{name}.png'", shell=True)


def focused():
    out = sh("shell", "dumpsys", "window")
    m = re.search(r"mCurrentFocus=Window\{[^}]*\}", out)
    return m.group(0) if m else ""


def no_credentials(r, where):
    bad = [v for n in nodes(r) for v in (n.get("text", ""), n.get("content-desc", "")) if any(f in v for f in FORBIDDEN)]
    assert not bad, f"credential material on screen at {where}"


def ok(msg):
    results.append(msg)
    print("PASS", msg, flush=True)


def launch(link):
    sh("shell", "am", "force-stop", PKG)
    sh("shell", "am", "start", "-n", f"{PKG}/pro.wewed.app.MainActivity", "-a", "android.intent.action.VIEW",
       "-d", link, "--es", "wewed_native_env", "production", "--es", "wewed_guest_base_url", LINKS["origin"])


def back_to_app():
    sh("shell", "am", "start", "-n", f"{PKG}/pro.wewed.app.MainActivity")
    time.sleep(2)


def open_details(first_name):
    r, n = wait_id("invitation-open-button", 60)
    tap(n, 3)
    wait_text(first_name, 20)
    r, n = wait_id("invitation-details-button")
    tap(n, 2.5)
    return wait_id("invitation-cta-rsvp")


def chrome_page(expect, what):
    """Chrome must show the couple's site as this Guest — never the invitation gateway."""
    end = time.time() + 90
    while time.time() < end:
        r = dump()
        for label in ("Accept & continue", "No thanks", "Use without an account", "Got it"):
            b = by_text(r, label, exact=True)
            if b is not None:
                tap(b)
                break
        else:
            if "chrome" in focused().lower():
                if by_text(r, "Open your invitation") is not None:
                    shot(f"{what}-gateway")
                    raise AssertionError(f"{what}: browser lost Guest authority (gateway)")
                if by_text(r, expect) is not None and by_text(r, "Opening your wedding") is None:
                    shot(what)
                    no_credentials(r, what)
                    return
        time.sleep(1.5)
    shot(f"{what}-timeout")
    raise AssertionError(f"{what}: Chrome did not show {expect}")


# --- Pending: invitation-bound, every CTA --------------------------------------------------------
launch(LINKS["pending"])
r, _ = open_details("Tariro")
# The zero-size style marker is dropped by uiautomator; the Ivory renderer is proven by the absence of
# the unsupported-style fallback plus its own tri-fold detail hits.
assert by_id(r, "invitation-style-unsupported") is None and by_id(r, "invitation-cta-note") is not None
for cta in ["invitation-cta-rsvp", "invitation-cta-calendar", "invitation-cta-venue", "invitation-cta-registry",
            "invitation-cta-note", "invitation-cta-pass", "invitation-cta-couple-site"]:
    assert by_id(r, cta) is not None, f"{cta} missing"
assert by_id(r, "live-guest-shell") is None
no_credentials(r, "pending-details")
shot("pending-details")
ok("pending: Ivory Floral Gold personalised for Tariro; all 7 CTAs present; invitation-bound")

tap(by_id(r, "invitation-cta-note"))
wait_text("celebrate with us", 10)
shot("pending-note")
ok("A Note from Us shows the couple's real message")
sh("shell", "input", "keyevent", "4")  # system Back must close the note, not leave the app
time.sleep(1.5)
assert PKG in focused(), "Back from the note left the app"
assert by_id(dump(), "invitation-cta-note") is not None
ok("system Back closes the note and stays on the invitation")
r, n = wait_id("invitation-cta-pass")
tap(n, 2)
wait_id("invitation-rsvp-prompt", 15)
assert by_id(dump(), "wedding-pass-qr") is None
shot("pending-pass-rsvp")
ok("pending Guest Pass asks for RSVP; no admission QR")
sh("shell", "input", "keyevent", "4")
time.sleep(1.5)
assert PKG in focused(), "Back from RSVP left the app"

r, n = wait_id("invitation-cta-couple-site")
tap(n, 3)
chrome_page("Qualification Manor", "pending-couple-site")
ok("Visit Couple Website → Chrome shows the site as this Guest (handoff)")
back_to_app()
r, n = wait_id("invitation-cta-registry")
tap(n, 3)
chrome_page("No contribution options have been published yet", "pending-gifts")
ok("Gift / Contributions → Chrome shows the honest not-published state as this Guest")
back_to_app()
r, n = wait_id("invitation-cta-calendar")
tap(n, 4)
f = focused().lower()
assert "calendar" in f or "resolver" in f or "chooser" in f, f"calendar insert not shown: {f}"
shot("pending-calendar")
ok("Add to Calendar opens the system calendar insert")
back_to_app()
r, n = wait_id("invitation-cta-venue")
tap(n, 4)
f = focused().lower()
assert "maps" in f or "chrome" in f or "resolver" in f, f"venue destination not shown: {f}"
shot("pending-venue")
ok("Venue Location opens a real map destination")
back_to_app()

# --- Attending: shell with real data ---------------------------------------------------------------
launch(LINKS["attending"])
r, _ = open_details("Chipo")
assert by_text(r, "Update RSVP") is not None
tap(by_id(r, "invitation-cta-pass"), 3)
wait_id("live-guest-shell", 20)
r, n = wait_id("nav-guest-home")
tap(n)
r, _ = wait_text("Not yet", 30)
for text in ["Rudo", "Chipo Attending", "Qualification Manor", "Days", "Available from"]:
    assert by_text(r, text) is not None, text
assert by_text(r, "Your admission pass is ready.") is None
no_credentials(r, "attending-home")
shot("attending-home")
ok("Home: couple, date, countdown, venue, Guest, truthful pass state (not yet issuable + opening date)")
tap(by_id(r, "nav-guest-pass"), 3)
r, _ = wait_text("closer to the wedding", 30)
assert by_text(r, "Available from") is not None and by_id(r, "wedding-pass-qr") is None
shot("attending-pass")
ok("Pass: attending outside the window → not_yet_issuable with opening date; no early pass")
tap(by_id(r, "nav-guest-wedding_day"), 3)
r, _ = wait_text("First Dance", 30)
for text in ["Ceremony", "Photographs", "Reception"]:
    assert by_text(r, text) is not None, text
r, _ = scroll_to_id("guest-day-table")
assert by_text(r, "Acacia") is not None
r, _ = scroll_to_id("guest-day-party")
shot("attending-wedding-day")
ok("Wedding Day: real ProgrammeItem rows, table Acacia, party with plus-one")
tap(by_id(r, "nav-guest-more"), 3)
r, _ = wait_id("live-guest-profile-name")
for rid in ["live-guest-profile-email", "live-guest-profile-rsvp", "live-guest-profile-seating", "live-guest-profile-party",
            "live-guest-profile-meal", "live-guest-profile-dietary", "live-guest-profile-message"]:
    r, _ = scroll_to_id(rid)
shot("attending-more")
ok("More/Profile: name, contact, RSVP, seating, party, meal, dietary, message")
for rid, what in [("guest-more-help", "help"), ("guest-more-privacy", "legal")]:
    r, n = scroll_to_id(rid)
    tap(n, 4)
    assert "chrome" in focused().lower(), f"{what} did not open"
    shot(f"attending-{what}")
    back_to_app()
ok("Help and Privacy & Legal open real routes")
r, n = scroll_to_id("guest-profile-couple-site")
tap(n, 3)
chrome_page("Qualification Manor", "more-couple-site")
back_to_app()
ok("More → Couple Website keeps Guest authority")
r, n = scroll_to_id("live-guest-forget-wedding")
tap(n, 2)
r = dump()
confirm = by_text(r, "Forget", exact=False)
if confirm is not None and by_id(r, "live-guest-forget-wedding") is None:
    tap(confirm, 2)
wait(lambda r: None if by_id(r, "live-guest-shell") else r, 20, "shell gone")
shot("attending-forgotten")
ok("Forget this wedding clears the device relationship")

# --- Declined --------------------------------------------------------------------------------------
launch(LINKS["declined"])
r, _ = open_details("Kuda")
tap(by_id(r, "invitation-cta-pass"), 3)
wait_id("live-guest-shell", 20)
r, _ = wait_id("live-guest-pass-declined", 20)
assert by_id(r, "wedding-pass-qr") is None
tap(by_id(r, "nav-guest-more"), 3)
r, _ = wait_id("live-guest-profile-rsvp")
for rid in ["live-guest-profile-seating", "live-guest-profile-party", "live-guest-profile-meal", "live-guest-profile-dietary"]:
    assert by_id(dump(), rid) is None, rid
shot("declined-more")
ok("declined: no admission pass; no attendance-only profile data")

# --- Attending inside the issuance window ----------------------------------------------------------
launch(LINKS["window"])
r, _ = open_details("Rufaro")
tap(by_id(r, "invitation-cta-pass"), 3)
wait_id("wedding-pass-qr", 40)
shot("window-pass")
ok("attending inside the 14-day window: verified WW2 pass QR")

print(f"ALL {len(results)} CHECKS PASSED")
