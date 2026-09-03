# ADR 0004: Freeform Voice Ingestion & Interactive Verification Workbench

## Status
Accepted

## Context
Geologists require minimal friction while traversing difficult terrain. Forcing them through rigid step-by-step voice prompts disrupts their observation flow. Concurrently, AI transcription of complex technical jargon and numeric measurements (strike/dip, trend/plunge) is susceptible to errors that must be caught before report publication.

## Decision
1. **Pure Freeform Speech Ingestion**:
   - The field capture UI provides a single prominent record button per station.
   - Geologists talk naturally without constraint (describing rocks, structures, alterations, sample IDs, and coordinates in any order).
   - The AI pipeline uses domain-tuned geological LLM extraction to isolate:
     - Lithological identification and petrographic description.
     - Structural measurements (Strike, Dip, Dip Direction).
     - Mineralization & alteration signatures.
     - Sample tags and bag identifiers.
     - Freeform qualitative field notes.
2. **Interactive Office Verification Workbench**:
   - A 3-pane desktop web interface:
     - **Left**: Traverse & Station Navigation List (with status flags: *Unverified*, *Edited*, *Approved*).
     - **Center**: Interactive Geo-Map (Leaflet/MapLibre) plotting stations, traverse paths, and strike/dip symbology.
     - **Right**: Split Inspection Panel with:
       - Waveform audio player with playback speed and scrubber.
       - Photo gallery with zoom/pan and compass orientation tags.
       - AI-extracted structured fields with 1-click inline editing.
       - Confidence badges highlighting low-confidence numeric extractions.
   - Only approved or reviewed stations are compiled into the final report.

## Consequences
- Maximizes field speed (zero mental overhead for the geologist during traverse).
- Eliminates AI hallucination risks by placing a low-friction verification step between field capture and formal report generation.
