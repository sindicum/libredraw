import type { Mode } from './Mode';
import type { NormalizedInputEvent } from '../types/input';
import type {
  LibreDrawFeature,
  Position,
  Action,
} from '../types/features';
import type { LibreDrawEventMap } from '../types/events';
import { DeleteAction, UpdateAction } from '../types/features';
import { FeatureStore } from '../core/FeatureStore';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';

/**
 * Threshold in pixels for vertex/midpoint hit testing.
 */
const HIT_THRESHOLD_PX = 10;

/**
 * Minimum number of unique vertices a polygon must maintain.
 */
const MIN_VERTICES = 3;

/**
 * Callbacks that SelectMode needs from the host application.
 */
export interface SelectModeCallbacks {
  /** Remove a feature from the store. */
  removeFeatureFromStore(id: string): LibreDrawFeature | undefined;
  /** Push an action to the history manager. */
  pushToHistory(action: Action): void;
  /** Emit an event through the event bus. */
  emitEvent<K extends keyof LibreDrawEventMap>(
    type: K,
    payload: LibreDrawEventMap[K],
  ): void;
  /** Re-render all features. */
  renderFeatures(): void;
  /** Get a feature by ID. */
  getFeatureById(id: string): LibreDrawFeature | undefined;
  /** Get all features in the store. */
  getAllFeatures(): LibreDrawFeature[];
  /** Convert a geographic coordinate to a screen point. */
  getScreenPoint(lngLat: { lng: number; lat: number }): { x: number; y: number };
  /** Update a feature in the store. */
  updateFeatureInStore(id: string, feature: LibreDrawFeature): void;
  /** Render vertex and midpoint markers for editing. */
  renderVertices(featureId: string, vertices: Position[], midpoints: Position[]): void;
  /** Clear vertex/midpoint markers. */
  clearVertices(): void;
  /** Enable or disable map drag panning. */
  setDragPan(enabled: boolean): void;
}

/**
 * Selection and editing mode for existing polygons.
 *
 * Users click on a polygon to select it. Selected polygons display
 * vertex handles that can be dragged to reshape the polygon. Midpoint
 * handles appear between vertices and can be dragged to add new vertices.
 * Double-clicking a vertex removes it (minimum 3 vertices maintained).
 */
export class SelectMode implements Mode {
  private selectedIds: Set<string> = new Set();
  private isActive = false;
  private callbacks: SelectModeCallbacks;
  private onSelectionChange?: (selectedIds: string[]) => void;

  // Drag state
  private dragging = false;
  private dragVertexIndex = -1;
  private dragStartFeature: LibreDrawFeature | null = null;

  constructor(
    callbacks: SelectModeCallbacks,
    onSelectionChange?: (selectedIds: string[]) => void,
  ) {
    this.callbacks = callbacks;
    this.onSelectionChange = onSelectionChange;
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
    this.endDrag();
    if (this.selectedIds.size > 0) {
      this.selectedIds.clear();
      this.callbacks.clearVertices();
      this.notifySelectionChange();
    }
  }

  /**
   * Get the currently selected feature IDs.
   */
  getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  onPointerDown(event: NormalizedInputEvent): void {
    if (!this.isActive) return;

    // If a feature is selected, check vertex/midpoint hits first
    const selectedId = this.getFirstSelectedId();
    if (selectedId) {
      const feature = this.callbacks.getFeatureById(selectedId);
      if (feature) {
        const vertices = this.getVertices(feature);

        // Check vertex hit
        const vertexIdx = this.findNearestVertex(
          vertices,
          event.point,
        );
        if (vertexIdx >= 0) {
          this.startDrag(feature, vertexIdx);
          return;
        }

        // Check midpoint hit
        const midpoints = this.computeMidpoints(vertices);
        const midIdx = this.findNearestPoint(midpoints, event.point);
        if (midIdx >= 0) {
          // Capture state BEFORE insertion for correct undo
          const beforeInsert = FeatureStore.cloneFeature(feature);
          // Insert new vertex at the midpoint position
          const newFeature = this.insertVertex(feature, midIdx + 1, midpoints[midIdx]);
          this.callbacks.updateFeatureInStore(selectedId, newFeature);
          this.showVertexHandles(newFeature);
          this.startDrag(newFeature, midIdx + 1);
          // Override dragStartFeature with pre-insertion state so undo reverts the insertion too
          this.dragStartFeature = beforeInsert;
          return;
        }
      }
    }

    // Standard polygon selection logic
    const clickPoint = turfPoint([event.lngLat.lng, event.lngLat.lat]);
    const features = this.callbacks.getAllFeatures();

    let hitFeature: LibreDrawFeature | undefined;
    for (let i = features.length - 1; i >= 0; i--) {
      const feature = features[i];
      const polygon = feature.geometry;
      if (booleanPointInPolygon(clickPoint, polygon)) {
        hitFeature = feature;
        break;
      }
    }

    if (hitFeature) {
      if (this.selectedIds.has(hitFeature.id)) {
        this.selectedIds.delete(hitFeature.id);
        this.callbacks.clearVertices();
      } else {
        this.selectedIds.clear();
        this.selectedIds.add(hitFeature.id);
        this.showVertexHandles(hitFeature);
      }
    } else {
      this.selectedIds.clear();
      this.callbacks.clearVertices();
    }

    this.notifySelectionChange();
    this.callbacks.renderFeatures();
  }

