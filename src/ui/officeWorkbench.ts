import {
  fieldToReportReducer
} from '../domain/reducer';
import { FieldToReportState, Station } from '../domain/types';
import { SpatialProjection, drawStrikeDipSymbol } from './spatialTracker';
import { llmExtractionService } from '../services/extraction';
import { generateGeologicalReportDocx, downloadDocxBlob } from '../services/reportGenerator';
import { exportProjectArchiveZip, downloadZipBlob } from '../services/archiveExporter';
import { getAudioForStationFromDb, getPhotosForStationFromDb } from '../storage/db';
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
  private mapCanvas: HTMLCanvasElement | null = null;
  private mapCtx: CanvasRenderingContext2D | null = null;
  private projection: SpatialProjection;
  private zoom: number = 1.0;
  private panX: number = 0;
  private panY: number = 0;
  private isAudioPlaying: boolean = false;

  constructor(options: OfficeWorkbenchOptions) {
    this.container = options.container;
    this.state = options.state;
    this.onStateChange = options.onStateChange;
    this.onSwitchToFieldMode = options.onSwitchToFieldMode;
    this.projection = new SpatialProjection();
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
          <div class="card-section-label">Field Audio Observation (${audio ? `${audio.durationSec}s` : 'No Audio'})</div>
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
          ${audio?.rawSpeechText ? `
            <div class="raw-speech-transcript">
              &ldquo;${audio.rawSpeechText}&rdquo;
            </div>
          ` : `
            <div style="font-size: 12px; color: var(--strata-muted); font-style: italic; margin-top: 6px;">
              No raw transcript recorded.
            </div>
          `}
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
    this.mapCanvas = document.getElementById('workbenchMapCanvas') as HTMLCanvasElement;
    if (!container || !this.mapCanvas) return;

    this.mapCtx = this.mapCanvas.getContext('2d');
    if (!this.mapCtx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || 500;
    const height = rect.height || 450;

    this.mapCanvas.width = width * dpr;
    this.mapCanvas.height = height * dpr;
    this.mapCanvas.style.width = `${width}px`;
    this.mapCanvas.style.height = `${height}px`;

    this.mapCtx.scale(dpr, dpr);

    // Center projection around active or first station
    const stations = this.state.traverse.stations;
    if (stations.length > 0) {
      this.projection.setOrigin(stations[0].coordinates.lat, stations[0].coordinates.lon);
    }

    this.drawMap();
  }

  private drawMap(): void {
    if (!this.mapCanvas || !this.mapCtx) return;
    const width = parseFloat(this.mapCanvas.style.width) || 500;
    const height = parseFloat(this.mapCanvas.style.height) || 450;
    const ctx = this.mapCtx;
    const stations = this.state.traverse.stations;
    const activeId = this.state.traverse.activeStationId;

    ctx.clearRect(0, 0, width, height);

    // Background (Basalt Slate)
    ctx.fillStyle = '#0f141c';
    ctx.fillRect(0, 0, width, height);

    // Subtle coordinate grid
    const gridSize = 45 * this.zoom;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = (width / 2 + this.panX) % gridSize; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = (height / 2 + this.panY) % gridSize; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // North Indicator
    ctx.fillStyle = 'rgba(217, 119, 6, 0.8)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('▲ N', 14, 24);

    // Traverse connection line
    if (stations.length > 1) {
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      stations.forEach((st, idx) => {
        const pt = this.projection.project(st.coordinates.lat, st.coordinates.lon, this.zoom, this.panX, this.panY, width, height);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Plot stations with oriented Strike & Dip symbols
    stations.forEach((st) => {
      const pt = this.projection.project(st.coordinates.lat, st.coordinates.lon, this.zoom, this.panX, this.panY, width, height);
      const isActive = st.id === activeId;
      const isFlagged = st.status === 'FLAGGED_LOW_CONFIDENCE';
      const isApproved = st.verified || st.status === 'VERIFIED';

      // Oriented Strike & Dip symbol
      const strike = (st.extracted as any)?.strike ?? st.azimuth;
      if (typeof strike === 'number') {
        const dip = (st.extracted as any)?.dip ?? 45;
        const color = isFlagged ? '#ef4444' : (isApproved ? '#22c55e' : '#eab308');
        drawStrikeDipSymbol(ctx, pt.x, pt.y, strike, dip, {
          color,
          strikeLength: isActive ? 18 : 14,
          tickLength: 8,
          lineWidth: isActive ? 2.5 : 2
        });
      }

      // Station circle
      ctx.fillStyle = isFlagged ? '#ef4444' : (isApproved ? '#16a34a' : '#d97706');
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isActive ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring
      ctx.strokeStyle = isActive ? '#38bdf8' : '#fff';
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.stroke();

      // Station Label
      ctx.fillStyle = isActive ? '#38bdf8' : '#f8fafc';
      ctx.font = isActive ? 'bold 12px monospace' : '11px monospace';
      ctx.fillText(st.id, pt.x + 10, pt.y + 4);
    });
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

    // Map tools
    document.getElementById('btnMapZoomIn')?.addEventListener('click', () => {
      this.zoom = Math.min(this.zoom * 1.3, 5.0);
      this.drawMap();
    });
    document.getElementById('btnMapZoomOut')?.addEventListener('click', () => {
      this.zoom = Math.max(this.zoom / 1.3, 0.3);
      this.drawMap();
    });
    document.getElementById('btnMapRecenter')?.addEventListener('click', () => {
      this.panX = 0;
      this.panY = 0;
      this.zoom = 1.0;
      this.drawMap();
    });

    // Map click hit testing
    this.mapCanvas?.addEventListener('click', (e) => {
      const rect = this.mapCanvas!.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const width = parseFloat(this.mapCanvas!.style.width) || 500;
      const height = parseFloat(this.mapCanvas!.style.height) || 450;

      for (const st of this.state.traverse.stations) {
        const pt = this.projection.project(st.coordinates.lat, st.coordinates.lon, this.zoom, this.panX, this.panY, width, height);
        if (Math.hypot(pt.x - clickX, pt.y - clickY) <= 18) {
          this.state = {
            ...this.state,
            traverse: { ...this.state.traverse, activeStationId: st.id }
          };
          this.render();
          toast.info(`Selected station ${st.id}`);
          break;
        }
      }
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

    // Load actual outcrop photos from IndexedDB if available
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
