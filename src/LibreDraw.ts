import type { Map as MaplibreMap } from 'maplibre-gl';
import type {
  LibreDrawFeature,
  LibreDrawEventMap,
  LibreDrawOptions,
  ToolbarOptions,
} from './types';
import { DeleteAction } from './types/features';
import { EventBus } from './core/EventBus';
import { FeatureStore } from './core/FeatureStore';
import { HistoryManager } from './core/HistoryManager';
import { ModeManager } from './core/ModeManager';
import type { ModeName } from './core/ModeManager';
import { LibreDrawError } from './core/errors';
import { validateGeoJSON, validateFeature } from './validation/geojson';
import { IdleMode } from './modes/IdleMode';
import { DrawMode } from './modes/DrawMode';
import { SelectMode } from './modes/SelectMode';
import { InputHandler } from './input/InputHandler';
import { SourceManager } from './rendering/SourceManager';
import { RenderManager } from './rendering/RenderManager';
import { Toolbar } from './ui/Toolbar';

/**
 * LibreDraw - A MapLibre GL JS polygon drawing and editing library.
 *
 * This is the main facade class that wires together all internal modules
 * (event bus, feature store, history, modes, input, rendering, toolbar)
 * and exposes a clean public API.
 *
 * @example
 * ```ts
 * const draw = new LibreDraw(map, { toolbar: true });
 * draw.setMode('draw');
 * draw.on('create', (e) => console.log('Created:', e.feature));
 * ```
 */
export class LibreDraw {
  private map: MaplibreMap;
  private eventBus: EventBus;
  private featureStore: FeatureStore;
  private historyManager: HistoryManager;
  private modeManager: ModeManager;
  private inputHandler: InputHandler;
  private sourceManager: SourceManager;
  private renderManager: RenderManager;
  private toolbar: Toolbar | null = null;
  private selectMode: SelectMode;
  private destroyed = false;

  /**
   * Create a new LibreDraw instance.
   * @param map - The MapLibre GL JS map instance.
   * @param options - Configuration options.
   */
  constructor(map: MaplibreMap, options: LibreDrawOptions = {}) {
    this.map = map;

    // Core modules
    this.eventBus = new EventBus();
    this.featureStore = new FeatureStore();
    this.historyManager = new HistoryManager(options.historyLimit ?? 100);
    this.modeManager = new ModeManager();

    // Rendering
    this.sourceManager = new SourceManager(map);
    this.renderManager = new RenderManager(map, this.sourceManager);

    // Mode setup
    const drawMode = new DrawMode({
      addFeatureToStore: (feature) => this.featureStore.add(feature),
      pushToHistory: (action) => {
        this.historyManager.push(action);
        this.updateToolbarHistoryState();
      },
      emitEvent: (type, payload) => this.eventBus.emit(type, payload),
      renderPreview: (coords) => this.renderManager.renderPreview(coords),
      clearPreview: () => this.renderManager.clearPreview(),
      renderFeatures: () => this.renderAllFeatures(),
      getScreenPoint: (lngLat) => {
        const pt = map.project([lngLat.lng, lngLat.lat]);
        return { x: pt.x, y: pt.y };
      },
    });

    this.selectMode = new SelectMode(
      {
        removeFeatureFromStore: (id) => this.featureStore.remove(id),
        pushToHistory: (action) => {
          this.historyManager.push(action);
          this.updateToolbarHistoryState();
        },
        emitEvent: (type, payload) => this.eventBus.emit(type, payload),
        renderFeatures: () => this.renderAllFeatures(),
        getFeatureById: (id) => this.featureStore.getById(id),
        getAllFeatures: () => this.featureStore.getAll(),
        getScreenPoint: (lngLat) => {
          const pt = map.project([lngLat.lng, lngLat.lat]);
          return { x: pt.x, y: pt.y };
        },
        updateFeatureInStore: (id, feature) =>
          this.featureStore.update(id, feature),
        renderVertices: (_featureId, vertices, midpoints, highlightIndex) =>
          this.renderManager.renderVertices(vertices, midpoints, highlightIndex),
        clearVertices: () => this.renderManager.clearVertices(),
        setDragPan: (enabled) => {
          if (enabled) {
            map.dragPan.enable();
          } else {
            map.dragPan.disable();
          }
        },
      },
      (selectedIds) => {
        this.renderManager.setSelectedIds(selectedIds);
      },
    );

    // Register modes
    this.modeManager.registerMode('idle', new IdleMode());
    this.modeManager.registerMode('draw', drawMode);
    this.modeManager.registerMode('select', this.selectMode);

    // Mode change event
    this.modeManager.setOnModeChange((mode, previousMode) => {
      this.eventBus.emit('modechange', { mode, previousMode });
      if (this.toolbar) {
        this.toolbar.setActiveMode(mode);
      }

      // Disable map interactions that conflict with drawing/editing
      if (mode === 'draw') {
        map.dragPan.disable();
        map.doubleClickZoom.disable();
      } else if (mode === 'select') {
        map.doubleClickZoom.disable();
        // dragPan stays enabled; SelectMode disables it during vertex drag
      } else {
        map.dragPan.enable();
        map.doubleClickZoom.enable();
      }
    });

    // Input handling
    this.inputHandler = new InputHandler(
      map,
      () => this.modeManager.getCurrentMode(),
    );

    // Toolbar
    if (options.toolbar !== false && options.toolbar !== undefined) {
      const toolbarOpts: ToolbarOptions =
        typeof options.toolbar === 'object' ? options.toolbar : {};
      this.createToolbar(toolbarOpts);
    }

    // Initialize when map is ready
    if (map.isStyleLoaded()) {
      this.initialize();
    } else {
      map.once('load', () => {
        this.initialize();
      });
    }
  }

