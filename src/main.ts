import './style.css';
import { FieldCaptureApp } from './ui/fieldCapture';
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
  const fieldApp = new FieldCaptureApp(appContainer);
  fieldApp.init();
}
