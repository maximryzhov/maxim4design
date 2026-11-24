import test from 'node:test';
import assert from 'node:assert/strict';
import { sortChildrenByStackingOrder } from '../src/plugin/stacking-manager.ts';
import type { FIRNode } from '../src/types/fir.ts';

function createDummyNode(id: string, zIndex: number): FIRNode {
  return {
    id,
    name: id,
    type: 'FRAME',
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    visible: true,
    opacity: 1,
    clipsContent: false,
    zIndex,
  };
}

test('sortChildrenByStackingOrder sorts negative, zero and positive z-index stably', () => {
  const children: FIRNode[] = [
    createDummyNode('node-modal', 1000),
    createDummyNode('node-dom1', 0),
    createDummyNode('node-bg-decor', -1),
    createDummyNode('node-dom2', 0),
    createDummyNode('node-dropdown', 50),
    createDummyNode('node-tooltip', 9999),
  ];

  const sorted = sortChildrenByStackingOrder(children);
  const sortedIds = sorted.map((n) => n.id);

  assert.deepEqual(sortedIds, [
    'node-bg-decor', // z-index: -1 (lowest)
    'node-dom1',     // z-index: 0 (first in DOM)
    'node-dom2',     // z-index: 0 (second in DOM, preserved)
    'node-dropdown', // z-index: 50
    'node-modal',    // z-index: 1000
    'node-tooltip',  // z-index: 9999 (highest, on top)
  ]);
});

test('sortChildrenByStackingOrder handles empty or single element array', () => {
  assert.deepEqual(sortChildrenByStackingOrder([]), []);
  const single = [createDummyNode('one', 0)];
  assert.deepEqual(sortChildrenByStackingOrder(single), single);
});
