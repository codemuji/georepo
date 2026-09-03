import { describe, it, expect } from 'vitest';
import {
  fieldToReportReducer,
  INITIAL_FIELD_TO_REPORT_STATE
} from '../../src/domain/reducer';

describe('Geological Field-to-Report Core Domain Reducer', () => {
  it('initializes with offline edge posture and default exploration mode', () => {
    const state = INITIAL_FIELD_TO_REPORT_STATE;
    expect(state.network.isOnline).toBe(false);
    expect(state.project.mode).toBe('MINERAL_EXPLORATION');
    expect(state.traverse.stations).toHaveLength(0);
    expect(state.traverse.activeStationId).toBeNull();
    expect(state.report.archiveZipReady).toBe(false);
  });

  it('handles project mode and theme configuration', () => {
    let state = fieldToReportReducer(INITIAL_FIELD_TO_REPORT_STATE, {
      type: 'SET_MODE',
      mode: 'GEOTECHNICAL_ENGINEERING'
    });
    expect(state.project.mode).toBe('GEOTECHNICAL_ENGINEERING');

    state = fieldToReportReducer(state, {
      type: 'SET_THEME',
      theme: 'CLASSIC_TECHNICAL'
    });
    expect(state.project.theme).toBe('CLASSIC_TECHNICAL');
  });

  it('executes 10-second station capture (GPS lock, voice memo, photo snap)', () => {
    // 1. Lock new station
    let state = fieldToReportReducer(INITIAL_FIELD_TO_REPORT_STATE, {
      type: 'NEW_STATION',
      coordinates: { lat: -25.7461, lon: 28.1881, elevation: 1400 },
      azimuth: 90
    });
    expect(state.traverse.stations).toHaveLength(1);
    const st1 = state.traverse.stations[0];
    expect(st1.id).toBe('ST-001');
    expect(st1.status).toBe('OFFLINE_CACHED');
    expect(st1.coordinates.lat).toBe(-25.7461);
    expect(state.network.pendingSyncCount).toBe(1);

    // 2. Attach freeform voice memo
    state = fieldToReportReducer(state, {
      type: 'RECORD_AUDIO',
      durationSec: 15,
      speechText: 'Quartz vein with chalcopyrite, strike 045 dip 60 SE'
    });
    expect(state.traverse.stations[0].audio?.rawSpeechText).toContain('chalcopyrite');
    expect(state.traverse.stations[0].audio?.durationSec).toBe(15);

    // 3. Attach outcrop photo with azimuth
    state = fieldToReportReducer(state, {
      type: 'ATTACH_PHOTO',
      caption: 'Main quartz vein wall',
      azimuth: 90
    });
    expect(state.traverse.stations[0].photos).toHaveLength(1);
    expect(state.traverse.stations[0].photos[0].azimuth).toBe(90);
  });

  it('rejects sync while offline and successfully syncs when online', () => {
    // Create cached station
    let state = fieldToReportReducer(INITIAL_FIELD_TO_REPORT_STATE, {
      type: 'NEW_STATION'
    });
    expect(state.network.pendingSyncCount).toBe(1);

    // Attempt sync while offline
    state = fieldToReportReducer(state, { type: 'SYNC_QUEUE' });
    expect(state.traverse.stations[0].status).toBe('OFFLINE_CACHED');
    expect(state.auditLog[0].msg).toContain('SYNC REJECTED');

    // Go online at basecamp
    state = fieldToReportReducer(state, { type: 'TOGGLE_ONLINE', forceOnline: true });
    expect(state.network.isOnline).toBe(true);

    // Now sync succeeds
    state = fieldToReportReducer(state, { type: 'SYNC_QUEUE' });
    expect(state.traverse.stations[0].status).toBe('SYNCED');
    expect(state.network.pendingSyncCount).toBe(0);
  });

  it('adapts AI extraction polymorphically across project modes', () => {
    // 1. Mineral exploration mode
    let state = fieldToReportReducer(INITIAL_FIELD_TO_REPORT_STATE, { type: 'NEW_STATION' });
    state = fieldToReportReducer(state, { type: 'RUN_AI_EXTRACTION' });
    const exp = state.traverse.stations[0].extracted as any;
    expect(exp.mineralization).toBeDefined();
    expect(exp.sampleId).toBe('SMP-102');

    // 2. Geotechnical engineering mode
    let geotechState = fieldToReportReducer(INITIAL_FIELD_TO_REPORT_STATE, {
      type: 'SET_MODE',
      mode: 'GEOTECHNICAL_ENGINEERING'
    });
    geotechState = fieldToReportReducer(geotechState, { type: 'NEW_STATION' });
    geotechState = fieldToReportReducer(geotechState, { type: 'RUN_AI_EXTRACTION' });
    const geo = geotechState.traverse.stations[0].extracted as any;
    expect(geo.rqd).toBe('75%');
    expect(geo.weathering).toContain('Grade II');

    // 3. Regional mapping mode
    let regionalState = fieldToReportReducer(INITIAL_FIELD_TO_REPORT_STATE, {
      type: 'SET_MODE',
      mode: 'REGIONAL_MAPPING'
    });
    regionalState = fieldToReportReducer(regionalState, { type: 'NEW_STATION' });
    regionalState = fieldToReportReducer(regionalState, { type: 'RUN_AI_EXTRACTION' });
    const reg = regionalState.traverse.stations[0].extracted as any;
    expect(reg.formation).toContain('Witwatersrand');
  });

  it('flags low-confidence extractions and allows human inline override in workbench', () => {
    let state = fieldToReportReducer(INITIAL_FIELD_TO_REPORT_STATE, { type: 'NEW_STATION' });
    // Simulate noisy audio causing low confidence (e.g. 61%)
    state = fieldToReportReducer(state, { type: 'RUN_AI_EXTRACTION', simulatedError: true });
    expect(state.traverse.stations[0].status).toBe('FLAGGED_LOW_CONFIDENCE');
    expect(state.traverse.stations[0].confidence).toBeLessThan(0.7);

    // Human geologist corrects strike to 15 degrees in verification workbench
    state = fieldToReportReducer(state, {
      type: 'OVERRIDE_MEASUREMENT',
      stationId: 'ST-001',
      field: 'strike',
      value: 15
    });
    expect(state.traverse.stations[0].status).toBe('EDITED');
    expect(state.traverse.stations[0].confidence).toBe(1.0);
    expect((state.traverse.stations[0].extracted as any).strike).toBe(15);
  });

  it('enforces safety guardrail: reports can only compile approved stations', () => {
    let state = fieldToReportReducer(INITIAL_FIELD_TO_REPORT_STATE, { type: 'NEW_STATION' });
    state = fieldToReportReducer(state, { type: 'RUN_AI_EXTRACTION' });

    // Attempt compiling report before approval
    state = fieldToReportReducer(state, { type: 'GENERATE_REPORT' });
    expect(state.report.archiveZipReady).toBe(false);
    expect(state.auditLog[0].msg).toContain('REPORT GENERATION HALTED');

    // Geologist approves station
    state = fieldToReportReducer(state, { type: 'APPROVE_STATION', stationId: 'ST-001' });
    expect(state.traverse.stations[0].verified).toBe(true);
    expect(state.traverse.stations[0].status).toBe('VERIFIED');

    // Now report generation succeeds
    state = fieldToReportReducer(state, { type: 'GENERATE_REPORT', theme: 'MODERN_CORPORATE' });
    expect(state.report.archiveZipReady).toBe(true);
    expect(state.report.stationCount).toBe(1);
    expect(state.report.themeUsed).toBe('MODERN_CORPORATE');
  });
});
