import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrawMode } from '../../../src/modes/DrawMode';
import type { DrawModeCallbacks } from '../../../src/modes/DrawMode';
import type { NormalizedInputEvent } from '../../../src/types/input';
import type { LibreDrawFeature } from '../../../src/types/features';

function createMockCallbacks(): DrawModeCallbacks {
  return {
    addFeatureToStore: vi.fn((f: LibreDrawFeature) => f),
    pushToHistory: vi.fn(),
    emitEvent: vi.fn(),
    renderPreview: vi.fn(),
    clearPreview: vi.fn(),
    renderFeatures: vi.fn(),
    getScreenPoint: vi.fn((lngLat) => ({ x: lngLat.lng * 10, y: lngLat.lat * 10 })),
  };
}

function createPointerEvent(
  lng: number,
  lat: number,
  x?: number,
  y?: number,
): NormalizedInputEvent {
  return {
    lngLat: { lng, lat },
    point: { x: x ?? lng * 10, y: y ?? lat * 10 },
    originalEvent: new MouseEvent('click'),
    inputType: 'mouse',
  };
}

describe('DrawMode', () => {
  let callbacks: DrawModeCallbacks;
  let drawMode: DrawMode;

  beforeEach(() => {
    callbacks = createMockCallbacks();
    drawMode = new DrawMode(callbacks);
  });

  it('should not respond to events when inactive', () => {
    drawMode.onPointerDown(createPointerEvent(0, 0));
    expect(callbacks.renderPreview).not.toHaveBeenCalled();
  });

  it('should add vertices on pointerDown when active', () => {
    drawMode.activate();
    drawMode.onPointerDown(createPointerEvent(0, 0));

    expect(callbacks.renderPreview).toHaveBeenCalled();
  });

  it('should update preview on pointer move after first vertex', () => {
    drawMode.activate();
    drawMode.onPointerDown(createPointerEvent(0, 0));
    drawMode.onPointerMove(createPointerEvent(5, 5));

    expect(callbacks.renderPreview).toHaveBeenCalledTimes(2);
  });

  it('should not update preview on pointer move with no vertices', () => {
    drawMode.activate();
    drawMode.onPointerMove(createPointerEvent(5, 5));

    expect(callbacks.renderPreview).not.toHaveBeenCalled();
  });

  it('should finalize polygon on double click with 3+ vertices', () => {
    drawMode.activate();

    // Add 4 vertices (the 4th is from the double-click's first click)
    drawMode.onPointerDown(createPointerEvent(0, 0));
    drawMode.onPointerDown(createPointerEvent(10, 0));
    drawMode.onPointerDown(createPointerEvent(10, 10));
    drawMode.onPointerDown(createPointerEvent(5, 5)); // extra from dblclick

    const dblClickEvent = createPointerEvent(5, 5);
    vi.spyOn(dblClickEvent.originalEvent, 'preventDefault');
    vi.spyOn(dblClickEvent.originalEvent, 'stopPropagation');

    drawMode.onDoubleClick(dblClickEvent);

    expect(callbacks.addFeatureToStore).toHaveBeenCalled();
    expect(callbacks.pushToHistory).toHaveBeenCalled();
    expect(callbacks.emitEvent).toHaveBeenCalledWith(
      'create',
      expect.objectContaining({
        feature: expect.objectContaining({ type: 'Feature' }),
      }),
    );
    expect(callbacks.clearPreview).toHaveBeenCalled();
    expect(dblClickEvent.originalEvent.preventDefault).toHaveBeenCalled();
  });

  it('should cancel drawing on Escape key', () => {
    drawMode.activate();
    drawMode.onPointerDown(createPointerEvent(0, 0));
    drawMode.onPointerDown(createPointerEvent(10, 0));

    drawMode.onKeyDown('Escape', new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(callbacks.clearPreview).toHaveBeenCalled();
  });

  it('should remove last vertex on long press', () => {
    drawMode.activate();
    drawMode.onPointerDown(createPointerEvent(0, 0));
    drawMode.onPointerDown(createPointerEvent(10, 0));

    drawMode.onLongPress(createPointerEvent(0, 0));

    // Should render preview with remaining vertex
    expect(callbacks.renderPreview).toHaveBeenCalled();
  });

  it('should clear preview when long press removes last vertex', () => {
    drawMode.activate();
    drawMode.onPointerDown(createPointerEvent(0, 0));

    // Clear previous calls
    vi.mocked(callbacks.clearPreview).mockClear();

    drawMode.onLongPress(createPointerEvent(0, 0));

    expect(callbacks.clearPreview).toHaveBeenCalled();
  });

  it('should clear preview and reset on deactivate', () => {
    drawMode.activate();
    drawMode.onPointerDown(createPointerEvent(0, 0));

    vi.mocked(callbacks.clearPreview).mockClear();
    drawMode.deactivate();

    expect(callbacks.clearPreview).toHaveBeenCalled();
  });

  it('should close polygon when clicking near first vertex', () => {
    drawMode.activate();

    // getScreenPoint: lng*10, lat*10
    drawMode.onPointerDown(createPointerEvent(0, 0)); // first vertex at screen (0, 0)
    drawMode.onPointerDown(createPointerEvent(10, 0));
    drawMode.onPointerDown(createPointerEvent(10, 10));

    // Click near first vertex (within 10px threshold)
    // First vertex screen point: (0, 0), clicking at screen (1, 1) → distance ~1.4px
    drawMode.onPointerDown(createPointerEvent(0.1, 0.1, 1, 1));

    expect(callbacks.addFeatureToStore).toHaveBeenCalled();
  });
});
