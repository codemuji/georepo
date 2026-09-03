# ADR 0001: Field-to-Report Automation Core Scope & Principles

## Status
Proposed (Under Grilling)

## Context
Geologists spend hours or days doing arduous fieldwork, manually taking notes (often on paper "Rite in the Rain" notebooks or fragmented phone apps). Back in the office or basecamp, they face a severe cognitive bottleneck: matching photos to GPS stations, transcribing handwritten or voice notes, drafting formal lithological descriptions, generating structural tables, and formatting executive reports for clients, management, or regulators.

## Core Tenets & Guardrails
1. **Zero Data Loss & Strict Provenance**: Geological data has legal, financial, and safety consequences (e.g., mineral reserves, slope stability). Any automated system must preserve the raw field observations untouched and clearly delineate AI-generated narrative summaries from raw field ground-truth.
2. **Offline-by-Default in the Field**: Connectivity in remote mapping areas is zero or intermittent. All field capture workflows must operate completely detached from the internet.
3. **Low-Friction Field UX**: Geologists in the field have dirty hands, wear gloves, carry gear, and work under harsh glare or rain. Input cannot require tedious multi-step mobile typing.
4. **Office-Grade Report Quality**: Back at the desk, the output cannot look like a generic markdown dump; it must produce formatted, branded, publication-quality reports (PDF/DOCX) with geo-referenced figures, tables, and photo logs.

## Open Decisions (Being Grilled)
- **ADR-0002**: Field Capture Modality (Voice dictation vs. quick structured forms vs. digital notebook sketch vs. paper OCR).
- **ADR-0003**: Target Geology Vertical & Compliance Requirements (Mining/Exploration, Geotechnical Engineering, Environmental, or Academic).
- **ADR-0004**: Offline Data Sync & Client Platform Architecture.
