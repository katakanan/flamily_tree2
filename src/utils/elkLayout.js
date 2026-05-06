import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// 単体ノードのデフォルトサイズ（PersonNodeの minHeight に合わせる）
const NODE_SIZE = {
  person: { width: 68, height: 168 },
  couple: { width: 1,  height: 1   },
};

/**
 * ノードの ELK 用サイズを取得する。
 * marriageGroup はノードの style.width / style.height を使用。
 */
function getElkSize(node) {
  if (node.style?.width && node.style?.height) {
    return { width: Number(node.style.width), height: Number(node.style.height) };
  }
  return NODE_SIZE[node.type] ?? NODE_SIZE.person;
}

/**
 * ノード ID → そのノードが属する ELK トップレベル ID を返す。
 * parentId を持つノード（グループ内）は親の ID を返す。
 */
function resolveElkId(nodeId, nodeMap) {
  const node = nodeMap.get(nodeId);
  if (!node) return nodeId;
  return node.parentId ?? nodeId;
}

/**
 * ELK layered + partitioning で自動レイアウトを適用する。
 *
 * ネストノード（parentId あり）は ELK に渡さず、
 * それらを含むエッジはグループ ID に置換して ELK に渡す。
 * レイアウト結果はトップレベルノードのみに適用し、
 * ネストノードの相対座標はそのまま保持する。
 */
