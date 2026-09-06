import { useEffect, useRef, useState } from 'react';
import { useObjectUrl } from '../hooks';
import { CompressIcon } from './Icons';
import { Overlay, type GridSize } from './GridOverlay';

interface Props {
  photo: Blob;
  result: Blob | null;
  grid: GridSize;
  onGrid: (g: GridSize) => void;
  /** 결과/원본 중 무엇을 보일지 */
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
  const shown = p.showResult && p.result ? p.result : p.photo;
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // G: 격자 칸 수 돌려 가며 바꾸기
      if (e.key === 'g' || e.key === 'G') p.onGrid(p.grid === 0 ? 3 : p.grid === 3 ? 4 : p.grid === 4 ? 6 : 0);
      poke();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const title = p.showResult && p.result ? '완성 참고 (스페이스: 원본)' : '원본 (스페이스: 결과)';

  return (
    <div className="fullscreen" ref={rootRef} onMouseMove={poke} onTouchStart={poke} onClick={p.onToggleResult}>
      <div className="fs-image">
        {url && (
          <div className="fs-frame">
            <img src={url} alt={title} draggable={false} style={p.showResult ? { filter: p.toneFilter } : undefined}
              onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            {p.grid > 0 && <Overlay grid={p.grid} aspect={null} imgW={dims.w} imgH={dims.h} />}
          </div>
        )}
      </div>

      <div className={`fs-chrome ${chromeVisible ? '' : 'hidden'}`} onClick={(e) => e.stopPropagation()}>
        <div className="fs-title">{title}</div>
        <div className="fs-controls">
          <select className="text-input select" value={p.grid} onChange={(e) => p.onGrid(Number(e.target.value) as GridSize)} aria-label="격자" style={{ height: 32, width: 'auto' }}>
            <option value={0}>격자 없음</option><option value={3}>3×3</option><option value={4}>4×4</option><option value={6}>6×6</option>
          </select>
          {p.result && (
            <button className="btn btn-sm" onClick={p.onToggleResult}>{p.showResult ? '원본 보기' : '결과 보기'}</button>
          )}
          <button className="btn btn-sm" onClick={p.onClose} title="닫기 (Esc)"><CompressIcon /> 닫기</button>
        </div>
      </div>
    </div>
  );
}
