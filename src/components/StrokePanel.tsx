import { useState } from 'react';
import { PRESET_LIMIT, sameStrokes, type UserPreset } from '../presets';
import { CLASSIC_STROKES, FILL_LABEL, FINE_STROKES, RICHEON_STROKES, type FillMode, type StrokeProfile } from '../types';
import { StarIcon, TrashIcon } from './Icons';

interface Props {
  strokes: StrokeProfile;
  onChange: (patch: Partial<StrokeProfile>) => void;
  /** 견본 분석 결과가 반영된 상태인지 */
  fromSample: boolean;
  onReset: () => void;
  /** 즐겨찾기 프리셋 (이 브라우저에 저장) */
  presets: UserPreset[];
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  onApplyPreset: (p: UserPreset) => void;
}

const FILLS: FillMode[] = ['sketch', 'hatch', 'cross', 'contour', 'scribble', 'stipple', 'wash'];

function Range({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <div className="field-row"><b>{label}</b><span className="muted">{value}{unit}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}

/** 로컬 렌더러가 쓰는 선·톤 설정. 견본을 올리면 분석값으로 채워지고, 여기서 바로 고칠 수 있습니다. */
export function StrokePanel({ strokes: s, onChange, fromSample, onReset, presets, onSavePreset, onDeletePreset, onApplyPreset }: Props) {
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
    <>
      <div className="panel-head">
        <h2>선 · 톤</h2>
        <button className="link" onClick={onReset} title="숙련도 기본값으로 되돌립니다">{fromSample ? '견본값 다시 반영' : '기본값'}</button>
      </div>
      <div className="small muted">
        {fromSample ? '견본에서 읽은 값입니다. 슬라이더를 움직이면 결과가 바로 바뀝니다.' : '견본을 올리면 자동으로 채워집니다. 직접 조절해도 됩니다.'}
      </div>

      <div className="field">
        <div className="field-row"><b>프리셋</b></div>
        <div className="chips">
          <button className={sameStrokes(s, RICHEON_STROKES) ? 'on' : ''} onClick={() => onChange({ ...RICHEON_STROKES })} title="가는 펜, 면 방향 해칭, 나뭇잎 고리선, 가장자리 여백 (@richeons_drawing_journey)">리천 스타일</button>
          <button className={sameStrokes(s, FINE_STROKES) ? 'on' : ''} onClick={() => onChange({ ...FINE_STROKES })} title="아주 가는 선, 끝까지 완성, 수평 하늘 해칭, 먹 그림자">세밀 펜화</button>
          <button className={sameStrokes(s, CLASSIC_STROKES) ? 'on' : ''} onClick={() => onChange({ ...CLASSIC_STROKES })} title="굵은 펜의 한 방향 해칭">클래식</button>
        </div>
      </div>

      <div className="field">
        <div className="field-row">
          <b>즐겨찾기 프리셋</b>
          {!saving && <button className="link" onClick={() => setSaving(true)} disabled={full} title={full ? `최대 ${PRESET_LIMIT}개까지 저장됩니다` : '지금 슬라이더 값을 이름 붙여 저장합니다'}>현재 설정 저장</button>}
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
          <div className="small faint">마음에 드는 선·톤이 나오면 저장해 두고 다음 사진에 바로 적용하세요.</div>
        ) : (
          <div className="preset-list">
            {presets.map((p) => (
              <div key={p.id} className={`preset-item ${sameStrokes(s, p.strokes) ? 'on' : ''}`}>
                <button className="preset-apply" onClick={() => onApplyPreset(p)} title={`${FILL_LABEL[p.strokes.fill]} · 톤 ${p.strokes.tones} · 굵기 ${p.strokes.lineWidth}px · 간격 ${p.strokes.hatchSpacing}px`}>
                  <StarIcon width={13} height={13} /><span>{p.name}</span>
                </button>
                <button className="preset-del" onClick={() => onDeletePreset(p.id)} aria-label={`${p.name} 삭제`} title="삭제"><TrashIcon width={13} height={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <div className="field-row"><b>채우기</b></div>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }} role="radiogroup" aria-label="채우기 방식">
          {FILLS.map((f) => (
            <button key={f} className={s.fill === f ? 'on' : ''} role="radio" aria-checked={s.fill === f} onClick={() => onChange({ fill: f })} title={FILL_LABEL[f]} style={{ fontSize: 11 }}>
              {FILL_SHORT[f]}
            </button>
          ))}
        </div>
      </div>

      <Range label="톤 단계" value={s.tones} min={2} max={6} onChange={(tones) => onChange({ tones })} />
      <Range label="여백" value={s.paperKeep} min={0} max={100} unit="%" onChange={(paperKeep) => onChange({ paperKeep })} />
      <Range label="선 굵기" value={s.lineWidth} min={1} max={6} step={0.5} unit="px" onChange={(lineWidth) => onChange({ lineWidth })} />
      <Range label="윤곽선 밀도" value={s.edgeDensity} min={0} max={100} onChange={(edgeDensity) => onChange({ edgeDensity })} />
      {s.fill !== 'stipple' && (
        <Range label="해칭 각도" value={s.hatchAngle} min={0} max={179} unit="°" onChange={(hatchAngle) => onChange({ hatchAngle })} />
      )}
      <Range label={s.fill === 'stipple' ? '점 간격' : '해칭 간격'} value={s.hatchSpacing} min={3} max={24} unit="px" onChange={(hatchSpacing) => onChange({ hatchSpacing })} />
      {s.fill !== 'stipple' && (
        <Range label={s.fill === 'wash' ? '손떨림 · 담채 입자감' : '손떨림'} value={s.jitter} min={0} max={100} onChange={(jitter) => onChange({ jitter })} />
      )}

      <Range label="가장자리 여백" value={s.vignette} min={0} max={100} onChange={(vignette) => onChange({ vignette })} />

      <div className="field">
        <div className="field-row"><b>종이 · 잉크색</b><span className="muted small">흑백일 때만</span></div>
        <div className="color-row">
          <label><input type="color" value={s.paperColor} onChange={(e) => onChange({ paperColor: e.target.value })} aria-label="종이색" /><span>종이</span></label>
          <label><input type="color" value={s.inkColor} onChange={(e) => onChange({ inkColor: e.target.value })} aria-label="잉크색" /><span>잉크</span></label>
        </div>
      </div>
    </>
  );
}

const FILL_SHORT: Record<FillMode, string> = { sketch: '스케치', hatch: '해칭', cross: '교차', contour: '윤곽', scribble: '낙서', stipple: '점묘', wash: '담채' };
