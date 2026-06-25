#!/usr/bin/env python3
"""
E2E proof for the /api/* -> /v1/iam/* canonical-path migration (id-worker).

Runs against the real worker.js executed under workerd (`wrangler dev`,
local mode) — never production. Per brand, via Playwright network
interception, it asserts the branded login page emits ONLY canonical
/v1/iam/* IAM calls:

  1. login page renders (brand-specific <title>)
  2. password form POSTs to  /v1/iam/login            (exact path asserted)
  3. Google social button navigates to
       /v1/iam/oauth/authorize?...&provider=provider-google
  4. across the WHOLE session, NO request path is /api/* or bare /oauth/authorize

The brand under test is selected by the worker's IAM_DEFAULT_ORG var
(set per `wrangler dev` invocation); the localhost host has no tenant
catalog entry so it falls back to that default.

Usage:  python3 e2e_canonical_paths.py <base-url> <brand>
"""
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787"
BRAND = sys.argv[2] if len(sys.argv) > 2 else "hanzo"
BRAND_TITLE = {"hanzo": "Hanzo", "lux": "Lux", "zoo": "Zoo", "pars": "Pars"}.get(BRAND, "Hanzo")

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  -- {detail}" if detail else ""))

def is_canonical_login(p): return p == "/v1/iam/login"
def is_canonical_authorize(p): return p == "/v1/iam/oauth/authorize"
def is_legacy_api(p): return p.startswith("/api/")
def is_bare_authorize(p): return p == "/oauth/authorize"

client_id = f"{BRAND}-app-client-id"
redirect_uri = f"{BASE}/callback"
login_url = (
    f"{BASE}/login?client_id={client_id}"
    f"&redirect_uri={redirect_uri}"
    f"&response_type=code&scope=openid+profile+email&state=e2e&prompt=login"
)

print(f"\n=== BRAND: {BRAND} ({BRAND_TITLE}) @ {BASE} ===")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    seen = []  # every request the browser issues
    page.on("request", lambda req: seen.append((req.method, urlparse(req.url).path, req.url)))

    state = {"login_req": None, "legacy_login": False, "authorize_req": None, "bare_authorize": False}

    # Intercept canonical login: assert path, fulfill locally (no real auth).
    def handle_login(route):
        state["login_req"] = urlparse(route.request.url)
        route.fulfill(status=200, content_type="application/json",
                      body='{"status":"error","msg":"e2e-intercepted"}')
    page.route("**/v1/iam/login*", handle_login)

    # Legacy login must NOT fire.
    def handle_legacy_login(route):
        state["legacy_login"] = True
        route.fulfill(status=200, content_type="application/json",
                      body='{"status":"error","msg":"LEGACY"}')
    page.route("**/api/login*", handle_legacy_login)

    # (1) render
    page.goto(login_url, wait_until="domcontentloaded")
    title = page.title()
    content = page.content()
    check("login page renders", "Sign In" in title or "Sign in" in content, f'title="{title}"')
    check(f"brand pane is {BRAND_TITLE}", BRAND_TITLE in title or BRAND_TITLE in content, f'title="{title}"')

    # (2) password form -> /v1/iam/login
    page.fill("#email", "e2e@example.com")
    page.fill("#password", "not-a-real-password")
    page.click("#submitBtn")
    page.wait_for_timeout(1500)
    lr = state["login_req"]
    check("password POST hit /v1/iam/login", lr and is_canonical_login(lr.path),
          f"path={lr.path}" if lr else "no /v1/iam/login observed")
    check("password POST did NOT hit /api/login", not state["legacy_login"])

    # (3) Google social button -> /v1/iam/oauth/authorize?...&provider=provider-google
    def handle_authorize(route):
        pa = urlparse(route.request.url)
        if pa.path == "/v1/iam/oauth/authorize":
            state["authorize_req"] = pa
        if is_bare_authorize(pa.path):
            state["bare_authorize"] = True
        route.fulfill(status=200, content_type="text/plain", body="e2e")
    # One glob matches both /oauth/authorize and /v1/iam/oauth/authorize; classify inside.
    page.route("**/oauth/authorize*", handle_authorize)

    page.click("#btn-google")
    page.wait_for_timeout(1500)
    ar = state["authorize_req"]
    qs = {}
    if ar:
        from urllib.parse import parse_qs
        qs = parse_qs(ar.query)
    check("Google button -> /v1/iam/oauth/authorize", ar and is_canonical_authorize(ar.path),
          f"path={ar.path}" if ar else "no authorize observed")
    check("authorize carries provider=provider-google",
          ar and qs.get("provider", [""])[0] == "provider-google",
          f'provider={qs.get("provider", [""])[0]}' if ar else "")
    check("did NOT hit bare /oauth/authorize", not state["bare_authorize"])

    # (4) session-wide leakage assertions
    api_leaks = [f"{m} {pa}" for (m, pa, _u) in seen if is_legacy_api(pa)]
    bare_leaks = [pa for (m, pa, _u) in seen if is_bare_authorize(pa)]
    check("zero /api/* requests across session", len(api_leaks) == 0,
          ", ".join(api_leaks) if api_leaks else "clean")
    check("zero bare /oauth/authorize across session", len(bare_leaks) == 0,
          ", ".join(bare_leaks) if bare_leaks else "clean")

    browser.close()

passed = sum(1 for _n, ok in results if ok)
print(f"\n  {passed}/{len(results)} checks passed for brand={BRAND}")
failed = [n for n, ok in results if not ok]
if failed:
    print("  FAILURES: " + "; ".join(failed))
    sys.exit(1)
sys.exit(0)
