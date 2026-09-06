import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { COLOR_LABEL, PAINT_FOR_STYLE, PEN_STYLES, STYLE_DESC, STYLE_LABEL, type ColorMode, type DrawingParams, type PenStyle } from '../types';
import { LightDial } from './LightDial';
import { ARTISTS, ARTIST_BY_ID, type ArtistId } from '../artists';
import { presetImageUrl, presetShortLabel } from '../presetGallery';
import { PresetList } from './PresetList';
import type { UserPreset } from '../presets';
import type { PaintProfile } from '../types';

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
  /** 즐겨찾기 탭: 이 브라우저에 저장한 그리기 설정 */
  paint: PaintProfile;
  presets: UserPreset[];
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  onApplyPreset: (p: UserPreset) => void;
  /** 공통 설정 다음, AI 전용 설정 앞에 끼워 넣을 내용 (선·톤 패널) */
  children?: ReactNode;
}

export function StylePanel({ params, onParams, paint, presets, onSavePreset, onDeletePreset, onApplyPreset, children }: Props) {
  // 화풍 프리셋은 두 탭이다: 저장해 둔 "즐겨찾기"와 화풍 예시 그림 갤러리인 "프리셋".
  // 화가 접목·색·빛은 로컬·AI 가 함께 쓰므로 탭 밖에 둔다.
  const [tab, setTab] = useState<'fav' | 'preset'>('preset');
  // 썸네일에 마우스를 올리면 그 예시 그림을 크게 띄운다 (패널이 좁아 썸네일만으로는 기법이 안 보인다).
  // 패널 왼쪽에 붙여 화면 밖으로 나가지 않게 자리를 잡고, 마우스 이벤트는 통과시킨다.
  const [peek, setPeek] = useState<{ st: PenStyle; top: number; left: number } | null>(null);
  const showPeek = (st: PenStyle, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const W = 300, H = 380;
    setPeek({
      st,
      top: Math.max(12, Math.min(window.innerHeight - H - 12, r.top + r.height / 2 - H / 2)),
      left: Math.max(12, r.left - W - 14),
    });
  };
  return (
    <>
      <div className="panel-head"><h2>표현 설정</h2></div>

      <div className="field">
        <div className="field-row">
          <b>드로잉 프리셋</b>
          {tab === 'fav' && <span className="muted small">{presets.length}개 저장됨</span>}
        </div>
        <div className="seg engine-tabs" role="tablist" aria-label="드로잉 프리셋 구분">
          <button role="tab" aria-selected={tab === 'fav'} className={tab === 'fav' ? 'on' : ''} onClick={() => setTab('fav')}>즐겨찾기</button>
          <button role="tab" aria-selected={tab === 'preset'} className={tab === 'preset' ? 'on' : ''} onClick={() => setTab('preset')}>프리셋</button>
        </div>

        {tab === 'fav' ? (
          <PresetList paint={paint} presets={presets} onSavePreset={onSavePreset} onDeletePreset={onDeletePreset} onApplyPreset={onApplyPreset} />
        ) : (
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
                      onMouseEnter={(e) => showPeek(st, e.currentTarget)} onFocus={(e) => showPeek(st, e.currentTarget)}
                      onMouseLeave={() => setPeek(null)} onBlur={() => setPeek(null)}
                    >
                      <img src={presetImageUrl(st)} alt="" loading="lazy" draggable={false} />
                      <span>{presetShortLabel(st)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {/* 화풍 설명은 갤러리 아래에 늘 띄우지 않고, 썸네일에 마우스를 올렸을 때 그 화풍의 것만 보여 준다 */}
            {/* 패널에 backdrop-filter 가 걸려 있어 그 안에서는 position:fixed 가 패널 기준이 된다 — body 로 내보낸다 */}
            {peek && createPortal(
              <div className="preset-peek" style={{ top: peek.top, left: peek.left }} aria-hidden="true">
                <img src={presetImageUrl(peek.st)} alt="" />
                <b>{STYLE_LABEL[peek.st]}</b>
                <span>{STYLE_DESC[peek.st]}</span>
              </div>,
              document.body,
            )}
          </>
        )}
      </div>

      {/* 유명 화가 프리셋: 화풍 위에 얹는 해석. AI 로 그릴 때만 쓰이므로 그렇게 적어 둔다 */}
      <div className="field">
        <div className="field-row"><b>화가</b><span className="muted small">AI 전용 · {ARTISTS.length - 1}명</span></div>
        <select className="text-input select" value={params.artist} onChange={(e) => onParams({ artist: e.target.value as ArtistId })} aria-label="화가 화풍">
          {ARTISTS.map((a) => <option key={a.id} value={a.id}>{a.id === 'none' ? '없음 (화풍만)' : `${a.name} (${a.years})`}</option>)}
        </select>
        <div className="small muted">{ARTIST_BY_ID[params.artist].desc}</div>
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
        <div className="field" style={{ marginTop: 10 }}>
          <div className="field-row"><b>강도</b><span className="muted">{intensityHint(params.intensity)} · AI 전용</span></div>
          <input type="range" min={0} max={100} value={params.intensity} onChange={(e) => onParams({ intensity: Number(e.target.value) })} aria-label="강도" />
        </div>
      </details>
    </>
  );
}
