import { describe, it, expect } from 'vitest';
import { FeatureStore } from '../../src/core/FeatureStore';
import { validateGeoJSON } from '../../src/validation/geojson';
import type { LibreDrawFeature } from '../../src/types/features';

describe('GeoJSON Roundtrip Integration', () => {
  const sampleFeatures: LibreDrawFeature[] = [
    {
      id: 'polygon-1',
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
        ],
      },
      properties: { name: 'Area A' },
    },
    {
      id: 'polygon-2',
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [20, 20],
            [30, 20],
            [30, 30],
            [20, 30],
            [20, 20],
          ],
        ],
      },
      properties: { name: 'Area B' },
    },
  ];

  it('should export features as GeoJSON and re-import them', () => {
    const store = new FeatureStore();

    // Add features
    for (const f of sampleFeatures) {
      store.add(f);
    }

    // Export to GeoJSON
    const geojson = store.toGeoJSON();
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(2);

    // Validate the exported GeoJSON
    const validated = validateGeoJSON(geojson);
    expect(validated.features).toHaveLength(2);

    // Re-import into a new store
    const store2 = new FeatureStore();
    store2.setAll(validated.features);

    expect(store2.getAll()).toHaveLength(2);
    expect(store2.getById('polygon-1')).toBeDefined();
    expect(store2.getById('polygon-2')).toBeDefined();
  });

  it('should preserve feature properties through roundtrip', () => {
    const store = new FeatureStore();
    store.add(sampleFeatures[0]);

    const geojson = store.toGeoJSON();
    const validated = validateGeoJSON(geojson);

    const store2 = new FeatureStore();
    store2.setAll(validated.features);

    const feature = store2.getById('polygon-1');
    expect(feature?.properties.name).toBe('Area A');
  });

  it('should preserve geometry coordinates through roundtrip', () => {
    const store = new FeatureStore();
    store.add(sampleFeatures[0]);

    const geojson = store.toGeoJSON();
    const validated = validateGeoJSON(geojson);

    const store2 = new FeatureStore();
    store2.setAll(validated.features);

    const feature = store2.getById('polygon-1');
    expect(feature?.geometry.coordinates[0]).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
  });

  it('should handle empty FeatureCollection', () => {
    const store = new FeatureStore();
    const geojson = store.toGeoJSON();

    expect(geojson.features).toHaveLength(0);

    const validated = validateGeoJSON(geojson);
    expect(validated.features).toHaveLength(0);
  });

  it('should reject invalid GeoJSON on import', () => {
    expect(() =>
      validateGeoJSON({
        type: 'FeatureCollection',
        features: [{ type: 'Invalid' }],
      }),
    ).toThrow();
  });
});
