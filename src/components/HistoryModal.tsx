import { useObjectUrl } from '../hooks';
import { STYLE_LABEL, type Drawing } from '../types';
import { DownloadIcon } from './Icons';

/**
 * 임시 저장(이력) 이미지를 모두 모아 보는 창.
 * 툴바 띠에는 최근 몇 개만 보이므로, 여기서 전부 보고 고르거나 낱장으로 저장한다.
 */
interface Props {
  history: Drawing[];
  currentId: string | null;
  onSelect: (d: Drawing) => void;
  onDownload: (d: Drawing) => void;
  onClose: () => void;
}

function Cell({ d, on, onSelect, onDownload }: { d: Drawing; on: boolean; onSelect: () => void; onDownload: () => void }) {
  const url = useObjectUrl(d.result);
  const when = new Date(d.createdAt);
  return (
    <div className={`hist-cell${on ? ' on' : ''}`}>
      <button className="hist-pick" onClick={onSelect} title="이 결과를 화면으로 불러옵니다">
        {url && <img src={url} alt="" loading="lazy" />}
      </button>
      <div className="hist-meta">
        <span>{STYLE_LABEL[d.params.style] ?? d.params.style}</span>
        <span className="muted small">{when.toLocaleDateString()} {when.toLocaleTimeString().slice(0, 5)}{d.engine === 'ai' ? ' · AI' : ''}</span>
      </div>
      <button className="hist-save" onClick={onDownload} title="이 그림만 PNG 로 저장" aria-label="이 그림 저장"><DownloadIcon /></button>
    </div>
  );
}

export function HistoryModal({ history, currentId, onSelect, onDownload, onClose }: Props) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog-wide" role="dialog" aria-modal="true" aria-label="임시 저장 이미지" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>임시 저장 이미지 <span className="muted small">{history.length}장</span></h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button>
        </div>
        <div className="hist-grid">
          {history.map((d) => (
            <Cell key={d.id} d={d} on={d.id === currentId}
              onSelect={() => { onSelect(d); onClose(); }} onDownload={() => onDownload(d)} />
          ))}
        </div>
        <div className="small muted">그림을 누르면 화면으로 불러옵니다. 오른쪽 아래 ⤓ 로 그 그림만 저장합니다. 최근 {history.length}장이 이 브라우저에 남아 있습니다.</div>
      </div>
    </div>
  );
}
