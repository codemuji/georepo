import {
  fieldToReportReducer,
  INITIAL_FIELD_TO_REPORT_STATE
} from '../domain/reducer';
import { FieldToReportState, Coordinates } from '../domain/types';
import {
  openGeoDatabase,
  saveStationToDb,
  getAllStationsFromDb,
  saveAudioBlobToDb,
  savePhotoBlobToDb
} from '../storage/db';
import { getCurrentCoordinates, compassService } from '../services/sensors';
import { audioRecorderService } from '../services/audio';
import { toast } from './toast';
import { SpatialTrackerCanvas } from './spatialTracker';
import { networkMonitor } from '../services/network';
import { syncQueueService } from '../services/sync';
import { whisperTranscriptionService } from '../services/transcription';
import { llmExtractionService } from '../services/extraction';

export class FieldCaptureApp {
  private state: FieldToReportState = { ...INITIAL_FIELD_TO_REPORT_STATE };
  private recordingDuration: number = 0;
  private container: HTMLElement;
  private spatialTracker: SpatialTrackerCanvas | null = null;
  private userCoordinates: Coordinates | null = null;

  public onSwitchToOffice?: () => void;

  public getState(): FieldToReportState {
    return this.state;
  }

  public setState(next: FieldToReportState): void {
    this.state = next;
  }

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

      // Pre-fetch user GPS fix
      this.userCoordinates = await getCurrentCoordinates();

      // Subscribe to network connectivity
      networkMonitor.subscribe((isOnline) => {
        this.state = {
          ...this.state,
          network: { ...this.state.network, isOnline }
        };
      });

