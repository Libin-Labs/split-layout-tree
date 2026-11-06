# @lp-labs/split-layout-tree

Immutable updates over a validated binary split-layout tree with an explicit persistence envelope.
The package models proportions and minimum dimensions; it does not render panes. Runtime and peer
dependencies: none.

## Install

```bash
npm install @lp-labs/split-layout-tree
```

Node 18+, strict TypeScript declarations, ESM and CommonJS builds.

## Quickstart

```js
import { createSplitLayout, parseSplitLayout } from '@lp-labs/split-layout-tree';

const layout = createSplitLayout({
  type: 'split',
  id: 'root',
  axis: 'horizontal',
  ratio: 0.5,
  first: { type: 'leaf', id: 'left', minWidth: 100 },
  second: { type: 'leaf', id: 'right', minWidth: 100 },
});
layout.resizeSplit('root', 0.6, { width: 500, height: 300 });
const restored = parseSplitLayout(layout.serialize());
if (restored.snapshot().type !== 'split') throw new Error('Layout roundtrip failed');
```

## Public APIs and types

- `createSplitLayout(root, options?)` validates a `SplitNode`; `parseSplitLayout(json, options?)`
  validates the versioned persistence envelope. Both return `SplitLayout`.
- `SplitLeaf` is `{ type: 'leaf', id, minWidth?, minHeight? }`.
  `SplitBranch` is `{ type: 'split', id, axis, ratio, first, second }`.
  `SplitNode` is their union, with `SplitAxis` equal to `horizontal` or `vertical`.
- `SplitLayoutState` is the persisted `{ version: 1, root }` shape. `SplitTreeOptions` sets
  `maxNodes` (default 255) and `maxDepth` (default 32). `ViewportSize` supplies width/height.
- `SplitLayout.nodeCount`, `snapshot`, `serialize`, `resizeSplit`, and `replaceLeaf` expose state.
  The only runtime exports are `createSplitLayout` and `parseSplitLayout`.

All returned trees are fresh copies. A split ratio is the share given to its first child; horizontal
splits partition width and vertical splits partition height. Supplying a viewport to `resizeSplit`
enforces recursive minimum dimensions. Persisted data is data-only; unsupported versions are
rejected.

## Customization

Transform the immutable snapshot to your renderer's pane representation:

```js
import { createSplitLayout } from '@lp-labs/split-layout-tree';

const layout = createSplitLayout({
  type: 'split',
  id: 'main',
  axis: 'vertical',
  ratio: 0.4,
  first: { type: 'leaf', id: 'editor', minHeight: 120 },
  second: { type: 'leaf', id: 'console', minHeight: 80 },
});
const root = layout.snapshot();
if (root.type !== 'split' || root.ratio !== 0.4) throw new Error('Unexpected layout');
```

## Limits and errors

Node IDs are unique nonempty strings up to 128 units. Ratios must be finite and strictly inside
(0, 1); minima and viewport dimensions are non-negative finite numbers. Invalid shapes/IDs throw
`TypeError`, numeric/capacity violations throw `RangeError`. Tree capacity, nesting, and serialized
input are bounded; JSON input is limited to 1,000,000 characters. Failed replacement/resizing leaves
the current tree unchanged. `serialize()` is deterministic for the current insertion order.

This tree does not distribute rounding pixels, persist application metadata, manage tabs, or infer
minimums from DOM measurements.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
