import { useState, type ReactNode } from 'react';
import { useObjectUrl } from '../hooks';

export type ViewMode = 'compare' | 'result' | 'original';

interface Props {
  original: Blob | null;
  result: Blob | null;
  view: ViewMode;
  busy: string | null;
  toneFilter: string;
  wide: boolean;
  /** 가이드 모드일 때 뷰어 안에 대신 그릴 내용 */
  guide?: ReactNode;
}

export function Stage({ original, result, view, busy, toneFilter, wide, guide }: Props) {
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
          <p>왼쪽에 사진을 올리면 격자·윤곽선·명암 단계로 나눠 보여 주는 <b>그리기 가이드</b>를 바로 쓸 수 있습니다. 오른쪽에서 화풍·숙련도·빛의 방향을 고르고 생성을 누르면 따라 그릴 완성 참고 드로잉이 만들어집니다.</p>
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
