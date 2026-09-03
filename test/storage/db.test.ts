import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  openGeoDatabase,
  saveStationToDb,
  getStationFromDb,
  getAllStationsFromDb,
  saveAudioBlobToDb,
  getAudioForStationFromDb,
  savePhotoBlobToDb,
  getPhotosForStationFromDb,
  getUnsyncedStationsFromDb,
  markStationSyncedInDb
} from '../../src/storage/db';
import { Station } from '../../src/domain/types';

describe('IndexedDB Edge Cache Persistence Layer', () => {
  let fakeIDB: IDBFactory;
  let db: IDBDatabase;

  beforeEach(async () => {
    fakeIDB = new IDBFactory();
    db = await openGeoDatabase(fakeIDB);
  });

  it('persists and retrieves a station atomically', async () => {
    const station: Station = {
      id: 'ST-001',
      timestamp: new Date().toISOString(),
      coordinates: { lat: -26.2041, lon: 28.0473, elevation: 1750, accuracy: 4.5 },
      azimuth: 45,
      photos: [],
      status: 'OFFLINE_CACHED',
      verified: false
    };

    await saveStationToDb(station, db);
    const retrieved = await getStationFromDb('ST-001', db);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('ST-001');
    expect(retrieved?.coordinates.lat).toBe(-26.2041);
    expect(retrieved?.status).toBe('OFFLINE_CACHED');
  });

  it('stores and indexes audio blobs linked to stations', async () => {
    const dummyBlob = new Blob(['mock-audio-data-riff-wav'], { type: 'audio/wav' });
    const mediaId = await saveAudioBlobToDb(
      'ST-001',
      dummyBlob,
      18,
      'Quartz vein with chalcopyrite',
      db
    );

    expect(mediaId).toContain('audio_ST-001');

    const audioRecord = await getAudioForStationFromDb('ST-001', db);
    expect(audioRecord).toBeDefined();
    expect(audioRecord?.stationId).toBe('ST-001');
    expect(audioRecord?.type).toBe('audio');
    expect(audioRecord?.durationSec).toBe(18);
    expect(audioRecord?.speechText).toContain('chalcopyrite');
  });

  it('stores multiple photo assets per station with compass azimuth', async () => {
    const photoBlob1 = new Blob(['img1-jpeg-bytes'], { type: 'image/jpeg' });
    const photoBlob2 = new Blob(['img2-jpeg-bytes'], { type: 'image/jpeg' });

    await savePhotoBlobToDb('ST-001', photoBlob1, 45, 'Outcrop wide shot', db);
    await savePhotoBlobToDb('ST-001', photoBlob2, 45, 'Hand specimen macro with coin scale', db);

    const photos = await getPhotosForStationFromDb('ST-001', db);
    expect(photos).toHaveLength(2);
    expect(photos[0].azimuth).toBe(45);
    expect(photos[1].caption).toContain('Hand specimen');
  });

  it('filters un-synced stations and marks them synced upon office upload', async () => {
    const station1: Station = {
      id: 'ST-001',
      timestamp: new Date().toISOString(),
      coordinates: { lat: -26.1, lon: 28.1 },
      photos: [],
      status: 'OFFLINE_CACHED',
      verified: false
    };

    const station2: Station = {
      id: 'ST-002',
      timestamp: new Date().toISOString(),
      coordinates: { lat: -26.2, lon: 28.2 },
      photos: [],
      status: 'OFFLINE_CACHED',
      verified: false
    };

    await saveStationToDb(station1, db);
    await saveStationToDb(station2, db);

    let unsynced = await getUnsyncedStationsFromDb(db);
    expect(unsynced).toHaveLength(2);

    // Mark ST-001 synced
    await markStationSyncedInDb('ST-001', db);

    unsynced = await getUnsyncedStationsFromDb(db);
    expect(unsynced).toHaveLength(1);
    expect(unsynced[0].id).toBe('ST-002');

    const all = await getAllStationsFromDb(db);
    expect(all).toHaveLength(2);
    const updated1 = all.find((s) => s.id === 'ST-001');
    expect(updated1?.status).toBe('SYNCED');
  });
});
