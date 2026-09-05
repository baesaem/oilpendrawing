import { useEffect, useMemo, useRef, useState } from 'react';
import { PRESET_LIMIT, samePaint, type UserPreset } from '../presets';
import { BRUSH_LABEL, BRUSH_SHORT, CLASSIC_PAINT, FINE_PAINT, RICHEON_PAINT, TIP_LABEL, TIP_SHORT, type BrushKind, type PaintProfile, type TipKind } from '../types';
import { tipPreview } from '../render';
import { StarIcon, TrashIcon } from './Icons';

interface Props {
  paint: PaintProfile;
  onChange: (patch: Partial<PaintProfile>) => void;
  /** 견본 분석 결과가 반영된 상태인지 */
  fromSample: boolean;
  onReset: () => void;
  /** 즐겨찾기 프리셋 (이 브라우저에 저장) */
  presets: UserPreset[];
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  onApplyPreset: (p: UserPreset) => void;
}

const BRUSHES: BrushKind[] = ['pen', 'hatch', 'cross', 'contour', 'scribble', 'stipple', 'wash', 'oil', 'impasto'];
const TIPS: TipKind[] = ['round', 'bristle', 'wet', 'chalk'];

/** 브러시 팁 미리보기 (포토샵 브러시 선택기처럼 획 하나를 보여 준다). 엔진의 같은 팁 코드로 그린다 */
function TipThumb({ kind }: { kind: TipKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const img = useMemo(() => tipPreview(kind), [kind]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = img.width; c.height = img.height;
    c.getContext('2d')?.putImageData(new ImageData(img.data as Uint8ClampedArray<ArrayBuffer>, img.width, img.height), 0, 0);
  }, [img]);
  return <canvas ref={ref} className="tip-thumb" aria-hidden="true" />;
}

function Range({ label, value, min, max, step = 1, unit = '', hint, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; hint?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="field" title={hint}>
      <div className="field-row"><b>{label}</b><span className="muted">{value}{unit}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="group">
      <div className="group-title">{title}</div>
      {children}
    </div>
  );
}

/**
 * 그리기 설정 (Dynamic Auto-Painter 의 파라미터 패널). 로컬 엔진이 보는 값의 전부이며, 화풍 프리셋을 고르면 채워지고
 * 견본을 올리면 분석값으로 채워진다. 여기서 바로 고칠 수 있고, 움직이면 결과가 다시 그려진다.
 */
