import type { LibreDrawFeature } from './features';
import type { ModeName } from './mode';

/**
 * Event payload for feature creation.
 */
export interface CreateEvent {
  feature: LibreDrawFeature;
}

/**
 * Event payload for feature update.
 */
export interface UpdateEvent {
  feature: LibreDrawFeature;
  oldFeature: LibreDrawFeature;
}

/**
 * Event payload for feature deletion.
 */
export interface DeleteEvent {
  feature: LibreDrawFeature;
}

/**
 * Event payload for selection changes.
 */
export interface SelectionChangeEvent {
  selectedIds: string[];
}

/**
 * Event payload for mode changes.
 */
export interface ModeChangeEvent {
  mode: ModeName;
  previousMode: ModeName;
}

/**
 * Map of all LibreDraw event types to their payloads.
 */
export interface LibreDrawEventMap {
  create: CreateEvent;
  update: UpdateEvent;
  delete: DeleteEvent;
  selectionchange: SelectionChangeEvent;
  modechange: ModeChangeEvent;
}
