import { useEffect, useRef, useState } from 'react';
import { PAPER_ASPECT, type PaperRatio } from '../guide';
import { useObjectUrl } from '../hooks';
import { GUIDE_STEPS, type GuideStep } from '../tips';
import { useGuideImage } from '../useGuideImage';
import type { DrawingParams } from '../types';
import { ChevronLeft, ChevronRight, CompressIcon } from './Icons';
import { Overlay, type GridSize } from './GuideView';
import type { Mode } from './Toolbar';

interface Props {
  mode: Mode;
  photo: Blob;
  result: Blob | null;
  process: Blob | null;
  showProcess: boolean;
  params: DrawingParams;
  step: GuideStep;
  onStep: (s: GuideStep) => void;
  grid: GridSize;
  onGrid: (g: GridSize) => void;
  paper: PaperRatio;
  /** 드로잉 모드에서 결과/원본 중 무엇을 보일지 */
  showResult: boolean;
  onToggleResult: () => void;
  toneFilter: string;
  onClose: () => void;
}

/**
 * 태블릿을 스케치북 옆에 세워 두고 쓰는 전체화면.
 * 브라우저 전체화면 API와 화면 꺼짐 방지(Wake Lock)는 되는 환경에서만 조용히 켭니다.
 */
export function FullscreenView(p: Props) {
  const guide = useGuideImage({
    photo: p.photo, result: p.result, process: p.process, showProcess: p.showProcess, step: p.step, level: p.params.level,
  });
  const drawBlob = p.showResult && p.result ? p.result : p.photo;
  const shown = p.mode === 'guide' ? guide.blob : drawBlob;
  const url = useObjectUrl(shown);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // 브라우저 전체화면 + 화면 꺼짐 방지
  useEffect(() => {
    const el = rootRef.current;
    el?.requestFullscreen?.().catch(() => {});
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    const onFsChange = () => { if (!document.fullscreenElement) p.onClose(); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      lock?.release().catch(() => {});
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 조작이 없으면 조작 막대를 숨기고, 움직이면 다시 보입니다
  const poke = () => {
    setChromeVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChromeVisible(false), 3500);
  };
  useEffect(() => { poke(); return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }; }, []);

  const stepIndex = GUIDE_STEPS.findIndex((s) => s.id === p.step);
  const go = (d: number) => {
    const next = GUIDE_STEPS[stepIndex + d];
    if (next) p.onStep(next.id);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && p.mode === 'guide') go(1);
      else if (e.key === 'ArrowLeft' && p.mode === 'guide') go(-1);
      else if (e.key === 'g' || e.key === 'G') p.onGrid(p.grid === 0 ? 3 : p.grid === 3 ? 4 : p.grid === 4 ? 6 : 0);
      poke();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const overlayOn = p.mode === 'guide' && !(p.step === 'final' && p.showProcess);
  const title = p.mode === 'guide'
    ? `${GUIDE_STEPS[stepIndex].label} · ${GUIDE_STEPS[stepIndex].short}`
    : p.showResult && p.result ? '완성 참고 (스페이스: 원본)' : '원본 (스페이스: 결과)';

  return (
    <div className="fullscreen" ref={rootRef} onMouseMove={poke} onTouchStart={poke} onClick={p.mode === 'draw' ? p.onToggleResult : undefined}>
      <div className="fs-image">
        {url && (
          <div className="fs-frame">
            <img src={url} alt={title} draggable={false} style={p.mode === 'draw' && p.showResult ? { filter: p.toneFilter } : undefined}
              onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            {overlayOn && <Overlay grid={p.grid} aspect={PAPER_ASPECT[p.paper]} imgW={dims.w} imgH={dims.h} />}
          </div>
        )}
        {guide.working && p.mode === 'guide' && <div className="busy"><div className="spinner" /></div>}
      </div>

      <div className={`fs-chrome ${chromeVisible ? '' : 'hidden'}`} onClick={(e) => e.stopPropagation()}>
        <div className="fs-title">{title}</div>
        <div className="fs-controls">
          {p.mode === 'guide' && (
            <>
              <button className="btn btn-sm" onClick={() => go(-1)} disabled={stepIndex === 0} aria-label="이전 단계"><ChevronLeft /></button>
              <div className="steps">
                {GUIDE_STEPS.map((s, i) => (
                  <button key={s.id} className={p.step === s.id ? 'on' : ''} onClick={() => p.onStep(s.id)}><span className="n">{i + 1}</span>{s.label.replace(/^\d\s/, '')}</button>
                ))}
              </div>
              <button className="btn btn-sm" onClick={() => go(1)} disabled={stepIndex === GUIDE_STEPS.length - 1} aria-label="다음 단계"><ChevronRight /></button>
              <select className="text-input select" value={p.grid} onChange={(e) => p.onGrid(Number(e.target.value) as GridSize)} aria-label="격자" style={{ height: 32, width: 'auto' }}>
                <option value={0}>격자 없음</option><option value={3}>3×3</option><option value={4}>4×4</option><option value={6}>6×6</option>
              </select>
            </>
          )}
          {p.mode === 'draw' && p.result && (
            <button className="btn btn-sm" onClick={p.onToggleResult}>{p.showResult ? '원본 보기' : '결과 보기'}</button>
          )}
          <button className="btn btn-sm" onClick={p.onClose} title="닫기 (Esc)"><CompressIcon /> 닫기</button>
        </div>
      </div>
    </div>
  );
}
