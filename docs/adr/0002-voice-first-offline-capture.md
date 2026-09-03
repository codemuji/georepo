# ADR 0002: Voice-First Field Capture & Edge Caching Architecture

## Status
Accepted

## Context
Geologists operate in physically taxing environments (sun glare, dust, precipitation, wearing field gloves) with zero or unreliable cellular reception. Typing or manipulating complex multi-level forms in the field slows down traverses and leads to incomplete observations.

## Decision
1. **Voice-First Input Modality**: The mobile field tool will center around rapid audio dictation coupled with geo-referenced photo capture. At any station/outcrop, a geologist can trigger a voice recording with a single physical button or prominent screen press, speak unstructured or semi-structured observations, and attach photos (with automatic EXIF, compass heading, and GPS coordinates).
2. **Offline Edge Caching**:
   - The field device (phone or tablet) acts strictly as an **offline-first capture and caching node**.
   - No internet connection or cloud processing is required in the field.
   - All assets (compressed high-fidelity audio, raw photos, GPS tracks, metadata JSON) are stored locally in an encrypted, crash-resilient local store (e.g., SQLite / IndexedDB / filesystem).
   - Sync queues automatically activate when the device detects trusted Wi-Fi/cellular connection upon return to basecamp or office.
3. **Office / Cloud Processing Pipeline**:
   - Audio transcription, domain jargon normalization, entity extraction (lithology, strike/dip, alteration, sample IDs), and document compilation execute asynchronously once synced.
   - Preserves raw audio and raw photos alongside extracted structured data for full auditability and verification.

## Consequences
- **Positive**: Blazing fast field workflow (seconds per station instead of minutes); no dead battery caused by heavy local neural network inference under field conditions; rock-solid reliability in wilderness.
- **Negative / Risk**: Ambiguities in voice dictation cannot be flagged in real-time if completely offline (unless light on-device wake-word/confirmation is supported); requires a dedicated office review UI where the geologist can quickly verify extracted data before compiling the final report.
