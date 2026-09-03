# Geological Field-to-Report Automation System Specification

**Status:** `ready-for-agent`  
**Feature:** `field-to-report`  
**Canonical Domain Reference:** [`CONTEXT.md`](file:///c:/laragon/www/georepo/CONTEXT.md)  
**Architectural Baseline:** [ADR-0001 through ADR-0009](file:///c:/laragon/www/georepo/docs/adr/)  
**Validated Prototype:** [`prototype-field-to-report.html`](file:///c:/laragon/www/georepo/prototype-field-to-report.html)

---

## Problem Statement

Geologists in the field work under physically punishing conditions (sun glare, rain, dust, mud, and wearing gloves), while handling heavy gear (rock hammer, compass-clinometer, hand lens, GPS, sample bags). Traditional methods require either:
1. Stopping at every outcrop to manually handwrite notes in weatherproof paper notebooks ("Rite in the Rain"), which must be laboriously deciphered and transcribed days or weeks later.
2. Typing on mobile touchscreens, which is slow, error-prone under direct sunlight, and unusable with dirty hands or gloves.

Upon returning to basecamp or the office, geologists face a severe cognitive bottleneck: matching unorganized smartphone photos to GPS tracks and station numbers, transcribing notes, looking up structural strike/dip conventions, calculating Rock Mass Ratings or mineral alteration halos, and spending dozens of hours formatting tables and photo plates in Microsoft Word. In addition to wasting valuable technical hours, critical details get forgotten or misattributed ("field-to-office lag"), and manual copying risks rotating vein orientations or dropping sample numbers—errors with severe financial and safety consequences.

---

## Solution

A two-tiered, voice-first system designed around field physical reality and office reporting rigor:

1. **Field Capture Client (Offline PWA)**:
   - Operates 100% detached from the internet in remote wilderness.
   - Enables a **10-second station capture workflow**:
     1. Tap **"New Station"**: Instantly captures GPS coordinates, altitude, timestamp, and horizontal accuracy.
     2. Tap **"Record"**: The geologist speaks freely in natural language without filling rigid form fields (e.g., describing rock type, alterations, vein structures, strike/dip, and sample numbers).
     3. Tap **"Camera"**: Snaps outcrop and hand-specimen photos with embedded compass azimuth.
     4. Tap **"Save"**: Atomically stores all audio blobs, compressed photos, and telemetry into an encrypted offline edge cache (IndexedDB).
   - Includes a lightweight, vector-based field spatial canvas displaying coordinates, compass heading, and breadcrumbs of previous stations with zero map-tile bandwidth requirements.

2. **Office Verification Workbench & Report Engine (Web Desktop)**:
   - Automatically detects connectivity when returning to basecamp or office, uploading the offline queue.
   - Employs OpenAI Whisper with a **Project Lexicon** (regional formation names, target minerals) to transcribe geological jargon with high acoustic fidelity.
   - Extracts structured domain schemas via LLM (OpenRouter / NVIDIA NIM) conditioned on the active **Project Mode** (`MINERAL_EXPLORATION`, `GEOTECHNICAL_ENGINEERING`, `REGIONAL_MAPPING`).
   - Presents an interactive **3-pane Verification Workbench**:
     - *Left*: Traverse station list with status badges (`Unverified`, `Flagged Low-Confidence`, `Approved`).
     - *Center*: Interactive Leaflet GIS map with strike-and-dip directional strike-line symbology.
     - *Right*: Synchronized audio waveform player, photo inspector, and inline data editor to verify or correct extracted measurements.
   - **One-Click Deliverable Generation**: Compiles an editable, decorated Microsoft Word document (`.docx`) adhering to selected styling themes (Modern Corporate, Classic Technical, Geological Survey) with formatted cover page, executive summary, structural data tables, photo plates with scale bars, and sample appendices, alongside a complete project audit `.zip` archive.

---

## User Stories

### Field Capture & Offline Resilience
1. As a field geologist, I want to create a new observation station with a single tap, so that my GPS coordinates and elevation are locked immediately without manual typing.
2. As a field geologist wearing gloves in bright sunlight, I want a single large record button to dictate my observations out loud in freeform speech, so that I don't have to navigate small dropdowns or type on a screen.
3. As a field geologist, I want the app to operate completely offline with zero cellular reception, so that I can map remote mountains or deserts without fear of data loss or frozen screens.
4. As a field geologist, I want to take outcrop and macro hand-specimen photos that automatically store my phone's compass heading and GPS location, so that I never have to manually remember which way I was facing.
5. As a field geologist, I want to see my current coordinates, altitude, and a visual breadcrumb trail of prior stations on a lightweight offline canvas, so that I maintain spatial awareness without draining battery on satellite map tiles.
6. As a field geologist, I want all recorded audio memos and photos saved atomically into local device storage, so that even if my browser crashes or battery dies, no observations are lost.

### Data Sync & AI Processing
7. As a geologist returning to camp, I want the app to automatically detect Wi-Fi or cellular connectivity and upload my cached stations in the background, so that I don't have to manually export files.
8. As a project manager, I want to configure a Project Lexicon containing local formation names and target minerals, so that the speech-to-text model accurately transcribes obscure geological terms instead of guessing generic words.
9. As a geologist, I want the system to parse my unstructured speech into structured fields (lithology, strike, dip, dip direction, alteration, sample IDs), so that I don't have to manually categorize my raw notes.
10. As an exploration geologist, I want the AI to extract vein types, alteration styles, and sample bag IDs when the project is in Mineral Exploration mode.
11. As a geotechnical engineer, I want the AI to extract RQD percentages, joint spacing, and weathering grades when the project is in Geotechnical Engineering mode.
12. As a regional mapping geologist, I want the AI to extract stratigraphic formation names, members, and contact types when in Regional Mapping mode.

### Office Verification Workbench
13. As a geologist at my office desk, I want a 3-pane workbench showing my station list, map view, and inspection panel side-by-side, so that I can review an entire day's traverse in one screen.
14. As a reviewing geologist, I want stations with ambiguous transcription or low-confidence numeric measurements to be visually flagged in orange, so that I am alerted to verify critical strike/dip values.
15. As a reviewing geologist, I want to click any station and listen to the exact audio segment while viewing the photo, so that I can immediately verify what I said in the field.
16. As a reviewing geologist, I want to click any extracted attribute and edit it with a single keystroke, so that I can fix misheard numbers or terminology before report generation.
17. As a reviewing geologist, I want to see strike-and-dip symbols plotted on the map oriented to their true azimuth, so that I can visually validate structural continuity across outcrops.
18. As a reviewing geologist, I want an "Approve Station" button that locks the station as verified, so that only human-validated data is included in formal client reports.

### Report Generation & Deliverables
19. As a consulting geologist, I want to generate a decorated Microsoft Word (`.docx`) report with a single click, so that I can deliver a professional report to my client without manual formatting.
20. As a consulting geologist, I want the generated `.docx` document to include an executive summary, geological setting, formatted station tables, and photo plates with automatic figure numbers and scale bars.
21. As a consulting geologist, I want to select between different document styling themes (Modern Corporate, Classic Technical, Geological Survey), so that the deliverable matches my company's branding standards.
22. As a Competent Person (CP / P.Geo), I want the output in editable `.docx` format rather than locked PDF, so that I can add my professional seal, custom disclaimers, and interpretive commentary prior to final client submission.
23. As a GIS specialist, I want the system to export a complete Project Archive (`.zip`) containing `spatial_data.geojson`, `stations.csv`, and all raw audio and photo files, so that I can load the traverse directly into ArcGIS, QGIS, or Leapfrog Geo.
24. As an exploration manager, I want all raw audio and photo files retained in their original uncompressed format, so that we maintain a permanent audit trail satisfying compliance and due diligence standards.

---

## Implementation Decisions

### 1. Unified TypeScript Architecture
- Both the offline PWA field tool and the desktop verification workbench will share a single TypeScript codebase and unified domain type definitions.
- The state transition logic will follow the pure reducer model established and validated in `prototype-field-to-report.html`:

```typescript
// Validated pure state signature from prototype
interface FieldToReportState {
  project: {
    id: string;
    name: string;
    mode: 'MINERAL_EXPLORATION' | 'GEOTECHNICAL_ENGINEERING' | 'REGIONAL_MAPPING';
    theme: 'MODERN_CORPORATE' | 'CLASSIC_TECHNICAL' | 'GEOLOGICAL_SURVEY';
    lexicon: string[];
  };
  network: {
    isOnline: boolean;
    pendingSyncCount: number;
  };
  traverse: {
    activeStationId: string | null;
    stations: Station[];
  };
  report: {
    compiledAt: string | null;
    status: 'IDLE' | 'COMPILING' | 'READY';
  };
}
```

### 2. Client Edge Storage & Offline PWA
- Progressive Web App configured with a Service Worker precaching application shells and offline assets.
- IndexedDB used for storing station metadata, raw audio blobs (`audio/webm` or `audio/wav`), and compressed photos (`image/jpeg`).
- Device sensors integrated via Web APIs: `navigator.geolocation` for coordinates and `DeviceOrientationEvent` / compass API for photo azimuth headings.

### 3. AI Pipeline & Lexicon Boosting
- **Transcription**: OpenAI Whisper API endpoint. When transcribing, the system injects the `project.lexicon` array into the `prompt` parameter of the Whisper API request to bias phonetic decoding toward specialized geological terminology.
- **Extraction**: OpenRouter / NVIDIA NIM LLM endpoint (e.g., Claude 3.5 Sonnet or Llama 3.3 70B). Structured JSON output is enforced with JSON-schema matching the active `Project Mode`.
- Low-confidence extractions (< 0.70) or numeric outliers trigger `FLAGGED_LOW_CONFIDENCE` status.

### 4. 3-Pane Desktop Workbench
- Built with responsive desktop CSS grid layout.
- **Map Seam**: Leaflet.js with SVG markers rendering geological strike-line bars with dip tick marks rotated to true azimuth.
- **Audio Seam**: HTML5 Audio element with playback rate controls (0.75x, 1.0x, 1.25x, 1.5x) and waveform scrubber.
- **Inline Editing**: Double-click or click-to-edit fields that instantly update the station state and clear low-confidence flags.

### 5. Document & Archive Generation Engine
- Node.js backend utilizing the `docx` library to construct OpenXML documents with:
  - Cover page with project metadata, client name, and author credentials.
  - Heading styles, custom brand accent color palettes, and header/footer page numbering.
  - High-resolution photo figure grids with auto-scaled dimensions, captions, and coordinates.
  - Formatted tables for Station Register and Structural Orientation Logs.
- Archiving utility (`archiver` / `jszip`) bundling `Report.docx`, `stations.csv`, `spatial_data.geojson`, `audio/`, and `photos/` into a single `.zip` file.

---

## Testing Decisions

### High-Seam Testing Philosophy
Testing will strictly verify **external behavioral contracts** at the highest possible interface seams rather than private implementation details:
1. **Offline State & Sync Seam**: Test that stations, audio blobs, and photo assets dispatched while offline persist in local storage, survive simulated page reloads, and accurately batch-transfer upon network reconnection.
2. **AI Extraction Contract Seam**: Test that given a sample audio transcript and a Project Mode schema (Exploration vs. Geotechnical), the extraction engine outputs a valid structured JSON object with all required fields (lithology, strike, dip, sample ID).
3. **Verification Guardrail Seam**: Test that stations with confidence below threshold are flagged, that manual override updates the state to `EDITED`, and that unverified stations are excluded from compilation.
4. **Document Output Integrity Seam**: Test that the `.docx` generation engine produces a valid, openable OpenXML buffer containing the expected sections, tables, and photo plates.

---

## Out of Scope

1. Real-time multi-geologist collaborative mapping in the field (each geologist maps independently offline; merging occurs at project level).
2. Direct integration with hardware electronic compasses via Bluetooth/Serial (uses phone/tablet internal compass/gyroscope).
3. 3D subsurface interpolation and block modeling (e.g. Leapfrog/Micromine algorithms; spatial data is exported as standard GeoJSON/CSV for external GIS tools).
4. Physical rock specimen laboratory assay analysis (system tracks sample bag IDs and chains of custody, not lab spectrometer hardware).

---

## Further Notes
The prototype [`prototype-field-to-report.html`](file:///c:/laragon/www/georepo/prototype-field-to-report.html) contains the validated reference state machine and scenario test cases. All subsequent implementation tickets will cite this spec and the corresponding ADRs.
