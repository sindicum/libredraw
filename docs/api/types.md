# Types

All types are exported as TypeScript type-only exports from `@sindicum/libre-draw`.

```ts
import type {
  LibreDrawFeature,
  FeatureCollection,
  PolygonGeometry,
  Position,
  FeatureProperties,
  LibreDrawOptions,
  ToolbarOptions,
  ToolbarPosition,
  ToolbarControls,
  ModeName,
  Action,
  ActionType,
  NormalizedInputEvent,
  InputType,
} from '@sindicum/libre-draw';
```

---

## Feature Types

### `Position`

A geographic coordinate pair `[longitude, latitude]`.

```ts
type Position = [number, number];
```

| Index | Range | Description |
|-------|-------|-------------|
| `0` | -180 to 180 | Longitude |
| `1` | -90 to 90 | Latitude |

---

### `PolygonGeometry`

GeoJSON Polygon geometry.

```ts
interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Position[][];
}
```

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'Polygon'` | Always `'Polygon'` |
| `coordinates` | `Position[][]` | Array of linear rings. The first ring is the outer boundary. Each ring must be closed (first position === last position). |

---

### `FeatureProperties`

Arbitrary key-value properties attached to a feature.

```ts
interface FeatureProperties {
  [key: string]: unknown;
}
```

---

### `LibreDrawFeature`

A GeoJSON Feature with Polygon geometry used by LibreDraw.

```ts
interface LibreDrawFeature {
  id: string;
  type: 'Feature';
  geometry: PolygonGeometry;
  properties: FeatureProperties;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | UUID v4 unique identifier |
| `type` | `'Feature'` | Always `'Feature'` |
| `geometry` | [`PolygonGeometry`](#polygongeometry) | The polygon geometry |
| `properties` | [`FeatureProperties`](#featureproperties) | Arbitrary metadata |

---

### `FeatureCollection`

A GeoJSON FeatureCollection containing LibreDraw polygons. Returned by [`toGeoJSON()`](/api/libre-draw#togeojson).

```ts
interface FeatureCollection {
  type: 'FeatureCollection';
  features: LibreDrawFeature[];
}
```

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'FeatureCollection'` | Always `'FeatureCollection'` |
| `features` | [`LibreDrawFeature[]`](#libredrawfeature) | Array of polygon features |

---

## Configuration Types

### `LibreDrawOptions`

Options for creating a LibreDraw instance.

```ts
interface LibreDrawOptions {
  toolbar?: boolean | ToolbarOptions;
  historyLimit?: number;
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `toolbar` | `boolean \| ToolbarOptions` | `true` | Whether to show the toolbar, or toolbar configuration. Set to `false` for headless mode. |
| `historyLimit` | `number` | `100` | Maximum number of undo/redo history entries |

---

### `ToolbarOptions`

Configuration options for the toolbar.

```ts
interface ToolbarOptions {
  position?: ToolbarPosition;
  controls?: ToolbarControls;
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | [`ToolbarPosition`](#toolbarposition) | `'top-right'` | Where to place the toolbar on the map |
| `controls` | [`ToolbarControls`](#toolbarcontrols) | All `true` | Which buttons to display |

---

### `ToolbarPosition`

Position of the toolbar control on the map.

```ts
type ToolbarPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';
```

---

### `ToolbarControls`

Configuration for which toolbar controls to display.

```ts
interface ToolbarControls {
  draw?: boolean;
  select?: boolean;
  delete?: boolean;
  undo?: boolean;
  redo?: boolean;
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `draw` | `boolean` | `true` | Show draw mode toggle button |
| `select` | `boolean` | `true` | Show select mode toggle button |
| `delete` | `boolean` | `true` | Show delete button |
| `undo` | `boolean` | `true` | Show undo button |
| `redo` | `boolean` | `true` | Show redo button |

---

## Mode Types

### `ModeName`

The available drawing mode names.

```ts
type ModeName = 'idle' | 'draw' | 'select';
```

| Value | Description |
|-------|-------------|
| `'idle'` | No drawing interaction. Map behaves normally. |
| `'draw'` | Create polygons by clicking/tapping vertices. |
| `'select'` | Select and edit existing polygons. |

---

## Action Types

### `ActionType`

The type of history action.

```ts
type ActionType = 'create' | 'update' | 'delete';
```

---

### `Action`

A reversible action that can be applied and reverted on a FeatureStore.

```ts
interface Action {
  type: ActionType;
  apply(store: FeatureStoreInterface): void;
  revert(store: FeatureStoreInterface): void;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `type` | [`ActionType`](#actiontype) | The kind of action |
| `apply` | `(store) => void` | Apply the action to the store |
| `revert` | `(store) => void` | Revert the action from the store |

---

### `FeatureStoreInterface`

Minimal interface for the FeatureStore used by actions. This avoids circular imports between types and core modules.

```ts
interface FeatureStoreInterface {
  add(feature: LibreDrawFeature): void;
  update(id: string, feature: LibreDrawFeature): void;
  remove(id: string): void;
  getById(id: string): LibreDrawFeature | undefined;
}
```

---

## Input Types

### `InputType`

The type of input device that generated an event.

```ts
type InputType = 'mouse' | 'touch';
```

---

### `NormalizedInputEvent`

A normalized input event shared across mouse and touch handlers.

```ts
interface NormalizedInputEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
  originalEvent: MouseEvent | TouchEvent;
  inputType: InputType;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `lngLat` | `{ lng: number; lat: number }` | The geographic coordinate at the event location |
| `point` | `{ x: number; y: number }` | The screen pixel coordinate at the event location |
| `originalEvent` | `MouseEvent \| TouchEvent` | The original DOM event |
| `inputType` | [`InputType`](#inputtype) | The input device type that generated this event |

---

## Error Class

### `LibreDrawError`

Base error class for all LibreDraw errors. Extends the native `Error` class.

```ts
class LibreDrawError extends Error {
  constructor(message: string);
  name: 'LibreDrawError';
}
```

Thrown when:
- A method is called on a destroyed instance
- Invalid GeoJSON is passed to `setFeatures` or `addFeatures`
- `selectFeature` is called with a non-existent feature ID
- Invalid polygon geometry (self-intersecting, out-of-bounds coordinates, etc.)

```ts
import { LibreDrawError } from '@sindicum/libre-draw';

try {
  draw.setFeatures({ invalid: 'data' });
} catch (e) {
  if (e instanceof LibreDrawError) {
    console.error('LibreDraw error:', e.message);
  }
}
```
