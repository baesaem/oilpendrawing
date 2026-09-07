import { useEffect, useMemo, useRef, useState } from 'react';
import { samePaint } from '../presets';
import { BRUSH_LABEL, BRUSH_SHORT, CLASSIC_PAINT, FINE_PAINT, PALETTE_12, PEN_WIDTHS, detailThin, penWidthStep, PALETTE_LABEL, PALETTE_SHORT, PALETTE_VANGOGH, RICHEON_PAINT, TIP_LABEL, TIP_SHORT, type BrushKind, type PaintProfile, type PaletteId, type TipKind } from '../types';
import { tipPreview } from '../render';

interface Props {
  paint: PaintProfile;
  onChange: (patch: Partial<PaintProfile>) => void;
  /** 견본 분석 결과가 반영된 상태인지 */
  fromSample: boolean;
  onReset: () => void;
}

const PEN_BRUSHES: BrushKind[] = ['tone', 'pen', 'contour', 'stipple'];
const PAINT_BRUSHES: BrushKind[] = ['inkwash', 'wash', 'oil', 'impasto'];
const TIPS: TipKind[] = ['auto', 'round', 'bristle', 'wet', 'chalk', 'swirl'];
const PALETTES: PaletteId[] = ['photo', 'bright', 'mono', 'match', 'match2', 'vangogh'];

/** 팔레트 색 띠 (12색 물감을 쓰는 팔레트만 색을 보여 준다) */
function PaletteSwatch({ id }: { id: PaletteId }) {
  if (id === 'photo') return <span className="pal-bar pal-photo" aria-hidden="true" />;
  if (id === 'mono') return <span className="pal-bar" aria-hidden="true">{[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => <i key={v} style={{ background: `rgb(${v * 230},${v * 228},${v * 224})` }} />)}</span>;
  if (id === 'bright') return <span className="pal-bar" aria-hidden="true">{['#ff2d2d', '#ff9500', '#ffe000', '#12c46a', '#1e7bff', '#8a2be2'].map((c) => <i key={c} style={{ background: c }} />)}</span>;
  const list = id === 'vangogh' ? PALETTE_VANGOGH : PALETTE_12;
  return <span className="pal-bar" aria-hidden="true">{list.map((c) => <i key={c} style={{ background: c }} />)}</span>;
}

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

