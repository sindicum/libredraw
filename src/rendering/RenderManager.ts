import type { Map as MaplibreMap } from 'maplibre-gl';
import type { LibreDrawFeature, Position } from '../types/features';
import { SourceManager, SOURCE_IDS } from './SourceManager';

/**
 * Layer IDs used by LibreDraw for rendering.
 */
export const LAYER_IDS = {
  FILL: 'libre-draw-fill',
  OUTLINE: 'libre-draw-outline',
  VERTICES: 'libre-draw-vertices',
  PREVIEW: 'libre-draw-preview',
  EDIT_VERTICES: 'libre-draw-edit-vertices',
  EDIT_MIDPOINTS: 'libre-draw-edit-midpoints',
} as const;

/**
 * Default colors used by the rendering layers.
 */
const COLORS = {
  FILL: '#3bb2d0',
  FILL_OPACITY: 0.2,
  FILL_SELECTED: '#fbb03b',
  FILL_SELECTED_OPACITY: 0.4,
  OUTLINE: '#3bb2d0',
  OUTLINE_WIDTH: 2,
  OUTLINE_SELECTED: '#fbb03b',
  VERTEX_COLOR: '#ffffff',
  VERTEX_STROKE: '#3bb2d0',
  VERTEX_RADIUS: 4,
  PREVIEW_FILL: '#3bb2d0',
  PREVIEW_FILL_OPACITY: 0.1,
  PREVIEW_OUTLINE: '#3bb2d0',
  PREVIEW_OUTLINE_DASH: [2, 2] as number[],
  EDIT_VERTEX_COLOR: '#ffffff',
  EDIT_VERTEX_STROKE: '#3bb2d0',
  EDIT_VERTEX_RADIUS: 5,
  EDIT_VERTEX_STROKE_WIDTH: 2,
  MIDPOINT_COLOR: '#3bb2d0',
  MIDPOINT_OPACITY: 0.5,
  MIDPOINT_RADIUS: 3,
} as const;

/**
 * Manages the rendering layers for LibreDraw.
 *
 * Creates and manages MapLibre layers for:
 * - Fill: polygon fill rendering
 * - Outline: polygon border rendering
 * - Vertices: vertex point rendering
 * - Preview: in-progress drawing preview
 *
 * Uses requestAnimationFrame for batch updates to avoid
 * redundant re-renders within a single frame.
 */
export class RenderManager {
  private map: MaplibreMap;
  private sourceManager: SourceManager;
  private selectedIds: Set<string> = new Set();
  private pendingRender = false;
  private pendingFeatures: LibreDrawFeature[] | null = null;
  private initialized = false;

  constructor(map: MaplibreMap, sourceManager: SourceManager) {
    this.map = map;
    this.sourceManager = sourceManager;
  }

