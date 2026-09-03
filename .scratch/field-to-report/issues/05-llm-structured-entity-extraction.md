# 05: LLM Structured Entity Extraction Engine

**What to build:**  
An AI extraction engine powered by OpenRouter or NVIDIA NIM that converts unstructured, conversational field transcripts into strictly typed JSON objects tailored to the active Project Mode (`MINERAL_EXPLORATION`, `GEOTECHNICAL_ENGINEERING`, `REGIONAL_MAPPING`), computing confidence metrics for extracted values.

**Blocked by:** 04: Station Sync Queue & Whisper Lexicon-Boosted Transcription

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] LLM extraction pipeline using OpenRouter or NVIDIA NIM (e.g. Claude 3.5 Sonnet / Llama 3.3 70B / GPT-4o) with structured JSON schema outputs.
- [ ] Schema variation by Project Mode:
  - *Mineral Exploration*: Lithology, mineralogy, alterations, veins, sample bag IDs, structural strike/dip.
  - *Geotechnical*: Lithology, RQD %, joint spacing, weathering grade (I-VI), sample core ID, strike/dip.
  - *Regional Mapping*: Formation name, member, lithology, contact relationship, strike/dip.
- [ ] Field-level confidence estimation calculating acoustic and semantic certainty.
- [ ] Stations with confidence < 0.70 or numeric orientation anomalies automatically tagged with status `FLAGGED_LOW_CONFIDENCE`.
