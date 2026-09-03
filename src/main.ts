import './style.css';
import { FieldCaptureApp } from './ui/fieldCapture';
import { OfficeWorkbench } from './ui/officeWorkbench';
import { INITIAL_FIELD_TO_REPORT_STATE } from './domain/reducer';
import { FieldToReportState } from './domain/types';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for offline capability
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('New GeoRepo PWA content available, refreshing...');
    },
    onOfflineReady() {
      console.log('GeoRepo PWA offline cache ready for fieldwork!');
    }
  });
}

const appContainer = document.getElementById('app');
if (appContainer) {
  let currentState: FieldToReportState = { ...INITIAL_FIELD_TO_REPORT_STATE };
  let fieldApp: FieldCaptureApp | null = null;
  let officeApp: OfficeWorkbench | null = null;

  const mountFieldApp = () => {
    if (appContainer) {
      appContainer.classList.remove('desktop-workbench');
    }
    fieldApp = new FieldCaptureApp(appContainer);
    fieldApp.setState(currentState);
    fieldApp.onSwitchToOffice = () => {
      currentState = fieldApp!.getState();
      mountOfficeApp();
    };
    fieldApp.init();
  };

  const mountOfficeApp = () => {
    if (appContainer) {
      appContainer.classList.add('desktop-workbench');
    }
    officeApp = new OfficeWorkbench({
      container: appContainer,
      state: currentState,
      onStateChange: (next) => {
        currentState = next;
        if (fieldApp) fieldApp.setState(next);
      },
      onSwitchToFieldMode: () => {
        mountFieldApp();
      }
    });
    officeApp.render();
  };

  mountFieldApp();
}
