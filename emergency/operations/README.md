# AllFactsTV Independent Streaming Control — v1.0

Location: G:\AllFactsTV-Development\Independent-Streaming-Control
GitHub backup: keenanbooker83-720/allfactstv-staging, emergency-standalone branch, emergency/operations

## What is installed
- Python 3.14: local read-only catalog audits, SHA-256 recovery snapshots, cost calculator and health reports.
- FFmpeg 9.0 / FFprobe: LOCAL HLS transcoding. One rendition at a time; no surprise uploads.
- Rclone 1.75.2: installed as independent fallback for durable transfers. NO R2 remote configured yet; needs an authorized S3-compatible R2 access key or equivalent existing secured environment. Do NOT overwrite running upload workers or duplicate credentials into scripts.
- Scheduled task: AllFactsTV-Independent-Health (15-minute recurrence, hidden, pythonw.exe). No uploads; two HTTP health reads per run. Latest status: reports\latest.json. Historical statuses: reports\history.jsonl.
- Cloudflare Pages / Workers / R2: existing services only; none created or modified by this new control system.

## Commands
Run from PowerShell (no administrator permissions necessary):
  python "G:\AllFactsTV-Development\Independent-Streaming-Control\allfacts_control.py" audit
  python "G:\AllFactsTV-Development\Independent-Streaming-Control\allfacts_control.py" health
  python "G:\AllFactsTV-Development\Independent-Streaming-Control\allfacts_control.py" snapshot
  python "G:\AllFactsTV-Development\Independent-Streaming-Control\allfacts_control.py" costs --gb 1000 --viewers 2000 --mbps 5 --hours 2

To calculate HLS processing plan WITHOUT writing files:
  python "G:\AllFactsTV-Development\Independent-Streaming-Control\allfacts_control.py" encode "G:\path\film.mp4" --film-id example-film

To ACTUALLY create local HLS output after inspection (does NOT upload or publish):
  python "G:\AllFactsTV-Development\Independent-Streaming-Control\allfacts_control.py" encode "G:\path\film.mp4" --film-id example-film --run

The output includes master.m3u8 and one or more video qualities at their original resolution or lower. A successful 5-second synthetic video self-test was completed Nov 9, 2026; outputs at hls-output\pipeline-selftest.

## Important safeguards
- Controller has NO code for publishing, charging, setting DNS, deleting films or transferring private videos publicly.
- Catalog counts show METADATA configuration, not independent existence of all R2 objects. Readiness is not proof of a successful individual rental or playback.
- Paid HLS segments must go behind a production gateway that verifies entitlements on every request (not merely on the .m3u8 URL). Publishing private HLS segments into a public Pages directory would be a security defect.
- This system never modifies existing AllFactsTV paid-films gateway catalog, Stripe, the live site, active G: importer or R2 uploader.
- Do not bulk transcode all 3,500 films until storage growth and CPU costs have been approved. Do not run multiple GPU/CPU encoders simultaneously without throughput testing.
- Rclone installation is complete but its connection is not configured; existing upload system remains active.

## Cloud cost implications
FFmpeg, Rclone, Python, local scripts: no software license charge.
R2 Standard (as of Nov 2026): 10 GB-month free, then $0.015 per GB-month. Class A/B operations beyond free allocation can be billed, and Workers, backup storage, compute and Stripe fees are separate.
Making three HLS quality renditions consumes EXTRA storage until legacy masters can be archived or removed safely.
No new billable services or bulk uploads were initiated by this project.

## Recovery procedure
1. Stop new deployments/changes, not healthy video streams.
2. Read reports\latest.json and check live gateway status.
3. Verify SHA-256 of desired snapshots\catalog-*.json using Get-FileHash -Algorithm SHA256.
4. Restore only after an explicit decision and independent backup of the current catalog, then redeploy using current production build system.
5. The separate emergency/site source on the GitHub emergency-standalone branch is a lightweight fallback, but it cannot replace private R2 media or rental gateway without separate infrastructure.

Security recommendation: keep R2 and Stripe credentials out of this repository and GitHub, use environment secrets and short-lived scoped keys, and apply least-privilege IAM.
