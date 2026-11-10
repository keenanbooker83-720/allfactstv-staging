# ALL FACTS TV — EMERGENCY INDEPENDENT FRAMEWORK

**Build:** 1.0.0 · November 9, 2026

This is a **standalone emergency copy of the website mechanism**, not a copy of every movie. The initial product manifest is deliberately empty because the full AllFactsTV catalog is not yet verified and imported. It can be edited, previewed, backed up, and independently deployed without Roku, Amazon Fire TV, Apple TV, Google TV, WordPress, npm, React, a proprietary site builder, or the live AllFactsTV desktop uploader.

## What is included

- `site/index.html` — independent responsive website shell (deep black + electric green FACTS branding)
- `site/assets/app.js` — subject filters, search, optional poster images, previews, free playback, More details, verified purchase gating
- `site/assets/style.css` — compact styling for desktop, foldables, and phones
- `site/assets/icon.svg` — standalone app icon
- `site/data/catalog.json` — **canonical emergency content manifest** (empty at first; no invented listings)
- `site/sw.js` — caches the **shell + manifest only**; never caches paid movies, full masters, user identity, session tokens, or payment data
- `site/health.json` — static shell marker; not a real-time stream readiness test
- `control.py` — local standard-library Python command-line manager
- `example-import.csv` — header template for batch importing actual verified titles
- `tests/test_control.py` — validation and payment-safety unit tests

## Run right now (without deploying)

From inside the `emergency` folder:

```bash
python control.py validate
python control.py status
python control.py build
python -m http.server 8787 --directory site
```

Open `http://127.0.0.1:8787`. Python 3.9+ is sufficient for every command. A local web server is needed because browsers often restrict `fetch()` of local `file://` JSON.

`python control.py build` makes a self-contained `dist/` folder and writes `release.json` with SHA-256 checksums and exact counts. Copy `dist/` to **any static web host** or place it behind your own web server. No Cloudflare integration is required to display the shell.

## Populate later, without rebuilding the framework

Add actual films to `site/data/catalog.json` or fill `example-import.csv`, then run:

```bash
python control.py import-csv example-import.csv
python control.py validate
python control.py snapshot
python control.py build
```

CSV import **does not replace existing matching IDs by default**. Use `--replace` only if a specific record needs to be revised. Before an import changes anything, it validates the *entire proposed manifest* and creates a snapshot of the prior manifest. Never put private storage keys, source secrets, or user data into the public manifest.

### Product schema

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-09",
  "products": [
    {
      "id": "example-verified-free-film",
      "title": "A Verified Film Title",
      "type": "free",
      "category": "Science & Technology",
      "scholar": "Presenter",
      "synopsis": "Verified description.",
      "posterUrl": "https://images.example.org/poster.jpg",
      "freeVideoUrl": "https://media.example.org/video.mp4",
      "backupFreeVideoUrl": "https://second-host.example.org/video.mp4"
    }
  ]
}
```

This is an **illustration of the schema, not a claim the sample film exists or is available**. Sample records are not loaded into the shipped manifest.

For paid records use `type:"paid"`, `previewUrl`, `backupPreviewUrl`, `purchaseUrl`, `checkoutReady`, `independentPlaybackReady`, and `verifiedAt`. **Do not set both booleans true until a live paid purchase, webhook/session verification, and playback entitlement have been tested end-to-end on the independent replacement**. `purchaseUrl` must be a legitimate Stripe-hosted link. No checkout appears unless all the checks pass. This package never serves private paid master movies and never bypasses entitlement checks.

## Backups and restores

```bash
python control.py snapshot
python control.py restore snapshots/catalog-YYYYMMDDTHHMMSSZ.json
python control.py restore snapshots/catalog-YYYYMMDDTHHMMSSZ.json --apply
```

The first `restore` performs a dry run. Applying a restore snapshots the current catalog first. Version-control the **whole** `emergency/` directory (except generated `dist/` and sensitive files) independently of production. For disaster recovery, keep an additional copy of the zip and the catalog snapshot on a second machine or separate provider.

## Planned activation, not automatic cutover

1. Deploy this static `dist/` to a *different* host/project such as `backup.<your-domain>` or an independent third-party static host. Keep the regular `allfactstv.com` route untouched until explicitly choosing a failover.
2. Import **verified existing product metadata**, not a guessed count. Confirm links, posters, and playable previews individually. Avoid duplicate records, fake checkout buttons, and dead URL placeholders.
3. Mirror authorized public/free media to a second provider for genuine storage redundancy. R2 alone does **not** protect against a Cloudflare-wide outage.
4. For independent paid streaming, provision a separate **server-side** authorization and entitlements gateway, webhook signature verification, short-lived playback access, verified backups of protected masters, and real checkout tests. Do not put Stripe secret keys or private R2 URLs in the static catalog. Until then, the emergency shell can show previews/free films but cannot safely replace paid stream entitlements.
5. Do a smoke test on mobile and desktop, then deliberately move the alternate domain or DNS/CNAME if an actual emergency occurs. DNS changes and production site takeover are not part of this package.

**Control boundary:** Source updates can be made via the connected GitHub repository if access is available. Hosting, DNS changes, secret provisioning and media transfers still require authenticated access to the chosen provider. This is independent of Roku/Amazon application development; it is **not independent of the physical web host or video storage provider**.

## Deployment options

- **Anywhere:** Upload the contents of `dist/` to any standards-compliant static host; the web server must serve `index.html`, JSON with `application/json`, JS with a JS MIME type and SVG. No special build command.
- **Cloudflare Pages separate project:** GitHub integration can deploy a branch or separate repository. Set root to `emergency/site` if using this layout; no build command, output directory `emergency/site` when repo root is used. Be careful: Pages preview and production branch controls are separate. For a truly independent disaster recovery route, prefer a second provider as well.
- **Direct control:** Modify `emergency/site/data/catalog.json` in GitHub, then deploy an independently hosted static site or run the shell locally. This does not require access to the Roku/Amazon codebases.

## Safety and operational limits

- No embedded API credentials or tokens.
- No private media file links or signed URL storage in public metadata.
- No autoplay of hidden/paid masters; optional full-screen HTML5 player only for public/free media and public previews.
- No live checkout until explicit independent entitlement verification.
- No false master verification: `health.json` means only that shell files are present.
- Offline service worker stores public application shell and public catalog metadata, **not** videos or payments.
- This package does not launch, buy, publish, transfer films, or change DNS by itself.