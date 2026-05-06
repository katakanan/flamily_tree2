/**
 * marriageGroup / 単独 person ノードの data.children から
 * 親子エッジを自動生成するユーティリティ。
 *
 * - marriageGroup: グループ内の couple ノードの下ポート → 各子の上ポート
 * - person (単独): その person ノードの下ポート → 各子の上ポート
 *
 * data.children には子のノード ID（person または marriageGroup）を
 * 配列で指定する。
 */
export function buildParentChildEdges(nodes) {
  // couple ノードをグループ ID で素早く引けるマップを作成
  const coupleByGroup = new Map();
  for (const node of nodes) {
    if (node.type === 'couple' && node.parentId) {
      coupleByGroup.set(node.parentId, node.id);
    }
  }

  const edges = [];

  for (const node of nodes) {
    const children = node.data?.children ?? [];
    if (children.length === 0) continue;

    if (node.type === 'marriageGroup') {
      // 婚姻グループ: couple ノード経由で接続
      const coupleId = coupleByGroup.get(node.id);
      if (!coupleId) continue;
      for (const childId of children) {
        edges.push({
          id:           `e-${coupleId}-${childId}`,
          source:       coupleId,
          sourceHandle: 'bottom',
          target:       childId,
          targetHandle: 'top',
          type:         'parentChild',
          style:        { strokeWidth: 2 },
        });
      }
    } else if (node.type === 'person' && !node.parentId) {
      // 単独 person ノード（グループ外）: 直接接続
      for (const childId of children) {
        edges.push({
          id:           `e-${node.id}-${childId}`,
          source:       node.id,
          sourceHandle: 'bottom',
          target:       childId,
          targetHandle: 'top',
          type:         'parentChild',
          style:        { strokeWidth: 2 },
        });
      }
    }
  }

  return edges;
}
