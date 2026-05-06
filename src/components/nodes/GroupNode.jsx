import { Handle, Position, useReactFlow } from '@xyflow/react';

/**
 * 婚姻グループのコンテナノード。
 * ポート（黒点）は表示しない。
 * ハンドルは構造的に必要なため不可視で残す。
 * 選択時: 夫婦の左右入れ替えボタンを表示する。
 */

const hiddenHandle = {
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  pointerEvents: 'all',
};

export default function GroupNode({ id, selected }) {
  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

  const handleSwap = (e) => {
    e.stopPropagation();

    const allNodes = getNodes();
    const persons = allNodes.filter(n => n.parentId === id && n.type === 'person');
    if (persons.length !== 2) return;

    const [p1, p2] = persons;

    // 2人の位置を入れ替える
    setNodes(nds => nds.map(n => {
      if (n.id === p1.id) return { ...n, position: { ...p2.position } };
      if (n.id === p2.id) return { ...n, position: { ...p1.position } };
      return n;
    }));

    // 婚姻エッジのハンドル (left ↔ right) も入れ替えて向きを正す
    setEdges(eds => eds.map(e => {
      if (e.type !== 'marriage') return e;
      if (e.source !== p1.id && e.source !== p2.id) return e;
      return {
        ...e,
        sourceHandle: e.sourceHandle === 'left' ? 'right' : 'left',
        targetHandle: e.targetHandle === 'left' ? 'right' : 'left',
      };
    }));
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 8,
        border: selected ? '2px solid #4a90d9' : '1.5px dashed #b0b0b0',
        background: selected
          ? 'rgba(74,144,217,0.06)'
          : 'rgba(245,245,245,0.5)',
        boxShadow: selected ? '0 0 0 4px rgba(74,144,217,0.2)' : 'none',
        transition: 'border 0.15s, box-shadow 0.15s, background 0.15s',
        pointerEvents: 'none',
        position: 'relative',
      }}
    >
      {/* 左右入れ替えボタン（選択時のみ） */}
      {selected && (
        <button
          onClick={handleSwap}
          title="夫婦の左右を入れ替え"
          style={{
            position: 'absolute',
            top: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'all',
            background: '#4a90d9',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '2px 10px',
            fontSize: 14,
            cursor: 'pointer',
            lineHeight: 1.6,
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            zIndex: 10,
          }}
        >
          ⇄
        </button>
      )}

      <Handle type="target" position={Position.Top}    id="top"    style={hiddenHandle} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={hiddenHandle} />
    </div>
  );
}
