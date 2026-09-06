export type ColorMode = 'color' | 'mono';
/** 빛의 방향. 8방위에 정면광(front)·역광(back)을 더한 것. 자동(사진 그대로)은 DrawingParams.lightAuto 가 맡는다 */
export type LightDir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'front' | 'back';
/** 다이얼에 점으로 놓이는 8방위 (정면·역광은 방향이 없어 빠진다) */
export type CompassDir = Exclude<LightDir, 'front' | 'back'>;
import type { ArtistId } from './artists';
export type { ArtistId } from './artists';

export type ProviderId = 'gemini' | 'openai' | 'xai';
export type PenStyle =
  | 'tonehatch' | 'richeon' | 'fineink'
  | 'hatching' | 'crosshatch' | 'contour' | 'stipple'
  | 'engraving' | 'realistic' | 'comic'
  | 'watercolor' | 'oil' | 'vangogh';

/** 결과를 만든 엔진: 브라우저 로컬 렌더러 또는 AI 제공사 */
/** 결과를 만든 엔진: 브라우저 로컬 렌더러, AI 제공사, 또는 밖에서 만든 그림(Dynamic Auto-Painter 등)을 불러온 것 */
/** 'external' 은 없앤 "외부 결과 불러오기"가 남긴 옛 이력 값이다 — 새로 만들지 않는다 */
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
export type BrushKind = 'tone' | 'pen' | 'contour' | 'stipple' | 'wash' | 'oil' | 'impasto';
export const BRUSH_LABEL: Record<BrushKind, string> = {
  tone: '펜화 — 밝기를 몇 단계로 나눠 한 방향 펜선. 어두울수록 굵고 촘촘하게, 셋째 층부터 교차선, 가장 밝은 곳은 선 없음',
  pen: '리천 — 면을 따라 흐르는 짧은 획, 나뭇잎은 고리 선, 그림자는 교차',
  contour: '윤곽 — 윤곽선 위주, 깊은 그림자만 해칭',
  stipple: '점묘 — 점의 밀도로 명암',
  wash: '담채 — 수채 붓 자국을 겹쳐 얹고 펜은 윤곽과 깊은 그림자만',
  oil: '유화 — 불투명한 짧은 붓 자국을 큰 것부터 작은 것까지 겹쳐 화면을 다 덮음',
  impasto: '고흐 — 길고 굽은 두꺼운 붓 자국, 자국마다 색이 조금씩 다르고 가장자리는 어둡게',
};
export const BRUSH_SHORT: Record<BrushKind, string> = { tone: '펜화', pen: '리천', contour: '윤곽', stipple: '점묘', wash: '담채', oil: '유화', impasto: '고흐' };

/**
 * 색 팔레트 (DAP Main Painter 의 Palette 에 해당). 컬러로 그릴 때만 뜻이 있다.
 * `match`·`match2` 는 사진 색을 물감 팔레트의 가장 가까운 색으로 옮긴다 — 실제 물감통을 쓰는 것처럼 색 수가 줄어 그림다워진다.
 */
export type PaletteId = 'photo' | 'bright' | 'mono' | 'match' | 'match2';
export const PALETTE_LABEL: Record<PaletteId, string> = {
  photo: '사진 색 그대로',
  bright: '선명하게 (채도를 올려 맑게)',
  mono: '단색 (잉크색 하나의 명암으로)',
  match: '팔레트 12색 (가장 가까운 물감색으로)',
  match2: '팔레트 + 사진색 (물감색과 사진색을 반씩)',
};
export const PALETTE_SHORT: Record<PaletteId, string> = { photo: '기본', bright: '선명', mono: '단색', match: '12색', match2: '혼합' };
/** 팔레트 12색 (수채 기본 세트). match·match2 가 이 색으로 옮긴다 */
export const PALETTE_12: string[] = [
  '#f5d000', '#ef7b10', '#d9381e', '#a4123f', '#6b3fa0', '#2b4b9b',
  '#1e88c7', '#0e8a6b', '#6fa83c', '#c99a2e', '#8c4a2f', '#38424d',
];

