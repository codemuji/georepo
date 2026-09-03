/**
 * Canonical domain types for Geological Field-to-Report system.
 * Aligned with CONTEXT.md and ADR-0001 through ADR-0009.
 */

export type ProjectMode =
  | 'MINERAL_EXPLORATION'
  | 'GEOTECHNICAL_ENGINEERING'
  | 'REGIONAL_MAPPING';

export type ReportTheme =
  | 'MODERN_CORPORATE'
  | 'CLASSIC_TECHNICAL'
  | 'GEOLOGICAL_SURVEY';

export type StationStatus =
  | 'OFFLINE_CACHED'
  | 'SYNCED'
  | 'EXTRACTED'
  | 'FLAGGED_LOW_CONFIDENCE'
  | 'EDITED'
  | 'VERIFIED';

export interface Coordinates {
  lat: number;
  lon: number;
  elevation?: number;
  accuracy?: number;
}

export interface StructuralMeasurement {
  strike?: number;
  dip?: number;
  dipDirection?: string;
  trend?: number;
  plunge?: number;
}

export interface PhotoAsset {
  id: string;
  blobUrl?: string;
  base64?: string;
  caption?: string;
  azimuth?: number;
  timestamp: string;
}

export interface AudioMemo {
  durationSec: number;
  blobUrl?: string;
  rawSpeechText?: string;
}

export interface MineralExplorationAttributes {
  lithology: string;
  alteration?: string;
  mineralization?: string;
  sampleId?: string;
  strike?: number;
  dip?: number;
  dipDirection?: string;
}

export interface GeotechnicalAttributes {
  lithology: string;
  rqd?: string;
  jointSpacing?: string;
  weathering?: string;
  sampleId?: string;
  strike?: number;
  dip?: number;
  dipDirection?: string;
}

export interface RegionalMappingAttributes {
  formation?: string;
  member?: string;
  lithology: string;
  contact?: string;
  sampleId?: string;
  strike?: number;
  dip?: number;
  dipDirection?: string;
}

export type ExtractedAttributes =
  | MineralExplorationAttributes
  | GeotechnicalAttributes
  | RegionalMappingAttributes;

export interface Station {
  id: string;
  timestamp: string;
  coordinates: Coordinates;
  azimuth?: number;
  audio?: AudioMemo;
  extracted?: ExtractedAttributes;
  photos: PhotoAsset[];
  sampleId?: string;
  confidence?: number;
  status: StationStatus;
  verified: boolean;
}

export interface ProjectConfig {
  id: string;
  name: string;
  mode: ProjectMode;
  theme: ReportTheme;
  lexicon: string[];
}

export interface ReportState {
  compiledAt: string | null;
  title: string | null;
  themeUsed: ReportTheme | null;
  stationCount: number;
  archiveZipReady: boolean;
}

export interface NetworkState {
  isOnline: boolean;
  pendingSyncCount: number;
}

export interface TraverseState {
  activeStationId: string | null;
  stations: Station[];
}

export interface AuditLogEntry {
  time: string;
  msg: string;
}

export interface FieldToReportState {
  project: ProjectConfig;
  network: NetworkState;
  traverse: TraverseState;
  report: ReportState;
  auditLog: AuditLogEntry[];
}

// Action Payloads
export type FieldToReportAction =
  | { type: 'SET_MODE'; mode: ProjectMode }
  | { type: 'SET_THEME'; theme: ReportTheme }
  | { type: 'SET_PROJECT_DETAILS'; name: string; lexicon?: string[] }
  | { type: 'NEW_STATION'; coordinates?: Coordinates; azimuth?: number }
  | { type: 'RECORD_AUDIO'; stationId?: string; durationSec: number; speechText: string; blobUrl?: string }
  | { type: 'ATTACH_PHOTO'; stationId?: string; caption?: string; azimuth?: number; blobUrl?: string }
  | { type: 'TOGGLE_ONLINE'; forceOnline?: boolean }
  | { type: 'SYNC_QUEUE' }
  | { type: 'RUN_AI_EXTRACTION'; stationId?: string; singleOnly?: boolean; simulatedError?: boolean; customAttributes?: ExtractedAttributes; confidence?: number }
  | { type: 'OVERRIDE_MEASUREMENT'; stationId: string; field: string; value: unknown }
  | { type: 'APPROVE_STATION'; stationId?: string }
  | { type: 'GENERATE_REPORT'; theme?: ReportTheme }
  | { type: 'RESET' };
