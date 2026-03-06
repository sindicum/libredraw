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
  private isPointerDown = false;

  private handleMouseDown = (e: MouseEvent): void => {
    this.isPointerDown = true;
    this.callbacks.onPointerDown(this.normalize(e));
  };

  private handleMouseMoveCanvas = (e: MouseEvent): void => {
    if (this.isPointerDown) return;
    this.callbacks.onPointerMove(this.normalize(e));
  };

  private handleMouseMoveWindow = (e: MouseEvent): void => {
    if (!this.isPointerDown) return;
    this.callbacks.onPointerMove(this.normalize(e));
  };

  private handleMouseUpWindow = (e: MouseEvent): void => {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
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
    this.canvas.addEventListener('mousemove', this.handleMouseMoveCanvas);
    window.addEventListener('mousemove', this.handleMouseMoveWindow);
    window.addEventListener('mouseup', this.handleMouseUpWindow);
    this.canvas.addEventListener('dblclick', this.handleDblClick);
  }

  /**
   * Stop listening for mouse events.
   */
  disable(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMoveCanvas);
    window.removeEventListener('mousemove', this.handleMouseMoveWindow);
    window.removeEventListener('mouseup', this.handleMouseUpWindow);
    this.canvas.removeEventListener('dblclick', this.handleDblClick);
    this.isPointerDown = false;
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
