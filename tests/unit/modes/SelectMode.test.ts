import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectMode } from '../../../src/modes/SelectMode';
import type { SelectModeCallbacks } from '../../../src/modes/SelectMode';
import type { NormalizedInputEvent } from '../../../src/types/input';
import type { LibreDrawFeature } from '../../../src/types/features';

function makeFeature(id: string): LibreDrawFeature {
  return {
    id,
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
    properties: {},
  };
}

function createPointerEvent(lng: number, lat: number): NormalizedInputEvent {
  return {
    lngLat: { lng, lat },
    point: { x: lng * 10, y: lat * 10 },
    originalEvent: new MouseEvent('click'),
    inputType: 'mouse',
  };
}

describe('SelectMode', () => {
  let callbacks: SelectModeCallbacks;
  let selectMode: SelectMode;
  let onSelectionChange: ReturnType<typeof vi.fn>;
  const features = [makeFeature('f1')];

  beforeEach(() => {
    callbacks = {
      removeFeatureFromStore: vi.fn((id: string) =>
        features.find((f) => f.id === id),
      ),
      pushToHistory: vi.fn(),
      emitEvent: vi.fn(),
      renderFeatures: vi.fn(),
      getFeatureById: vi.fn((id: string) =>
        features.find((f) => f.id === id),
      ),
      getAllFeatures: vi.fn(() => features),
    };
    onSelectionChange = vi.fn();
    selectMode = new SelectMode(callbacks, onSelectionChange);
  });

  it('should not respond to events when inactive', () => {
    selectMode.onPointerDown(createPointerEvent(5, 5));
    expect(callbacks.getAllFeatures).not.toHaveBeenCalled();
  });

  it('should select a feature when clicking inside it', () => {
    selectMode.activate();
    // Click inside the polygon (0,0)-(10,0)-(10,10)-(0,10)
    selectMode.onPointerDown(createPointerEvent(5, 5));

    expect(selectMode.getSelectedIds()).toContain('f1');
    expect(callbacks.emitEvent).toHaveBeenCalledWith(
      'selectionchange',
      expect.objectContaining({ selectedIds: ['f1'] }),
    );
  });

  it('should deselect when clicking outside', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5)); // select
    selectMode.onPointerDown(createPointerEvent(50, 50)); // click outside

    expect(selectMode.getSelectedIds()).toHaveLength(0);
  });

  it('should deselect a selected feature when clicking on it again', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5)); // select
    selectMode.onPointerDown(createPointerEvent(5, 5)); // toggle off

    expect(selectMode.getSelectedIds()).toHaveLength(0);
  });

  it('should delete selected features on Delete key', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5)); // select

    selectMode.onKeyDown(
      'Delete',
      new KeyboardEvent('keydown', { key: 'Delete' }),
    );

    expect(callbacks.removeFeatureFromStore).toHaveBeenCalledWith('f1');
    expect(callbacks.pushToHistory).toHaveBeenCalled();
    expect(callbacks.emitEvent).toHaveBeenCalledWith(
      'delete',
      expect.objectContaining({ feature: expect.objectContaining({ id: 'f1' }) }),
    );
  });

  it('should delete selected features on Backspace key', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5));

    selectMode.onKeyDown(
      'Backspace',
      new KeyboardEvent('keydown', { key: 'Backspace' }),
    );

    expect(callbacks.removeFeatureFromStore).toHaveBeenCalledWith('f1');
  });

  it('should delete on long press (mobile)', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5));

    selectMode.onLongPress(createPointerEvent(5, 5));

    expect(callbacks.removeFeatureFromStore).toHaveBeenCalledWith('f1');
  });

  it('should clear selection on deactivate', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5));
    expect(selectMode.getSelectedIds()).toHaveLength(1);

    selectMode.deactivate();
    expect(selectMode.getSelectedIds()).toHaveLength(0);
  });

  it('should not delete when nothing is selected', () => {
    selectMode.activate();
    selectMode.onKeyDown(
      'Delete',
      new KeyboardEvent('keydown', { key: 'Delete' }),
    );

    expect(callbacks.removeFeatureFromStore).not.toHaveBeenCalled();
  });

  it('should call onSelectionChange callback', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5));

    expect(onSelectionChange).toHaveBeenCalledWith(['f1']);
  });
});
