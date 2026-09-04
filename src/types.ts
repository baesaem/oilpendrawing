export type Level = 'beginner' | 'intermediate' | 'advanced';
export type ColorMode = 'color' | 'mono' | 'sepia';
export type LightDir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type ProviderId = 'gemini' | 'openai' | 'xai';
export type PenStyle =
  | 'hatching' | 'crosshatch' | 'contour' | 'scribble' | 'stipple'
  | 'engraving' | 'urban' | 'realistic' | 'comic' | 'architectural';

export interface DrawingParams {
  /** 화풍 */
  style: PenStyle;
  level: Level;
  /** 0~100 선 밀도·필압 */
  intensity: number;
  color: ColorMode;
  light: LightDir;
  /** -50~+50 */
  brightness: number;
  /** -50~+50 */
  contrast: number;
  /** 0~100 견본 반영도 */
  referenceWeight: number;
  /** 입력을 흑백으로 변환해서 보냄 */
  grayscaleInput: boolean;
}

export const DEFAULT_PARAMS: DrawingParams = {
  style: 'hatching',
  level: 'intermediate',
  intensity: 60,
  color: 'mono',
  light: 'NW',
  brightness: 0,
  contrast: 0,
  referenceWeight: 60,
  grayscaleInput: false,
};

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
  params: DrawingParams;
  provider: ProviderId;
  model: string;
  prompt: string;
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
  'hatching', 'crosshatch', 'contour', 'scribble', 'stipple', 'engraving', 'urban', 'realistic', 'comic', 'architectural',
];
export const STYLE_LABEL: Record<PenStyle, string> = {
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
};
export const STYLE_DESC: Record<PenStyle, string> = {
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
};
