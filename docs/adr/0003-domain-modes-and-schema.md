# ADR 0003: Multi-Discipline Domain Modes & Report Schemas

## Status
Accepted

## Context
The core audience spans three distinct geological sub-disciplines, each with unique observational priorities, vocabulary, and reporting standards:
1. **Mineral Exploration / Mining**: Focus on economic minerals, alteration halos, structural conduits, sample bag tags, assay chains of custody, and NI 43-101 / JORC reporting formats.
2. **Geotechnical / Geo-Environmental**: Focus on engineering properties, Rock Mass Rating (RMR), weathering grades, discontinuity frequency/aperture, borehole logs, soil profiles, and ASTM/BSI standards.
3. **Regional / Academic Mapping**: Focus on stratigraphic units, formation contacts, structural tectonics (folds, nappes, unconformities), paleontology, and petrogenesis.

## Decision
1. **Campaign Archetype / Project Mode**: When starting a field project/campaign, the user designates the **Project Mode**:
   - `MINERAL_EXPLORATION`
   - `GEOTECHNICAL_ENGINEERING`
   - `REGIONAL_MAPPING`
2. **Polymorphic Station Observation Schema**:
   - Every station shares common primitives: Station ID, Timestamp, Geolocation (Lat/Lon/Alt/Datum), In-situ Photos, Structural Orientation (Strike/Dip or Trend/Plunge), Raw Audio & Transcript.
   - Discipline-specific schemas extend the station:
     - *Exploration*: Host Rock, Mineralization Type, Alteration Style (potassic, phyllic, propylitic, etc.), Sample Assay ID, Estimated Ore Grade indicators.
     - *Geotechnical*: Rock Mass Characterization (RQD, Joint Condition, Infill, Water Inflow), Soil Consistency, Stability Hazards.
     - *Regional*: Stratigraphic Unit/Formation name, Member, Contact Relationship (conformable, unconformable, fault contact), Fossil Content.
3. **Tailored Report Templates**: The generation engine selects report layouts, table structures, and executive summaries tuned to the active Project Mode.

## Consequences
- Single core platform serves the three largest geology verticals without forcing irrelevant fields onto users.
- Prompts for LLM entity extraction can be conditioned with mode-specific dictionaries and ontologies to dramatically boost accuracy.
