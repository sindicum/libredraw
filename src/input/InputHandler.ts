import type { Map as MaplibreMap } from 'maplibre-gl';
import type { NormalizedInputEvent } from '../types/input';
import type { Mode } from '../modes/Mode';
import { MouseInput } from './MouseInput';
import { TouchInput } from './TouchInput';
import { KeyboardInput } from './KeyboardInput';

/**
 * Callback to retrieve the currently active mode.
 */
export type GetActiveModeCallback = () => Mode | undefined;

/**
 * Orchestrates all input handlers (mouse, touch, keyboard) and
 * dispatches events to the currently active drawing mode.
 */
export class InputHandler {
  private mouseInput: MouseInput;
  private touchInput: TouchInput;
  private keyboardInput: KeyboardInput;
  private getActiveMode: GetActiveModeCallback;

  constructor(map: MaplibreMap, getActiveMode: GetActiveModeCallback) {
    this.getActiveMode = getActiveMode;

    const pointerCallbacks = {
      onPointerDown: (event: NormalizedInputEvent) => {
        this.getActiveMode()?.onPointerDown(event);
      },
      onPointerMove: (event: NormalizedInputEvent) => {
        this.getActiveMode()?.onPointerMove(event);
      },
      onPointerUp: (event: NormalizedInputEvent) => {
        this.getActiveMode()?.onPointerUp(event);
      },
      onDoubleClick: (event: NormalizedInputEvent) => {
        this.getActiveMode()?.onDoubleClick(event);
      },
      onLongPress: (event: NormalizedInputEvent) => {
        this.getActiveMode()?.onLongPress(event);
      },
    };

    this.mouseInput = new MouseInput(map, pointerCallbacks);
    this.touchInput = new TouchInput(map, pointerCallbacks);
    this.keyboardInput = new KeyboardInput({
      onKeyDown: (key: string, event: KeyboardEvent) => {
        this.getActiveMode()?.onKeyDown(key, event);
      },
    });
  }

  /**
   * Enable all input handlers.
   */
  enable(): void {
    this.mouseInput.enable();
    this.touchInput.enable();
    this.keyboardInput.enable();
  }

  /**
   * Disable all input handlers.
   */
  disable(): void {
    this.mouseInput.disable();
    this.touchInput.disable();
    this.keyboardInput.disable();
  }

  /**
   * Destroy all input handlers and remove event listeners.
   */
  destroy(): void {
    this.mouseInput.destroy();
    this.touchInput.destroy();
    this.keyboardInput.destroy();
  }
}
