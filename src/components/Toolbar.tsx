import { useObjectUrl } from '../hooks';
import type { Drawing } from '../types';
import type { ViewMode } from './Stage';
import type { GridSize } from './GridOverlay';
import { DirectionIcon, DownloadIcon, ExpandIcon, KeyIcon, PenIcon, StopIcon } from './Icons';

interface Props {
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
  /** 격자 (가이드와 같은 값을 쓴다 — 드로잉 화면에도 겹쳐 보인다) */
  grid: GridSize;
  onGrid: (g: GridSize) => void;
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
      <button className={`btn btn-ghost btn-sm ${p.directionEditing ? 'on-accent' : ''}`} disabled={!p.hasPhoto} onClick={p.onToggleDirection}
        title="사진 위에 해칭 방향을 직접 그립니다. 그 근처의 해칭이 그 방향을 따릅니다" aria-pressed={p.directionEditing}>
        <DirectionIcon /> 방향 지시{p.guideCount > 0 && <span className="badge">{p.guideCount}</span>}
      </button>
      {/* 격자: 사진·결과 위에 겹쳐 보여 칸을 보고 스케치북에 옮겨 그릴 수 있다 */}
      <select className="text-input select grid-select" value={p.grid} disabled={!p.hasPhoto}
        onChange={(e) => p.onGrid(Number(e.target.value) as GridSize)} aria-label="격자" title="사진·결과 위에 격자를 겹쳐 봅니다">
        <option value={0}>격자 없음</option><option value={3}>3×3</option><option value={4}>4×4</option><option value={6}>6×6</option>
      </select>

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

    </div>
  );
}

/** 보기 전환 (비교 · 결과 · 원본). 그리기 버튼과 함께 화면 위 제목 옆에 둔다 */
export function ViewSeg(p: Pick<Props, 'view' | 'onView' | 'hasResult'>) {
  return (
    <div className="view-seg" role="radiogroup" aria-label="보기">
      {(['compare', 'result', 'original'] as ViewMode[]).map((v) => (
        <button key={v} className={p.view === v ? 'on' : ''} role="radio" aria-checked={p.view === v} disabled={!p.hasResult && v !== 'original'} onClick={() => p.onView(v)}>
          {v === 'compare' ? '비교' : v === 'result' ? '결과' : '원본'}
        </button>
      ))}
    </div>
  );
}

/**
 * 그리기 버튼들 (그리기 시작 · AI로 그리기 · 중단).
 * 아래 툴바가 아니라 **화면 위 제목 오른쪽**에 둔다 — 가장 자주 누르는 버튼이라 눈에 먼저 들어와야 한다.
 */
export function DrawActions(p: Pick<Props, 'busy' | 'progress' | 'canDraw' | 'onDraw' | 'canAi' | 'onAi' | 'onCancel' | 'keyOk'>) {
  if (p.busy) {
    return (
      <button className="btn btn-generate" onClick={p.onCancel}><StopIcon /> 중단{p.progress != null && <span className="muted"> · {Math.round(p.progress * 100)}%</span>}</button>
    );
  }
  return (
    <>
      <button className="btn btn-primary btn-generate" onClick={p.onDraw} disabled={!p.canDraw} title="브라우저에서 층을 쌓아 가며 그립니다 (API 비용 없음)"><PenIcon /> 그리기 시작</button>
      <button className="btn btn-generate btn-ai" onClick={p.onAi} disabled={!p.canAi} title={p.keyOk ? 'AI 제공사에 요청합니다 (API 비용)' : 'API 키를 연결하면 쓸 수 있습니다'}>AI로 그리기</button>
    </>
  );
}
