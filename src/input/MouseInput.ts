import type { Map as MaplibreMap } from 'maplibre-gl';
import type { NormalizedInputEvent } from '../types/input';

/**
 * Callbacks that MouseInput dispatches to.
 */
export interface MouseInputCallbacks {
  onPointerDown(event: NormalizedInputEvent): void;
  onPointerMove(event: NormalizedInputEvent): void;
  onPointerUp(event: NormalizedInputEvent): void;
  onDoubleClick(event: NormalizedInputEvent): void;
}

/**
 * Handles mouse input events on the map canvas and converts them
 * to normalized input events.
 */
export class MouseInput {
  private map: MaplibreMap;
  private callbacks: MouseInputCallbacks;
  private canvas: HTMLElement;

  private handleMouseDown = (e: MouseEvent): void => {
    this.callbacks.onPointerDown(this.normalize(e));
  };

  private handleMouseMove = (e: MouseEvent): void => {
    this.callbacks.onPointerMove(this.normalize(e));
  };

  private handleMouseUp = (e: MouseEvent): void => {
    this.callbacks.onPointerUp(this.normalize(e));
  };

  private handleDblClick = (e: MouseEvent): void => {
    this.callbacks.onDoubleClick(this.normalize(e));
  };

  constructor(map: MaplibreMap, callbacks: MouseInputCallbacks) {
    this.map = map;
    this.callbacks = callbacks;
    this.canvas = map.getCanvasContainer();
  }

  /**
   * Start listening for mouse events on the map canvas.
   */
  enable(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('dblclick', this.handleDblClick);
  }

  /**
   * Stop listening for mouse events.
   */
  disable(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('dblclick', this.handleDblClick);
  }

  /**
   * Destroy the mouse input handler and remove all listeners.
   */
  destroy(): void {
    this.disable();
  }

  /**
   * Convert a raw MouseEvent into a NormalizedInputEvent.
   */
  private normalize(e: MouseEvent): NormalizedInputEvent {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const lngLat = this.map.unproject([x, y]);

    return {
      lngLat: { lng: lngLat.lng, lat: lngLat.lat },
      point: { x, y },
      originalEvent: e,
      inputType: 'mouse',
    };
  }
}
