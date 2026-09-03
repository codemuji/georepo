import {
  getUnsyncedStationsFromDb,
  getAudioForStationFromDb,
  getPhotosForStationFromDb,
  saveStationToDb,
  markStationSyncedInDb
} from '../storage/db';
import { whisperTranscriptionService } from './transcription';
import { networkMonitor, NetworkMonitorService } from './network';

export interface SyncProgressEvent {
  current: number;
  total: number;
  stationId: string;
  stage: 'PREPARING' | 'TRANSCRIBING' | 'UPLOADING' | 'COMPLETED' | 'ERROR';
  error?: string;
}

export type SyncProgressListener = (event: SyncProgressEvent) => void;

export class SyncQueueService {
  private isSyncing: boolean = false;
  private listeners: Set<SyncProgressListener> = new Set();
  private autoSyncEnabled: boolean = true;
  private network: NetworkMonitorService;
  private customDb?: IDBDatabase;

  constructor(
    networkService: NetworkMonitorService = networkMonitor,
    customDb?: IDBDatabase
  ) {
    this.network = networkService;
    this.customDb = customDb;
    // Auto-sync trigger when network switches online
    this.network.subscribe((isOnline: boolean) => {
      if (isOnline && this.autoSyncEnabled && !this.isSyncing) {
        this.processQueue().catch((err) => console.warn('Auto-sync notice:', err));
      }
    });
  }

  public setAutoSyncEnabled(enabled: boolean): void {
    this.autoSyncEnabled = enabled;
  }

  public subscribe(listener: SyncProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(event: SyncProgressEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  public async processQueue(
    lexicon: string[] = [],
    customDb?: IDBDatabase
  ): Promise<{ syncedCount: number; errors: Array<{ stationId: string; error: string }> }> {
    if (!this.network.isOnline()) {
      throw new Error('Cannot sync queue while offline. Reconnect to network first.');
    }

    if (this.isSyncing) {
      return { syncedCount: 0, errors: [] };
    }

    this.isSyncing = true;
    const errors: Array<{ stationId: string; error: string }> = [];
    let syncedCount = 0;
    const effectiveDb = customDb || this.customDb;

    try {
      const unsyncedStations = await getUnsyncedStationsFromDb(effectiveDb);
      const total = unsyncedStations.length;

      if (total === 0) {
        this.isSyncing = false;
        return { syncedCount: 0, errors: [] };
      }

      for (let i = 0; i < total; i++) {
        const station = unsyncedStations[i];
        const stepNum = i + 1;

        try {
          this.notify({
            current: stepNum,
            total,
            stationId: station.id,
            stage: 'PREPARING'
          });

          // Fetch associated media from IndexedDB
          const audioRecord = await getAudioForStationFromDb(station.id, effectiveDb);
          const photoRecords = await getPhotosForStationFromDb(station.id, effectiveDb);

          // If raw audio exists but hasn't been transcribed yet, run Whisper with lexicon priming
          if (audioRecord && (!station.audio?.rawSpeechText || station.audio.rawSpeechText === 'Freeform field audio observation recorded on outcrop')) {
            this.notify({
              current: stepNum,
              total,
              stationId: station.id,
              stage: 'TRANSCRIBING'
            });

            const transcript = await whisperTranscriptionService.transcribe(audioRecord.blob, {
              lexicon
            });

            // Update station audio record
            station.audio = {
              durationSec: audioRecord.durationSec || 15,
              blobUrl: audioRecord.id,
              rawSpeechText: transcript
            };
          }

          // Link photo count metadata
          if (photoRecords.length > 0 && station.photos.length === 0) {
            station.photos = photoRecords.map((pr) => ({
              id: pr.id,
              blobUrl: pr.id,
              caption: pr.caption,
              azimuth: pr.azimuth,
              timestamp: pr.timestamp
            }));
          }

          this.notify({
            current: stepNum,
            total,
            stationId: station.id,
            stage: 'UPLOADING'
          });

          // Mark station synced in IndexedDB
          station.status = 'SYNCED';
          await saveStationToDb(station, effectiveDb);
          await markStationSyncedInDb(station.id, effectiveDb);

          syncedCount++;
          this.notify({
            current: stepNum,
            total,
            stationId: station.id,
            stage: 'COMPLETED'
          });
        } catch (err: any) {
          const errMsg = err?.message || 'Unknown sync failure';
          errors.push({ stationId: station.id, error: errMsg });
          this.notify({
            current: stepNum,
            total,
            stationId: station.id,
            stage: 'ERROR',
            error: errMsg
          });
        }
      }

      return { syncedCount, errors };
    } finally {
      this.isSyncing = false;
    }
  }

  public isBusy(): boolean {
    return this.isSyncing;
  }
}

export const syncQueueService = new SyncQueueService();
