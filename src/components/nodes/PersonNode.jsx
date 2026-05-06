import { Handle, Position } from '@xyflow/react';

const GENDER_STYLE = {
  female: { background: '#f5b8cc', border: '2px solid #c06080' },
  male:   { background: '#b8d4f5', border: '2px solid #4070b8' },
  child:  { background: '#d4c0f5', border: '2px solid #7060b8' },
};

// 4方向ポートの共通スタイル（黒い点）
const port = {
  width: 8,
  height: 8,
  background: '#111',
  border: '1.5px solid #fff',
  borderRadius: '50%',
};

export default function PersonNode({ data, selected }) {
  const style = GENDER_STYLE[data.gender] ?? GENDER_STYLE.child;

  return (
    <div
      style={{
        width: 68,
        minHeight: 168,
        ...style,
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        userSelect: 'none',
        cursor: 'default',
        // 選択時: 青いアウトラインとグロー
        outline: selected ? '2.5px solid #4a90d9' : '2.5px solid transparent',
        outlineOffset: 2,
        boxShadow: selected ? '0 0 0 4px rgba(74,144,217,0.25)' : 'none',
        transition: 'outline 0.15s, box-shadow 0.15s',
      }}
    >
      {/* ── ポート（4方向） ─────────────────── */}
      <Handle type="target" position={Position.Top}    id="top"    style={port} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={port} />
      <Handle type="source" position={Position.Left}   id="left"   style={port} />
      <Handle type="source" position={Position.Right}  id="right"  style={port} />

      {/* ── 世代バッジ（右上） ──────────────── */}
      {data.generation !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: 3,
            right: 4,
            fontSize: 9,
            fontWeight: 'normal',
            color: '#555',
            background: 'rgba(255,255,255,0.65)',
            borderRadius: 3,
            padding: '1px 3px',
            lineHeight: 1.2,
          }}
        >
          {data.generation}世
        </div>
      )}

      {/* ── 名前（縦書き） ───────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          writingMode: 'vertical-rl',
          textOrientation: 'upright',
          fontSize: 16,
          fontWeight: 'bold',
          padding: '12px 0',
        }}
      >
        {data.name}
      </div>

      {/* ── 生まれ年（下部） ─────────────────── */}
      {data.birthYear != null && (
        <div
          style={{
            fontSize: 9,
            color: '#666',
            background: 'rgba(255,255,255,0.6)',
            borderRadius: '0 0 4px 4px',
            padding: '2px 0',
            width: '100%',
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          {data.birthYear}年
          {data.birthMonth != null ? `${data.birthMonth}月` : ''}
        </div>
      )}
    </div>
  );
}
