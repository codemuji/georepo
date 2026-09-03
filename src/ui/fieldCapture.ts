import {
  fieldToReportReducer,
  INITIAL_FIELD_TO_REPORT_STATE
} from '../domain/reducer';
import { FieldToReportState } from '../domain/types';
import {
  openGeoDatabase,
  saveStationToDb,
  getAllStationsFromDb,
  saveAudioBlobToDb,
  savePhotoBlobToDb
} from '../storage/db';
import { getCurrentCoordinates, compassService } from '../services/sensors';
import { audioRecorderService } from '../services/audio';

export class FieldCaptureApp {
  private state: FieldToReportState = { ...INITIAL_FIELD_TO_REPORT_STATE };
  private recordingDuration: number = 0;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    try {
      await openGeoDatabase();
      const savedStations = await getAllStationsFromDb();
      if (savedStations.length > 0) {
        this.state = {
          ...this.state,
          traverse: {
            activeStationId: savedStations[savedStations.length - 1].id,
            stations: savedStations
          },
          network: {
            ...this.state.network,
            pendingSyncCount: savedStations.filter((s) => s.status === 'OFFLINE_CACHED').length
          }
        };
      }
    } catch (err) {
      console.warn('IndexedDB initial load error:', err);
    }

    this.render();
  }

  private dispatch(action: Parameters<typeof fieldToReportReducer>[1]): void {
    this.state = fieldToReportReducer(this.state, action);
    this.syncActiveStationToDb();
    this.render();
  }

  private async syncActiveStationToDb(): Promise<void> {
    const active = this.state.traverse.stations.find(
      (s) => s.id === this.state.traverse.activeStationId
    );
    if (active) {
      try {
        await saveStationToDb(active);
      } catch (err) {
        console.warn('Failed to persist station to IndexedDB:', err);
      }
    }
  }

  public render(): void {
    const isOnline = this.state.network.isOnline;
    const activeStation = this.state.traverse.stations.find(
      (s) => s.id === this.state.traverse.activeStationId
    );
    const heading = compassService.getHeading();
    const isRecording = audioRecorderService.isRecording();

    this.container.innerHTML = `
      <div class="field-container">
        <!-- Top Status Bar -->
        <header class="field-header">
          <div>
            <div class="brand-title">GeoRepo &bull; Field Edge</div>
            <div class="campaign-name">${this.state.project.name}</div>
          </div>
          <div class="header-badges">
            <span class="badge ${isOnline ? 'badge-online' : 'badge-offline'}">
              ${isOnline ? 'Online (Basecamp)' : 'Offline Edge Cache'}
            </span>
            <span class="badge badge-neutral">
              ${this.state.network.pendingSyncCount} unsynced
            </span>
          </div>
        </header>

        <!-- Live Sensor Telemetry Strip -->
        <div class="telemetry-bar">
          <div class="telemetry-chip">
            <span class="telemetry-label">GPS Fix:</span>
            <span class="telemetry-value">
              ${activeStation ? `${activeStation.coordinates.lat.toFixed(4)}°, ${activeStation.coordinates.lon.toFixed(4)}°` : 'Ready to lock'}
            </span>
          </div>
          <div class="telemetry-chip">
            <span class="telemetry-label">Elevation:</span>
            <span class="telemetry-value">
              ${activeStation?.coordinates.elevation ? `${activeStation.coordinates.elevation}m` : '--'}
            </span>
          </div>
          <div class="telemetry-chip">
            <span class="telemetry-label">Azimuth:</span>
            <span class="telemetry-value">${heading}° ${this.getCompassRose(heading)}</span>
          </div>
        </div>

        <!-- Main Station Card -->
        <div class="station-card">
          <div class="station-header">
            <div>
              <span class="station-tag">Active Station</span>
              <h2 class="station-id">${activeStation ? activeStation.id : 'No Station Active'}</h2>
            </div>
            ${activeStation ? `<span class="status-pill status-${activeStation.status.toLowerCase()}">${activeStation.status}</span>` : ''}
          </div>

          <!-- Primary 10-Second Field Action Row -->
          <div class="action-grid">
            <!-- 1. Lock Station GPS -->
            <button id="btnNewStation" class="field-btn btn-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              <span>+ New Station</span>
            </button>

            <!-- 2. Record Voice Memo -->
            <button id="btnVoiceMemo" class="field-btn ${isRecording ? 'btn-danger pulsing' : 'btn-accent'}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              <span>${isRecording ? `Stop (${this.recordingDuration}s)` : 'Speak Memo'}</span>
            </button>

            <!-- 3. Snap Photo with Compass -->
            <label class="field-btn btn-secondary" style="cursor: pointer;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span>Snap Photo</span>
              <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display: none;" />
            </label>
          </div>

          <!-- Active Station Summary Details -->
          ${activeStation ? `
            <div class="details-section">
              <div class="field-meta-row">
                <span class="meta-label">Observation Audio:</span>
                <span class="meta-value">
                  ${activeStation.audio ? `${activeStation.audio.durationSec}s memo attached` : 'No recording yet'}
                </span>
              </div>
              <div class="field-meta-row">
                <span class="meta-label">Outcrop Photos:</span>
                <span class="meta-value">${activeStation.photos.length} photo(s) captured</span>
              </div>
              ${activeStation.audio?.rawSpeechText ? `
                <div class="transcript-box">
                  <strong>Field Note:</strong> "${activeStation.audio.rawSpeechText}"
                </div>
              ` : ''}
            </div>
          ` : `
            <div class="empty-state">
              Tap <strong>"+ New Station"</strong> to lock your first outcrop coordinates.
            </div>
          `}
        </div>

        <!-- Traverse Breadcrumb List -->
        <div class="traverse-section">
          <h3>Today's Traverse Stations (${this.state.traverse.stations.length})</h3>
          <div class="station-chips-list">
            ${this.state.traverse.stations.map((st) => `
              <div class="station-chip ${st.id === activeStation?.id ? 'active' : ''}" data-id="${st.id}">
                <strong>${st.id}</strong>
                <span class="chip-coords">${st.coordinates.lat.toFixed(3)}, ${st.coordinates.lon.toFixed(3)}</span>
                <span class="chip-status">${st.photos.length}📷 ${st.audio ? '🎤' : ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // New Station
    document.getElementById('btnNewStation')?.addEventListener('click', async () => {
      const coords = await getCurrentCoordinates();
      const azimuth = compassService.getHeading();
      this.dispatch({ type: 'NEW_STATION', coordinates: coords, azimuth });
    });

    // Voice Memo
    document.getElementById('btnVoiceMemo')?.addEventListener('click', async () => {
      if (!this.state.traverse.activeStationId) {
        alert('Please tap "+ New Station" first before recording!');
        return;
      }

      if (audioRecorderService.isRecording()) {
        try {
          const result = await audioRecorderService.stopRecording();
          const targetId = this.state.traverse.activeStationId!;
          
          // Save blob to IndexedDB
          await saveAudioBlobToDb(targetId, result.blob, result.durationSec, 'Freeform field audio observation');
          
          this.dispatch({
            type: 'RECORD_AUDIO',
            durationSec: result.durationSec,
            speechText: 'Freeform field audio observation recorded on outcrop'
          });
        } catch (err) {
          console.error('Failed to stop recording:', err);
        }
      } else {
        try {
          this.recordingDuration = 0;
          audioRecorderService.setOnTickCallback((sec) => {
            this.recordingDuration = sec;
            const btn = document.getElementById('btnVoiceMemo');
            if (btn) {
              btn.querySelector('span')!.textContent = `Stop (${sec}s)`;
            }
          });
          await audioRecorderService.startRecording();
          this.render();
        } catch (err: any) {
          alert('Microphone access error: ' + err.message);
        }
      }
    });

    // Camera Photo
    document.getElementById('cameraInput')?.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;
      if (!this.state.traverse.activeStationId) {
        alert('Please tap "+ New Station" first before snapping a photo!');
        return;
      }

      const file = input.files[0];
      const targetId = this.state.traverse.activeStationId;
      const azimuth = compassService.getHeading();

      try {
        await savePhotoBlobToDb(targetId, file, azimuth, 'Outcrop photo');
        this.dispatch({
          type: 'ATTACH_PHOTO',
          stationId: targetId,
          caption: 'Outcrop photo',
          azimuth
        });
      } catch (err) {
        console.error('Failed to save photo to IndexedDB:', err);
      }
    });

    // Station Chip selector
    document.querySelectorAll('.station-chip').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) {
          this.state = {
            ...this.state,
            traverse: { ...this.state.traverse, activeStationId: id }
          };
          this.render();
        }
      });
    });
  }

  private getCompassRose(deg: number): string {
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return arr[val % 16];
  }
}
