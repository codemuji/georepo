import JSZip from 'jszip';
import { FieldToReportState, Station } from '../domain/types';
import { generateGeologicalReportDocx } from './reportGenerator';
import { getAudioForStationFromDb, getPhotosForStationFromDb } from '../storage/db';

export interface ArchiveExportOptions {
  customDb?: IDBDatabase;
  author?: string;
  credentials?: string;
  company?: string;
}

/**
 * Generates RFC 4180 compliant CSV of all station data and specimen samples
 */
export function generateStationsCsv(stations: Station[]): string {
  const headers = [
    'station_id',
    'timestamp',
    'latitude',
    'longitude',
    'elevation_m',
    'lithology',
    'alteration',
    'mineralization',
    'strike_deg',
    'dip_deg',
    'dip_direction',
    'sample_id',
    'status',
    'verified',
    'raw_transcript'
  ];

  const escapeCsv = (val: unknown): string => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = stations.map((st) => {
    const ext: any = st.extracted || {};
    const strike = ext.strike ?? st.azimuth ?? '';
    const dip = ext.dip ?? '';
    const dipDir = ext.dipDirection ?? '';
    const sampleId = ext.sampleId || st.sampleId || '';
    const lithology = ext.lithology || '';
    const alteration = ext.alteration || '';
    const mineralization = ext.mineralization || '';
    const transcript = st.audio?.rawSpeechText || '';

    return [
      escapeCsv(st.id),
      escapeCsv(st.timestamp),
      escapeCsv(st.coordinates.lat),
      escapeCsv(st.coordinates.lon),
      escapeCsv(st.coordinates.elevation || 1750),
      escapeCsv(lithology),
      escapeCsv(alteration),
      escapeCsv(mineralization),
      escapeCsv(strike),
      escapeCsv(dip),
      escapeCsv(dipDir),
      escapeCsv(sampleId),
      escapeCsv(st.status),
      escapeCsv(st.verified ? 'TRUE' : 'FALSE'),
      escapeCsv(transcript)
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Generates RFC 7946 compliant GeoJSON with Point stations and traverse LineString
 */
export function generateTraverseGeoJson(state: FieldToReportState): any {
  const stations = state.traverse.stations;

  // 1. Point features for each station
  const pointFeatures = stations.map((st) => {
    const ext: any = st.extracted || {};
    const strike = ext.strike ?? st.azimuth ?? null;
    const dip = ext.dip ?? null;
    const dipDirection = ext.dipDirection ?? null;
    const sampleId = ext.sampleId || st.sampleId || null;

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [st.coordinates.lon, st.coordinates.lat, st.coordinates.elevation || 1750]
      },
      properties: {
        id: st.id,
        timestamp: st.timestamp,
        lithology: ext.lithology || 'Field Outcrop',
        strike,
        dip,
        dipDirection,
        sampleId,
        status: st.status,
        verified: st.verified,
        hasAudio: !!st.audio,
        photoCount: st.photos.length,
        rawSpeechText: st.audio?.rawSpeechText || null
      }
    };
  });

  // 2. LineString feature connecting sequential traverse path
  const lineCoords = stations.map((st) => [
    st.coordinates.lon,
    st.coordinates.lat,
    st.coordinates.elevation || 1750
  ]);

  const lineFeature = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: lineCoords
    },
    properties: {
      layer: 'Traverse Route',
      concession: state.project.name,
      mode: state.project.mode,
      stationCount: stations.length
    }
  };

  return {
    type: 'FeatureCollection',
    name: `${state.project.name} Geological Traverse`,
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
    },
    features: [...pointFeatures, ...(lineCoords.length > 1 ? [lineFeature] : [])]
  };
}

/**
 * Compiles the complete project archive into a single verifiable .zip package
 */
export async function exportProjectArchiveZip(
  state: FieldToReportState,
  options: ArchiveExportOptions = {}
): Promise<Blob> {
  const zip = new JSZip();
  const stations = state.traverse.stations;

  // 1. Generate and attach Word .docx report
  try {
    const docxBlob = await generateGeologicalReportDocx(state, {
      author: options.author,
      credentials: options.credentials,
      company: options.company
    });
    const docxBuffer = await docxBlob.arrayBuffer();
    zip.file('report.docx', docxBuffer);
  } catch (err) {
    console.warn('Could not compile Word docx for zip:', err);
    zip.file('report_notice.txt', 'Microsoft Word report compilation bypassed.');
  }

  // 2. Generate and attach stations.csv
  const csvContent = generateStationsCsv(stations);
  zip.file('stations.csv', csvContent);

  // 3. Generate and attach spatial_data.geojson
  const geoJsonData = generateTraverseGeoJson(state);
  zip.file('spatial_data.geojson', JSON.stringify(geoJsonData, null, 2));

  // 4. Create and populate media/ audio and photos directories
  const audioFolder = zip.folder('audio');
  const photosFolder = zip.folder('photos');

  for (const st of stations) {
    // Audio memos
    try {
      const audioRecord = await getAudioForStationFromDb(st.id, options.customDb);
      if (audioRecord && audioRecord.blob) {
        audioFolder?.file(`${st.id}_memo.webm`, audioRecord.blob);
      } else if (st.audio?.rawSpeechText) {
        audioFolder?.file(`${st.id}_transcript.txt`, st.audio.rawSpeechText);
      }
    } catch {
      if (st.audio?.rawSpeechText) {
        audioFolder?.file(`${st.id}_transcript.txt`, st.audio.rawSpeechText);
      }
    }

    // Photo assets
    let stationPhotosWritten = 0;
    try {
      const photoRecords = await getPhotosForStationFromDb(st.id, options.customDb);
      if (photoRecords && photoRecords.length > 0) {
        photoRecords.forEach((pr, idx) => {
          photosFolder?.file(`${st.id}_photo_${idx + 1}_${pr.azimuth || 0}deg.jpg`, pr.blob);
          stationPhotosWritten++;
        });
      }
    } catch {
      // Offline fallback
    }

    if (stationPhotosWritten === 0 && st.photos.length > 0) {
      st.photos.forEach((p, idx) => {
        photosFolder?.file(
          `${st.id}_photo_${idx + 1}_meta.txt`,
          `Photo Asset: ${p.id}\nStation: ${st.id}\nCaption: ${p.caption || 'Outcrop observation'}\nAzimuth: ${p.azimuth || 0}°\nTimestamp: ${p.timestamp}`
        );
      });
    }
  }

  // 5. Package into Blob
  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

export function downloadZipBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
