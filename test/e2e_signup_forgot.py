#!/usr/bin/env python3
"""Cover the signup + forgot pages: assert their inline JS emits the
canonical /v1/iam/signup and /v1/iam/send-verification-code (and the
social buttons emit /v1/iam/oauth/authorize), with no /api/ leakage."""
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787"
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond))); print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  -- {detail}" if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    seen = []
    page.on("request", lambda r: seen.append((r.method, urlparse(r.url).path)))
    st = {"signup": None, "authorize": None, "verif": None}
    def h_signup(route):
        st["signup"] = urlparse(route.request.url)
        route.fulfill(status=200, content_type="application/json", body='{"status":"error","msg":"e2e"}')
    def h_authorize(route):
        st["authorize"] = urlparse(route.request.url)
        route.fulfill(status=200, content_type="text/plain", body="e2e")
    def h_verif(route):
        st["verif"] = urlparse(route.request.url)
        route.fulfill(status=200, content_type="application/json", body='{"status":"ok"}')
    page.route("**/v1/iam/signup*", h_signup)
    page.route("**/oauth/authorize*", h_authorize)
    page.route("**/v1/iam/send-verification-code*", h_verif)

    # ---- signup page ----
    print("\n=== SIGNUP page ===")
    page.goto(f"{BASE}/signup?client_id=hanzo-app-client-id&redirect_uri={BASE}/callback", wait_until="domcontentloaded")
    check("signup page renders", "Create" in page.content())
    page.fill("#name", "E2E User")
    page.fill("#contact", "e2e@example.com")
    page.fill("#password", "supersecret8")
    page.click("#submitBtn")
    page.wait_for_timeout(1500)
    su = st["signup"]
    check("signup POST hit /v1/iam/signup", su and su.path == "/v1/iam/signup", f"path={su.path}" if su else "none")
    # signup social
    page.click("#btn-github")
    page.wait_for_timeout(1000)
    az = st["authorize"]
    check("signup Github -> /v1/iam/oauth/authorize", az and az.path == "/v1/iam/oauth/authorize", f"path={az.path}" if az else "none")

    # ---- forgot page ----
    print("\n=== FORGET page ===")
    st["authorize"] = None
    page.goto(f"{BASE}/forget?client_id=hanzo-app-client-id&redirect_uri={BASE}/callback", wait_until="domcontentloaded")
    check("forget page renders", "Reset" in page.content())
    page.fill("#email", "e2e@example.com")
    page.click("#submitBtn")
    page.wait_for_timeout(1500)
    vf = st["verif"]
    check("forget POST hit /v1/iam/send-verification-code", vf and vf.path == "/v1/iam/send-verification-code", f"path={vf.path}" if vf else "none")

    # session-wide leakage
    api_leaks = [f"{m} {pa}" for (m, pa) in seen if pa.startswith("/api/")]
    bare = [pa for (m, pa) in seen if pa == "/oauth/authorize"]
    check("zero /api/* across signup+forget", len(api_leaks) == 0, ", ".join(api_leaks) if api_leaks else "clean")
    check("zero bare /oauth/authorize", len(bare) == 0, ", ".join(bare) if bare else "clean")
    browser.close()

passed = sum(1 for _n, ok in results if ok)
print(f"\n  {passed}/{len(results)} checks passed (signup+forget)")
sys.exit(0 if passed == len(results) else 1)
