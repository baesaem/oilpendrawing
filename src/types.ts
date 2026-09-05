export type Level = 'beginner' | 'intermediate' | 'advanced';
export type ColorMode = 'color' | 'mono' | 'sepia';
export type LightDir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
import type { ArtistId } from './artists';
export type { ArtistId } from './artists';

export type ProviderId = 'gemini' | 'openai' | 'xai';
export type PenStyle =
  | 'richeon' | 'fineink'
  | 'hatching' | 'crosshatch' | 'contour' | 'scribble' | 'stipple'
  | 'engraving' | 'urban' | 'realistic' | 'comic' | 'architectural'
  | 'ghibli' | 'webtoon' | 'manga' | 'watercolor';

/** 결과를 만든 엔진: 브라우저 로컬 렌더러 또는 AI 제공사 */
/** 결과를 만든 엔진: 브라우저 로컬 렌더러, AI 제공사, 또는 밖에서 만든 그림(Dynamic Auto-Painter 등)을 불러온 것 */
export type Engine = 'local' | 'ai' | 'external';

/**
 * 사용자가 사진 위에 직접 그은 해칭 방향 지시선 (DAP 의 수동 Feature Follow 에 해당).
 * 좌표는 그림 상대(0~1). 선에 가까운 곳의 해칭이 그 방향을 따르고, 멀어질수록 자동 방향장으로 돌아간다.
 */
export interface DirectionGuide {
  id: string;
  points: Array<[number, number]>;
}

/** 로컬 엔진의 붓 (획의 모양) */
export type BrushKind = 'pen' | 'hatch' | 'cross' | 'contour' | 'scribble' | 'stipple' | 'wash';
export const BRUSH_LABEL: Record<BrushKind, string> = {
  pen: '펜 획 (면을 따라 흐르는 짧은 획, 나뭇잎은 고리 선, 그림자는 교차)',
  hatch: '평행 해칭', cross: '교차 해칭', contour: '윤곽선 위주 (깊은 그림자만 해칭)', scribble: '스크리블 (고리 선)', stipple: '점묘',
  wash: '수채 담채 (붓 자국을 겹쳐 얹고 펜은 윤곽과 깊은 그림자만)',
};
export const BRUSH_SHORT: Record<BrushKind, string> = { pen: '펜 획', hatch: '해칭', cross: '교차', contour: '윤곽', scribble: '낙서', stipple: '점묘', wash: '담채' };

/**
 * 그리기 설정 (Dynamic Auto-Painter 의 프리셋 파라미터에 해당). 로컬 엔진이 보는 값의 전부다.
 * 층(pass)마다 획 크기를 brushSize 에서 detail 까지 줄여 가며, 캔버스가 목표보다 밝은 곳에만 획을 놓는다.
 * 픽셀 단위 값(lineWidth)은 긴 변 1000px 기준.
 */
export interface PaintProfile {
  brush: BrushKind;
  /** 층 수 1~6. 큰 획 층에서 작은 획 층으로 */
  passes: number;
  /** 첫 층의 획 크기 0~100 (큰 형태를 잡는 획의 길이·간격) */
  brushSize: number;
  /** 마지막 층의 세밀함 0~100. 높을수록 작은 획으로 세부까지 */
  detail: number;
  /** 정밀도 0~100. 낮으면 큰 차이만 획으로 메워 성글고, 높으면 사진의 명암에 가깝게 */
  accuracy: number;
  /** 획 길이 0~100 (획 크기 배수) */
  strokeLength: number;
  /** 형태 따라가기 0~100. 0 = 기준 각도로만, 100 = 면·경계의 방향장을 그대로 */
  featureFollow: number;
  /** 기준 각도 0~179도 (0 = 수평). 방향이 없는 곳(하늘·평면)과 형태 따라가기가 약할 때의 해칭 방향 */
  baseAngle: number;
  /** 무작위성 0~100. 시작점·각도·길이·필압의 흔들림 */
  randomness: number;
  /** 선 굵기 px 1~6 */
  lineWidth: number;
  /** 잉크 농도 0~100. 획 하나의 진하기. 85 이상이면 가장 깊은 그림자를 먹으로 채운다 */
  ink: number;
  /** 여백 0~100. 높을수록 밝은 곳을 넓게 종이로 남긴다 */
  paperKeep: number;
  /** 윤곽선 0~100. 색 경계를 따라가는 선의 양 */
  edges: number;
  /** 가장자리를 미완성처럼 흐리는 정도 0~100 */
  vignette: number;
  /** 종이색 #rrggbb */
  paperColor: string;
  /** 잉크색 #rrggbb */
  inkColor: string;
}

