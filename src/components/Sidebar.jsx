import { useState, useEffect } from 'react';

/**
 * プロパティサイドバー
 *
 * ノードが選択されると各プロパティを表示・編集できる。
 * open=true のとき右からスライドイン。
 *
 * 対応ノード種別:
 *   person        → ID（読取専用）・名前・性別・世代・説明を編集
 *   marriageGroup → ID（読取専用）・世代・子ノード追加/削除・配偶者セクション
 *   couple        → 内部ノードのため非表示
 */

const W = 300; // サイドバー幅 (px)

// ── スタイル定数 ─────────────────────────────────────
const s = {
  panel: (open) => ({
    position: 'fixed',
    top: 0,
    right: 0,
    width: W,
    height: '100vh',
    background: '#fff',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
    transform: open ? 'translateX(0)' : `translateX(${W}px)`,
    transition: 'transform 0.25s ease',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'inherit',
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid #e8e8e8',
    background: '#fafafa',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    color: '#888',
    padding: '2px 6px',
    borderRadius: 4,
    lineHeight: 1,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  empty: {
    color: '#bbb',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 48,
    lineHeight: 1.8,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 10,
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #efefef',
    margin: '16px 0',
  },
  fieldLabel: {
    display: 'block',
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    width: '100%',
    padding: '7px 9px',
    border: '1px solid #ddd',
    borderRadius: 5,
    fontSize: 13,
    color: '#333',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
  },
  inputReadonly: {
    width: '100%',
    padding: '7px 9px',
    border: '1px solid #eee',
    borderRadius: 5,
    fontSize: 13,
    color: '#888',
    background: '#f5f5f5',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  select: {
    width: '100%',
    padding: '7px 9px',
    border: '1px solid #ddd',
    borderRadius: 5,
    fontSize: 13,
    color: '#333',
    boxSizing: 'border-box',
    background: '#fff',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    padding: '7px 9px',
    border: '1px solid #ddd',
    borderRadius: 5,
    fontSize: 12,
    color: '#333',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: 64,
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  badge: {
    display: 'inline-block',
    background: '#e8f0fe',
    color: '#4070c0',
    borderRadius: 3,
    fontSize: 10,
    padding: '1px 5px',
    marginLeft: 6,
  },
};

// 子ノード chip スタイル（性別ごとに色を変える）
const chipColors = {
  female: { background: '#fde8f0', border: '1px solid #f5b8cc', color: '#804060' },
  male:   { background: '#e8f0fd', border: '1px solid #b8cef5', color: '#304070' },
  child:  { background: '#f0ebff', border: '1px solid #c8b8f5', color: '#443366' },
};

const chipStyleBase = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  borderRadius: 4,
  marginBottom: 5,
  fontSize: 12,
};

const chipRemoveBtn = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#aaa',
  fontSize: 15,
  lineHeight: 1,
  padding: '0 2px',
  marginLeft: 'auto',
  flexShrink: 0,
};

// ── ChildrenEditor ────────────────────────────────────
// 婚姻グループの子ノードをドロップダウンで追加/削除
function ChildrenEditor({ node, allNodes, onUpdate }) {
  const [selectId, setSelectId] = useState('');

  // ノードが切り替わったらセレクトをリセット
  useEffect(() => { setSelectId(''); }, [node.id]);

  const children = node.data.children ?? [];

  // 候補: person または marriageGroup のうちまだ children に含まれていないもの
  //       自グループの内部ノード（parentId = node.id）は除外
  const candidates = allNodes.filter(n =>
    (n.type === 'person' || n.type === 'marriageGroup') &&
    n.parentId !== node.id &&
    n.id !== node.id &&
    !children.includes(n.id)
  );

  const handleAdd = () => {
    if (!selectId) return;
    onUpdate(node.id, { ...node.data, children: [...children, selectId] });
    setSelectId('');
  };

  const handleRemove = (id) => {
    onUpdate(node.id, { ...node.data, children: children.filter(c => c !== id) });
  };

  return (
    <div>
      {/* 登録済み子ノード */}
      {children.length === 0 && (
        <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>なし</div>
      )}
      {children.map(id => {
        const child = allNodes.find(n => n.id === id);
        const gender = child?.data?.gender ?? 'child';
        const colors = chipColors[gender] ?? chipColors.child;
        const label = child
          ? `${child.data.name || id}`
          : `${id} (不明)`;
        return (
          <div key={id} style={{ ...chipStyleBase, ...colors }}>
            <span style={{ flex: 1 }}>{label}</span>
            <button style={chipRemoveBtn} onClick={() => handleRemove(id)} title="削除">×</button>
          </div>
        );
      })}

      {/* 追加UI */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <select
          style={{ ...s.select, flex: 1, fontSize: 12 }}
          value={selectId}
          onChange={e => setSelectId(e.target.value)}
        >
          <option value="">-- ノードを選択 --</option>
          {candidates.map(n => (
            <option key={n.id} value={n.id}>
              {n.id}{n.data.name ? ` (${n.data.name})` : ''}
            </option>
          ))}
        </select>
        <button
          style={{
            padding: '6px 10px',
            fontSize: 12,
            border: 'none',
            borderRadius: 5,
            background: selectId ? '#4a90d9' : '#ddd',
            color: selectId ? '#fff' : '#aaa',
            cursor: selectId ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
          disabled={!selectId}
          onClick={handleAdd}
        >
          追加
        </button>
      </div>
    </div>
  );
}

// ── PersonForm ────────────────────────────────────────
function PersonForm({ node, onUpdate, allNodes, showChildren }) {
  const d = node.data;
  const set = (key, val) => onUpdate(node.id, { ...d, [key]: val });

  return (
    <div>
      <label style={s.fieldLabel}>ID</label>
      <input style={s.inputReadonly} value={node.id} readOnly />

      <label style={s.fieldLabel}>名前</label>
      <input
        style={s.input}
        value={d.name ?? ''}
        onChange={e => set('name', e.target.value)}
      />

      <label style={s.fieldLabel}>性別</label>
      <select
        style={s.select}
        value={d.gender ?? 'male'}
        onChange={e => set('gender', e.target.value)}
      >
        <option value="female">女性</option>
        <option value="male">男性</option>
        <option value="child">その他</option>
      </select>

      <label style={s.fieldLabel}>世代</label>
      <input
        style={s.input}
        type="number"
        value={d.generation ?? ''}
        onChange={e => set('generation', Number(e.target.value))}
      />

      <label style={s.fieldLabel}>生まれ年</label>
      <input
        style={s.input}
        type="number"
        min="1"
        placeholder="例: 1922"
        value={d.birthYear ?? ''}
        onChange={e => {
          const val = e.target.value === '' ? undefined : Number(e.target.value);
          set('birthYear', val);
        }}
      />

      <label style={s.fieldLabel}>生まれ月</label>
      <select
        style={s.select}
        value={d.birthMonth ?? ''}
        onChange={e => {
          const val = e.target.value === '' ? undefined : Number(e.target.value);
          set('birthMonth', val);
        }}
      >
        <option value="">不明</option>
        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
          <option key={m} value={m}>{m}月</option>
        ))}
      </select>

      <label style={s.fieldLabel}>説明</label>
      <textarea
        style={s.textarea}
        value={d.description ?? ''}
        placeholder="説明を入力..."
        onChange={e => set('description', e.target.value)}
      />

      {/* 単独ノード（グループ外）のみ子ノード編集を表示 */}
      {showChildren && (
        <>
          <div style={{ ...s.sectionLabel, marginTop: 16 }}>子ノード</div>
          <ChildrenEditor node={node} allNodes={allNodes} onUpdate={onUpdate} />
        </>
      )}
    </div>
  );
}

// ── EdgeInfo: エッジプロパティ表示 ───────────────────
const EDGE_TYPE_LABEL = {
  marriage:    '婚姻',
  parentChild: '親子',
  default:     '標準',
};

const HANDLE_LABEL = {
  top:    '上',
  bottom: '下',
  left:   '左',
  right:  '右',
};

function EdgeInfo({ edge, allNodes }) {
  const srcNode = allNodes.find(n => n.id === edge.source);
  const tgtNode = allNodes.find(n => n.id === edge.target);

  const nodeName = (node, id) =>
    node ? `${id}${node.data?.name ? ` (${node.data.name})` : ''}` : id;

  const rows = [
    ['ID',         edge.id],
    ['種別',       EDGE_TYPE_LABEL[edge.type] ?? edge.type ?? '—'],
    ['ソース',     nodeName(srcNode, edge.source)],
    ['ソース側',   HANDLE_LABEL[edge.sourceHandle] ?? edge.sourceHandle ?? '—'],
    ['ターゲット', nodeName(tgtNode, edge.target)],
    ['ターゲット側', HANDLE_LABEL[edge.targetHandle] ?? edge.targetHandle ?? '—'],
  ];

  return (
    <div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={s.fieldLabel}>{label}</div>
          <input style={s.inputReadonly} value={value} readOnly />
        </div>
      ))}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────
export default function Sidebar({ open, selectedNode, selectedEdge, allNodes, onClose, onUpdate, onPropagateGeneration }) {
  const spouseNodes = selectedNode?.type === 'marriageGroup'
    ? [...allNodes.filter(n => n.parentId === selectedNode.id && n.type === 'person')]
        .sort((a, b) => (a.data.gender === 'female' ? -1 : 1))
    : [];

  const typeLabel =
    selectedEdge                            ? (EDGE_TYPE_LABEL[selectedEdge.type] ?? 'エッジ') + 'エッジ' :
    selectedNode?.type === 'person'        ? '人物' :
    selectedNode?.type === 'marriageGroup'  ? '婚姻グループ' : '';

  return (
    <div style={s.panel(open)}>
      {/* ── ヘッダー ──────────────────────── */}
      <div style={s.header}>
        <span style={s.headerTitle}>
          {selectedNode ? `プロパティ — ${typeLabel}` : 'プロパティ'}
        </span>
        <button style={s.closeBtn} onClick={onClose} title="閉じる">×</button>
      </div>

      {/* ── ボディ ────────────────────────── */}
      <div style={s.body}>

        {/* 未選択時 */}
        {!selectedNode && !selectedEdge && (
          <p style={s.empty}>ノードまたはエッジをクリックすると<br />プロパティを表示します</p>
        )}

        {/* エッジ */}
        {selectedEdge && (
          <div style={s.section}>
            <div style={s.sectionLabel}>エッジ情報</div>
            <EdgeInfo edge={selectedEdge} allNodes={allNodes} />
          </div>
        )}

        {/* 人物ノード */}
        {selectedNode?.type === 'person' && (
          <div style={s.section}>
            <div style={s.sectionLabel}>人物情報</div>
            <PersonForm
              node={selectedNode}
              onUpdate={onUpdate}
              allNodes={allNodes}
              showChildren={!selectedNode.parentId}
            />
          </div>
        )}

        {/* 世代伝播ボタン（person / marriageGroup 選択時） */}
        {(selectedNode?.type === 'person' || selectedNode?.type === 'marriageGroup') && (
          <>
            <hr style={s.divider} />
            <div style={s.section}>
              <div style={s.sectionLabel}>世代操作</div>
              <button
                onClick={onPropagateGeneration}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  background: '#4a90d9',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 5,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                ↕ 世代を伝播
              </button>
              <div style={{ fontSize: 11, color: '#999', marginTop: 6, lineHeight: 1.6 }}>
                選択ノードの世代を基準に<br />
                子ノード +1、親ノード −1 で更新します
              </div>

            </div>
          </>
        )}

        {/* 婚姻グループ */}
        {selectedNode?.type === 'marriageGroup' && (
          <>
            {/* グループ設定 */}
            <div style={s.section}>
              <div style={s.sectionLabel}>グループ設定</div>
              <label style={s.fieldLabel}>ID</label>
              <input style={s.inputReadonly} value={selectedNode.id} readOnly />

              <label style={s.fieldLabel}>世代</label>
              <input
                style={s.input}
                type="number"
                value={selectedNode.data.generation ?? ''}
                onChange={e =>
                  onUpdate(selectedNode.id, {
                    ...selectedNode.data,
                    generation: Number(e.target.value),
                  })
                }
              />
            </div>

            <hr style={s.divider} />

            {/* 配偶者セクション */}
            {spouseNodes.map((sp, i) => (
              <div key={sp.id}>
                <div style={s.section}>
                  <div style={s.sectionLabel}>
                    {sp.data.gender === 'female' ? '妻' : '夫'}
                    <span style={s.badge}>{sp.data.name}</span>
                  </div>
                  <PersonForm node={sp} onUpdate={onUpdate} />
                </div>
                {i < spouseNodes.length - 1 && <hr style={s.divider} />}
              </div>
            ))}

            <hr style={s.divider} />

            {/* 子ノード追加/削除 */}
            <div style={s.section}>
              <div style={s.sectionLabel}>子ノード</div>
              <ChildrenEditor
                node={selectedNode}
                allNodes={allNodes}
                onUpdate={onUpdate}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
