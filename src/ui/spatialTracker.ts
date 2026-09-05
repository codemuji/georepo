import { Coordinates, Station } from '../domain/types';

export interface SpatialTrackerOptions {
  container: HTMLElement;
  canvasElement?: HTMLCanvasElement;
  showUserPosition?: boolean;
  activeStationId?: string | null;
  onSelectStation?: (stationId: string) => void;
  onLoadSampleTraverse?: () => void;
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

  public unproject(
    x: number,
    y: number,
    zoom: number = 1.0,
    panX: number = 0,
    panY: number = 0,
    width: number = 360,
    height: number = 280
  ): { lat: number; lon: number } {
    const scale = 0.5 * zoom;
    const dLon = (x - width / 2 - panX) / scale;
    const dLat = (height / 2 + panY - y) / scale;
    const lon = this.originLon + dLon / this.metersPerDegreeLon;
    const lat = this.originLat + dLat / this.metersPerDegreeLat;
    return { lat, lon };
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

/**
 * Lightweight CartoDB Dark Matter / OpenStreetMap tile renderer.
 * Operates client-side, caches tiles in memory, and falls back seamlessly when offline.
 */
export class TileBasemapRenderer {
  private cache: Map<string, HTMLImageElement> = new Map();
  private pendingRequests: Set<string> = new Set();
  private onTileLoaded: () => void;

  constructor(onTileLoaded: () => void) {
    this.onTileLoaded = onTileLoaded;
  }

  public drawTiles(
    ctx: CanvasRenderingContext2D,
    centerLat: number,
    centerLon: number,
    zoom: number,
    panX: number,
    panY: number,
    width: number,
    height: number
  ): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (typeof Image === 'undefined') return;

    // Map canvas zoom (0.5 - 5.0) to standard Web Mercator tile zoom (typically 14 - 17)
    const baseZ = 16;
    const zOffset = Math.round(Math.log2(Math.max(0.2, zoom)));
    const z = Math.max(12, Math.min(18, baseZ + zOffset));
    const n = Math.pow(2, z);

    // Center in Web Mercator
    const centerWorldX = ((centerLon + 180) / 360) * n * 256;
    const latRad = (centerLat * Math.PI) / 180;
    const centerWorldY =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;

    const viewLeft = centerWorldX - width / 2 - panX;
    const viewTop = centerWorldY - height / 2 - panY;
    const viewRight = viewLeft + width;
    const viewBottom = viewTop + height;

    const minTileX = Math.floor(viewLeft / 256);
    const maxTileX = Math.floor(viewRight / 256);
    const minTileY = Math.floor(viewTop / 256);
    const maxTileY = Math.floor(viewBottom / 256);

    if (maxTileX - minTileX > 8 || maxTileY - minTileY > 8) return;

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        const tileKey = `${z}/${tx}/${ty}`;
        const drawX = tx * 256 - viewLeft;
        const drawY = ty * 256 - viewTop;

        const cached = this.cache.get(tileKey);
        if (cached && cached.complete && cached.naturalWidth > 0) {
          ctx.save();
          // Elegant dark theme filter for OSM tiles matching basalt aesthetic
          ctx.filter = 'invert(90%) hue-rotate(180deg) brightness(85%) contrast(90%)';
          ctx.globalAlpha = 0.85;
          ctx.drawImage(cached, drawX, drawY, 256, 256);
          ctx.restore();
        } else if (!this.pendingRequests.has(tileKey)) {
          this.pendingRequests.add(tileKey);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            this.cache.set(tileKey, img);
            this.pendingRequests.delete(tileKey);
            this.onTileLoaded();
          };
          img.onerror = () => {
            this.pendingRequests.delete(tileKey);
          };
          img.src = `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
        }
      }
    }
  }
}

export class SpatialTrackerCanvas {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private stations: Station[] = [];
  private userLocation: Coordinates | null = null;
  private userHeading: number = 0;
  private activeStationId?: string | null;
  private showUserPosition: boolean = true;
  private onSelectStation?: (stationId: string) => void;
  public projection: SpatialProjection;
  private tileRenderer: TileBasemapRenderer;
  private resizeObserver?: ResizeObserver;
  private animationFrameId?: number;

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
    this.showUserPosition = options.showUserPosition ?? true;
    this.activeStationId = options.activeStationId;
    this.projection = new SpatialProjection();
    this.tileRenderer = new TileBasemapRenderer(() => this.render());

    if (options.canvasElement) {
      this.canvas = options.canvasElement;
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'spatial-canvas';
      this.container.appendChild(this.canvas);
    }

    const context = this.canvas.getContext('2d');
    if (!context) {
      // Headless test runner (jsdom) without native canvas support
      return;
    }
    this.ctx = context;

    this.initCanvasSize();
    this.attachEventListeners();
    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          const h = entry.contentRect.height;
          if (w > 100) {
            const currentW = parseFloat(this.canvas.style.width || '0');
            if (Math.abs(w - currentW) > 2) {
              this.resizeCanvas(w, h > 100 ? h : 280);
            }
          }
        }
      });
      this.resizeObserver.observe(this.container);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.initCanvasSize());
    }
  }

  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private initCanvasSize(): void {
    const rect = this.container.getBoundingClientRect
      ? this.container.getBoundingClientRect()
      : { width: 360, height: 280 };
    const width = rect.width > 100 ? rect.width : (this.container.clientWidth > 100 ? this.container.clientWidth : 360);
    const height = rect.height > 100 ? rect.height : (this.container.clientHeight > 100 ? this.container.clientHeight : 280);
    this.resizeCanvas(width, height);
  }

  public resizeCanvas(width: number, height: number): void {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
    this.render();
  }

  public updateData(
    stations: Station[],
    userLocation: Coordinates | null,
    heading: number,
    activeStationId?: string | null
  ): void {
    this.stations = stations;
    this.userLocation = userLocation;
    this.userHeading = heading;
    if (activeStationId !== undefined) {
      this.activeStationId = activeStationId;
    }

    if (this.stations.length > 0) {
      const active = this.stations.find((s) => s.id === this.activeStationId) || this.stations[0];
      this.projection.setOrigin(active.coordinates.lat, active.coordinates.lon);
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
    let width = parseFloat(this.canvas.style.width) || 360;
    let height = parseFloat(this.canvas.style.height) || 280;

    if (width < 100 && this.container.clientWidth > 100) {
      this.initCanvasSize();
      width = parseFloat(this.canvas.style.width) || 360;
      height = parseFloat(this.canvas.style.height) || 280;
    }

    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    // Deep Basalt Slate Base
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, width, height);

    // 1. Draw Online Web Basemap Tiles (CartoDB Dark Matter)
    const originLat = this.projection.originLat;
    const originLon = this.projection.originLon;
    this.tileRenderer.drawTiles(
      ctx,
      originLat,
      originLon,
      this.zoom,
      this.panX,
      this.panY,
      width,
      height
    );

    // 2. High-Contrast Geological Coordinate Grid & Contours
    this.drawGeologicalGrid(ctx, width, height);

    // 3. Sequential Traverse Lines
    this.drawTraverseLines(ctx);

    // 4. Oriented Strike & Dip Symbols & Outcrop Markers
    this.drawStationMarkers(ctx);

    // 5. Live User GPS Position & Brunton Attitude Cone
    if (this.showUserPosition) {
      this.drawUserPosition(ctx);
    }

    // 6. HUD Instruments: North Arrow & Scale Bar
    this.drawHudInstruments(ctx, width, height);

    // 7. Empty State Overlay if 0 stations
    if (this.stations.length === 0) {
      this.drawEmptyStateNotice(ctx, width, height);
    }
  }

  private drawGeologicalGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const gridSize = 50 * this.zoom;
    const offsetX = (width / 2 + this.panX) % gridSize;
    const offsetY = (height / 2 + this.panY) % gridSize;

    // Subtle coordinate lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = offsetX; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Topographic Elevation Contours (Organic geological contour simulation)
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.07)';
    ctx.lineWidth = 1.5;
    const contourRadii = [80, 150, 230, 320];
    contourRadii.forEach((r, idx) => {
      const scaledR = r * this.zoom;
      const cx = width / 2 + this.panX;
      const cy = height / 2 + this.panY;
      ctx.beginPath();
      ctx.arc(cx, cy, scaledR, 0, Math.PI * 2);
      ctx.stroke();

      // Contour elevation label
      ctx.fillStyle = 'rgba(217, 119, 6, 0.25)';
      ctx.font = '9px monospace';
      ctx.fillText(`${1750 - idx * 15}m`, cx + scaledR - 18, cy + 3);
    });

    // Latitude / Longitude ticks on edges
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '9px monospace';

    // Longitude label at bottom center
    const centerCoord = this.projection.unproject(width / 2, height / 2, this.zoom, this.panX, this.panY, width, height);
    ctx.fillText(
      `${Math.abs(centerCoord.lat).toFixed(4)}°${centerCoord.lat < 0 ? 'S' : 'N'}, ${Math.abs(centerCoord.lon).toFixed(4)}°${centerCoord.lon < 0 ? 'W' : 'E'}`,
      12,
      height - 12
    );
  }

  private drawTraverseLines(ctx: CanvasRenderingContext2D): void {
    if (this.stations.length < 2) return;

    ctx.strokeStyle = 'rgba(217, 119, 6, 0.75)';
    ctx.lineWidth = 2.5;
    if (ctx.setLineDash) {
      ctx.setLineDash([6, 4]);
    }

    ctx.beginPath();
    this.stations.forEach((st, idx) => {
      const pt = this.project(st.coordinates.lat, st.coordinates.lon);
      if (idx === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    });
    ctx.stroke();

    if (ctx.setLineDash) {
      ctx.setLineDash([]);
    }
  }

  private drawStationMarkers(ctx: CanvasRenderingContext2D): void {
    this.stations.forEach((st) => {
      const pt = this.project(st.coordinates.lat, st.coordinates.lon);
      const isActive = st.id === this.activeStationId;
      const isFlagged = st.status === 'FLAGGED_LOW_CONFIDENCE';
      const isApproved = st.verified || st.status === 'VERIFIED';

      const markerColor = isFlagged ? '#ef4444' : (isApproved ? '#22c55e' : '#d97706');

      // 1. Oriented Strike & Dip symbol
      const strike = (st.extracted as any)?.strike ?? st.azimuth;
      if (typeof strike === 'number') {
        const dip = (st.extracted as any)?.dip ?? 45;
        drawStrikeDipSymbol(ctx, pt.x, pt.y, strike, dip, {
          color: isFlagged ? '#ef4444' : (isApproved ? '#22c55e' : '#eab308'),
          strikeLength: isActive ? 18 : 14,
          tickLength: 8,
          lineWidth: isActive ? 2.5 : 2
        });
      }

      // 2. Station center dot
      ctx.fillStyle = markerColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isActive ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring
      ctx.strokeStyle = isActive ? '#38bdf8' : '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Active pulse ring
      if (isActive) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3. Station Label Badge
      ctx.fillStyle = isActive ? '#38bdf8' : '#f8fafc';
      ctx.font = isActive ? 'bold 12px monospace' : '11px monospace';
      ctx.fillText(st.id, pt.x + 10, pt.y + 4);
    });
  }

  private drawUserPosition(ctx: CanvasRenderingContext2D): void {
    if (!this.userLocation) return;
    const pt = this.project(this.userLocation.lat, this.userLocation.lon);

    // Accuracy Circle
    const accuracyRadius = Math.max(14, (this.userLocation.accuracy || 5) * 0.5 * this.zoom);
    ctx.fillStyle = 'rgba(2, 132, 199, 0.12)';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, accuracyRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Directional Brunton Heading Beam
    const headingRad = (this.userHeading * Math.PI) / 180;
    const coneLen = 32;
    const spread = 0.35;

    ctx.fillStyle = 'rgba(2, 132, 199, 0.28)';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.arc(pt.x, pt.y, coneLen, headingRad - Math.PI / 2 - spread, headingRad - Math.PI / 2 + spread);
    ctx.closePath();
    ctx.fill();

    // Blue Center Reticle
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawHudInstruments(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // North Indicator & Compass Rose
    ctx.fillStyle = 'rgba(217, 119, 6, 0.85)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('▲ N', 14, 24);

    // Scale Bar
    const scalePx = 50;
    const meters = Math.round(scalePx / (0.5 * this.zoom));
    const x = width - 80;
    const y = height - 16;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + scalePx, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.moveTo(x + scalePx, y - 4);
    ctx.lineTo(x + scalePx, y + 4);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '10px monospace';
    ctx.fillText(`${meters}m`, x + scalePx / 2 - 10, y - 6);
  }

  private drawEmptyStateNotice(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2 + this.panX;
    const cy = height / 2 + this.panY - 20;

    // Semi-transparent HUD Pill
    ctx.fillStyle = 'rgba(20, 25, 34, 0.75)';
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
    ctx.lineWidth = 1;

    const pillW = Math.min(width - 40, 290);
    const pillH = 46;
    const pillX = cx - pillW / 2;
    const pillY = cy - pillH / 2;

    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(pillX, pillY, pillW, pillH, 8) : ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    // Status text
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GIS Vector Map Ready • 0 Stations', cx, cy - 4);

    ctx.fillStyle = 'var(--strata-muted, #94a3b8)';
    ctx.font = '10px sans-serif';
    ctx.fillText('Tap "+ New Station" below to log outcrop coordinates', cx, cy + 12);
    ctx.textAlign = 'start';
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
