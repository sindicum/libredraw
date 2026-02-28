import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { FeatureStore } from '../../src/core/FeatureStore';
import { HistoryManager } from '../../src/core/HistoryManager';
import { ModeManager } from '../../src/core/ModeManager';
import { IdleMode } from '../../src/modes/IdleMode';
import { DrawMode } from '../../src/modes/DrawMode';
import { SelectMode } from '../../src/modes/SelectMode';
import type { NormalizedInputEvent } from '../../src/types/input';

function createPointerEvent(
  lng: number,
  lat: number,
): NormalizedInputEvent {
  return {
    lngLat: { lng, lat },
    point: { x: lng * 10, y: lat * 10 },
    originalEvent: new MouseEvent('click'),
    inputType: 'mouse',
  };
}

describe('Edit Flow Integration', () => {
  function createSystem() {
    const eventBus = new EventBus();
    const store = new FeatureStore();
    const history = new HistoryManager();
    const modeManager = new ModeManager();

    const drawMode = new DrawMode({
      addFeatureToStore: (f) => store.add(f),
      pushToHistory: (a) => history.push(a),
      emitEvent: (t, p) => eventBus.emit(t, p),
      renderPreview: vi.fn(),
      clearPreview: vi.fn(),
      renderFeatures: vi.fn(),
      getScreenPoint: (lngLat) => ({
        x: lngLat.lng * 10,
        y: lngLat.lat * 10,
      }),
    });

    const selectMode = new SelectMode(
      {
        removeFeatureFromStore: (id) => store.remove(id),
        pushToHistory: (a) => history.push(a),
        emitEvent: (t, p) => eventBus.emit(t, p),
        renderFeatures: vi.fn(),
        getFeatureById: (id) => store.getById(id),
        getAllFeatures: () => store.getAll(),
        getScreenPoint: (lngLat) => ({
          x: lngLat.lng * 10,
          y: lngLat.lat * 10,
        }),
        updateFeatureInStore: (id, feature) => store.update(id, feature),
        renderVertices: vi.fn(),
        clearVertices: vi.fn(),
        setDragPan: vi.fn(),
      },
      vi.fn(),
    );

    modeManager.registerMode('idle', new IdleMode());
    modeManager.registerMode('draw', drawMode);
    modeManager.registerMode('select', selectMode);

    return { eventBus, store, history, modeManager, selectMode };
  }

  /**
   * Helper: draw a square polygon (0,0)-(10,0)-(10,10)-(0,10)
   */
  function drawSquare(modeManager: ModeManager) {
    modeManager.setMode('draw');
    const mode = modeManager.getCurrentMode()!;
    mode.onPointerDown(createPointerEvent(0, 0));
    mode.onPointerDown(createPointerEvent(10, 0));
    mode.onPointerDown(createPointerEvent(10, 10));
    mode.onPointerDown(createPointerEvent(0, 10));

    // Extra click from double-click first event
    mode.onPointerDown(createPointerEvent(5, 5));

    const dblEvt = createPointerEvent(5, 5);
    vi.spyOn(dblEvt.originalEvent, 'preventDefault').mockImplementation(
      () => {},
    );
    vi.spyOn(dblEvt.originalEvent, 'stopPropagation').mockImplementation(
      () => {},
    );
    mode.onDoubleClick(dblEvt);
  }

  it('should draw, select, drag vertex, undo, and redo', () => {
    const { store, history, modeManager } = createSystem();

    // Draw a square
    drawSquare(modeManager);
    expect(store.getAll()).toHaveLength(1);

    const featureId = store.getAll()[0].id;
    const originalCoords = store.getById(featureId)!.geometry.coordinates[0];
    const originalFirstVertex = [...originalCoords[0]];

    // Switch to select mode and select the polygon
    modeManager.setMode('select');
    const selectImpl = modeManager.getCurrentMode()!;
    selectImpl.onPointerDown(createPointerEvent(5, 5)); // select

    // Drag vertex (0,0) to (2,2)
    selectImpl.onPointerDown(createPointerEvent(0, 0)); // start drag
    selectImpl.onPointerMove(createPointerEvent(2, 2)); // move
    selectImpl.onPointerUp(createPointerEvent(2, 2)); // commit

    // Verify vertex moved
    const movedCoords = store.getById(featureId)!.geometry.coordinates[0];
    expect(movedCoords[0][0]).toBe(2);
    expect(movedCoords[0][1]).toBe(2);

    // Undo should restore original position
    history.undo(store);
    const restoredCoords = store.getById(featureId)!.geometry.coordinates[0];
    expect(restoredCoords[0][0]).toBe(originalFirstVertex[0]);
    expect(restoredCoords[0][1]).toBe(originalFirstVertex[1]);

    // Redo should apply the move again
    history.redo(store);
    const redoneCoords = store.getById(featureId)!.geometry.coordinates[0];
    expect(redoneCoords[0][0]).toBe(2);
    expect(redoneCoords[0][1]).toBe(2);
  });

  it('should add vertex via midpoint and undo', () => {
    const { store, history, modeManager } = createSystem();

    // Draw a square
    drawSquare(modeManager);
    const featureId = store.getAll()[0].id;

    // Original ring has 5 unique vertices (4 square + 1 extra from draw) + closing
    const originalRingLength =
      store.getById(featureId)!.geometry.coordinates[0].length;

    // Switch to select and select
    modeManager.setMode('select');
    const selectImpl = modeManager.getCurrentMode()!;
    selectImpl.onPointerDown(createPointerEvent(5, 5)); // select

    // Click on midpoint between vertex (0,0) and (10,0) → midpoint is (5,0)
    selectImpl.onPointerDown(createPointerEvent(5, 0)); // insert midpoint
    selectImpl.onPointerMove(createPointerEvent(5, -2)); // drag it down
    selectImpl.onPointerUp(createPointerEvent(5, -2)); // commit

    // Ring should have one more vertex
    const newRingLength =
      store.getById(featureId)!.geometry.coordinates[0].length;
    expect(newRingLength).toBe(originalRingLength + 1);

    // Undo should restore original vertex count
    history.undo(store);
    const undoneRingLength =
      store.getById(featureId)!.geometry.coordinates[0].length;
    expect(undoneRingLength).toBe(originalRingLength);
  });

  it('should delete vertex via double-click and undo', () => {
    const { store, history, modeManager } = createSystem();

    // Draw a square
    drawSquare(modeManager);
    const featureId = store.getAll()[0].id;
    const originalRingLength =
      store.getById(featureId)!.geometry.coordinates[0].length;

    // Switch to select and select
    modeManager.setMode('select');
    const selectImpl = modeManager.getCurrentMode()!;
    selectImpl.onPointerDown(createPointerEvent(5, 5)); // select

    // Double-click on vertex (0,0) to delete it
    const dblEvt = createPointerEvent(0, 0);
    vi.spyOn(dblEvt.originalEvent, 'preventDefault').mockImplementation(
      () => {},
    );
    vi.spyOn(dblEvt.originalEvent, 'stopPropagation').mockImplementation(
      () => {},
    );
    selectImpl.onDoubleClick(dblEvt);

    // Ring should have one fewer vertex
    const newRingLength =
      store.getById(featureId)!.geometry.coordinates[0].length;
    expect(newRingLength).toBe(originalRingLength - 1);

    // Undo should restore
    history.undo(store);
    const undoneRingLength =
      store.getById(featureId)!.geometry.coordinates[0].length;
    expect(undoneRingLength).toBe(originalRingLength);
  });
});
