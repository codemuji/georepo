import {
  fieldToReportReducer
} from '../domain/reducer';
import { FieldToReportState, Station } from '../domain/types';
import { SpatialTrackerCanvas } from './spatialTracker';
import { llmExtractionService } from '../services/extraction';
import { whisperTranscriptionService } from '../services/transcription';
import { generateGeologicalReportDocx, downloadDocxBlob } from '../services/reportGenerator';
import { exportProjectArchiveZip, downloadZipBlob } from '../services/archiveExporter';
import {
  getAudioForStationFromDb,
  getPhotosForStationFromDb,
  saveAudioBlobToDb,
  saveStationToDb
} from '../storage/db';
import { toast } from './toast';

export interface OfficeWorkbenchOptions {
  container: HTMLElement;
  state: FieldToReportState;
  onStateChange: (newState: FieldToReportState) => void;
  onSwitchToFieldMode: () => void;
}

export class OfficeWorkbench {
  private container: HTMLElement;
  private state: FieldToReportState;
  private onStateChange: (newState: FieldToReportState) => void;
  private onSwitchToFieldMode: () => void;
  private statusFilter: 'ALL' | 'FLAGGED' | 'APPROVED' | 'UNVERIFIED' = 'ALL';
  private spatialTracker: SpatialTrackerCanvas | null = null;
  private isAudioPlaying: boolean = false;

  constructor(options: OfficeWorkbenchOptions) {
    this.container = options.container;
    this.state = options.state;
    this.onStateChange = options.onStateChange;
    this.onSwitchToFieldMode = options.onSwitchToFieldMode;
  }

  public updateState(newState: FieldToReportState): void {
    this.state = newState;
    this.render();
  }

  private dispatch(action: Parameters<typeof fieldToReportReducer>[1]): void {
    const nextState = fieldToReportReducer(this.state, action);
    this.state = nextState;
    this.onStateChange(nextState);
    this.render();
  }

