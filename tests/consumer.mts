import {
  createSplitLayout,
  parseSplitLayout,
  type SplitNode,
  type SplitLayout,
} from '@lp-labs/split-layout-tree';

const root: SplitNode = { type: 'leaf', id: 'only' };
const layout: SplitLayout = createSplitLayout(root);
const restored: SplitLayout = parseSplitLayout(layout.serialize());
void restored.nodeCount;
