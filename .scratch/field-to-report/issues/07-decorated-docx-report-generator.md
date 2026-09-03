# 07: Decorated Word (.docx) Report Generator

**What to build:**  
A programmatic document generation engine compiling validated field stations into styled, publication-ready Microsoft Word (`.docx`) deliverables. Supports selectable styling themes (Modern Corporate, Classic Technical, Geological Survey), formatted cover pages, executive summaries, station tables, and high-resolution photo plates with scale bars.

**Blocked by:** 06: Office Desktop Verification Workbench

**Status:** resolved

## Acceptance Criteria

- [x] Document builder using the `docx` library generating valid OpenXML documents.
- [x] Theme styling engine supporting:
  - *Modern Corporate*: Clean sans-serif typography, deep navy/slate accents, callout cards.
  - *Classic Technical*: Formal serif typography, monochrome/forest green accents, academic ruled tables.
  - *Geological Survey*: Earth-toned palette, USGS/BGS style formal section numbering and appendix layouts.
- [x] Automated Cover Page featuring project title, concession/client name, author credentials (e.g. *P.Geo / Competent Person*), date, and company.
- [x] Automated Executive Summary and Traverse Station Register tables.
- [x] Structural Orientation Log table with standard Right-Hand-Rule formatting.
- [x] Multi-column Photo Plates with auto-numbered figure captions, embedded scale bars, and orientation azimuth metadata.
- [x] Sample Inventory Appendix with sample bag numbers and coordinates.
