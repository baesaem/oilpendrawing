import { useState } from 'react';
import { PRESET_LIMIT, samePaint, type UserPreset } from '../presets';
import { BRUSH_SHORT, type PaintProfile } from '../types';
import { StarIcon, TrashIcon } from './Icons';

interface Props {
  /** 지금 그리기 설정 (같은 값의 프리셋을 표시하기 위해) */
  paint: PaintProfile;
  presets: UserPreset[];
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  onApplyPreset: (p: UserPreset) => void;
}

/**
 * 즐겨찾기 프리셋 (이 브라우저에 저장한 그리기 설정).
 * 화풍 프리셋의 "즐겨찾기" 탭에 들어간다 — 화풍 갤러리(로컬)·AI 설정과 나란히 고르는 자리다.
 */
export function PresetList({ paint, presets, onSavePreset, onDeletePreset, onApplyPreset }: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const full = presets.length >= PRESET_LIMIT;
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onSavePreset(n);
    setName('');
    setSaving(false);
  };
  return (
    <div className="field">
      <div className="field-row">
        <b>내 프리셋</b>
        {!saving && (
          <button className="link" onClick={() => setSaving(true)} disabled={full}
            title={full ? `최대 ${PRESET_LIMIT}개까지 저장됩니다` : '지금 설정을 이름 붙여 저장합니다'}>현재 설정 저장</button>
        )}
      </div>
      {saving && (
        <div className="preset-save">
          <input className="text-input" value={name} autoFocus placeholder="예: 벽돌 골목, 나무 많은 풍경" maxLength={24}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setSaving(false); }} aria-label="프리셋 이름" />
          <button className="btn btn-sm btn-primary" onClick={submit} disabled={!name.trim()}>저장</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setSaving(false)}>취소</button>
        </div>
      )}
      {presets.length === 0 && !saving ? (
        <div className="small faint">마음에 드는 설정이 나오면 저장해 두고 다음 사진에 바로 적용하세요. 저장은 이 브라우저에만 남습니다.</div>
      ) : (
        <div className="preset-list">
          {presets.map((p) => (
            <div key={p.id} className={`preset-item ${samePaint(paint, p.paint) ? 'on' : ''}`}>
              <button className="preset-apply" onClick={() => onApplyPreset(p)}
                title={`${BRUSH_SHORT[p.paint.brush]} · ${p.paint.passes}층 · 세밀함 ${p.paint.detail} · 굵기 ${p.paint.lineWidth}px`}>
                <StarIcon width={13} height={13} /><span>{p.name}</span>
              </button>
              <button className="preset-del" onClick={() => onDeletePreset(p.id)} aria-label={`${p.name} 삭제`} title="삭제"><TrashIcon width={13} height={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