/**
 * 리천 스타일 (instagram.com/richeons_drawing_journey).
 * 가는 검정 펜, 면의 방향을 따르는 획, 나뭇잎은 고리 선 뭉치, 하늘·하이라이트는 흰 종이, 가장자리는 미완성.
 */
export const RICHEON_PAINT: PaintProfile = {
  brush: 'pen', passes: 4, brushSize: 45, detail: 75, accuracy: 60, strokeLength: 60, featureFollow: 85, baseAngle: 55, randomness: 30,
  lineWidth: 1.4, ink: 88, paperKeep: 66, edges: 80, vignette: 40, paperColor: '#f6f3ec', inkColor: '#17171a',
};
/** 세밀 펜화: 아주 가늘고 고른 선으로 끝까지 완성, 수평 하늘 해칭, 먹 그림자 */
export const FINE_PAINT: PaintProfile = {
  brush: 'pen', passes: 6, brushSize: 40, detail: 100, accuracy: 85, strokeLength: 80, featureFollow: 90, baseAngle: 0, randomness: 8,
  lineWidth: 1, ink: 92, paperKeep: 52, edges: 90, vignette: 0, paperColor: '#f7f5f0', inkColor: '#111114',
};
/** 클래식: 굵은 펜의 한 방향 해칭 */
export const CLASSIC_PAINT: PaintProfile = {
  brush: 'hatch', passes: 4, brushSize: 50, detail: 70, accuracy: 65, strokeLength: 70, featureFollow: 40, baseAngle: 35, randomness: 30,
  lineWidth: 1.8, ink: 80, paperKeep: 55, edges: 50, vignette: 0, paperColor: '#f5f0e6', inkColor: '#221e1b',
};
export const DEFAULT_PAINT: PaintProfile = RICHEON_PAINT;

