import type { Mode } from './Mode';
import type { NormalizedInputEvent } from '../types/input';
import type {
  LibreDrawFeature,
  Action,
} from '../types/features';
import type { LibreDrawEventMap } from '../types/events';
import { DeleteAction } from '../types/features';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';

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
}

/**
 * Selection mode for selecting and deleting existing polygons.
 *
 * Users click on a polygon to select it. Clicking elsewhere deselects.
 * Selected features can be deleted with the Delete/Backspace key
 * or a long press (mobile alternative).
 */
export class SelectMode implements Mode {
  private selectedIds: Set<string> = new Set();
  private isActive = false;
  private callbacks: SelectModeCallbacks;
  private onSelectionChange?: (selectedIds: string[]) => void;

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
    if (this.selectedIds.size > 0) {
      this.selectedIds.clear();
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

    const clickPoint = turfPoint([event.lngLat.lng, event.lngLat.lat]);
    const features = this.callbacks.getAllFeatures();

    // Find which feature (if any) was clicked, checking in reverse order
    // so that features rendered on top are tested first
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
      // Toggle selection
      if (this.selectedIds.has(hitFeature.id)) {
        this.selectedIds.delete(hitFeature.id);
      } else {
        this.selectedIds.clear();
        this.selectedIds.add(hitFeature.id);
      }
    } else {
      // Clicked on empty space, deselect all
      this.selectedIds.clear();
    }

    this.notifySelectionChange();
    this.callbacks.renderFeatures();
  }

  onPointerMove(_event: NormalizedInputEvent): void {
    // No-op for select mode
  }

  onPointerUp(_event: NormalizedInputEvent): void {
    // No-op for select mode
  }

  onDoubleClick(_event: NormalizedInputEvent): void {
    // No-op for select mode
  }

  onLongPress(_event: NormalizedInputEvent): void {
    if (!this.isActive) return;

    // Long press deletes selected features (mobile alternative to Delete key)
    this.deleteSelected();
  }

  onKeyDown(key: string, _event: KeyboardEvent): void {
    if (!this.isActive) return;

    if (key === 'Delete' || key === 'Backspace') {
      this.deleteSelected();
    }
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