/** 브러시 팁 (포토샵 브러시 도구의 팁 모양에 해당). 담채·유화·임파스토 붓이 쓴다. 펜 붓은 늘 둥근 펜촉 */
export type TipKind = 'auto' | 'round' | 'bristle' | 'wet' | 'chalk';
export const TIP_LABEL: Record<TipKind, string> = {
  auto: '자동 — 1~2층은 큰 평붓(수채는 젖은 붓), 3~4층은 중간 둥근 붓, 5~6층은 가는 붓 (DAP 의 붓 3벌)',
  round: '둥근 붓 (부드러운 원형 자국)',
  bristle: '평붓 강모 (붓털 줄무늬가 보이는 납작한 자국)',
  wet: '젖은 둥근 붓 (가장자리가 불규칙하게 번지는 수채 붓)',
  chalk: '드라이 브러시 (털이 성글어 긁힌 듯 갈라지는 자국)',
};
export const TIP_SHORT: Record<TipKind, string> = { auto: '자동', round: '둥근', bristle: '평붓', wet: '젖은', chalk: '드라이' };

/**
 * 그리기 설정 (Dynamic Auto-Painter 의 프리셋 파라미터에 해당). 로컬 엔진이 보는 값의 전부다.
 * 층(pass)마다 획 크기를 brushSize 에서 detail 까지 줄여 가며, 캔버스가 목표보다 밝은 곳에만 획을 놓는다.
 * 픽셀 단위 값(lineWidth)은 긴 변 1000px 기준.
 */
export interface PaintProfile {
  brush: BrushKind;
  /** 브러시 팁 모양 (담채·유화·임파스토에서만 의미). 'auto' 면 층마다 다른 붓을 쓴다 */
  tip: TipKind;
  /** 색 팔레트 (컬러로 그릴 때만) */
  palette: PaletteId;
  /**
   * 원근 선 굵기 0~100 (펜 붓만). 가까운 곳은 굵고(선 굵기 그대로 ≈ 0.4~0.6mm) 먼 곳은 가늘게(≈ 0.05~0.2mm) 긋는다.
   * 0 이면 어디나 같은 굵기. 원근은 사진에서 추정한다 (아래쪽·또렷한 곳이 가깝고, 위쪽·흐린 곳이 멀다).
   */
  depth: number;
  /** 마른 붓 0 ↔ 젖은 붓 100 (DAP 의 Dry–Wet). 붓 종류·번짐·안료 고임·불투명도를 함께 움직인다 */
  wet: number;
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
  brush: 'pen', tip: 'round', palette: 'photo', wet: 30, depth: 70, passes: 4, brushSize: 45, detail: 75, accuracy: 60, strokeLength: 60, featureFollow: 85, baseAngle: 55, randomness: 30,
  lineWidth: 1.4, ink: 88, paperKeep: 66, edges: 80, vignette: 40, paperColor: '#f6f3ec', inkColor: '#17171a',
};
/** 세밀 펜화: 아주 가늘고 고른 선으로 끝까지 완성, 수평 하늘 해칭, 먹 그림자 */
export const FINE_PAINT: PaintProfile = {
  brush: 'pen', tip: 'round', palette: 'photo', wet: 30, depth: 60, passes: 6, brushSize: 40, detail: 100, accuracy: 85, strokeLength: 80, featureFollow: 90, baseAngle: 0, randomness: 8,
  lineWidth: 1, ink: 92, paperKeep: 52, edges: 90, vignette: 0, paperColor: '#f7f5f0', inkColor: '#111114',
};
/** 클래식: 굵은 펜의 한 방향 해칭 */
export const CLASSIC_PAINT: PaintProfile = {
  brush: 'tone', tip: 'round', palette: 'photo', wet: 30, depth: 70, passes: 5, brushSize: 50, detail: 62, accuracy: 65, strokeLength: 70, featureFollow: 40, baseAngle: 35, randomness: 30,
  lineWidth: 1.8, ink: 80, paperKeep: 55, edges: 50, vignette: 0, paperColor: '#f5f0e6', inkColor: '#221e1b',
};
export const DEFAULT_PAINT: PaintProfile = RICHEON_PAINT;