/** 화풍마다 완전한 그리기 설정 (DAP 의 프리셋). 갤러리에서 화풍을 고르면 이 값이 그대로 들어간다 */
export const PAINT_FOR_STYLE: Record<PenStyle, PaintProfile> = {
  richeon: RICHEON_PAINT,
  fineink: FINE_PAINT,
  hatching: CLASSIC_PAINT,
  crosshatch: { ...CLASSIC_PAINT, brush: 'cross', passes: 5, detail: 75, accuracy: 70, strokeLength: 65, randomness: 25, lineWidth: 1.5, paperKeep: 50, edges: 55 },
  contour: { ...CLASSIC_PAINT, brush: 'contour', passes: 2, brushSize: 40, detail: 60, accuracy: 50, strokeLength: 60, featureFollow: 70, baseAngle: 45, randomness: 25, ink: 85, paperKeep: 65, edges: 95 },
  scribble: { ...CLASSIC_PAINT, brush: 'scribble', passes: 4, brushSize: 45, detail: 75, accuracy: 60, strokeLength: 60, featureFollow: 30, baseAngle: 0, randomness: 70, lineWidth: 1.3, ink: 75, edges: 45 },
  stipple: { ...CLASSIC_PAINT, brush: 'stipple', passes: 4, brushSize: 40, detail: 85, accuracy: 65, strokeLength: 0, featureFollow: 0, randomness: 50, lineWidth: 1.6, ink: 90, edges: 30 },
  engraving: { ...CLASSIC_PAINT, passes: 5, brushSize: 40, detail: 85, accuracy: 75, strokeLength: 90, featureFollow: 90, baseAngle: 0, randomness: 10, lineWidth: 1.4, ink: 82, paperKeep: 45, edges: 60 },
  urban: { ...RICHEON_PAINT, passes: 3, brushSize: 50, detail: 65, accuracy: 55, strokeLength: 60, featureFollow: 75, baseAngle: 60, randomness: 45, lineWidth: 1.5, paperKeep: 62, edges: 60, vignette: 55 },
  realistic: { ...CLASSIC_PAINT, brush: 'cross', passes: 6, brushSize: 35, detail: 100, accuracy: 95, strokeLength: 45, featureFollow: 70, baseAngle: 30, randomness: 15, lineWidth: 1, ink: 85, paperKeep: 35, edges: 75 },
  comic: { ...CLASSIC_PAINT, brush: 'contour', passes: 3, brushSize: 45, detail: 70, accuracy: 55, strokeLength: 55, featureFollow: 60, baseAngle: 45, randomness: 20, lineWidth: 2.4, ink: 95, paperKeep: 60, edges: 100 },
  architectural: { ...CLASSIC_PAINT, passes: 3, brushSize: 50, detail: 70, accuracy: 60, strokeLength: 95, featureFollow: 90, baseAngle: 90, randomness: 5, lineWidth: 1.2, ink: 80, paperKeep: 65, edges: 85 },
  ghibli: { ...CLASSIC_PAINT, passes: 3, brushSize: 55, detail: 60, accuracy: 50, strokeLength: 65, featureFollow: 60, baseAngle: 30, randomness: 20, lineWidth: 1.4, ink: 70, paperKeep: 60, edges: 65 },
  webtoon: { ...CLASSIC_PAINT, brush: 'contour', passes: 3, brushSize: 50, detail: 65, accuracy: 55, strokeLength: 60, featureFollow: 60, baseAngle: 45, randomness: 10, lineWidth: 1.8, ink: 90, paperKeep: 62, edges: 95 },
  manga: { ...CLASSIC_PAINT, passes: 4, brushSize: 40, detail: 90, accuracy: 70, strokeLength: 60, featureFollow: 20, baseAngle: 45, randomness: 5, lineWidth: 1, ink: 90, paperKeep: 55, edges: 85 },
  watercolor: { ...RICHEON_PAINT, brush: 'wash', passes: 4, brushSize: 70, detail: 80, accuracy: 72, strokeLength: 50, featureFollow: 70, baseAngle: 40, randomness: 35, lineWidth: 1.6, ink: 60, paperKeep: 62, edges: 45, vignette: 15 },
};

/** 숙련도별로 화풍 설정을 단순화한다 (견본이 없을 때 출발점). 초급은 층·세밀함을 줄이고 굵은 펜으로 */
export function paintForLevel(level: Level, base: PaintProfile): PaintProfile {
  switch (level) {
    case 'beginner': return { ...base, passes: Math.max(2, base.passes - 2), detail: Math.round(base.detail * 0.6), accuracy: Math.max(20, base.accuracy - 20), lineWidth: Math.min(6, base.lineWidth + 0.6), randomness: Math.min(100, base.randomness + 10), edges: Math.max(20, base.edges - 15) };
    case 'intermediate': return { ...base, passes: Math.max(2, base.passes - 1), detail: Math.round(base.detail * 0.8), accuracy: Math.max(20, base.accuracy - 10), lineWidth: Math.min(6, base.lineWidth + 0.3) };
    case 'advanced': return { ...base };
  }
}

/** 기본값과 측정값을 반영도(0~100)로 섞습니다 */
export function blendPaint(base: PaintProfile, m: PaintProfile, weight: number): PaintProfile {
  const t = Math.max(0, Math.min(1, weight / 100));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return {
    brush: t >= 0.5 ? m.brush : base.brush,
    passes: mix(base.passes, m.passes),
    brushSize: mix(base.brushSize, m.brushSize),
    detail: mix(base.detail, m.detail),
    accuracy: mix(base.accuracy, m.accuracy),
    strokeLength: mix(base.strokeLength, m.strokeLength),
    featureFollow: mix(base.featureFollow, m.featureFollow),
    // 각도는 중간값이 의미가 없으므로 섞지 않고 고릅니다
    baseAngle: t >= 0.5 ? m.baseAngle : base.baseAngle,
    randomness: mix(base.randomness, m.randomness),
    lineWidth: Math.round((base.lineWidth + (m.lineWidth - base.lineWidth) * t) * 2) / 2,
    ink: mix(base.ink, m.ink),
    paperKeep: mix(base.paperKeep, m.paperKeep),
    edges: mix(base.edges, m.edges),
    // 가장자리 처리는 견본에서 재지 않으므로 기본값을 유지
    vignette: base.vignette,
    paperColor: t >= 0.5 ? m.paperColor : base.paperColor,
    inkColor: t >= 0.5 ? m.inkColor : base.inkColor,
  };
}

