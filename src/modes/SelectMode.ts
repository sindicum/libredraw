import type { Mode } from './Mode';
import type { NormalizedInputEvent } from '../types/input';
import type { LibreDrawFeature, Position } from '../types/features';
import { DeleteAction, UpdateAction } from '../types/features';
import { FeatureStore } from '../core/FeatureStore';
import { cloneFeature } from '../utils/featureSnapshot';
import type { ModeContext } from '../core/ModeContext';
import {
  computeMidpoints,
  getVertices,
  insertVertex,
  movePolygon,
  moveVertex,
  removeVertex,
} from '../utils/geometry';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';
import { hasRingSelfIntersection } from '../validation/intersection';

/**
 * Threshold in pixels for vertex/midpoint hit testing (mouse).
 */
const HIT_THRESHOLD_MOUSE_PX = 10;

/**
 * Threshold in pixels for vertex/midpoint hit testing (touch).
 */
const HIT_THRESHOLD_TOUCH_PX = 24;

/**
 * Minimum number of unique vertices a polygon must maintain.
 */
const MIN_VERTICES = 3;

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
  private context: ModeContext;
  private onSelectionChange?: (selectedIds: string[]) => void;

  // Vertex drag state
  private dragging = false;
  private dragVertexIndex = -1;
  private dragStartFeature: LibreDrawFeature | null = null;

  // Polygon drag state
  private draggingPolygon = false;
  private dragPolygonStartLngLat: { lng: number; lat: number } | null = null;

  // Highlight state
  private highlightedVertexIndex = -1;

  constructor(
    context: ModeContext,
    onSelectionChange?: (selectedIds: string[]) => void,
  ) {
    this.context = context;
    this.onSelectionChange = onSelectionChange;
  }

  mapInteractions(): { dragPan: boolean; doubleClickZoom: boolean } {
    return {
      dragPan: true,
      doubleClickZoom: false,
    };
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
    this.highlightedVertexIndex = -1;
    this.endDrag();
    if (this.selectedIds.size > 0) {
      this.selectedIds.clear();
      this.context.render.clearVertices();
      this.notifySelectionChange();
    }
  }

  /**
   * Get the currently selected feature IDs.
   */
  getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  /**
   * Programmatically select a feature by ID.
   *
   * Replaces any existing selection. Renders vertex handles and
   * emits a selectionchange event. Cancels any in-progress drag.
   *
   * @param id - The feature ID to select.
   * @returns `true` if the feature was found and selected, `false` otherwise.
   */
  selectFeature(id: string): boolean {
    if (!this.isActive) return false;

    const feature = this.context.store.getById(id);
    if (!feature) return false;

    this.highlightedVertexIndex = -1;
    this.endDrag();
    this.selectedIds.clear();
    this.selectedIds.add(id);
    this.showVertexHandles(feature);
    this.notifySelectionChange();
    this.context.render.renderFeatures();
    return true;
  }

  /**
   * Programmatically clear the current selection.
   *
   * Removes vertex handles and emits a selectionchange event.
   * No-op if nothing is selected or mode is not active.
   */
  clearSelection(): void {
    if (!this.isActive) return;
    if (this.selectedIds.size === 0) return;

    this.highlightedVertexIndex = -1;
    this.endDrag();
    this.selectedIds.clear();
    this.context.render.clearVertices();
    this.notifySelectionChange();
    this.context.render.renderFeatures();
  }

  onPointerDown(event: NormalizedInputEvent): void {
    if (!this.isActive) return;

    // If a feature is selected, check vertex/midpoint hits first
    const selectedId = this.getFirstSelectedId();
    if (selectedId) {
      const feature = this.context.store.getById(selectedId);
      if (feature) {
        const vertices = getVertices(feature);
        const threshold = this.getThreshold(event);

        // Check vertex hit
        const vertexIdx = this.findNearestVertex(
          vertices,
          event.point,
          threshold,
        );
        if (vertexIdx >= 0) {
          this.startDrag(feature, vertexIdx);
          return;
        }

        // Check midpoint hit
        const midpoints = computeMidpoints(vertices);
        const midIdx = this.findNearestPoint(midpoints, event.point, threshold);
        if (midIdx >= 0) {
          // Capture state BEFORE insertion for correct undo
          const beforeInsert = FeatureStore.cloneFeature(feature);
          // Insert new vertex at the midpoint position
          const newFeature = insertVertex(feature, midIdx + 1, midpoints[midIdx]);
          this.context.store.update(selectedId, newFeature);
          this.showVertexHandles(newFeature);
          this.startDrag(newFeature, midIdx + 1);
          // Override dragStartFeature with pre-insertion state so undo reverts the insertion too
          this.dragStartFeature = beforeInsert;
          return;
        }

        // Check if click is inside the selected polygon body → start polygon drag
        const bodyClick = turfPoint([event.lngLat.lng, event.lngLat.lat]);
        if (booleanPointInPolygon(bodyClick, feature.geometry)) {
          this.startPolygonDrag(feature, event.lngLat);
          return;
        }
      }
    }

    // Reset highlight on selection change
    this.highlightedVertexIndex = -1;

    // Standard polygon selection logic
    const clickPoint = turfPoint([event.lngLat.lng, event.lngLat.lat]);
    const features = this.context.store.getAll();

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
        this.context.render.clearVertices();
      } else {
        this.selectedIds.clear();
        this.selectedIds.add(hitFeature.id);
        this.showVertexHandles(hitFeature);
      }
    } else {
      this.selectedIds.clear();
      this.context.render.clearVertices();
    }

    this.notifySelectionChange();
    this.context.render.renderFeatures();
  }

  onPointerMove(event: NormalizedInputEvent): void {
    if (!this.isActive) return;

    // Vertex drag: move single vertex
    if (this.dragging) {
      const selectedId = this.getFirstSelectedId();
      if (!selectedId) return;

      const feature = this.context.store.getById(selectedId);
      if (!feature) return;

      const newPos: Position = [event.lngLat.lng, event.lngLat.lat];
      const updatedFeature = moveVertex(feature, this.dragVertexIndex, newPos);

      // Reject move if it would cause self-intersection
      if (hasRingSelfIntersection(updatedFeature.geometry.coordinates[0])) {
        return;
      }

      this.context.store.update(selectedId, updatedFeature);
      this.context.render.renderFeatures();
      this.showVertexHandles(updatedFeature);
      return;
    }

    // Polygon drag: move entire polygon
    if (this.draggingPolygon) {
      const selectedId = this.getFirstSelectedId();
      if (!selectedId || !this.dragStartFeature || !this.dragPolygonStartLngLat) return;

      const dLng = event.lngLat.lng - this.dragPolygonStartLngLat.lng;
      const dLat = event.lngLat.lat - this.dragPolygonStartLngLat.lat;
      const updatedFeature = movePolygon(this.dragStartFeature, dLng, dLat);

      this.context.store.update(selectedId, updatedFeature);
      this.context.render.renderFeatures();
      this.showVertexHandles(updatedFeature);
      return;
    }

    // Non-drag: highlight nearest vertex
    const selectedId = this.getFirstSelectedId();
    if (!selectedId) return;

    const feature = this.context.store.getById(selectedId);
    if (!feature) return;

    const vertices = getVertices(feature);
    const threshold = this.getThreshold(event);
    const nearIdx = this.findNearestVertex(vertices, event.point, threshold);

    if (nearIdx !== this.highlightedVertexIndex) {
      this.highlightedVertexIndex = nearIdx;
      this.showVertexHandles(feature);
    }
  }

  onPointerUp(_event: NormalizedInputEvent): void {
    if (!this.isActive || (!this.dragging && !this.draggingPolygon)) return;

    const selectedId = this.getFirstSelectedId();
    if (!selectedId || !this.dragStartFeature) {
      this.endDrag();
      return;
    }

    const currentFeature = this.context.store.getById(selectedId);
    if (
      currentFeature &&
      this.hasGeometryChanged(this.dragStartFeature, currentFeature)
    ) {
      const action = new UpdateAction(
        selectedId,
        this.dragStartFeature,
        FeatureStore.cloneFeature(currentFeature),
      );
      this.context.history.push(action);
      this.context.events.emit('update', {
        feature: cloneFeature(currentFeature),
        oldFeature: cloneFeature(this.dragStartFeature),
      });
    }

    this.endDrag();
  }

  /**
   * Compare polygon coordinates and report whether geometry has changed.
   */
  private hasGeometryChanged(
    before: LibreDrawFeature,
    after: LibreDrawFeature,
  ): boolean {
    const beforeCoords = before.geometry.coordinates;
    const afterCoords = after.geometry.coordinates;

    if (beforeCoords.length !== afterCoords.length) return true;

    for (let ringIndex = 0; ringIndex < beforeCoords.length; ringIndex++) {
      const beforeRing = beforeCoords[ringIndex];
      const afterRing = afterCoords[ringIndex];
      if (beforeRing.length !== afterRing.length) return true;

      for (let positionIndex = 0; positionIndex < beforeRing.length; positionIndex++) {
        if (
          beforeRing[positionIndex][0] !== afterRing[positionIndex][0] ||
          beforeRing[positionIndex][1] !== afterRing[positionIndex][1]
        ) {
          return true;
        }
      }
    }

    return false;
  }

  onDoubleClick(event: NormalizedInputEvent): void {
    if (!this.isActive) return;

    const selectedId = this.getFirstSelectedId();
    if (!selectedId) return;

    const feature = this.context.store.getById(selectedId);
    if (!feature) return;

    const vertices = getVertices(feature);
    const threshold = this.getThreshold(event);
    const vertexIdx = this.findNearestVertex(vertices, event.point, threshold);

    // Delete vertex if hit and polygon has more than MIN_VERTICES
    if (vertexIdx >= 0 && vertices.length > MIN_VERTICES) {
      const oldFeature = FeatureStore.cloneFeature(feature);
      const updatedFeature = removeVertex(feature, vertexIdx);
      this.context.store.update(selectedId, updatedFeature);

      const action = new UpdateAction(selectedId, oldFeature, FeatureStore.cloneFeature(updatedFeature));
      this.context.history.push(action);
      this.context.events.emit('update', {
        feature: cloneFeature(updatedFeature),
        oldFeature: cloneFeature(oldFeature),
      });

      this.context.render.renderFeatures();
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

    const feature = this.context.store.getById(selectedId);
    if (!feature) return;

    // Check if long press is on a vertex — delete it
    const vertices = getVertices(feature);
    const threshold = this.getThreshold(event);
    const vertexIdx = this.findNearestVertex(vertices, event.point, threshold);
    if (vertexIdx >= 0 && vertices.length > MIN_VERTICES) {
      const oldFeature = FeatureStore.cloneFeature(feature);
      const updatedFeature = removeVertex(feature, vertexIdx);
      this.context.store.update(selectedId, updatedFeature);

      const action = new UpdateAction(selectedId, oldFeature, FeatureStore.cloneFeature(updatedFeature));
      this.context.history.push(action);
      this.context.events.emit('update', {
        feature: cloneFeature(updatedFeature),
        oldFeature: cloneFeature(oldFeature),
      });

      this.context.render.renderFeatures();
      this.showVertexHandles(updatedFeature);
    }
  }

  onKeyDown(key: string, _event: KeyboardEvent): void {
    if (!this.isActive) return;

    if (key === 'Delete' || key === 'Backspace') {
      this.deleteSelected();
    }
  }

  /**
   * Get the hit-test threshold based on input type.
   */
  private getThreshold(event: NormalizedInputEvent): number {
    return event.inputType === 'touch'
      ? HIT_THRESHOLD_TOUCH_PX
      : HIT_THRESHOLD_MOUSE_PX;
  }

  /**
   * Find the nearest vertex within the hit threshold.
   * @returns The vertex index, or -1 if none is close enough.
   */
  private findNearestVertex(
    vertices: Position[],
    clickPoint: { x: number; y: number },
    threshold?: number,
  ): number {
    return this.findNearestPoint(vertices, clickPoint, threshold);
  }

  /**
   * Find the nearest point (vertex or midpoint) within the hit threshold.
   * @returns The index, or -1 if none is close enough.
   */
  private findNearestPoint(
    points: Position[],
    clickPoint: { x: number; y: number },
    threshold: number = HIT_THRESHOLD_MOUSE_PX,
  ): number {
    let minDist = Infinity;
    let minIdx = -1;

    for (let i = 0; i < points.length; i++) {
      const screenPt = this.context.getScreenPoint({
        lng: points[i][0],
        lat: points[i][1],
      });
      const dx = clickPoint.x - screenPt.x;
      const dy = clickPoint.y - screenPt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= threshold && dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }

    return minIdx;
  }

  /**
   * Start a vertex drag operation.
   */
  private startDrag(feature: LibreDrawFeature, vertexIndex: number): void {
    this.dragging = true;
    this.dragVertexIndex = vertexIndex;
    this.dragStartFeature = FeatureStore.cloneFeature(feature);
    this.context.setDragPan(false);
  }

  /**
   * Start a polygon drag (whole-polygon move) operation.
   */
  private startPolygonDrag(
    feature: LibreDrawFeature,
    startLngLat: { lng: number; lat: number },
  ): void {
    this.draggingPolygon = true;
    this.dragPolygonStartLngLat = startLngLat;
    this.dragStartFeature = FeatureStore.cloneFeature(feature);
    this.context.setDragPan(false);
  }

  /**
   * End a drag operation and restore map interactions.
   */
  private endDrag(): void {
    if (this.dragging || this.draggingPolygon) {
      this.context.setDragPan(true);
    }
    this.dragging = false;
    this.dragVertexIndex = -1;
    this.dragStartFeature = null;
    this.draggingPolygon = false;
    this.dragPolygonStartLngLat = null;
    this.highlightedVertexIndex = -1;
  }

  /**
   * Refresh vertex/midpoint handles for the currently selected feature.
   * Call this after external geometry changes (e.g. undo/redo).
   */
  refreshVertexHandles(): void {
    if (!this.isActive) return;

    const selectedId = this.getFirstSelectedId();
    if (!selectedId) return;

    const feature = this.context.store.getById(selectedId);
    if (feature) {
      this.showVertexHandles(feature);
    } else {
      // Feature was removed (e.g. undo of a create) — clear selection
      this.selectedIds.delete(selectedId);
      this.context.render.clearVertices();
      this.notifySelectionChange();
    }
  }

  /**
   * Show vertex and midpoint handles for a selected feature.
   */
  private showVertexHandles(feature: LibreDrawFeature): void {
    const vertices = getVertices(feature);
    const midpoints = computeMidpoints(vertices);
    this.context.render.renderVertices(
      vertices,
      midpoints,
      this.highlightedVertexIndex >= 0 ? this.highlightedVertexIndex : undefined,
    );
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
      const feature = this.context.store.getById(id);
      if (feature) {
        this.context.store.remove(id);
        const action = new DeleteAction(feature);
        this.context.history.push(action);
        this.context.events.emit('delete', { feature: cloneFeature(feature) });
      }
    }

    this.selectedIds.clear();
    this.context.render.clearVertices();
    this.notifySelectionChange();
    this.context.render.renderFeatures();
  }

  /**
   * Notify the host about selection changes.
   */
  private notifySelectionChange(): void {
    const ids = this.getSelectedIds();
    this.context.render.setSelectedIds(ids);
    this.context.events.emit('selectionchange', { selectedIds: ids });
    if (this.onSelectionChange) {
      this.onSelectionChange(ids);
    }
  }
}
