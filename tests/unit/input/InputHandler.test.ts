import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardInput } from '../../../src/input/KeyboardInput';

// Testing KeyboardInput directly since it has the simplest DOM interaction
// MouseInput and TouchInput require a MapLibre map instance which is hard to mock in unit tests

describe('KeyboardInput', () => {
  let onKeyDown: ReturnType<typeof vi.fn>;
  let keyboardInput: KeyboardInput;

  beforeEach(() => {
    onKeyDown = vi.fn();
    keyboardInput = new KeyboardInput({ onKeyDown });
    keyboardInput.enable();
  });

  afterEach(() => {
    keyboardInput.destroy();
  });

  it('should call onKeyDown when a key is pressed', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    expect(onKeyDown).toHaveBeenCalledWith('Escape', event);
  });

  it('should not call onKeyDown when disabled', () => {
    keyboardInput.disable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('should handle Delete key', () => {
    const event = new KeyboardEvent('keydown', { key: 'Delete' });
    document.dispatchEvent(event);

    expect(onKeyDown).toHaveBeenCalledWith('Delete', event);
  });

  it('should handle Backspace key', () => {
    const event = new KeyboardEvent('keydown', { key: 'Backspace' });
    document.dispatchEvent(event);

    expect(onKeyDown).toHaveBeenCalledWith('Backspace', event);
  });

  it('should stop receiving events after destroy', () => {
    keyboardInput.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('should re-enable after disable', () => {
    keyboardInput.disable();
    keyboardInput.enable();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    expect(onKeyDown).toHaveBeenCalled();
  });
});