/** 옛 선·톤 프로필(StrokeProfile, 이력·즐겨찾기 v1) 을 그리기 설정으로 옮긴다 */
export function migrateStrokes(s: Record<string, unknown> | undefined): PaintProfile | null {
  if (!s || typeof s !== 'object' || !('fill' in s)) return null;
  const num = (k: string, d: number) => (typeof s[k] === 'number' ? (s[k] as number) : d);
  const fill = String(s.fill);
  const brush: BrushKind = fill === 'sketch' ? 'pen' : (['hatch', 'cross', 'contour', 'scribble', 'stipple', 'wash'].includes(fill) ? (fill as BrushKind) : 'hatch');
  const spacing = num('hatchSpacing', 6);
  return {
    ...DEFAULT_PAINT,
    brush,
    passes: Math.max(1, Math.min(6, Math.round(num('tones', 4)))),
    detail: Math.round(Math.max(20, Math.min(100, 100 - ((spacing - 3) / 21) * 80))),
    baseAngle: Math.round(num('hatchAngle', 55)) % 180,
    randomness: Math.round(num('jitter', 30)),
    lineWidth: num('lineWidth', 1.2),
    paperKeep: Math.round(num('paperKeep', 58)),
    edges: Math.round(num('edgeDensity', 70)),
    vignette: Math.round(num('vignette', 0)),
    paperColor: typeof s.paperColor === 'string' ? s.paperColor : DEFAULT_PAINT.paperColor,
    inkColor: typeof s.inkColor === 'string' ? s.inkColor : DEFAULT_PAINT.inkColor,
  };
}

export interface DrawingParams {
  /** 화풍(기법) */
  style: PenStyle;
  /** 접목할 유명 화가 화풍 */
  artist: ArtistId;
  level: Level;
  /** 0~100 선 밀도·필압 */
  intensity: number;
  color: ColorMode;
  light: LightDir;
  /** 빛 방향을 사진에서 자동 추정할지. 끄면(다이얼을 돌리면) 사진을 그 방향으로 다시 조명해서 씁니다 */
  lightAuto: boolean;
  /** -50~+50 */
  brightness: number;
  /** -50~+50 */
  contrast: number;
  /** 0~100 견본 반영도 */
  referenceWeight: number;
  /** 입력을 흑백으로 변환해서 보냄 */
  grayscaleInput: boolean;
  /** 로컬 엔진의 그리기 설정 */
  paint: PaintProfile;
  /** AI 로 그릴 때 로컬 결과를 견본 이미지로 함께 보낼지 (같은 구도라 해칭 방향·톤 배치를 잘 따름) */
  aiRefFromLocal: boolean;
  /** AI 로 그릴 때 견본도 로컬 결과도 없으면 고른 화풍의 프리셋 예시 그림을 견본으로 보낼지 */
  aiRefFromPreset: boolean;
  /** 사진 위에 직접 그은 해칭 방향 지시선. 사진이 바뀌면 비운다 */
  guides: DirectionGuide[];
  /** 지시선의 영향 범위 (짧은 변의 %) 5~50 */
  guideRadius: number;
}

export const DEFAULT_PARAMS: DrawingParams = {
  style: 'richeon',
  artist: 'none',
  level: 'intermediate',
  intensity: 60,
  color: 'mono',
  light: 'NW',
  lightAuto: true,
  brightness: 0,
  contrast: 0,
  referenceWeight: 60,
  grayscaleInput: false,
  paint: DEFAULT_PAINT,
  aiRefFromLocal: true,
  aiRefFromPreset: true,
  guides: [],
  guideRadius: 18,
};

