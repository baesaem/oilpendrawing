/**
 * 화풍 프리셋 갤러리 (Dynamic Auto-Painter 의 프리셋 탭처럼, 화풍마다 예시 그림을 보여 주고 고르게 한다).
 * 예시 그림은 public/presets/<style>.jpg — 같은 사진(컵과 배)을 이 앱의 로컬 렌더러로 화풍마다 그린 것이라
 * 화풍끼리 차이가 한눈에 비교된다. 새 화풍을 추가하면 예시 그림도 같은 이름으로 넣는다.
 */
import { STYLE_LABEL, type PenStyle } from './types';

/** 예시 그림 주소. 빌드 base(/oilpendrawing/ 등)를 따른다 */
export function presetImageUrl(style: PenStyle): string {
  return `${import.meta.env.BASE_URL}presets/${style}.jpg`;
}

/** 썸네일 아래 짧은 이름: "리천 스타일 (어반 펜 스케치)" → "리천 스타일" */
export function presetShortLabel(style: PenStyle): string {
  return STYLE_LABEL[style].replace(/\s*\(.*\)$/, '');
}

/**
 * AI 로 그릴 때 견본이 없으면 고른 화풍의 예시 그림을 견본으로 보낸다.
 * 못 가져오면(오프라인·미리보기) null — 견본 없이 그린다.
 */
export async function fetchPresetImage(style: PenStyle): Promise<Blob | null> {
  try {
    const r = await fetch(presetImageUrl(style));
    if (!r.ok) return null;
    const b = await r.blob();
    return b.type.startsWith('image/') ? b : null;
  } catch {
    return null;
  }
}
