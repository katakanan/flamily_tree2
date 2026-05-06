import { Handle, Position } from '@xyflow/react';

/**
 * 婚姻の分岐点ノード（不可視）。
 *
 * 視覚的には何も表示しない 1×1 の透明な点。
 * 左右ポートで夫婦の婚姻線を受け取り、
 * 下ポートから親子線を分岐させる。
 *
 * エッジの接続先として構造的に必要なため
 * ノード自体は残すが、画面には表示しない。
 */

// 不可視ハンドルスタイル（位置情報のみ保持）
const hiddenHandle = {
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
};

export default function CoupleNode() {
  return (
    <div style={{ width: 1, height: 1, background: 'transparent' }}>
      {/* 妻からの婚姻線を受ける */}
      <Handle type="target" position={Position.Left}   id="left"   style={hiddenHandle} />
      {/* 夫からの婚姻線を受ける */}
      <Handle type="target" position={Position.Right}  id="right"  style={hiddenHandle} />
      {/* 子への親子線を出す */}
      <Handle type="source" position={Position.Bottom} id="bottom" style={hiddenHandle} />
    </div>
  );
}
