# 04: Station Sync Queue & Whisper Lexicon-Boosted Transcription

**What to build:**  
Automatic detection of network connectivity upon returning to basecamp/office, chunked batch uploading of cached IndexedDB station bundles (audio and photos), and integration with OpenAI Whisper API with domain vocabulary boosting using the user-defined Project Lexicon.

**Blocked by:** 02: Offline Field PWA Station Capture

**Status:** resolved

## Acceptance Criteria

- [x] Background network monitor detecting online state transition and triggering the sync queue.
- [x] Multipart upload protocol sending audio blobs, photo binaries, and station JSON payloads to the backend.
- [x] Backend Whisper integration receiving raw audio recordings and transcribing speech.
- [x] Prompt injection conditioning Whisper with `project.lexicon` keywords (local rock formations, target minerals, alteration terms) to eliminate phonetic errors.
- [x] Raw transcript and audio file references stored against the station record in the office database.
