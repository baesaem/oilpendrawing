import { useEffect, useRef, useState, type ReactElement } from 'react';
import { PAPER_ASPECT, PAPER_LABEL, VALUE_LEVELS, type PaperRatio } from '../guide';
import { useGuideImage } from '../useGuideImage';
import { useObjectUrl } from '../hooks';
import { buildTip, GUIDE_STEPS, type GuideStep } from '../tips';
import type { DrawingParams } from '../types';

export type GridSize = 0 | 3 | 4 | 6;

interface Props {
  photo: Blob;
  result: Blob | null;
  process: Blob | null;
  params: DrawingParams;
  step: GuideStep;
  onStep: (s: GuideStep) => void;
  grid: GridSize;
  onGrid: (g: GridSize) => void;
  paper: PaperRatio;
  onPaper: (p: PaperRatio) => void;
  showProcess: boolean;
  onShowProcess: (v: boolean) => void;
  onMakeProcess: () => void;
  busy: string | null;
  keyOk: boolean;
}

/** 격자 + 용지 비율 틀 오버레이 */
export function Overlay({ grid, aspect, imgW, imgH }: { grid: GridSize; aspect: number | null; imgW: number; imgH: number }) {
  // 용지 비율에 맞춰 이미지 안에 들어가는 최대 사각형
  let fx = 0, fy = 0, fw = 100, fh = 100;
  if (aspect && imgW && imgH) {
    const imgAspect = imgW / imgH;
    if (aspect < imgAspect) { fw = (aspect / imgAspect) * 100; fx = (100 - fw) / 2; }
    else { fh = (imgAspect / aspect) * 100; fy = (100 - fh) / 2; }
  }
  const lines: ReactElement[] = [];
  if (grid) {
    for (let i = 1; i < grid; i++) {
      const x = fx + (fw * i) / grid, y = fy + (fh * i) / grid;
      lines.push(<line key={`v${i}`} x1={x} y1={fy} x2={x} y2={fy + fh} />);
      lines.push(<line key={`h${i}`} x1={fx} y1={y} x2={fx + fw} y2={y} />);
    }
  }
  return (
    <svg className="grid-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {aspect && (
        <path d={`M0 0H100V100H0Z M${fx} ${fy}H${fx + fw}V${fy + fh}H${fx}Z`} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
      )}
      {aspect && <rect x={fx} y={fy} width={fw} height={fh} fill="none" stroke="#d9a25f" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />}
      <g stroke="rgba(217,162,95,0.85)" strokeWidth="0.25" vectorEffect="non-scaling-stroke">{lines}</g>
    </svg>
  );
}

export function GuideView(p: Props) {
  const [dims, setDims] = useState({ w: 0, h: 0 });
  // 그림이 팁 상자를 덮지 않도록, 남는 공간 높이를 측정해 이미지 최대 높이로 씁니다.
  const frameRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number>(600);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setMaxH(Math.max(120, Math.floor(entry.contentRect.height))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { blob: shown, working } = useGuideImage({
    photo: p.photo, result: p.result, process: p.process, showProcess: p.showProcess, step: p.step, level: p.params.level,
  });
  const url = useObjectUrl(shown);
  const tips = buildTip(p.step, p.params.level, p.params.style, p.params.light, p.params.artist);
  const stepMeta = GUIDE_STEPS.find((s) => s.id === p.step)!;
  const overlayOn = p.step !== 'final' || !p.showProcess;

  return (
    <>
      <div className="guide-bar">
        <div className="steps" role="tablist" aria-label="그리기 단계">
          {GUIDE_STEPS.map((s, i) => (
            <button key={s.id} role="tab" aria-selected={p.step === s.id} className={p.step === s.id ? 'on' : ''} onClick={() => p.onStep(s.id)}>
              <span className="n">{i + 1}</span>{s.label.replace(/^\d\s/, '')}
            </button>
          ))}
        </div>
        <div className="guide-opts">
          <select className="text-input select" value={p.grid} onChange={(e) => p.onGrid(Number(e.target.value) as GridSize)} aria-label="격자">
            <option value={0}>격자 없음</option><option value={3}>3×3 격자</option><option value={4}>4×4 격자</option><option value={6}>6×6 격자</option>
          </select>
          <select className="text-input select" value={p.paper} onChange={(e) => p.onPaper(e.target.value as PaperRatio)} aria-label="용지 비율">
            {(Object.keys(PAPER_LABEL) as PaperRatio[]).map((k) => <option key={k} value={k}>{PAPER_LABEL[k]}</option>)}
          </select>
        </div>
      </div>

      <div className="guide-frame" ref={frameRef}>
        <div className="frame">
          {url ? (
            <img src={url} alt={stepMeta.short} draggable={false} style={{ maxHeight: maxH }} onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
          ) : (
            <div style={{ width: 640, height: Math.min(420, maxH) }} />
          )}
          {url && overlayOn && <Overlay grid={p.grid} aspect={PAPER_ASPECT[p.paper]} imgW={dims.w} imgH={dims.h} />}
          {(working || p.busy) && (
            <div className="busy" role="status"><div className="spinner" /><div>{p.busy ?? '사진 분석 중…'}</div></div>
          )}
        </div>
      </div>

      <div className="guide-tip">
        <div className="tip-head">
          <b>{stepMeta.label} · {stepMeta.short}{p.step === 'value' ? ` (${VALUE_LEVELS[p.params.level]}단계)` : ''}</b>
          {p.step === 'final' && (
            <div className="guide-opts">
              {p.process && (
                <button className="btn btn-sm" onClick={() => p.onShowProcess(!p.showProcess)}>{p.showProcess ? '완성 참고 보기' : '과정 그림 보기'}</button>
              )}
              <button className="btn btn-sm" onClick={p.onMakeProcess} disabled={!!p.busy || !p.keyOk} title={p.keyOk ? 'AI에게 4단계 과정을 한 장으로 그려 달라고 요청합니다' : 'API 키를 먼저 연결하세요'}>
                {p.process ? '과정 그림 다시 만들기' : '과정 그림 만들기 (API 1회)'}
              </button>
            </div>
          )}
        </div>
        {p.step === 'final' && !p.result && <p className="sub">아직 드로잉이 없습니다. 하단의 "드로잉 만들기"를 누르면 이 단계에 완성 참고가 표시됩니다.</p>}
        {tips.map((t, i) => <p key={i} className={i === 0 ? '' : 'sub'}>{t}</p>)}
      </div>
    </>
  );
}
