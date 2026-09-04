import { ARTIST_BY_ID } from './artists';
import type { ArtistId, Level, LightDir, PenStyle } from './types';
import { LIGHT_LABEL } from './types';

export type GuideStep = 'compose' | 'shape' | 'value' | 'final';
export const GUIDE_STEPS: Array<{ id: GuideStep; label: string; short: string }> = [
  { id: 'compose', label: '1 구도', short: '격자로 위치 잡기' },
  { id: 'shape', label: '2 큰 형태', short: '윤곽선만 연하게' },
  { id: 'value', label: '3 명암', short: '어두운 곳부터 해칭' },
  { id: 'final', label: '4 완성 참고', short: 'AI 드로잉 보며 마무리' },
];

const COMMON: Record<GuideStep, string> = {
  compose:
    '스케치북에 같은 칸 수의 격자를 아주 연하게 그립니다. 오일펜은 지울 수 없으니 격자는 연필로 그려도 좋습니다. ' +
    '큰 덩어리가 어느 칸의 어디에 걸치는지 점만 먼저 찍어 두세요.',
  shape:
    '선은 손목이 아니라 팔 전체로, 한 번에 길게 긋습니다. 필압은 평소의 10% 정도로 큰 윤곽만 그리고, 세부와 명암은 아직 넣지 않습니다. ' +
    '틀린 선은 지우려 하지 말고 옆에 바른 선을 한 번 더 긋습니다.',
  value:
    '가장 어두운 곳부터 채우고, 가장 밝은 곳은 종이를 끝까지 비워 둡니다. 밝은 쪽에서 어두운 쪽으로 갈수록 선 간격을 좁힙니다.',
  final:
    '완성 참고를 보며 어두운 곳을 더 어둡게 하되, 밝은 곳은 그대로 둡니다. 눈을 가늘게 뜨고 보면 어디가 더 어두워야 하는지 보입니다. ' +
    '과정 그림을 만들면 네 단계 순서를 한 장으로 볼 수 있습니다.',
};

const BY_LEVEL: Record<GuideStep, Partial<Record<Level, string>>> = {
  compose: {
    beginner: '3×3 격자로 시작하세요. 칸이 적을수록 헷갈리지 않습니다.',
    advanced: '격자 없이 시선 높이와 기준선 하나만 그려 잡아 보는 연습도 좋습니다.',
  },
  shape: {
    beginner: '피사체를 원·상자·원통 같은 단순 도형으로 바꿔 보고, 그 도형부터 그립니다.',
    advanced: '겹치는 부분은 앞쪽 형태를 먼저, 뒤쪽은 끊어서 그립니다. 선의 강약으로 앞뒤를 구분하세요.',
  },
  value: {
    beginner: '밝음·중간·어두움 3단계만 봅니다. 해칭은 한 방향으로만, 중간은 간격을 벌려서.',
    intermediate: '4단계. 첫 해칭이 마르기 전에 겹치면 뭉치니 한 층씩 차례로 올립니다.',
    advanced: '5단계. 두 번째 층은 30~45도 다른 각도로 겹쳐 중간톤을 부드럽게. 그림자 가장자리에 반사광을 살짝 남깁니다.',
  },
  final: {
    beginner: '완성 참고와 똑같이 그릴 필요는 없습니다. 큰 명암 위치만 맞으면 그림이 읽힙니다.',
  },
};

export const STYLE_TIP: Record<PenStyle, string> = {
  hatching: '한 면에는 한 방향의 선만. 방향이 바뀌는 곳이 면이 꺾이는 곳입니다.',
  crosshatch: '두 번째 층은 첫 층과 30~45도 차이. 90도로 교차하면 그물처럼 딱딱해 보입니다.',
  contour: '선 하나가 곧 형태입니다. 안쪽 선은 꼭 필요한 접히는 곳에만 넣으세요.',
  scribble: '손을 멈추지 말고 작은 원을 겹칩니다. 어두운 곳은 원을 작게, 밝은 곳은 크게.',
  stipple: '펜을 세워 톡톡 찍습니다. 톤은 점의 크기가 아니라 간격으로 조절합니다.',
  engraving: '선 간격을 일정하게, 형태를 따라 휘게. 어두운 곳은 선을 굵게(필압) 합니다.',
  urban: '완벽하게 닫지 않아도 됩니다. 관심 있는 부분만 자세히, 나머지는 몇 개 선으로 암시합니다.',
  realistic: '아주 작은 부분씩 나눠 그립니다. 종이 한 손가락 넓이를 끝내고 다음으로.',
  comic: '외곽선을 먼저 굵게 확정한 뒤 가장 어두운 그림자만 검게 채웁니다. 중간톤은 생략해도 됩니다.',
  architectural: '수직선은 항상 수직으로. 소실점을 종이 밖에라도 점으로 찍어 두고 선을 맞춥니다.',
};

export function buildTip(step: GuideStep, level: Level, style: PenStyle, light: LightDir, artist: ArtistId = 'none'): string[] {
  const out = [COMMON[step]];
  const lv = BY_LEVEL[step][level];
  if (lv) out.push(lv);
  if (step === 'value' || step === 'final') {
    out.push(`빛은 ${LIGHT_LABEL[light]}에서 옵니다. 해칭은 빛의 반대편으로 갈수록 촘촘하게, 그림자는 그 반대 방향으로 떨어집니다.`);
    out.push(STYLE_TIP[style]);
    const a = ARTIST_BY_ID[artist];
    if (a && a.id !== 'none') out.push(`${a.name} 풍: ${a.tip}`);
  }
  return out;
}
