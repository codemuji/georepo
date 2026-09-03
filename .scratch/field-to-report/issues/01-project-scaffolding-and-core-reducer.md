# 01: Project Scaffolding & Core Domain Reducer

**What to build:**  
Initialize the TypeScript + Vite PWA repository foundation, and implement the pure domain state reducer and domain entity types lifted from the validated prototype. This provides the single source of truth for project configurations (`MINERAL_EXPLORATION`, `GEOTECHNICAL_ENGINEERING`, `REGIONAL_MAPPING`), traverse stations, and state transitions.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] Vite + TypeScript project initialized with strict type checking and testing framework.
- [ ] Shared domain types implemented: `Project`, `Station`, `StructuralMeasurement`, `ProjectMode`, `ProjectLexicon`, `Traverse`, `ReportConfig`.
- [ ] Pure `fieldToReportReducer` implemented and verified with tests against all state transitions (`SET_MODE`, `NEW_STATION`, `RECORD_AUDIO`, `ATTACH_PHOTO`, `SYNC_QUEUE`, `RUN_AI_EXTRACTION`, `OVERRIDE_MEASUREMENT`, `APPROVE_STATION`, `GENERATE_REPORT`).
- [ ] High-seam test suite verifying that invalid state transitions fail cleanly and preserve state integrity.
