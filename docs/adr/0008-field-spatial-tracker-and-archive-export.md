# ADR 0008: Field Spatial Tracker & Complete Project Archive Export

## Status
Accepted

## Context
1. In remote field locations, downloading gigabytes of satellite raster tiles drains battery and device storage. Geologists primarily need spatial orientation relative to their active traverse and prior stations.
2. Field data has permanent evidentiary value. Relying solely on a compiled report risks locking away raw data. Geologists require open, interoperable access to their raw measurements, spatial layers, and media.

## Decision
1. **Lightweight Field Spatial Tracker (PWA)**:
   - For Phase 1, the field interface utilizes a vector-based, lightweight spatial canvas.
   - Shows live GPS position, altitude, horizontal accuracy circle, digital compass orientation, and breadcrumb markers for previously logged stations on that traverse.
   - Operates with zero network dependency, instant rendering, and minimal battery consumption.
2. **Comprehensive Project Archive (ZIP Deliverable)**:
   - Every report compilation produces a bundled ZIP archive containing:
     - `Report.docx`: The fully styled, decorated Word document with embedded photo plates and tables.
     - `stations.csv`: Tabular station register for spreadsheet analysis.
     - `spatial_data.geojson`: Geo-referenced vector layer with attributes and strike/dip symbology for direct import into QGIS, ArcGIS, or Leapfrog Geo.
     - `media/`: Structured directory containing:
       - `audio/`: Raw audio recordings named by station (e.g., `ST-001_audio.wav`).
       - `photos/`: Original high-res photos tagged with EXIF metadata (e.g., `ST-001_outcrop_01.jpg`).

## Consequences
- Guaranteed zero data lock-in.
- Geologists satisfy corporate, client, and regulatory audit standards by preserving original evidentiary media alongside synthesized reports.
