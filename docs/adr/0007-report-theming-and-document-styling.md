# ADR 0007: Decorated Word (.docx) Report Engine & Styling Themes

## Status
Accepted

## Context
A major goal of the product is eliminating the manual "post-fieldwork decoration" tax—where geologists spend days copying text into Word, formatting tables, resizing images, and creating figure captions. The resulting deliverable must look bespoke, professional, and aligned with corporate branding.

## Decision
1. **Document Delivery Standard**:
   - Primary output is **Microsoft Word (`.docx`)** generated programmatically.
   - Built using structured document templates with proper Word styles (Heading 1, Heading 2, Table styles, Figure Caption styles, Header/Footer page numbering).
2. **Styling Themes**:
   The user can choose between selectable aesthetic themes for the generated `.docx` document:
   - **Modern Corporate**: Clean sans-serif typography (e.g., Aptos / Calibri / Inter), deep navy or slate brand accents, bordered callout cards, modern figure cards.
   - **Classic Technical**: Traditional serif typography (e.g., Times New Roman / Georgia), formal monochrome or forest green accents, formal double-ruled academic tables.
   - **Geological Survey / Academic**: Earth-toned palette (terracotta / olive / ochre), strict USGS/BGS style figure numbering, formal appendix formatting.
3. **Automated Figure & Table "Decoration"**:
   - Auto-generated **Cover Page** with project title, client name, lead author credentials (e.g. *P.Geo / Competent Person*), date, and company logo.
   - Auto-generated **Executive Summary** & **Geological Setting**.
   - Auto-generated **Traverse Station Register** with GPS coordinates and lithology summaries.
   - Auto-generated **Structural Orientation Log** (Strike/Dip values formatted with right-hand-rule standard).
   - Auto-generated **Photo Plates**: 2-column or 3-column figure grids with auto-numbered captions (e.g., *Figure 4: Outcrop ST-012 showing quartz-vein stockwork; looking NE; hammer for scale*).
   - Auto-generated **Sample Inventory Appendix** with bag numbers, coordinates, and chain-of-custody fields.

## Consequences
- Transforms raw field observations directly into an editable 95%-finished deliverable.
- Eliminates manual formatting fatigue while leaving the file in Word format for final human sign-off.