  onPointerMove(event: NormalizedInputEvent): void {
    if (!this.isActive || !this.dragging) return;

    const selectedId = this.getFirstSelectedId();
    if (!selectedId) return;

    const feature = this.callbacks.getFeatureById(selectedId);
    if (!feature) return;

    const newPos: Position = [event.lngLat.lng, event.lngLat.lat];
    const updatedFeature = this.moveVertex(feature, this.dragVertexIndex, newPos);
    this.callbacks.updateFeatureInStore(selectedId, updatedFeature);
    this.callbacks.renderFeatures();
    this.showVertexHandles(updatedFeature);
  }

  onPointerUp(_event: NormalizedInputEvent): void {
    if (!this.isActive || !this.dragging) return;

    const selectedId = this.getFirstSelectedId();
    if (!selectedId || !this.dragStartFeature) {
      this.endDrag();
      return;
    }

    const currentFeature = this.callbacks.getFeatureById(selectedId);
    if (currentFeature) {
      const action = new UpdateAction(
        selectedId,
        this.dragStartFeature,
        FeatureStore.cloneFeature(currentFeature),
      );
      this.callbacks.pushToHistory(action);
      this.callbacks.emitEvent('update', {
        feature: currentFeature,
        oldFeature: this.dragStartFeature,
      });
    }

    this.endDrag();
  }

  onDoubleClick(event: NormalizedInputEvent): void {
    if (!this.isActive) return;

    const selectedId = this.getFirstSelectedId();
    if (!selectedId) return;

    const feature = this.callbacks.getFeatureById(selectedId);
    if (!feature) return;

    const vertices = this.getVertices(feature);
    const vertexIdx = this.findNearestVertex(vertices, event.point);

    // Delete vertex if hit and polygon has more than MIN_VERTICES
    if (vertexIdx >= 0 && vertices.length > MIN_VERTICES) {
      const oldFeature = FeatureStore.cloneFeature(feature);
      const updatedFeature = this.removeVertex(feature, vertexIdx);
      this.callbacks.updateFeatureInStore(selectedId, updatedFeature);

      const action = new UpdateAction(selectedId, oldFeature, FeatureStore.cloneFeature(updatedFeature));
      this.callbacks.pushToHistory(action);
      this.callbacks.emitEvent('update', {
        feature: updatedFeature,
        oldFeature,
      });

      this.callbacks.renderFeatures();
      this.showVertexHandles(updatedFeature);

      event.originalEvent.preventDefault();
      event.originalEvent.stopPropagation();
    }
  }

  onLongPress(event: NormalizedInputEvent): void {
    if (!this.isActive) return;

    const selectedId = this.getFirstSelectedId();
    if (!selectedId) {
      return;
    }

    const feature = this.callbacks.getFeatureById(selectedId);
    if (!feature) return;

    // Check if long press is on a vertex — delete it
    const vertices = this.getVertices(feature);
    const vertexIdx = this.findNearestVertex(vertices, event.point);
    if (vertexIdx >= 0 && vertices.length > MIN_VERTICES) {
      const oldFeature = FeatureStore.cloneFeature(feature);
      const updatedFeature = this.removeVertex(feature, vertexIdx);
      this.callbacks.updateFeatureInStore(selectedId, updatedFeature);

      const action = new UpdateAction(selectedId, oldFeature, FeatureStore.cloneFeature(updatedFeature));
      this.callbacks.pushToHistory(action);
      this.callbacks.emitEvent('update', {
        feature: updatedFeature,
        oldFeature,
      });

      this.callbacks.renderFeatures();
      this.showVertexHandles(updatedFeature);
      return;
    }

    // Otherwise delete the selected polygon
    this.deleteSelected();
  }

  onKeyDown(key: string, _event: KeyboardEvent): void {
    if (!this.isActive) return;

    if (key === 'Delete' || key === 'Backspace') {
      this.deleteSelected();
    }
  }

  /**
   * Get the unique vertices (excluding closing point) of a polygon.
   */
  private getVertices(feature: LibreDrawFeature): Position[] {
    const ring = feature.geometry.coordinates[0];
    // Exclude the closing point (last == first)
    return ring.slice(0, ring.length - 1);
  }

  /**
   * Find the nearest vertex within the hit threshold.
   * @returns The vertex index, or -1 if none is close enough.
   */
  private findNearestVertex(
    vertices: Position[],
    clickPoint: { x: number; y: number },
  ): number {
    return this.findNearestPoint(vertices, clickPoint);
  }

