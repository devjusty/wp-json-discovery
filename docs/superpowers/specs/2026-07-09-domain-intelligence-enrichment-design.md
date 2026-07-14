# Domain Intelligence Enrichment Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free-first intelligence layer that helps users learn more about a domain, its IPs, and its likely owner/stack using passive lookups plus a small set of light probes. WordPress signals stay first-class, but the feature must still work for non-WordPress sites.

**Architecture:** Keep current scan flow as the entry point and add a new enrichment phase that runs after the main `/wp-json/` discovery. The enrichment phase should collect DNS, RDAP, TLS, and low-risk HTTP signals, merge them into a normalized `intelligence` payload, and persist that payload with the scan record. Use public/free APIs only. Prefer Node built-ins and existing dependencies before adding packages.

**Tech Stack:** Express 5, React 19, Turso/libSQL, existing scan service, Node built-ins (`dns/promises`, `tls`, `http`, `https`, `net`, `crypto`), existing `cheerio`, public RDAP/CT/DNS APIs.

---

## Scope

This feature adds three related capabilities:

1. Domain-level intelligence
   - Registration and ownership hints.
   - DNS and mail infrastructure.
   - TLS certificate and certificate-history hints.
   - Hosting/CDN/ASN hints.

2. IP-level intelligence
   - Reverse DNS, ASN, and hosting hints for resolved IPs.
   - Shared infrastructure grouping across domains.

3. WordPress and site-exposure enrichment
   - Additional low-risk probes that refine CMS, auth, and exposure detection.
   - Existing homepage, sitemap, security-header, and REST signals stay intact.

Out of scope for v1:

- Port scanning.
- Authenticated probing.
- Brute-force subdomain enumeration.
- Paid enrichment APIs.
- Any action that mutates the target site.

---

## Signal Strategy

### 1) Passive lookups first

Use non-invasive lookups that do not touch the target origin when possible:

- DNS resolution via `dns/promises`.
- RDAP lookups for registrant, registrar, and network owner hints.
- TLS handshake metadata for the live certificate.
- Certificate Transparency history via `crt.sh`.
- IP-to-ASN lookup via Team Cymru DNS service.
- Public DNS-over-HTTPS fallback only if local resolution fails.

### 2) Light probes second

Use a tiny set of safe HTTP requests at low concurrency:

- `GET /wp-json/` and current WordPress probes already shipped.
- `GET` or `HEAD` for `/.well-known/security.txt`, `/security.txt`, `/robots.txt`, `/sitemap.xml`, `/favicon.ico`.
- `OPTIONS /` for allowed method hints.
- `GET /xmlrpc.php` and `GET /wp-login.php` only for presence checks, not login attempts.

### 3) WordPress priority, generic fallback

- If WordPress is detected, prioritize REST, XML-RPC, oEmbed, and plugin/theme-related signals.
- If WordPress is not detected, keep generic ownership/infra/enrichment signals and skip WP-only probes that would add noise.

---

## Free Tools, Packages, and APIs

### Built-in Node modules

- `dns/promises` for `A`, `AAAA`, `CNAME`, `MX`, `NS`, `TXT`, and reverse lookups.
- `tls` for live certificate handshake metadata.
- `net` for IP classification helpers.
- `http` / `https` for direct low-level probes when `fetch` is not enough.
- `crypto` for cache keys and normalized fingerprints.

### Existing app dependencies

- `cheerio` for HTML parsing and `security.txt` / homepage evidence extraction.
- Existing proxy/fetch helpers for same-host HTTP requests and redirect tracking.
- Existing security-header parser for homepage posture summaries.

### Free public APIs

- `RDAP`:
  - `https://rdap.org/domain/<domain>` for domain registration data.
  - `https://rdap.org/ip/<ip>` for IP registration/network ownership.
- `crt.sh`:
  - `https://crt.sh/?q=%25.<domain>&output=json` for certificate transparency history.
- DNS-over-HTTPS fallback:
  - Cloudflare or Google DNS-over-HTTPS only when local resolution is unavailable.
- Team Cymru IP-to-ASN:
  - DNS-based ASN lookup for resolved IPs.

### Optional future free packages