  public render(): void {
    const stations = this.state.traverse.stations;
    const activeStation = stations.find((s) => s.id === this.state.traverse.activeStationId) || stations[0] || null;

    // Filter stations
    const filteredStations = stations.filter((st) => {
      if (this.statusFilter === 'FLAGGED') return st.status === 'FLAGGED_LOW_CONFIDENCE';
      if (this.statusFilter === 'APPROVED') return st.verified || st.status === 'VERIFIED';
      if (this.statusFilter === 'UNVERIFIED') return !st.verified && st.status !== 'VERIFIED';
      return true;
    });

    const flaggedCount = stations.filter((s) => s.status === 'FLAGGED_LOW_CONFIDENCE').length;
    const approvedCount = stations.filter((s) => s.verified || s.status === 'VERIFIED').length;

    this.container.innerHTML = `
      <div class="workbench-layout">
        <!-- Workbench Top Navigation Bar -->
        <header class="workbench-topbar">
          <div class="workbench-brand">
            <div class="geology-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
            </div>
            <div>
              <div class="brand-title">GeoRepo &bull; Office Verification Workbench</div>
              <div class="campaign-tag">
                <span>Traverse:</span> <strong>${this.state.project.name}</strong> &bull;
                <span>Mode:</span> <strong style="color: var(--pyrite-gold);">${this.state.project.mode}</strong>
              </div>
            </div>
          </div>

          <div class="topbar-actions">
            <div class="workbench-stats">
              <span class="stat-badge stat-total">${stations.length} Total</span>
              <span class="stat-badge ${flaggedCount > 0 ? 'stat-flagged' : 'stat-neutral'}">${flaggedCount} Flagged</span>
              <span class="stat-badge stat-approved">${approvedCount} Approved</span>
            </div>
            <select id="themeSelector" class="form-input" style="padding: 4px 8px; font-size: 11px; background: var(--geo-slate);" title="Select Report Styling Theme">
              <option value="MODERN_CORPORATE" ${this.state.project.theme === 'MODERN_CORPORATE' ? 'selected' : ''}>Theme: Modern Corporate</option>
              <option value="CLASSIC_TECHNICAL" ${this.state.project.theme === 'CLASSIC_TECHNICAL' ? 'selected' : ''}>Theme: Classic Technical</option>
              <option value="GEOLOGICAL_SURVEY" ${this.state.project.theme === 'GEOLOGICAL_SURVEY' ? 'selected' : ''}>Theme: Geological Survey</option>
            </select>
            <button id="btnGenerateReport" class="workbench-btn" style="background: var(--azurite-blue); color: #fff; border: none;" title="Compile verified stations into Word .docx report">
              📄 Export .docx Report
            </button>
            <button id="btnExportZipArchive" class="workbench-btn" style="background: linear-gradient(180deg, #d97706 0%, #b45309 100%); color: #fff; border: 1px solid rgba(251, 191, 36, 0.4);" title="Export complete project archive with .docx report, CSV, GeoJSON and media files">
              📦 Export Archive (.zip)
            </button>
            <button id="btnSwitchField" class="workbench-btn btn-field-switch">
              📱 Field PWA
            </button>
          </div>
        </header>

        <!-- Main 3-Pane Desktop Grid -->
        <div class="workbench-grid">
          <!-- PANE 1: Left Station List & Filters -->
          <aside class="workbench-pane station-list-pane">
            <div class="pane-header">
              <h3>Traverse Stations (${filteredStations.length})</h3>
              <div class="filter-tabs">
                <button class="filter-tab ${this.statusFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">All</button>
                <button class="filter-tab ${this.statusFilter === 'FLAGGED' ? 'active' : ''}" data-filter="FLAGGED">
                  Flagged ${flaggedCount > 0 ? `(${flaggedCount})` : ''}
                </button>
                <button class="filter-tab ${this.statusFilter === 'APPROVED' ? 'active' : ''}" data-filter="APPROVED">Approved</button>
                <button class="filter-tab ${this.statusFilter === 'UNVERIFIED' ? 'active' : ''}" data-filter="UNVERIFIED">Pending</button>
              </div>
            </div>

            <div class="station-list-scroll">
              ${filteredStations.length === 0 ? `
                <div class="empty-list-msg">No stations matching this filter.</div>
              ` : filteredStations.map((st) => `
                <div class="workbench-station-item ${st.id === activeStation?.id ? 'active' : ''} ${st.status === 'FLAGGED_LOW_CONFIDENCE' ? 'item-flagged' : ''}" data-id="${st.id}">
                  <div class="item-header">
                    <strong class="item-id">${st.id}</strong>
                    <span class="item-status-pill status-${st.status.toLowerCase()}">
                      ${st.status === 'FLAGGED_LOW_CONFIDENCE' ? '⚠ FLAGGED' : (st.verified || st.status === 'VERIFIED' ? '✓ APPROVED' : st.status)}
                    </span>
                  </div>
                  <div class="item-lithology">
                    ${(st.extracted as any)?.lithology || 'Awaiting extraction'}
                  </div>
                  <div class="item-meta tabular-nums">
                    <span>${st.coordinates.lat.toFixed(4)}°, ${st.coordinates.lon.toFixed(4)}°</span>
                    <span>${(st.extracted as any)?.strike !== undefined ? `${(st.extracted as any)?.strike}° / ${(st.extracted as any)?.dip}°` : 'No S&D'}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </aside>

          <!-- PANE 2: Center Interactive GIS Map -->
          <main class="workbench-pane gis-map-pane">
            <div class="pane-header">
              <div class="map-title-group">
                <h3>GIS Vector Map</h3>
                <span class="map-subtitle">Traverse route &amp; oriented Strike-and-Dip symbols</span>
              </div>
              <div class="map-toolbar">
                <button id="btnMapZoomIn" class="map-tool-btn" title="Zoom in">+</button>
                <button id="btnMapZoomOut" class="map-tool-btn" title="Zoom out">-</button>
                <button id="btnMapRecenter" class="map-tool-btn" title="Recenter">Recenter</button>
              </div>
            </div>

            <div class="map-canvas-viewport" id="workbenchMapContainer">
              <canvas id="workbenchMapCanvas" class="workbench-map-canvas"></canvas>
              ${stations.length === 0 ? `
                <div class="map-empty-overlay">
                  <div class="empty-icon" style="font-size: 28px; margin-bottom: 4px;">🗺</div>
                  <h4 style="font-size: 15px; font-weight: 700; color: #fff;">GIS Vector Map Ready</h4>
                  <p style="font-size: 12px; color: var(--strata-muted); line-height: 1.4; margin: 4px 0 14px;">
                    No field traverse stations recorded in local database yet. Switch to Field PWA to record outcrops or load a sample traverse.
                  </p>
                  <button id="btnLoadSampleTraverse" class="workbench-btn" style="background: var(--ochre-amber); color: #000; font-weight: 700; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(217, 119, 6, 0.4);">
                    + Load Sample Traverse (3 Stations)
                  </button>
                </div>
              ` : ''}
            </div>
          </main>

          <!-- PANE 3: Right Inspection & Verification Panel -->
          <aside class="workbench-pane inspection-pane">
            ${activeStation ? this.renderInspectionPanel(activeStation) : `
              <div class="empty-list-msg">Select a station from the list or map to verify.</div>
            `}
          </aside>
        </div>
      </div>
    `;

    this.initMapCanvas();
    this.attachEventListeners();
  }

  private renderInspectionPanel(station: Station): string {
    const isFlagged = station.status === 'FLAGGED_LOW_CONFIDENCE';
    const isApproved = station.verified || station.status === 'VERIFIED';
    const extracted: any = station.extracted || {};
    const audio = station.audio;
    const photos = station.photos;

    return `
      <div class="inspection-content">
        <!-- Station Inspection Header -->
        <div class="inspection-header">
          <div>
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <h2 class="inspection-station-id">${station.id}</h2>
              <span class="item-status-pill status-${station.status.toLowerCase()}">
                ${isFlagged ? '⚠ Low Confidence' : (isApproved ? '✓ Verified &amp; Approved' : station.status)}
              </span>
            </div>
            <div class="inspection-coords tabular-nums">
              ${station.coordinates.lat.toFixed(5)}°, ${station.coordinates.lon.toFixed(5)}° &bull; Alt: ${station.coordinates.elevation || 1750}m
            </div>
          </div>
          <button id="btnApproveStation" class="workbench-btn ${isApproved ? 'btn-approved' : 'btn-approve-primary'}">
            ${isApproved ? '✓ Approved' : 'Approve Station ✓'}
          </button>
        </div>

        <!-- Anomaly Alert Banner if flagged -->
        ${isFlagged ? `
          <div class="anomaly-warning-banner">
            <div class="anomaly-icon">⚠</div>
            <div>
              <strong>Low Confidence / Orientation Anomaly Detected</strong>
              <div style="font-size: 11px; margin-top: 2px;">
                Calculated confidence: ${(station.confidence ? (station.confidence * 100).toFixed(0) : 60)}%. Please verify or correct the orientation angles below.
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Audio Dictation Player -->
        <div class="inspection-card">
          <div class="card-section-label" style="display: flex; justify-content: space-between; align-items: center;">
            <span>Field Audio Observation (${audio ? `${audio.durationSec}s` : 'No Audio'})</span>
            ${audio ? `
              <button id="btnTranscribeWhisper" class="workbench-btn" style="background: rgba(245, 158, 11, 0.15); border: 1px solid var(--ochre-amber); color: var(--ochre-amber); font-size: 11px; padding: 3px 8px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;">
                <span>⚡ Transcribe with Groq Whisper</span>
              </button>
            ` : ''}
          </div>
          <div class="audio-player-deck" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <button id="btnPlayAudio" class="audio-play-btn">
                ${this.isAudioPlaying ? '⏸ Pause' : '▶ Play Memo'}
              </button>
              <div class="audio-waveform-bar" style="flex: 1;">
                <div class="waveform-line ${this.isAudioPlaying ? 'animating-wave' : ''}"></div>
              </div>
            </div>
            <audio id="stationAudioPlayer" controls style="width: 100%; height: 28px; filter: invert(0.8) hue-rotate(180deg); margin-top: 2px;"></audio>
          </div>
          <div style="margin-top: 8px;">
            <label for="speechTranscriptEditor" style="font-size: 11px; color: var(--strata-muted); display: block; margin-bottom: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
              Geological Voice Transcript (Editable)
            </label>
            <textarea id="speechTranscriptEditor" class="form-input" rows="3" style="width: 100%; resize: vertical; font-size: 12px; line-height: 1.5; font-family: inherit;" placeholder="Record an audio memo in the field or edit transcribed text here...">${audio?.rawSpeechText || ''}</textarea>
          </div>
        </div>

        <!-- Specimen Photo Deck -->
        ${photos.length > 0 ? `
          <div class="inspection-card">
            <div class="card-section-label">Outcrop Photo Assets (${photos.length})</div>
            <div class="workbench-photo-gallery">
              ${photos.map((p, idx) => `
                <div class="workbench-photo-frame" data-photo-idx="${idx}">
                  <div class="photo-placeholder-graphic">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <span>📷 Photo #${idx + 1}</span>
                  </div>
                  <div class="photo-caption-bar">
                    <span>${p.caption || 'Outcrop'}</span>
                    <span style="color: var(--ochre-amber); font-weight: 700;">${p.azimuth || 0}°</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Structured Attributes Inline Editor -->
        <div class="inspection-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div class="card-section-label">Structured Geological Attributes</div>
            <button id="btnRunAiExtract" class="workbench-btn btn-ai-extract" title="Re-run LLM parsing on raw speech">
              ⚡ Re-run AI Extraction
            </button>
          </div>

          <form id="attributeEditForm" class="attribute-form-grid">
            <div class="form-field form-full">
              <label>Lithology / Rock Type</label>
              <input type="text" name="lithology" value="${extracted.lithology || ''}" class="form-input" />
            </div>

            ${this.state.project.mode === 'GEOTECHNICAL_ENGINEERING' ? `
              <div class="form-field">
                <label>RQD %</label>
                <input type="text" name="rqd" value="${extracted.rqd || ''}" class="form-input" />
              </div>
              <div class="form-field">
                <label>Joint Spacing</label>
                <input type="text" name="jointSpacing" value="${extracted.jointSpacing || ''}" class="form-input" />
              </div>
              <div class="form-field form-full">
                <label>Weathering Grade</label>
                <input type="text" name="weathering" value="${extracted.weathering || ''}" class="form-input" />
              </div>
            ` : this.state.project.mode === 'REGIONAL_MAPPING' ? `
              <div class="form-field">
                <label>Formation</label>
                <input type="text" name="formation" value="${extracted.formation || ''}" class="form-input" />
              </div>
              <div class="form-field">
                <label>Member</label>
                <input type="text" name="member" value="${extracted.member || ''}" class="form-input" />
              </div>
              <div class="form-field form-full">
                <label>Contact Relationship</label>
                <input type="text" name="contact" value="${extracted.contact || ''}" class="form-input" />
              </div>
            ` : `
              <div class="form-field form-full">
                <label>Alteration Halo</label>
                <input type="text" name="alteration" value="${extracted.alteration || ''}" class="form-input" />
              </div>
              <div class="form-field form-full">
                <label>Mineralization Blebs</label>
                <input type="text" name="mineralization" value="${extracted.mineralization || ''}" class="form-input" />
              </div>
            `}

            <!-- Strike & Dip Structural Readings -->
            <div class="form-field">
              <label>Strike Azimuth (°)</label>
              <input type="number" min="0" max="360" name="strike" value="${extracted.strike !== undefined ? extracted.strike : (station.azimuth || '')}" class="form-input tabular-nums ${extracted.strike > 360 ? 'input-error' : ''}" />
            </div>

            <div class="form-field">
              <label>Dip Angle (°)</label>
              <input type="number" min="0" max="90" name="dip" value="${extracted.dip !== undefined ? extracted.dip : 45}" class="form-input tabular-nums" />
            </div>

            <div class="form-field">
              <label>Dip Direction</label>
              <select name="dipDirection" class="form-input">
                ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((dir) => `
                  <option value="${dir}" ${extracted.dipDirection === dir ? 'selected' : ''}>${dir}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-field">
              <label>Sample Bag ID</label>
              <input type="text" name="sampleId" value="${extracted.sampleId || station.sampleId || ''}" class="form-input" />
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private initMapCanvas(): void {
    const container = document.getElementById('workbenchMapContainer');
    const canvas = document.getElementById('workbenchMapCanvas') as HTMLCanvasElement;
    if (!container || !canvas) return;

    if (this.spatialTracker) {
      this.spatialTracker.destroy();
    }

    const stations = this.state.traverse.stations;
    const activeId = this.state.traverse.activeStationId;

    this.spatialTracker = new SpatialTrackerCanvas({
      container,
      canvasElement: canvas,
      showUserPosition: false,
      activeStationId: activeId,
      onSelectStation: (stationId: string) => {
        this.state = {
          ...this.state,
          traverse: { ...this.state.traverse, activeStationId: stationId }
        };
        this.render();
        toast.info(`Selected station ${stationId}`);
      }
    });

    const activeStation = stations.find((s) => s.id === activeId) || stations[0];
    const centerCoords = activeStation
      ? activeStation.coordinates
      : { lat: -26.2041, lon: 28.0473 };

    this.spatialTracker.updateData(
      stations,
      centerCoords,
      0,
      activeId
    );
  }

  private attachEventListeners(): void {
    // Mode switcher
    document.getElementById('btnSwitchField')?.addEventListener('click', () => {
      this.onSwitchToFieldMode();
    });

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const filter = tab.getAttribute('data-filter') as typeof this.statusFilter;
        if (filter) {
          this.statusFilter = filter;
          this.render();
        }
      });
    });

    // Station selection from list
    document.querySelectorAll('.workbench-station-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        if (id) {
          this.state = {
            ...this.state,
            traverse: { ...this.state.traverse, activeStationId: id }
          };
          this.render();
        }
      });
    });

    // Map toolbar tools
    document.getElementById('btnMapZoomIn')?.addEventListener('click', () => {
      this.spatialTracker?.zoomIn();
    });
    document.getElementById('btnMapZoomOut')?.addEventListener('click', () => {
      this.spatialTracker?.zoomOut();
    });
    document.getElementById('btnMapRecenter')?.addEventListener('click', () => {
      this.spatialTracker?.recenter();
      toast.info('GIS map re-centered to traverse origin');
    });

    // Load sample traverse handler
    document.getElementById('btnLoadSampleTraverse')?.addEventListener('click', async () => {
      const sampleStations: Station[] = [
        {
          id: 'ST-001',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          coordinates: { lat: -26.2041, lon: 28.0473, elevation: 1750 },
          azimuth: 45,
          photos: [],
          audio: {
            durationSec: 18,
            rawSpeechText: 'Quartz-pebble conglomerate with visible chalcopyrite blebs, strike 045 dip 60 SE, sample SMP-101.'
          },
          extracted: {
            lithology: 'Quartz-pebble conglomerate',
            mineralization: 'Chalcopyrite blebs',
            strike: 45,
            dip: 60,
            dipDirection: 'SE',
            sampleId: 'SMP-101'
          },
          status: 'EXTRACTED',
          verified: false
        },
        {
          id: 'ST-002',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          coordinates: { lat: -26.2062, lon: 28.0495, elevation: 1735 },
          azimuth: 55,
          photos: [],
          audio: {
            durationSec: 22,
            rawSpeechText: 'Pyritic quartzite horizon, strike 055 dip 65 SE, auriferous pyrite banding, sample SMP-102.'
          },
          extracted: {
            lithology: 'Pyritic quartzite',
            mineralization: 'Fine auriferous pyrite banding',
            strike: 55,
            dip: 65,
            dipDirection: 'SE',
            sampleId: 'SMP-102'
          },
          status: 'FLAGGED_LOW_CONFIDENCE',
          confidence: 0.65,
          verified: false
        },
        {
          id: 'ST-003',
          timestamp: new Date().toISOString(),
          coordinates: { lat: -26.2085, lon: 28.0520, elevation: 1720 },
          azimuth: 60,
          photos: [],
          audio: {
            durationSec: 15,
            rawSpeechText: 'Diabase dike cross-cutting sedimentary strata with hornfels contact, strike 060 dip 70 SE.'
          },
          extracted: {
            lithology: 'Diabase dike contact',
            mineralization: 'Disseminated pyrrhotite',
            strike: 60,
            dip: 70,
            dipDirection: 'SE',
            sampleId: 'SMP-103'
          },
          status: 'VERIFIED',
          verified: true
        }
      ];

      for (const st of sampleStations) {
        await saveStationToDb(st);
      }

      this.state = {
        ...this.state,
        traverse: {
          activeStationId: 'ST-001',
          stations: sampleStations
        }
      };
      this.onStateChange(this.state);
      this.render();
      toast.success('Loaded sample 3-station traverse with strike/dip measurements!');
    });

    // Real HTML5 Audio Player & Waveform Sync
    const audioEl = document.getElementById('stationAudioPlayer') as HTMLAudioElement;
    const playBtn = document.getElementById('btnPlayAudio') as HTMLButtonElement;
    const activeStation = this.state.traverse.stations.find(
      (s) => s.id === this.state.traverse.activeStationId
    ) || this.state.traverse.stations[0];

    if (audioEl && activeStation) {
      if (activeStation.audio?.blobUrl) {
        audioEl.src = activeStation.audio.blobUrl;
      } else {
        getAudioForStationFromDb(activeStation.id).then((rec) => {
          if (rec?.blob) {
            audioEl.src = URL.createObjectURL(rec.blob);
          }
        }).catch(() => {});
      }

      audioEl.onplay = () => {
        this.isAudioPlaying = true;
        if (playBtn) playBtn.textContent = '⏸ Pause';
        document.querySelector('.waveform-line')?.classList.add('animating-wave');
      };
      audioEl.onpause = () => {
        this.isAudioPlaying = false;
        if (playBtn) playBtn.textContent = '▶ Play Memo';
        document.querySelector('.waveform-line')?.classList.remove('animating-wave');
      };
      audioEl.onended = () => {
        this.isAudioPlaying = false;
        if (playBtn) playBtn.textContent = '▶ Play Memo';
        document.querySelector('.waveform-line')?.classList.remove('animating-wave');
      };

      playBtn?.addEventListener('click', () => {
        if (audioEl.paused) {
          audioEl.play().catch(() => {
            toast.info('Simulating audio memo playback...');
            this.isAudioPlaying = true;
            if (playBtn) playBtn.textContent = '⏸ Pause';
            document.querySelector('.waveform-line')?.classList.add('animating-wave');
            setTimeout(() => {
              this.isAudioPlaying = false;
              if (playBtn) playBtn.textContent = '▶ Play Memo';
              document.querySelector('.waveform-line')?.classList.remove('animating-wave');
            }, 3000);
          });
        } else {
          audioEl.pause();
        }
      });
    }

    // Editable speech transcript handler
    const transcriptEditor = document.getElementById('speechTranscriptEditor') as HTMLTextAreaElement;
    if (transcriptEditor && activeStation) {
      transcriptEditor.addEventListener('change', async () => {
        const targetId = this.state.traverse.activeStationId || this.state.traverse.stations[0]?.id;
        if (!targetId) return;
        const newText = transcriptEditor.value.trim();

        const currentStation = this.state.traverse.stations.find((s) => s.id === targetId);
        if (currentStation) {
          const updatedAudio = currentStation.audio
            ? { ...currentStation.audio, rawSpeechText: newText }
            : { durationSec: 0, rawSpeechText: newText };
          const updatedStation = { ...currentStation, audio: updatedAudio };
          await saveStationToDb(updatedStation);
          this.state = {
            ...this.state,
            traverse: {
              ...this.state.traverse,
              stations: this.state.traverse.stations.map((s) => s.id === targetId ? updatedStation : s)
            }
          };
          this.onStateChange(this.state);
          toast.success('Updated speech transcript');
        }
      });
    }

    // Direct Groq Whisper transcription button handler
    document.getElementById('btnTranscribeWhisper')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const targetId = this.state.traverse.activeStationId || this.state.traverse.stations[0]?.id;
      if (!targetId) return;

      const btn = document.getElementById('btnTranscribeWhisper') as HTMLButtonElement;
      const originalHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.innerHTML = '<span class="transcribing-pulse">⚡ Transcribing...</span>';
        btn.disabled = true;
      }

      try {
        toast.info('Loading audio recording from offline storage...');
        const audioRec = await getAudioForStationFromDb(targetId);
        if (!audioRec || !audioRec.blob) {
          toast.warning('No stored audio recording found for this station in IndexedDB');
          return;
        }

        toast.info('Sending audio to Groq Whisper Large V3...');
        const transcribedText = await whisperTranscriptionService.transcribe(audioRec.blob, {
          lexicon: this.state.project.lexicon
        });

        if (!transcribedText || !transcribedText.trim()) {
          toast.warning('Whisper returned empty transcript. Check microphone input audio level.');
          return;
        }

        const cleanedText = transcribedText.trim();
        toast.success('Transcribed via Groq Whisper!');

        // Update IndexedDB audio store
        await saveAudioBlobToDb(targetId, audioRec.blob, audioRec.durationSec || 0, cleanedText);

        // Update in-memory state & station record in IndexedDB
        const currentStation = this.state.traverse.stations.find((s) => s.id === targetId);
        if (currentStation) {
          const updatedAudio = {
            durationSec: audioRec.durationSec || currentStation.audio?.durationSec || 0,
            blobUrl: currentStation.audio?.blobUrl,
            rawSpeechText: cleanedText
          };
          const updatedStation = { ...currentStation, audio: updatedAudio };
          await saveStationToDb(updatedStation);
          this.state = {
            ...this.state,
            traverse: {
              ...this.state.traverse,
              stations: this.state.traverse.stations.map((s) => s.id === targetId ? updatedStation : s)
            }
          };
          this.onStateChange(this.state);
        }

        // Update textarea directly
        const editor = document.getElementById('speechTranscriptEditor') as HTMLTextAreaElement;
        if (editor) {
          editor.value = cleanedText;
        }

        // Automatically trigger LLM geological entity extraction
        toast.info('Extracting geological attributes from new transcript...');
        const res = await llmExtractionService.extractFromSpeech(
          cleanedText,
          this.state.project.mode,
          this.state.project.lexicon
        );

        this.dispatch({
          type: 'RUN_AI_EXTRACTION',
          stationId: targetId,
          customAttributes: res.extracted,
          confidence: res.confidence
        });

        if (res.status === 'FLAGGED_LOW_CONFIDENCE') {
          toast.warning(`Station flagged: ${res.flags.join('; ')}`);
        } else {
          toast.success(`Extracted attributes with ${(res.confidence * 100).toFixed(0)}% confidence`);
        }
      } catch (err: any) {
        console.error('Office Whisper transcription error:', err);
        toast.warning('Whisper transcription notice: ' + (err?.message || 'Failed to transcribe'));
      } finally {
        if (btn) {
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      }
    });
    if (activeStation && activeStation.photos.length > 0) {
      getPhotosForStationFromDb(activeStation.id).then((photoRecords) => {
        photoRecords.forEach((pr, pIdx) => {
          const frame = document.querySelector(`.workbench-photo-frame[data-photo-idx="${pIdx}"]`);
          if (frame && pr.blob) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(pr.blob);
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '6px';
            const placeholder = frame.querySelector('.photo-placeholder-graphic');
            if (placeholder) {
              frame.replaceChild(img, placeholder);
            }
          }
        });
      }).catch(() => {});
    }

    // Attribute inline form editing
    const form = document.getElementById('attributeEditForm') as HTMLFormElement;
    if (form) {
      form.querySelectorAll('input, select').forEach((input) => {
        input.addEventListener('change', () => {
          const targetId = this.state.traverse.activeStationId;
          if (!targetId) return;

          const target = input as HTMLInputElement;
          const fieldName = target.name;
          const value = target.type === 'number' ? parseFloat(target.value) : target.value;

          this.dispatch({
            type: 'OVERRIDE_MEASUREMENT',
            stationId: targetId,
            field: fieldName,
            value
          });

          toast.success(`Updated ${fieldName} on ${targetId}`);
        });
      });
    }

    // Re-run AI Extraction button
    document.getElementById('btnRunAiExtract')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const targetId = this.state.traverse.activeStationId;
      if (!targetId) return;

      const station = this.state.traverse.stations.find((s) => s.id === targetId);
      const speech = station?.audio?.rawSpeechText;

      if (!speech) {
        toast.warning('No audio speech transcript to extract from');
        return;
      }

      toast.info('Running LLM Extraction on speech transcript...');
      const res = await llmExtractionService.extractFromSpeech(
        speech,
        this.state.project.mode,
        this.state.project.lexicon
      );

      this.dispatch({
        type: 'RUN_AI_EXTRACTION',
        stationId: targetId,
        customAttributes: res.extracted,
        confidence: res.confidence
      });

      if (res.status === 'FLAGGED_LOW_CONFIDENCE') {
        toast.warning(`Station flagged: ${res.flags.join('; ')}`);
      } else {
        toast.success(`Extracted attributes with ${(res.confidence * 100).toFixed(0)}% confidence`);
      }
    });

    // Approve Station button
    document.getElementById('btnApproveStation')?.addEventListener('click', () => {
      const targetId = this.state.traverse.activeStationId;
      if (!targetId) return;

      this.dispatch({
        type: 'APPROVE_STATION',
        stationId: targetId
      });

      toast.success(`Station ${targetId} verified & approved for report compilation!`);
    });

    // Theme selector
    const themeSelect = document.getElementById('themeSelector') as HTMLSelectElement;
    themeSelect?.addEventListener('change', () => {
      this.dispatch({
        type: 'SET_THEME',
        theme: themeSelect.value as any
      });
      toast.info(`Theme set to ${themeSelect.value}`);
    });

    // Generate Word .docx Report
    document.getElementById('btnGenerateReport')?.addEventListener('click', async () => {
      try {
        toast.info('Compiling verified stations into decorated Word document (.docx)...');
        const blob = await generateGeologicalReportDocx(this.state);
        const filename = `${this.state.project.name.replace(/\s+/g, '_')}_Report.docx`;
        downloadDocxBlob(blob, filename);

        this.dispatch({
          type: 'GENERATE_REPORT',
          theme: this.state.project.theme
        });

        toast.success(`Downloaded Microsoft Word report: ${filename}`);
      } catch (err: any) {
        toast.warning('Report generation notice: ' + err.message);
      }
    });

    // Export Complete Project Archive (.zip)
    document.getElementById('btnExportZipArchive')?.addEventListener('click', async () => {
      try {
        toast.info('Packaging complete project archive (.zip) with report, CSV, GeoJSON & media...');
        const zipBlob = await exportProjectArchiveZip(this.state);
        const filename = `${this.state.project.name.replace(/\s+/g, '_')}_Complete_Archive.zip`;
        downloadZipBlob(zipBlob, filename);
        toast.success(`Downloaded complete project archive: ${filename}!`);
      } catch (err: any) {
        toast.warning('Archive packaging notice: ' + err.message);
      }
    });
  }
}
