# 06: Office Desktop Verification Workbench

**What to build:**  
A responsive 3-pane desktop web interface for reviewing, validating, and editing field traverse data before report compilation. Features a station list with status badges, an interactive GIS map plotting oriented strike-and-dip symbols, and an inspection pane combining synchronized audio playback, photo viewer, and 1-click inline editing.

**Blocked by:** 05: LLM Structured Entity Extraction Engine

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 3-pane desktop layout:
  - *Left Pane*: Traverse Station List showing station ID, status (`Unverified`, `Flagged ⚠`, `Approved ✓`), and lithology snippet.
  - *Center Pane*: Leaflet.js interactive map plotting stations and oriented SVG strike-and-dip symbols (strike-line bar rotated to azimuth with perpendicular dip tick mark).
  - *Right Pane*: Inspection & Verification panel with waveform audio scrubber, photo carousel with zoom/pan, and structured attribute form.
- [ ] Visual highlight on low-confidence or flagged stations.
- [ ] 1-click inline editing of all extracted fields (lithology, strike, dip, sample IDs); edits immediately update station status to `EDITED`.
- [ ] "Approve Station" action updating station status to `VERIFIED_APPROVED`.
- [ ] Only approved stations are marked eligible for final report compilation.
