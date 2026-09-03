# ADR 0005: Offline PWA Field Client & Modern Web Office Dashboard

## Status
Accepted

## Context
Deploying separate native iOS and Android apps introduces app store delays, device fragmentation, and cross-platform maintenance overhead. Geologists use both smartphones/rugged tablets in the field and multi-monitor desktop setups in the office. Furthermore, Word (`.docx`) is the industry-standard report deliverable for geology consultancies.

## Decision
1. **Unified Web Platform with Offline PWA**:
   - **Field Capture (PWA)**: Built as an installable Progressive Web App (Service Worker cache for offline bundle, IndexedDB / OPFS for local media storage, HTML5 Geolocation API, Web Audio API, Camera API).
   - **Office Dashboard**: Responsive desktop web application accessible from any browser, sharing the same application foundation.
2. **Offline Data Persistence & Sync Protocol**:
   - Audio blobs, compressed photos, and JSON metadata are stored locally in IndexedDB.
   - A background sync controller monitors online status (`navigator.onLine` and ping checks) and pushes batches using chunked multipart uploads when network connectivity is established.
3. **Report Generation Engine**:
   - Generates richly formatted, decorated **Microsoft Word documents (`.docx`)** using a document generation library (such as `docx` or template engines).
   - Includes:
     - Styled title page with project metadata, client name, and geologist credentials.
     - Executive summary and geologic setting.
     - Station register and structural measurement tables.
     - High-resolution photo plates with auto-scaled figures, compass orientation badges, and GPS coordinates.
     - Sample inventory appendix with chain-of-custody tags.

## Consequences
- Single codebase to develop and maintain.
- Works cross-platform on Android, iOS, Windows, macOS, and Linux without app-store gating.
- `.docx` deliverable allows geologists to perform final corporate formatting and sign-offs before client delivery.
