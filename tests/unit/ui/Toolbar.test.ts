import { describe, it, expect, vi } from 'vitest';
import { ToolbarButton } from '../../../src/ui/ToolbarButton';

// We test ToolbarButton directly since Toolbar requires a MapLibre map instance.
// Toolbar integration is tested by verifying ToolbarButton DOM generation and state management.

describe('ToolbarButton', () => {
  it('should create a button element', () => {
    const btn = new ToolbarButton({
      id: 'draw',
      icon: '<svg><circle r="5"/></svg>',
      title: 'Draw polygon',
      onClick: vi.fn(),
    });

    const el = btn.getElement();
    expect(el.tagName).toBe('BUTTON');
    expect(el.type).toBe('button');
    expect(el.title).toBe('Draw polygon');
    expect(el.getAttribute('aria-label')).toBe('Draw polygon');
    expect(el.dataset.libreDrawButton).toBe('draw');
  });

  it('should have 44px touch target size', () => {
    const btn = new ToolbarButton({
      id: 'draw',
      icon: '<svg><circle r="5"/></svg>',
      title: 'Draw polygon',
      onClick: vi.fn(),
    });

    const el = btn.getElement();
    expect(el.style.width).toBe('44px');
    expect(el.style.height).toBe('44px');
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    const btn = new ToolbarButton({
      id: 'draw',
      icon: '<svg><circle r="5"/></svg>',
      title: 'Draw polygon',
      onClick,
    });

    btn.getElement().click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should not call onClick when disabled', () => {
    const onClick = vi.fn();
    const btn = new ToolbarButton({
      id: 'draw',
      icon: '<svg><circle r="5"/></svg>',
      title: 'Draw polygon',
      onClick,
    });

    btn.setDisabled(true);
    btn.getElement().click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('should update active state', () => {
    const btn = new ToolbarButton({
      id: 'draw',
      icon: '<svg><circle r="5"/></svg>',
      title: 'Draw polygon',
      onClick: vi.fn(),
      isToggle: true,
    });

    btn.setActive(true);
    const el = btn.getElement();
    expect(el.getAttribute('aria-pressed')).toBe('true');
    expect(el.style.backgroundColor).toBe('#3bb2d0');

    btn.setActive(false);
    expect(el.getAttribute('aria-pressed')).toBe('false');
    expect(el.style.backgroundColor).toBe('#ffffff');
  });

  it('should update disabled state', () => {
    const btn = new ToolbarButton({
      id: 'undo',
      icon: '<svg><path d="M0 0"/></svg>',
      title: 'Undo',
      onClick: vi.fn(),
    });

    btn.setDisabled(true);
    expect(btn.getElement().disabled).toBe(true);
    expect(btn.getElement().style.opacity).toBe('0.4');
    expect(btn.getElement().style.cursor).toBe('not-allowed');

    btn.setDisabled(false);
    expect(btn.getElement().disabled).toBe(false);
    expect(btn.getElement().style.opacity).toBe('1');
    expect(btn.getElement().style.cursor).toBe('pointer');
  });

  it('should remove element on destroy', () => {
    const btn = new ToolbarButton({
      id: 'draw',
      icon: '<svg><circle r="5"/></svg>',
      title: 'Draw polygon',
      onClick: vi.fn(),
    });

    const parent = document.createElement('div');
    parent.appendChild(btn.getElement());
    expect(parent.children).toHaveLength(1);

    btn.destroy();
    expect(parent.children).toHaveLength(0);
  });
});
