# AllFactsTV / Amazon Vega — Integration Preparation

**Status:** Reference code downloaded and AllFactsTV catalog integration created; not a compiled or submitted Vega app.

## Source locations
- Official Amazon Vega video example (unaltered): `G:\AllFactsTV-Development\Amazon-Vega\Reference-Amazon-Vega-Video-Sample`
- AllFactsTV-specific shared read-only feed adapter: `G:\AllFactsTV-Development\Amazon-Vega\AllFactsTV-Integration\catalog.ts`

## Why this is staged rather than installed on Windows
Amazon's current Vega Developer Tools require native Ubuntu or macOS; Windows and WSL are unsupported. The Windows workstation is not a supported Vega build host. Use Ubuntu 20.04/22.04/24.04 or supported macOS per the latest Amazon docs, and allow at least 20 GB development space. The cloned Amazon reference already includes a W3C Media example and Shaka setup/reference tarball.

## Recommended Vega app integration
1. On a supported Ubuntu/macOS host, install official Vega Developer Tools, create a React Native Vega TV app using the official template, and build the unmodified template.
2. Add Amazon's `@amazon-devices/react-native-w3cmedia` dependency (Amazon documentation lists ~2.1.80) and required media service permissions/wants to its manifest.
3. Use the official Vega W3C Media VideoPlayer and KeplerVideoView components; use the included sample Shaka implementation for MPEG-DASH/HLS.
4. Import `catalog.ts` from this directory to read the existing public /assets/firetv-free-catalog.json and /api/tv-catalog feeds.
5. Show free films and paid preview-only titles. **Do not** enable rental full playback without secure viewer identity, Amazon-compliant purchase workflows, and server-verified entitlements.
6. Test on a Vega physical device or Amazon-provided virtual device: remote control focus, buffering, sound, subtitle tracks, network interruptions, playback resume, and first-frame latency.
7. Build, sign, and submit only after all device tests and Amazon review prerequisites are satisfied.

## Reuse/independence
The Vega front-end must never contain private R2 keys, Stripe API secrets or unprotected master media. All app platforms should share film IDs and secure gateway APIs. No new AWS paid services were created by this research/development step.

Official references:
- https://developer.amazon.com/docs/vega/latest/install-vega-sdk
- https://developer.amazon.com/docs/vega/2.0/media-player-setup
- https://github.com/AmazonAppDev/vega-video-sample