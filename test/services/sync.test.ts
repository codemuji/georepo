import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  openGeoDatabase,
  saveStationToDb,
  saveAudioBlobToDb,
  getStationFromDb
} from '../../src/storage/db';
import { Station } from '../../src/domain/types';
import { NetworkMonitorService } from '../../src/services/network';
import { WhisperTranscriptionService } from '../../src/services/transcription';
import { SyncQueueService } from '../../src/services/sync';

describe('Station Sync Queue & Whisper Lexicon-Boosted Transcription', () => {
  let fakeIDB: IDBFactory;
  let db: IDBDatabase;
  let network: NetworkMonitorService;
  let whisper: WhisperTranscriptionService;

  beforeEach(async () => {
    fakeIDB = new IDBFactory();
    db = await openGeoDatabase(fakeIDB);
    network = new NetworkMonitorService();
    whisper = new WhisperTranscriptionService();
  });

  it('network monitor tracks connectivity and invokes subscribers', () => {
    let observedState = false;
    const unsubscribe = network.subscribe((status) => {
      observedState = status;
    });

    network.setSimulatedStatus(true);
    expect(observedState).toBe(true);

    network.setSimulatedStatus(false);
    expect(observedState).toBe(false);

    unsubscribe();
  });

  it('whisper prompt injection builds domain lexicon conditioning string', () => {
    const lexicon = ['Witwatersrand Supergroup', 'pyrrhotite', 'chalcopyrite'];
    const prompt = whisper.buildWhisperPrompt(lexicon);

    expect(prompt).toContain('Witwatersrand Supergroup');
    expect(prompt).toContain('pyrrhotite');
    expect(prompt).toContain('chalcopyrite');
    expect(prompt).toContain('strike');
    expect(prompt).toContain('dip');
  });

  it('sync queue processes cached stations, runs transcription, and updates status to SYNCED', async () => {
    // 1. Create offline cached station in DB
    const station: Station = {
      id: 'ST-001',
      timestamp: new Date().toISOString(),
      coordinates: { lat: -26.2041, lon: 28.0473 },
      azimuth: 45,
      photos: [],
      status: 'OFFLINE_CACHED',
      verified: false
    };
    await saveStationToDb(station, db);

    // 2. Attach audio blob to IndexedDB
    const dummyAudio = new Blob(['mock-audio-riff-bytes'], { type: 'audio/webm' });
    await saveAudioBlobToDb('ST-001', dummyAudio, 15, 'Freeform field audio observation recorded on outcrop', db);

    // 3. Instantiate sync queue
    network.setSimulatedStatus(false);
    const syncQueue = new SyncQueueService(network, db);
    syncQueue.setAutoSyncEnabled(false); // test manual processQueue execution
    const progressEvents: string[] = [];
    syncQueue.subscribe((ev) => {
      progressEvents.push(`${ev.stationId}:${ev.stage}`);
    });

    // 4. Set network online and process queue with lexicon boosting
    network.setSimulatedStatus(true);
    const lexicon = ['Witwatersrand Supergroup', 'pyrrhotite', 'chalcopyrite'];
    const result = await syncQueue.processQueue(lexicon, db);

    expect(result.syncedCount).toBe(1);
    expect(result.errors).toHaveLength(0);

    // 5. Verify station is updated to SYNCED and has domain transcript
    const updatedStation = await getStationFromDb('ST-001', db);
    expect(updatedStation).toBeDefined();
    expect(updatedStation?.status).toBe('SYNCED');
    expect(updatedStation?.audio?.rawSpeechText).toContain('Witwatersrand');
    expect(updatedStation?.audio?.rawSpeechText).toContain('pyrrhotite');

    // 6. Verify progress lifecycle
    expect(progressEvents).toContain('ST-001:PREPARING');
    expect(progressEvents).toContain('ST-001:TRANSCRIBING');
    expect(progressEvents).toContain('ST-001:UPLOADING');
    expect(progressEvents).toContain('ST-001:COMPLETED');
  });
});