/** 이력에서 불러온 옛 레코드에 새 필드가 없을 수 있으므로 기본값과 병합합니다 */
export function mergeParams(p: Partial<DrawingParams> | undefined): DrawingParams {
  const old = (p as { strokes?: Record<string, unknown> } | undefined)?.strokes;
  const style = (p?.style as string) === 'parkyongsoon' ? 'fineink' : p?.style;
  // 옛 레코드(선·톤 프로필)는 옮기고, 아주 옛 레코드(둘 다 없음)는 화풍의 프리셋으로
  const paint = p?.paint ? { ...(style ? PAINT_FOR_STYLE[style] : DEFAULT_PAINT), ...p.paint } : migrateStrokes(old) ?? (style ? PAINT_FOR_STYLE[style] : DEFAULT_PAINT);
  const merged: DrawingParams = { ...DEFAULT_PARAMS, ...p, paint };
  delete (merged as unknown as { strokes?: unknown }).strokes;
  if (style) merged.style = style;
  return merged;
}

export interface ProviderSettings {
  apiKey: string;
  /** 이미지 생성 모델 ID (편집 가능) */
  model: string;
  /** xAI처럼 묘사→생성 2단계가 필요한 경우 쓰는 비전 모델 */
  visionModel?: string;
  /** API 기본 URL. CORS 우회 프록시를 쓸 때 바꿉니다. */
  baseUrl: string;
}

export interface Settings {
  provider: ProviderId;
  providers: Record<ProviderId, ProviderSettings>;
  rememberKeys: boolean;
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI (GPT 이미지)',
  xai: 'xAI (Grok)',
};

export const DEFAULT_PROVIDER_SETTINGS: Record<ProviderId, ProviderSettings> = {
  gemini: { apiKey: '', model: 'gemini-2.5-flash-image', baseUrl: 'https://generativelanguage.googleapis.com' },
  openai: { apiKey: '', model: 'gpt-image-1', baseUrl: 'https://api.openai.com' },
  xai: { apiKey: '', model: 'grok-2-image', visionModel: 'grok-4', baseUrl: 'https://api.x.ai' },
};

export const DEFAULT_SETTINGS: Settings = {
  provider: 'gemini',
  providers: DEFAULT_PROVIDER_SETTINGS,
  rememberKeys: true,
};

export interface Drawing {
  id: string;
  createdAt: number;
  input: Blob;
  reference?: Blob;
  result: Blob;
  /** 4단계 과정 그림 (선택 생성) */
  process?: Blob;
  /** 낙관·사인을 찍기 전 원본 결과. result 는 여기에 배치를 구워 넣은 것 */
  base?: Blob;
  params: DrawingParams;
  /** 없으면 옛 레코드 = AI */
  engine?: Engine;
  provider?: ProviderId;
  model?: string;
  prompt?: string;
}

