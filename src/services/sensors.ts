import { Coordinates } from '../domain/types';

export async function getCurrentCoordinates(): Promise<Coordinates> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.warn('Geolocation API not supported. Using fallback coordinates.');
    return { lat: -26.2041, lon: 28.0473, elevation: 1750, accuracy: 10 };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lon: Number(pos.coords.longitude.toFixed(6)),
          elevation: pos.coords.altitude ? Number(pos.coords.altitude.toFixed(1)) : undefined,
          accuracy: pos.coords.accuracy ? Number(pos.coords.accuracy.toFixed(1)) : undefined
        });
      },
      (err) => {
        console.warn('Geolocation warning / permission denied:', err.message);
        resolve({ lat: -26.2041, lon: 28.0473, elevation: 1750, accuracy: 15 });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      }
    );
  });
}

export class CompassHeadingService {
  private currentAzimuth: number = 0;

  constructor() {
    this.initOrientationListener();
  }

  private initOrientationListener(): void {
    if (typeof window === 'undefined') return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if ('webkitCompassHeading' in e && typeof (e as any).webkitCompassHeading === 'number') {
        this.currentAzimuth = Math.round((e as any).webkitCompassHeading);
      } else if (e.alpha !== null) {
        this.currentAzimuth = Math.round(360 - e.alpha);
      }
    };

    const win = window as any;
    if ('ondeviceorientationabsolute' in win) {
      win.addEventListener('deviceorientationabsolute', handleOrientation, true);
    } else if ('ondeviceorientation' in win) {
      win.addEventListener('deviceorientation', handleOrientation, true);
    }
  }

  public getHeading(): number {
    return this.currentAzimuth;
  }

  public setSimulatedHeading(heading: number): void {
    this.currentAzimuth = heading % 360;
  }
}

export const compassService = new CompassHeadingService();
