import type { Map as MaplibreMap } from 'maplibre-gl';
import type { ToolbarOptions, ToolbarControls } from '../types/options';
import { ToolbarButton } from './ToolbarButton';
import { drawIcon } from './icons/draw';
import { selectIcon } from './icons/select';
import { deleteIcon } from './icons/delete';
import { undoIcon } from './icons/undo';
import { redoIcon } from './icons/redo';

/**
 * Default toolbar control visibility.
 */
const DEFAULT_CONTROLS: Required<ToolbarControls> = {
  draw: true,
  select: true,
  delete: true,
  undo: true,
  redo: true,
};

/**
 * Callbacks that the Toolbar needs from the host application.
 */
export interface ToolbarCallbacks {
  onDrawClick(): void;
  onSelectClick(): void;
  onDeleteClick(): void;
  onUndoClick(): void;
  onRedoClick(): void;
}

/**
 * Creates and manages the drawing toolbar UI.
 *
 * The toolbar is positioned on the map using MapLibre's control
 * container system. It creates buttons for draw, select, delete,
 * undo, and redo actions. Button states are updated externally
 * to reflect the current mode and history state.
 */
export class Toolbar {
  private map: MaplibreMap;
  private container: HTMLDivElement;
  private buttons: Map<string, ToolbarButton> = new Map();
  private callbacks: ToolbarCallbacks;
  private options: ToolbarOptions;

  constructor(
    map: MaplibreMap,
    callbacks: ToolbarCallbacks,
    options: ToolbarOptions = {},
  ) {
    this.map = map;
    this.callbacks = callbacks;
    this.options = options;

    this.container = document.createElement('div');
    this.container.className = 'libre-draw-toolbar';
    this.applyContainerStyles();

    this.createButtons();
    this.mount();
  }

  /**
   * Update the active mode displayed in the toolbar.
   * @param mode - The active mode name ('idle', 'draw', 'select').
   */
  setActiveMode(mode: string): void {
    const drawBtn = this.buttons.get('draw');
    const selectBtn = this.buttons.get('select');

    if (drawBtn) {
      drawBtn.setActive(mode === 'draw');
    }
    if (selectBtn) {
      selectBtn.setActive(mode === 'select');
    }
  }

  /**
   * Update the undo/redo button states.
   * @param canUndo - Whether undo is available.
   * @param canRedo - Whether redo is available.
   */
  setHistoryState(canUndo: boolean, canRedo: boolean): void {
    const undoBtn = this.buttons.get('undo');
    const redoBtn = this.buttons.get('redo');

    if (undoBtn) {
      undoBtn.setDisabled(!canUndo);
    }
    if (redoBtn) {
      redoBtn.setDisabled(!canRedo);
    }
  }

  /**
   * Remove the toolbar from the map and clean up.
   */
  destroy(): void {
    for (const button of this.buttons.values()) {
      button.destroy();
    }
    this.buttons.clear();
    this.container.remove();
  }

  /**
   * Create all toolbar buttons based on the configured controls.
   */
  private createButtons(): void {
    const controls: Required<ToolbarControls> = {
      ...DEFAULT_CONTROLS,
      ...this.options.controls,
    };

    if (controls.draw) {
      this.addButton('draw', drawIcon, 'Draw polygon', () => {
        this.callbacks.onDrawClick();
      }, true);
    }

    if (controls.select) {
      this.addButton('select', selectIcon, 'Select feature', () => {
        this.callbacks.onSelectClick();
      }, true);
    }

    if (controls.delete) {
      this.addButton('delete', deleteIcon, 'Delete selected', () => {
        this.callbacks.onDeleteClick();
      });
    }

    if (controls.undo) {
      this.addButton('undo', undoIcon, 'Undo', () => {
        this.callbacks.onUndoClick();
      });
    }

    if (controls.redo) {
      this.addButton('redo', redoIcon, 'Redo', () => {
        this.callbacks.onRedoClick();
      });
    }
  }

  /**
   * Create a button and add it to the toolbar.
   */
  private addButton(
    id: string,
    icon: string,
    title: string,
    onClick: () => void,
    isToggle?: boolean,
  ): void {
    const button = new ToolbarButton({ id, icon, title, onClick, isToggle });
    this.buttons.set(id, button);
    this.container.appendChild(button.getElement());
  }

  /**
   * Mount the toolbar container to the map's control container.
   */
  private mount(): void {
    const position = this.options.position || 'top-right';

    // MapLibre organizes controls into positioned containers
    const mapContainer = this.map.getContainer();
    const controlContainer = mapContainer.querySelector(
      `.maplibregl-ctrl-${position}`,
    );

    if (controlContainer) {
      controlContainer.appendChild(this.container);
    } else {
      // Fallback: append to the map container directly
      mapContainer.appendChild(this.container);
    }
  }

  /**
   * Apply CSS styles to the toolbar container.
   */
  private applyContainerStyles(): void {
    const s = this.container.style;
    s.display = 'flex';
    s.flexDirection = 'column';
    s.gap = '4px';
    s.padding = '4px';
    s.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    s.borderRadius = '4px';
    s.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.3)';
    s.zIndex = '1';
    // MapLibre's control containers have pointer-events: none;
    // controls need pointer-events: auto to receive clicks
    s.pointerEvents = 'auto';
  }
}
