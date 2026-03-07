import { describe, expect, it } from 'vitest';
import { FeatureStore } from '../../../src/core/FeatureStore';
import { SplitAction } from '../../../src/types/features';
import type { LibreDrawFeature } from '../../../src/types/features';

function makeFeature(id: string, coordinates: number[][]): LibreDrawFeature {
  return {
    id,
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates as [number, number][]],
    },
    properties: { tag: id },
  };
}

describe('SplitAction', () => {
  it('apply should remove original and add two split features', () => {
    const store = new FeatureStore();

    const original = makeFeature('orig', [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
    const a = makeFeature('a', [
      [0, 0],
      [5, 0],
      [5, 10],
      [0, 10],
      [0, 0],
    ]);
    const b = makeFeature('b', [
      [5, 0],
      [10, 0],
      [10, 10],
      [5, 10],
      [5, 0],
    ]);

    store.add(original);

    const action = new SplitAction(original, a, b);
    action.apply(store);

    expect(store.getById('orig')).toBeUndefined();
    expect(store.getById('a')).toBeDefined();
    expect(store.getById('b')).toBeDefined();
  });

  it('revert should remove split features and restore original', () => {
    const store = new FeatureStore();

    const original = makeFeature('orig', [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
    const a = makeFeature('a', [
      [0, 0],
      [5, 0],
      [5, 10],
      [0, 10],
      [0, 0],
    ]);
    const b = makeFeature('b', [
      [5, 0],
      [10, 0],
      [10, 10],
      [5, 10],
      [5, 0],
    ]);

    const action = new SplitAction(original, a, b);
    store.add(original);
    action.apply(store);
    action.revert(store);

    expect(store.getById('orig')).toBeDefined();
    expect(store.getById('a')).toBeUndefined();
    expect(store.getById('b')).toBeUndefined();
  });

  it('should keep constructor snapshots immutable', () => {
    const store = new FeatureStore();

    const original = makeFeature('orig', [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
    const a = makeFeature('a', [
      [0, 0],
      [5, 0],
      [5, 10],
      [0, 10],
      [0, 0],
    ]);
    const b = makeFeature('b', [
      [5, 0],
      [10, 0],
      [10, 10],
      [5, 10],
      [5, 0],
    ]);

    const action = new SplitAction(original, a, b);

    original.properties.tag = 'tampered-original';
    a.properties.tag = 'tampered-a';
    b.properties.tag = 'tampered-b';

    store.add(original);
    action.apply(store);

    expect(store.getById('a')?.properties.tag).toBe('a');
    expect(store.getById('b')?.properties.tag).toBe('b');
  });
});
