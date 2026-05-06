import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

// 単体ノードのデフォルトサイズ（PersonNodeの minHeight に合わせる）
const NODE_SIZE = {
  person: { width: 80, height: 120 },
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
/**
 * @param {object[]} nodes
 * @param {object[]} edges
 * @param {string|null} priorityRootId
 *   指定した場合、そのノードを頂点とする子孫ツリーを
 *   ELK の children 配列の先頭に並べる（左側優先配置のヒントになる）。
 */
export async function applyElkLayout(nodes, edges, priorityRootId = null) {
  // ノードを素早く引けるようにマップ化
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // トップレベルノード（parentId なし）だけ ELK に渡す
  const topLevel = nodes.filter((n) => !n.parentId);

  // ── 優先ツリーの子孫セットを BFS で構築 ────────────────
  const prioritySet = new Set(); // トップレベルノードの ID のみ格納
  if (priorityRootId) {
    // couple ノード → 親グループ ID
    const coupleToGroupLocal = new Map();
    for (const n of nodes) {
      if (n.type === 'couple' && n.parentId) coupleToGroupLocal.set(n.id, n.parentId);
    }
    // parentChild エッジから 親ID → 子IDリスト
    const childrenMap = new Map();
    for (const edge of edges) {
      if (edge.type !== 'parentChild') continue;
      const pid = coupleToGroupLocal.get(edge.source) ?? edge.source;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid).push(edge.target);
    }
    // 選択ノードをトップレベルに解決してから BFS
    const prNode  = nodeMap.get(priorityRootId);
    const prTopId = prNode?.parentId ?? priorityRootId;
    const queue   = [prTopId];
    while (queue.length > 0) {
      const id = queue.shift();
      if (prioritySet.has(id)) continue;
      prioritySet.add(id);
      for (const childId of (childrenMap.get(id) ?? [])) {
        const cn      = nodeMap.get(childId);
        const topCId  = cn?.parentId ?? childId;
        if (!prioritySet.has(topCId)) queue.push(topCId);
      }
    }
  }

  // ELK に渡す順序のヒント:
  //   ① 優先ツリーのノードを先頭に（左側に配置されやすい）
  //   ② 同じグループ・同じ世代内では生年月順（若い順が左）
  const topLevelSorted = [...topLevel].sort((a, b) => {
    const ga = a.data?.generation ?? 0;
    const gb = b.data?.generation ?? 0;
    if (ga !== gb) return ga - gb;
    // 優先ツリー内を先に
    const ap = prioritySet.has(a.id) ? 0 : 1;
    const bp = prioritySet.has(b.id) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    // 同グループ内では生年月（若い順 = 左）
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

  // ⑤ 同じ親を持つ兄弟ノードを生年月順（早い順 = 右）に並べる
  //    ・X 座標の集合はそのまま保ち、順番だけを入れ替える。
  //    ・生年月不明のノードは末尾（左側）に回す。
  //    ・グループ内の person を子とする場合はグループを代表ノードとして扱う。
  const posMapFinal = new Map(afterXFix.map((n) => [n.id, n]));

  // couple ノード → 親グループ ID
  const coupleToGroupFinal = new Map();
  for (const n of afterXFix) {
    if (n.type === 'couple' && n.parentId) coupleToGroupFinal.set(n.id, n.parentId);
  }

  // parentChild エッジから 親ID → 兄弟情報リスト を構築
  const siblingGroups = new Map(); // parentId → [{repId, birthYear, birthMonth}]
  for (const edge of edges) {
    if (edge.type !== 'parentChild') continue;
    const parentId = coupleToGroupFinal.get(edge.source) ?? edge.source;
    const childNode = posMapFinal.get(edge.target);
    if (!childNode) continue;
    // グループ内の person はそのグループを位置の代表とする
    const repId   = childNode.parentId ?? edge.target;
    const repNode = posMapFinal.get(repId);
    // 代表ノードがトップレベルでなければスキップ
    if (!repNode || repNode.parentId) continue;

    if (!siblingGroups.has(parentId)) siblingGroups.set(parentId, []);
    siblingGroups.get(parentId).push({
      repId,
      birthYear:  childNode.data?.birthYear  ?? null,
      birthMonth: childNode.data?.birthMonth ?? null,
    });
  }

  const birthOrderMap = new Map(); // repId → 新 X

  for (const siblings of siblingGroups.values()) {
    if (siblings.length < 2) continue;

    // 同じ repId の重複を除去（同グループ内に複数の子がいるケース）
    const seen = new Set();
    const unique = siblings.filter((s) => {
      if (seen.has(s.repId)) return false;
      seen.add(s.repId);
      return true;
    });
    if (unique.length < 2) continue;

    // 現在の X 座標を降順ソート（大 = 右 が先頭）
    const xValues = unique
      .map((s) => posMapFinal.get(s.repId)?.position.x ?? 0)
      .sort((a, b) => b - a);

    // 生年月の昇順ソート（早い = 右 = xValues[0]）、不明は末尾（左）
    const sorted = [...unique].sort((a, b) => {
      const aKnown = a.birthYear != null;
      const bKnown = b.birthYear != null;
      if (!aKnown && !bKnown) return 0;
      if (!aKnown) return  1; // 不明は後ろ（左）
      if (!bKnown) return -1;
      if (a.birthYear !== b.birthYear) return a.birthYear - b.birthYear;
      return (a.birthMonth ?? 0) - (b.birthMonth ?? 0);
    });

    // ソート結果に従って X を割り当て
    sorted.forEach((sib, i) => {
      const currentX = posMapFinal.get(sib.repId)?.position.x ?? 0;
      if (xValues[i] !== currentX) birthOrderMap.set(sib.repId, xValues[i]);
    });
  }

  return afterXFix.map((node) => {
    if (!birthOrderMap.has(node.id)) return node;
    return { ...node, position: { ...node.position, x: birthOrderMap.get(node.id) } };
  });
}
