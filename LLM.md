# hanzo.id-worker — LLM.md

## What this is

Cloudflare Worker that fronts the identity domains at the CF edge:

    hanzo.id/*   lux.id/*   pars.id/*
    iam.lux.network/*   id.lux.network/*   id.zoo.network/*

(`wrangler.toml` `routes`). DNS for each is CF-proxied (orange cloud); the worker
runs at the edge and does THREE distinct jobs:

1. **Branded login UI** — serves inline HTML for `/`, `/login`, `/signup`,
   `/forget` (two-pane, per-org branding from `ORG_BRANDS` + `IAM_TENANT_CONFIG_JSON`),
   with client-side JS that calls the IAM JSON front door.
2. **IAM backend proxy** — proxies `/v1/iam/*`, `/oauth/*`, `/.well-known/*`,
   `/cas/*`, `/scim/*`, `/static/*`, `/img/*` to the origin `IAM_ORIGIN`
   (`https://iam.hanzo.ai`), rewriting the public host onto the issuer
   (`Host`/`X-Forwarded-Host` = the public host; `iam.hanzo.ai` → `hanzo.id`
   in discovery bodies + `Location`s).
3. **Edge glue + OAuth brokers** — CORS/security headers, `id.zoo.ngo → zoo.id`
   301, marketing passthrough (`hanzo-id.pages.dev`), and hand-rolled OAuth
   brokers for platform/mpc (`/oauth/hanzo/{platform,mpc}` → `/callback/…`) and a
   direct GitHub-repo-scope OAuth for platform (`/oauth/github/platform`).

## Retirement status — Task #61 (AUDIT phase, deploy-gated)

This worker is **legacy**. Its three jobs are being split back to the K8s-native
stack (one way, no CF worker in the auth path — global rule: `hanzoai/ingress`
only):

| Worker job | K8s-native owner | State |
|---|---|---|
| 1. Branded login UI | **`id` SPA** — `ghcr.io/hanzoai/id` (operator CR `crs/id.yaml`, tag `0.2.7`; ingress `k8s/id/ingress.yaml` already claims hanzo.id/lux.id/pars.id/id.*.network). Uses `@hanzo/iam` SDK; calls `get-app-login` + `/v1/iam/login` + `/v1/iam/oauth/*` + `/v1/iam/signup`. | Deployed |
| 2. IAM backend | **iam2** — `hanzoai/iam2` v0.14.0, embedded in `hanzoai/cloud` via `server.Mount` (MIGRATION.md Phase-4 shadow-embed). Serves the full RFC OIDC surface + the HIP-0111 front door, host-relative issuer. | Embedded, **not yet deployed** |
| 3. Edge glue | **`hanzoai/ingress`** (CORS/redirect/routing) + SDK migration for the platform/mpc brokers. | Partial |

**DO NOT delete this worker or change live DNS/ingress/CF config yet** — iam2 is
not deployed, so deleting the worker now breaks hanzo.id login in production. This
file records the audit result + the cutover plan; the flip is gated on the iam2
deploy.

## Coverage matrix — worker capability → replacement

### Backend login logic (the "port into iam2" target) — FULLY COVERED by iam2 v0.14.0

| Worker capability | iam2 endpoint | Status |
|---|---|---|
| `GET /v1/iam/get-app-login` (source of truth for app+organization; secret-masked; providers enriched) | `getAppLogin` @ `/v1/iam/get-app-login` (`internal/oidc/frontdoor.go`) — `Application` schema carries `name`/`owner`/`organization`/`enable*`/providers | **Covered** |
| `POST /v1/iam/login` password (worker adds `signinMethod`/`language` — ignored harmlessly; SDK uses `type=code`) | `loginHandler` @ `/v1/iam/login` (`internal/oidc/login.go`): bcrypt+argon2id verify from the row, `type=code` mints a PKCE-bound code | **Covered** |
| `POST /v1/iam/signup` | `signupHandler` @ `/v1/iam/signup` (lands user in the app's existing org — MIGRATION.md §4 seam, not a shortcut) | **Covered** |
| `POST /v1/iam/send-verification-code` (forgot-password) | `sendVerificationCode` @ same path (multipart/form-data; OTP persisted, delivery owned by `hanzoai/notify` — §4 seam) | **Covered** |
| `POST /v1/iam/oauth/token` | `tokenHandler` — code+PKCE / refresh / client_credentials / password / RFC 8693 token-exchange | **Covered** |
| `GET /v1/iam/oauth/userinfo` | `userinfoHandler` (carries the get-account claim shape) | **Covered** |
| `POST /v1/iam/oauth/introspect` (RFC 7662) | `introspectHandler` | **Covered** |
| `POST /v1/iam/oauth/revoke` (RFC 7009) | `revokeHandler` | **Covered** |
| `GET/POST /v1/iam/oauth/logout`; worker `/logout` → `/v1/iam/logout` | `logoutHandler` @ `/v1/iam/oauth/logout` (canonical path) | **Covered** |
| `GET /.well-known/openid-configuration` + `/oauth-authorization-server` + JWKS | `Discovery` + `jwksHandler` at both root and `/v1/iam/` paths, **host-relative iss** (worker's `iam.hanzo.ai→hanzo.id` rewrite becomes unnecessary) | **Covered** |
| `GET /v1/iam/oauth/authorize` (validate → serve/deleg login) | `authorizeHandler`: validates client_id + exact redirect_uri, then 302s to `/login/oauth/authorize` (the `id` SPA) | **Covered** |
| `GET /v1/iam/get-provider` (vestigial in worker) | superseded — `get-app-login` enriches providers, `auth/methods` lists sign-in methods | **Covered (superseded)** |

### UI + branding — moves to the `id` SPA (NOT iam2's job)

`/` portal, `/login`, `/signup`, `/forget`, the `/oauth/authorize` &
`/login/oauth/authorize` login-page render, per-org branding, `/logo` H SVG →
all served by `ghcr.io/hanzoai/id` (multi-tenant via `id-tenant-catalog`
ConfigMap). iam2's `authorizeHandler` already delegates here.

### Edge glue — moves to `hanzoai/ingress` (NOT iam2's job)

Backend proxy + host/iss rewrite (dissolves once iam2 *is* the origin serving
host-relative iss), CORS preflight + allowed-origin reflection + HSTS/XCTO/XFO,
`id.zoo.ngo → zoo.id` 301, marketing passthrough.

### Dropped / migrated per HIP-0111 (NOT ported to iam2)

| Worker capability | Disposition |
|---|---|
| Bare `/oauth/{authorize,token,introspect,revoke,userinfo,logout}` aliases (for CLI clients) | **Drop.** HIP-0111 forbids legacy `/oauth/*`; the one canonical path is `/v1/iam/oauth/*`. CLI clients read the discovery doc (which advertises the canonical paths). |
| `/oauth/hanzo/platform` + `/callback/platform/hanzo` (IAM broker → `access_token`/`refresh_token`/`expires_at`/`provider=hanzo`/`status=200` in the query to `platform.hanzo.ai/login`) | **Migrate, don't port.** This is hand-rolled OAuth (tokens in query) — explicitly forbidden by HIP-0111. platform.hanzo.ai must use the standard `@hanzo/iam` SDK authorize→token (code+PKCE) against `/v1/iam/oauth/*`. |
| `/oauth/hanzo/mpc` + `/callback/mpc/hanzo` | Same — migrate mpc.hanzo.ai to the SDK. |
| `/oauth/github/platform` + `/callback/platform/github` (direct GitHub OAuth for `repo`/`admin:repo_hook` scopes) | **Not an IAM login** — this mints Git-provider tokens for platform's repo integration. Belongs in platform's own Git-provider connector, not iam2. |

### The one genuine functional gap — social provider login (pre-cutover blocker)

The worker's `/callback` handler + provider-aware `/v1/iam/oauth/authorize?provider=…`
hand a Google/GitHub OAuth **code** to the (Casdoor) backend's `/v1/iam/login`
for IdP-federation. **iam2 has no IdP-federation broker**: `login.go` is
credential-only; provider records exist for rendering buttons (`get-app-login`,
`auth/methods`) and for showing linked identities (`linked-accounts`), but nothing
exchanges an external provider's code. This is **outside MIGRATION.md's
cutover-gating front-door residual** and is a large, security-sensitive surface
(iam2 as an OIDC RP to external IdPs) — not an audit-phase patch, and not something
to bolt into the auth path hastily.

**Decision required before flipping social login off the worker:** either (a)
implement standard OIDC federation in iam2 (authorize `provider` hint → RP
round-trip → auto-provision/link → mint code) with its own tests + security
review, or (b) keep social sign-in pointed at the legacy IAM backend until (a)
lands, and cut over only email/username + web3 first. Password, code, token,
signup, forgot, and web3 login do NOT depend on this.

## Audit conclusion

**iam2 v0.14.0 already covers the entire login *backend* the worker proxies** —
no iam2 code change is warranted in this phase (verified: `GOWORK=off
CGO_ENABLED=0 go build ./... && go test ./...` green on `main`@`16fda7d`,
tag `v0.14.0`; front-door + OIDC surface complete per MIGRATION.md §2.1/§4).
The worker's other two jobs are already owned by the `id` SPA (UI) and
`hanzoai/ingress` (edge); the platform/mpc brokers are HIP-0111-forbidden and
must be migrated to the SDK, not ported. The worker just needs the deploy-gated
cutover below.

## Cutover plan (ordered — each step reversible)

**Pre-flight (no prod change):**
1. Deploy `cloud` with iam2 embedded, **shadow-first** (own prefix, e.g.
   `/v2-iam`, alongside live Casdoor — MIGRATION.md Phase 4). Seed config from the
   same `init_data.json`. Confirm iam2 serves `get-app-login` + `login` + token +
   discovery against the real seeded orgs/apps.
2. Import the user rows (password hashes verify as-is — argon2id golden vector,
   MIGRATION.md §5). Verify a real account logs in against shadow iam2.
3. Confirm the `id` SPA (`ghcr.io/hanzoai/id`) renders `/login`,`/signup`,`/forget`
   for each brand and that its `@hanzo/iam` config points at the iam2 issuer.
   Playwright the two-pane flow end-to-end against shadow iam2 (email/username,
   web3). **Do NOT rely on HTTP-status checks — drive the visual flow.**

**Backend flip (iam.hanzo.ai):**
4. Flip iam2 from the shadow prefix onto the canonical `/v1/iam/*` (+ root
   `/.well-known/*`) in `cloud`; retire the Casdoor `iam` mount. iam2 stamps
   host-relative `iss`, so the worker's `iam.hanzo.ai→hanzo.id` body/Location
   rewrites are already moot. Rollback = revert the cloud image tag.

**Migrate the forbidden brokers (parallelizable, gate the front-door flip):**
5. platform.hanzo.ai → `@hanzo/iam` SDK (code+PKCE against `/v1/iam/oauth/*`);
   remove its dependence on `/oauth/hanzo/platform` + `/callback/platform/hanzo`.
6. mpc.hanzo.ai → same; remove `/oauth/hanzo/mpc` + `/callback/mpc/hanzo`.
7. Move `/oauth/github/platform` (Git-provider repo tokens) into platform's own
   Git connector.
8. Decide the social-login path (gap above): implement iam2 OIDC federation, or
   scope the first flip to non-social methods.

**Front-door flip (hanzo.id + brand .id domains):**
9. Repoint each identity host off the CF worker to the K8s `id` ingress: remove
   the host from `wrangler.toml` `routes` (or set the CF record to DNS-only /
   grey-cloud so traffic reaches the ingress LB). Do this **one host at a time**
   (start with a low-traffic brand, e.g. `pars.id`), verifying login end-to-end
   after each before proceeding to `hanzo.id`.
10. Ensure `hanzoai/ingress` carries the residual edge policy the worker did:
    CORS allowed-origin reflection for cross-origin app callers, HSTS/XCTO/XFO,
    and the `id.zoo.ngo → zoo.id` 301.

**Decommission:**
11. After every host is served by `id` + iam2 with login green (and social
    resolved), delete the worker: `wrangler delete` the `hanzo-id` worker and
    remove `~/work/hanzo/hanzo.id-worker`. Keep the CF DNS records (now pointing
    at the ingress). Rollback before this step = re-add the worker route.

## CF-worker gotchas (why this can't be a naive proxy)

- **Never send `Content-Length: 0` on a GET** through the worker — the CF runtime
  500s. (Worker proxy paths pass the request through without forcing a body.)
- CF silently overrides the outbound `Host` header to the fetch target, so the
  worker sets `X-Forwarded-Host` too — iam2 reads that (`getEffectiveHost`) to
  stamp the issuer. Once iam2 serves the host directly, this is unnecessary.
- IAM serves a `200 text/html` SPA catch-all for unknown paths (HIP-0111): a wrong
  proxy path is silent breakage, not a 404 — verify by content, not status.

## Build & run (worker — legacy)

    npm install
    npx wrangler dev            # local
    npx wrangler deploy         # DO NOT run during the deploy-gate freeze
