import { BaseEdge, useStore } from '@xyflow/react';

/**
 * 親子関係を示す折れ曲がりエッジ。
 *
 * ┌─────────────────────────┐
 * │  婚姻グループ            │
 * │  [妻] ══════ [夫]       │  ← 婚姻線（Y = coupleY）
 * │          │              │  ← ここから出発 (fromY = sourceY = coupleY)
 * └──────────┼──────────────┘  ← グループ下辺 (groupBottom)
 *            │
 *            │  ← 1/3  (groupBottom〜childTop 間)
 *            │
 *    ────────┤  ← bendY
 *            │
 *            │  ← 残り 2/3
 *            │
 *         [子ノード]             ← childTop = targetNode 上辺
 *
 * 出発点 Y  : couple ノードの bottom ハンドル = 婚姻線の中点 Y (sourceY)
 * 折れ曲がり: 親グループ下辺〜子ノード上辺の 1/3 点 (bendY)
 * 終点 Y    : 子ノードの上辺 (childTop)
 */
export default function ParentChildEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  style = {},
}) {
  const nodeLookup = useStore(s => s.nodeLookup);

  const sourceNode = nodeLookup.get(source);
  const targetNode = nodeLookup.get(target);

  // ── 出発点 Y: couple ノードの bottom ハンドル = 婚姻線中点 ──
  const fromY = sourceY;

  // ── 折れ曲がり計算の基準: 親グループ下辺 〜 子ノード上辺 ──
  const sourceParent = sourceNode?.parentId
    ? nodeLookup.get(sourceNode.parentId)
    : null;

  const groupBottom = sourceParent
    ? sourceParent.internals.positionAbsolute.y +
      (sourceParent.measured?.height ?? sourceParent.height ?? 120)
    : sourceY;

  const childTop = targetNode
    ? targetNode.internals.positionAbsolute.y
    : targetY;

  // 折れ曲がり点: groupBottom〜childTop 間の 1/3
  const bendY = groupBottom + (childTop - groupBottom) / 3;

  const path = [
    `M ${sourceX} ${fromY}`,    // 婚姻線中点から出発
    `L ${sourceX} ${bendY}`,    // 1/3 点まで真下
    `L ${targetX} ${bendY}`,    // 水平移動
    `L ${targetX} ${childTop}`, // 子ノード上辺まで真下
  ].join(' ');

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke:      selected ? '#4a90d9' : '#555',
        strokeWidth: selected ? 3         : 2,
        fill: 'none',
        filter: selected ? 'drop-shadow(0 0 3px rgba(74,144,217,0.7))' : 'none',
        ...style,
      }}
    />
  );
}