/** 화풍마다 완전한 그리기 설정 (DAP 의 프리셋). 갤러리에서 화풍을 고르면 이 값이 그대로 들어간다 */
export const PAINT_FOR_STYLE: Record<PenStyle, PaintProfile> = {
  tonehatch: { ...CLASSIC_PAINT, brush: 'tone', passes: 5, brushSize: 50, detail: 62, accuracy: 70, strokeLength: 70, featureFollow: 0, baseAngle: 35, randomness: 22, lineWidth: 1.4, ink: 82, paperKeep: 58, edges: 45, vignette: 0 },
  richeon: RICHEON_PAINT,
  fineink: FINE_PAINT,
  hatching: CLASSIC_PAINT,
  crosshatch: { ...CLASSIC_PAINT, brush: 'tone', passes: 6, detail: 75, accuracy: 70, strokeLength: 65, randomness: 25, lineWidth: 1.5, paperKeep: 50, edges: 55 },
  contour: { ...CLASSIC_PAINT, brush: 'contour', passes: 2, brushSize: 40, detail: 60, accuracy: 50, strokeLength: 60, featureFollow: 70, baseAngle: 45, randomness: 25, ink: 85, paperKeep: 65, edges: 95 },
  stipple: { ...CLASSIC_PAINT, brush: 'stipple', passes: 4, brushSize: 40, detail: 85, accuracy: 65, strokeLength: 0, featureFollow: 0, randomness: 50, lineWidth: 1.6, ink: 90, edges: 30 },
  engraving: { ...CLASSIC_PAINT, passes: 5, brushSize: 40, detail: 85, accuracy: 75, strokeLength: 90, featureFollow: 90, baseAngle: 0, randomness: 10, lineWidth: 1.4, ink: 82, paperKeep: 45, edges: 60 },
  realistic: { ...CLASSIC_PAINT, brush: 'tone', passes: 6, brushSize: 35, detail: 100, accuracy: 95, strokeLength: 45, featureFollow: 70, baseAngle: 30, randomness: 15, lineWidth: 1, ink: 85, paperKeep: 35, edges: 75 },
  comic: { ...CLASSIC_PAINT, brush: 'contour', passes: 3, brushSize: 45, detail: 70, accuracy: 55, strokeLength: 55, featureFollow: 60, baseAngle: 45, randomness: 20, lineWidth: 2.4, ink: 95, paperKeep: 60, edges: 100 },
  watercolor: { ...RICHEON_PAINT, brush: 'wash', tip: 'auto', palette: 'match2', wet: 72, passes: 4, brushSize: 78, detail: 80, accuracy: 72, strokeLength: 50, featureFollow: 55, baseAngle: 40, randomness: 50, lineWidth: 1.6, ink: 60, paperKeep: 62, edges: 45, vignette: 15 },
  oil: { ...RICHEON_PAINT, brush: 'oil', tip: 'auto', palette: 'match2', wet: 30, passes: 4, brushSize: 68, detail: 95, accuracy: 80, strokeLength: 40, featureFollow: 65, baseAngle: 0, randomness: 55, lineWidth: 1, ink: 0, paperKeep: 0, edges: 0, vignette: 0 },
  vangogh: { ...RICHEON_PAINT, brush: 'impasto', tip: 'auto', palette: 'match', wet: 18, passes: 4, brushSize: 62, detail: 85, accuracy: 75, strokeLength: 85, featureFollow: 100, baseAngle: 20, randomness: 45, lineWidth: 1.4, ink: 0, paperKeep: 0, edges: 55, vignette: 0 },

};

