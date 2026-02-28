# Modes

LibreDraw uses a mode-based architecture. Only one mode is active at a time, and each mode defines how user interactions are interpreted.

## Overview

| Mode | Description | Activated by |
|------|-------------|--------------|
| `idle` | No drawing interaction. Map behaves normally. | Default / toolbar |
| `draw` | Click to add vertices, double-click to close polygon. | Toolbar draw button / `setMode('draw')` |
| `select` | Click to select, drag to edit vertices or move polygon. | Toolbar select button / `setMode('select')` |

### Try it

Use the buttons below to switch between modes. Draw some polygons in **draw** mode, then switch to **select** mode to edit them.

<ModesDemo />

## Idle Mode

The default mode. No drawing or editing interactions are active. The map behaves normally — pan, zoom, and all standard MapLibre interactions work.

```ts
draw.setMode('idle');
```

## Draw Mode

In draw mode, you create new polygons by clicking on the map.

### Mouse Interaction

| Action | Effect |
|--------|--------|
| Click | Add a vertex |
| Double-click | Close the polygon (minimum 3 vertices) |
| Escape key | Cancel the current drawing |

### Touch Interaction

| Action | Effect |
|--------|--------|
| Tap | Add a vertex |
| Double-tap | Close the polygon |
| Long-press | Undo last vertex |

### Behavior

- A preview line follows the cursor while drawing
- A semi-transparent polygon preview shows the current shape
- Map panning is disabled during draw mode
- Double-click zoom is disabled during draw mode
- Self-intersecting polygons are automatically rejected

```ts
draw.setMode('draw');

draw.on('create', (e) => {
  console.log('New polygon:', e.feature);
  // Automatically switches to idle mode after creation
});
```

## Select Mode

In select mode, you can select existing polygons and edit them.

### Selecting

| Action | Effect |
|--------|--------|
| Click on polygon | Select it (shows vertex handles) |
| Click outside | Deselect |
| Delete key | Delete selected polygon |

### Vertex Editing

When a polygon is selected, vertex handles appear:

| Action | Effect |
|--------|--------|
| Drag a vertex | Move the vertex |
| Drag a midpoint | Insert a new vertex and drag it |
| Long-press a vertex | Delete the vertex (minimum 3 maintained) |

### Polygon Dragging

| Action | Effect |
|--------|--------|
| Drag inside polygon | Move the entire polygon |

### Behavior

- Double-click zoom is disabled during select mode
- Map panning is temporarily disabled during vertex/polygon drag
- Self-intersection is prevented during editing
- Undo/redo works for all edit operations

```ts
draw.setMode('select');

// Or programmatically select a feature
draw.selectFeature('feature-id');

draw.on('update', (e) => {
  console.log('Polygon edited:', e.feature);
});

draw.on('selectionchange', (e) => {
  console.log('Selection:', e.selectedIds);
});
```

## Mode Transitions

```
                   setMode('draw')
           ┌─────────────────────────┐
           │                         ▼
        ┌──────┐               ┌──────────┐
        │ idle │               │   draw   │
        └──────┘               └──────────┘
           ▲                         │
           │     polygon created     │
           └─────────────────────────┘
           │
           │    setMode('select')
           ├─────────────────────────┐
           │                         ▼
           │                   ┌──────────┐
           │                   │  select  │
           │                   └──────────┘
           │                         │
           └─────────────────────────┘
                  setMode('idle')
```

Every mode transition emits a `modechange` event:

```ts
draw.on('modechange', (e) => {
  console.log(`${e.previousMode} → ${e.mode}`);
});
```
