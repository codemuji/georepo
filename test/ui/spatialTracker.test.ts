import { describe, it, expect } from 'vitest';
import { SpatialProjection } from '../../src/ui/spatialTracker';

describe('Lightweight Field Spatial Tracker Vector Projection', () => {
  it('correctly projects GPS coordinates relative to local origin in meters', () => {
    const projection = new SpatialProjection(-26.2041, 28.0473);

    // Origin projects exactly to center (width/2, height/2)
    const ptOrigin = projection.project(-26.2041, 28.0473, 1.0, 0, 0, 400, 300);
    expect(ptOrigin.x).toBe(200);
    expect(ptOrigin.y).toBe(150);

    // South and East point
    const ptSouthEast = projection.project(-26.2051, 28.0483, 1.0, 0, 0, 400, 300);
    expect(ptSouthEast.x).toBeGreaterThan(ptOrigin.x); // East = higher X
    expect(ptSouthEast.y).toBeGreaterThan(ptOrigin.y); // South = higher Y (inverted canvas)

    // Zooming in scales the delta distance proportionally
    const ptZoomed = projection.project(-26.2051, 28.0483, 2.0, 0, 0, 400, 300);
    const deltaStandard = ptSouthEast.x - ptOrigin.x;
    const deltaZoomed = ptZoomed.x - ptOrigin.x;
    expect(deltaZoomed).toBeCloseTo(deltaStandard * 2, 1);

    // Panning shifts the projected point directly
    const ptPaged = projection.project(-26.2041, 28.0473, 1.0, 50, -30, 400, 300);
    expect(ptPaged.x).toBe(250);
    expect(ptPaged.y).toBe(120);
  });
});
