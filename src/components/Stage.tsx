import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useObjectUrl } from '../hooks';
import type { PlacedStamp, StampItem } from '../stamps';

export type ViewMode = 'compare' | 'result' | 'original';

interface Props {
  original: Blob | null;
  result: Blob | null;
  view: ViewMode;
  busy: string | null;
  toneFilter: string;
  wide: boolean;
  /** 슬라이더 조절로 다시 그리는 중 (화면을 가리지 않는 작은 표시) */
  live?: boolean;
  /** 가이드 모드일 때 뷰어 안에 대신 그릴 내용 */
  guide?: ReactNode;
  /** 결과 위에 끌어서 옮기는 낙관·사인 */
  stamps?: Array<{ placed: PlacedStamp; item: StampItem }>;
  onStampMove?: (placedId: string, x: number, y: number) => void;
  onStampDrop?: () => void;
}

/** 결과 이미지 위에 놓인 낙관·사인. 끌면 상대 좌표로 위치를 알립니다 */
function StampLayer({ stamps, onMove, onDrop }: { stamps: Array<{ placed: PlacedStamp; item: StampItem }>; onMove: (id: string, x: number, y: number) => void; onDrop: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const down = (e: ReactPointerEvent<HTMLDivElement>, p: PlacedStamp) => {
    const r = layer.current!.getBoundingClientRect();
    drag.current = { id: p.id, dx: (e.clientX - r.left) / r.width - p.x, dy: (e.clientY - r.top) / r.height - p.y };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    e.preventDefault(); e.stopPropagation();
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const r = layer.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width - drag.current.dx));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height - drag.current.dy));
    onMove(drag.current.id, x, y);
  };
  const up = () => { if (drag.current) { drag.current = null; onDrop(); } };
  return (
    <div className="stamp-layer" ref={layer}>
      {stamps.map(({ placed: p, item }) => (
        <div key={p.id} className="stamp-drag" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.size * 100}%` }}
          onPointerDown={(e) => down(e, p)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} title="끌어서 옮기기">
          <img src={item.dataUrl} alt={item.name} draggable={false} />
        </div>
      ))}
    </div>
  );
}

export function Stage({ original, result, view, busy, toneFilter, wide, guide, live, stamps, onStampMove, onStampDrop }: Props) {
  const oUrl = useObjectUrl(original);
  const rUrl = useObjectUrl(result);
  const [split, setSplit] = useState(55);

  const showCompare = view === 'compare' && oUrl && rUrl;
  const showResult = view === 'result' && rUrl;
  const base = showResult ? rUrl : oUrl;

  if (guide) return <div className={`viewer guide ${wide ? 'wide' : ''}`}>{guide}</div>;

  return (
    <div className={`viewer ${wide ? 'wide' : ''}`}>
      {!oUrl ? (
        <div className="empty-stage">
          <h3>사진을 보고 스케치북에 그릴 때 옆에 두는 참고서</h3>
        </div>
      ) : (
        <div className="frame">
          <img src={base ?? oUrl} alt={showResult ? '드로잉 결과' : '원본'} style={showResult ? { filter: toneFilter } : undefined} draggable={false} />
          {showCompare && (
            <>
              <div className="layer" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                <img src={rUrl} alt="드로잉 결과" style={{ filter: toneFilter }} draggable={false} />
              </div>
              <div className="divider" style={{ left: `${split}%` }} />
              <span className="tag tag-left">드로잉</span>
              <span className="tag tag-right">원본</span>
              <input
                className="compare-range" type="range" min={0} max={100} value={split}
                onChange={(e) => setSplit(Number(e.target.value))} aria-label="비교 분할 위치"
              />
            </>
          )}
          {busy && (
            <div className="busy" role="status">
              <div className="spinner" />
              <div>{busy}</div>
            </div>
          )}
          {!busy && live && <div className="live-tag" role="status"><div className="spinner" />다시 그리는 중</div>}
          {stamps && stamps.length > 0 && view !== 'original' && onStampMove && onStampDrop && (
            <StampLayer stamps={stamps} onMove={onStampMove} onDrop={onStampDrop} />
          )}
        </div>
      )}
    </div>
  );
}
