import { CLASSIC_STROKES, FILL_LABEL, PARK_STROKES, RICHEON_STROKES, type FillMode, type StrokeProfile } from '../types';

interface Props {
  strokes: StrokeProfile;
  onChange: (patch: Partial<StrokeProfile>) => void;
  /** 견본 분석 결과가 반영된 상태인지 */
  fromSample: boolean;
  onReset: () => void;
}

const FILLS: FillMode[] = ['sketch', 'hatch', 'cross', 'contour', 'scribble', 'stipple'];

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
export function StrokePanel({ strokes: s, onChange, fromSample, onReset }: Props) {
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
          <button onClick={() => onChange({ ...RICHEON_STROKES })} title="가는 펜, 면 방향 해칭, 나뭇잎 고리선, 가장자리 여백, 낙관 (@richeons_drawing_journey)">리천 스타일</button>
          <button onClick={() => onChange({ ...PARK_STROKES })} title="아주 가는 선, 끝까지 완성, 수평 하늘 해칭, 먹 그림자 (@parkyongsoon_art)">박용순 세밀</button>
          <button onClick={() => onChange({ ...CLASSIC_STROKES })} title="굵은 펜의 한 방향 해칭">클래식</button>
        </div>
      </div>

      <div className="field">
        <div className="field-row"><b>채우기</b></div>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }} role="radiogroup" aria-label="채우기 방식">
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
        <Range label="손떨림" value={s.jitter} min={0} max={100} onChange={(jitter) => onChange({ jitter })} />
      )}

      <Range label="가장자리 여백" value={s.vignette} min={0} max={100} onChange={(vignette) => onChange({ vignette })} />

      <div className="field">
        <div className="field-row"><b>낙관 · 날짜</b><span className="muted small">비우면 없음</span></div>
        <div className="color-row">
          <input className="text-input" value={s.seal} maxLength={4} placeholder="梨川" onChange={(e) => onChange({ seal: e.target.value })} aria-label="낙관 글자" style={{ flex: 1 }} />
          <button className="toggle" role="switch" aria-checked={s.sealDate} onClick={() => onChange({ sealDate: !s.sealDate })} style={{ flex: 1 }}>
            <span>날짜</span><span className={`switch ${s.sealDate ? 'on' : ''}`} />
          </button>
        </div>
      </div>

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

const FILL_SHORT: Record<FillMode, string> = { sketch: '스케치', hatch: '해칭', cross: '교차', contour: '윤곽', scribble: '낙서', stipple: '점묘' };
