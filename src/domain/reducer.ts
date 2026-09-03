import {
  FieldToReportState,
  FieldToReportAction,
  Station,
  MineralExplorationAttributes,
  GeotechnicalAttributes,
  RegionalMappingAttributes
} from './types';

export const INITIAL_FIELD_TO_REPORT_STATE: FieldToReportState = {
  project: {
    id: 'proj-default',
    name: 'Witwatersrand Basin Concession A',
    mode: 'MINERAL_EXPLORATION',
    theme: 'MODERN_CORPORATE',
    lexicon: [
      'Witwatersrand Supergroup',
      'pyrrhotite',
      'chalcopyrite',
      'quartz-pebble conglomerate',
      'potassic alteration',
      'sericitic'
    ]
  },
  network: {
    isOnline: false,
    pendingSyncCount: 0
  },
  traverse: {
    activeStationId: null,
    stations: []
  },
  report: {
    compiledAt: null,
    title: null,
    themeUsed: null,
    stationCount: 0,
    archiveZipReady: false
  },
  auditLog: []
};

export function fieldToReportReducer(
  state: FieldToReportState = INITIAL_FIELD_TO_REPORT_STATE,
  action: FieldToReportAction
): FieldToReportState {
  const now = new Date().toISOString();
  let logMsg = '';

  switch (action.type) {
    case 'SET_MODE': {
      logMsg = `Project Mode set to ${action.mode}`;
      return {
        ...state,
        project: { ...state.project, mode: action.mode },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'SET_THEME': {
      logMsg = `Report Theme set to ${action.theme}`;
      return {
        ...state,
        project: { ...state.project, theme: action.theme },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'SET_PROJECT_DETAILS': {
      logMsg = `Updated project details: ${action.name}`;
      return {
        ...state,
        project: {
          ...state.project,
          name: action.name,
          lexicon: action.lexicon ?? state.project.lexicon
        },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'NEW_STATION': {
      const newIndex = state.traverse.stations.length + 1;
      const newId = `ST-${String(newIndex).padStart(3, '0')}`;
      const newStation: Station = {
        id: newId,
        timestamp: now,
        coordinates: action.coordinates ?? { lat: -26.2041, lon: 28.0473, elevation: 1750, accuracy: 4.5 },
        azimuth: action.azimuth ?? 45,
        photos: [],
        status: 'OFFLINE_CACHED',
        verified: false
      };
      logMsg = `Captured new Station [${newId}] at Lat ${newStation.coordinates.lat.toFixed(4)}, Lon ${newStation.coordinates.lon.toFixed(4)}`;
      return {
        ...state,
        traverse: {
          activeStationId: newId,
          stations: [...state.traverse.stations, newStation]
        },
        network: {
          ...state.network,
          pendingSyncCount: state.network.pendingSyncCount + 1
        },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'RECORD_AUDIO': {
      const targetId = action.stationId ?? state.traverse.activeStationId;
      if (!targetId) return state;

      const stations = state.traverse.stations.map((st) => {
        if (st.id === targetId) {
          return {
            ...st,
            audio: {
              durationSec: action.durationSec,
              rawSpeechText: action.speechText,
              blobUrl: action.blobUrl ?? `idb://audio_${st.id}`
            }
          };
        }
        return st;
      });

      logMsg = `Recorded ${action.durationSec}s voice memo for [${targetId}]`;
      return {
        ...state,
        traverse: { ...state.traverse, stations },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'ATTACH_PHOTO': {
      const targetId = action.stationId ?? state.traverse.activeStationId;
      if (!targetId) return state;

      const stations = state.traverse.stations.map((st) => {
        if (st.id === targetId) {
          return {
            ...st,
            photos: [
              ...st.photos,
              {
                id: `IMG_${Date.now()}`,
                caption: action.caption ?? 'Outcrop observation face',
                azimuth: action.azimuth ?? st.azimuth ?? 0,
                blobUrl: action.blobUrl ?? `idb://img_${Date.now()}`,
                timestamp: now
              }
            ]
          };
        }
        return st;
      });

      logMsg = `Attached outcrop photo for [${targetId}] facing ${action.azimuth ?? 0}°`;
      return {
        ...state,
        traverse: { ...state.traverse, stations },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'TOGGLE_ONLINE': {
      const nextOnline = action.forceOnline !== undefined ? action.forceOnline : !state.network.isOnline;
      logMsg = nextOnline ? 'Network status: Online (Basecamp Wi-Fi)' : 'Network status: Offline (Field Edge)';
      return {
        ...state,
        network: { ...state.network, isOnline: nextOnline },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'SYNC_QUEUE': {
      if (!state.network.isOnline) {
        return {
          ...state,
          auditLog: [{ time: now, msg: 'SYNC REJECTED: Cannot sync queue while offline.' }, ...state.auditLog]
        };
      }
      const stations = state.traverse.stations.map((st) => ({
        ...st,
        status: (st.status === 'OFFLINE_CACHED' ? 'SYNCED' : st.status) as typeof st.status
      }));
      const count = state.network.pendingSyncCount;
      logMsg = `Synced ${count} station bundle(s) to office cloud database`;
      return {
        ...state,
        traverse: { ...state.traverse, stations },
        network: { ...state.network, pendingSyncCount: 0 },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'RUN_AI_EXTRACTION': {
      const targetId = action.stationId ?? state.traverse.activeStationId;
      const stations = state.traverse.stations.map((st) => {
        if (!action.singleOnly || st.id === targetId) {
          let extracted = action.customAttributes;
          let confidence = action.confidence ?? (action.simulatedError ? 0.61 : 0.95);

          if (!extracted) {
            if (state.project.mode === 'GEOTECHNICAL_ENGINEERING') {
              const geotech: GeotechnicalAttributes = {
                lithology: 'Massive Diabase Sill',
                rqd: '75%',
                jointSpacing: '0.4m',
                weathering: 'Slightly Weathered (Grade II)',
                sampleId: 'GT-CORE-01',
                strike: 30,
                dip: 80,
                dipDirection: 'NW'
              };
              extracted = geotech;
            } else if (state.project.mode === 'REGIONAL_MAPPING') {
              const regional: RegionalMappingAttributes = {
                formation: 'Witwatersrand Supergroup',
                member: 'Central Rand Group',
                lithology: 'Quartz-pebble conglomerate',
                contact: 'Unconformable depositional contact',
                sampleId: 'REG-001',
                strike: 45,
                dip: 30,
                dipDirection: 'SE'
              };
              extracted = regional;
            } else {
              // MINERAL_EXPLORATION
              const exploration: MineralExplorationAttributes = {
                lithology: 'Quartz-pebble conglomerate with pyritic matrix',
                alteration: 'Sericitic and silica flooding',
                mineralization: 'Disseminated chalcopyrite blebs',
                sampleId: 'SMP-102',
                strike: action.simulatedError ? 150 : 45, // Error simulation (150 vs 015)
                dip: 60,
                dipDirection: 'SE'
              };
              extracted = exploration;
            }
          }

          const status = confidence < 0.7 ? 'FLAGGED_LOW_CONFIDENCE' : 'EXTRACTED';

          return {
            ...st,
            extracted,
            confidence,
            sampleId: extracted.sampleId,
            status: status as typeof st.status
          };
        }
        return st;
      });

      logMsg = `AI Whisper + LLM extracted attributes for ${targetId ?? 'all stations'}`;
      return {
        ...state,
        traverse: { ...state.traverse, stations },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'OVERRIDE_MEASUREMENT': {
      const stations = state.traverse.stations.map((st) => {
        if (st.id === action.stationId) {
          const updated = st.extracted ? { ...st.extracted, [action.field]: action.value } : { [action.field]: action.value } as any;
          return {
            ...st,
            extracted: updated,
            confidence: 1.0,
            status: 'EDITED' as const
          };
        }
        return st;
      });

      logMsg = `Human review override: [${action.stationId}] ${action.field} set to ${String(action.value)}`;
      return {
        ...state,
        traverse: { ...state.traverse, stations },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'APPROVE_STATION': {
      const targetId = action.stationId ?? state.traverse.activeStationId;
      if (!targetId) return state;

      const stations = state.traverse.stations.map((st) => {
        if (st.id === targetId) {
          return {
            ...st,
            verified: true,
            status: 'VERIFIED' as const
          };
        }
        return st;
      });

      logMsg = `Station [${targetId}] verified and signed off for report compilation`;
      return {
        ...state,
        traverse: { ...state.traverse, stations },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'GENERATE_REPORT': {
      const approvedStations = state.traverse.stations.filter((st) => st.verified);
      if (approvedStations.length === 0) {
        return {
          ...state,
          auditLog: [{ time: now, msg: 'REPORT GENERATION HALTED: Zero approved stations.' }, ...state.auditLog]
        };
      }

      logMsg = `Generated ${action.theme ?? state.project.theme} Word (.docx) report with ${approvedStations.length} station(s)`;
      return {
        ...state,
        report: {
          compiledAt: now,
          title: `${state.project.name} - Traverse Report`,
          themeUsed: action.theme ?? state.project.theme,
          stationCount: approvedStations.length,
          archiveZipReady: true
        },
        auditLog: [{ time: now, msg: logMsg }, ...state.auditLog]
      };
    }

    case 'RESET':
      return INITIAL_FIELD_TO_REPORT_STATE;

    default:
      return state;
  }
}