  /**
   * Set the active drawing mode.
   * @param mode - The mode to activate ('idle', 'draw', or 'select').
   */
  setMode(mode: ModeName): void {
    this.assertNotDestroyed();
    this.modeManager.setMode(mode);
  }

  /**
   * Get the current drawing mode.
   * @returns The active mode name.
   */
  getMode(): ModeName {
    this.assertNotDestroyed();
    return this.modeManager.getMode();
  }

  /**
   * Get all features as an array.
   * @returns An array of all features in the store.
   */
  getFeatures(): LibreDrawFeature[] {
    this.assertNotDestroyed();
    return this.featureStore.getAll();
  }

  /**
   * Replace all features in the store with the given GeoJSON FeatureCollection.
   * @param geojson - A GeoJSON FeatureCollection with Polygon features.
   */
  setFeatures(geojson: unknown): void {
    this.assertNotDestroyed();
    const validated = validateGeoJSON(geojson);
    this.featureStore.setAll(validated.features);
    this.historyManager.clear();
    this.renderAllFeatures();
    this.updateToolbarHistoryState();
  }

  /**
   * Add features to the store from a GeoJSON FeatureCollection or array of features.
   * @param features - An array of GeoJSON Feature objects with Polygon geometry.
   */
  addFeatures(features: unknown[]): void {
    this.assertNotDestroyed();
    for (const feature of features) {
      const validated = validateFeature(feature);
      this.featureStore.add(validated);
    }
    this.renderAllFeatures();
  }

  /**
   * Get the IDs of currently selected features.
   * @returns An array of selected feature IDs.
   */
  getSelectedFeatureIds(): string[] {
    this.assertNotDestroyed();
    return this.selectMode.getSelectedIds();
  }

  /**
   * Undo the last action.
   * @returns True if an action was undone.
   */
  undo(): boolean {
    this.assertNotDestroyed();
    const result = this.historyManager.undo(this.featureStore);
    if (result) {
      this.renderAllFeatures();
      this.selectMode.refreshVertexHandles();
      this.updateToolbarHistoryState();
    }
    return result;
  }

