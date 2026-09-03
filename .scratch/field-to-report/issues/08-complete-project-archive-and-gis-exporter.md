# 08: Complete Project Archive (.zip) & GIS Exporter

**What to build:**  
A comprehensive project packaging engine that generates a downloadable `.zip` archive containing the decorated `.docx` report, spreadsheet data (`stations.csv`), GIS spatial layers (`spatial_data.geojson`), and all original, uncompressed raw field media organized by station ID to guarantee zero data loss and compliance readiness.

**Blocked by:** 07: Decorated Word (.docx) Report Generator

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Archive packaging pipeline (`archiver` / `jszip`) triggered upon report compilation.
- [ ] Exports `stations.csv` containing all station metadata, coordinates, lithology, and structural measurements.
- [ ] Exports `spatial_data.geojson` with Point features containing orientation attributes (`strike`, `dip`) for immediate import into ArcGIS, QGIS, or Leapfrog Geo.
- [ ] Preserves all raw audio files in an `audio/` folder named by station ID (e.g. `ST-001_audio.webm`).
- [ ] Preserves all original high-resolution photos in a `photos/` folder named with station and azimuth metadata.
- [ ] Single 1-click download producing the complete, verifiable audit bundle.
