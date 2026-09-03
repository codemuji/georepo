// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { OfficeWorkbench } from '../../src/ui/officeWorkbench';
import { FieldToReportState } from '../../src/domain/types';
import { INITIAL_FIELD_TO_REPORT_STATE } from '../../src/domain/reducer';

describe('Ticket 06: Office Desktop Verification Workbench', () => {
  it('renders 3-pane desktop layout with station list, GIS map, and inspection panel', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const testState: FieldToReportState = {
      ...INITIAL_FIELD_TO_REPORT_STATE,
      traverse: {
        activeStationId: 'ST-001',
        stations: [
          {
            id: 'ST-001',
            timestamp: new Date().toISOString(),
            coordinates: { lat: -26.2041, lon: 28.0473, elevation: 1750 },
            azimuth: 45,
            photos: [],
            audio: {
              durationSec: 18,
              rawSpeechText: 'Quartz-pebble conglomerate with visible chalcopyrite blebs, strike 045 dip 60 SE, sample SMP-102.'
            },
            extracted: {
              lithology: 'Quartz-pebble conglomerate',
              mineralization: 'Chalcopyrite blebs',
              strike: 45,
              dip: 60,
              dipDirection: 'SE',
              sampleId: 'SMP-102'
            },
            status: 'EXTRACTED',
            verified: false
          },
          {
            id: 'ST-002',
            timestamp: new Date().toISOString(),
            coordinates: { lat: -26.2051, lon: 28.0483, elevation: 1740 },
            azimuth: 150,
            photos: [],
            extracted: {
              lithology: 'Quartzite',
              strike: 410, // Anomaly!
              dip: 60,
              dipDirection: 'SE'
            },
            status: 'FLAGGED_LOW_CONFIDENCE',
            confidence: 0.60,
            verified: false
          }
        ]
      }
    };

    let updatedState = testState;
    const workbench = new OfficeWorkbench({
      container,
      state: testState,
      onStateChange: (next) => {
        updatedState = next;
      },
      onSwitchToFieldMode: () => {}
    });

    workbench.render();

    // 1. Verify 3-Pane Structure
    expect(container.querySelector('.station-list-pane')).toBeTruthy();
    expect(container.querySelector('.gis-map-pane')).toBeTruthy();
    expect(container.querySelector('.inspection-pane')).toBeTruthy();

    // 2. Verify visual highlight on flagged station
    const flaggedItem = container.querySelector('.item-flagged');
    expect(flaggedItem).toBeTruthy();
    expect(flaggedItem?.textContent).toContain('ST-002');
    expect(flaggedItem?.textContent).toContain('FLAGGED');

    // 3. Test inline attribute override
    const strikeInput = container.querySelector('input[name="strike"]') as HTMLInputElement;
    expect(strikeInput).toBeTruthy();
    expect(strikeInput.value).toBe('45');

    // Simulate user editing strike to 50
    strikeInput.value = '50';
    strikeInput.dispatchEvent(new Event('change'));

    // Check state updated to EDITED
    const st001 = updatedState.traverse.stations.find((s) => s.id === 'ST-001');
    expect(st001?.status).toBe('EDITED');
    expect((st001?.extracted as any)?.strike).toBe(50);

    // 4. Test station approval
    const approveBtn = container.querySelector('#btnApproveStation') as HTMLButtonElement;
    expect(approveBtn).toBeTruthy();
    approveBtn.click();

    // Check station is verified
    const approvedSt = updatedState.traverse.stations.find((s) => s.id === 'ST-001');
    expect(approvedSt?.verified).toBe(true);
    expect(approvedSt?.status).toBe('VERIFIED');
  });
});
