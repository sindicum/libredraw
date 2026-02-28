/**
 * A geographic coordinate pair [longitude, latitude].
 */
export type Position = [number, number];

/**
 * GeoJSON Polygon geometry.
 */
export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Position[][];
}

/**
 * Arbitrary key-value properties attached to a feature.
 */
export interface FeatureProperties {
  [key: string]: unknown;
}

/**
 * A GeoJSON Feature with Polygon geometry used internally by LibreDraw.
 */
export interface LibreDrawFeature {
  id: string;
  type: 'Feature';
  geometry: PolygonGeometry;
  properties: FeatureProperties;
}

/**
 * The type of history action.
 */
export type ActionType = 'create' | 'update' | 'delete';

/**
 * A reversible action that can be applied and reverted on a FeatureStore.
 */
export interface Action {
  type: ActionType;
  apply(store: FeatureStoreInterface): void;
  revert(store: FeatureStoreInterface): void;
}

/**
 * Minimal interface for the FeatureStore used by actions.
 * This avoids circular imports between types and core modules.
 */
export interface FeatureStoreInterface {
  add(feature: LibreDrawFeature): void;
  update(id: string, feature: LibreDrawFeature): void;
  remove(id: string): void;
  getById(id: string): LibreDrawFeature | undefined;
}

/**
 * Action that represents the creation of a new feature.
 */
export class CreateAction implements Action {
  public readonly type: ActionType = 'create';

  constructor(public readonly feature: LibreDrawFeature) {}

  apply(store: FeatureStoreInterface): void {
    store.add(this.feature);
  }

  revert(store: FeatureStoreInterface): void {
    store.remove(this.feature.id);
  }
}

/**
 * Action that represents the update of an existing feature.
 */
export class UpdateAction implements Action {
  public readonly type: ActionType = 'update';

  constructor(
    public readonly id: string,
    public readonly oldFeature: LibreDrawFeature,
    public readonly newFeature: LibreDrawFeature,
  ) {}

  apply(store: FeatureStoreInterface): void {
    store.update(this.id, this.newFeature);
  }

  revert(store: FeatureStoreInterface): void {
    store.update(this.id, this.oldFeature);
  }
}

/**
 * Action that represents the deletion of a feature.
 */
export class DeleteAction implements Action {
  public readonly type: ActionType = 'delete';

  constructor(public readonly feature: LibreDrawFeature) {}

  apply(store: FeatureStoreInterface): void {
    store.remove(this.feature.id);
  }

  revert(store: FeatureStoreInterface): void {
    store.add(this.feature);
  }
}
