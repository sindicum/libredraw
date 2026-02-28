import type {
  LibreDrawFeature,
  Position,
  FeatureStoreInterface,
} from '../types/features';

/**
 * A GeoJSON FeatureCollection containing LibreDraw polygons.
 */
export interface FeatureCollection {
  type: 'FeatureCollection';
  features: LibreDrawFeature[];
}

/**
 * Internal store for managing LibreDraw features.
 *
 * Features are stored in a Map keyed by their unique ID.
 * Implements FeatureStoreInterface so that Action objects
 * can manipulate the store.
 */
export class FeatureStore implements FeatureStoreInterface {
  private features: Map<string, LibreDrawFeature> = new Map();

  /**
   * Add a feature to the store. If the feature has no ID,
   * a new UUID will be generated.
   * @param feature - The feature to add.
   * @returns The added feature (with ID assigned).
   */
  add(feature: LibreDrawFeature): LibreDrawFeature {
    const id = feature.id || crypto.randomUUID();
    const stored: LibreDrawFeature = { ...feature, id };
    this.features.set(id, stored);
    return stored;
  }

  /**
   * Update a feature in the store by ID.
   * @param id - The ID of the feature to update.
   * @param feature - The new feature data.
   */
  update(id: string, feature: LibreDrawFeature): void {
    if (!this.features.has(id)) {
      return;
    }
    this.features.set(id, { ...feature, id });
  }

  /**
   * Remove a feature from the store by ID.
   * @param id - The ID of the feature to remove.
   * @returns The removed feature, or undefined if not found.
   */
  remove(id: string): LibreDrawFeature | undefined {
    const feature = this.features.get(id);
    if (feature) {
      this.features.delete(id);
    }
    return feature;
  }

  /**
   * Get all features in the store.
   * @returns An array of all features.
   */
  getAll(): LibreDrawFeature[] {
    return Array.from(this.features.values());
  }

  /**
   * Get a feature by its ID.
   * @param id - The feature ID.
   * @returns The feature, or undefined if not found.
   */
  getById(id: string): LibreDrawFeature | undefined {
    return this.features.get(id);
  }

  /**
   * Remove all features from the store.
   */
  clear(): void {
    this.features.clear();
  }

  /**
   * Replace all features in the store with the given array.
   * @param features - The features to set.
   */
  setAll(features: LibreDrawFeature[]): void {
    this.features.clear();
    for (const feature of features) {
      const id = feature.id || crypto.randomUUID();
      this.features.set(id, { ...feature, id });
    }
  }

  /**
   * Export all features as a GeoJSON FeatureCollection.
   * @returns A GeoJSON FeatureCollection.
   */
  toGeoJSON(): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: this.getAll(),
    };
  }

  /**
   * Create a deep clone of a feature suitable for history snapshots.
   * @param feature - The feature to clone.
   * @returns A deep-cloned feature.
   */
  static cloneFeature(feature: LibreDrawFeature): LibreDrawFeature {
    return {
      id: feature.id,
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: feature.geometry.coordinates.map(
          (ring) => ring.map((pos) => [...pos] as Position),
        ),
      },
      properties: { ...feature.properties },
    };
  }
}
