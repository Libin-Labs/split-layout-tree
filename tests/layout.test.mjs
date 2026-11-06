import test from 'node:test';
import assert from 'node:assert/strict';
import { createSplitLayout, parseSplitLayout } from '../dist/esm/index.js';

const tree = () => ({
  type: 'split',
  id: 'root',
  axis: 'horizontal',
  ratio: 0.5,
  first: { type: 'leaf', id: 'a', minWidth: 100 },
  second: { type: 'leaf', id: 'b', minWidth: 150 },
});

test('validates, resizes within minima, and round-trips persistence data', () => {
  const layout = createSplitLayout(tree());
  layout.resizeSplit('root', 0.4, { width: 500, height: 300 });
  assert.equal(layout.snapshot().ratio, 0.4);
  assert.equal(parseSplitLayout(layout.serialize()).snapshot().ratio, 0.4);
  assert.throws(() => layout.resizeSplit('root', 0.19, { width: 500, height: 300 }), RangeError);
  assert.equal(layout.snapshot().ratio, 0.4);
});

test('replacement is immutable and preserves the persistence shape', () => {
  const layout = createSplitLayout(tree());
  const original = layout.snapshot();
  layout.replaceLeaf('a', { type: 'leaf', id: 'c', minHeight: 50 });
  assert.equal(original.first.id, 'a');
  assert.equal(layout.nodeCount, 3);
  assert.equal(layout.snapshot().first.id, 'c');
});

test('rejects duplicate IDs, invalid ratios, versions, and capacity violations', () => {
  assert.throws(
    () => createSplitLayout({ ...tree(), second: { type: 'leaf', id: 'a' } }),
    /Duplicate/,
  );
  assert.throws(() => createSplitLayout({ ...tree(), ratio: 1 }), RangeError);
  assert.throws(() => createSplitLayout(tree(), { maxNodes: 2 }), RangeError);
  assert.throws(() => parseSplitLayout('{"version":2,"root":{}}'), /Unsupported/);
  assert.throws(() => parseSplitLayout('{'), /valid JSON/);
});

test('all failed updates leave layout unchanged', () => {
  const layout = createSplitLayout(tree());
  const before = layout.serialize();
  assert.throws(() => layout.replaceLeaf('missing', { type: 'leaf', id: 'x' }), /Unknown/);
  assert.throws(() => layout.replaceLeaf('a', { type: 'leaf', id: 'root' }), /Duplicate/);
  assert.equal(layout.serialize(), before);
});