  /**
   * Redo the last undone action.
   * @returns True if an action was redone.
   */
  redo(): boolean {
    this.assertNotDestroyed();
    const result = this.historyManager.redo(this.featureStore);
    if (result) {
      this.renderAllFeatures();
      this.selectMode.refreshVertexHandles();
      this.updateToolbarHistoryState();
    }
    return result;
  }

  /**
   * Register an event listener.
   * @param type - The event type.
   * @param listener - The callback to invoke.
   */
  on<K extends keyof LibreDrawEventMap>(
    type: K,
    listener: (payload: LibreDrawEventMap[K]) => void,
  ): void {
    this.assertNotDestroyed();
    this.eventBus.on(type, listener);
  }

  /**
   * Remove an event listener.
   * @param type - The event type.
   * @param listener - The callback to remove.
   */
  off<K extends keyof LibreDrawEventMap>(
    type: K,
    listener: (payload: LibreDrawEventMap[K]) => void,
  ): void {
    this.assertNotDestroyed();
    this.eventBus.off(type, listener);
  }

  /**
   * Destroy the LibreDraw instance, cleaning up all resources.
   * After calling destroy, all other methods will throw.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.modeManager.setMode('idle');
    this.inputHandler.destroy();
    this.renderManager.destroy();
    this.eventBus.removeAllListeners();
    this.historyManager.clear();
    this.featureStore.clear();

    if (this.toolbar) {
      this.toolbar.destroy();
      this.toolbar = null;
    }
  }

  /**
   * Initialize rendering and input handling after the map is ready.
   */
  private initialize(): void {
    if (this.destroyed) return;
    this.renderManager.initialize();
    this.inputHandler.enable();
  }

  /**
   * Render all features from the store to the map.
   */
  private renderAllFeatures(): void {
    const features = this.featureStore.getAll();
    this.renderManager.render(features);
  }

  /**
   * Create the toolbar UI.
   */
  private createToolbar(options: ToolbarOptions): void {
    this.toolbar = new Toolbar(
      this.map,
      {
        onDrawClick: () => {
          const current = this.modeManager.getMode();
          this.modeManager.setMode(current === 'draw' ? 'idle' : 'draw');
        },
        onSelectClick: () => {
          const current = this.modeManager.getMode();
          this.modeManager.setMode(
            current === 'select' ? 'idle' : 'select',
          );
        },
        onDeleteClick: () => {
          // Trigger delete on current selection in select mode
          if (this.modeManager.getMode() === 'select') {
            const selectedIds = this.selectMode.getSelectedIds();
            for (const id of selectedIds) {
              const feature = this.featureStore.getById(id);
              if (feature) {
                this.featureStore.remove(id);
                const action = new DeleteAction(feature);
                this.historyManager.push(action);
                this.eventBus.emit('delete', { feature });
              }
            }
            if (selectedIds.length > 0) {
              this.renderAllFeatures();
              this.updateToolbarHistoryState();
            }
          }
        },
        onUndoClick: () => {
          this.undo();
        },
        onRedoClick: () => {
          this.redo();
        },
      },
      options,
    );

    // Set initial states
    this.toolbar.setActiveMode(this.modeManager.getMode());
    this.toolbar.setHistoryState(
      this.historyManager.canUndo(),
      this.historyManager.canRedo(),
    );
  }

  /**
   * Update toolbar undo/redo button states.
   */
  private updateToolbarHistoryState(): void {
    if (this.toolbar) {
      this.toolbar.setHistoryState(
        this.historyManager.canUndo(),
        this.historyManager.canRedo(),
      );
    }
  }

  /**
   * Assert that this instance has not been destroyed.
   * @throws LibreDrawError if destroyed.
   */
  private assertNotDestroyed(): void {
    if (this.destroyed) {
      throw new LibreDrawError(
        'This LibreDraw instance has been destroyed.',
      );
    }
  }
}
