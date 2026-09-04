import { useObjectUrl } from '../hooks';
import type { Drawing } from '../types';
import type { ViewMode } from './Stage';
import { DownloadIcon, KeyIcon, PenIcon, StopIcon } from './Icons';

interface Props {
  providerLabel: string;
  keyOk: boolean;
  onOpenKeys: () => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  hasResult: boolean;
  history: Drawing[];
  currentId: string | null;
  onSelect: (d: Drawing) => void;
  canGenerate: boolean;
  busy: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onDownload: () => void;
}

function Thumb({ d, on, onClick }: { d: Drawing; on: boolean; onClick: () => void }) {
  const url = useObjectUrl(d.result);
  return (
    <button className={on ? 'on' : ''} onClick={onClick} title={new Date(d.createdAt).toLocaleString()} aria-label="이력 항목">
      {url && <img src={url} alt="" />}
    </button>
  );
}

export function Toolbar(p: Props) {
  return (
    <div className="toolbar">
      <button className="btn btn-ghost btn-sm" onClick={p.onOpenKeys} title="API 키 설정">
        <span className={`status-dot ${p.keyOk ? 'ok' : 'warn'}`} />
        <KeyIcon />
        <span>{p.keyOk ? p.providerLabel : 'API 키 연결'}</span>
      </button>

      <div className="sep" />

      <div className="view-seg" role="radiogroup" aria-label="보기">
        {(['compare', 'result', 'original'] as ViewMode[]).map((v) => (
          <button key={v} className={p.view === v ? 'on' : ''} role="radio" aria-checked={p.view === v} disabled={!p.hasResult && v !== 'original'} onClick={() => p.onView(v)}>
            {v === 'compare' ? '비교' : v === 'result' ? '결과' : '원본'}
          </button>
        ))}
      </div>

      {p.history.length > 0 && (
        <>
          <div className="sep" />
          <div className="hist" aria-label="이력">
            {p.history.slice(0, 5).map((d) => <Thumb key={d.id} d={d} on={d.id === p.currentId} onClick={() => p.onSelect(d)} />)}
          </div>
        </>
      )}

      <div className="sep" />
      <button className="btn btn-ghost btn-sm" onClick={p.onDownload} disabled={!p.hasResult} title="PNG 저장"><DownloadIcon /> 저장</button>

      {p.busy ? (
        <button className="btn btn-generate" onClick={p.onCancel}><StopIcon /> 중단</button>
      ) : (
        <button className="btn btn-primary btn-generate" onClick={p.onGenerate} disabled={!p.canGenerate}><PenIcon /> 드로잉 생성</button>
      )}
    </div>
  );
}
