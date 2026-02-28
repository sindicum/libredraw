# API Reference

## Overview

LibreDraw exposes a single entry-point class and a set of TypeScript types.

### Main Class

| Export | Description |
|--------|-------------|
| [`LibreDraw`](/api/libre-draw) | Main facade class — constructor, methods, and lifecycle |

### Error Class

| Export | Description |
|--------|-------------|
| [`LibreDrawError`](/api/types#libredrawerror) | Error thrown by LibreDraw methods |

### Types

All types are exported as TypeScript type-only exports:

| Type | Description |
|------|-------------|
| [`LibreDrawFeature`](/api/types#libredrawfeature) | A polygon feature with id, geometry, and properties |
| [`PolygonGeometry`](/api/types#polygongeometry) | GeoJSON Polygon geometry |
| [`Position`](/api/types#position) | `[longitude, latitude]` coordinate pair |
| [`FeatureProperties`](/api/types#featureproperties) | Arbitrary key-value properties |
| [`LibreDrawOptions`](/api/types#libredrawoptions) | Constructor options |
| [`ToolbarOptions`](/api/types#toolbaroptions) | Toolbar configuration |
| [`ToolbarPosition`](/api/types#toolbarposition) | Toolbar placement |
| [`ToolbarControls`](/api/types#toolbarcontrols) | Which toolbar buttons to show |
| [`ModeName`](/api/types#modename) | `'idle' \| 'draw' \| 'select'` |
| [`Action`](/api/types#action) | Undo/redo action interface |
| [`ActionType`](/api/types#actiontype) | `'create' \| 'update' \| 'delete'` |
| [`NormalizedInputEvent`](/api/types#normalizedinputevent) | Unified mouse/touch event |
| [`InputType`](/api/types#inputtype) | `'mouse' \| 'touch'` |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| [`create`](/api/events#create) | `CreateEvent` | Polygon created |
| [`update`](/api/events#update) | `UpdateEvent` | Polygon edited |
| [`delete`](/api/events#delete) | `DeleteEvent` | Polygon deleted |
| [`selectionchange`](/api/events#selectionchange) | `SelectionChangeEvent` | Selection changed |
| [`modechange`](/api/events#modechange) | `ModeChangeEvent` | Mode switched |

## Quick Example

```ts
import { LibreDraw } from '@sindicum/libre-draw';
import type { LibreDrawFeature, CreateEvent } from '@sindicum/libre-draw';

const draw = new LibreDraw(map);

draw.on('create', (e: CreateEvent) => {
  const feature: LibreDrawFeature = e.feature;
  console.log(feature.id, feature.geometry.coordinates);
});
```
