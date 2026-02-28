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

describe('Draw Flow Integration', () => {
  function createDrawingSystem() {
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

    return { eventBus, store, history, modeManager, drawMode, selectMode };
  }

  it('should draw a polygon, select it, and delete it', () => {
    const { eventBus, store, history, modeManager, selectMode } =
      createDrawingSystem();

    const createListener = vi.fn();
    const deleteListener = vi.fn();
    eventBus.on('create', createListener);
    eventBus.on('delete', deleteListener);

    // Switch to draw mode
    modeManager.setMode('draw');
    const drawMode = modeManager.getCurrentMode()!;

    // Draw a triangle
    drawMode.onPointerDown(createPointerEvent(0, 0));
    drawMode.onPointerDown(createPointerEvent(10, 0));
    drawMode.onPointerDown(createPointerEvent(10, 10));

    // Add an extra vertex from the first click of the double-click
    drawMode.onPointerDown(createPointerEvent(5, 5));

    // Finalize with double click
    const dblEvt = createPointerEvent(5, 5);
    vi.spyOn(dblEvt.originalEvent, 'preventDefault').mockImplementation(() => {});
    vi.spyOn(dblEvt.originalEvent, 'stopPropagation').mockImplementation(() => {});
    drawMode.onDoubleClick(dblEvt);

    // Verify feature was created
    expect(store.getAll()).toHaveLength(1);
    expect(createListener).toHaveBeenCalledOnce();
    expect(history.canUndo()).toBe(true);

    // Switch to select mode
    modeManager.setMode('select');

    // Select the polygon by clicking inside it
    const selectModeImpl = modeManager.getCurrentMode()!;
    selectModeImpl.onPointerDown(createPointerEvent(5, 3));

    expect(selectMode.getSelectedIds()).toHaveLength(1);

    // Delete with keyboard
    selectModeImpl.onKeyDown(
      'Delete',
      new KeyboardEvent('keydown', { key: 'Delete' }),
    );

    expect(store.getAll()).toHaveLength(0);
    expect(deleteListener).toHaveBeenCalledOnce();
  });

  it('should undo the creation after drawing', () => {
    const { store, history, modeManager } = createDrawingSystem();

    modeManager.setMode('draw');
    const drawMode = modeManager.getCurrentMode()!;

    // Draw a triangle
    drawMode.onPointerDown(createPointerEvent(0, 0));
    drawMode.onPointerDown(createPointerEvent(10, 0));
    drawMode.onPointerDown(createPointerEvent(10, 10));
    drawMode.onPointerDown(createPointerEvent(5, 5));

    const dblEvt = createPointerEvent(5, 5);
    vi.spyOn(dblEvt.originalEvent, 'preventDefault').mockImplementation(() => {});
    vi.spyOn(dblEvt.originalEvent, 'stopPropagation').mockImplementation(() => {});
    drawMode.onDoubleClick(dblEvt);

    expect(store.getAll()).toHaveLength(1);

    // Undo
    history.undo(store);
    expect(store.getAll()).toHaveLength(0);

    // Redo
    history.redo(store);
    expect(store.getAll()).toHaveLength(1);
  });

  it('should cancel drawing with Escape', () => {
    const { store, modeManager } = createDrawingSystem();

    modeManager.setMode('draw');
    const drawMode = modeManager.getCurrentMode()!;

    drawMode.onPointerDown(createPointerEvent(0, 0));
    drawMode.onPointerDown(createPointerEvent(10, 0));

    drawMode.onKeyDown('Escape', new KeyboardEvent('keydown', { key: 'Escape' }));

    // No feature should be created
    expect(store.getAll()).toHaveLength(0);
  });

  it('should switch between modes correctly', () => {
    const { modeManager } = createDrawingSystem();
    const modeChangeListener = vi.fn();

    modeManager.setOnModeChange(modeChangeListener);

    modeManager.setMode('draw');
    expect(modeManager.getMode()).toBe('draw');

    modeManager.setMode('select');
    expect(modeManager.getMode()).toBe('select');

    modeManager.setMode('idle');
    expect(modeManager.getMode()).toBe('idle');

    expect(modeChangeListener).toHaveBeenCalledTimes(3);
  });
});
