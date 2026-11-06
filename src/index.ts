export type SplitAxis = 'horizontal' | 'vertical';

export interface SplitLeaf {
  type: 'leaf';
  id: string;
  minWidth?: number;
  minHeight?: number;
}

export interface SplitBranch {
  type: 'split';
  id: string;
  axis: SplitAxis;
  ratio: number;
  first: SplitNode;
  second: SplitNode;
}

export type SplitNode = SplitLeaf | SplitBranch;
export interface ViewportSize {
  width: number;
  height: number;
}
export interface SplitTreeOptions {
  maxNodes?: number;
  maxDepth?: number;
}
export interface SplitLayout {
  readonly nodeCount: number;
  snapshot(): SplitNode;
  serialize(): string;
  resizeSplit(id: string, ratio: number, viewport?: ViewportSize): SplitNode;
  replaceLeaf(id: string, replacement: SplitNode): SplitNode;
}

export interface SplitLayoutState {
  version: 1;
  root: SplitNode;
}

interface Bounds {
  width: number;
  height: number;
}

function label(value: string): void {
  if (typeof value !== 'string' || !value || value.length > 128)
    throw new TypeError('Node IDs must be nonempty strings up to 128 units.');
}

function minimum(value: number | undefined, name: string): number {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be a non-negative finite number.`);
  return value;
}

function clone(
  node: SplitNode,
  depth = 1,
  ancestors = new Set<object>(),
  budget = { count: 0 },
): SplitNode {
  if (!node || typeof node !== 'object') throw new TypeError('Expected a split tree node.');
  if (depth > 64 || ++budget.count > 10_000)
    throw new RangeError('Split tree copy capacity exceeded.');
  if (ancestors.has(node)) throw new TypeError('Split tree cannot contain cycles.');
  ancestors.add(node);
  try {
    if (node.type === 'leaf') {
      return {
        type: 'leaf',
        id: node.id,
        ...(node.minWidth === undefined ? {} : { minWidth: node.minWidth }),
        ...(node.minHeight === undefined ? {} : { minHeight: node.minHeight }),
      };
    }
    if (node.type !== 'split') throw new TypeError('Unsupported split node.');
    return {
      type: 'split',
      id: node.id,
      axis: node.axis,
      ratio: node.ratio,
      first: clone(node.first, depth + 1, ancestors, budget),
      second: clone(node.second, depth + 1, ancestors, budget),
    };
  } finally {
    ancestors.delete(node);
  }
}

export function createSplitLayout(input: SplitNode, options: SplitTreeOptions = {}): SplitLayout {
  const maxNodes = options.maxNodes ?? 255;
  const maxDepth = options.maxDepth ?? 32;
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1)
    throw new RangeError('maxNodes must be a positive safe integer.');
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1)
    throw new RangeError('maxDepth must be a positive safe integer.');
  let root = clone(input);
  const validate = (node: SplitNode): { count: number; depth: number; bounds: Bounds } => {
    if (!node || typeof node !== 'object') throw new TypeError('Expected a split tree node.');
    label(node.id);
    if (node.type === 'leaf') {
      const width = minimum(node.minWidth, 'minWidth');
      const height = minimum(node.minHeight, 'minHeight');
      return { count: 1, depth: 1, bounds: { width, height } };
    }
    if (node.type !== 'split' || !['horizontal', 'vertical'].includes(node.axis))
      throw new TypeError('Unsupported split node or axis.');
    if (
      typeof node.ratio !== 'number' ||
      !Number.isFinite(node.ratio) ||
      node.ratio <= 0 ||
      node.ratio >= 1
    )
      throw new RangeError('Split ratio must be finite and strictly between zero and one.');
    const first = validate(node.first);
    const second = validate(node.second);
    const bounds =
      node.axis === 'horizontal'
        ? {
            width: first.bounds.width + second.bounds.width,
            height: Math.max(first.bounds.height, second.bounds.height),
          }
        : {
            width: Math.max(first.bounds.width, second.bounds.width),
            height: first.bounds.height + second.bounds.height,
          };
    return {
      count: first.count + second.count + 1,
      depth: Math.max(first.depth, second.depth) + 1,
      bounds,
    };
  };
  const checkTree = (node: SplitNode) => {
    const ids = new Set<string>();
    const walk = (value: SplitNode, depth: number): number => {
      if (depth > maxDepth) throw new RangeError('Split tree depth exceeded.');
      if (ids.has(value.id)) throw new TypeError(`Duplicate node ID: ${value.id}`);
      ids.add(value.id);
      if (value.type === 'leaf') return 1;
      return 1 + walk(value.first, depth + 1) + walk(value.second, depth + 1);
    };
    const count = walk(node, 1);
    if (count > maxNodes) throw new RangeError('Split tree node capacity exceeded.');
    const result = validate(node);
    return { count, bounds: result.bounds };
  };
  checkTree(root);
  const find = (node: SplitNode, id: string): SplitNode | null =>
    node.id === id
      ? node
      : node.type === 'split'
        ? (find(node.first, id) ?? find(node.second, id))
        : null;
  const update = (
    node: SplitNode,
    id: string,
    transform: (value: SplitNode) => SplitNode,
  ): SplitNode => {
    if (node.id === id) return transform(node);
    if (node.type === 'leaf') return node;
    const first = update(node.first, id, transform);
    const second = update(node.second, id, transform);
    return first === node.first && second === node.second ? node : { ...node, first, second };
  };
  const state = (): SplitLayoutState => ({ version: 1, root: clone(root) });
  return {
    get nodeCount() {
      return checkTree(root).count;
    },
    snapshot: () => clone(root),
    serialize: () => JSON.stringify(state()),
    resizeSplit(id, ratio, viewport) {
      if (typeof ratio !== 'number' || !Number.isFinite(ratio))
        throw new TypeError('ratio must be finite.');
      const target = find(root, id);
      if (!target) throw new TypeError(`Unknown split node: ${id}`);
      if (target.type !== 'split') throw new TypeError(`Node is not a split: ${id}`);
      let lower = 0;
      let upper = 1;
      if (viewport !== undefined) {
        if (
          !viewport ||
          !Number.isFinite(viewport.width) ||
          viewport.width < 0 ||
          !Number.isFinite(viewport.height) ||
          viewport.height < 0
        )
          throw new RangeError('Viewport dimensions must be non-negative and finite.');
        const boundsOf = (node: SplitNode): Bounds => {
          if (node.type === 'leaf')
            return {
              width: minimum(node.minWidth, 'minWidth'),
              height: minimum(node.minHeight, 'minHeight'),
            };
          const first = boundsOf(node.first);
          const second = boundsOf(node.second);
          return node.axis === 'horizontal'
            ? { width: first.width + second.width, height: Math.max(first.height, second.height) }
            : { width: Math.max(first.width, second.width), height: first.height + second.height };
        };
        const extent = target.axis === 'horizontal' ? viewport.width : viewport.height;
        const firstExtent =
          target.axis === 'horizontal'
            ? boundsOf(target.first).width
            : boundsOf(target.first).height;
        const secondExtent =
          target.axis === 'horizontal'
            ? boundsOf(target.second).width
            : boundsOf(target.second).height;
        if (extent === 0 && (firstExtent > 0 || secondExtent > 0))
          throw new RangeError('Viewport cannot satisfy child minimum sizes.');
        if (extent > 0) {
          lower = firstExtent / extent;
          upper = 1 - secondExtent / extent;
        }
        if (lower > upper) throw new RangeError('Viewport cannot satisfy child minimum sizes.');
      }
      if (ratio <= 0 || ratio >= 1)
        throw new RangeError('ratio must be strictly between zero and one.');
      if (ratio < lower || ratio > upper)
        throw new RangeError('ratio violates child minimum constraints.');
      const next = update(root, id, (node) => ({ ...node, ratio }) as SplitBranch);
      checkTree(next);
      root = next;
      return clone(root);
    },
    replaceLeaf(id, replacement) {
      const target = find(root, id);
      if (!target) throw new TypeError(`Unknown node: ${id}`);
      if (target.type !== 'leaf') throw new TypeError(`Node is not a leaf: ${id}`);
      const copied = clone(replacement);
      const next = update(root, id, () => copied);
      checkTree(next);
      root = next;
      return clone(root);
    },
  };
}

export function parseSplitLayout(serialized: string, options: SplitTreeOptions = {}): SplitLayout {
  if (typeof serialized !== 'string' || serialized.length > 1_000_000)
    throw new TypeError('Serialized layout must be a string up to 1,000,000 units.');
  let state: unknown;
  try {
    state = JSON.parse(serialized);
  } catch {
    throw new TypeError('Serialized layout is not valid JSON.');
  }
  if (
    !state ||
    typeof state !== 'object' ||
    (state as { version?: unknown }).version !== 1 ||
    !('root' in state)
  )
    throw new TypeError('Unsupported split layout persistence shape.');
  return createSplitLayout((state as SplitLayoutState).root, options);
}
