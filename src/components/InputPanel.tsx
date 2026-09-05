import { useState, type DragEvent } from 'react';
import { useObjectUrl } from '../hooks';
import type { DrawingParams } from '../types';
import { ImageIcon } from './Icons';

interface DropProps {
  blob: Blob | null;
  onFile: (f: File | null) => void;
  className: string;
  emptyTitle: string;
  emptyHint: string;
  label: string;
}

function Drop({ blob, onFile, className, emptyTitle, emptyHint, label }: DropProps) {
  const url = useObjectUrl(blob);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) onFile(f);
  };
  return (
    <div
      className={`drop ${className} ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {url ? (
        <img src={url} alt={label} />
      ) : (
        <div className="drop-empty">
          <ImageIcon width={22} height={22} />
          <div>{emptyTitle}</div>
          <div className="faint">{emptyHint}</div>
        </div>
      )}
      <input type="file" accept="image/*" aria-label={label} onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
    </div>
  );
}

interface Props {
  input: File | null;
  reference: File | null;
  inputIsGray: boolean | null;
  params: DrawingParams;
  onParams: (patch: Partial<DrawingParams>) => void;
  onInput: (f: File | null) => void;
  onReference: (f: File | null) => void;
  /** 밖에서 만든 그림(Dynamic Auto-Painter 등)을 이 사진의 완성 참고로 불러오기 */
  onExternal: (f: File | null) => void;
  /** 견본 분석 상태: null = 아직, 문자열 = 요약 */
  analysis: { busy: boolean; summary: string | null; warning?: string };
  /** 로컬 결과가 떠 있는지 (AI 견본으로 보낼 수 있는지) */
  hasLocal: boolean;
  keyOk: boolean;
}

export function InputPanel({ input, reference, inputIsGray, params, onParams, onInput, onReference, onExternal, analysis, hasLocal, keyOk }: Props) {
  return (
    <>
      <div className="field">
        <div className="panel-head">
          <h2>원본 이미지</h2>
          <span className="small muted">
            {input ? (inputIsGray === null ? '분석 중' : inputIsGray ? '흑백 사진' : '컬러 사진') : ''}
          </span>
        </div>
        <Drop
          blob={input} onFile={onInput} className="drop-lg" label="원본 이미지"
          emptyTitle="사진을 끌어다 놓거나 클릭" emptyHint="JPG · PNG · WEBP · HEIC(브라우저 지원 시)"
        />
        {input && (
          <div className="file-meta">
            <span title={input.name}>{input.name}</span>
            <button className="link" onClick={() => onInput(null)}>제거</button>
          </div>
        )}
        <button
          className="toggle" role="switch" aria-checked={params.grayscaleInput}
          onClick={() => onParams({ grayscaleInput: !params.grayscaleInput })}
          disabled={!!inputIsGray}
          title={inputIsGray ? '이미 흑백 사진입니다' : undefined}
        >
          <span>흑백으로 변환하여 입력</span>
          <span className={`switch ${params.grayscaleInput || inputIsGray ? 'on' : ''}`} />
        </button>
      </div>

      <div className="field">
        <div className="panel-head">
          <h2>견본 이미지</h2>
          <span className="small muted">선택</span>
        </div>
        <Drop
          blob={reference} onFile={onReference} className="drop-sm" label="견본 이미지"
          emptyTitle="참고할 펜 드로잉" emptyHint="선 굵기·해칭 방향·톤을 읽어 따릅니다"
        />
        {reference && (
          <>
            <div className="file-meta">
              <span title={reference.name}>{reference.name}</span>
              <button className="link" onClick={() => onReference(null)}>제거</button>
            </div>
            <div className={`small ${analysis.warning ? 'warn-text' : 'muted'}`}>
              {analysis.busy ? '견본 분석 중…' : analysis.warning ?? (analysis.summary ? `읽은 기법: ${analysis.summary}` : '')}
            </div>
            <div className="field">
              <div className="field-row"><b>견본 반영도</b><span className="muted">{params.referenceWeight}%</span></div>
              <input
                type="range" min={0} max={100} step={5} value={params.referenceWeight}
                onChange={(e) => onParams({ referenceWeight: Number(e.target.value) })} aria-label="견본 반영도"
              />
            </div>
          </>
        )}
      </div>

      <div className="field">
        <div className="panel-head">
          <h2>외부 결과</h2>
          <span className="small muted">선택</span>
        </div>
        <Drop
          blob={null} onFile={onExternal} className="drop-sm" label="외부 결과"
          emptyTitle="다른 프로그램으로 그린 그림" emptyHint="Dynamic Auto-Painter 등의 결과를 넣으면 이 사진의 완성 참고가 됩니다"
        />
        <div className="small faint">{input ? '사진과 같은 비율로 저장한 파일을 넣으세요. 비교·격자·전체화면·낙관·저장이 그대로 됩니다.' : '먼저 원본 사진을 올린 뒤 넣을 수 있습니다.'}</div>
      </div>

      {keyOk && (
        <div className="field">
          <button
            className="toggle" role="switch" aria-checked={params.aiRefFromLocal}
            onClick={() => onParams({ aiRefFromLocal: !params.aiRefFromLocal })}
            title="같은 구도의 로컬·외부 드로잉을 두 번째 이미지로 보내면 AI 가 해칭 방향과 톤 배치를 훨씬 정확히 따릅니다"
          >
            <span>AI에 로컬·외부 결과를 견본으로 보내기</span>
            <span className={`switch ${params.aiRefFromLocal ? 'on' : ''}`} />
          </button>
          <div className="small faint">
            {params.aiRefFromLocal
              ? (hasLocal ? '지금 떠 있는 로컬·외부 드로잉이 견본으로 함께 갑니다. 올린 견본 이미지는 이때 쓰이지 않습니다.' : '먼저 "드로잉 만들기"로 로컬 결과를 만들거나 외부 결과를 불러오면 그것이 견본으로 갑니다.')
              : '올린 견본 이미지만 보냅니다. 반영도는 견본 반영도 슬라이더를 따릅니다.'}
          </div>
        </div>
      )}
    </>
  );
}
