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

function makeTriangle(id: string): LibreDrawFeature {
  return {
    id,
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [5, 10],
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

function createTouchEvent(lng: number, lat: number): NormalizedInputEvent {
  return {
    lngLat: { lng, lat },
    point: { x: lng * 10, y: lat * 10 },
    originalEvent: new MouseEvent('click'),
    inputType: 'touch',
  };
}

function createCallbacks(
  featureMap: Map<string, LibreDrawFeature>,
): SelectModeCallbacks {
  return {
    removeFeatureFromStore: vi.fn((id: string) => {
      const f = featureMap.get(id);
      featureMap.delete(id);
      return f;
    }),
    pushToHistory: vi.fn(),
    emitEvent: vi.fn(),
    renderFeatures: vi.fn(),
    getFeatureById: vi.fn((id: string) => featureMap.get(id)),
    getAllFeatures: vi.fn(() => Array.from(featureMap.values())),
    getScreenPoint: vi.fn((lngLat: { lng: number; lat: number }) => ({
      x: lngLat.lng * 10,
      y: lngLat.lat * 10,
    })),
    updateFeatureInStore: vi.fn((id: string, feature: LibreDrawFeature) => {
      featureMap.set(id, feature);
    }),
    renderVertices: vi.fn(),
    clearVertices: vi.fn(),
    setDragPan: vi.fn(),
  };
}

describe('SelectMode', () => {
  let callbacks: SelectModeCallbacks;
  let selectMode: SelectMode;
  let onSelectionChange: ReturnType<typeof vi.fn>;
  let featureMap: Map<string, LibreDrawFeature>;

  beforeEach(() => {
    featureMap = new Map();
    featureMap.set('f1', makeFeature('f1'));
    callbacks = createCallbacks(featureMap);
    onSelectionChange = vi.fn();
    selectMode = new SelectMode(callbacks, onSelectionChange);
  });

  // --- Original selection tests ---

  it('should not respond to events when inactive', () => {
    selectMode.onPointerDown(createPointerEvent(5, 5));
    expect(callbacks.getAllFeatures).not.toHaveBeenCalled();
  });

  it('should select a feature when clicking inside it', () => {
    selectMode.activate();
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

  it('should NOT delete polygon on long press when no vertex is hit', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5));

    // Long press in the middle of the polygon (not near any vertex)
    selectMode.onLongPress(createPointerEvent(5, 5));

    // Safe: polygon should NOT be deleted when missing a vertex
    expect(callbacks.removeFeatureFromStore).not.toHaveBeenCalled();
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

  // --- Vertex handles display ---

  it('should show vertex handles when a polygon is selected', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5));

    expect(callbacks.renderVertices).toHaveBeenCalledWith(
      'f1',
      expect.any(Array),
      expect.any(Array),
      undefined,
    );
  });

  it('should clear vertex handles on deselect', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5));
    selectMode.onPointerDown(createPointerEvent(50, 50)); // deselect

    expect(callbacks.clearVertices).toHaveBeenCalled();
  });

  it('should clear vertex handles on deactivate', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5));

    selectMode.deactivate();

    expect(callbacks.clearVertices).toHaveBeenCalled();
  });

  it('should refresh vertex handles when refreshVertexHandles is called', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5));

    vi.mocked(callbacks.renderVertices).mockClear();

    // Simulate external geometry change (e.g. undo/redo)
    selectMode.refreshVertexHandles();

    expect(callbacks.renderVertices).toHaveBeenCalledWith(
      'f1',
      expect.any(Array),
      expect.any(Array),
      undefined,
    );
  });

  it('should clear selection when refreshVertexHandles finds feature removed', () => {
    selectMode.activate();
    selectMode.onPointerDown(createPointerEvent(5, 5));
    expect(selectMode.getSelectedIds()).toContain('f1');

    // Remove the feature (simulating undo of a create)
    featureMap.delete('f1');

    selectMode.refreshVertexHandles();

    expect(selectMode.getSelectedIds()).toHaveLength(0);
    expect(callbacks.clearVertices).toHaveBeenCalled();
  });

  // --- Vertex drag tests ---

  describe('vertex drag', () => {
    it('should start drag when clicking near a vertex', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select polygon

      // Click near vertex (0,0) → screen point (0,0)
      selectMode.onPointerDown(createPointerEvent(0, 0));

      expect(callbacks.setDragPan).toHaveBeenCalledWith(false);
    });

    it('should update vertex position during drag', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      // Start drag on vertex (0,0)
      selectMode.onPointerDown(createPointerEvent(0, 0));

      // Move to new position
      selectMode.onPointerMove(createPointerEvent(2, 2));

      expect(callbacks.updateFeatureInStore).toHaveBeenCalled();
      expect(callbacks.renderFeatures).toHaveBeenCalled();
    });

    it('should commit drag on pointer up with UpdateAction', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select
      selectMode.onPointerDown(createPointerEvent(0, 0)); // start drag

      selectMode.onPointerMove(createPointerEvent(2, 2)); // move
      selectMode.onPointerUp(createPointerEvent(2, 2)); // release

      expect(callbacks.pushToHistory).toHaveBeenCalled();
      expect(callbacks.emitEvent).toHaveBeenCalledWith(
        'update',
        expect.objectContaining({
          feature: expect.any(Object),
          oldFeature: expect.any(Object),
        }),
      );
      expect(callbacks.setDragPan).toHaveBeenCalledWith(true);
    });

    it('should not start drag when clicking far from vertices', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      vi.mocked(callbacks.setDragPan).mockClear();

      // Click in the middle of the polygon, far from any vertex
      selectMode.onPointerDown(createPointerEvent(5, 5));

      // This should toggle deselection, not start a drag
      expect(callbacks.setDragPan).not.toHaveBeenCalledWith(false);
    });

    it('should restore dragPan on drag end', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select
      selectMode.onPointerDown(createPointerEvent(0, 0)); // start drag

      selectMode.onPointerUp(createPointerEvent(0, 0)); // end drag

      expect(callbacks.setDragPan).toHaveBeenCalledWith(true);
    });
  });

  // --- Midpoint insertion tests ---

  describe('midpoint insertion', () => {
    it('should insert a new vertex when dragging from a midpoint', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      // Midpoint between (0,0) and (10,0) is (5,0)
      selectMode.onPointerDown(createPointerEvent(5, 0));

      // Should have inserted a vertex and started drag
      expect(callbacks.updateFeatureInStore).toHaveBeenCalled();
      expect(callbacks.setDragPan).toHaveBeenCalledWith(false);

      // The updated feature should have 5 unique vertices (was 4)
      const updatedFeature = vi.mocked(callbacks.updateFeatureInStore).mock
        .calls[0][1] as LibreDrawFeature;
      const ring = updatedFeature.geometry.coordinates[0];
      // ring includes closing point, so 6 for 5 unique vertices
      expect(ring.length).toBe(6);
    });

    it('should show vertex handles immediately on midpoint insertion', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      vi.mocked(callbacks.renderVertices).mockClear();

      // Click midpoint between (0,0) and (10,0)
      selectMode.onPointerDown(createPointerEvent(5, 0));

      // Vertex handles should be rendered with the new vertex count
      expect(callbacks.renderVertices).toHaveBeenCalledWith(
        'f1',
        expect.any(Array),
        expect.any(Array),
        undefined,
      );
    });
  });

  // --- Hit threshold tests ---

  describe('hit threshold by input type', () => {
    it('should use 10px threshold for mouse input', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      vi.mocked(callbacks.setDragPan).mockClear();

      // Vertex at (0,0) → screen (0,0). Point at (0.9,0) → screen (9,0) → distance 9px
      // Should hit with mouse threshold (10px)
      selectMode.onPointerDown(createPointerEvent(0.9, 0));
      expect(callbacks.setDragPan).toHaveBeenCalledWith(false); // drag started
    });

    it('should miss at 11px with mouse input', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      vi.mocked(callbacks.setDragPan).mockClear();

      // Point at (1.1,0) → screen (11,0) → distance 11px, outside mouse threshold
      selectMode.onPointerDown(createPointerEvent(1.1, 0));
      // Should NOT start drag (triggers deselection instead)
      expect(callbacks.setDragPan).not.toHaveBeenCalledWith(false);
    });

    it('should use 24px threshold for touch input', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      vi.mocked(callbacks.setDragPan).mockClear();

      // Point at (2.3,0) → screen (23,0) → distance 23px
      // Should hit with touch threshold (24px) but miss with mouse (10px)
      selectMode.onPointerDown(createTouchEvent(2.3, 0));
      expect(callbacks.setDragPan).toHaveBeenCalledWith(false); // drag started
    });

    it('should miss at 25px with touch input', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      vi.mocked(callbacks.setDragPan).mockClear();

      // Point at (2.5,0) → screen (25,0) → distance 25px, outside touch threshold
      selectMode.onPointerDown(createTouchEvent(2.5, 0));
      expect(callbacks.setDragPan).not.toHaveBeenCalledWith(false);
    });
  });

  // --- Vertex highlight tests ---

  describe('vertex highlight', () => {
    it('should call renderVertices with highlight index when mouse is near a vertex', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      vi.mocked(callbacks.renderVertices).mockClear();

      // Move mouse near vertex (0,0) → screen (0,0), mouse at (0.5,0) → screen (5,0) → 5px
      selectMode.onPointerMove(createPointerEvent(0.5, 0));

      expect(callbacks.renderVertices).toHaveBeenCalledWith(
        'f1',
        expect.any(Array),
        expect.any(Array),
        0, // highlight index for vertex (0,0)
      );
    });

    it('should clear highlight when mouse moves away from vertices', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      // Move near vertex to highlight
      selectMode.onPointerMove(createPointerEvent(0.5, 0));

      vi.mocked(callbacks.renderVertices).mockClear();

      // Move far from any vertex
      selectMode.onPointerMove(createPointerEvent(5, 5));

      expect(callbacks.renderVertices).toHaveBeenCalledWith(
        'f1',
        expect.any(Array),
        expect.any(Array),
        undefined, // no highlight
      );
    });

    it('should not update highlight when index does not change', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      // Move near vertex (0,0)
      selectMode.onPointerMove(createPointerEvent(0.5, 0));

      vi.mocked(callbacks.renderVertices).mockClear();

      // Move slightly but still near same vertex
      selectMode.onPointerMove(createPointerEvent(0.3, 0));

      // Should NOT re-render since highlight index didn't change
      expect(callbacks.renderVertices).not.toHaveBeenCalled();
    });
  });

  // --- Vertex deletion tests ---

  describe('vertex deletion', () => {
    it('should delete a vertex on double-click', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      vi.mocked(callbacks.pushToHistory).mockClear();
      vi.mocked(callbacks.emitEvent).mockClear();

      // Double-click on vertex (0,0)
      const dblEvt = createPointerEvent(0, 0);
      vi.spyOn(dblEvt.originalEvent, 'preventDefault').mockImplementation(() => {});
      vi.spyOn(dblEvt.originalEvent, 'stopPropagation').mockImplementation(() => {});
      selectMode.onDoubleClick(dblEvt);

      // Vertex should be removed
      const updatedFeature = featureMap.get('f1')!;
      const ring = updatedFeature.geometry.coordinates[0];
      // Was 4 unique vertices, now 3 + closing = 4
      expect(ring.length).toBe(4);

      expect(callbacks.pushToHistory).toHaveBeenCalled();
      expect(callbacks.emitEvent).toHaveBeenCalledWith(
        'update',
        expect.any(Object),
      );
    });

    it('should not delete vertex when polygon has only 3 vertices', () => {
      featureMap.clear();
      featureMap.set('t1', makeTriangle('t1'));

      const triCallbacks = createCallbacks(featureMap);
      const triSelect = new SelectMode(triCallbacks);
      triSelect.activate();
      triSelect.onPointerDown(createPointerEvent(5, 3)); // select triangle

      vi.mocked(triCallbacks.updateFeatureInStore).mockClear();

      // Double-click on vertex (0,0)
      const dblEvt = createPointerEvent(0, 0);
      vi.spyOn(dblEvt.originalEvent, 'preventDefault').mockImplementation(() => {});
      vi.spyOn(dblEvt.originalEvent, 'stopPropagation').mockImplementation(() => {});
      triSelect.onDoubleClick(dblEvt);

      // Should NOT have updated the feature
      expect(triCallbacks.updateFeatureInStore).not.toHaveBeenCalled();
    });

    it('should push UpdateAction when deleting a vertex', () => {
      selectMode.activate();
      selectMode.onPointerDown(createPointerEvent(5, 5)); // select

      vi.mocked(callbacks.pushToHistory).mockClear();

      const dblEvt = createPointerEvent(0, 0);
      vi.spyOn(dblEvt.originalEvent, 'preventDefault').mockImplementation(() => {});
      vi.spyOn(dblEvt.originalEvent, 'stopPropagation').mockImplementation(() => {});
      selectMode.onDoubleClick(dblEvt);

      expect(callbacks.pushToHistory).toHaveBeenCalledOnce();
    });
  });
});
