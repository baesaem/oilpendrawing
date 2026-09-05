/**
 * 즐겨찾기 프리셋: 현재 그리기 설정(PaintProfile)을 이름 붙여 이 브라우저에 저장합니다.
 * 낙관·사인과 같은 방식으로 localStorage 에 두며, 서버로는 보내지 않습니다. v1(옛 선·톤 프로필)은 불러올 때 옮깁니다.
 */
import { migrateStrokes, type PaintProfile } from './types';

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
