# 03: Lightweight Field Spatial Tracker

**What to build:**  
A battery-efficient, zero-bandwidth vector spatial canvas embedded in the field PWA. Without downloading heavy satellite raster tiles, it shows the geologist's current GPS position, horizontal accuracy circle, digital compass orientation needle, and breadcrumb markers for previously logged stations on the active traverse.

**Blocked by:** 02: Offline Field PWA Station Capture

**Status:** resolved

## Acceptance Criteria

- [x] Lightweight HTML5 Canvas / SVG vector renderer operating entirely client-side with zero external network tile requests.
- [x] Real-time updates for user GPS position, elevation, and heading from device sensors.
- [x] Renders sequential station markers (e.g. ST-001, ST-002) connected by traverse breadcrumb vectors.
- [x] Tapping any station marker on the canvas opens its local summary card.
- [x] Pan and zoom gestures enabled with automatic "Re-center to my location" button.
