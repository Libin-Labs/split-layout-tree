import { createSplitLayout, type SplitLeaf } from '@lp-labs/split-layout-tree';

const leaf: SplitLeaf = { type: 'leaf', id: 'pane', minWidth: 10 };
const count: number = createSplitLayout(leaf).nodeCount;
void count;
