import type { Map as MaplibreMap } from 'maplibre-gl';
import type { NormalizedInputEvent } from '../types/input';

/**
 * Double-tap detection window in milliseconds.
 */
const DOUBLE_TAP_MS = 300;

/**
 * Long press detection threshold in milliseconds.
 */
const LONG_PRESS_MS = 500;

/**
 * Maximum movement (in pixels) allowed during a long press.
 */
const LONG_PRESS_TOLERANCE = 10;

/**
 * Callbacks that TouchInput dispatches to.
 */
export interface TouchInputCallbacks {
  onPointerDown(event: NormalizedInputEvent): void;
  onPointerMove(event: NormalizedInputEvent): void;
  onPointerUp(event: NormalizedInputEvent): void;
  onDoubleClick(event: NormalizedInputEvent): void;
  onLongPress(event: NormalizedInputEvent): void;
}

/**
 * Handles touch input events on the map canvas.
 *
 * Provides gesture detection for:
 * - Double tap (within 300ms)
 * - Long press (hold for 500ms)
 * - Pinch detection (2+ fingers, passes through to map)
 */
export class TouchInput {
  private map: MaplibreMap;
  private callbacks: TouchInputCallbacks;
  private canvas: HTMLElement;

  private lastTapTime = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private touchStartPos: { x: number; y: number } | null = null;
  private isPinching = false;

  private handleTouchStart = (e: TouchEvent): void => {
    // Ignore multi-finger gestures (pinch/rotate)
    if (e.touches.length >= 2) {
      this.isPinching = true;
      this.cancelLongPress();
      return;
    }

    this.isPinching = false;
    const normalized = this.normalize(e);
    this.touchStartPos = { x: normalized.point.x, y: normalized.point.y };

    // Start long press timer
    this.cancelLongPress();
    this.longPressTimer = setTimeout(() => {
      if (this.touchStartPos) {
        this.callbacks.onLongPress(normalized);
        this.touchStartPos = null; // prevent pointerUp from firing
      }
    }, LONG_PRESS_MS);

    this.callbacks.onPointerDown(normalized);
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (this.isPinching || e.touches.length >= 2) {
      this.cancelLongPress();
      return;
    }

    const normalized = this.normalize(e);

    // Cancel long press if the finger has moved too far
    if (this.touchStartPos) {
      const dx = normalized.point.x - this.touchStartPos.x;
      const dy = normalized.point.y - this.touchStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_TOLERANCE) {
        this.cancelLongPress();
      }
    }

    this.callbacks.onPointerMove(normalized);
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    this.cancelLongPress();

    if (this.isPinching) {
      if (e.touches.length === 0) {
        this.isPinching = false;
      }
      return;
    }

    // We need to use changedTouches for touch end
    if (e.changedTouches.length === 0) return;

    const normalized = this.normalizeChangedTouch(e);

    // Double-tap detection
    const now = Date.now();
    if (now - this.lastTapTime < DOUBLE_TAP_MS) {
      this.callbacks.onDoubleClick(normalized);
      this.lastTapTime = 0; // Reset to prevent triple-tap detection
    } else {
      this.lastTapTime = now;
    }

    if (this.touchStartPos) {
      this.callbacks.onPointerUp(normalized);
      this.touchStartPos = null;
    }
  };

  constructor(map: MaplibreMap, callbacks: TouchInputCallbacks) {
    this.map = map;
    this.callbacks = callbacks;
    this.canvas = map.getCanvasContainer();
  }

  /**
   * Start listening for touch events on the map canvas.
   */
  enable(): void {
    this.canvas.addEventListener('touchstart', this.handleTouchStart, {
      passive: false,
    });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, {
      passive: false,
    });
    this.canvas.addEventListener('touchend', this.handleTouchEnd);
  }

  /**
   * Stop listening for touch events.
   */
  disable(): void {
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    this.cancelLongPress();
  }

  /**
   * Destroy the touch input handler and remove all listeners.
   */
  destroy(): void {
    this.disable();
  }

  /**
   * Cancel the long press detection timer.
   */
  private cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  /**
   * Convert a TouchEvent into a NormalizedInputEvent using the first touch.
   */
  private normalize(e: TouchEvent): NormalizedInputEvent {
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const lngLat = this.map.unproject([x, y]);

    return {
      lngLat: { lng: lngLat.lng, lat: lngLat.lat },
      point: { x, y },
      originalEvent: e,
      inputType: 'touch',
    };
  }

  /**
   * Convert a TouchEvent into a NormalizedInputEvent using changedTouches
   * (for touchend events where touches array is empty).
   */
  private normalizeChangedTouch(e: TouchEvent): NormalizedInputEvent {
    const touch = e.changedTouches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const lngLat = this.map.unproject([x, y]);

    return {
      lngLat: { lng: lngLat.lng, lat: lngLat.lat },
      point: { x, y },
      originalEvent: e,
      inputType: 'touch',
    };
  }
}
