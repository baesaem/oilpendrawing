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
export type Engine = 'local' | 'ai';

/**
 * 사용자가 사진 위에 직접 그은 해칭 방향 지시선 (DAP 의 수동 Feature Follow 에 해당).
 * 좌표는 그림 상대(0~1). 선에 가까운 곳의 해칭이 그 방향을 따르고, 멀어질수록 자동 방향장으로 돌아간다.
 */
export interface DirectionGuide {
  id: string;
  points: Array<[number, number]>;
}

/** 로컬 렌더러의 채우기 방식 */
export type FillMode = 'sketch' | 'hatch' | 'cross' | 'contour' | 'scribble' | 'stipple' | 'wash';
export const FILL_LABEL: Record<FillMode, string> = {
  sketch: '어반 스케치 (면 방향 해칭 + 나뭇잎 고리선)', hatch: '한 방향 해칭', cross: '교차 해칭', contour: '윤곽선 위주', scribble: '스크리블', stipple: '점묘',
  wash: '펜 선 + 수채 담채 (밝기를 몇 단계의 옅은 담채로, 어두운 곳만 성긴 해칭)',
};

/**
 * 선·톤 프로필. 견본 드로잉을 분석해 채우거나 사용자가 직접 조절합니다.
 * 모든 픽셀 단위 값은 긴 변 1000px 기준입니다.
 */
export interface StrokeProfile {
  fill: FillMode;
  /** 톤 단계 수 (종이 포함) 2~6 */
  tones: number;
  /** 종이를 비워 두는 정도 0~100. 높을수록 밝은 곳을 넓게 남깁니다 */
  paperKeep: number;
  /** 선 굵기 px 1~6 */
  lineWidth: number;
  /** 윤곽선 밀도 0~100 */
  edgeDensity: number;
  /** 해칭 각도 0~179도 (0 = 수평) */
  hatchAngle: number;
  /** 해칭 간격 px 3~24 */
  hatchSpacing: number;
  /** 손떨림·불규칙 0~100 */
  jitter: number;
  /** 종이색 #rrggbb */
  paperColor: string;
  /** 잉크색 #rrggbb */
  inkColor: string;
  /** 가장자리를 미완성처럼 흐리는 정도 0~100 (어반 스케치 특유의 여백) */
  vignette: number;
}

/**
 * 리천 스타일 (instagram.com/richeons_drawing_journey).
 * 가는 검정 펜, 면의 방향을 따르는 해칭, 나뭇잎은 고리 선 뭉치, 하늘·하이라이트는 흰 종이,
 * 가장자리는 미완성으로 흐려진다. 낙관·사인은 별도 등록 기능(stamps.ts)으로 찍는다.
 */
export const RICHEON_STROKES: StrokeProfile = {
  fill: 'sketch', tones: 5, paperKeep: 58, lineWidth: 1.2, edgeDensity: 70, hatchAngle: 55, hatchSpacing: 5, jitter: 30,
  paperColor: '#f6f3ec', inkColor: '#17171a', vignette: 40,
};
/**
 * 세밀 펜화 (전문 펜화가의 방식).
 * 아주 가늘고 고른 선으로 종이 끝까지 빈틈없이 완성. 하늘은 수평 해칭 속에 구름을 흰 여백으로 남기고,
 * 깊은 그림자는 먹으로 채운다. 나뭇잎은 촘촘한 잎 뭉치, 낡은 벽은 잔결 질감.
 */
export const FINE_STROKES: StrokeProfile = {
  fill: 'sketch', tones: 6, paperKeep: 40, lineWidth: 1, edgeDensity: 90, hatchAngle: 0, hatchSpacing: 3, jitter: 25,
  paperColor: '#f7f5f0', inkColor: '#111114', vignette: 0,
};
/** 예전 기본값: 굵은 펜의 한 방향 해칭 */
export const CLASSIC_STROKES: StrokeProfile = {
  fill: 'hatch', tones: 4, paperKeep: 55, lineWidth: 2, edgeDensity: 50, hatchAngle: 35, hatchSpacing: 7, jitter: 35,
  paperColor: '#f5f0e6', inkColor: '#221e1b', vignette: 0,
};
export const DEFAULT_STROKES: StrokeProfile = RICHEON_STROKES;

/** 숙련도별 기본 선·톤 (견본이 없을 때 출발점). 리천 스타일을 숙련도에 맞게 단순화합니다 */
export function strokesForLevel(level: Level): StrokeProfile {
  switch (level) {
    case 'beginner': return { ...RICHEON_STROKES, tones: 3, lineWidth: 1.8, edgeDensity: 50, hatchSpacing: 8, jitter: 40 };
    case 'intermediate': return { ...RICHEON_STROKES, tones: 4, lineWidth: 1.5, edgeDensity: 60, hatchSpacing: 6 };
    case 'advanced': return { ...RICHEON_STROKES };
  }
}

/** 화풍 선택이 로컬 채우기 방식에 대응되는 경우 */
export const FILL_FOR_STYLE: Partial<Record<PenStyle, FillMode>> = {
  richeon: 'sketch', fineink: 'sketch', urban: 'sketch',
  hatching: 'hatch', crosshatch: 'cross', contour: 'contour', scribble: 'scribble', stipple: 'stipple',
  engraving: 'hatch', architectural: 'hatch', realistic: 'cross', comic: 'contour', watercolor: 'wash',
};

/** 기본값과 측정값을 반영도(0~100)로 섞습니다 */
export function blendStrokes(base: StrokeProfile, m: StrokeProfile, weight: number): StrokeProfile {
  const t = Math.max(0, Math.min(1, weight / 100));
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    fill: t >= 0.5 ? m.fill : base.fill,
    tones: Math.round(mix(base.tones, m.tones)),
    paperKeep: Math.round(mix(base.paperKeep, m.paperKeep)),
    lineWidth: Math.round(mix(base.lineWidth, m.lineWidth) * 2) / 2,
    edgeDensity: Math.round(mix(base.edgeDensity, m.edgeDensity)),
    // 각도는 중간값이 의미가 없으므로 섞지 않고 고릅니다
    hatchAngle: t >= 0.5 ? m.hatchAngle : base.hatchAngle,
    hatchSpacing: Math.round(mix(base.hatchSpacing, m.hatchSpacing)),
    jitter: Math.round(mix(base.jitter, m.jitter)),
    paperColor: t >= 0.5 ? m.paperColor : base.paperColor,
    inkColor: t >= 0.5 ? m.inkColor : base.inkColor,
    // 가장자리 처리는 견본에서 재지 않으므로 기본값을 유지
    vignette: base.vignette,
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
  /** 로컬 렌더러의 선·톤 */
  strokes: StrokeProfile;
  /** AI 로 그릴 때 로컬 결과를 견본 이미지로 함께 보낼지 (같은 구도라 해칭 방향·톤 배치를 잘 따름) */
  aiRefFromLocal: boolean;
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
  strokes: DEFAULT_STROKES,
  aiRefFromLocal: true,
  guides: [],
  guideRadius: 18,
};

/** 이력에서 불러온 옛 레코드에 새 필드가 없을 수 있으므로 기본값과 병합합니다 */
export function mergeParams(p: Partial<DrawingParams> | undefined): DrawingParams {
  const merged = { ...DEFAULT_PARAMS, ...p, strokes: { ...DEFAULT_STROKES, ...(p?.strokes ?? {}) } };
  // 옛 이름의 화풍 ID
  if ((merged.style as string) === 'parkyongsoon') merged.style = 'fineink';
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