- None required for v1.
- If later needed, add only a narrowly scoped helper package after proving a gap in built-ins.

---

## Data Model

Persist a single normalized enrichment object per scan so the UI can render a stable structure and the database can re-use it later.

### `intelligence` payload

- `domain`
- `resolvedIps[]`
- `dns`
  - `a`, `aaaa`, `cname`, `mx`, `ns`, `txt`, `soa`
- `rdap`
  - `domainRegistration`
  - `ipRegistration`
- `tls`
  - `subject`
  - `issuer`
  - `san[]`
  - `validFrom`
  - `validTo`
- `asn`
  - `asn`
  - `org`
  - `country`
- `ct`
  - `certCount`
  - `wildcards[]`
  - `firstSeen`
  - `lastSeen`
- `probes`
  - `robots`
  - `sitemap`
  - `securityTxt`
  - `favicon`
  - `methods`
- `wordpress`
  - `detected`
  - `signals[]`
  - `exposure[]`
- `evidence[]`
  - each item includes `source`, `label`, `value`, and `confidence`

### Storage

- Save the payload with scan history so past scans stay reproducible.
- Cache lookup results by normalized domain and IP to avoid repeated public lookups.
- Use TTL-based cache rows for CT/RDAP/DNS results that do not need to be re-fetched on every scan.

---

## UX

Add an `Intelligence` section to scan results with four compact panels:

1. Ownership and registration
   - registrar, RDAP contacts, creation/expiry, nameserver org clues.

2. Network and hosting
   - resolved IPs, ASN, reverse DNS, CDN/WAF hints.

3. TLS and trust surface
   - issuer, SANs, validity, CT history, security.txt.

4. WordPress and exposure
   - REST routes, XML-RPC, login surface, sitemap/robots, headers.

Each panel should show a short summary plus expandable evidence rows.

---

## Request Policy

Allowed:

- DNS resolution.
- RDAP and CT queries.
- TLS handshake metadata.
- Same-origin GET/HEAD/OPTIONS requests.
- Existing WordPress REST and homepage probes.

Not allowed:

- Port sweeps.
- Credential stuffing.
- Login attempts.
- Exploit payloads.
- Deep crawling beyond current sitemap/homepage workflow.

Rate policy:

- Keep third-party public API calls serialized or lightly concurrent.
- Cache successful lookups.
- Fail soft on lookup errors so the main scan still completes.

---

## Error Handling

- If RDAP or CT fails, continue with DNS and HTTP evidence.
- If DNS resolution fails, continue with HTTP-only and homepage signals.
- If TLS handshake fails, record the failure and keep the rest of the scan.
- If a probe returns HTML where JSON was expected, store the evidence and mark the signal low-confidence.
- All enrichment failures must be visible in the UI as warnings, not hard scan failures.

---

## Testing

### Backend

- Unit tests for DNS normalization, RDAP parsing, CT parsing, and IP/ASN classification.
- Integration tests for the enrichment phase returning a normalized payload when one or more lookups fail.
- Mock public endpoints with fixtures; do not hit live APIs in automated tests.

### Frontend

- Render tests for the new `Intelligence` panels and evidence expansion.
- Snapshot-style assertions for the compact summary cards and fallback states.

### Regression checks

- Existing scan tests must still pass unchanged.
- Existing homepage and security-header surfaces must not regress.

---

## Acceptance Criteria

- A scan returns domain intelligence for both WordPress and non-WordPress targets.
- A scan can show IP-level and registration-level evidence without paid services.
- The feature uses free/public APIs and built-in Node modules first.
- The scan still completes when an enrichment source fails.
- The UI exposes concise ownership, hosting, TLS, and exposure summaries.
- The database persists enrichment data for later review and reuse.

---

## Recommended v1 Sequence

1. Implement passive DNS/RDAP/TLS/CT enrichment.
2. Persist the normalized `intelligence` payload with scan history.
3. Add the `Intelligence` UI section.
4. Add light probes for `security.txt`, `robots.txt`, `sitemap.xml`, `favicon.ico`, and `OPTIONS /`.
5. Add WordPress-specific exposure hints where the site is clearly WordPress.
6. Add cache TTLs and reuse logic for repeated lookups.
