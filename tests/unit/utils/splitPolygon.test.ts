import { describe, expect, it } from 'vitest';
import type { LibreDrawFeature, Position } from '../../../src/types/features';
import { splitPolygon } from '../../../src/utils/splitPolygon';

function makeFeature(
  id: string,
  ring: Position[],
  properties: Record<string, unknown> = {},
): LibreDrawFeature {
  return {
    id,
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
    properties,
  };
}

function signedArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return area / 2;
}

function isClosed(ring: Position[]): boolean {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

describe('splitPolygon', () => {
  it('should split a square into two polygons with equal area', () => {
    const feature = makeFeature('square', [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);

    const result = splitPolygon(feature, [5, -5], [5, 15]);
    expect(result).not.toBeNull();

    const [a, b] = result!;
    const areaA = Math.abs(signedArea(a.geometry.coordinates[0]));
    const areaB = Math.abs(signedArea(b.geometry.coordinates[0]));

    expect(areaA).toBeCloseTo(50, 8);
    expect(areaB).toBeCloseTo(50, 8);
    expect(isClosed(a.geometry.coordinates[0])).toBe(true);
    expect(isClosed(b.geometry.coordinates[0])).toBe(true);
  });

  it('should return null when split line does not intersect polygon', () => {
    const feature = makeFeature('square', [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);

    const result = splitPolygon(feature, [20, 20], [30, 30]);
    expect(result).toBeNull();
  });

  it('should return null when split line intersects polygon in more than two points', () => {
    const feature = makeFeature('concave', [
      [0, 0],
      [10, 0],
      [10, 10],
      [7, 10],
      [7, 3],
      [3, 3],
      [3, 10],
      [0, 10],
      [0, 0],
    ]);

    const result = splitPolygon(feature, [-1, 4], [11, 4]);
    expect(result).toBeNull();
  });

  it('should allow split line passing through polygon vertices', () => {
    const feature = makeFeature('square', [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);

    const result = splitPolygon(feature, [0, 0], [10, 10]);
    expect(result).not.toBeNull();

    const [a, b] = result!;
    expect(Math.abs(signedArea(a.geometry.coordinates[0]))).toBeCloseTo(50, 8);
    expect(Math.abs(signedArea(b.geometry.coordinates[0]))).toBeCloseTo(50, 8);
  });

  it('should copy properties and assign new IDs to both output features', () => {
    const feature = makeFeature(
      'origin',
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      {
        name: 'zone',
        meta: {
          level: 2,
        },
      },
    );

    const result = splitPolygon(feature, [5, -5], [5, 15]);
    expect(result).not.toBeNull();

    const [a, b] = result!;
    expect(a.id).not.toBe('origin');
    expect(b.id).not.toBe('origin');
    expect(a.id).not.toBe(b.id);

    expect(a.properties).toEqual(feature.properties);
    expect(b.properties).toEqual(feature.properties);

    (a.properties.meta as { level: number }).level = 999;
    expect((feature.properties.meta as { level: number }).level).toBe(2);
    expect((b.properties.meta as { level: number }).level).toBe(2);
  });

  it('should return CCW rings for resulting polygons', () => {
    const feature = makeFeature('square', [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);

    const result = splitPolygon(feature, [5, -5], [5, 15]);
    expect(result).not.toBeNull();

    const [a, b] = result!;
    expect(signedArea(a.geometry.coordinates[0])).toBeGreaterThan(0);
    expect(signedArea(b.geometry.coordinates[0])).toBeGreaterThan(0);
  });
});
