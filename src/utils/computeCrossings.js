/**
 * parentChild エッジ同士の「縦線 × 横線」交差を一括計算するユーティリティ。
 *
 * 各 parentChild エッジは 4 点の折れ線を描く:
 *   (sx, sy) → (sx, bendY) → (tx, bendY) → (tx, ty)
 *    ↑垂直 seg1   ↑水平 seg2              ↑垂直 seg3
 *
 * 検出対象:
 *   あるエッジの「垂直 seg1 または seg3」 × 別エッジの「水平 seg2」
 *
 * 戻り値: Map<edgeId, { cx1: number[], cx3: number[] }>
 *   cx1: seg1 上の交差 Y 座標リスト
 *   cx3: seg3 上の交差 Y 座標リスト
 */

const BRIDGE_R = 6;
const EPS = BRIDGE_R + 2; // 端点付近の交差を除外するマージン

/** ノードの絶対座標を返す。internals がなければ position + 親座標で推定する */
function getAbsPos(node, nodeMap) {
  if (node?.internals?.positionAbsolute) return node.internals.positionAbsolute;
  if (node?.parentId) {
    const parent = nodeMap.get(node.parentId);
    if (parent) {
      const pp = getAbsPos(parent, nodeMap);
      return {
        x: pp.x + (node.position?.x ?? 0),
        y: pp.y + (node.position?.y ?? 0),
      };
    }
  }
  return node?.position ?? { x: 0, y: 0 };
}

/** parentChild エッジの折れ線ジオメトリを計算する */
function getEdgeGeometry(edge, nodeMap) {
  const src = nodeMap.get(edge.source);
  const tgt = nodeMap.get(edge.target);
  if (!src || !tgt) return null;

  const sp = getAbsPos(src, nodeMap);
  const tp = getAbsPos(tgt, nodeMap);

  // ノードサイズ: measured（React Flow レンダリング後）か style/デフォルトで推定
  const srcW = src.measured?.width  ?? (src.type === 'couple' ? 1 : 80);
  const srcH = src.measured?.height ?? (src.type === 'couple' ? 1 : 20);
  const tgtW = tgt.measured?.width  ?? 80;

  const sx = sp.x + srcW / 2; // source 中心 X (= sourceX in edge component)
  const sy = sp.y + srcH;     // source 下辺 Y (= sourceY = fromY)
  const tx = tp.x + tgtW / 2; // target 中心 X (= targetX)
  const ty = tp.y;             // target 上辺 Y (= childTop)

  // 親グループ下辺 (= groupBottom)
  const srcParent = src.parentId ? nodeMap.get(src.parentId) : null;
  const groupH = srcParent
    ? (srcParent.measured?.height ?? Number(srcParent.style?.height) || 120)
    : srcH;
  const groupBottom = srcParent
    ? getAbsPos(srcParent, nodeMap).y + groupH
    : sy;

  const bendY = groupBottom + (ty - groupBottom) / 3;

  return { sx, sy, tx, ty, bendY };
}

/** 垂直線分 × 水平線分の交差 Y を返す（端点付近は除外） */
function detectCrossY(vx, vy1, vy2, hx1, hy, hx2) {
  const xLo = Math.min(hx1, hx2) + EPS;
  const xHi = Math.max(hx1, hx2) - EPS;
  const yLo = Math.min(vy1, vy2) + EPS;
  const yHi = Math.max(vy1, vy2) - EPS;
  return vx > xLo && vx < xHi && hy > yLo && hy < yHi ? hy : null;
}

/**
 * nodes と edges を受け取り、全 parentChild エッジの交差データを返す。
 * @param {object[]} nodes  現在のノード配列（position または internals.positionAbsolute を持つ）
 * @param {object[]} edges  現在のエッジ配列
 * @returns {Map<string, {cx1: number[], cx3: number[]}>}
 */
export function computeAllCrossings(nodes, edges) {
  const nodeMap  = new Map(nodes.map((n) => [n.id, n]));
  const pcEdges  = edges.filter((e) => e.type === 'parentChild');

  // 全エッジのジオメトリを事前計算
  const geomMap = new Map();
  for (const edge of pcEdges) {
    const g = getEdgeGeometry(edge, nodeMap);
    if (g) geomMap.set(edge.id, g);
  }

  // エッジごとに交差を集計
  const result = new Map();

  for (const edge of pcEdges) {
    const myG = geomMap.get(edge.id);
    if (!myG) {
      result.set(edge.id, { cx1: [], cx3: [] });
      continue;
    }

    const cx1 = [];
    const cx3 = [];

    for (const other of pcEdges) {
      if (other.id === edge.id) continue;
      const oG = geomMap.get(other.id);
      if (!oG) continue;

      // 他エッジの水平セグメント: (oG.sx, oG.bendY) → (oG.tx, oG.bendY)
      const c1 = detectCrossY(myG.sx, myG.sy, myG.bendY, oG.sx, oG.bendY, oG.tx);
      if (c1 !== null) cx1.push(c1);

      const c3 = detectCrossY(myG.tx, myG.bendY, myG.ty, oG.sx, oG.bendY, oG.tx);
      if (c3 !== null) cx3.push(c3);
    }

    result.set(edge.id, { cx1, cx3 });
  }

  return result;
}

/** 2つの数値配列が実質同じかどうかを判定（≤0.5px 誤差を許容） */
export function sameArrays(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => Math.abs(v - b[i]) < 0.5);
}