export async function applyElkLayout(nodes, edges) {
  // ノードを素早く引けるようにマップ化
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // トップレベルノード（parentId なし）だけ ELK に渡す
  const topLevel = nodes.filter((n) => !n.parentId);

  // ELK に渡す順序のヒント: 世代順 → 生年月順（若い順 = 左）
  const topLevelSorted = [...topLevel].sort((a, b) => {
    const ga = a.data?.generation ?? 0;
    const gb = b.data?.generation ?? 0;
    if (ga !== gb) return ga - gb;
    const ayKnown = a.data?.birthYear != null;
    const byKnown = b.data?.birthYear != null;
    if (!ayKnown && !byKnown) return 0;
    if (!ayKnown) return  1;
    if (!byKnown) return -1;
    if (a.data.birthYear !== b.data.birthYear) return b.data.birthYear - a.data.birthYear;
    return (b.data.birthMonth ?? 0) - (a.data.birthMonth ?? 0);
  });

  // トップレベルノードの ID セット（エッジ有効性チェック用）
  const topLevelIds = new Set(topLevel.map((n) => n.id));

  // エッジの source/target をトップレベル ID に置換し重複を除去
  // ・グループ内エッジ（src === tgt）はスキップ
  // ・解決後の ID がトップレベルに存在しない場合もスキップ
  //   （動的に作成された couple ノードなどが nodeMap に未登録のケースを防ぐ）
  const elkEdgeMap = new Map();
  for (const edge of edges) {
    const src = resolveElkId(edge.source, nodeMap);
    const tgt = resolveElkId(edge.target, nodeMap);
    if (src === tgt) continue;
    if (!topLevelIds.has(src) || !topLevelIds.has(tgt)) continue;
    const key = `${src}->${tgt}`;
    if (!elkEdgeMap.has(key)) {
      elkEdgeMap.set(key, { id: key, sources: [src], targets: [tgt] });
    }
  }

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.partitioning.activate': 'true',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    // 生年月でソートした順序を ELK に渡す（モデル順ヒント）
    children: topLevelSorted.map((node) => {
      const size = getElkSize(node);
      const generation = node.data?.generation ?? 0;
      return {
        id: node.id,
        width: size.width,
        height: size.height,
        layoutOptions: {
          'elk.partitioning.partition': String(generation),
        },
      };
    }),
    edges: Array.from(elkEdgeMap.values()),
  };

  const laidOut = await elk.layout(elkGraph);

  // ① ELK の X 座標をトップレベルノードに適用（Y はあとで上書き）
  const positioned = nodes.map((node) => {
    if (node.parentId) return node;
    const elkNode = laidOut.children.find((n) => n.id === node.id);
    if (!elkNode) return node;
    return { ...node, position: { x: elkNode.x, y: elkNode.y } };
  });

  // ② 世代ごとの Y を数式で確定的に計算する
  //
  //    ELK の Y 平均を使う方法では、エッジのない孤立ノードが Y=0 に
  //    置かれるためにスペースが潰れる問題が生じる。
  //    代わりに世代番号をソートして順位 × (最大ノード高 + 層間ギャップ)
  //    で Y を算出することで、孤立ノードの影響を排除する。
  const LAYER_GAP = 80; // elk.layered.spacing.nodeNodeBetweenLayers と合わせる

  // トップレベルノードが持つ世代番号を昇順に並べる
  const topNodes = positioned.filter((n) => !n.parentId && n.data?.generation != null);
  const sortedGens = [...new Set(topNodes.map((n) => n.data.generation))].sort(
    (a, b) => a - b
  );

  // 世代ごとの最大ノード高を求め、Y を累積計算
  const genYMap = new Map();
  let yAccum = 0;
  for (const gen of sortedGens) {
    genYMap.set(gen, yAccum);
    const maxH = topNodes
      .filter((n) => n.data.generation === gen)
      .reduce((m, n) => Math.max(m, getElkSize(n).height), 120);
    yAccum += maxH + LAYER_GAP;
  }

  // ③ 確定した Y を適用
  const yAdjusted = positioned.map((node) => {
    if (node.parentId) return node;
    const gen = node.data?.generation;
    if (gen == null || !genYMap.has(gen)) return node;
    return { ...node, position: { ...node.position, y: genYMap.get(gen) } };
  });

  // ④ 同一世代内の X 重なりを解消する
  //    ELK が孤立ノードを別コンポーネントとして処理した場合、
  //    Y を統一した後に X が重複することがある。
  //    世代ごとに X でソートし、左から順に必要な分だけ右へ押し出す。
  const H_GAP = 40; // elk.spacing.nodeNode と同じ

  // 世代 → トップレベルノード一覧
  const genGroups = new Map();
  for (const node of yAdjusted) {
    if (node.parentId) continue;
    const gen = node.data?.generation;
    if (gen == null) continue;
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen).push(node);
  }

  // 各世代で左→右に走査し X が重ならないよう調整
  const xFixMap = new Map(); // id → 調整後 X
  for (const nodeList of genGroups.values()) {
    const sorted = [...nodeList].sort((a, b) => a.position.x - b.position.x);
    let nextMinX = -Infinity;
    for (const node of sorted) {
      const x = Math.max(node.position.x, nextMinX);
      if (x !== node.position.x) xFixMap.set(node.id, x);
      nextMinX = x + getElkSize(node).width + H_GAP;
    }
  }

  // ④ の結果を確定
  const afterXFix = yAdjusted.map((node) => {
    if (!xFixMap.has(node.id)) return node;
    return { ...node, position: { ...node.position, x: xFixMap.get(node.id) } };
  });

  // ⑤ 同じ親を持つ兄弟ノードをコンパクトに集約し、生年月順（早い = 右）で配置する
  //    ・現在の重心 X を保ちながら幅 + H_GAP で詰め直す。
  //    ・生年月不明のノードは左側（末尾）に回す。
  //    ・グループ内の person を子とする場合はグループを代表ノードとして扱う。
  const posMapFinal = new Map(afterXFix.map((n) => [n.id, n]));

  const coupleToGroupFinal = new Map();
  for (const n of afterXFix) {
    if (n.type === 'couple' && n.parentId) coupleToGroupFinal.set(n.id, n.parentId);
  }

  // parentChild エッジから 親ID → 兄弟情報リスト を構築
  const siblingGroups = new Map();
  for (const edge of edges) {
    if (edge.type !== 'parentChild') continue;
    const parentId = coupleToGroupFinal.get(edge.source) ?? edge.source;
    const childNode = posMapFinal.get(edge.target);
    if (!childNode) continue;
    const repId   = childNode.parentId ?? edge.target;
    const repNode = posMapFinal.get(repId);
    if (!repNode || repNode.parentId) continue;

    if (!siblingGroups.has(parentId)) siblingGroups.set(parentId, []);
    siblingGroups.get(parentId).push({
      repId,
      birthYear:  childNode.data?.birthYear  ?? null,
      birthMonth: childNode.data?.birthMonth ?? null,
    });
  }

  const compactMap = new Map(); // repId → 新 X

  for (const siblings of siblingGroups.values()) {
    if (siblings.length < 2) continue;

    // 重複 repId を除去
    const seen = new Set();
    const unique = siblings.filter((s) => {
      if (seen.has(s.repId)) return false;
      seen.add(s.repId);
      return true;
    });
    if (unique.length < 2) continue;

    // 生年月の昇順ソート（早い = 右）、不明は左（末尾）
    const sorted = [...unique].sort((a, b) => {
      const aK = a.birthYear != null;
      const bK = b.birthYear != null;
      if (!aK && !bK) return 0;
      if (!aK) return  1;
      if (!bK) return -1;
      if (a.birthYear !== b.birthYear) return a.birthYear - b.birthYear;
      return (a.birthMonth ?? 0) - (b.birthMonth ?? 0);
    });

    // 現在の重心 X（各ノード中心の平均）
    const centerX = unique.reduce((sum, s) => {
      const n = posMapFinal.get(s.repId);
      return sum + (n?.position.x ?? 0) + getElkSize(n).width / 2;
    }, 0) / unique.length;

    // コンパクト総幅 = Σ幅 + ギャップ × (n-1)
    const totalW = sorted.reduce(
      (sum, s) => sum + getElkSize(posMapFinal.get(s.repId)).width,
      0
    ) + H_GAP * (sorted.length - 1);

    // 右端から割り当て（sorted[0] = 最古 = 一番右）
    let x = centerX + totalW / 2;
    for (const sib of sorted) {
      const w = getElkSize(posMapFinal.get(sib.repId)).width;
      x -= w;
      compactMap.set(sib.repId, x);
      x -= H_GAP;
    }
  }

  const afterCompact = afterXFix.map((node) => {
    if (!compactMap.has(node.id)) return node;
    return { ...node, position: { ...node.position, x: compactMap.get(node.id) } };
  });

  // ⑥ コンパクト後の X 重複を再解消
  const genGroupsPost = new Map();
  for (const node of afterCompact) {
    if (node.parentId) continue;
    const gen = node.data?.generation;
    if (gen == null) continue;
    if (!genGroupsPost.has(gen)) genGroupsPost.set(gen, []);
    genGroupsPost.get(gen).push(node);
  }

  const xFixMap2 = new Map();
  for (const nodeList of genGroupsPost.values()) {
    const sorted2 = [...nodeList].sort((a, b) => a.position.x - b.position.x);
    let nextMinX = -Infinity;
    for (const node of sorted2) {
      const x = Math.max(node.position.x, nextMinX);
      if (x !== node.position.x) xFixMap2.set(node.id, x);
      nextMinX = x + getElkSize(node).width + H_GAP;
    }
  }

  const step6 = afterCompact.map((node) => {
    if (!xFixMap2.has(node.id)) return node;
    return { ...node, position: { ...node.position, x: xFixMap2.get(node.id) } };
  });

  // ⑦ 親の X 座標を子の重心に合わせる
  //    parentChild エッジを元に「親の代表ノード → 子の代表ノード一覧」を構築し、
  //    子の中心 X 平均（重心）に親を移動する。
  //    世代が深い親から処理することで、孫を持つ祖父母まで整合させる。
  const pos7 = new Map(step6.map((n) => [n.id, n]));

  const coupleToGroup7 = new Map();
  for (const n of step6) {
    if (n.type === 'couple' && n.parentId) coupleToGroup7.set(n.id, n.parentId);
  }

  // 親の代表 ID → 子の代表 ID セット
  const parentToChildReps7 = new Map();
  for (const edge of edges) {
    if (edge.type !== 'parentChild') continue;
    const parentRepId = coupleToGroup7.get(edge.source) ?? edge.source;
    const childNode = pos7.get(edge.target);
    if (!childNode) continue;
    const childRepId = childNode.parentId ?? edge.target;
    const childRepNode = pos7.get(childRepId);
    if (!childRepNode || childRepNode.parentId) continue;
    if (!parentToChildReps7.has(parentRepId)) parentToChildReps7.set(parentRepId, new Set());
    parentToChildReps7.get(parentRepId).add(childRepId);
  }

  // 世代の深い順（子孫側から先祖側へ）に処理する
  const parentsSortedByGenDesc = [...parentToChildReps7.keys()].sort((a, b) => {
    const ga = pos7.get(a)?.data?.generation ?? 0;
    const gb = pos7.get(b)?.data?.generation ?? 0;
    return gb - ga;
  });

  const parentAlignMap7 = new Map();
  for (const parentId of parentsSortedByGenDesc) {
    const childIdSet = parentToChildReps7.get(parentId);
    const parentNode = pos7.get(parentId);
    if (!parentNode) continue;

    const childCenters = [...childIdSet]
      .map((id) => pos7.get(id))
      .filter(Boolean)
      .map((n) => n.position.x + getElkSize(n).width / 2);
    if (childCenters.length === 0) continue;

    const centroid = childCenters.reduce((a, b) => a + b, 0) / childCenters.length;
    const newX = centroid - getElkSize(parentNode).width / 2;
    parentAlignMap7.set(parentId, newX);
    // pos7 を更新して上位世代の計算に反映させる
    pos7.set(parentId, { ...parentNode, position: { ...parentNode.position, x: newX } });
  }

  const afterParentAlign = step6.map((node) => {
    if (!parentAlignMap7.has(node.id)) return node;
    return { ...node, position: { ...node.position, x: parentAlignMap7.get(node.id) } };
  });

  // ⑧ 親整列後の X 重複を再解消
  const genGroupsFinal8 = new Map();
  for (const node of afterParentAlign) {
    if (node.parentId) continue;
    const gen = node.data?.generation;
    if (gen == null) continue;
    if (!genGroupsFinal8.has(gen)) genGroupsFinal8.set(gen, []);
    genGroupsFinal8.get(gen).push(node);
  }

  const xFixMap3 = new Map();
  for (const nodeList of genGroupsFinal8.values()) {
    const sorted3 = [...nodeList].sort((a, b) => a.position.x - b.position.x);
    let nextMinX = -Infinity;
    for (const node of sorted3) {
      const x = Math.max(node.position.x, nextMinX);
      if (x !== node.position.x) xFixMap3.set(node.id, x);
      nextMinX = x + getElkSize(node).width + H_GAP;
    }
  }

  return afterParentAlign.map((node) => {
    if (!xFixMap3.has(node.id)) return node;
    return { ...node, position: { ...node.position, x: xFixMap3.get(node.id) } };
  });
}
