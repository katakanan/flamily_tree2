import { useState } from 'react';

/**
 * 新しい person ノードを追加するダイアログ。
 *
 * props:
 *   existingIds : string[]  — 重複チェック用の既存 ID 一覧
 *   onConfirm   : (nodeData) => void
 *   onCancel    : () => void
 */

// ID はアルファベットのみ（大文字・小文字）
const ALPHA_RE = /^[a-zA-Z]+$/;

// ── スタイル ──────────────────────────────────────────
const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
};

const dialog = {
  background: '#fff',
  borderRadius: 10,
  padding: '24px 28px',
  width: 340,
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  fontFamily: 'inherit',
};

const title = {
  fontSize: 15,
  fontWeight: 'bold',
  color: '#222',
  marginBottom: 18,
};

const label = {
  display: 'block',
  fontSize: 11,
  color: '#666',
  marginTop: 12,
  marginBottom: 4,
};

const req = { color: '#e55', marginLeft: 2 };

const input = (error) => ({
  width: '100%',
  padding: '7px 9px',
  border: `1px solid ${error ? '#e55' : '#ddd'}`,
  borderRadius: 5,
  fontSize: 13,
  color: '#333',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
});

const select = {
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
};

const textarea = {
  width: '100%',
  padding: '7px 9px',
  border: '1px solid #ddd',
  borderRadius: 5,
  fontSize: 12,
  color: '#333',
  boxSizing: 'border-box',
  resize: 'vertical',
  minHeight: 60,
  fontFamily: 'inherit',
  lineHeight: 1.5,
};

const errMsg = {
  fontSize: 11,
  color: '#e55',
  marginTop: 3,
};

const footer = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 22,
};

const cancelBtn = {
  padding: '8px 18px',
  fontSize: 13,
  border: '1px solid #ddd',
  borderRadius: 6,
  background: '#fff',
  color: '#555',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const okBtn = (enabled) => ({
  padding: '8px 24px',
  fontSize: 13,
  border: 'none',
  borderRadius: 6,
  background: enabled ? '#4a90d9' : '#aaa',
  color: '#fff',
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: 'inherit',
  transition: 'background 0.15s',
});

// ─────────────────────────────────────────────────────
export default function AddNodeDialog({ existingIds = [], onConfirm, onCancel }) {
  const [id,          setId]          = useState('');
  const [name,        setName]        = useState('');
  const [gender,      setGender]      = useState('male');
  const [generation,  setGeneration]  = useState('');
  const [description, setDescription] = useState('');

  // ── バリデーション ───────────────────────────────
  const idTrimmed   = id.trim();
  const nameTrimmed = name.trim();
  const genTrimmed  = generation.toString().trim();

  const idAlphaOk  = idTrimmed === '' || ALPHA_RE.test(idTrimmed);
  const idDupOk    = !existingIds.includes(idTrimmed);
  const idError    =
    idTrimmed !== '' && !idAlphaOk ? 'アルファベットのみ使用できます' :
    idTrimmed !== '' && !idDupOk   ? 'このIDはすでに使用されています' : '';

  const canSubmit =
    idTrimmed !== '' && idAlphaOk && idDupOk &&
    nameTrimmed !== '' &&
    genTrimmed !== '' && !isNaN(Number(genTrimmed));

  // ── 送信 ────────────────────────────────────────
  const handleOk = () => {
    if (!canSubmit) return;
    onConfirm({
      id:          idTrimmed,
      name:        nameTrimmed,
      gender,
      generation:  Number(genTrimmed),
      description: description.trim(),
    });
  };

  // ID 入力: アルファベット以外の文字を入力されても受け付けるが
  // バリデーションでエラー表示する（削除しながら入力しやすい）
  const handleIdChange = (e) => setId(e.target.value);

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={dialog} onClick={e => e.stopPropagation()}>
        <div style={title}>ノードを追加</div>

        {/* ID */}
        <label style={label}>ID <span style={req}>*</span></label>
        <input
          style={input(!!idError)}
          value={id}
          placeholder="例: taro"
          onChange={handleIdChange}
        />
        {idError && <div style={errMsg}>{idError}</div>}

        {/* 名前 */}
        <label style={label}>名前 <span style={req}>*</span></label>
        <input
          style={input(false)}
          value={name}
          placeholder="例: 太郎"
          onChange={e => setName(e.target.value)}
        />

        {/* 性別 */}
        <label style={label}>性別 <span style={req}>*</span></label>
        <select style={select} value={gender} onChange={e => setGender(e.target.value)}>
          <option value="male">男性</option>
          <option value="female">女性</option>
          <option value="child">その他</option>
        </select>

        {/* 世代 */}
        <label style={label}>世代 <span style={req}>*</span></label>
        <input
          style={input(false)}
          type="number"
          value={generation}
          placeholder="0, 1, 2 ..."
          min={0}
          onChange={e => setGeneration(e.target.value)}
        />

        {/* 説明 */}
        <label style={label}>説明</label>
        <textarea
          style={textarea}
          value={description}
          placeholder="説明を入力（任意）"
          onChange={e => setDescription(e.target.value)}
        />

        {/* フッター */}
        <div style={footer}>
          <button style={cancelBtn} onClick={onCancel}>キャンセル</button>
          <button style={okBtn(canSubmit)} disabled={!canSubmit} onClick={handleOk}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
