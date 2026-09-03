# 02: Offline Field PWA Station Capture

**What to build:**  
The low-friction 10-second field capture user interface for mobile devices operating with zero internet connectivity. A geologist arriving at an outcrop can tap "New Station" to lock GPS coordinates and elevation, record freeform voice observations via microphone, snap outcrop photos with compass azimuth, and atomically save the bundle to the browser's IndexedDB edge cache.

**Blocked by:** 01: Project Scaffolding & Core Domain Reducer

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] PWA configured with Service Worker providing full offline asset caching.
- [ ] Single-tap "New Station" action locking latitude, longitude, elevation, accuracy, and timestamp via `navigator.geolocation`.
- [ ] Audio recording interface utilizing `MediaRecorder` API allowing arbitrary length natural speech dictation saved as audio blobs.
- [ ] Camera capture integration reading device azimuth from `DeviceOrientationEvent` to tag photos with orientation heading.
- [ ] IndexedDB persistence layer storing stations, audio blobs, and photo assets with zero data loss across browser restarts.
- [ ] Clear UI status indicators displaying "Offline Edge" and the count of un-synced stations in the local queue.
