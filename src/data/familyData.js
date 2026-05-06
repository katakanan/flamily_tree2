/**
 * サザエさん一家の家系図データ
 *
 * ── ノードプロパティ ───────────────────────────────────
 *   PersonNode (type: 'person')
 *     data.name        : 表示名
 *     data.gender      : 'male' | 'female' | 'child'
 *     data.generation  : 世代番号（0 が最上位）
 *     data.description : 説明文（省略可）
 *
 *   MarriageGroup (type: 'marriageGroup')
 *     data.generation  : 世代番号（ELK 層配置に使用）
 *     data.children    : 子ノード ID の配列
 *                        person ID または marriageGroup ID を指定。
 *                        buildParentChildEdges() がこの配列から
 *                        親子エッジを自動生成する。
 *
 * ── エッジ ────────────────────────────────────────────
 *   initialEdges には婚姻線（type: 'marriage'）のみ定義する。
 *   親子線は buildParentChildEdges(initialNodes) で自動生成する。
 *
 * ── グループ内部レイアウト ────────────────────────────
 *   wife  x=0   （左端）
 *   couple x=107 （妻右端 80 と夫左端 134 の中点、1×1 不可視ノード）
 *   husband x=134
 *   グループ高さ: 120px（説明文の表示領域を含む）
 */

export const MARRIAGE_GROUP = {
  WIDTH:  186,  // wife(68) + gap(50) + husband(68)
  HEIGHT: 168,  // person minHeight
};

export const INNER = {
  wife:    { x: 0,   y: 0    },
  couple:  { x: 93,  y: 83.5 },  // (186-1)/2=92.5≈93, (168-1)/2=83.5
  husband: { x: 118, y: 0    },  // wife(68) + gap(50)
};

const groupStyle   = { width: MARRIAGE_GROUP.WIDTH, height: MARRIAGE_GROUP.HEIGHT };
const innerProps   = { extent: 'parent', style: { pointerEvents: 'none' } };

