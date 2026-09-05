import { useObjectUrl } from '../hooks';
import type { Drawing } from '../types';
import type { ViewMode } from './Stage';
import { DirectionIcon, DownloadIcon, ExpandIcon, KeyIcon, PenIcon, StopIcon } from './Icons';

export type Mode = 'draw' | 'guide';

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  hasPhoto: boolean;
  providerLabel: string;
  keyOk: boolean;
  onOpenKeys: () => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  hasResult: boolean;
  history: Drawing[];
  currentId: string | null;
  onSelect: (d: Drawing) => void;
  /** 로컬 렌더러로 그리기 (기본) */
  canDraw: boolean;
  onDraw: () => void;
  /** AI 로 그리기 (선택, 키 필요) */
  canAi: boolean;
  onAi: () => void;
  busy: boolean;
  /** 로컬 엔진 진행률 0~1 (그리는 중일 때) */
  progress?: number | null;
  onCancel: () => void;
  onDownload: () => void;
  onFullscreen: () => void;
  /** 해칭 방향 지시선 그리기 모드 */
  directionEditing: boolean;
  guideCount: number;
  onToggleDirection: () => void;
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
        <span className={`status-dot ${p.keyOk ? 'ok' : ''}`} />
        <KeyIcon />
        <span>{p.keyOk ? p.providerLabel : 'AI 키 (선택)'}</span>
      </button>

      <div className="sep" />

      <div className="mode-seg" role="radiogroup" aria-label="모드">
        <button className={p.mode === 'draw' ? 'on' : ''} role="radio" aria-checked={p.mode === 'draw'} onClick={() => p.onMode('draw')}>드로잉</button>
        <button className={p.mode === 'guide' ? 'on' : ''} role="radio" aria-checked={p.mode === 'guide'} disabled={!p.hasPhoto} onClick={() => p.onMode('guide')} title="사진을 격자·윤곽·명암 단계로 나눠 보며 그립니다">그리기 가이드</button>
      </div>

      {p.mode === 'draw' && (
        <>
          <div className="sep" />
          <div className="view-seg" role="radiogroup" aria-label="보기">
            {(['compare', 'result', 'original'] as ViewMode[]).map((v) => (
              <button key={v} className={p.view === v ? 'on' : ''} role="radio" aria-checked={p.view === v} disabled={!p.hasResult && v !== 'original'} onClick={() => p.onView(v)}>
                {v === 'compare' ? '비교' : v === 'result' ? '결과' : '원본'}
              </button>
            ))}
          </div>
          <button className={`btn btn-ghost btn-sm ${p.directionEditing ? 'on-accent' : ''}`} disabled={!p.hasPhoto} onClick={p.onToggleDirection}
            title="사진 위에 해칭 방향을 직접 그립니다. 그 근처의 해칭이 그 방향을 따릅니다" aria-pressed={p.directionEditing}>
            <DirectionIcon /> 방향 지시{p.guideCount > 0 && <span className="badge">{p.guideCount}</span>}
          </button>
        </>
      )}

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
      <button className="btn btn-ghost btn-sm" onClick={p.onFullscreen} disabled={!p.hasPhoto} title="전체화면 (F)"><ExpandIcon /> 전체화면</button>

      {p.busy ? (
        <button className="btn btn-generate" onClick={p.onCancel}><StopIcon /> 중단{p.progress != null && <span className="muted"> · {Math.round(p.progress * 100)}%</span>}</button>
      ) : (
        <>
          <button className="btn btn-primary btn-generate" onClick={p.onDraw} disabled={!p.canDraw} title="브라우저에서 층을 쌓아 가며 그립니다 (API 비용 없음)"><PenIcon /> 그리기 시작</button>
          <button className="btn btn-generate btn-ai" onClick={p.onAi} disabled={!p.canAi} title={p.keyOk ? 'AI 제공사에 요청합니다 (API 비용)' : 'API 키를 연결하면 쓸 수 있습니다'}>AI로 그리기</button>
        </>
      )}
    </div>
  );
}
