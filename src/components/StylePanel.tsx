import type { ReactNode } from 'react';
import { COLOR_LABEL, LEVEL_DESC, LEVEL_LABEL, PEN_STYLES, STYLE_DESC, STYLE_LABEL, type ColorMode, type DrawingParams, type Level, type PenStyle } from '../types';
import { LightDial } from './LightDial';
import { ARTISTS, ARTIST_BY_ID, type ArtistId } from '../artists';

const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
const COLORS: Array<{ id: ColorMode; sw: string[] }> = [
  { id: 'color', sw: ['#c86a3c', '#7d8a3a', '#4a6b9a'] },
  { id: 'mono', sw: ['#111', '#777', '#ccc'] },
  { id: 'sepia', sw: ['#4a2e1c', '#8b5e3c', '#d4b48c'] },
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
  return (
    <>
      <div className="panel-head"><h2>표현 설정</h2></div>

      <div className="field">
        <div className="field-row"><b>화풍</b></div>
        <select className="text-input select" value={params.style} onChange={(e) => onParams({ style: e.target.value as PenStyle })} aria-label="화풍">
          {PEN_STYLES.map((st) => <option key={st} value={st}>{STYLE_LABEL[st]}</option>)}
        </select>
        <div className="small muted">{STYLE_DESC[params.style]}</div>
      </div>

      <div className="field">
        <div className="field-row"><b>숙련도</b></div>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }} role="radiogroup" aria-label="숙련도">
          {LEVELS.map((l) => (
            <button key={l} className={params.level === l ? 'on' : ''} role="radio" aria-checked={params.level === l} onClick={() => onParams({ level: l })}>
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
        <div className="small muted">{LEVEL_DESC[params.level]}</div>
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

      <div className="field">
        <div className="field-row"><b>밝기</b><span className="muted">{params.brightness > 0 ? `+${params.brightness}` : params.brightness}</span></div>
        <input type="range" min={-50} max={50} value={params.brightness} onChange={(e) => onParams({ brightness: Number(e.target.value) })} aria-label="밝기" />
      </div>
      <div className="field">
        <div className="field-row"><b>대비</b><span className="muted">{params.contrast > 0 ? `+${params.contrast}` : params.contrast}</span></div>
        <input type="range" min={-50} max={50} value={params.contrast} onChange={(e) => onParams({ contrast: Number(e.target.value) })} aria-label="대비" />
      </div>
      <div className="small faint">밝기·대비는 결과에 즉시 적용되고, AI 생성 때 지시문에도 반영됩니다.</div>

      {children}

      <details className="advanced">
        <summary>AI 생성 전용 · 화가 화풍 접목 · 강도</summary>
        <div className="field">
          <div className="field-row"><b>화가 화풍 접목</b><span className="muted small">선택</span></div>
          <select className="text-input select" value={params.artist} onChange={(e) => onParams({ artist: e.target.value as ArtistId })} aria-label="화가 화풍">
            {ARTISTS.map((a) => <option key={a.id} value={a.id}>{a.id === 'none' ? '없음' : `${a.name} (${a.years})`}</option>)}
          </select>
          <div className="small muted">{ARTIST_BY_ID[params.artist].desc}</div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <div className="field-row"><b>강도</b><span className="muted">{params.intensity} · {intensityHint(params.intensity)}</span></div>
          <input type="range" min={0} max={100} value={params.intensity} onChange={(e) => onParams({ intensity: Number(e.target.value) })} aria-label="강도" />
        </div>
      </details>
    </>
  );
}
