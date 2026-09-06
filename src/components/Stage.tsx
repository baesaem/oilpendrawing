import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useObjectUrl } from '../hooks';
import type { PlacedStamp, StampItem } from '../stamps';
import type { DirectionGuide } from '../types';
import type { ProgressInfo, RawImage } from '../render';
import { Overlay, type GridSize } from './GridOverlay';

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
  /** 사진 위에 해칭 방향 지시선을 그리는 층 */
  direction?: DirectionProps;
  /** 로컬 엔진이 그리는 도중의 그림 (DAP 처럼 층이 쌓이는 과정을 보여 준다) */
  progress?: PaintProgress | null;
  /** 사진·결과 위에 겹쳐 보이는 격자 (가이드 1단계와 같은 값) */
  grid?: GridSize;
}

export interface PaintProgress { image: RawImage; info: ProgressInfo }

/** 그려지는 과정: 워커가 보낸 중간 그림을 캔버스에 바로 찍는다 (Blob 인코딩 없이) */
function LiveCanvas({ image }: { image: RawImage }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (c.width !== image.width || c.height !== image.height) { c.width = image.width; c.height = image.height; }
    c.getContext('2d')?.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0);
  }, [image]);
  return <canvas ref={ref} className="paint-canvas" aria-label="그리는 중인 드로잉" />;
}

export interface DirectionProps {
  guides: DirectionGuide[];
  editing: boolean;
  radius: number;
  onChange: (guides: DirectionGuide[]) => void;
  onRadius: (r: number) => void;
  onDone: () => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const newGuideId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * 해칭 방향 지시선 층. 사진 위에 선을 그으면 그 근처의 해칭이 그 방향을 따릅니다 (DAP 의 수동 Feature Follow).
 * 해칭선은 양쪽으로 뻗으므로 화살표 없이 선만 그립니다.
 */
function DirectionLayer({ d }: { d: DirectionProps }) {
  const layer = useRef<HTMLDivElement>(null);
  const drawing = useRef<Array<[number, number]> | null>(null);
  const [draft, setDraft] = useState<Array<[number, number]> | null>(null);
  const norm = (e: ReactPointerEvent<HTMLDivElement>): [number, number] => {
    const r = layer.current!.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!d.editing) return;
    drawing.current = [norm(e)];
    setDraft(drawing.current);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawing.current) return;
    const p = norm(e), last = drawing.current[drawing.current.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.006) return;
    drawing.current = [...drawing.current, p];
    setDraft(drawing.current);
  };
  const up = () => {
    if (drawing.current && drawing.current.length >= 2) d.onChange([...d.guides, { id: newGuideId(), points: drawing.current }]);
    drawing.current = null;
    setDraft(null);
  };
  const all = draft ? [...d.guides, { id: 'draft', points: draft }] : d.guides;
  return (
    <div className={`dir-layer ${d.editing ? 'editing' : ''}`} ref={layer} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        {all.map((g) => (
          <polyline key={g.id} points={g.points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')} fill="none"
            stroke={g.id === 'draft' ? '#f0c27a' : '#d9a25f'} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {d.editing && (
        <div className="dir-bar" onPointerDown={(e) => e.stopPropagation()}>
          <div className="dir-bar-text">
            <b>해칭 방향 지시</b>
            <span>사진 위에 선을 그으면 그 근처의 해칭이 그 방향을 따릅니다. 벽은 세로, 바닥은 원근선처럼요.</span>
          </div>
          <label className="dir-radius" title="지시선이 영향을 주는 범위">
            <span>영향 범위</span>
            <input type="range" min={5} max={50} value={d.radius} onChange={(e) => d.onRadius(Number(e.target.value))} aria-label="지시선 영향 범위" />
            <span className="muted">{d.radius}%</span>
          </label>
          <button className="btn btn-sm" onClick={() => d.onChange(d.guides.slice(0, -1))} disabled={!d.guides.length}>되돌리기</button>
          <button className="btn btn-sm btn-danger" onClick={() => d.onChange([])} disabled={!d.guides.length}>모두 지우기</button>
          <button className="btn btn-sm btn-primary" onClick={d.onDone}>완료</button>
        </div>
      )}
    </div>
  );
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
        <div key={p.id} className="stamp-drag" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.size * 100}%`, opacity: p.opacity ?? 0.95 }}
          onPointerDown={(e) => down(e, p)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} title="끌어서 옮기기">
          <img src={item.dataUrl} alt={item.name} draggable={false} />
        </div>
      ))}
    </div>
  );
}

export function Stage({ original, result, view, busy, toneFilter, wide, guide, live, stamps, onStampMove, onStampDrop, direction, progress, grid = 0 }: Props) {
  const oUrl = useObjectUrl(original);
  const rUrl = useObjectUrl(result);
  const [split, setSplit] = useState(55);
  // 포인터가 있는 가로 위치를 분할선으로 (덮개 전체가 손잡이다)
  const setSplitAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width > 0) setSplit(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };

  const showCompare = view === 'compare' && oUrl && rUrl;
  const showResult = view === 'result' && rUrl;
  const base = showResult ? rUrl : oUrl;

  if (guide) return <div className={`viewer guide ${wide ? 'wide' : ''}`}>{guide}</div>;

  return (
    <div className={`viewer ${wide ? 'wide' : ''}`}>
      {!oUrl ? (
        <div className="empty-stage">
          <h3>양평평생교육센터 오일펜(하근수 화가님) 드로잉</h3>
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
              {/*
                분할선 끌기. 옛 <input type=range> 는 브라우저가 손잡이를 요소 위쪽에 그려서
                가운데 원을 잡아도 안 움직였다 (사용자 제보). 직접 포인터를 받아 **화면 어디를 잡아도**
                끌리게 한다 — 가운데 원은 지금 위치를 보여 주는 표시일 뿐이다.
              */}
              <div
                className="compare-grab" role="slider" tabIndex={0} aria-label="비교 분할 위치"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split)}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setSplitAt(e); }}
                onPointerMove={(e) => { if (e.buttons & 1) setSplitAt(e); }}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 10 : 2;
                  if (e.key === 'ArrowLeft') { setSplit((v) => Math.max(0, v - step)); e.preventDefault(); }
                  if (e.key === 'ArrowRight') { setSplit((v) => Math.min(100, v + step)); e.preventDefault(); }
                }}
              />
            </>
          )}
          {busy && progress && <LiveCanvas image={progress.image} />}
          {busy && progress && (
            <div className="paint-progress" role="status" aria-live="polite">
              <div className="paint-progress-bar"><i style={{ width: `${Math.round(progress.info.frac * 100)}%` }} /></div>
              <span>{progress.info.pass + 1}/{progress.info.passes} 층{progress.info.label ? ` · ${progress.info.label}` : ''} · {Math.round(progress.info.frac * 100)}% · 획 {progress.info.strokes.toLocaleString()}개</span>
            </div>
          )}
          {busy && !progress && (
            <div className="busy" role="status">
              <div className="spinner" />
              <div>{busy}</div>
            </div>
          )}
          {!busy && live && <div className="live-tag" role="status"><div className="spinner" />다시 그리는 중</div>}
          {stamps && stamps.length > 0 && view !== 'original' && onStampMove && onStampDrop && !direction?.editing && (
            <StampLayer stamps={stamps} onMove={onStampMove} onDrop={onStampDrop} />
          )}
          {direction && (direction.editing || (direction.guides.length > 0 && view === 'original')) && <DirectionLayer d={direction} />}
          {grid > 0 && <Overlay grid={grid} aspect={null} imgW={0} imgH={0} />}
        </div>
      )}
    </div>
  );
}
