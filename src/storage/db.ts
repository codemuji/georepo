import { Station } from '../domain/types';

export const DB_NAME = 'georepo_edge_db';
export const DB_VERSION = 1;

export interface MediaRecord {
  id: string;
  stationId: string;
  type: 'audio' | 'photo';
  blob: Blob;
  durationSec?: number;
  speechText?: string;
  azimuth?: number;
  caption?: string;
  timestamp: string;
}

let dbInstance: IDBDatabase | null = null;

export function openGeoDatabase(customIDBFactory?: IDBFactory): Promise<IDBDatabase> {
  const idb = customIDBFactory || (typeof window !== 'undefined' ? window.indexedDB : null);
  if (!idb) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment.'));
  }

  if (dbInstance && !customIDBFactory) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Stations store
      if (!db.objectStoreNames.contains('stations')) {
        const stationStore = db.createObjectStore('stations', { keyPath: 'id' });
        stationStore.createIndex('status', 'status', { unique: false });
        stationStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Media store (Audio blobs, full-res photos)
      if (!db.objectStoreNames.contains('media')) {
        const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
        mediaStore.createIndex('stationId', 'stationId', { unique: false });
        mediaStore.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveStationToDb(station: Station, customDb?: IDBDatabase): Promise<void> {
  const db = customDb || await openGeoDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stations', 'readwrite');
    const store = tx.objectStore('stations');
    const request = store.put(station);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getStationFromDb(id: string, customDb?: IDBDatabase): Promise<Station | undefined> {
  const db = customDb || await openGeoDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stations', 'readonly');
    const store = tx.objectStore('stations');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as Station | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllStationsFromDb(customDb?: IDBDatabase): Promise<Station[]> {
  const db = customDb || await openGeoDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stations', 'readonly');
    const store = tx.objectStore('stations');
    const request = store.getAll();

    request.onsuccess = () => resolve((request.result as Station[]) || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAudioBlobToDb(
  stationId: string,
  blob: Blob,
  durationSec: number,
  speechText?: string,
  customDb?: IDBDatabase
): Promise<string> {
  const db = customDb || await openGeoDatabase();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const mediaId = `audio_${stationId}_${Date.now()}_${randomSuffix}`;
  const record: MediaRecord = {
    id: mediaId,
    stationId,
    type: 'audio',
    blob,
    durationSec,
    speechText,
    timestamp: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');
    const request = store.put(record);

    request.onsuccess = () => resolve(mediaId);
    request.onerror = () => reject(request.error);
  });
}

export async function getAudioForStationFromDb(
  stationId: string,
  customDb?: IDBDatabase
): Promise<MediaRecord | undefined> {
  const db = customDb || await openGeoDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readonly');
    const store = tx.objectStore('media');
    const index = store.index('stationId');
    const request = index.getAll(stationId);

    request.onsuccess = () => {
      const records = (request.result as MediaRecord[]) || [];
      const audioRecord = records.find((r) => r.type === 'audio');
      resolve(audioRecord);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function savePhotoBlobToDb(
  stationId: string,
  blob: Blob,
  azimuth?: number,
  caption?: string,
  customDb?: IDBDatabase
): Promise<string> {
  const db = customDb || await openGeoDatabase();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const mediaId = `photo_${stationId}_${Date.now()}_${randomSuffix}`;
  const record: MediaRecord = {
    id: mediaId,
    stationId,
    type: 'photo',
    blob,
    azimuth,
    caption,
    timestamp: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');
    const request = store.put(record);

    request.onsuccess = () => resolve(mediaId);
    request.onerror = () => reject(request.error);
  });
}

export async function getPhotosForStationFromDb(
  stationId: string,
  customDb?: IDBDatabase
): Promise<MediaRecord[]> {
  const db = customDb || await openGeoDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readonly');
    const store = tx.objectStore('media');
    const index = store.index('stationId');
    const request = index.getAll(stationId);

    request.onsuccess = () => {
      const records = (request.result as MediaRecord[]) || [];
      resolve(records.filter((r) => r.type === 'photo'));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getUnsyncedStationsFromDb(customDb?: IDBDatabase): Promise<Station[]> {
  const all = await getAllStationsFromDb(customDb);
  return all.filter((s) => s.status === 'OFFLINE_CACHED');
}

export async function markStationSyncedInDb(stationId: string, customDb?: IDBDatabase): Promise<void> {
  const station = await getStationFromDb(stationId, customDb);
  if (!station) return;

  station.status = 'SYNCED';
  await saveStationToDb(station, customDb);
}
