import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import PersonNode      from './nodes/PersonNode';
import CoupleNode      from './nodes/CoupleNode';
import GroupNode       from './nodes/GroupNode';
import MarriageEdge    from './edges/MarriageEdge';
import ParentChildEdge from './edges/ParentChildEdge';
import Sidebar         from './Sidebar';
import AddNodeDialog   from './AddNodeDialog';
import { initialNodes, initialEdges, MARRIAGE_GROUP, INNER } from '../data/familyData';
import { applyElkLayout }        from '../utils/elkLayout';
import { buildParentChildEdges } from '../utils/buildEdges';

// カスタムノードの登録
const nodeTypes = {
  person:        PersonNode,
  couple:        CoupleNode,
  marriageGroup: GroupNode,
};

// カスタムエッジの登録
const edgeTypes = {
  marriage:    MarriageEdge,
  parentChild: ParentChildEdge,
};

// 婚姻線 + data.children から自動生成した親子線を結合（モジュール初期化時に1度だけ実行）
const allEdges = [...initialEdges, ...buildParentChildEdges(initialNodes)];

// ── ハンバーガーボタンスタイル ────────────────────────
const hamStyle = {
  width: 38,
  height: 38,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 6,
  cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
  padding: 0,
};
const barStyle = {
  width: 18,
  height: 2,
  background: '#555',
  borderRadius: 1,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function FamilyTreeInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(allEdges);
  const [loading,        setLoading]        = useState(true);
  const importInputRef = useRef(null); // 隠しファイル入力（JSON インポート用）
  const [layouting,      setLayouting]      = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [dialogOpen,     setDialogOpen]     = useState(false);
  const { fitView, getNodes, getEdges } = useReactFlow();

  // 選択中ノード・エッジを取得
  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find(e => e.id === selectedEdgeId) ?? null;

  // ── ELK レイアウト実行 ────────────────────────────
  const runLayout = useCallback((targetNodes, targetEdges) => {
    setLayouting(true);
    applyElkLayout(targetNodes, targetEdges)
      .then((laidNodes) => {
        setNodes(laidNodes);
        setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 50);
      })
      .catch((err) => console.error('ELK レイアウトエラー:', err))
      .finally(() => { setLayouting(false); setLoading(false); });
  }, [setNodes, fitView]);

  // 初回マウント
  useEffect(() => { runLayout(initialNodes, allEdges); }, []);

  // ── JSON エクスポート ─────────────────────────────
  const handleExport = useCallback(() => {
    const data = JSON.stringify({ nodes: getNodes(), edges: getEdges() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `family-tree-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getNodes, getEdges]);

  // ── JSON インポート ─────────────────────────────
  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 同じファイルを再選択できるようリセット
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { nodes: importedNodes, edges: importedEdges } = JSON.parse(ev.target.result);
        if (!Array.isArray(importedNodes) || !Array.isArray(importedEdges)) {
          throw new Error('nodes / edges が配列ではありません');
        }
        setNodes(importedNodes);
        setEdges(importedEdges);
        setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 50);
      } catch (err) {
        alert(`インポートに失敗しました:\n${err.message}`);
      }
    };
    reader.readAsText(file);
  }, [setNodes, setEdges, fitView]);

  // 整列ボタン（通常）
  const handleRelayout = useCallback(() => {
    setNodes(cur => { runLayout(cur, edges); return cur; });
  }, [edges, runLayout]);

  // ── ノード選択 ───────────────────────────────────
  const onNodeClick = useCallback((_, node) => {
    if (node.type === 'couple') return;
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setSidebarOpen(true);
  }, []);

  // ── エッジ選択 ───────────────────────────────────
  const onEdgeClick = useCallback((_, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setSidebarOpen(true);
  }, []);

  // キャンバスクリックで選択解除
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // ── エッジ変更（婚姻エッジ削除 → グループ解体） ──────
  const handleEdgesChange = useCallback((changes) => {
    const currentEdges = getEdges();
    const currentNodes = getNodes();

    // couple ノード → 親グループ ID マップ（parentChild 親子同期に使用）
    const coupleToGroup = new Map();
    for (const n of currentNodes) {
      if (n.type === 'couple' && n.parentId) coupleToGroup.set(n.id, n.parentId);
    }

    // 削除対象を種別ごとに分類
    const removedEdges = changes
      .filter(c => c.type === 'remove')
      .map(c => currentEdges.find(e => e.id === c.id))
      .filter(Boolean);

    const removedMarriageIds    = new Set(removedEdges.filter(e => e.type === 'marriage').map(e => e.id));
    const removedParentChildEdges = removedEdges.filter(e => e.type === 'parentChild');

    // ── parentChild 削除 → data.children から除去 ──────────
    if (removedParentChildEdges.length > 0) {
      setNodes(nds => {
        let updated = nds;
        for (const edge of removedParentChildEdges) {
          const parentId = coupleToGroup.get(edge.source) ?? edge.source;
          updated = updated.map(n => {
            if (n.id !== parentId) return n;
            return {
              ...n,
              data: {
                ...n.data,
                children: (n.data.children ?? []).filter(c => c !== edge.target),
              },
            };
          });
        }
        return updated;
      });
    }

    // ── marriage 削除がなければここで終了 ────────────────
    if (removedMarriageIds.size === 0) {
      onEdgesChange(changes);
      return;
    }

    // 影響を受ける couple ノード ID を収集
    const affectedCoupleIds = new Set(
      [...removedMarriageIds]
        .map(id => currentEdges.find(e => e.id === id)?.target)
        .filter(Boolean)
    );

    let newNodes = [...currentNodes];
    const edgeIdsToRemove = new Set(removedMarriageIds);

    for (const coupleId of affectedCoupleIds) {
      const coupleNode = newNodes.find(n => n.id === coupleId);
      if (!coupleNode?.parentId) continue;

      const groupId  = coupleNode.parentId;
      const groupNode = newNodes.find(n => n.id === groupId);
      if (!groupNode) continue;

      // グループ内の person ノードを絶対座標で独立させる
      const personNodes = newNodes.filter(n => n.parentId === groupId && n.type === 'person');
      const restoredPersons = personNodes.map(p => {
        const absPos = p.internals?.positionAbsolute ?? {
          x: groupNode.position.x + p.position.x,
          y: groupNode.position.y + p.position.y,
        };
        const { pointerEvents: _pe, ...restStyle } = p.style ?? {};
        return {
          ...p,
          parentId: undefined,
          extent:   undefined,
          position: absPos,
          style:    Object.keys(restStyle).length > 0 ? restStyle : undefined,
        };
      });

      // グループ・couple を取り除き、復元した person を追加
      newNodes = [
        ...newNodes.filter(n => n.id !== groupId && n.id !== coupleId && n.parentId !== groupId),
        ...restoredPersons,
      ];

      // 関連エッジ（婚姻線・親子線）を削除対象に追加
      for (const e of currentEdges) {
        if (e.type === 'marriage'    && e.target === coupleId) edgeIdsToRemove.add(e.id);
        if (e.type === 'parentChild' && e.source === coupleId) edgeIdsToRemove.add(e.id);
      }
    }

    setNodes(newNodes);
    setEdges(currentEdges.filter(e => !edgeIdsToRemove.has(e.id)));

    // marriage 削除以外の変更（選択状態など）は通常処理へ
    const otherChanges = changes.filter(
      c => c.type !== 'remove' || !removedMarriageIds.has(c.id)
    );
    if (otherChanges.length > 0) onEdgesChange(otherChanges);
  }, [onEdgesChange, getEdges, getNodes, setNodes, setEdges]);

  // ── 婚姻グループ作成 ─────────────────────────────
  // 左右ハンドルを繋いだとき、両ノードをグループにまとめ couple ノードと婚姻エッジを生成する
  const handleCreateMarriageGroup = useCallback((sourceId, targetId) => {
    const currentNodes = getNodes();
    const sourceNode = currentNodes.find(n => n.id === sourceId);
    const targetNode = currentNodes.find(n => n.id === targetId);

    if (!sourceNode || !targetNode) return;

    // どちらかがすでにグループ内にある場合は拒否
    if (sourceNode.parentId || targetNode.parentId) {
      alert('すでに婚姻グループに属しているノードは婚姻関係を追加できません。');
      return;
    }

    // person ノード同士のみ許可
    if (sourceNode.type !== 'person' || targetNode.type !== 'person') return;

    // 性別で妻・夫を決定（同性の場合は source を妻側とする）
    const wifeNode =
      sourceNode.data.gender === 'female' ? sourceNode :
      targetNode.data.gender === 'female' ? targetNode :
      sourceNode;
    const husbandNode = wifeNode.id === sourceNode.id ? targetNode : sourceNode;

    const groupId  = `group-${wifeNode.id}-${husbandNode.id}`;
    const coupleId = `couple-${wifeNode.id}-${husbandNode.id}`;

    // グループを両ノードの中央に配置
    const cx = (wifeNode.position.x + husbandNode.position.x) / 2;
    const cy = (wifeNode.position.y + husbandNode.position.y) / 2;
    const groupPos = {
      x: cx - MARRIAGE_GROUP.WIDTH  / 2,
      y: cy - MARRIAGE_GROUP.HEIGHT / 2,
    };

    const generation = wifeNode.data.generation ?? husbandNode.data.generation ?? 0;

    const groupNode = {
      id:    groupId,
      type:  'marriageGroup',
      position: groupPos,
      style: { width: MARRIAGE_GROUP.WIDTH, height: MARRIAGE_GROUP.HEIGHT },
      data:  { generation, children: [] },
    };

    const coupleNode = {
      id:       coupleId,
      type:     'couple',
      parentId: groupId,
      extent:   'parent',
      position: { ...INNER.couple },
      data:     {},
      style:    { pointerEvents: 'none' },
    };

    const updatedWife = {
      ...wifeNode,
      parentId: groupId,
      extent:   'parent',
      position: { ...INNER.wife },
      style:    { ...(wifeNode.style ?? {}), pointerEvents: 'none' },
    };

    const updatedHusband = {
      ...husbandNode,
      parentId: groupId,
      extent:   'parent',
      position: { ...INNER.husband },
      style:    { ...(husbandNode.style ?? {}), pointerEvents: 'none' },
    };

    // 既存ノードから2人を除き、グループ・couple・更新済み2人を追加
    // ※ ReactFlow は親ノードが子より先に並んでいる必要がある
    const newNodes = [
      ...currentNodes.filter(n => n.id !== wifeNode.id && n.id !== husbandNode.id),
      groupNode,
      updatedWife,
      coupleNode,
      updatedHusband,
    ];

    setNodes(newNodes);

    // 婚姻エッジを追加（妻 right→couple left、夫 left→couple right）
    setEdges(eds => [
      ...eds,
      {
        id:           `e-${wifeNode.id}-${coupleId}`,
        source:       wifeNode.id,
        sourceHandle: 'right',
        target:       coupleId,
        targetHandle: 'left',
        type:         'marriage',
      },
      {
        id:           `e-${husbandNode.id}-${coupleId}`,
        source:       husbandNode.id,
        sourceHandle: 'left',
        target:       coupleId,
        targetHandle: 'right',
        type:         'marriage',
      },
    ]);
  }, [getNodes, setNodes, setEdges]);

  // ── エッジ接続 ───────────────────────────────────
  const onConnect = useCallback((params) => {
    const sh = params.sourceHandle;
    const th = params.targetHandle;

    // 左右ハンドル → 婚姻グループを作成
    if (sh === 'left' || sh === 'right') {
      handleCreateMarriageGroup(params.source, params.target);
      return;
    }

    // bottom→top → parentChild
    if (sh === 'bottom' && th === 'top') {
      setEdges(eds => addEdge({
        ...params,
        id:    `e-${params.source}-${params.target}-${Date.now()}`,
        type:  'parentChild',
        style: { strokeWidth: 2 },
      }, eds));

      // 親ノードの data.children に追加（couple → 親グループ、person → 直接）
      const currentNodes = getNodes();
      const coupleToGroup = new Map();
      for (const n of currentNodes) {
        if (n.type === 'couple' && n.parentId) coupleToGroup.set(n.id, n.parentId);
      }
      const parentId = coupleToGroup.get(params.source) ?? params.source;
      setNodes(nds => nds.map(n => {
        if (n.id !== parentId) return n;
        const children = n.data.children ?? [];
        if (children.includes(params.target)) return n;
        return { ...n, data: { ...n.data, children: [...children, params.target] } };
      }));
      return;
    }

    // それ以外 → default エッジ
    setEdges(eds => addEdge({
      ...params,
      id:    `e-${params.source}-${sh}-${params.target}-${Date.now()}`,
      type:  'default',
      style: { strokeWidth: 2 },
    }, eds));
  }, [setEdges, setNodes, getNodes, handleCreateMarriageGroup]);

  // ── ノードデータ更新 ─────────────────────────────
  // children が変わったとき parentChild エッジを再生成する
  // marriageGroup: couple ノード経由、person（単独）: 直接接続
  const handleNodeUpdate = useCallback((nodeId, newData) => {
    const currentNodes = getNodes();
    const node = currentNodes.find(n => n.id === nodeId);

    if (node?.type === 'marriageGroup') {
      // グループ本体の更新 + 世代変更時は内部の夫婦 person にも伝播（1回の setNodes で処理）
      const newGen = newData.generation;
      const genChanged = newGen !== node.data.generation;
      setNodes(nds => nds.map(n => {
        if (n.id === nodeId) return { ...n, data: newData };
        if (genChanged && n.parentId === nodeId && n.type === 'person')
          return { ...n, data: { ...n.data, generation: newGen } };
        return n;
      }));

      const coupleNode = currentNodes.find(
        n => n.parentId === nodeId && n.type === 'couple'
      );
      if (coupleNode) {
        const newChildren = newData.children ?? [];
        setEdges(eds => [
          ...eds.filter(e => !(e.source === coupleNode.id && e.type === 'parentChild')),
          ...newChildren.map(childId => ({
            id:           `e-${coupleNode.id}-${childId}`,
            source:       coupleNode.id,
            sourceHandle: 'bottom',
            target:       childId,
            targetHandle: 'top',
            type:         'parentChild',
            style:        { strokeWidth: 2 },
          })),
        ]);
      }
    } else {
      // person など（グループ外）: 通常の更新
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: newData } : n));
    }

    if (node?.type === 'person' && !node.parentId) {
      // 単独 person ノード: 子エッジを再生成
      const newChildren = newData.children ?? [];
      setEdges(eds => [
        ...eds.filter(e => !(e.source === nodeId && e.type === 'parentChild')),
        ...newChildren.map(childId => ({
          id:           `e-${nodeId}-${childId}`,
          source:       nodeId,
          sourceHandle: 'bottom',
          target:       childId,
          targetHandle: 'top',
          type:         'parentChild',
          style:        { strokeWidth: 2 },
        })),
      ]);
    }
  }, [setNodes, setEdges, getNodes]);

  // ── 世代伝播 ─────────────────────────────────────
  // 選択ノードの世代を基準に、親子エッジを BFS でたどって
  // 子ノードは +1、親ノードは -1 で世代を更新する。
  const handlePropagateGeneration = useCallback(() => {
    if (!selectedNode) return;

    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const nodeMap = new Map(currentNodes.map(n => [n.id, n]));

    // couple ノード → 親グループ ID のマップ
    const coupleToGroup = new Map();
    for (const n of currentNodes) {
      if (n.type === 'couple' && n.parentId) coupleToGroup.set(n.id, n.parentId);
    }

    // parentChild エッジから「ツリー上の親子関係」を構築
    // parentOf : 子ノードID → 親ID（グループ or 単独 person）
    // childrenOf: 親ID      → 子ノードID[]
    const parentOf   = new Map();
    const childrenOf = new Map();
    for (const edge of currentEdges) {
      if (edge.type !== 'parentChild') continue;
      // couple ノード経由なら親グループID、それ以外は単独 person ID をそのまま使う
      const sourceId = coupleToGroup.get(edge.source) ?? edge.source;
      parentOf.set(edge.target, sourceId);
      if (!childrenOf.has(sourceId)) childrenOf.set(sourceId, []);
      childrenOf.get(sourceId).push(edge.target);
    }

    // nodeId をツリーノード（グループ内 person → その親グループ）に解決
    const toTree = (id) => {
      const n = nodeMap.get(id);
      return (n?.type === 'person' && n.parentId) ? n.parentId : id;
    };

    // 開始ノードと世代
    const startId  = toTree(selectedNode.id);
    const startGen = (nodeMap.get(startId)?.data?.generation)
                  ?? selectedNode.data?.generation
                  ?? 0;

    // BFS でツリー全体を伝播
    const genMap  = new Map(); // ツリーノードID → 新世代
    const visited = new Set();
    const queue   = [{ id: startId, gen: startGen }];

    while (queue.length > 0) {
      const { id, gen } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      genMap.set(id, gen);

      const node = nodeMap.get(id);

      // 子へ（+1）
      for (const childId of (childrenOf.get(id) ?? [])) {
        const treeChild = toTree(childId);
        if (!visited.has(treeChild)) queue.push({ id: treeChild, gen: gen + 1 });
      }

      // 親へ（-1）: グループなら内部の person の parentOf を参照
      if (node?.type === 'marriageGroup') {
        for (const n of currentNodes) {
          if (n.parentId === id && n.type === 'person') {
            const pg = parentOf.get(n.id);
            if (pg && !visited.has(pg)) queue.push({ id: pg, gen: gen - 1 });
          }
        }
      } else if (node?.type === 'person') {
        const pg = parentOf.get(id);
        if (pg && !visited.has(pg)) queue.push({ id: pg, gen: gen - 1 });
      }
    }

    // 世代を更新: グループ本体 + グループ内 person、スタンドアロン person
    setNodes(nds => nds.map(n => {
      if (genMap.has(n.id)) {
        return { ...n, data: { ...n.data, generation: genMap.get(n.id) } };
      }
      // グループ内 person はグループの世代を継承
      if (n.parentId && n.type === 'person' && genMap.has(n.parentId)) {
        return { ...n, data: { ...n.data, generation: genMap.get(n.parentId) } };
      }
      return n;
    }));
  }, [selectedNode, getNodes, getEdges, setNodes]);

  // ── ノード追加 ───────────────────────────────────
  const handleAddNode = useCallback((nodeData) => {
    const newNode = {
      id:   nodeData.id,
      type: 'person',
      data: {
        name:        nodeData.name,
        gender:      nodeData.gender,
        generation:  nodeData.generation,
        description: nodeData.description,
      },
      position: {
        x: 80 + Math.random() * 300,
        y: 80 + Math.random() * 200,
      },
    };
    setNodes(nds => [...nds, newNode]);
    setDialogOpen(false);
  }, [setNodes]);

  // ── ローディング画面 ─────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontSize: 16, color: '#666',
      }}>
        レイアウトを計算中...
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        connectionMode="loose"
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={3}
        nodesDraggable={true}
      >
        <Background color="#ddd" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'couple') return 'transparent';
            const g = n.data?.gender;
            if (g === 'female') return '#f5b8cc';
            if (g === 'male')   return '#b8d4f5';
            return '#d4c0f5';
          }}
        />

        {/* 自動整列 / ノード追加 / Import・Export ボタン（左上） */}
        <Panel position="top-left">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={handleRelayout}
              disabled={layouting}
              style={{
                padding: '8px 16px', fontSize: 14, fontFamily: 'inherit',
                background: layouting ? '#aaa' : '#4a90d9',
                color: '#fff', border: 'none', borderRadius: 6,
                cursor: layouting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
            >
              {layouting ? '整列中...' : '⟳ 自動整列'}
            </button>
            <button
              onClick={() => setDialogOpen(true)}
              style={{
                padding: '8px 16px', fontSize: 14, fontFamily: 'inherit',
                background: '#fff', color: '#333',
                border: '1px solid #ddd', borderRadius: 6,
                cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              }}
            >
              ＋ ノード追加
            </button>

            {/* 区切り線 */}
            <div style={{ borderTop: '1px solid #ddd', margin: '2px 0' }} />

            {/* エクスポート */}
            <button
              onClick={handleExport}
              style={{
                padding: '8px 16px', fontSize: 14, fontFamily: 'inherit',
                background: '#fff', color: '#333',
                border: '1px solid #ddd', borderRadius: 6,
                cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              }}
            >
              ↓ エクスポート
            </button>

            {/* インポート（隠し input をトリガー） */}
            <button
              onClick={() => importInputRef.current?.click()}
              style={{
                padding: '8px 16px', fontSize: 14, fontFamily: 'inherit',
                background: '#fff', color: '#333',
                border: '1px solid #ddd', borderRadius: 6,
                cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              }}
            >
              ↑ インポート
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>
        </Panel>

        {/* ハンバーガーボタン（右上） */}
        <Panel position="top-right">
          <button
            style={hamStyle}
            onClick={() => setSidebarOpen(o => !o)}
            title="プロパティパネル"
          >
            <div style={barStyle} />
            <div style={barStyle} />
            <div style={barStyle} />
          </button>
        </Panel>
      </ReactFlow>

      {/* プロパティサイドバー */}
      <Sidebar
        open={sidebarOpen}
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        allNodes={nodes}
        onClose={() => setSidebarOpen(false)}
        onUpdate={handleNodeUpdate}
        onPropagateGeneration={handlePropagateGeneration}
      />

      {/* ノード追加ダイアログ */}
      {dialogOpen && (
        <AddNodeDialog
          existingIds={nodes.map(n => n.id)}
          onConfirm={handleAddNode}
          onCancel={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function FamilyTree() {
  return (
    <ReactFlowProvider>
      <FamilyTreeInner />
    </ReactFlowProvider>
  );
}
