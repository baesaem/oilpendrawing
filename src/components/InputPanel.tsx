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
}

export function InputPanel({ input, reference, inputIsGray, params, onParams, onInput, onReference }: Props) {
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
          emptyTitle="참고할 펜 드로잉" emptyHint="선 밀도·해칭 방향·톤을 따릅니다"
        />
        {reference && (
          <>
            <div className="file-meta">
              <span title={reference.name}>{reference.name}</span>
              <button className="link" onClick={() => onReference(null)}>제거</button>
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
    </>
  );
}
