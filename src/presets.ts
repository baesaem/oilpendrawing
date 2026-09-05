/**
 * 즐겨찾기 프리셋: 현재 선·톤(StrokeProfile)을 이름 붙여 이 브라우저에 저장합니다.
 * 낙관·사인과 같은 방식으로 localStorage 에 두며, 서버로는 보내지 않습니다.
 */
import type { StrokeProfile } from './types';

export interface UserPreset {
  id: string;
  name: string;
  strokes: StrokeProfile;
  createdAt: number;
}

const KEY = 'oilpen.presets.v1';
export const PRESET_LIMIT = 24;

export function loadPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as UserPreset[];
    return Array.isArray(list) ? list.filter((p) => p && p.id && p.name && p.strokes) : [];
  } catch {
    return [];
  }
}

export function savePresets(list: UserPreset[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, PRESET_LIMIT))); } catch { /* 용량 초과 등은 조용히 */ }
}

export const newPresetId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 두 프로필이 같은 설정인지 (현재 값이 어느 프리셋인지 표시하는 데 씀) */
export function sameStrokes(a: StrokeProfile, b: StrokeProfile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
