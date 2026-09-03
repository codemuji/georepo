# ADR 0009: Technical Stack & Implementation Architecture

## Status
Accepted

## Context
The system requires an offline-capable client for harsh mobile field conditions, a responsive multi-pane desktop workbench for office verification, and a robust document generation engine for pixel-perfect Microsoft Word (`.docx`) deliverables.

## Decision
1. **Frontend (Field PWA & Office Dashboard)**:
   - **Framework**: Modern TypeScript with Vite.
   - **Offline PWA**: Service Worker caching, IndexedDB for offline audio blobs, photos, and station data.
   - **Sensors & Audio**: HTML5 Geolocation API, DeviceOrientation/Compass API, Web Audio API (`MediaRecorder`).
   - **Office GIS & Verification Workbench**: Leaflet / Canvas for map interaction and strike/dip visualization; split-screen waveform audio scrubber and inline station editor.
2. **Backend & Processing Pipeline**:
   - **Runtime**: Node.js / TypeScript.
   - **Document Generation**: `docx` library (creating native OpenXML Microsoft Word documents with custom typography, brand palettes, structured tables, and auto-scaled figure plates).
   - **Archive Engine**: `archiver` / JSZip for assembling complete ZIP project packages.
   - **AI Integrations**:
     - Speech-to-Text: OpenAI Whisper API with Project Lexicon initial-prompt boosting.
     - Extraction & Synthesis: OpenRouter / NVIDIA NIM gateway for high-fidelity geological LLM parsing.

## Consequences
- 100% end-to-end TypeScript codebase with shared domain types between client and server.
- No heavy native app compilation or mobile app store delays.
- Clean separation between offline edge capture and cloud/office processing.
