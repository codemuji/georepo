import { Coordinates, Station } from '../domain/types';

export interface SpatialTrackerOptions {
  container: HTMLElement;
  onSelectStation?: (stationId: string) => void;
}

export class SpatialProjection {
  public originLat: number;
  public originLon: number;
  public metersPerDegreeLat: number = 111320;
  public metersPerDegreeLon: number;

  constructor(originLat: number = -26.2041, originLon: number = 28.0473) {
    this.originLat = originLat;
    this.originLon = originLon;
    this.metersPerDegreeLon = 111320 * Math.cos((originLat * Math.PI) / 180);
  }

  public setOrigin(lat: number, lon: number): void {
    this.originLat = lat;
    this.originLon = lon;
    this.metersPerDegreeLon = 111320 * Math.cos((lat * Math.PI) / 180);
  }

  public project(
    lat: number,
    lon: number,
    zoom: number = 1.0,
    panX: number = 0,
    panY: number = 0,
    width: number = 360,
    height: number = 280
  ): { x: number; y: number } {
    const dLat = (lat - this.originLat) * this.metersPerDegreeLat;
    const dLon = (lon - this.originLon) * this.metersPerDegreeLon;

    // Scale: 1 pixel ~ 2 meters at zoom 1.0
    const scale = 0.5 * zoom;
    const x = width / 2 + dLon * scale + panX;
    const y = height / 2 - dLat * scale + panY; // inverted Y for North up

    return { x, y };
  }
}

export interface StrikeDipSymbolOptions {
  color?: string;
  strikeLength?: number;
  tickLength?: number;
  lineWidth?: number;
}

export function drawStrikeDipSymbol(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  strike: number,
  _dip: number = 45,
  options: StrikeDipSymbolOptions = {}
): void {
  const rad = (strike * Math.PI) / 180;
  const strikeLen = options.strikeLength ?? 14;
  const tickLen = options.tickLength ?? 7;
  const color = options.color ?? '#eab308';
  const lineWidth = options.lineWidth ?? 2;

  const x1 = x - Math.sin(rad) * strikeLen;
  const y1 = y + Math.cos(rad) * strikeLen;
  const x2 = x + Math.sin(rad) * strikeLen;
  const y2 = y - Math.cos(rad) * strikeLen;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const dipRad = rad + Math.PI / 2;
  const tx = x + Math.sin(dipRad) * tickLen;
  const ty = y - Math.cos(dipRad) * tickLen;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
}

export class SpatialTrackerCanvas {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stations: Station[] = [];
  private userLocation: Coordinates | null = null;
  private userHeading: number = 0;
  private onSelectStation?: (stationId: string) => void;
  public projection: SpatialProjection;

