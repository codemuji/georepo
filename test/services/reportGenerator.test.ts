import { describe, it, expect } from 'vitest';
import {
  generateGeologicalReportDocx,
  getThemeConfig
} from '../../src/services/reportGenerator';
import { FieldToReportState } from '../../src/domain/types';
import { INITIAL_FIELD_TO_REPORT_STATE } from '../../src/domain/reducer';

describe('Ticket 07: Decorated Word (.docx) Report Generator', () => {
  const mockState: FieldToReportState = {
    ...INITIAL_FIELD_TO_REPORT_STATE,
    project: {
      ...INITIAL_FIELD_TO_REPORT_STATE.project,
      name: 'Witwatersrand Basin Concession A',
      theme: 'MODERN_CORPORATE'
    },
    traverse: {
      activeStationId: 'ST-001',
      stations: [
        {
          id: 'ST-001',
          timestamp: new Date().toISOString(),
          coordinates: { lat: -26.2041, lon: 28.0473, elevation: 1750 },
          azimuth: 45,
          photos: [
            {
              id: 'IMG_01',
              caption: 'Outcrop highwall with pyritic bedding',
              azimuth: 45,
              timestamp: new Date().toISOString()
            }
          ],
          audio: {
            durationSec: 18,
            rawSpeechText: 'Quartz-pebble conglomerate belonging to Witwatersrand Supergroup with chalcopyrite blebs, strike 045 dip 60 SE, sample SMP-102.'
          },
          extracted: {
            lithology: 'Quartz-pebble conglomerate',
            mineralization: 'Chalcopyrite blebs',
            alteration: 'Sericitic halo',
            strike: 45,
            dip: 60,
            dipDirection: 'SE',
            sampleId: 'SMP-102'
          },
          status: 'VERIFIED',
          verified: true
        }
      ]
    }
  };

  it('provides distinct color palettes and typography for all 3 themes', () => {
    const modern = getThemeConfig('MODERN_CORPORATE');
    expect(modern.primaryColor).toBe('1E3A8A'); // Deep navy
    expect(modern.fontFamily).toBe('Calibri');

    const technical = getThemeConfig('CLASSIC_TECHNICAL');
    expect(technical.primaryColor).toBe('14532D'); // Forest green
    expect(technical.fontFamily).toBe('Segoe UI');

    const academic = getThemeConfig('GEOLOGICAL_SURVEY');
    expect(academic.primaryColor).toBe('78350F'); // Earth sienna
    expect(academic.fontFamily).toBe('Times New Roman');
  });

  it('compiles verified stations into an OpenXML .docx blob', async () => {
    const docBlob = await generateGeologicalReportDocx(mockState, {
      author: 'Dr. Jane Murchison',
      credentials: 'Pr.Sci.Nat, FGSSA, CP',
      company: 'Witwatersrand Geoscience Ltd.'
    });

    expect(docBlob).toBeDefined();
    expect(docBlob.size).toBeGreaterThan(1000); // Valid Word file has non-trivial size
  });

  it('compiles successfully across all report themes without error', async () => {
    const themes: Array<'MODERN_CORPORATE' | 'CLASSIC_TECHNICAL' | 'GEOLOGICAL_SURVEY'> = [
      'MODERN_CORPORATE',
      'CLASSIC_TECHNICAL',
      'GEOLOGICAL_SURVEY'
    ];

    for (const theme of themes) {
      const themedState = {
        ...mockState,
        project: { ...mockState.project, theme }
      };
      const blob = await generateGeologicalReportDocx(themedState);
      expect(blob.size).toBeGreaterThan(1000);
    }
  });
});
