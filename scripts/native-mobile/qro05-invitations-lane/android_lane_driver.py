"""QRO05 Android final-native lane driver: real installed pro.wewed.app.dev, explicit component,
production_preview lane against the local backend. Reads only ids/text; never prints link values."""
import re, subprocess, sys, time, xml.etree.ElementTree as ET
SP = sys.argv[1]
def sh(*a): return subprocess.run(["adb", *a], capture_output=True, text=True).stdout
def dump():
    sh("shell", "uiautomator", "dump", "/sdcard/qro05.xml")
    return ET.fromstring(sh("shell", "cat", "/sdcard/qro05.xml") or "<x/>")
def nodes(root): return list(root.iter("node"))
def find(root, rid=None, text=None):
    for n in nodes(root):
        if rid and n.get("resource-id") == rid: return n
        if text and n.get("text") == text: return n
def center(n):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", n.get("bounds")))
    return (x1 + x2) // 2, (y1 + y2) // 2
def tap(n): sh("shell", "input", "tap", *map(str, center(n))); time.sleep(1.2)
def wait(rid=None, text=None, timeout=40):
    end = time.time() + timeout
    while time.time() < end:
        r = dump(); n = find(r, rid, text)
        if n is not None: return r, n
        time.sleep(1)
    raise SystemExit(f"FAIL: never found {rid or text}")
def scroll_to(rid, max_swipes=12):
    for _ in range(max_swipes):
        r = dump(); n = find(r, rid)
        if n is not None:
            _, y = center(n)
            if 480 < y < 2100: return r, n
        sh("shell", "input", "swipe", "540", "1700", "540", "900", "400"); time.sleep(0.8)
    raise SystemExit(f"FAIL: could not scroll to {rid}")
def shot(name): subprocess.run(f"adb exec-out screencap -p > {SP}/android-{name}.png", shell=True)
def all_labels(r): return [v for n in nodes(r) for v in (n.get("text", ""), n.get("content-desc", "")) if v]
FORBIDDEN = ["http://", "https://", "rsvp=", "e2e-token", "127.0.0.1"]
def no_links(r, where):
    bad = [l for l in all_labels(r) if any(f in l for f in FORBIDDEN)]
    assert not bad, f"FAIL: link material on screen at {where} ({len(bad)} labels)"
checks = []
def ok(msg): checks.append(msg); print("PASS", msg)

sh("shell", "am", "force-stop", "pro.wewed.app.dev")
sh("shell", "am", "start", "-n", "pro.wewed.app.dev/pro.wewed.app.MainActivity",
   "--es", "wewed_native_env", "production_preview", "--es", "wewed_preview_origin", "http://127.0.0.1:3105")
end = time.time() + 90
while time.time() < end:
    r = dump()
    if find(r, "nav-planner-more") is not None: break
    grant = find(r, "grant-option-planner:wedding:e2e-wedding")
    if grant is not None: tap(grant); continue
    if find(r, "sign-in-email") is not None:
        tap(find(r, "sign-in-email")); sh("shell", "input", "text", "qro05-planner@example.test")
        tap(find(dump(), "sign-in-password")); sh("shell", "input", "text", "qro05-local-only")
        sh("shell", "input", "keyevent", "111"); time.sleep(0.5)
        tap(find(dump(), "sign-in-submit")); time.sleep(3); continue
    w = find(r, "welcome-sign-in")
    if w is not None: tap(w); continue
    time.sleep(1)
r, n = wait("nav-planner-more"); tap(n); ok("signed in through production_preview; Planner shell")
r, n = wait("planner-more-section-invitations-qr"); tap(n)
r, n = wait("planner-invitation-style", timeout=60)
assert "does not load them yet" not in " ".join(all_labels(r)), "FAIL: placeholder shown"
assert find(r, text="Ivory Floral Gold") is not None, "FAIL: style label"; ok("Invitation design: Ivory Floral Gold")
shot("design"); no_links(r, "design")
r, n = scroll_to("planner-physical-invitation-qr")
assert n.get("content-desc") == "Printed invitation QR code"; ok("printed QR uses planner-physical-invitation-qr")
r, _ = scroll_to("planner-physical-invitation-status")
st = find(r, "planner-physical-invitation-status").get("text")
assert st.startswith("Configured") and "6 guests listed" in st and "11 opens" in st, "FAIL: status"; ok("printed invitation configured · 6 listed · 11 opens")
assert find(r, "wedding-pass-qr") is None; ok("no wedding-pass-qr")
shot("printed"); no_links(r, "printed")
for gid, label in [("e2e-g1", "Attending"), ("e2e-g3", "Declined"), ("e2e-g4", "Awaiting reply")]:
    r, _ = scroll_to(f"planner-guest-invitation-status-{gid}")
    assert find(r, f"planner-guest-invitation-status-{gid}").get("text") == label, f"FAIL: {gid}"
ok("guest rows: Attending / Declined / Awaiting reply")
r, _ = scroll_to("planner-guest-invitation-missing-e2e-g6"); ok("unlinked guest shows no QR/share")
assert find(r, "planner-guest-invitation-show-qr-e2e-g6") is None
shot("guests"); no_links(r, "guests")
r, n = scroll_to("planner-guest-invitation-show-qr-e2e-g2"); tap(n)
# The dialog is its own window (outside the activity's testTagsAsResourceId root): match by the
# QR's content description and the visible name.
end = time.time() + 20
while time.time() < end:
    r = dump(); qr = [x for x in nodes(r) if x.get("content-desc") == "Invitation QR code for Bongani Attending"]
    if qr: break
    time.sleep(1)
assert qr, "FAIL: guest invitation QR not shown"
assert find(r, text="Bongani Attending") is not None
assert find(r, "wedding-pass-qr") is None and not [x for x in nodes(r) if x.get("content-desc") == "Wedding pass QR code"]
ok("Show QR shows Bongani's own invitation QR, never a Wedding Pass"); shot("guest-qr"); no_links(r, "guest-qr")
tap(find(r, text="Done"))
r, n = scroll_to("planner-guest-invitation-share-e2e-g2"); tap(n); time.sleep(2)
focus = sh("shell", "dumpsys", "window") 
cur = re.search(r"mCurrentFocus=Window\{[^}]*\}", focus)
assert cur and ("chooser" in cur.group(0).lower() or "ResolverActivity" in cur.group(0) or "intentresolver" in cur.group(0).lower()), f"FAIL: share chooser not focused: {cur.group(0) if cur else None}"
ok("Share Invitation opened the system ACTION_SEND chooser"); shot("share")
sh("shell", "input", "keyevent", "4"); time.sleep(1.5)
r = dump(); assert find(r, "planner-invitation-style") is not None or find(r, "planner-guest-invitation-share-e2e-g2") is not None
ok("returned to Invitations & QR after dismissing the chooser")
print(f"ALL {len(checks)} CHECKS PASSED")
