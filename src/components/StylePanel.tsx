import { useState, type ReactNode } from 'react';
import { COLOR_LABEL, PAINT_FOR_STYLE, PEN_STYLES, STYLE_DESC, STYLE_LABEL, type ColorMode, type DrawingParams, type PenStyle } from '../types';
import { LightDial } from './LightDial';
import { ARTISTS, ARTIST_BY_ID, type ArtistId } from '../artists';
import { presetImageUrl, presetShortLabel } from '../presetGallery';

/** 화풍을 펜으로 그리는 것과 붓으로 그리는 것으로 나눈다 (그리기 설정 패널의 붓 구분과 같은 기준) */
const isBrushStyle = (st: PenStyle) => ['wash', 'oil', 'impasto'].includes(PAINT_FOR_STYLE[st].brush);
const PEN_ONLY = PEN_STYLES.filter((st) => !isBrushStyle(st));
const BRUSH_ONLY = PEN_STYLES.filter(isBrushStyle);
const COLORS: Array<{ id: ColorMode; sw: string[] }> = [
  { id: 'color', sw: ['#c86a3c', '#7d8a3a', '#4a6b9a'] },
  { id: 'mono', sw: ['#111', '#777', '#ccc'] },
];

function intensityHint(v: number) {
  if (v < 20) return '아주 가벼운 터치';
  if (v < 40) return '가벼운 필압, 성긴 해칭';
  if (v < 60) return '중간 밀도';
  if (v < 80) return '진한 필압, 촘촘한 선';
  return '매우 촘촘하게 겹친 선';
}

interface Props {
  params: DrawingParams;
  onParams: (p: Partial<DrawingParams>) => void;
  /** 공통 설정 다음, AI 전용 설정 앞에 끼워 넣을 내용 (선·톤 패널) */
  children?: ReactNode;
}

export function StylePanel({ params, onParams, children }: Props) {
  // 화풍 프리셋을 두 탭으로 나눈다: 브라우저가 그리는 "로컬"(예시 그림 갤러리)과 키가 있어야 켜지는 "AI"(AI 전용 설정).
  // 화풍·색·빛은 두 경로가 함께 쓰므로 탭 밖에 둔다.
  const [tab, setTab] = useState<'local' | 'ai'>('local');
  return (
    <>
      <div className="panel-head"><h2>표현 설정</h2></div>

      <div className="field">
        <div className="field-row"><b>화풍 프리셋</b><span className="muted small">{tab === 'local' ? '예시를 눌러 고르기' : 'API 키 필요'}</span></div>
        <div className="seg engine-tabs" role="tablist" aria-label="화풍 프리셋 구분">
          <button role="tab" aria-selected={tab === 'local'} className={tab === 'local' ? 'on' : ''} onClick={() => setTab('local')}>로컬</button>
          <button role="tab" aria-selected={tab === 'ai'} className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')}>AI</button>
        </div>

        {tab === 'local' ? (
          <>
            {/* Dynamic Auto-Painter 의 프리셋 탭처럼: 같은 사진을 화풍마다 그린 예시를 보고 고른다 */}
            {([['펜 화풍', PEN_ONLY], ['붓 화풍', BRUSH_ONLY]] as const).map(([title, list]) => (
              <div key={title} className="gallery-group">
                <div className="group-title">{title}</div>
                <div className="gallery" role="radiogroup" aria-label={`${title} 프리셋`}>
                  {list.map((st) => (
                    <button
                      key={st} type="button" className={params.style === st ? 'on' : ''} role="radio" aria-checked={params.style === st}
                      title={STYLE_LABEL[st]} onClick={() => onParams({ style: st })}
                    >
                      <img src={presetImageUrl(st)} alt="" loading="lazy" draggable={false} />
                      <span>{presetShortLabel(st)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="small muted">{STYLE_DESC[params.style]}</div>
          </>
        ) : (
          <>
            <div className="small muted">고른 화풍({STYLE_LABEL[params.style]})·색·빛은 AI 로 그릴 때도 그대로 쓰입니다. 아래는 AI 로 그릴 때만 쓰는 설정입니다.</div>
            <div className="field" style={{ marginTop: 10 }}>
              <div className="field-row"><b>화가 화풍 접목</b></div>
              <select className="text-input select" value={params.artist} onChange={(e) => onParams({ artist: e.target.value as ArtistId })} aria-label="화가 화풍">
                {ARTISTS.map((a) => <option key={a.id} value={a.id}>{a.id === 'none' ? '없음' : `${a.name} (${a.years})`}</option>)}
              </select>
              <div className="small muted">{ARTIST_BY_ID[params.artist].desc}</div>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <div className="field-row"><b>강도</b><span className="muted">{intensityHint(params.intensity)}</span></div>
              <input type="range" min={0} max={100} value={params.intensity} onChange={(e) => onParams({ intensity: Number(e.target.value) })} aria-label="강도" />
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <button
                className="toggle" role="switch" aria-checked={params.aiRefFromPreset}
                onClick={() => onParams({ aiRefFromPreset: !params.aiRefFromPreset })}
                title="견본 이미지도 로컬 결과도 없을 때, 고른 화풍의 예시 그림을 견본으로 함께 보내 그 풍을 더 정확히 따르게 합니다"
              >
                <span>견본이 없으면 프리셋 예시 그림을 견본으로</span>
                <span className={`switch ${params.aiRefFromPreset ? 'on' : ''}`} />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="field">
        <div className="field-row"><b>색 표현</b></div>
        <div className="chips" role="radiogroup" aria-label="색 표현">
          {COLORS.map((c) => (
            <button key={c.id} className={params.color === c.id ? 'on' : ''} role="radio" aria-checked={params.color === c.id} onClick={() => onParams({ color: c.id })}>
              <span className="swatches">{c.sw.map((s) => <i key={s} style={{ background: s }} />)}</span>
              {COLOR_LABEL[c.id]}
            </button>
          ))}
        </div>
      </div>

      <LightDial value={params.light} auto={params.lightAuto} onChange={(light) => onParams({ light, lightAuto: false })} onAuto={() => onParams({ lightAuto: true })} />

      {children}

      <details className="advanced">
        <summary>화풍 목록 · 밝기 · 대비</summary>
        <div className="field">
          <div className="field-row"><b>화풍 고르기</b><span className="muted small">{PEN_STYLES.length}종</span></div>
          <select className="text-input select" value={params.style} onChange={(e) => onParams({ style: e.target.value as PenStyle })} aria-label="화풍">
            {PEN_STYLES.map((st) => <option key={st} value={st}>{STYLE_LABEL[st]}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <div className="field-row"><b>밝기</b><span className="muted">{params.brightness > 0 ? `+${params.brightness}` : params.brightness}</span></div>
          <input type="range" min={-50} max={50} value={params.brightness} onChange={(e) => onParams({ brightness: Number(e.target.value) })} aria-label="밝기" />
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <div className="field-row"><b>대비</b><span className="muted">{params.contrast > 0 ? `+${params.contrast}` : params.contrast}</span></div>
          <input type="range" min={-50} max={50} value={params.contrast} onChange={(e) => onParams({ contrast: Number(e.target.value) })} aria-label="대비" />
        </div>
        <div className="small faint">밝기·대비는 결과에 즉시 적용되고, AI 생성 때 지시문에도 반영됩니다.</div>
      </details>
    </>
  );
}
