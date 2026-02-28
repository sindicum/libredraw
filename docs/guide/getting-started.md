# Getting Started

## Installation

Install LibreDraw alongside MapLibre GL JS:

```bash
npm install libre-draw maplibre-gl
```

## Basic Usage

```ts
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LibreDraw } from 'libre-draw';

// Create a MapLibre map
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [139.6917, 35.6895],
  zoom: 12,
});

// Attach LibreDraw — toolbar appears automatically
const draw = new LibreDraw(map);
```

That's it! A toolbar with draw, select, delete, undo, and redo buttons appears on the map. Click the draw button to start creating polygons.

### Try it

<BasicDemo />

## With Options

```ts
const draw = new LibreDraw(map, {
  toolbar: {
    position: 'top-right', // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    controls: {
      draw: true,
      select: true,
      delete: true,
      undo: true,
      redo: true,
    },
  },
  historyLimit: 50, // max undo/redo steps (default: 100)
});
```

## Headless Mode

If you want to control everything programmatically without the toolbar:

```ts
const draw = new LibreDraw(map, { toolbar: false });

// Control modes via API
draw.setMode('draw');
draw.setMode('select');
draw.setMode('idle');
```

## Listening to Events

```ts
draw.on('create', (e) => {
  console.log('Polygon created:', e.feature);
});

draw.on('update', (e) => {
  console.log('Polygon updated:', e.feature);
  console.log('Previous state:', e.oldFeature);
});

draw.on('delete', (e) => {
  console.log('Polygon deleted:', e.feature);
});

draw.on('selectionchange', (e) => {
  console.log('Selected IDs:', e.selectedIds);
});

draw.on('modechange', (e) => {
  console.log(`Mode: ${e.previousMode} → ${e.mode}`);
});
```

## Working with GeoJSON

### Export

```ts
const features = draw.getFeatures();
// Returns: LibreDrawFeature[]

const geojson = {
  type: 'FeatureCollection',
  features: features,
};
```

### Import

```ts
// Replace all features
draw.setFeatures({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [139.69, 35.69],
            [139.70, 35.69],
            [139.70, 35.68],
            [139.69, 35.68],
            [139.69, 35.69],
          ],
        ],
      },
      properties: {},
    },
  ],
});

// Add without clearing existing
draw.addFeatures([feature1, feature2]);
```

## Cleanup

Always destroy the instance when you're done:

```ts
draw.destroy();
// After this, all methods will throw LibreDrawError
```

## Next Steps

- Learn about [Modes](/guide/modes) (Idle, Draw, Select)
- See the full [API Reference](/api/)
- Try the [Live Demo](/examples/)