  /**
   * Find the nearest point (vertex or midpoint) within the hit threshold.
   * @returns The index, or -1 if none is close enough.
   */
  private findNearestPoint(
    points: Position[],
    clickPoint: { x: number; y: number },
  ): number {
    let minDist = Infinity;
    let minIdx = -1;

    for (let i = 0; i < points.length; i++) {
      const screenPt = this.callbacks.getScreenPoint({
        lng: points[i][0],
        lat: points[i][1],
      });
      const dx = clickPoint.x - screenPt.x;
      const dy = clickPoint.y - screenPt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= HIT_THRESHOLD_PX && dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }

    return minIdx;
  }

  /**
   * Compute midpoints for each edge of the polygon.
   */
  private computeMidpoints(vertices: Position[]): Position[] {
    const midpoints: Position[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const next = (i + 1) % vertices.length;
      midpoints.push([
        (vertices[i][0] + vertices[next][0]) / 2,
        (vertices[i][1] + vertices[next][1]) / 2,
      ]);
    }
    return midpoints;
  }

  /**
   * Start a vertex drag operation.
   */
  private startDrag(feature: LibreDrawFeature, vertexIndex: number): void {
    this.dragging = true;
    this.dragVertexIndex = vertexIndex;
    this.dragStartFeature = FeatureStore.cloneFeature(feature);
    this.callbacks.setDragPan(false);
  }

  /**
   * End a drag operation and restore map interactions.
   */
  private endDrag(): void {
    if (this.dragging) {
      this.callbacks.setDragPan(true);
    }
    this.dragging = false;
    this.dragVertexIndex = -1;
    this.dragStartFeature = null;
  }

  /**
   * Create a new feature with a vertex moved to a new position.
   */
  private moveVertex(
    feature: LibreDrawFeature,
    vertexIndex: number,
    newPos: Position,
  ): LibreDrawFeature {
    const ring = [...feature.geometry.coordinates[0]];
    ring[vertexIndex] = newPos;
    // If moving first vertex, also update closing point
    if (vertexIndex === 0) {
      ring[ring.length - 1] = newPos;
    }
    // If moving last vertex (same as first), also update first
    if (vertexIndex === ring.length - 1) {
      ring[0] = newPos;
    }
    return {
      ...feature,
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    };
  }

  /**
   * Create a new feature with a vertex inserted at the given index.
   */
  private insertVertex(
    feature: LibreDrawFeature,
    insertIndex: number,
    pos: Position,
  ): LibreDrawFeature {
    const ring = [...feature.geometry.coordinates[0]];
    ring.splice(insertIndex, 0, pos);
    return {
      ...feature,
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    };
  }

  /**
   * Create a new feature with a vertex removed at the given index.
   */
  private removeVertex(
    feature: LibreDrawFeature,
    vertexIndex: number,
  ): LibreDrawFeature {
    const vertices = this.getVertices(feature);
    const newVertices = vertices.filter((_, i) => i !== vertexIndex);
    // Close the ring
    const ring: Position[] = [...newVertices, [...newVertices[0]] as Position];
    return {
      ...feature,
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    };
  }

  /**
   * Refresh vertex/midpoint handles for the currently selected feature.
   * Call this after external geometry changes (e.g. undo/redo).
   */
  refreshVertexHandles(): void {
    if (!this.isActive) return;

    const selectedId = this.getFirstSelectedId();
    if (!selectedId) return;

    const feature = this.callbacks.getFeatureById(selectedId);
    if (feature) {
      this.showVertexHandles(feature);
    } else {
      // Feature was removed (e.g. undo of a create) — clear selection
      this.selectedIds.delete(selectedId);
      this.callbacks.clearVertices();
      this.notifySelectionChange();
    }
  }

  /**
   * Show vertex and midpoint handles for a selected feature.
   */
  private showVertexHandles(feature: LibreDrawFeature): void {
    const vertices = this.getVertices(feature);
    const midpoints = this.computeMidpoints(vertices);
    this.callbacks.renderVertices(feature.id, vertices, midpoints);
  }

  /**
   * Get the first selected feature ID.
   */
  private getFirstSelectedId(): string | undefined {
    return this.selectedIds.values().next().value;
  }

  /**
   * Delete all currently selected features.
   */
  private deleteSelected(): void {
    if (this.selectedIds.size === 0) return;

    const idsToDelete = Array.from(this.selectedIds);
    for (const id of idsToDelete) {
      const feature = this.callbacks.getFeatureById(id);
      if (feature) {
        this.callbacks.removeFeatureFromStore(id);
        const action = new DeleteAction(feature);
        this.callbacks.pushToHistory(action);
        this.callbacks.emitEvent('delete', { feature });
      }
    }

    this.selectedIds.clear();
    this.callbacks.clearVertices();
    this.notifySelectionChange();
    this.callbacks.renderFeatures();
  }

  /**
   * Notify the host about selection changes.
   */
  private notifySelectionChange(): void {
    const ids = this.getSelectedIds();
    this.callbacks.emitEvent('selectionchange', { selectedIds: ids });
    if (this.onSelectionChange) {
      this.onSelectionChange(ids);
    }
  }
}