      // Subscribe to sync queue progress
      syncQueueService.subscribe((ev) => {
        if (ev.stage === 'TRANSCRIBING') {
          toast.info(`Whisper transcribing ${ev.stationId} with lexicon boosting...`);
        }
      });
    } catch (err) {
      console.warn('IndexedDB / Sensor initialization notice:', err);
    }

    this.render();
    this.initSpatialCanvas();
    this.startCompassTicker();
  }

  private initSpatialCanvas(): void {
    const canvasMount = document.getElementById('spatialCanvasContainer');
    if (!canvasMount) return;

    this.spatialTracker = new SpatialTrackerCanvas({
      container: canvasMount,
      onSelectStation: (stationId: string) => {
        this.state = {
          ...this.state,
          traverse: { ...this.state.traverse, activeStationId: stationId }
        };
        this.render();
        toast.info(`Selected station ${stationId}`);
      }
    });

    const heading = compassService.getHeading();
    this.spatialTracker.updateData(
      this.state.traverse.stations,
      this.userCoordinates,
      heading
    );
  }

  private startCompassTicker(): void {
    const updateCompass = () => {
      const heading = compassService.getHeading();
      const needleEl = document.getElementById('bruntonNeedle');
      const azimuthValEl = document.getElementById('azimuthVal');
      const azimuthRoseEl = document.getElementById('azimuthRose');

      if (needleEl) {
        needleEl.style.transform = `rotate(${heading}deg)`;
      }
      if (azimuthValEl) {
        azimuthValEl.textContent = `${String(heading).padStart(3, '0')}°`;
      }
      if (azimuthRoseEl) {
        azimuthRoseEl.textContent = this.getCompassRose(heading);
      }

      // Update spatial tracker heading marker
      if (this.spatialTracker) {
        this.spatialTracker.updateData(
          this.state.traverse.stations,
          this.userCoordinates,
          heading
        );
      }

      requestAnimationFrame(updateCompass);
    };

    requestAnimationFrame(updateCompass);
  }

  private dispatch(action: Parameters<typeof fieldToReportReducer>[1]): void {
    this.state = fieldToReportReducer(this.state, action);
    this.syncActiveStationToDb();
    this.render();

    if (this.spatialTracker) {
      const heading = compassService.getHeading();
      this.spatialTracker.updateData(
        this.state.traverse.stations,
        this.userCoordinates,
        heading
      );
    }
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

    // Structural strike & dip readings
    const strike = (activeStation?.extracted as any)?.strike ?? activeStation?.azimuth ?? heading;
    const dip = (activeStation?.extracted as any)?.dip ?? 45;
    const dipDir = (activeStation?.extracted as any)?.dipDirection ?? 'SE';

    this.container.innerHTML = `
      <div class="field-container">
        <!-- Top Status Bar -->
        <header class="field-header">
          <div class="brand-wrapper">
            <div class="geology-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 4l-4 4L6 3.5 3.5 6l4.5 4.5-4 4L8 18l4-4 4.5 4.5 2.5-2.5-4.5-4.5 4-4L14.5 4z"/>
                <path d="M18 14l3.5 3.5a2.12 2.12 0 0 1-3 3L15 17"/>
              </svg>
            </div>
            <div>
              <div class="brand-title">GeoRepo &bull; Field Edge</div>
              <div class="campaign-tag">
                <span>Traverse Concession:</span>
                <strong>${this.state.project.name}</strong>
              </div>
            </div>
          </div>
          <div class="header-badges">
            <span class="badge ${isOnline ? 'badge-online' : 'badge-offline'}">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:currentColor;"></span>
              ${isOnline ? 'Basecamp Online' : 'Offline Edge'}
            </span>
            <button id="btnHeaderSync" class="badge badge-neutral tabular-nums" style="cursor: pointer; background: var(--geo-slate); border-color: var(--ochre-amber); color: #fff;" title="Click to sync queue to office database">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>${this.state.network.pendingSyncCount} sync</span>
            </button>
            <button id="btnHeaderOffice" class="badge badge-neutral" style="cursor: pointer; background: var(--geo-slate); border-color: var(--azurite-blue); color: #fff;" title="Switch to Office Verification Workbench">
              💻 Office
            </button>
          </div>
        </header>

        <!-- Brunton Compass-Clinometer Instrument Deck -->
        <div class="instrument-deck">
          <div class="brunton-dial-container">
            <div class="compass-bezel">
              <div id="bruntonNeedle" class="compass-needle" style="transform: rotate(${heading}deg);"></div>
              <div class="compass-center-pin"></div>
              <span class="compass-cardinal cardinal-n">N</span>
              <span class="compass-cardinal cardinal-e">E</span>
              <span class="compass-cardinal cardinal-s">S</span>
              <span class="compass-cardinal cardinal-w">W</span>
            </div>
            <div class="instrument-readout">
              <div class="azimuth-value tabular-nums">
                <span id="azimuthVal">${String(heading).padStart(3, '0')}°</span>
                <span id="azimuthRose" class="azimuth-rose">${this.getCompassRose(heading)}</span>
              </div>
              <div class="instrument-sub">Magnetic Bearing &bull; Brunton Attitude</div>
            </div>
          </div>

          <div class="gps-elevation-block">
            <div class="gps-coords tabular-nums">
              ${activeStation ? `${activeStation.coordinates.lat.toFixed(4)}°, ${activeStation.coordinates.lon.toFixed(4)}°` : (this.userCoordinates ? `${this.userCoordinates.lat.toFixed(4)}°, ${this.userCoordinates.lon.toFixed(4)}°` : 'Awaiting GPS')}
            </div>
            <div class="elevation-pill tabular-nums">
              ${activeStation?.coordinates.elevation ? `Alt: ${activeStation.coordinates.elevation}m` : (this.userCoordinates?.elevation ? `Alt: ${this.userCoordinates.elevation}m` : 'Datum: WGS84')}
            </div>
          </div>
        </div>

        <!-- Offline Spatial Breadcrumb Tracker (Zero-Tile Vector Canvas) -->
        <div class="spatial-tracker-card">
          <div class="spatial-header-bar">
            <div class="spatial-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              <span>Offline Spatial Breadcrumb Canvas</span>
            </div>
            <div class="spatial-controls">
              <button id="btnZoomIn" class="spatial-btn" title="Zoom in">+</button>
              <button id="btnZoomOut" class="spatial-btn" title="Zoom out">-</button>
              <button id="btnRecenter" class="spatial-btn" title="Recenter traverse">Recenter</button>
            </div>
          </div>
          <div id="spatialCanvasContainer" class="spatial-canvas-container"></div>
        </div>

        <!-- Geological Specimen Ticket / Station Card -->
        <div class="station-specimen-card">
          <div class="specimen-header">
            <div>
              <div class="station-title-row">
                <h2 class="station-id">${activeStation ? activeStation.id : 'NO ACTIVE STATION'}</h2>
                <span class="datum-badge">OUTCROP TICKET</span>
              </div>
              <div style="font-size: 11px; color: var(--strata-muted); margin-top: 2px;">
                ${activeStation ? new Date(activeStation.timestamp).toLocaleTimeString() : 'Ready for observation'}
              </div>
            </div>
            ${activeStation ? `<span class="status-pill status-${activeStation.status.toLowerCase()}">${activeStation.status}</span>` : ''}
          </div>

          <!-- Structural Strike & Dip Visualizer Plate -->
          <div class="strike-dip-plate">
            <div class="strike-dip-label">Structural Orientation:</div>
            <div class="strike-dip-value tabular-nums">
              <svg class="strike-symbol-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="12" y1="12" x2="12" y2="18" />
              </svg>
              <span>Strike: ${String(strike).padStart(3, '0')}° / Dip: ${dip}° ${dipDir}</span>
            </div>
          </div>

          <!-- Primary 10-Second Glove-Friendly Field Actions -->
          <div class="action-grid">
            <!-- 1. Lock Station GPS -->
            <button id="btnNewStation" class="geo-btn btn-primary">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              <span>+ New Station</span>
            </button>

            <!-- 2. Record Freeform Voice Memo -->
            <button id="btnVoiceMemo" class="geo-btn ${isRecording ? 'btn-danger pulsing-record' : 'btn-accent'}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              <span>${isRecording ? `Stop (${this.recordingDuration}s)` : 'Speak Memo'}</span>
            </button>

            <!-- 3. Snap Photo with Orientation -->
            <label class="geo-btn btn-secondary" style="cursor: pointer;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span>Snap Photo</span>
              <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display: none;" />
            </label>
          </div>

          <!-- Active Station Geological Details -->
          ${activeStation ? `
            <div class="details-section">
              <div class="field-meta-row">
                <span class="meta-label">Petrology / Lithology:</span>
                <span class="meta-value" style="color: var(--pyrite-gold);">
                  ${(activeStation.extracted as any)?.lithology ?? 'Awaiting speech synthesis'}
                </span>
              </div>
              <div class="field-meta-row">
                <span class="meta-label">Voice Dictation Asset:</span>
                <span class="meta-value tabular-nums">
                  ${activeStation.audio ? `${activeStation.audio.durationSec}s audio memo linked` : 'No audio memo'}
                </span>
              </div>
              <div class="field-meta-row">
                <span class="meta-label">Specimen Photo Gallery:</span>
                <span class="meta-value">${activeStation.photos.length} captured</span>
              </div>
              ${activeStation.audio?.rawSpeechText ? `
                <div class="field-note-quote">
                  &ldquo;${activeStation.audio.rawSpeechText}&rdquo;
                </div>
              ` : ''}

              <!-- Photo Thumbnail Chips -->
              ${activeStation.photos.length > 0 ? `
                <div class="photo-thumb-deck">
                  ${activeStation.photos.map((p, idx) => `
                    <div class="photo-thumb-chip">
                      <span>📷 #${idx + 1}</span>
                      <span style="color: var(--ochre-amber);">${p.azimuth ?? 0}°</span>
                      <span style="color: var(--strata-muted); font-size: 10px;">${p.caption ?? 'Outcrop'}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          ` : `
            <div style="text-align: center; padding: 20px; color: var(--strata-muted); font-size: 13px;">
              Ready to map. Tap <strong>"+ New Station"</strong> to log coordinates at this outcrop.
            </div>
          `}
        </div>

        <!-- Traverse Sequence (Staggered Animation) -->
        <div class="traverse-section">
          <div class="section-header-row">
            <h3>Traverse Stations Log (${this.state.traverse.stations.length})</h3>
            <button id="btnQuickSimulate" style="background: transparent; border: none; color: var(--ochre-amber); font-size: 11px; cursor: pointer; text-decoration: underline;">
              + Mock Traverse Data
            </button>
          </div>
          <div class="station-chips-list">
            ${this.state.traverse.stations.map((st) => `
              <div class="station-chip ${st.id === activeStation?.id ? 'active' : ''}" data-id="${st.id}">
                <div class="chip-id-group">
                  <div class="rock-indicator"></div>
                  <div>
                    <strong style="font-family: var(--font-mono); font-size: 14px;">${st.id}</strong>
                    <div style="font-size: 11px; color: var(--strata-muted);">
                      ${(st.extracted as any)?.lithology ?? 'Field Station'}
                    </div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div class="chip-coords tabular-nums">${st.coordinates.lat.toFixed(3)}°, ${st.coordinates.lon.toFixed(3)}°</div>
                  <div style="font-size: 11px; color: var(--pyrite-gold);">${st.photos.length}📷 ${st.audio ? '🎤' : ''}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.initSpatialCanvas();
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Spatial Canvas Controls
    document.getElementById('btnZoomIn')?.addEventListener('click', () => {
      this.spatialTracker?.zoomIn();
    });
    document.getElementById('btnZoomOut')?.addEventListener('click', () => {
      this.spatialTracker?.zoomOut();
    });
    document.getElementById('btnRecenter')?.addEventListener('click', () => {
      this.spatialTracker?.recenter();
      toast.info('Spatial canvas re-centered to traverse origin');
    });

    // Sync Queue Button
    document.getElementById('btnHeaderSync')?.addEventListener('click', async () => {
      if (!this.state.network.isOnline) {
        this.dispatch({ type: 'TOGGLE_ONLINE', forceOnline: true });
        toast.info('Switched network to Online (Basecamp Wi-Fi)');
      }
      try {
        toast.info('Starting sync queue with Whisper transcription...');
        const res = await syncQueueService.processQueue(this.state.project.lexicon);
        const reloaded = await getAllStationsFromDb();
        this.state = {
          ...this.state,
          traverse: { ...this.state.traverse, stations: reloaded },
          network: {
            ...this.state.network,
            pendingSyncCount: reloaded.filter((s) => s.status === 'OFFLINE_CACHED').length
          }
        };
        this.render();
        toast.success(`Synced & transcribed ${res.syncedCount} station(s) with Whisper!`);
      } catch (err: any) {
        toast.warning(err.message);
      }
    });

    // Office Workbench Switcher
    document.getElementById('btnHeaderOffice')?.addEventListener('click', () => {
      if (this.onSwitchToOffice) {
        this.onSwitchToOffice();
      }
    });

    // 1. New Station
    document.getElementById('btnNewStation')?.addEventListener('click', async () => {
      const coords = await getCurrentCoordinates();
      this.userCoordinates = coords;
      const azimuth = compassService.getHeading();
      this.dispatch({ type: 'NEW_STATION', coordinates: coords, azimuth });
      toast.success(`Locked Station at ${coords.lat}°, ${coords.lon}°`);
    });

    // 2. Voice Memo
    document.getElementById('btnVoiceMemo')?.addEventListener('click', async () => {
      if (!this.state.traverse.activeStationId) {
        toast.warning('Please tap "+ New Station" first before recording!');
        return;
      }

      if (audioRecorderService.isRecording()) {
        const btn = document.getElementById('btnVoiceMemo') as HTMLButtonElement;
        if (btn) {
          btn.innerHTML = '<span class="transcribing-pulse">⚡ Transcribing via Groq...</span>';
          btn.disabled = true;
        }

        try {
          const result = await audioRecorderService.stopRecording();
          const targetId = this.state.traverse.activeStationId!;
          let speechText = result.liveTranscript || '';

          // If online and API key exists (e.g. VITE_GROQ_API_KEY), transcribe immediately
          const isOnline = this.state.network.isOnline;
          const hasApiKey = typeof import.meta !== 'undefined' && import.meta.env &&
            (import.meta.env.VITE_GROQ_API_KEY || import.meta.env.VITE_OPENAI_API_KEY);

          if (isOnline && hasApiKey) {
            toast.info('Sending audio to Groq Whisper Large V3...');
            try {
              const whisperText = await whisperTranscriptionService.transcribe(result.blob, {
                lexicon: this.state.project.lexicon
              });
              if (whisperText && whisperText.trim()) {
                speechText = whisperText.trim();
                toast.success('Transcribed via Groq Whisper!');
              }
            } catch (err: any) {
              console.warn('Groq transcription notice:', err);
              toast.warning('Whisper notice: ' + (err?.message || 'Audio saved'));
            }
          }

          if (!speechText) {
            speechText = 'Audio memo recorded (Awaiting office transcription)';
          }

          await saveAudioBlobToDb(targetId, result.blob, result.durationSec, speechText);

          this.dispatch({
            type: 'RECORD_AUDIO',
            durationSec: result.durationSec,
            speechText
          });

          // Auto-run LLM extraction if real speech was transcribed
          if (speechText && speechText !== 'Audio memo recorded (Awaiting office transcription)') {
            llmExtractionService.extractFromSpeech(
              speechText,
              this.state.project.mode,
              this.state.project.lexicon
            ).then((res) => {
              this.dispatch({
                type: 'RUN_AI_EXTRACTION',
                stationId: targetId,
                customAttributes: res.extracted,
                confidence: res.confidence
              });
              toast.success(`Extracted geological attributes (${(res.confidence * 100).toFixed(0)}% confidence)`);
            }).catch(() => {});
          }

          this.render();
        } catch (err: any) {
          toast.warning('Failed to finalize recording: ' + err.message);
          this.render();
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
          toast.info('Recording started. Speak your field observations freely...');
          this.render();
        } catch (err: any) {
          toast.warning('Microphone error: ' + (err?.message || 'Access denied or no microphone found'));
        }
      }
    });

    // 3. Camera Photo
    document.getElementById('cameraInput')?.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;
      if (!this.state.traverse.activeStationId) {
        toast.warning('Tap "+ New Station" first before snapping a photo!');
        return;
      }

      const file = input.files[0];
      const targetId = this.state.traverse.activeStationId;
      const azimuth = compassService.getHeading();

      try {
        await savePhotoBlobToDb(targetId, file, azimuth, 'Outcrop wall');
        this.dispatch({
          type: 'ATTACH_PHOTO',
          stationId: targetId,
          caption: 'Outcrop wall',
          azimuth
        });
        toast.success(`Outcrop photo captured at heading ${azimuth}°`);
      } catch (err) {
        toast.warning('Failed to save photo');
      }
    });

    // Station selection
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

    // Quick mock traverse data for testing
    document.getElementById('btnQuickSimulate')?.addEventListener('click', () => {
      const azimuths = [45, 90, 135];
      const titles = [
        'Conglomerate bed with pyritic matrix',
        'Fine-grained quartzite with cross-bedding',
        'Diabase dike contact with hornfels'
      ];

      const idx = this.state.traverse.stations.length;
      const lat = -26.2041 + (idx * 0.005);
      const lon = 28.0473 + (idx * 0.003);

      this.userCoordinates = { lat, lon, elevation: 1750 - (idx * 15), accuracy: 4.0 };

      this.dispatch({
        type: 'NEW_STATION',
        coordinates: this.userCoordinates,
        azimuth: azimuths[idx % 3]
      });

      this.dispatch({
        type: 'RECORD_AUDIO',
        durationSec: 18 + (idx * 3),
        speechText: titles[idx % 3] + ', strike 045 dip 60 SE, collected sample SMP-' + (100 + idx)
      });

      toast.success(`Logged mock station with strike 045°/60°`);
    });
  }

  private getCompassRose(deg: number): string {
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return arr[val % 16];
  }
}
