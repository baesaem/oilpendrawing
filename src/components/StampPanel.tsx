import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CloseIcon } from './Icons';
import { STAMP_LABEL, STAMP_LIMIT, sealFromText, signFromCanvas, stampFromFile, type PlacedStamp, type StampItem, type StampKind } from '../stamps';

interface Props {
  items: StampItem[];
  placed: PlacedStamp[];
  hasResult: boolean;
  onAddItem: (item: StampItem) => void;
  onRemoveItem: (id: string) => void;
  onPlace: (item: StampItem) => void;
  onUnplace: (placedId: string) => void;
  onResize: (placedId: string, size: number) => void;
}

/** 마우스·터치로 사인을 그리는 작은 판 */
function SignPad({ onDone, onClose }: { onDone: (item: StampItem) => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  const pos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = true; last.current = pos(e);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = ref.current!.getContext('2d')!;
    const p = pos(e);
    ctx.strokeStyle = '#17171a'; ctx.lineWidth = e.pressure > 0 ? 3 + e.pressure * 5 : 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p; setEmpty(false);
  };
  const up = () => { drawing.current = false; last.current = null; };
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setEmpty(true); };
  const done = () => { const it = signFromCanvas(ref.current!); if (it) onDone(it); };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 92vw)' }}>
        <div className="panel-head"><h2>사인 그리기</h2><button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="닫기"><CloseIcon /></button></div>
        <p className="muted" style={{ margin: 0 }}>마우스나 펜으로 사인을 그리세요. 태블릿에서는 손가락으로도 됩니다.</p>
        <canvas ref={ref} width={900} height={360} className="sign-pad"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
        <div className="dialog-actions">
          <button className="btn" onClick={clear}>지우기</button>
          <button className="btn btn-primary" onClick={done} disabled={empty}>등록</button>
        </div>
      </div>
    </div>
  );
}

function Group({ kind, items, placed, hasResult, onAddItem, onRemoveItem, onPlace, onUnplace, onResize }: Props & { kind: StampKind }) {
  const mine = items.filter((i) => i.kind === kind);
  const limit = STAMP_LIMIT[kind];
  const [text, setText] = useState('');
  const [pad, setPad] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (f: File | null) => {
    if (!f) return;
    setErr(null); setBusy(true);
    try { onAddItem(await stampFromFile(f, kind)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="field">
      <div className="field-row"><b>{STAMP_LABEL[kind]}</b><span className="muted small">{mine.length}/{limit}</span></div>
      <div className="stamp-list">
        {mine.map((it) => {
          const on = placed.filter((p) => p.stampId === it.id);
          return (
            <div key={it.id} className={`stamp-item ${on.length ? 'on' : ''}`}>
              <button className="stamp-thumb" onClick={() => (on.length ? onUnplace(on[0].id) : onPlace(it))} disabled={!hasResult}
                title={!hasResult ? '먼저 드로잉을 만드세요' : on.length ? '그림에서 빼기' : '그림에 놓기'}>
                <img src={it.dataUrl} alt={it.name} />
              </button>
              <div className="stamp-meta">
                <span title={it.name}>{it.name}</span>
                {on.length > 0 && (
                  <input type="range" min={kind === 'seal' ? 0.03 : 0.08} max={kind === 'seal' ? 0.2 : 0.45} step={0.005} value={on[0].size}
                    onChange={(e) => onResize(on[0].id, Number(e.target.value))} aria-label="크기" />
                )}
                <button className="link" onClick={() => onRemoveItem(it.id)}>삭제</button>
              </div>
            </div>
          );
        })}
      </div>
      {mine.length < limit && (
        <div className="stamp-add">
          <label className="btn btn-sm">
            {busy ? '처리 중…' : '사진 올리기'}
            <input type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          </label>
          {kind === 'seal' ? (
            <>
              <input className="text-input" value={text} maxLength={4} placeholder="글자 1~4" onChange={(e) => setText(e.target.value)} aria-label="낙관 글자" style={{ flex: 1, height: 30 }} />
              <button className="btn btn-sm" disabled={!text.trim()} onClick={() => { onAddItem(sealFromText(text)); setText(''); }}>글자로</button>
            </>
          ) : (
            <button className="btn btn-sm" onClick={() => setPad(true)}>직접 그리기</button>
          )}
        </div>
      )}
      {err && <div className="small warn-text">{err}</div>}
      {pad && <SignPad onDone={(it) => { onAddItem(it); setPad(false); }} onClose={() => setPad(false)} />}
    </div>
  );
}

/** 낙관 2개·사인 3개를 등록해 두고, 결과 그림 위에 놓고 끌어서 옮깁니다 */
export function StampPanel(p: Props) {
  const anyPlaced = p.placed.length > 0;
  // 등록 항목이 지워지면 배치도 정리
  useEffect(() => {
    for (const pl of p.placed) if (!p.items.some((it) => it.id === pl.stampId)) p.onUnplace(pl.id);
  }, [p]);
  return (
    <>
      <div className="panel-head">
        <h2>낙관 · 사인</h2>
        <span className="small muted">{anyPlaced ? '그림 위에서 끌어서 옮기세요' : '등록 후 눌러서 놓기'}</span>
      </div>
      <Group kind="seal" {...p} />
      <Group kind="sign" {...p} />
      <div className="small faint">사진으로 올리면 종이 배경은 자동으로 지워집니다. 등록한 것은 이 브라우저에만 저장됩니다.</div>
    </>
  );
}
