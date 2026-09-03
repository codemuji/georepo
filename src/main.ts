import './style.css';
import {
  fieldToReportReducer,
  INITIAL_FIELD_TO_REPORT_STATE
} from './domain/reducer';
import { FieldToReportState } from './domain/types';

let state: FieldToReportState = { ...INITIAL_FIELD_TO_REPORT_STATE };

function dispatch(action: Parameters<typeof fieldToReportReducer>[1]) {
  state = fieldToReportReducer(state, action);
  render();
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;

  const isOnline = state.network.isOnline;
  const stationCount = state.traverse.stations.length;
  const activeStation = state.traverse.stations.find(
    (s) => s.id === state.traverse.activeStationId
  );

  app.innerHTML = `
    <header>
      <div>
        <h1>GeoRepo Core Domain Engine</h1>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
          ${state.project.name} &bull; Mode: <strong>${state.project.mode}</strong>
        </p>
      </div>
      <div>
        <span class="badge ${isOnline ? 'badge-online' : 'badge-offline'}">
          ${isOnline ? 'Basecamp Online' : 'Field Offline Edge'}
        </span>
      </div>
    </header>

    <div class="card">
      <h2>Traverse Telemetry &amp; State</h2>
      <div class="stat-grid">
        <div class="stat-box">
          <div class="label">Total Stations Logged</div>
          <div class="value">${stationCount}</div>
        </div>
        <div class="stat-box">
          <div class="label">Active Station</div>
          <div class="value">${activeStation ? activeStation.id : 'None'}</div>
        </div>
        <div class="stat-box">
          <div class="label">Pending Cloud Sync</div>
          <div class="value">${state.network.pendingSyncCount}</div>
        </div>
        <div class="stat-box">
          <div class="label">Report Status</div>
          <div class="value">${state.report.archiveZipReady ? 'Archive Ready' : 'Pending'}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Interactive State Actions</h2>
      <div class="btn-group">
        <button id="btnNewStation" class="primary">+ New Station (Auto-GPS)</button>
        <button id="btnRecordVoice">Record Freeform Voice Memo</button>
        <button id="btnSnapPhoto">Snap Photo (045° Azimuth)</button>
        <button id="btnToggleNet">Toggle Online / Offline</button>
        <button id="btnSync">Sync Cached Queue</button>
      </div>
    </div>
  `;

  document.getElementById('btnNewStation')?.addEventListener('click', () => {
    dispatch({ type: 'NEW_STATION' });
  });

  document.getElementById('btnRecordVoice')?.addEventListener('click', () => {
    dispatch({
      type: 'RECORD_AUDIO',
      durationSec: 20,
      speechText: 'Quartz-biotite schist with porphyroblasts of garnet, strike 045 dip 60 SE'
    });
  });

  document.getElementById('btnSnapPhoto')?.addEventListener('click', () => {
    dispatch({
      type: 'ATTACH_PHOTO',
      caption: 'Outcrop bedding surface',
      azimuth: 45
    });
  });

  document.getElementById('btnToggleNet')?.addEventListener('click', () => {
    dispatch({ type: 'TOGGLE_ONLINE' });
  });

  document.getElementById('btnSync')?.addEventListener('click', () => {
    dispatch({ type: 'SYNC_QUEUE' });
  });
}

render();