  // Viewport transforms (Pan & Zoom)
  private zoom: number = 1.0;
  private panX: number = 0;
  private panY: number = 0;
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  constructor(options: SpatialTrackerOptions) {
    this.container = options.container;
    this.onSelectStation = options.onSelectStation;
    this.projection = new SpatialProjection();

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'spatial-canvas';
    this.container.appendChild(this.canvas);

    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D context for spatial tracker canvas');
    this.ctx = context;

    this.initCanvasSize();
    this.attachEventListeners();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.initCanvasSize());
    }
  }

  private initCanvasSize(): void {
    const rect = this.container.getBoundingClientRect ? this.container.getBoundingClientRect() : { width: 360, height: 280 };
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const width = rect.width || 360;
    const height = 280;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.scale(dpr, dpr);
    this.render();
  }

  public updateData(
    stations: Station[],
    userLocation: Coordinates | null,
    heading: number
  ): void {
    this.stations = stations;
    this.userLocation = userLocation;
    this.userHeading = heading;

    if (this.stations.length > 0) {
      this.projection.setOrigin(this.stations[0].coordinates.lat, this.stations[0].coordinates.lon);
    } else if (userLocation) {
      this.projection.setOrigin(userLocation.lat, userLocation.lon);
    }

    this.render();
  }

  public recenter(): void {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.render();
  }

  public zoomIn(): void {
    this.zoom = Math.min(this.zoom * 1.3, 5.0);
    this.render();
  }

  public zoomOut(): void {
    this.zoom = Math.max(this.zoom / 1.3, 0.3);
    this.render();
  }

  public project(lat: number, lon: number): { x: number; y: number } {
    const width = parseFloat(this.canvas.style.width) || 360;
    const height = parseFloat(this.canvas.style.height) || 280;
    return this.projection.project(lat, lon, this.zoom, this.panX, this.panY, width, height);
  }

  public render(): void {
    const width = parseFloat(this.canvas.style.width) || 360;
    const height = parseFloat(this.canvas.style.height) || 280;

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#0a0d12';
    this.ctx.fillRect(0, 0, width, height);

    this.drawGrid(width, height);
    this.drawTraverseLines();
    this.drawStationMarkers();
    this.drawUserPosition();
    this.drawScaleBar(width, height);
  }

  private drawGrid(width: number, height: number): void {
    const gridSize = 40 * this.zoom;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    this.ctx.lineWidth = 1;

    const offsetX = (width / 2 + this.panX) % gridSize;
    const offsetY = (height / 2 + this.panY) % gridSize;

    this.ctx.beginPath();
    for (let x = offsetX; x < width; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
    }
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(217, 119, 6, 0.7)';
    this.ctx.font = 'bold 10px monospace';
    this.ctx.fillText('▲ N', 12, 22);
  }

  private drawTraverseLines(): void {
    if (this.stations.length < 2) return;

    this.ctx.strokeStyle = 'rgba(217, 119, 6, 0.6)';
    this.ctx.lineWidth = 2;
    if (this.ctx.setLineDash) {
      this.ctx.setLineDash([5, 4]);
    }

    this.ctx.beginPath();
    this.stations.forEach((st, idx) => {
      const pt = this.project(st.coordinates.lat, st.coordinates.lon);
      if (idx === 0) {
        this.ctx.moveTo(pt.x, pt.y);
      } else {
        this.ctx.lineTo(pt.x, pt.y);
      }
    });
    this.ctx.stroke();
    if (this.ctx.setLineDash) {
      this.ctx.setLineDash([]);
    }
  }

  private drawStationMarkers(): void {
    this.stations.forEach((st) => {
      const pt = this.project(st.coordinates.lat, st.coordinates.lon);

      this.ctx.fillStyle = '#d97706';
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      const strike = (st.extracted as any)?.strike ?? st.azimuth;
      if (typeof strike === 'number') {
        const dip = (st.extracted as any)?.dip ?? 45;
        drawStrikeDipSymbol(this.ctx, pt.x, pt.y, strike, dip);
      }

      this.ctx.fillStyle = '#f8fafc';
      this.ctx.font = 'bold 11px monospace';
      this.ctx.fillText(st.id, pt.x + 9, pt.y + 4);
    });
  }

  private drawUserPosition(): void {
    if (!this.userLocation) return;
    const pt = this.project(this.userLocation.lat, this.userLocation.lon);

    const accuracyRadius = Math.max(12, (this.userLocation.accuracy || 5) * 0.5 * this.zoom);
    this.ctx.fillStyle = 'rgba(2, 132, 199, 0.12)';
    this.ctx.beginPath();
    this.ctx.arc(pt.x, pt.y, accuracyRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(2, 132, 199, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    const headingRad = (this.userHeading * Math.PI) / 180;
    const coneLen = 28;
    const spread = 0.35;

    this.ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
    this.ctx.beginPath();
    this.ctx.moveTo(pt.x, pt.y);
    this.ctx.arc(pt.x, pt.y, coneLen, headingRad - Math.PI / 2 - spread, headingRad - Math.PI / 2 + spread);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = '#0284c7';
    this.ctx.beginPath();
    this.ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  private drawScaleBar(width: number, height: number): void {
    const scalePx = 50;
    const meters = Math.round(scalePx / (0.5 * this.zoom));

    const x = width - 80;
    const y = height - 16;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + scalePx, y);
    this.ctx.moveTo(x, y - 4);
    this.ctx.lineTo(x, y + 4);
    this.ctx.moveTo(x + scalePx, y - 4);
    this.ctx.lineTo(x + scalePx, y + 4);
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(`${meters}m`, x + scalePx / 2 - 8, y - 6);
  }

  private attachEventListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.panX += dx;
        this.panY += dy;
        this.render();
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });
    }

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
      this.panX += dx;
      this.panY += dy;
      this.render();
    });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) this.zoomIn();
      else this.zoomOut();
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      for (const st of this.stations) {
        const pt = this.project(st.coordinates.lat, st.coordinates.lon);
        const dist = Math.hypot(pt.x - clickX, pt.y - clickY);
        if (dist <= 16) {
          if (this.onSelectStation) {
            this.onSelectStation(st.id);
          }
          break;
        }
      }
    });
  }
}
