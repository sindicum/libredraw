import { describe, expect, it } from 'vitest';
import { FeatureStore } from '../../../src/core/FeatureStore';
import {
  CreateAction,
  DeleteAction,
  UpdateAction,
} from '../../../src/types/features';
import type { LibreDrawFeature } from '../../../src/types/features';

function makeFeature(id: string): LibreDrawFeature {
  return {
    id,
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 0],
        ],
      ],
    },
    properties: {},
  };
}

describe('Feature actions snapshot behavior', () => {
  it('CreateAction should snapshot constructor input', () => {
    const store = new FeatureStore();
    const source = makeFeature('f1');
    const action = new CreateAction(source);

    source.geometry.coordinates[0][0][0] = 999;
    source.properties.name = 'tampered';

    action.apply(store);

    const stored = store.getById('f1')!;
    expect(stored.geometry.coordinates[0][0][0]).toBe(0);
    expect(stored.properties.name).toBeUndefined();
  });

  it('UpdateAction should snapshot old/new constructor inputs', () => {
    const store = new FeatureStore();
    store.add(makeFeature('f1'));

    const oldFeature = makeFeature('f1');
    const newFeature = {
      ...makeFeature('f1'),
      properties: { name: 'updated' },
    };
    const action = new UpdateAction('f1', oldFeature, newFeature);

    oldFeature.properties.name = 'tampered-old';
    newFeature.properties.name = 'tampered-new';

    action.apply(store);
    expect(store.getById('f1')!.properties.name).toBe('updated');

    action.revert(store);
    expect(store.getById('f1')!.properties.name).toBeUndefined();
  });

  it('DeleteAction should snapshot constructor input', () => {
    const store = new FeatureStore();
    const source = makeFeature('f1');
    store.add(source);

    const action = new DeleteAction(source);
    source.geometry.coordinates[0][0][0] = 999;

    store.remove('f1');
    action.revert(store);

    const restored = store.getById('f1')!;
    expect(restored.geometry.coordinates[0][0][0]).toBe(0);
  });
});