// ─────────────────────────────────────────────────────
export const initialNodes = [

  // ══════════════════════════════════════════
  // 世代 0: 磯野波平 & 磯野舟
  // ══════════════════════════════════════════
  {
    id: 'group-namihei-fune',
    type: 'marriageGroup',
    data: {
      generation: 0,
      children: ['sazae', 'katsuo', 'wakame'],
    },
    position: { x: 0, y: 0 },
    style: groupStyle,
  },
  {
    id: 'fune',
    type: 'person',
    data: {
      name: '舟',
      gender: 'female',
      generation: 0,
      description: '波平の妻。磯野家を切り盛りする。',
    },
    position: INNER.wife,
    parentId: 'group-namihei-fune',
    ...innerProps,
  },
  {
    id: 'couple-namihei-fune',
    type: 'couple',
    data: {},
    position: INNER.couple,
    parentId: 'group-namihei-fune',
    ...innerProps,
  },
  {
    id: 'namihei',
    type: 'person',
    data: {
      name: '波平',
      gender: 'male',
      generation: 0,
      description: '磯野家の家長。海産物問屋勤務。',
      birthYear: 1892, birthMonth: 1,
    },
    position: INNER.husband,
    parentId: 'group-namihei-fune',
    ...innerProps,
  },

  // ══════════════════════════════════════════
  // 世代 1: フグ田サザエ & フグ田マスオ
  // ══════════════════════════════════════════
  {
    id: 'group-sazae-masuo',
    type: 'marriageGroup',
    data: {
      generation: 1,
      children: ['tarao'],
    },
    position: { x: 0, y: 0 },
    style: groupStyle,
  },
  {
    id: 'sazae',
    type: 'person',
    data: {
      name: 'サザエ',
      gender: 'female',
      generation: 1,
      description: '磯野家の長女。明るく活発。',
      birthYear: 1922, birthMonth: 1,
    },
    position: INNER.wife,
    parentId: 'group-sazae-masuo',
    ...innerProps,
  },
  {
    id: 'couple-sazae-masuo',
    type: 'couple',
    data: {},
    position: INNER.couple,
    parentId: 'group-sazae-masuo',
    ...innerProps,
  },
  {
    id: 'masuo',
    type: 'person',
    data: {
      name: 'マスオ',
      gender: 'male',
      generation: 1,
      description: 'サザエの夫。磯野家に婿入り。',
      birthYear: 1918, birthMonth: 1,
    },
    position: INNER.husband,
    parentId: 'group-sazae-masuo',
    ...innerProps,
  },

  // ══════════════════════════════════════════
  // 世代 1: 磯野カツオ（独身）
  // ══════════════════════════════════════════
  {
    id: 'katsuo',
    type: 'person',
    data: {
      name: 'カツオ',
      gender: 'male',
      generation: 1,
      description: '磯野家の長男。やんちゃな小学生。',
      birthYear: 1935, birthMonth: 1,
    },
    position: { x: 0, y: 0 },
  },

  // ══════════════════════════════════════════
  // 世代 1: 磯野ワカメ（独身）
  // ══════════════════════════════════════════
  {
    id: 'wakame',
    type: 'person',
    data: {
      name: 'ワカメ',
      gender: 'female',
      generation: 1,
      description: '磯野家の次女。カツオの妹。',
      birthYear: 1937, birthMonth: 1,
    },
    position: { x: 0, y: 0 },
  },

  // ══════════════════════════════════════════
  // 世代 2: フグ田タラオ
  // ══════════════════════════════════════════
  {
    id: 'tarao',
    type: 'person',
    data: {
      name: 'タラオ',
      gender: 'male',
      generation: 2,
      description: 'サザエとマスオの息子。タラちゃん。',
    },
    position: { x: 0, y: 0 },
  },

  // ══════════════════════════════════════════
  // 世代 -1: もずく（波平の親）
  // ══════════════════════════════════════════
  {
    id: 'mozuku',
    type: 'person',
    data: {
      name: 'もずく',
      gender: 'male',
      generation: -1,
      description: '波平の親。',
      children: ['namihei', 'umihei', 'namiheiimoto'],
    },
    position: { x: 0, y: 0 },
  },

  // ══════════════════════════════════════════
  // 世代 0: 海平（波平の兄）
  // ══════════════════════════════════════════
  {
    id: 'umihei',
    type: 'person',
    data: {
      name: '海平',
      gender: 'male',
      generation: 0,
      description: '波平の兄。',
    },
    position: { x: 0, y: 0 },
  },

  // ══════════════════════════════════════════
  // 世代 0: ノリスケの親 & 波平の妹
  // ══════════════════════════════════════════
  {
    id: 'group-norisukeoya-namiheiimoto',
    type: 'marriageGroup',
    data: {
      generation: 0,
      children: ['norisuke'],
    },
    position: { x: 0, y: 0 },
    style: groupStyle,
  },
  {
    id: 'namiheiimoto',
    type: 'person',
    data: {
      name: '波平の妹',
      gender: 'female',
      generation: 0,
      description: '波平の妹。',
    },
    position: INNER.wife,
    parentId: 'group-norisukeoya-namiheiimoto',
    ...innerProps,
  },
  {
    id: 'couple-norisukeoya-namiheiimoto',
    type: 'couple',
    data: {},
    position: INNER.couple,
    parentId: 'group-norisukeoya-namiheiimoto',
    ...innerProps,
  },
  {
    id: 'norisukeoya',
    type: 'person',
    data: {
      name: 'ノリスケの親',
      gender: 'male',
      generation: 0,
      description: 'ノリスケの父。波平の妹の夫。',
    },
    position: INNER.husband,
    parentId: 'group-norisukeoya-namiheiimoto',
    ...innerProps,
  },

  // ══════════════════════════════════════════
  // 世代 0: 鯛造 & おこぜ（フネの兄夫婦）
  // ══════════════════════════════════════════
  {
    id: 'group-taizou-okoze',
    type: 'marriageGroup',
    data: {
      generation: 0,
      children: [],
    },
    position: { x: 0, y: 0 },
    style: groupStyle,
  },
  {
    id: 'okoze',
    type: 'person',
    data: {
      name: 'おこぜ',
      gender: 'female',
      generation: 0,
      description: '鯛造の嫁。',
    },
    position: INNER.wife,
    parentId: 'group-taizou-okoze',
    ...innerProps,
  },
  {
    id: 'couple-taizou-okoze',
    type: 'couple',
    data: {},
    position: INNER.couple,
    parentId: 'group-taizou-okoze',
    ...innerProps,
  },
  {
    id: 'taizou',
    type: 'person',
    data: {
      name: '鯛造',
      gender: 'male',
      generation: 0,
      description: 'フネの兄。',
    },
    position: INNER.husband,
    parentId: 'group-taizou-okoze',
    ...innerProps,
  },

  // ══════════════════════════════════════════
  // 世代 0: フネの弟
  // ══════════════════════════════════════════
  {
    id: 'funeotouto',
    type: 'person',
    data: {
      name: 'フネの弟',
      gender: 'male',
      generation: 0,
      description: 'フネの弟。',
    },
    position: { x: 0, y: 0 },
  },

  // ══════════════════════════════════════════
  // 世代 0: マスオ父 & マスオ母
  // ══════════════════════════════════════════
  {
    id: 'group-masuochichi-masuohaha',
    type: 'marriageGroup',
    data: {
      generation: 0,
      children: ['masuo'],
    },
    position: { x: 0, y: 0 },
    style: groupStyle,
  },
  {
    id: 'masuohaha',
    type: 'person',
    data: {
      name: 'マスオ母',
      gender: 'female',
      generation: 0,
      description: 'マスオの母。',
    },
    position: INNER.wife,
    parentId: 'group-masuochichi-masuohaha',
    ...innerProps,
  },
  {
    id: 'couple-masuochichi-masuohaha',
    type: 'couple',
    data: {},
    position: INNER.couple,
    parentId: 'group-masuochichi-masuohaha',
    ...innerProps,
  },
  {
    id: 'masuochichi',
    type: 'person',
    data: {
      name: 'マスオ父',
      gender: 'male',
      generation: 0,
      description: 'マスオの父。',
    },
    position: INNER.husband,
    parentId: 'group-masuochichi-masuohaha',
    ...innerProps,
  },

  // ══════════════════════════════════════════
  // 世代 1: 伊佐坂ノリスケ & タイコ
  // ══════════════════════════════════════════
  {
    id: 'group-norisuke-taiko',
    type: 'marriageGroup',
    data: {
      generation: 1,
      children: ['ikura'],
    },
    position: { x: 0, y: 0 },
    style: groupStyle,
  },
  {
    id: 'taiko',
    type: 'person',
    data: {
      name: 'タイコ',
      gender: 'female',
      generation: 1,
      description: 'ノリスケの妻。',
    },
    position: INNER.wife,
    parentId: 'group-norisuke-taiko',
    ...innerProps,
  },
  {
    id: 'couple-norisuke-taiko',
    type: 'couple',
    data: {},
    position: INNER.couple,
    parentId: 'group-norisuke-taiko',
    ...innerProps,
  },
  {
    id: 'norisuke',
    type: 'person',
    data: {
      name: 'ノリスケ',
      gender: 'male',
      generation: 1,
      description: '伊佐坂家の主人。マスオの友人。',
    },
    position: INNER.husband,
    parentId: 'group-norisuke-taiko',
    ...innerProps,
  },

  // ══════════════════════════════════════════
  // 世代 2: 伊佐坂イクラ
  // ══════════════════════════════════════════
  {
    id: 'ikura',
    type: 'person',
    data: {
      name: 'イクラ',
      gender: 'male',
      generation: 2,
      description: 'ノリスケとタイコの息子。タラちゃんの友達。',
    },
    position: { x: 0, y: 0 },
  },
];