function Range({ label, value, min, max, step = 1, unit = '', hint, note, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; hint?: string; note?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="field" title={hint}>
      <div className="field-row"><b>{label}</b><span className="muted">{note ?? `${value}${unit}`}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}

/** 슬라이더 값을 사람 말로 (숫자만 보면 무엇이 달라지는지 알기 어렵다) */
const detailNote = (v: number) => (v < 35 ? '큰 형태만' : v < 70 ? '보통' : '아주 세밀하게');
const keepNote = (v: number) => (v < 35 ? '거의 다 채움' : v < 65 ? '보통' : '흰 종이를 넓게');
const inkNote = (v: number) => (v < 35 ? '연하게' : v < 70 ? '보통' : '진하게');
const mm = (px: number) => (px * 0.3).toFixed(2).replace(/0$/, '');
const widthNote = (v: number) => `${v <= 1.2 ? '가는' : v <= 2.2 ? '보통' : '굵은'} 펜 · 약 ${mm(v)}mm`;
/** 점묘는 같은 슬라이더가 점 하나의 굵기다 (지름 ≈ 선 굵기 × 1.24) */
const dotNote = (v: number) => `${v <= 1.5 ? '작은' : v <= 3 ? '보통' : '굵은'} 점 · 약 ${mm(v * 1.24)}mm`;
const realNote = (v: number) => (v < 30 ? '표현적으로' : v < 55 ? '조금 표현적' : v < 80 ? '조금 사실적' : '원본과 같게');
const wetNote = (v: number) => (v < 25 ? '마른 붓' : v < 50 ? '조금 마르게' : v < 75 ? '조금 젖게' : '젖은 붓');

/**
 * 붓을 바꿀 때의 보정. 펜화 붓의 `passes` 는 층 수가 아니라 **명암 단계**라, 다른 붓의 층 수(2~4)를 그대로 물려받으면
 * 3단계짜리 성긴 해칭이 된다. 펜화로 들어올 때는 기본 10단계를 넣어 준다 (그 뒤엔 슬라이더가 권한, 3~15).
 */
function brushPatch(s: PaintProfile, b: BrushKind): Partial<PaintProfile> {
  if (b === 'tone' && s.brush !== 'tone') return { brush: b, passes: 15 };
  if (b !== 'tone' && s.brush === 'tone') return { brush: b, passes: Math.min(s.passes, 4) };
  return { brush: b };
}

/**
 * 그리기 설정 (Dynamic Auto-Painter 의 파라미터 패널). 로컬 엔진이 보는 값의 전부이며, 화풍 프리셋을 고르면 채워지고
 * 견본을 올리면 분석값으로 채워진다. 움직이면 결과가 바로 다시 그려진다.
 *
 * 자주 쓰는 넷(세밀함·여백·진하기·선 굵기)만 밖에 두고 나머지는 "세부 조정"에 접어 둔다 —
 * 이 앱은 드로잉 초보자용이라 슬라이더가 많으면 무엇을 만져야 할지 알 수 없다.
 */
export function PaintPanel({ paint: s, onChange, fromSample, onReset }: Props) {
  const [palOpen, setPalOpen] = useState(false);
  const isStipple = s.brush === 'stipple';
  const isPaint = s.brush === 'inkwash' || s.brush === 'wash' || s.brush === 'oil' || s.brush === 'impasto';
  // 탭을 오갈 때 그쪽에서 마지막으로 쓰던 붓으로 돌아가게 기억해 둔다
  const lastPen = useRef<BrushKind>('pen');
  const lastPaint = useRef<BrushKind>('wash');
  if (isPaint) lastPaint.current = s.brush; else lastPen.current = s.brush;
  return (
    <>
      <div className="panel-head">
        <h2>그리기 설정</h2>
        <button className="link" onClick={onReset} title="화풍 기본값으로 되돌립니다">{fromSample ? '견본값 다시 반영' : '기본값'}</button>
      </div>
      <div className="small muted">
        {fromSample ? '견본에서 읽은 값입니다. 움직이면 결과가 바로 다시 그려집니다.' : '화풍을 고르면 채워집니다. 네 가지만 만져도 충분합니다.'}
      </div>

      {/* 펜 / 붓 탭. 지금 붓이 어느 쪽인지가 곧 탭이라, 탭을 누르면 그쪽에서 마지막에 쓰던 붓으로 바꾼다 */}
      <div className="field">
        <div className="seg brush-tabs" role="tablist" aria-label="그리기 방식">
          {([['pen', '펜으로 그리기'], ['paint', '붓으로 그리기']] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={isPaint === (k === 'paint')} className={isPaint === (k === 'paint') ? 'on' : ''}
              onClick={() => onChange(brushPatch(s, k === 'paint' ? lastPaint.current : lastPen.current))}>{label}</button>
          ))}
        </div>
        <div className="seg" style={{ gridTemplateColumns: `repeat(${(isPaint ? PAINT_BRUSHES : PEN_BRUSHES).length}, minmax(0, 1fr))`, marginTop: 6 }}
          role="radiogroup" aria-label={isPaint ? '그림 붓' : '펜 붓'}>
          {(isPaint ? PAINT_BRUSHES : PEN_BRUSHES).map((b) => (
            <button key={b} className={s.brush === b ? 'on' : ''} role="radio" aria-checked={s.brush === b} onClick={() => onChange(brushPatch(s, b))} title={BRUSH_LABEL[b]} style={{ fontSize: 11 }}>
              {BRUSH_SHORT[b]}
            </button>
          ))}
        </div>
        <div className="small faint">{BRUSH_LABEL[s.brush]}</div>
      </div>

      {isPaint && (
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
        </div>
      )}

      <Range label="표현 ↔ 사실" value={s.accuracy} min={0} max={100} note={realNote(s.accuracy)}
        hint={isPaint
          ? '사실 쪽으로 갈수록 원본 사진과 같아집니다 — 색을 덜 바꾸고 세부를 더 그리며, 마지막에 원본 사진을 겹쳐 비칩니다 (50 이상부터, 100 에서 절반)'
          : '사실 쪽으로 갈수록 원본 사진과 같아집니다 — 명암 차이가 작은 곳까지 선을 놓습니다'}
        onChange={(accuracy) => onChange({ accuracy })} />
      {isPaint && (
        <Range label="마른 붓 ↔ 젖은 붓" value={s.wet} min={0} max={100} note={wetNote(s.wet)}
          hint="젖을수록 붓 자국이 서로 번지고 옅게 여러 겹 쌓이며 가장자리에 안료가 고입니다. 마르면 자국이 또렷하고 갈라집니다"
          onChange={(wet) => onChange({ wet })} />
      )}

      <div className="field">
        <div className="field-row"><b>색 팔레트</b><span className="muted small">컬러일 때</span></div>
        {/* 드롭다운처럼 접었다 펴되, 목록의 이름 옆에 그 팔레트의 색상표를 함께 보여 준다 */}
        <button className="text-input select pal-current" aria-expanded={palOpen} aria-label="색 팔레트"
          onClick={() => setPalOpen((o) => !o)}>
          <PaletteSwatch id={s.palette} />
          <span>{PALETTE_SHORT[s.palette]}</span>
        </button>
        {palOpen && (
          <div className="pal-list" role="radiogroup" aria-label="색 팔레트 목록">
            {PALETTES.map((q) => (
              <button key={q} type="button" className={s.palette === q ? 'on' : ''} role="radio" aria-checked={s.palette === q}
                title={PALETTE_LABEL[q]} onClick={() => { onChange({ palette: q }); setPalOpen(false); }}>
                <PaletteSwatch id={q} />
                <span>{PALETTE_SHORT[q]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="small faint">{PALETTE_LABEL[s.palette]}</div>
      </div>

      {s.brush === 'tone' && (
        <Range label="명암 단계" value={s.passes} min={3} max={20} unit="단계" note={`${s.passes}단계 · 선 ${s.passes - 1}겹`}
          hint="밝기를 몇 단계로 나눌지. 가장 밝은 단계는 선이 없습니다" onChange={(passes) => onChange({ passes })} />
      )}
      <Range label={s.brush === 'tone' ? '선 간격' : '세밀함'} value={s.detail} min={0} max={100}
        note={s.brush === 'tone' ? (s.detail < 35 ? '성글게' : s.detail < 70 ? '보통' : '촘촘하게') : detailNote(s.detail)}
        hint="낮으면 큰 형태만·선이 성글고, 높으면 세부까지·선이 촘촘합니다" onChange={(detail) => onChange({ detail })} />
      <Range label="여백" value={s.paperKeep} min={0} max={100} note={keepNote(s.paperKeep)}
        hint="높을수록 밝은 곳을 넓게 종이로 남깁니다" onChange={(paperKeep) => onChange({ paperKeep })} />
      <Range label={isPaint ? '물감 진하기' : '잉크 진하기'} value={s.ink} min={0} max={100} note={inkNote(s.ink)}
        hint="획 하나의 진하기. 아주 진하면 깊은 그림자를 먹으로 채웁니다" onChange={(ink) => onChange({ ink })} />
      {/* 펜 굵기는 20 단계다 — 1 단계가 화면의 1 화소(더 가늘게는 못 그린다)이고 등비로 굵어진다.
          붓·점은 예전처럼 값을 그대로 쓴다 */}
      {isPaint || isStipple ? (
        <Range label={isPaint ? '붓 굵기' : '점 굵기'} value={s.lineWidth} min={1} max={6} step={0.5}
          note={isStipple ? dotNote(s.lineWidth) : widthNote(s.lineWidth)}
          hint={isStipple ? '점 하나의 굵기입니다. 가장자리는 점마다 다르게 거칠어집니다' : undefined}
          onChange={(lineWidth) => onChange({ lineWidth })} />
      ) : (
        <Range label="선 굵기" value={penWidthStep(s.lineWidth)} min={1} max={PEN_WIDTHS.length} step={1}
          note={`${penWidthStep(s.lineWidth)}단계 · ${widthNote(PEN_WIDTHS[penWidthStep(s.lineWidth) - 1] * detailThin(s.detail))}`}
          hint="20 단계. 1 단계는 화면이 그릴 수 있는 가장 가는 선(1 화소)이고 단계마다 등비로 굵어집니다. 세밀함이 높을수록 더 가늘게 긋습니다"
          onChange={(step) => onChange({ lineWidth: PEN_WIDTHS[step - 1] })} />
      )}
      {/* 선 방향(기준 각도) 슬라이더는 두지 않는다 — 각도는 화풍 프리셋이 정하고, 바꿀 때는 툴바의 "방향 지시"로 직접 긋는다 */}
      {!isPaint && !isStipple && s.brush !== 'tone' && (
        <Range label="형태 따라가기" value={s.featureFollow} min={0} max={100}
          note={s.featureFollow < 25 ? '한 방향으로만' : s.featureFollow < 70 ? '반반' : '면의 방향을 따라'}
          hint="0 이면 화풍이 정한 한 방향으로만 긋고, 100 이면 면·경계의 방향을 그대로 따릅니다"
          onChange={(featureFollow) => onChange({ featureFollow })} />
      )}

      <details className="advanced">
        <summary>세부 조정 · 획 · 방향 · 색</summary>

        <div className="field">
          <div className="field-row"><b>기본 프리셋</b></div>
          <div className="chips">
            <button className={samePaint(s, RICHEON_PAINT) ? 'on' : ''} onClick={() => onChange({ ...RICHEON_PAINT })} title="가는 펜, 면 방향 획, 나뭇잎 고리선, 가장자리 여백 (@richeons_drawing_journey)">리천</button>
            <button className={samePaint(s, FINE_PAINT) ? 'on' : ''} onClick={() => onChange({ ...FINE_PAINT })} title="아주 가는 선, 끝까지 완성, 수평 하늘 해칭, 먹 그림자">세밀 펜화</button>
            <button className={samePaint(s, CLASSIC_PAINT) ? 'on' : ''} onClick={() => onChange({ ...CLASSIC_PAINT })} title="굵은 펜의 한 방향 해칭">클래식</button>
          </div>
        </div>

        <Range label="층 수" value={s.passes} min={1} max={6} unit="층" hint="획 크기를 줄여 가며 몇 번 겹쳐 그릴지" onChange={(passes) => onChange({ passes })} />
        <Range label="획 크기" value={s.brushSize} min={0} max={100} hint="첫 층의 획 길이·간격. 큰 형태를 잡는 획" onChange={(brushSize) => onChange({ brushSize })} />
        {!isStipple && <Range label="획 길이" value={s.strokeLength} min={0} max={100} hint="획 하나의 길이 (획 크기 배수)" onChange={(strokeLength) => onChange({ strokeLength })} />}
        <Range label="무작위성" value={s.randomness} min={0} max={100} hint="시작점·각도·길이·필압의 흔들림" onChange={(randomness) => onChange({ randomness })} />
        {!isPaint && (
          <Range label="원근 선 굵기" value={s.depth} min={0} max={100}
            note={s.depth < 10 ? '어디나 같게' : `먼 곳 약 ${mm(s.lineWidth * (1 - 0.78 * s.depth / 100))}mm`}
            hint="가까운 곳은 선 굵기 그대로, 먼 곳은 가늘게 긋습니다. 사진의 아래쪽·또렷한 곳을 가깝다고 봅니다"
            onChange={(depth) => onChange({ depth })} />
        )}
        <Range label="윤곽선" value={s.edges} min={0} max={100} hint="색 경계를 따라가는 선의 양" onChange={(edges) => onChange({ edges })} />
        <Range label="가장자리 여백" value={s.vignette} min={0} max={100} hint="가장자리를 미완성처럼 흐림 (어반 스케치)" onChange={(vignette) => onChange({ vignette })} />

        <div className="field">
          <div className="field-row"><b>종이 · 잉크색</b><span className="muted small">흑백일 때만</span></div>
          <div className="color-row">
            <label><input type="color" value={s.paperColor} onChange={(e) => onChange({ paperColor: e.target.value })} aria-label="종이색" /><span>종이</span></label>
            <label><input type="color" value={s.inkColor} onChange={(e) => onChange({ inkColor: e.target.value })} aria-label="잉크색" /><span>잉크</span></label>
          </div>
        </div>
      </details>
    </>
  );
}