export const LEVEL_LABEL: Record<Level, string> = { beginner: '초급', intermediate: '중급', advanced: '상급' };
export const LEVEL_DESC: Record<Level, string> = {
  beginner: '굵은 윤곽선과 큰 형태 위주. 한 방향 해칭 1~2단계, 질감은 생략합니다.',
  intermediate: '윤곽과 내부 형태선. 한 방향 해칭으로 중간톤을 넣고 주요 질감만 살립니다.',
  advanced: '얇고 겹치는 선, 교차 해칭으로 중간톤을 쌓고 반사광과 질감까지 세밀하게 표현합니다.',
};
export const COLOR_LABEL: Record<ColorMode, string> = { color: '컬러', mono: '흑백', sepia: '세피아' };
export const LIGHT_LABEL: Record<LightDir, string> = {
  N: '위', NE: '우상단', E: '오른쪽', SE: '우하단', S: '아래', SW: '좌하단', W: '왼쪽', NW: '좌상단',
};
export const LIGHT_DIRS: LightDir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const PEN_STYLES: PenStyle[] = [
  'richeon', 'fineink', 'hatching', 'crosshatch', 'contour', 'scribble', 'stipple', 'engraving', 'urban', 'realistic', 'comic', 'architectural',
  'ghibli', 'webtoon', 'manga', 'watercolor',
];
export const STYLE_LABEL: Record<PenStyle, string> = {
  richeon: '리천 스타일 (어반 펜 스케치)',
  fineink: '세밀 펜화',
  hatching: '클래식 해칭',
  crosshatch: '크로스 해칭',
  contour: '윤곽선 드로잉',
  scribble: '스크리블',
  stipple: '점묘',
  engraving: '판화풍',
  urban: '어반 스케치',
  realistic: '극사실 세밀화',
  comic: '잉크 일러스트',
  architectural: '건축 제도풍',
  ghibli: '지브리풍 애니메이션',
  webtoon: '웹툰',
  manga: '일본 만화(망가)',
  watercolor: '수채 담채 (펜 + 수채)',
};
export const STYLE_DESC: Record<PenStyle, string> = {
  richeon: '가는 검정 펜으로 면의 방향을 따라 해칭(벽은 세로, 바닥은 원근 방향). 나뭇잎은 뭉게구름처럼 둘러 그리고 안을 고리 선으로 채웁니다. 하늘과 밝은 곳은 흰 종이로 비우고 가장자리는 미완성으로 둡니다. @richeons_drawing_journey',
  fineink: '아주 가늘고 고른 선으로 종이 끝까지 빈틈없이 완성하는 전문 펜화. 하늘은 수평 해칭 속에 구름을 흰 여백으로 남기고, 깊은 그림자는 먹으로 채웁니다. 낡은 벽·기와·나뭇잎의 잔결 질감이 핵심.',
  hatching: '한 방향 평행선으로 명암을 쌓는 정석 펜 드로잉. 가장 무난하고 사진 재현이 안정적입니다.',
  crosshatch: '여러 각도의 선을 교차시켜 부드러운 중간톤을 만듭니다. 입체감과 질감이 풍부합니다.',
  contour: '명암을 거의 넣지 않고 윤곽과 형태선만으로 그립니다. 여백이 많고 간결합니다.',
  scribble: '둥글게 휘감는 낙서 같은 선을 겹쳐 톤을 만듭니다. 자유롭고 에너지가 느껴집니다.',
  stipple: '선 대신 점의 밀도로 명암을 표현합니다. 시간이 오래 걸린 듯한 정교한 인상입니다.',
  engraving: '굵기가 규칙적으로 변하는 선으로 동판화·지폐 삽화 같은 느낌을 냅니다.',
  urban: '느슨하고 빠른 선, 일부러 남긴 미완성 여백. 여행 스케치북 느낌입니다.',
  realistic: '아주 촘촘한 선으로 사진처럼 세밀하게 묘사합니다. 가장 오래 그린 듯한 결과입니다.',
  comic: '굵은 외곽선과 검게 채운 그림자(스팟 블랙). 만화·잉크 일러스트 느낌입니다.',
  architectural: '직선 위주의 정확한 원근과 균일한 선. 건축 도면·투시도 같은 인상입니다.',
  ghibli: '손그림 애니메이션 배경화 느낌. 부드럽고 깨끗한 윤곽, 단순화한 형태, 셀 방식의 2~3단계 평면 명암, 따뜻하고 서정적인 분위기.',
  webtoon: '한국 웹툰의 깔끔한 디지털 선화. 굵기가 일정한 외곽선, 단순한 셀 셰이딩, 인물은 또렷하고 배경은 간략하게.',
  manga: '일본 만화 원고 느낌. 가늘고 날카로운 펜선, 스크린톤처럼 규칙적인 점·선 무늬로 명암, 강조 부분에 굵은 잉크.',
  watercolor: '펜으로 윤곽을 그리고 물을 많이 섞은 수채를 몇 단계의 옅은 담채로 얹는 어반 스케치 방식. 밝은 곳은 종이를 남기고 담채 가장자리는 안료가 고여 살짝 짙어집니다. 흑백이면 먹 담채가 됩니다.',
};
