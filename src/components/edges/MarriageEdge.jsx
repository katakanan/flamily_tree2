import { BaseEdge, getStraightPath } from '@xyflow/react';

/**
 * 婚姻関係を示す二重線エッジ。
 * エッジの進行方向に対して垂直にオフセットした2本のパスを描画する。
 */

const LINE_GAP = 4; // 2本の線の間隔 (px)

export default function MarriageEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  style = {},
}) {
  const half = LINE_GAP / 2;

  const [path1] = getStraightPath({
    sourceX,
    sourceY: sourceY - half,
    targetX,
    targetY: targetY - half,
  });

  const [path2] = getStraightPath({
    sourceX,
    sourceY: sourceY + half,
    targetX,
    targetY: targetY + half,
  });

  const lineStyle = {
    stroke:      selected ? '#4a90d9' : '#444',
    strokeWidth: selected ? 2.5       : 1.5,
    fill: 'none',
    // 選択時: 点滅しない青グロー
    filter: selected ? 'drop-shadow(0 0 3px rgba(74,144,217,0.7))' : 'none',
    ...style,
  };

  return (
    <>
      <BaseEdge id={`${id}-a`} path={path1} style={lineStyle} />
      <BaseEdge id={`${id}-b`} path={path2} style={lineStyle} />
    </>
  );
}