export function PaintPanel({ paint: s, onChange, fromSample, onReset, presets, onSavePreset, onDeletePreset, onApplyPreset }: Props) {
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
  const isStipple = s.brush === 'stipple', isWash = s.brush === 'wash' || s.brush === 'oil' || s.brush === 'impasto';
  return (
    <>
      <div className="panel-head">
        <h2>그리기 설정</h2>
        <button className="link" onClick={onReset} title="화풍·숙련도 기본값으로 되돌립니다">{fromSample ? '견본값 다시 반영' : '기본값'}</button>
      </div>
      <div className="small muted">
        {fromSample ? '견본에서 읽은 값입니다. 슬라이더를 움직이면 결과가 바로 다시 그려집니다.' : '화풍 프리셋을 고르면 채워집니다. 직접 조절해도 됩니다.'}
      </div>

      <div className="field">
        <div className="field-row"><b>기본 프리셋</b></div>
        <div className="chips">
          <button className={samePaint(s, RICHEON_PAINT) ? 'on' : ''} onClick={() => onChange({ ...RICHEON_PAINT })} title="가는 펜, 면 방향 획, 나뭇잎 고리선, 가장자리 여백 (@richeons_drawing_journey)">리천 스타일</button>
          <button className={samePaint(s, FINE_PAINT) ? 'on' : ''} onClick={() => onChange({ ...FINE_PAINT })} title="아주 가는 선, 끝까지 완성, 수평 하늘 해칭, 먹 그림자">세밀 펜화</button>
          <button className={samePaint(s, CLASSIC_PAINT) ? 'on' : ''} onClick={() => onChange({ ...CLASSIC_PAINT })} title="굵은 펜의 한 방향 해칭">클래식</button>
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
          <div className="small faint">마음에 드는 설정이 나오면 저장해 두고 다음 사진에 바로 적용하세요.</div>
        ) : (
          <div className="preset-list">
            {presets.map((p) => (
              <div key={p.id} className={`preset-item ${samePaint(s, p.paint) ? 'on' : ''}`}>
                <button className="preset-apply" onClick={() => onApplyPreset(p)} title={`${BRUSH_SHORT[p.paint.brush]} · ${p.paint.passes}층 · 세밀함 ${p.paint.detail} · 굵기 ${p.paint.lineWidth}px`}>
                  <StarIcon width={13} height={13} /><span>{p.name}</span>
                </button>
                <button className="preset-del" onClick={() => onDeletePreset(p.id)} aria-label={`${p.name} 삭제`} title="삭제"><TrashIcon width={13} height={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <div className="field-row"><b>붓</b><span className="muted small">{BRUSH_SHORT[s.brush]}</span></div>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }} role="radiogroup" aria-label="붓">
          {BRUSHES.map((b) => (
            <button key={b} className={s.brush === b ? 'on' : ''} role="radio" aria-checked={s.brush === b} onClick={() => onChange({ brush: b })} title={BRUSH_LABEL[b]} style={{ fontSize: 11 }}>
              {BRUSH_SHORT[b]}
            </button>
          ))}
        </div>
        <div className="small faint">{BRUSH_LABEL[s.brush]}</div>
      </div>

      {isWash && (
        <div className="field">
          <div className="field-row"><b>브러시 팁</b><span className="muted small">{TIP_SHORT[s.tip]}</span></div>
          <div className="tips" role="radiogroup" aria-label="브러시 팁">
            {TIPS.map((t) => (
              <button key={t} type="button" className={s.tip === t ? 'on' : ''} role="radio" aria-checked={s.tip === t} title={TIP_LABEL[t]} onClick={() => onChange({ tip: t })}>
                <TipThumb kind={t} />
                <span>{TIP_SHORT[t]}</span>
              </button>
            ))}
          </div>
          <div className="small faint">{TIP_LABEL[s.tip]}</div>
        </div>
      )}

      <Group title="획 — 큰 획에서 작은 획으로">
        <Range label="층 수" value={s.passes} min={1} max={6} hint="획 크기를 줄여 가며 몇 번 겹쳐 그릴지" onChange={(passes) => onChange({ passes })} />
        <Range label="획 크기" value={s.brushSize} min={0} max={100} hint="첫 층의 획 길이·간격. 큰 형태를 잡는 획" onChange={(brushSize) => onChange({ brushSize })} />
        <Range label="세밀함" value={s.detail} min={0} max={100} hint="마지막 층의 획이 얼마나 작은지. 높을수록 세부까지 그리고 해칭 간격이 좁아짐" onChange={(detail) => onChange({ detail })} />
        {!isStipple && <Range label="획 길이" value={s.strokeLength} min={0} max={100} hint="획 하나의 길이 (획 크기 배수)" onChange={(strokeLength) => onChange({ strokeLength })} />}
      </Group>

      <Group title="정밀도 · 방향">
        <Range label="정밀도" value={s.accuracy} min={0} max={100} hint="낮으면 큰 명암 차이만 획으로 메워 성글고, 높으면 사진의 명암에 가깝게" onChange={(accuracy) => onChange({ accuracy })} />
        {!isStipple && <Range label="형태 따라가기" value={s.featureFollow} min={0} max={100} hint="0 = 기준 각도로만, 100 = 면·경계의 방향을 그대로 따름 (DAP 의 Feature Follow)" onChange={(featureFollow) => onChange({ featureFollow })} />}
        {!isStipple && <Range label="기준 각도" value={s.baseAngle} min={0} max={179} unit="°" hint="방향이 없는 곳(하늘·평면)과 형태 따라가기가 약할 때의 해칭 방향" onChange={(baseAngle) => onChange({ baseAngle })} />}
        <Range label="무작위성" value={s.randomness} min={0} max={100} hint="시작점·각도·길이·필압의 흔들림" onChange={(randomness) => onChange({ randomness })} />
      </Group>

      <Group title="펜 · 종이">
        <Range label="선 굵기" value={s.lineWidth} min={1} max={6} step={0.5} unit="px" onChange={(lineWidth) => onChange({ lineWidth })} />
        <Range label={isWash ? '담채 진하기' : '잉크 농도'} value={s.ink} min={0} max={100} hint="획 하나의 진하기. 85 이상이면 가장 깊은 그림자를 먹으로 채움" onChange={(ink) => onChange({ ink })} />
        <Range label="여백" value={s.paperKeep} min={0} max={100} unit="%" hint="높을수록 밝은 곳을 넓게 종이로 남김" onChange={(paperKeep) => onChange({ paperKeep })} />
        <Range label="윤곽선" value={s.edges} min={0} max={100} hint="색 경계를 따라가는 선의 양" onChange={(edges) => onChange({ edges })} />
        <Range label="가장자리 여백" value={s.vignette} min={0} max={100} hint="가장자리를 미완성처럼 흐림 (어반 스케치)" onChange={(vignette) => onChange({ vignette })} />
        <div className="field">
          <div className="field-row"><b>종이 · 잉크색</b><span className="muted small">흑백일 때만</span></div>
          <div className="color-row">
            <label><input type="color" value={s.paperColor} onChange={(e) => onChange({ paperColor: e.target.value })} aria-label="종이색" /><span>종이</span></label>
            <label><input type="color" value={s.inkColor} onChange={(e) => onChange({ inkColor: e.target.value })} aria-label="잉크색" /><span>잉크</span></label>
          </div>
        </div>
      </Group>
    </>
  );
}
