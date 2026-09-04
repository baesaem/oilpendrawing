/**
 * 유명 화가의 드로잉 화풍. 모두 사후 60년 이상 지난 거장(저작권 만료)으로만 구성했습니다.
 * 지시문에는 이름과 함께 선·명암 기법을 풀어 써서, 모델이 이름을 모르거나 이름 사용을 피하더라도 특징이 살게 합니다.
 */
export type ArtistId =
  | 'none' | 'vangogh' | 'rembrandt' | 'davinci' | 'durer' | 'schiele'
  | 'hokusai' | 'matisse' | 'kollwitz' | 'morandi' | 'giacometti';

export interface Artist {
  id: ArtistId;
  name: string;
  years: string;
  /** UI 설명 (한국어) */
  desc: string;
  /** 손으로 흉내 낼 때의 팁 */
  tip: string;
  /** 이미지 모델용 기법 서술 (영어) */
  prompt: string;
}

export const ARTISTS: Artist[] = [
  {
    id: 'none', name: '없음', years: '',
    desc: '선택한 화풍과 숙련도만 반영합니다.', tip: '', prompt: '',
  },
  {
    id: 'vangogh', name: '빈센트 반 고흐', years: '1853–1890',
    desc: '갈대펜으로 그린 짧고 리듬 있는 선과 점. 선이 형태를 따라 소용돌이치듯 흐르고, 질감마다 다른 무늬를 씁니다.',
    tip: '한 면을 같은 방향의 짧은 획으로 채우고, 옆 면은 획의 방향을 바꿉니다. 하늘·풀·나무마다 다른 무늬를 정해 두세요.',
    prompt: 'in the manner of Vincent van Gogh\'s reed-pen drawings: short rhythmic dashes and dots, strokes that swirl and flow along the form, ' +
      'a different stroke pattern for each texture (grass, sky, wood), energetic and dense, no smooth blending.',
  },
  {
    id: 'rembrandt', name: '렘브란트', years: '1606–1669',
    desc: '빠르고 경제적인 펜 선에 굵은 그림자 덩어리. 몇 개의 선으로 형태를 잡고, 어두운 곳은 과감하게 채웁니다.',
    tip: '선 수를 줄이는 연습입니다. 가장 중요한 선 열 개만 고른다는 마음으로 그리고, 그림자는 망설이지 말고 넓게 칩니다.',
    prompt: 'in the manner of Rembrandt\'s pen-and-ink sketches: quick, economical, confident lines that suggest form with very few strokes, ' +
      'bold broad shadow masses, loose and unfinished edges, strong sense of light.',
  },
  {
    id: 'davinci', name: '레오나르도 다 빈치', years: '1452–1519',
    desc: '형태를 따라 휘어지는 가늘고 촘촘한 평행 해칭. 왼손잡이 특유의 왼쪽 위에서 오른쪽 아래로 기운 선이 특징입니다.',
    tip: '해칭 선을 곡면을 따라 살짝 휘게 긋습니다. 간격은 일정하게, 어두운 곳은 선을 겹치지 말고 더 촘촘하게.',
    prompt: 'in the manner of Leonardo da Vinci\'s study drawings: fine, closely spaced parallel hatching that curves with the surface, ' +
      'diagonal strokes slanting from upper-left to lower-right, precise contours, delicate gradations, scientific observation.',
  },
  {
    id: 'durer', name: '알브레히트 뒤러', years: '1471–1528',
    desc: '동판화처럼 촘촘하고 정밀한 교차 해칭. 머리카락 한 올, 옷 주름 하나까지 규칙적인 선으로 묘사합니다.',
    tip: '작은 부분씩 나눠 끝내 가며 그립니다. 첫 층 해칭이 끝난 뒤에만 두 번째 층을 다른 각도로 올립니다.',
    prompt: 'in the manner of Albrecht Dürer\'s engravings and pen drawings: meticulous, dense cross-hatching with regular spacing, ' +
      'lines that swell and taper to model form, every fold and strand described, highly detailed and controlled.',
  },
  {
    id: 'schiele', name: '에곤 실레', years: '1890–1918',
    desc: '각지고 신경질적인 윤곽선, 넓은 여백. 명암은 거의 없고 선의 긴장감으로 형태와 감정을 표현합니다.',
    tip: '한 선을 끊지 말고 한 번에 긋되, 곡선 대신 꺾임을 살립니다. 종이 대부분을 비워 두는 용기가 필요합니다.',
    prompt: 'in the manner of Egon Schiele\'s line drawings: angular, nervous, taut contour lines, almost no shading, ' +
      'large empty paper, expressive slightly distorted proportions, lines that break and restart.',
  },
  {
    id: 'hokusai', name: '가쓰시카 호쿠사이', years: '1760–1849',
    desc: '붓처럼 굵기가 변하는 유려한 선. 해칭 대신 선의 흐름과 평면적인 구성으로 형태를 설명합니다.',
    tip: '필압으로 선 굵기를 바꿔 보세요. 눌러 시작해 힘을 빼며 끝내면 붓 같은 선이 됩니다. 명암보다 선의 리듬에 집중.',
    prompt: 'in the manner of Katsushika Hokusai\'s ink line drawings: flowing continuous lines with brush-like variation in thickness, ' +
      'minimal hatching, flat decorative composition, rhythmic outlines describing form and movement.',
  },
  {
    id: 'matisse', name: '앙리 마티스', years: '1869–1954',
    desc: '망설임 없는 한 줄 선. 명암도 세부도 없이 선 하나로 형태의 본질만 남깁니다.',
    tip: '먼저 사진을 30초 동안 본 뒤, 종이를 보지 않고 한 획으로 그려 보세요. 틀려도 다시 그리지 않습니다.',
    prompt: 'in the manner of Henri Matisse\'s line drawings: a single confident continuous contour line, no shading, no detail, ' +
      'utmost simplification keeping only the essential shape, generous white space.',
  },
  {
    id: 'kollwitz', name: '케테 콜비츠', years: '1867–1945',
    desc: '무겁고 어두운 톤 덩어리와 굵고 감정적인 획. 밝은 곳은 좁게 남기고 대부분을 짙은 톤으로 채웁니다.',
    tip: '평소보다 세 배 어둡게 그린다고 생각하세요. 필압을 최대로 겹쳐 검은 덩어리를 만들고 빛은 좁게만 남깁니다.',
    prompt: 'in the manner of Käthe Kollwitz\'s drawings: heavy dark tonal masses, bold emotional strokes, deep blacks built from layered pressure, ' +
      'few narrow highlights, somber and monumental.',
  },
  {
    id: 'morandi', name: '조르조 모란디', years: '1890–1964',
    desc: '정물 에칭의 고요하고 균일한 평행 해칭. 대비를 낮추고 톤을 조용히 쌓아 사물을 담담하게 그립니다.',
    tip: '선 간격을 처음부터 끝까지 똑같이 유지하는 연습입니다. 어두운 곳은 같은 간격의 층을 하나 더 올려서 만듭니다.',
    prompt: 'in the manner of Giorgio Morandi\'s still-life etchings: quiet, even, uniformly spaced parallel hatching, low contrast, ' +
      'tone built in calm layers, simplified humble objects, atmospheric restraint.',
  },
  {
    id: 'giacometti', name: '알베르토 자코메티', years: '1901–1966',
    desc: '탐색하듯 반복해서 긋는 선. 하나의 윤곽 대신 여러 번의 시도가 겹쳐 형태가 떠오릅니다.',
    tip: '정답 선을 찾으려 하지 말고, 가볍게 여러 번 겹쳐 그으며 형태를 찾아가세요. 겹친 선 자체가 그림이 됩니다.',
    prompt: 'in the manner of Alberto Giacometti\'s drawings: searching, repeated, tentative lines layered over each other, ' +
      'forms emerging from many overlapping strokes, a web of lines rather than a single contour, gray vibrating tone.',
  },
];

export const ARTIST_BY_ID: Record<ArtistId, Artist> = Object.fromEntries(ARTISTS.map((a) => [a.id, a])) as Record<ArtistId, Artist>;
