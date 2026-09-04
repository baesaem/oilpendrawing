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
  /** 슬라이더 조절로 다시 그리는 중 (화면을 가리지 않는 작은 표시) */
  live?: boolean;
  /** 가이드 모드일 때 뷰어 안에 대신 그릴 내용 */
  guide?: ReactNode;
}

export function Stage({ original, result, view, busy, toneFilter, wide, guide, live }: Props) {
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
          <p>왼쪽에 사진을 올리면 격자·윤곽선·명암 단계로 나눠 보여 주는 <b>그리기 가이드</b>를 바로 쓸 수 있습니다. "드로잉 만들기"를 누르면 브라우저가 사진을 펜 드로잉으로 바꿔 따라 그릴 완성 참고를 만듭니다. 견본 드로잉을 올리면 그 선·톤을 읽어 같은 기법으로 그립니다.</p>
          <p className="small faint">AI 생성은 선택 기능입니다. API 키를 연결하면 "AI로 그리기"가 켜집니다.</p>
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
          {!busy && live && <div className="live-tag" role="status"><div className="spinner" />다시 그리는 중</div>}
        </div>
      )}
    </div>
  );
}
