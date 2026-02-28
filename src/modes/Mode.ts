import type { NormalizedInputEvent } from '../types/input';

/**
 * Interface that all drawing modes must implement.
 *
 * Each mode handles user input differently and can maintain
 * its own internal state. Modes are activated and deactivated
 * by the ModeManager during transitions.
 */
export interface Mode {
  /** Called when the mode becomes active. */
  activate(): void;

  /** Called when the mode is deactivated. */
  deactivate(): void;

  /** Handle a pointer down (mouse click or touch start). */
  onPointerDown(event: NormalizedInputEvent): void;

  /** Handle pointer movement. */
  onPointerMove(event: NormalizedInputEvent): void;

  /** Handle pointer up (mouse release or touch end). */
  onPointerUp(event: NormalizedInputEvent): void;

  /** Handle a double-click or double-tap. */
  onDoubleClick(event: NormalizedInputEvent): void;

  /** Handle a long press (touch hold). */
  onLongPress(event: NormalizedInputEvent): void;

  /** Handle a key down event. */
  onKeyDown(key: string, event: KeyboardEvent): void;
}