/** 기본값과 측정값을 반영도(0~100)로 섞습니다 */
export function blendPaint(base: PaintProfile, m: PaintProfile, weight: number): PaintProfile {
  const t = Math.max(0, Math.min(1, weight / 100));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return {
    brush: t >= 0.5 ? m.brush : base.brush,
    tip: t >= 0.5 ? m.tip : base.tip,
    palette: base.palette,
    wet: mix(base.wet, m.wet),
    depth: base.depth,
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
  // 옛 채우기 방식 → 지금의 붓 (해칭·교차는 명암 단계 해칭으로, 스크리블은 리천 획으로)
  const MAP: Record<string, BrushKind> = { sketch: 'pen', hatch: 'tone', cross: 'tone', contour: 'contour', scribble: 'pen', stipple: 'stipple', wash: 'wash' };
  const brush: BrushKind = MAP[fill] ?? 'tone';
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
  /** 로컬 엔진의 그리기 설정 */
  paint: PaintProfile;
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
  intensity: 60,
  color: 'color',
  light: 'NW',
  lightAuto: true,
  brightness: 0,
  contrast: 0,
  referenceWeight: 60,
  paint: DEFAULT_PAINT,
  aiRefFromLocal: true,
  guides: [],
  guideRadius: 18,
};

/** 이력에서 불러온 옛 레코드에 새 필드가 없을 수 있으므로 기본값과 병합합니다 */
export function mergeParams(p: Partial<DrawingParams> | undefined): DrawingParams {
  const old = (p as { strokes?: Record<string, unknown> } | undefined)?.strokes;
  // 없앤 화풍(스크리블·어반·건축 제도·지브리·웹툰·망가·판각)과 옛 ID 는 가장 가까운 화풍으로 옮긴다
  const OLD_STYLE: Record<string, PenStyle> = {
    parkyongsoon: 'fineink', scribble: 'richeon', urban: 'richeon', architectural: 'hatching',
    ghibli: 'comic', webtoon: 'comic', manga: 'comic', carver: 'vangogh',
  };
  const style = p?.style ? OLD_STYLE[p.style as string] ?? p.style : undefined;
  // 옛 레코드(선·톤 프로필)는 옮기고, 아주 옛 레코드(둘 다 없음)는 화풍의 프리셋으로
  const paint = p?.paint ? { ...(style ? PAINT_FOR_STYLE[style] : DEFAULT_PAINT), ...p.paint } : migrateStrokes(old) ?? (style ? PAINT_FOR_STYLE[style] : DEFAULT_PAINT);
  // 옛 레코드가 지금은 없는 붓을 가리킬 수 있다
  const OLD_BRUSH: Record<string, PaintProfile['brush']> = { hatch: 'tone', cross: 'tone', scribble: 'pen' };
  const fixed = OLD_BRUSH[paint.brush as string];
  if (fixed) paint.brush = fixed;
  const merged: DrawingParams = { ...DEFAULT_PARAMS, ...p, paint };
  delete (merged as unknown as { strokes?: unknown }).strokes;
  delete (merged as unknown as { level?: unknown }).level; // 숙련도(초급·중급·상급)는 없앴다
  delete (merged as unknown as { grayscaleInput?: unknown }).grayscaleInput; // 입력 흑백 변환 토글도 없앴다
  delete (merged as unknown as { aiRefFromPreset?: unknown }).aiRefFromPreset; // 프리셋 견본 토글도 없앴다 (늘 켠 것과 같다)
  if ((merged.color as string) === 'sepia') merged.color = 'mono'; // 세피아는 없앴다
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

export const COLOR_LABEL: Record<ColorMode, string> = { color: '컬러', mono: '흑백' };
export const LIGHT_LABEL: Record<LightDir, string> = {
  N: '위', NE: '우상단', E: '오른쪽', SE: '우하단', S: '아래', SW: '좌하단', W: '왼쪽', NW: '좌상단',
  front: '앞에서', back: '뒤에서',
};
export const LIGHT_DIRS: CompassDir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const PEN_STYLES: PenStyle[] = [
  'tonehatch', 'richeon', 'fineink', 'hatching', 'crosshatch', 'contour', 'stipple', 'engraving', 'realistic', 'comic',
  'watercolor', 'oil', 'vangogh',
];
export const STYLE_LABEL: Record<PenStyle, string> = {
  tonehatch: '펜화 · 대비',
  richeon: '리천 스타일 (어반 펜 스케치)',
  fineink: '인물화 (세밀 펜)',
  hatching: '고전 (한 방향 해칭)',
  crosshatch: '크로스 해칭',
  contour: '윤곽선 드로잉',
  stipple: '점묘',
  engraving: '판화풍',
  realistic: '극사실 세밀화',
  comic: '잉크 일러스트',
  watercolor: '수채 담채 (펜 + 수채)',
  oil: '유화 붓터치 (인상주의)',
  vangogh: '고흐풍 유화 (임파스토)',

};
export const STYLE_DESC: Record<PenStyle, string> = {
  tonehatch: '사진을 밝기 5단계로 나누고 단계마다 한 방향 펜선을 얹습니다. 가장 밝은 단계는 흰 종이로 비우고, 어두운 단계일수록 선이 굵고 촘촘해지며 셋째 단계부터 교차선이 됩니다. 스케치북에 그대로 따라 그리기 가장 쉬운 방식입니다.',
  richeon: '가는 검정 펜으로 면의 방향을 따라 해칭(벽은 세로, 바닥은 원근 방향). 나뭇잎은 뭉게구름처럼 둘러 그리고 안을 고리 선으로 채웁니다. 하늘과 밝은 곳은 흰 종이로 비우고 가장자리는 미완성으로 둡니다. @richeons_drawing_journey',
  fineink: '아주 가늘고 고른 선으로 얼굴을 그리는 인물화. 눈·코·입·머리카락처럼 작은 톤 차를 끝까지 따라가고, 머리카락과 깊은 그림자는 먹으로 채워 대비를 만듭니다. 밝은 뺨과 콧등은 흰 종이로 남깁니다.',
  hatching: '한 방향 평행선으로 명암을 쌓는 정석 펜 드로잉. 가장 무난하고 사진 재현이 안정적입니다.',
  crosshatch: '여러 각도의 선을 교차시켜 부드러운 중간톤을 만듭니다. 입체감과 질감이 풍부합니다.',
  contour: '명암을 거의 넣지 않고 윤곽과 형태선만으로 그립니다. 여백이 많고 간결합니다.',
  stipple: '선 대신 점의 밀도로 명암을 표현합니다. 시간이 오래 걸린 듯한 정교한 인상입니다.',
  engraving: '굵기가 규칙적으로 변하는 선으로 동판화·지폐 삽화 같은 느낌을 냅니다.',
  realistic: '아주 촘촘한 선으로 사진처럼 세밀하게 묘사합니다. 가장 오래 그린 듯한 결과입니다.',
  comic: '굵은 외곽선과 검게 채운 그림자(스팟 블랙). 만화·잉크 일러스트 느낌입니다.',
  watercolor: '펜으로 윤곽을 그리고 물을 많이 섞은 수채를 몇 단계의 옅은 담채로 얹는 어반 스케치 방식. 밝은 곳은 종이를 남기고 담채 가장자리는 안료가 고여 살짝 짙어집니다. 흑백이면 먹 담채가 됩니다.',
  oil: '불투명한 짧은 붓 자국을 큰 것부터 작은 것까지 겹쳐 종이를 다 덮는 인상주의 유화. 색은 사진보다 맑고 진하게, 붓은 면의 방향을 따르고, 빛 받는 곳은 밝은 붓 자국으로 살립니다. 컬러로 보는 것이 좋습니다.',
  vangogh: '고흐의 후기 풍경화처럼 길고 굽은 두꺼운 붓 자국이 면의 흐름을 따라 소용돌이칩니다. 자국마다 색이 조금씩 달라 노랑·주황·초록이 줄무늬로 섞이고, 형태는 짙은 윤곽 붓으로 둘러 잡습니다. 컬러로 보는 것이 좋습니다.',

};