  /**
   * Initialize rendering layers on the map.
   * Should be called after the map style and sources are ready.
   */
  initialize(): void {
    if (this.initialized) return;

    this.sourceManager.initialize();

    // Feature fill layer
    if (!this.map.getLayer(LAYER_IDS.FILL)) {
      this.map.addLayer({
        id: LAYER_IDS.FILL,
        type: 'fill',
        source: SOURCE_IDS.FEATURES,
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['get', '_selected'], false],
            COLORS.FILL_SELECTED,
            COLORS.FILL,
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['get', '_selected'], false],
            COLORS.FILL_SELECTED_OPACITY,
            COLORS.FILL_OPACITY,
          ],
        },
      });
    }

    // Feature outline layer
    if (!this.map.getLayer(LAYER_IDS.OUTLINE)) {
      this.map.addLayer({
        id: LAYER_IDS.OUTLINE,
        type: 'line',
        source: SOURCE_IDS.FEATURES,
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', '_selected'], false],
            COLORS.OUTLINE_SELECTED,
            COLORS.OUTLINE,
          ],
          'line-width': COLORS.OUTLINE_WIDTH,
        },
      });
    }

    // Feature vertices layer (circle markers at each vertex)
    if (!this.map.getLayer(LAYER_IDS.VERTICES)) {
      this.map.addLayer({
        id: LAYER_IDS.VERTICES,
        type: 'circle',
        source: SOURCE_IDS.FEATURES,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': COLORS.VERTEX_RADIUS,
          'circle-color': COLORS.VERTEX_COLOR,
          'circle-stroke-color': COLORS.VERTEX_STROKE,
          'circle-stroke-width': 2,
        },
      });
    }

    // Preview layer (dashed outline for in-progress drawing)
    if (!this.map.getLayer(LAYER_IDS.PREVIEW)) {
      this.map.addLayer({
        id: LAYER_IDS.PREVIEW,
        type: 'line',
        source: SOURCE_IDS.PREVIEW,
        paint: {
          'line-color': COLORS.PREVIEW_OUTLINE,
          'line-width': 2,
          'line-dasharray': COLORS.PREVIEW_OUTLINE_DASH,
        },
      });
    }

    // Edit midpoints layer (semi-transparent small circles at edge midpoints)
    if (!this.map.getLayer(LAYER_IDS.EDIT_MIDPOINTS)) {
      this.map.addLayer({
        id: LAYER_IDS.EDIT_MIDPOINTS,
        type: 'circle',
        source: SOURCE_IDS.EDIT_VERTICES,
        filter: ['==', ['get', '_type'], 'midpoint'],
        paint: {
          'circle-radius': COLORS.MIDPOINT_RADIUS,
          'circle-color': COLORS.MIDPOINT_COLOR,
          'circle-opacity': COLORS.MIDPOINT_OPACITY,
        },
      });
    }

    // Edit vertices layer (white circles with blue stroke at polygon vertices)
    if (!this.map.getLayer(LAYER_IDS.EDIT_VERTICES)) {
      this.map.addLayer({
        id: LAYER_IDS.EDIT_VERTICES,
        type: 'circle',
        source: SOURCE_IDS.EDIT_VERTICES,
        filter: ['==', ['get', '_type'], 'vertex'],
        paint: {
          'circle-radius': COLORS.EDIT_VERTEX_RADIUS,
          'circle-color': COLORS.EDIT_VERTEX_COLOR,
          'circle-stroke-color': COLORS.EDIT_VERTEX_STROKE,
          'circle-stroke-width': COLORS.EDIT_VERTEX_STROKE_WIDTH,
        },
      });
    }

    this.initialized = true;
  }

  /**
   * Render features to the map. Uses requestAnimationFrame
   * to batch multiple render calls within a single frame.
   * @param features - The features to render.
   */
  render(features: LibreDrawFeature[]): void {
    this.pendingFeatures = features;
    if (!this.pendingRender) {
      this.pendingRender = true;
      requestAnimationFrame(() => {
        this.performRender();
        this.pendingRender = false;
      });
    }
  }

  /**
   * Render a polygon preview for in-progress drawing.
   * @param coordinates - The preview polygon coordinates (ring).
   */
  renderPreview(coordinates: Position[]): void {
    if (coordinates.length < 2) {
      this.clearPreview();
      return;
    }

    const geojsonCoords = coordinates.map(
      (pos) => [pos[0], pos[1]] as [number, number],
    );

    const previewGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: geojsonCoords,
          },
        },
      ],
    };

    this.sourceManager.updatePreview(previewGeoJSON);
  }

  /**
   * Clear the drawing preview.
   */
  clearPreview(): void {
    this.sourceManager.clearPreview();
  }

  /**
   * Render vertex and midpoint markers for editing a selected polygon.
   * @param vertices - The polygon vertex positions.
   * @param midpoints - The edge midpoint positions.
   */
  renderVertices(vertices: Position[], midpoints: Position[]): void {
    const features: GeoJSON.Feature[] = [];

    for (const v of vertices) {
      features.push({
        type: 'Feature',
        properties: { _type: 'vertex' },
        geometry: { type: 'Point', coordinates: [v[0], v[1]] },
      });
    }

    for (const m of midpoints) {
      features.push({
        type: 'Feature',
        properties: { _type: 'midpoint' },
        geometry: { type: 'Point', coordinates: [m[0], m[1]] },
      });
    }

    this.sourceManager.updateEditVertices({
      type: 'FeatureCollection',
      features,
    });
  }

  /**
   * Clear the vertex/midpoint markers.
   */
  clearVertices(): void {
    this.sourceManager.clearEditVertices();
  }

  /**
   * Set the IDs of selected features for visual highlighting.
   * @param ids - The selected feature IDs.
   */
  setSelectedIds(ids: string[]): void {
    this.selectedIds = new Set(ids);
  }

  /**
   * Remove all layers and sources from the map.
   */
  destroy(): void {
    const layerIds = [
      LAYER_IDS.EDIT_VERTICES,
      LAYER_IDS.EDIT_MIDPOINTS,
      LAYER_IDS.PREVIEW,
      LAYER_IDS.VERTICES,
      LAYER_IDS.OUTLINE,
      LAYER_IDS.FILL,
    ];

    for (const id of layerIds) {
      if (this.map.getLayer(id)) {
        this.map.removeLayer(id);
      }
    }

    this.sourceManager.destroy();
    this.initialized = false;
  }

  /**
   * Perform the actual render, converting features to GeoJSON
   * with selection state embedded in properties.
   */
  private performRender(): void {
    if (!this.pendingFeatures) return;

    const geojsonFeatures: GeoJSON.Feature[] = this.pendingFeatures.map(
      (feature) => ({
        type: 'Feature' as const,
        id: feature.id as unknown as number,
        properties: {
          ...feature.properties,
          _id: feature.id,
          _selected: this.selectedIds.has(feature.id),
        },
        geometry: feature.geometry,
      }),
    );

    const featureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: geojsonFeatures,
    };

    this.sourceManager.updateFeatures(featureCollection);
    this.pendingFeatures = null;
  }
}