// ─────────────────────────────────────────────────────
// 婚姻線のみ定義する。
// 親子線は buildParentChildEdges(initialNodes) で自動生成される。
// ─────────────────────────────────────────────────────
export const initialEdges = [

  // 波平 & 舟 の婚姻線
  {
    id: 'e-fune-couple0',
    source: 'fune',              sourceHandle: 'right',
    target: 'couple-namihei-fune', targetHandle: 'left',
    type: 'marriage',
  },
  {
    id: 'e-namihei-couple0',
    source: 'namihei',           sourceHandle: 'left',
    target: 'couple-namihei-fune', targetHandle: 'right',
    type: 'marriage',
  },

  // 鯛造 & おこぜ の婚姻線
  {
    id: 'e-okoze-couple-taizou',
    source: 'okoze',                sourceHandle: 'right',
    target: 'couple-taizou-okoze', targetHandle: 'left',
    type: 'marriage',
  },
  {
    id: 'e-taizou-couple-taizou',
    source: 'taizou',               sourceHandle: 'left',
    target: 'couple-taizou-okoze', targetHandle: 'right',
    type: 'marriage',
  },

  // サザエ & マスオ の婚姻線
  {
    id: 'e-sazae-couple1',
    source: 'sazae',             sourceHandle: 'right',
    target: 'couple-sazae-masuo',  targetHandle: 'left',
    type: 'marriage',
  },
  {
    id: 'e-masuo-couple1',
    source: 'masuo',             sourceHandle: 'left',
    target: 'couple-sazae-masuo',  targetHandle: 'right',
    type: 'marriage',
  },

  // ノリスケの親 & 波平の妹 の婚姻線
  {
    id: 'e-namiheiimoto-couple-norisukeoya',
    source: 'namiheiimoto',                       sourceHandle: 'right',
    target: 'couple-norisukeoya-namiheiimoto',    targetHandle: 'left',
    type: 'marriage',
  },
  {
    id: 'e-norisukeoya-couple-norisukeoya',
    source: 'norisukeoya',                        sourceHandle: 'left',
    target: 'couple-norisukeoya-namiheiimoto',    targetHandle: 'right',
    type: 'marriage',
  },

  // マスオ父 & マスオ母 の婚姻線
  {
    id: 'e-masuohaha-couple-masuo',
    source: 'masuohaha',                          sourceHandle: 'right',
    target: 'couple-masuochichi-masuohaha',       targetHandle: 'left',
    type: 'marriage',
  },
  {
    id: 'e-masuochichi-couple-masuo',
    source: 'masuochichi',                        sourceHandle: 'left',
    target: 'couple-masuochichi-masuohaha',       targetHandle: 'right',
    type: 'marriage',
  },

  // ノリスケ & タイコ の婚姻線
  {
    id: 'e-taiko-couple-norisuke',
    source: 'taiko',                  sourceHandle: 'right',
    target: 'couple-norisuke-taiko',  targetHandle: 'left',
    type: 'marriage',
  },
  {
    id: 'e-norisuke-couple-norisuke',
    source: 'norisuke',               sourceHandle: 'left',
    target: 'couple-norisuke-taiko',  targetHandle: 'right',
    type: 'marriage',
  },
];
