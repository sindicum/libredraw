import type { Mode } from './Mode';
import type { NormalizedInputEvent } from '../types/input';

/**
 * The idle mode where no drawing or editing is active.
 * All input handlers are no-ops.
 */
export class IdleMode implements Mode {
  activate(): void {
    // No-op
  }

  deactivate(): void {
    // No-op
  }

  onPointerDown(_event: NormalizedInputEvent): void {
    // No-op
  }

  onPointerMove(_event: NormalizedInputEvent): void {
    // No-op
  }

  onPointerUp(_event: NormalizedInputEvent): void {
    // No-op
  }

  onDoubleClick(_event: NormalizedInputEvent): void {
    // No-op
  }

  onLongPress(_event: NormalizedInputEvent): void {
    // No-op
  }

  onKeyDown(_key: string, _event: KeyboardEvent): void {
    // No-op
  }
}
