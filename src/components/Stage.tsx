import { useState } from 'react';
import { useObjectUrl } from '../hooks';

export type ViewMode = 'compare' | 'result' | 'original';

interface Props {
  original: Blob | null;
  result: Blob | null;
  view: ViewMode;
  busy: string | null;
  toneFilter: string;
  wide: boolean;
}

export function Stage({ original, result, view, busy, toneFilter, wide }: Props) {
  const oUrl = useObjectUrl(original);
  const rUrl = useObjectUrl(result);
  const [split, setSplit] = useState(55);

  const showCompare = view === 'compare' && oUrl && rUrl;
  const showResult = view === 'result' && rUrl;
  const base = showResult ? rUrl : oUrl;

  return (
    <div className={`viewer ${wide ? 'wide' : ''}`}>
      {!oUrl ? (
        <div className="empty-stage">
          <h3>사진 한 장으로 시작합니다</h3>
          <p>왼쪽 패널에 원본 사진을 올리고, 오른쪽에서 숙련도·강도·빛의 방향을 고른 뒤 생성을 누르세요. 견본 드로잉을 함께 올리면 그 스타일을 따릅니다.</p>
          <p className="small faint">스페이스바: 결과 ↔ 원본 전환 · 결과는 이 브라우저에만 저장됩니다</p>
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
        </div>
      )}
    </div>
  );
}
