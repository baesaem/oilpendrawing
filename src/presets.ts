/**
 * 즐겨찾기 프리셋: 현재 그리기 설정(PaintProfile)을 이름 붙여 이 브라우저에 저장합니다.
 * 낙관·사인과 같은 방식으로 localStorage 에 두며, 서버로는 보내지 않습니다. v1(옛 선·톤 프로필)은 불러올 때 옮깁니다.
 */
import { migrateStrokes, type PaintProfile, type PenStyle } from './types';

export interface UserPreset {
  id: string;
  name: string;
  paint: PaintProfile;
  createdAt: number;
}

const KEY = 'oilpen.presets.v2';
const OLD_KEY = 'oilpen.presets.v1';
export const PRESET_LIMIT = 24;

export function loadPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw) as UserPreset[];
      return Array.isArray(list) ? list.filter((p) => p && p.id && p.name && p.paint) : [];
    }
    // 옛 즐겨찾기(선·톤 프로필) 를 옮긴다
    const old = localStorage.getItem(OLD_KEY);
    if (!old) return [];
    const list = JSON.parse(old) as Array<{ id: string; name: string; strokes?: Record<string, unknown>; createdAt: number }>;
    if (!Array.isArray(list)) return [];
    const out: UserPreset[] = [];
    for (const p of list) {
      const paint = migrateStrokes(p.strokes);
      if (p && p.id && p.name && paint) out.push({ id: p.id, name: p.name, paint, createdAt: p.createdAt });
    }
    return out;
  } catch {
    return [];
  }
}

export function savePresets(list: UserPreset[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, PRESET_LIMIT))); } catch { /* 용량 초과 등은 조용히 */ }
}

export const newPresetId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 두 설정이 같은지 (현재 값이 어느 프리셋인지 표시하는 데 씀) */
export function samePaint(a: PaintProfile, b: PaintProfile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 화풍 프리셋 덮어쓰기: 갤러리의 화풍마다 "현재 설정"을 얹어 둔다.
 * 저장해 두면 그 화풍을 고를 때 코드의 기본 설정 대신 이 값이 들어간다 — 프리셋을 자기 손에 맞게 길들이는 것이다.
 * 즐겨찾기와 달리 이름이 없고 화풍 하나에 하나뿐이며, 지우면 원래 프리셋으로 돌아간다.
 */
export type StylePaints = Partial<Record<PenStyle, PaintProfile>>;

const STYLE_KEY = 'oilpen.stylePaint.v1';

export function loadStylePaints(): StylePaints {
  try {
    const raw = localStorage.getItem(STYLE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as StylePaints;
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

export function saveStylePaints(o: StylePaints) {
  try { localStorage.setItem(STYLE_KEY, JSON.stringify(o)); } catch { /* 용량 초과 등은 조용히 */ }
}
