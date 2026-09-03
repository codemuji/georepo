# ADR 0006: AI Transcription, Lexicon Boosting & LLM Extraction Pipeline

## Status
Accepted

## Context
Standard automatic speech recognition (ASR) frequently misinterprets dense geological terminology, regional formation names, and numeric orientation readings. Geological reports demand high fidelity in identifying minerals (e.g. "pyrrhotite", "sphalerite"), rock names, and structural strike/dip values.

## Decision
1. **Project Lexicon & Vocabulary Boosting**:
   - Each project maintains a configurable **Project Lexicon** containing:
     - Target lithologies & regional rock formations (e.g., *Witwatersrand*, *Bushveld Complex*).
     - Target ore minerals & alterations (e.g., *chalcopyrite*, *bornite*, *potassic alteration*).
     - Standard abbreviations & custom naming conventions.
   - The lexicon is injected into OpenAI Whisper's initial prompt / temperature parameters to prime the acoustic and language model with domain vocabulary.
2. **AI Provider Architecture**:
   - **Transcription**: OpenAI Whisper API (or Whisper-compatible endpoint) conditioned on the Project Lexicon.
   - **Structured Extraction & Synthesis**: OpenRouter or NVIDIA NIM API gateway, allowing dynamic selection of state-of-the-art models (e.g. Claude 3.5 Sonnet, Llama 3.3 70B, DeepSeek, GPT-4o).
3. **Extraction Output Contract**:
   - The LLM parses the raw transcript against the active Project Mode schema (`MINERAL_EXPLORATION`, `GEOTECHNICAL_ENGINEERING`, `REGIONAL_MAPPING`) returning strict JSON with:
     - Primary rock type & detailed petrographic description.
     - Quantitative structural data (`strike`, `dip`, `dip_direction`, `trend`, `plunge`).
     - Mineralization & alteration notes.
     - Sample bag IDs (e.g., `SMP-102`).
     - Confidence scores per extracted field to alert the user during office review.

## Consequences
- Lexicon boosting prevents common transcription errors on specialized geological terms.
- OpenRouter / NVIDIA NIM integration provides provider independence, high throughput, and cost optimization.
