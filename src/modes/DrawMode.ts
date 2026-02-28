import type { Mode } from './Mode';
import type { NormalizedInputEvent } from '../types/input';
import type {
  LibreDrawFeature,
  Position,
  Action,
} from '../types/features';
import type { LibreDrawEventMap } from '../types/events';
import { CreateAction } from '../types/features';
import {
  wouldNewVertexCauseIntersection,
  wouldClosingCauseIntersection,
} from '../validation/intersection';

/**
 * Threshold in pixels: if a click is within this distance of the first
 * vertex, the polygon is automatically closed.
 */
const CLOSE_THRESHOLD_PX = 10;

/**
 * Minimum number of unique vertices required to form a valid polygon.
 */
const MIN_VERTICES = 3;

/**
 * Callbacks that DrawMode needs from the host application.
 */
export interface DrawModeCallbacks {
  /** Add a feature to the store and return it with its assigned ID. */
  addFeatureToStore(feature: LibreDrawFeature): LibreDrawFeature;
  /** Push an action to the history manager. */
  pushToHistory(action: Action): void;
  /** Emit an event through the event bus. */
  emitEvent<K extends keyof LibreDrawEventMap>(
    type: K,
    payload: LibreDrawEventMap[K],
  ): void;
  /** Render a preview of the polygon being drawn. */
  renderPreview(coordinates: Position[]): void;
  /** Clear the drawing preview. */
  clearPreview(): void;
  /** Re-render all features. */
  renderFeatures(): void;
  /** Convert a geographic coordinate to a screen point. */
  getScreenPoint(lngLat: { lng: number; lat: number }): { x: number; y: number };
}

/**
 * Drawing mode for creating new polygons.
 *
 * Users click to add vertices. The polygon is finalized when:
 * - The user double-clicks (with at least 3 vertices), or
 * - The user clicks within 10px of the first vertex (closing the ring).
 *
 * Long press removes the last vertex (undo last point).
 * Escape cancels the entire drawing.
 */
export class DrawMode implements Mode {
  private vertices: Position[] = [];
  private isActive = false;
  private callbacks: DrawModeCallbacks;

  constructor(callbacks: DrawModeCallbacks) {
    this.callbacks = callbacks;
  }

  activate(): void {
    this.isActive = true;
    this.vertices = [];
  }

  deactivate(): void {
    this.isActive = false;
    this.vertices = [];
    this.callbacks.clearPreview();
  }

  onPointerDown(event: NormalizedInputEvent): void {
    if (!this.isActive) return;

    const newVertex: Position = [event.lngLat.lng, event.lngLat.lat];

    // Check if this click is close to the first vertex (closing the polygon)
    if (this.vertices.length >= MIN_VERTICES) {
      const firstVertex = this.vertices[0];
      const firstScreenPt = this.callbacks.getScreenPoint({
        lng: firstVertex[0],
        lat: firstVertex[1],
      });
      const dx = event.point.x - firstScreenPt.x;
      const dy = event.point.y - firstScreenPt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= CLOSE_THRESHOLD_PX) {
        // Reject closing if it would cause self-intersection
        if (wouldClosingCauseIntersection(this.vertices)) return;
        this.finalizePolygon();
        return;
      }
    }

    // Reject vertex if it would cause self-intersection
    if (wouldNewVertexCauseIntersection(this.vertices, newVertex)) return;

    this.vertices.push(newVertex);
    this.updatePreview(event);
  }

  onPointerMove(event: NormalizedInputEvent): void {
    if (!this.isActive || this.vertices.length === 0) return;
    this.updatePreview(event);
  }

  onPointerUp(_event: NormalizedInputEvent): void {
    // No-op for draw mode; action happens on pointer down
  }

  onDoubleClick(event: NormalizedInputEvent): void {
    if (!this.isActive) return;

    // Remove the last vertex added by the double-click's second pointerdown
    // (it would have been added in onPointerDown before onDoubleClick fires)
    if (this.vertices.length > MIN_VERTICES) {
      this.vertices.pop();
    }

    if (this.vertices.length >= MIN_VERTICES) {
      // Reject closing if it would cause self-intersection
      if (!wouldClosingCauseIntersection(this.vertices)) {
        this.finalizePolygon();
      }
    }

    // Prevent the double click from being handled by the map
    event.originalEvent.preventDefault();
    event.originalEvent.stopPropagation();
  }

  onLongPress(_event: NormalizedInputEvent): void {
    if (!this.isActive) return;

    // Remove the last vertex (undo last point)
    if (this.vertices.length > 0) {
      this.vertices.pop();
      if (this.vertices.length === 0) {
        this.callbacks.clearPreview();
      } else {
        this.callbacks.renderPreview(this.buildPreviewCoordinates());
      }
    }
  }

  onKeyDown(key: string, _event: KeyboardEvent): void {
    if (!this.isActive) return;

    if (key === 'Escape') {
      this.cancelDrawing();
    }
  }

  /**
   * Build the preview coordinate ring for rendering,
   * including cursor position if available.
   */
  private buildPreviewCoordinates(
    cursorPos?: Position,
  ): Position[] {
    const coords = [...this.vertices];
    if (cursorPos) {
      coords.push(cursorPos);
    }
    // Close the ring for preview
    if (coords.length > 0) {
      coords.push([...coords[0]] as Position);
    }
    return coords;
  }

  /**
   * Update the preview rendering with the current cursor position.
   */
  private updatePreview(event: NormalizedInputEvent): void {
    const cursorPos: Position = [event.lngLat.lng, event.lngLat.lat];
    const previewCoords = this.buildPreviewCoordinates(cursorPos);
    this.callbacks.renderPreview(previewCoords);
  }

  /**
   * Finalize the polygon: create the feature, push to history, emit event.
   */
  private finalizePolygon(): void {
    if (this.vertices.length < MIN_VERTICES) return;

    // Close the ring
    const ring: Position[] = [
      ...this.vertices,
      [...this.vertices[0]] as Position,
    ];

    const feature: LibreDrawFeature = {
      id: crypto.randomUUID(),
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
      properties: {},
    };

    const stored = this.callbacks.addFeatureToStore(feature);
    const action = new CreateAction(stored);
    this.callbacks.pushToHistory(action);
    this.callbacks.emitEvent('create', { feature: stored });
    this.callbacks.renderFeatures();

    // Reset state for next drawing
    this.vertices = [];
    this.callbacks.clearPreview();
  }

  /**
   * Cancel the current drawing operation.
   */
  private cancelDrawing(): void {
    this.vertices = [];
    this.callbacks.clearPreview();
  }
}
