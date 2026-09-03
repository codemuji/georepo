# CONTEXT.md — Geological Field-to-Report System

## Ubiquitous Language & Core Concepts

This document maintains the canonical domain language for the product. All specs, tickets, code, and discussions must align with these terms.

---

### 1. Project & Campaign Level
- **Project / Campaign**: A bounded mapping initiative with a defined objective, client/company branding, geographic boundary, **Project Mode**, and **Project Lexicon**.
- **Project Modes**:
  - `MINERAL_EXPLORATION`: Veins, alteration halos, sulfides, gossans, sample assays, JORC/NI 43-101 logs.
  - `GEOTECHNICAL_ENGINEERING`: RQD, joint spacing, weathering grade, RMR/Q-system, slope/foundation stability.
  - `REGIONAL_MAPPING`: Stratigraphy, formation members, lithotectonic units, contact relationships, fossil beds.
- **Project Lexicon**: User-configurable domain dictionary (local formation names, target minerals, alterations, expected rock types) used for AI vocabulary boosting.
- **Report Theme**: Visual styling preset for generated `.docx` reports (`MODERN_CORPORATE`, `CLASSIC_TECHNICAL`, `GEOLOGICAL_SURVEY`).
- **Traverse**: A single day's mapping route or designated path across terrain.

---

### 2. Field Station Primitives & 10-Second UX
- **Station (Observation Point / Outcrop)**: A discrete geographic location where observations are made. Formatted sequentially (e.g. `ST-2026-001`).
- **10-Second Field Workflow**:
  1. *Tap "New Station"*: GPS coordinates, altitude, timestamp, and accuracy locked instantly.
  2. *Tap "Record"*: Freeform speech audio memo recorded without rigid structure.
  3. *Tap "Camera"*: In-situ outcrop/hand-specimen photos captured with auto-orientation/compass azimuth.
  4. *Tap "Save Station"*: Atomically cached in device local storage (IndexedDB).
- **Field Spatial Tracker**: Vector-based lightweight canvas showing live coordinates, compass heading, and breadcrumb markers of prior stations with zero tile download overhead.
- **Structural Measurements**:
  - `Strike & Dip`: Planar orientation (e.g. `045/30 SE`).
  - `Trend & Plunge`: Linear features (e.g. lineations, fold axes).
- **Sample Tag**: Physical specimen tagged with unique ID/barcode (e.g. `SMP-9842`).

---

### 3. Architecture & Processing Pipeline
- **Field Capture (PWA)**: Offline-first Progressive Web App utilizing Service Worker, IndexedDB, Web Audio API, and HTML5 Geolocation.
- **Office Dashboard**: Desktop web application featuring a 3-pane Verification Workbench:
  - *Station List*: Traverse log with status badges (`Unverified`, `Edited`, `Approved`).
  - *Map View*: Leaflet/MapLibre GIS plotting station points, traverse tracks, and strike/dip strike-line symbols.
  - *Inspection Panel*: Synchronized audio player, photo gallery, and AI entity editor.
- **AI Processing Pipeline**:
  - *ASR*: OpenAI Whisper with Project Lexicon prompt conditioning.
  - *Extraction & Synthesis*: OpenRouter / NVIDIA NIM LLM gateway (Claude 3.5, Llama 3.3, DeepSeek, GPT-4o).
- **Deliverables & Export Engine**:
  - *Decorated Microsoft Word Document (`.docx`)*: Richly formatted document with executive summary, station register, structural tables, photo plates with scale bars, and sample appendices.
  - *Complete Project Archive (`.zip`)*: Bundles `.docx`, `stations.csv`, `spatial_data.geojson`, and raw media directories (`audio/`, `photos/`).

---

### 4. Architectural Decision Records (ADRs)
- [ADR-0001: Product Vision and Scope](file:///c:/laragon/www/georepo/docs/adr/0001-product-vision-and-scope.md)
- [ADR-0002: Voice-First Field Capture & Edge Caching](file:///c:/laragon/www/georepo/docs/adr/0002-voice-first-offline-capture.md)
- [ADR-0003: Multi-Discipline Domain Modes & Schemas](file:///c:/laragon/www/georepo/docs/adr/0003-domain-modes-and-schema.md)
- [ADR-0004: Freeform Voice Ingestion & Verification Workbench](file:///c:/laragon/www/georepo/docs/adr/0004-freeform-speech-and-office-workbench.md)
- [ADR-0005: Offline PWA Field Client & Modern Web Office Dashboard](file:///c:/laragon/www/georepo/docs/adr/0005-pwa-and-web-architecture.md)
- [ADR-0006: AI Transcription, Lexicon Boosting & LLM Extraction](file:///c:/laragon/www/georepo/docs/adr/0006-ai-pipeline-and-lexicon-boosting.md)
- [ADR-0007: Decorated Word (.docx) Report Engine & Styling Themes](file:///c:/laragon/www/georepo/docs/adr/0007-report-theming-and-document-styling.md)
- [ADR-0008: Field Spatial Tracker & Complete Project Archive Export](file:///c:/laragon/www/georepo/docs/adr/0008-field-spatial-tracker-and-archive-export.md)
- [ADR-0009: Technical Stack & Implementation Architecture](file:///c:/laragon/www/georepo/docs/adr/0009-technical-stack-and-architecture.md)
