import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  generateStationsCsv,
  generateTraverseGeoJson,
  exportProjectArchiveZip
} from '../../src/services/archiveExporter';
import { FieldToReportState } from '../../src/domain/types';
import { INITIAL_FIELD_TO_REPORT_STATE } from '../../src/domain/reducer';

describe('Ticket 08: Complete Project Archive (.zip) & GIS Exporter', () => {
  const mockState: FieldToReportState = {
    ...INITIAL_FIELD_TO_REPORT_STATE,
    project: {
      ...INITIAL_FIELD_TO_REPORT_STATE.project,
      name: 'Bushveld Northern Lobe Traverse'
    },
    traverse: {
      activeStationId: 'ST-001',
      stations: [
        {
          id: 'ST-001',
          timestamp: '2026-09-03T10:00:00Z',
          coordinates: { lat: -24.1234, lon: 29.5678, elevation: 1100 },
          azimuth: 45,
          photos: [
            {
              id: 'IMG_01',
              caption: 'Pyroxenite outcrop with chromitite stringers',
              azimuth: 45,
              timestamp: '2026-09-03T10:05:00Z'
            }
          ],
          audio: {
            durationSec: 20,
            rawSpeechText: 'Pyroxenite with chromitite seams, strike 045 dip 60 SE, sample SMP-501.'
          },
          extracted: {
            lithology: 'Pyroxenite with chromitite seams',
            mineralization: 'Chromitite, PGE sulfides',
            alteration: 'Serpentinized',
            strike: 45,
            dip: 60,
            dipDirection: 'SE',
            sampleId: 'SMP-501'
          },
          status: 'VERIFIED',
          verified: true
        },
        {
          id: 'ST-002',
          timestamp: '2026-09-03T10:30:00Z',
          coordinates: { lat: -24.1250, lon: 29.5690, elevation: 1090 },
          azimuth: 90,
          photos: [],
          extracted: {
            lithology: 'Anorthosite footwall',
            strike: 45,
            dip: 55,
            dipDirection: 'SE'
          },
          status: 'EXTRACTED',
          verified: false
        }
      ]
    }
  };

  it('generates compliant stations.csv with headers, metadata, and structural readings', () => {
    const csv = generateStationsCsv(mockState.traverse.stations);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe(
      'station_id,timestamp,latitude,longitude,elevation_m,lithology,alteration,mineralization,strike_deg,dip_deg,dip_direction,sample_id,status,verified,raw_transcript'
    );

    // Row 1 (ST-001)
    expect(lines[1]).toContain('ST-001');
    expect(lines[1]).toContain('-24.1234');
    expect(lines[1]).toContain('29.5678');
    expect(lines[1]).toContain('Pyroxenite with chromitite seams');
    expect(lines[1]).toContain('SMP-501');
    expect(lines[1]).toContain('TRUE');

    // Row 2 (ST-002)
    expect(lines[2]).toContain('ST-002');
    expect(lines[2]).toContain('FALSE');
  });

  it('generates valid RFC 7946 GeoJSON with Point stations and traverse LineString', () => {
    const geojson = generateTraverseGeoJson(mockState);

    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(3); // 2 Point features + 1 LineString feature

    // Check Point feature
    const pt1 = geojson.features[0];
    expect(pt1.geometry.type).toBe('Point');
    expect(pt1.geometry.coordinates).toEqual([29.5678, -24.1234, 1100]); // [lon, lat, elev]
    expect(pt1.properties.id).toBe('ST-001');
    expect(pt1.properties.strike).toBe(45);
    expect(pt1.properties.dip).toBe(60);
    expect(pt1.properties.sampleId).toBe('SMP-501');

    // Check LineString feature
    const line = geojson.features[2];
    expect(line.geometry.type).toBe('LineString');
    expect(line.properties.layer).toBe('Traverse Route');
    expect(line.geometry.coordinates).toHaveLength(2);
  });

  it('compiles complete ZIP archive containing docx, csv, geojson, and media folders', async () => {
    const zipBlob = await exportProjectArchiveZip(mockState);
    expect(zipBlob).toBeDefined();
    expect(zipBlob.size).toBeGreaterThan(2000);

    // Unzip and assert internal file structure
    const buffer = await zipBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file('report.docx')).not.toBeNull();
    expect(zip.file('stations.csv')).not.toBeNull();
    expect(zip.file('spatial_data.geojson')).not.toBeNull();

    // Check content of stations.csv inside ZIP
    const csvContent = await zip.file('stations.csv')?.async('text');
    expect(csvContent).toContain('ST-001');
    expect(csvContent).toContain('Pyroxenite');

    // Check content of spatial_data.geojson inside ZIP
    const geoJsonContent = await zip.file('spatial_data.geojson')?.async('text');
    expect(geoJsonContent).toContain('Bushveld');
    const parsed = JSON.parse(geoJsonContent || '{}');
    expect(parsed.type).toBe('FeatureCollection');
  });
});
