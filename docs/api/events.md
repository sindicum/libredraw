# Events

LibreDraw emits events during drawing and editing operations. Subscribe and unsubscribe using the [`on`](/api/libre-draw#on-type-listener) and [`off`](/api/libre-draw#off-type-listener) methods.

## Event Map

```ts
interface LibreDrawEventMap {
  create: CreateEvent;
  update: UpdateEvent;
  delete: DeleteEvent;
  selectionchange: SelectionChangeEvent;
  modechange: ModeChangeEvent;
}
```

---

## `create`

Emitted when a new polygon is created (user completes drawing with double-click/double-tap).

### Payload: `CreateEvent`

```ts
interface CreateEvent {
  feature: LibreDrawFeature;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `feature` | [`LibreDrawFeature`](/api/types#libredrawfeature) | The newly created polygon feature |

### Example

```ts
draw.on('create', (e) => {
  console.log('New polygon:', e.feature.id);
  console.log('Vertices:', e.feature.geometry.coordinates[0].length - 1);

  // Save to your backend
  await savePolygon(e.feature);
});
```

---

## `update`

Emitted when an existing polygon is modified (vertex moved, vertex added/removed, polygon dragged).

### Payload: `UpdateEvent`

```ts
interface UpdateEvent {
  feature: LibreDrawFeature;
  oldFeature: LibreDrawFeature;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `feature` | [`LibreDrawFeature`](/api/types#libredrawfeature) | The updated polygon feature (new state) |
| `oldFeature` | [`LibreDrawFeature`](/api/types#libredrawfeature) | The polygon feature before the update (previous state) |

### Example

```ts
draw.on('update', (e) => {
  console.log('Polygon updated:', e.feature.id);
  console.log('Old coordinates:', e.oldFeature.geometry.coordinates);
  console.log('New coordinates:', e.feature.geometry.coordinates);
});
```

---

## `delete`

Emitted when a polygon is deleted (via toolbar button, Delete key, or `deleteFeature()` API).

### Payload: `DeleteEvent`

```ts
interface DeleteEvent {
  feature: LibreDrawFeature;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `feature` | [`LibreDrawFeature`](/api/types#libredrawfeature) | The deleted polygon feature |

### Example

```ts
draw.on('delete', (e) => {
  console.log('Polygon deleted:', e.feature.id);

  // Remove from your backend
  await removePolygon(e.feature.id);
});
```

---

## `selectionchange`

Emitted when the set of selected features changes.

### Payload: `SelectionChangeEvent`

```ts
interface SelectionChangeEvent {
  selectedIds: string[];
}
```

| Property | Type | Description |
|----------|------|-------------|
| `selectedIds` | `string[]` | Array of currently selected feature IDs. Empty array when nothing is selected. |

### Example

```ts
draw.on('selectionchange', (e) => {
  if (e.selectedIds.length > 0) {
    console.log('Selected:', e.selectedIds);
    // Enable delete button in your UI
    deleteButton.disabled = false;
  } else {
    console.log('Selection cleared');
    deleteButton.disabled = true;
  }
});
```

---

## `modechange`

Emitted when the active mode changes.

### Payload: `ModeChangeEvent`

```ts
interface ModeChangeEvent {
  mode: string;
  previousMode: string;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `mode` | `string` | The new active mode (`'idle'`, `'draw'`, or `'select'`) |
| `previousMode` | `string` | The previous mode |

### Example

```ts
draw.on('modechange', (e) => {
  console.log(`${e.previousMode} → ${e.mode}`);

  // Update your UI based on mode
  drawButton.classList.toggle('active', e.mode === 'draw');
  selectButton.classList.toggle('active', e.mode === 'select');
});
```

---

## Removing Listeners

Use [`off`](/api/libre-draw#off-type-listener) with the same function reference to remove a listener:

```ts
const onCreateHandler = (e: CreateEvent) => {
  console.log(e.feature);
};

// Subscribe
draw.on('create', onCreateHandler);

// Unsubscribe
draw.off('create', onCreateHandler);
```

::: warning
Arrow functions defined inline cannot be removed. Always store a reference:

```ts
// This CANNOT be removed later
draw.on('create', (e) => console.log(e));

// This CAN be removed later
const handler = (e: CreateEvent) => console.log(e);
draw.on('create', handler);
draw.off('create', handler);
```
:::
