import { ARTIST_BY_ID } from './artists';
import type { DrawingParams, LightDir, PaintProfile, PenStyle } from './types';


const STYLE_TEXT: Record<PenStyle, string> = {
  tonehatch:
    'Style: textbook value hatching. Divide the picture into five clear value zones and fill each with parallel pen lines in one ' +
    'direction: the lightest zone left as bare white paper, then progressively thicker and more closely spaced lines, with a second ' +
    'and third set of lines crossing at an angle in the two darkest zones. Straight, evenly spaced, deliberate lines a student can copy.',
  richeon:
    'Style: Korean urban sketchbook pen drawing with a fine black liner. Thin uniform lines; hatching follows each surface ' +
    '(vertical strokes on walls, strokes receding along the perspective on roads and floors, long sweeping diagonals in the sky ' +
    'if it is toned at all); shadows built with tight cross-hatching. Foliage is drawn as cloud-like scalloped masses filled with ' +
    'small looping scribbles, darker underneath and left open on top. Sky, clouds and sunlit surfaces stay white untouched paper. ' +
    'The drawing fades out unfinished toward the edges of the paper; nothing is filled to the border. ' +
    'Leave one lower corner clear for a seal.',
  fineink:
    'Style: portrait drawing with an ultra-fine liner. Extremely fine, even, closely spaced lines follow the form of the face; ' +
    'tone is built patiently in many light layers so skin reads smooth, with the small value changes around the eyes, nose, ' +
    'lips and cheekbones carried all the way through. Hair is drawn as long continuous strokes in the direction it falls, ' +
    'massed into dark shapes with a few white strands left open; the darkest shadows are filled solid for contrast. ' +
    'The lit cheek, the bridge of the nose and the highlights stay untouched white paper, and the background is left ' +
    'mostly empty with only light hatching behind the head. Leave one lower corner clear for a signature.',
  hatching:
    'Style: pen line drawing with partial color. Form and tone are built with straight, evenly spaced parallel strokes in one ' +
    'dominant direction per plane; then only a few focal areas (a roof, a door, foliage) get light transparent washes of color, ' +
    'while the rest stays black line on white paper. Most of the sheet is left uncolored.',
  crosshatch:
    'Style: cross-hatching. Layers of strokes at two to four angles build smooth, continuous mid-tones; darkest areas have the most layers.',
  contour:
    'Style: pure contour line drawing. Only outlines and a few interior form lines, almost no shading, large areas of untouched paper.',
  stipple:
    'Style: stippling. Tone is made entirely of dots of varying density instead of lines; contours are implied by dot clusters.',
  engraving:
    'Style: engraving / etching look. Regular, precisely spaced lines that swell and taper to follow form, like a banknote illustration.',
  realistic:
    'Style: hyper-realistic pen rendering. Extremely fine, dense strokes reproducing every value and texture almost photographically.',
  comic:
    'Style: illustration. Clean outlines of even weight describe the forms; shadows are simplified into a few flat shapes with ' +
    'crisp edges (cel shading) rather than gradual shading, mid-tones are kept few and broad, and the result reads graphic and open.',
  carver:
    'Style: relief carving. The image looks cut into a block: forms are filled with long, thin, closely spaced grooves that follow ' +
    'the direction of each surface, boundaries are gouged as thick solid black lines, and the lit planes are left completely bare. ' +
    'Contrast is extreme — near-white and near-black with few mid-tones — and every line is deliberate, as if carved with a knife.',
  inkwash:
    'Style: East Asian ink-and-light-colour painting (수묵담채). The skeleton of the picture is drawn first in dark ink: trunks, branches, rock cracks and stems as confident tapering brush lines of varying thickness. Colour is then laid thinly and flatly between those lines in a few muted washes, never covering them, with one area kept vivid (a mass of yellow blossom, a patch of green) against everything else being subdued. Leaves and blossom are small separate dabs scattered in clusters, not solid shapes. Sky, water and paths are left as large areas of bare white paper.',
  watercolor:
    'Style: urban-sketch pen and wash. Confident ink outlines drawn first, then loose, transparent watercolor washes in a few ' +
    'flat value steps laid over them; highlights left as untouched white paper, washes bleeding softly past the lines, ' +
    'darker pigment pooling at wash edges, visible paper texture and granulation, sparse hatching only in the deepest shadows.',
  oil:
    'Style: impressionist oil painting instead of pen: short opaque brush strokes laid from large to small, colors clean and slightly ' +
    'more saturated than the photo, strokes following the form of each surface, sunlit areas built with bright thick touches, no outlines, ' +
    'no paper left bare, visible canvas and brush texture.',
  vangogh:
    'Style: post-impressionist oil painting in the manner of Van Gogh instead of pen: long curving thick impasto strokes that swirl ' +
    'along the flow of every surface, each stroke a slightly different hue so yellows, oranges and greens stripe together, dark blue ' +
    'contour strokes around the forms, saturated color, no bare canvas.',

};

/**
 * 화풍마다 "이것만은 하지 말 것". 지시문이 길면 모델이 모든 화풍을 평균 내어 비슷하게 그리므로,
 * 화풍을 가르는 특징을 금지 형태로 한 번 더 못 박는다.
 */
const STYLE_AVOID: Record<PenStyle, string> = {
  tonehatch: 'No outlines drawn as separate contour lines, no dots, no scribbles, no smooth gradients — tone exists only as countable parallel lines.',
  richeon: 'No ruled or mechanical lines, no smooth gradients, no solid grey fills, no color — a fast hand-held liner only.',
  fineink: 'No visible individual scribbles, no cross-hatching coarse enough to count from a distance, no color, no empty stylisation — the face must be fully modelled.',
  hatching: 'No full-color painting, no washes over the whole sheet — color touches only a few small areas and the rest stays black line on white.',
  crosshatch: 'No dots, no loops, no long contour outlines — tone is only layered straight strokes at several angles.',
  contour: 'No hatching, no shading, no fills — line only.',
  stipple: 'No lines, no hatching, no outlines at all — every mark is a dot.',
  engraving: 'No loose or wobbly strokes, no dots, no washes — lines are regular, parallel and mechanically precise.',
  realistic: 'No visible stylisation, no bare white shapes where the photo has tone, no outlines — only dense strokes reproducing the photograph.',
  comic: 'No hatching, no stippling, no gradual shading — shadows are flat shapes with hard edges.',
  carver: 'No soft grey mid-tones, no loose sketchy lines, no dots — only carved grooves, solid blacks and bare whites.',
  inkwash: 'No hatching, no dense shading, no fully covered sheet, no photographic colour — dark ink lines plus a few thin flat washes on bare paper.',
  watercolor: 'No dense hatching, no opaque paint, no covering the whole sheet — washes stay transparent and white paper shows.',
  oil: 'No outlines, no pen lines, no white paper, no flat areas — everything is opaque brush strokes.',
  vangogh: 'No smooth blending, no thin flat paint, no white canvas, no pen lines — every area is a visible curving impasto stroke.',
};

const LIGHT_TEXT: Record<LightDir, string> = {
  N: 'from directly above', NE: 'from the upper right', E: 'from the right', SE: 'from the lower right',
  S: 'from below', SW: 'from the lower left', W: 'from the left', NW: 'from the upper left',
  front: 'from the front, flat and even', back: 'from behind the subject as backlight',
};
const SHADOW_TEXT: Record<LightDir, string> = {
  N: 'straight below the forms', NE: 'toward the lower left', E: 'toward the left', SE: 'toward the upper left',
  S: 'above the forms', SW: 'toward the upper right', W: 'toward the right', NW: 'toward the lower right',
  front: 'only as small contact shadows, so the forms read by outline rather than by shading',
  back: 'toward the viewer, so the subject reads as one dark mass with a bright rim of light along its edges',
};

function artistText(p: DrawingParams): string {
  const a = ARTIST_BY_ID[p.artist];
  if (!a || a.id === 'none') return '';
  return `Interpret the technique above through a specific master's drawing manner — ${a.prompt} ` +
    'Keep it a hand-made pen drawing of the given photograph; borrow the stroke language, not the artist\'s subjects.';
}

/** 그리기 설정을 문장으로. 로컬 엔진과 AI 가 같은 설정을 보게 합니다 */
export function paintText(s: PaintProfile): string {
  const parts: string[] = [];
  const angle = `${s.baseAngle} degrees from horizontal`;
  const follow = s.featureFollow >= 60
    ? 'strokes follow the form of each surface (vertical on walls, receding along the perspective on floors)'
    : s.featureFollow >= 30 ? 'strokes mostly follow the form, falling back to one dominant direction on flat areas' : `strokes keep one dominant direction at roughly ${angle}`;
  switch (s.brush) {
    case 'pen': parts.push(`short pen strokes that ${follow.replace('strokes ', '')}, foliage as small looping scribbles, cross-hatching only in the shadows`); break;
    case 'contour': parts.push('contour lines first, hatching reserved for the deepest shadows'); break;
    case 'stipple': parts.push('stippled dots instead of lines, density for tone'); break;
    case 'tone': parts.push('parallel pen lines filling five clear value zones, thicker and denser in the darker zones, crossing lines in the darkest, lightest zone left as bare paper'); break;
    case 'inkwash': parts.push('dark tapering ink lines for the skeleton of every form, then a few thin flat colour washes laid between them'); break;
    case 'wash': parts.push('ink outlines with transparent watercolor washes for tone, hatching only in the deepest shadows'); break;
    case 'oil': parts.push('opaque impressionist oil brush strokes from large to small covering the whole canvas, no outlines'); break;
    case 'impasto': parts.push('long curving impasto strokes following the flow of each surface, hue varying stroke to stroke, dark contour strokes'); break;
  }
  // 붓마다 말이 다르다 — 점묘에 "펜 굵기", 유화에 "먹으로 채운 그림자" 같은 문장이 섞이면 화풍이 흐려진다
  const dot = s.brush === 'stipple';
  const paint = s.brush === 'inkwash' || s.brush === 'wash' || s.brush === 'oil' || s.brush === 'impasto';
  const ground = paint ? 'canvas' : 'paper';
  parts.push(`${s.passes} layers of marks from large shapes down to ${s.detail >= 75 ? 'fine' : s.detail >= 45 ? 'medium' : 'coarse'} detail`);
  parts.push(s.accuracy >= 75 ? 'values matched closely to the photograph' : s.accuracy >= 45 ? 'values simplified into a few clear steps' : 'only the main darks indicated, everything else left open');
  if (s.brush !== 'oil' && s.brush !== 'impasto') {
    parts.push(s.paperKeep > 65 ? `well over half of the ${ground} left untouched` : s.paperKeep >= 40 ? `about half of the ${ground} left untouched` : 'most of the sheet toned, only the highlights left white');
  }
  if (dot) parts.push(s.lineWidth <= 1.3 ? 'pin-point dots' : s.lineWidth <= 2.2 ? 'dots about half a millimetre across' : 'bold round dots about a millimetre across');
  else if (paint) parts.push(s.brushSize >= 65 ? 'a broad brush for the first layers narrowing to a small one' : 'a medium brush throughout');
  else parts.push(s.lineWidth <= 1.3 ? 'a very fine 0.1-0.3 mm liner' : s.lineWidth <= 2.2 ? 'a fine 0.3-0.5 mm pen' : 'a bold 0.7-1 mm pen');
  if (!dot && s.brush !== 'oil' && s.brush !== 'impasto') {
    if (s.edges > 70) parts.push('every edge and detail outlined');
    else if (s.edges < 40) parts.push('only the main outlines drawn');
  }
  if (s.ink >= 85 && !paint) parts.push('the deepest shadows filled solid black');
  if (dot) parts.push('dots packed tight in the darks and scattered wide in the lights');
  else parts.push(s.strokeLength >= 70 ? 'long confident strokes' : s.strokeLength <= 30 ? 'short stubby strokes' : 'medium-length strokes');
  parts.push(s.randomness < 25 ? `steady, almost ruled ${dot ? 'placement' : 'lines'}` : s.randomness > 60 ? `loose, irregular ${dot ? 'placement' : 'hand lines'}` : `natural, slightly irregular ${dot ? 'placement' : 'hand lines'}`);
  if (s.vignette > 20) parts.push(`the work fades out unfinished toward the edges of the ${ground}`);
  return `Stroke and tone settings: ${parts.join('; ')}.`;
}

function intensityText(v: number): string {
  if (v < 20) return 'very light touch, sparse strokes, lots of untouched paper';
  if (v < 40) return 'light pressure, open hatching with visible paper between strokes';
  if (v < 60) return 'medium pressure and stroke density';
  if (v < 80) return 'dense confident strokes with heavy pressure in the darks';
  return 'very dense, heavily layered strokes with saturated ink in the darkest areas';
}

function colorText(p: DrawingParams, paint: boolean): string {
  if (p.color === 'mono') {
    return paint
      ? 'Monochrome: one dark pigment thinned to a full range of values, no other hue.'
      : 'Monochrome: black oil pen ink only on off-white paper.';
  }
  return paint
    ? 'Color: a limited palette of six to eight mixed pigments, hues varying stroke to stroke, no muddy greys.'
    : 'Colored oil pens: a limited palette of five to seven pen colors layered by hatching, ' +
      'keeping the drawn, hand-made look (not a painting).';
}

function toneText(p: DrawingParams): string {
  const parts: string[] = [];
  if (p.brightness > 15) parts.push('overall bright and airy, keep large areas of paper untouched');
  else if (p.brightness < -15) parts.push('overall dark and moody, most of the paper covered by tone');
  if (p.contrast > 15) parts.push('high contrast: deep blacks against clean paper');
  else if (p.contrast < -15) parts.push('low contrast: soft, close mid-tones, no pure black');
  return parts.length ? parts.join('; ') + '.' : '';
}

/** 붓에 따라 매체가 다르다 — 담채·유화·임파스토는 펜 그림이 아니므로 지시문의 첫 줄부터 달라야 한다 */
function mediumText(s: PaintProfile): { open: string; hand: string } {
  if (s.brush === 'inkwash') {
    return {
      open: 'Repaint the provided photograph as a hand-made East Asian ink-and-light-colour painting on paper.',
      hand: 'Visible brush hairs at the end of each ink line and visible paper, no digital smoothing, no photographic texture.',
    };
  }
  if (s.brush === 'wash') {
    return {
      open: 'Repaint the provided photograph as a hand-made ink-and-watercolour painting on watercolour paper.',
      hand: 'Visible paper grain and granulation, pigment pooling at the edge of each wash, no digital smoothing, no photographic texture.',
    };
  }
  if (s.brush === 'oil' || s.brush === 'impasto') {
    return {
      open: 'Repaint the provided photograph as a hand-made oil painting on canvas.',
      hand: 'Visible canvas weave and thick paint ridges catching the light, no digital smoothing, no photographic texture, no outlines.',
    };
  }
  return {
    open: 'Redraw the provided photograph as a hand-made oil-based ballpoint pen drawing on paper.',
    hand: 'Visible paper grain, slight ink build-up where strokes overlap, no digital smoothing, no photographic textures.',
  };
}

/** 두 번째 이미지의 정체: 없음 / 사용자가 올린 견본 / 같은 사진을 로컬 렌더러로 그린 결과 / 다른 사진으로 그린 화풍 프리셋 예시 */
export type RefKind = 'none' | 'sample' | 'local' | 'preset';

/** 원본 비율을 "가로:세로" 로. 결과가 정사각형으로 잘리지 않게 지시문에도 못 박는다 */
function aspectText(a?: { width: number; height: number }): string {
  if (!a || !a.width || !a.height) return '';
  const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
  const d = g(Math.round(a.width), Math.round(a.height)) || 1;
  const r = a.width / a.height;
  const shape = r > 1.05 ? 'landscape' : r < 0.95 ? 'portrait' : 'square';
  return `Output size: exactly the same ${shape} aspect ratio as the photograph, ` +
    `${Math.round(a.width / d)}:${Math.round(a.height / d)} (${a.width} x ${a.height}). ` +
    'Do not crop, pad, letterbox, add borders or change the framing — the drawn image fills the whole frame edge to edge.';
}

export function buildPrompt(p: DrawingParams, ref: RefKind, aspect?: { width: number; height: number }): string {
  const m = mediumText(p.paint);
  const w = p.referenceWeight;
  const strength = w >= 70 ? 'closely' : w >= 40 ? 'moderately' : 'loosely';
  const lines = [
    m.open,
    'Keep the exact composition, proportions, perspective and every subject of the photo; change only the medium.',
    aspectText(aspect),
    // 화풍이 결과를 가르는 값이므로 맨 앞에 두고, 나머지는 그 안에서의 조절임을 밝힌다
    `PRIMARY STYLE — this decides how the whole picture looks; every other instruction below only fine-tunes it, and none of them may soften it.\n${STYLE_TEXT[p.style]}`,
    `Must not appear: ${STYLE_AVOID[p.style]}`,
    `Within that style: ${paintText(p.paint)}`,
    artistText(p),
    `Stroke density and pressure: ${intensityText(p.intensity)}.`,
    colorText(p, p.paint.brush === 'inkwash' || p.paint.brush === 'wash' || p.paint.brush === 'oil' || p.paint.brush === 'impasto'),
    // 빛: 자동이면 사진의 명암을 그대로, 수동이면 사진이 이미 그 방향으로 다시 조명되어 있음
    (p.lightAuto
      ? 'Keep the lighting exactly as it appears in the photograph. '
      : `The photograph has been relit so the key light comes ${LIGHT_TEXT[p.light]} and cast shadows fall ${SHADOW_TEXT[p.light]}; follow that lighting. `) +
      'Marks follow the form and turn away from the light; the lit side stays the most open.',
    toneText(p),
    m.hand,
    'This picture is a reference that a human student will copy by hand: every mark must read as one a person could make, ' +
      'with no effects impossible by hand.',
  ];
  if (ref === 'sample') {
    lines.push(
      `A second image is a style sample. Follow its mark weight, direction, tone steps and how much ground it leaves bare ${strength} ` +
        '(do not copy its subject; the subject comes only from the photograph).',
    );
  } else if (ref === 'local') {
    lines.push(
      'A second image is a rough rendering of the same photograph made with exactly the settings above. ' +
        `Follow its mark directions, tone placement and bare ground ${strength}, but redraw every mark by hand: ` +
        'more skill, natural variation, and cleaner form than the rough version. Do not reproduce its mechanical regularity.',
    );
  } else if (ref === 'preset') {
    lines.push(
      'A second image is an example of the target style drawn from a different, unrelated photograph. ' +
        `Copy only its technique ${strength}: mark weight, how marks follow form, tone steps, and how much ground is left bare. ` +
        'Ignore its subject and composition completely; the subject comes only from the photograph.',
    );
  }
  // 화풍을 마지막에 한 번 더 — 긴 지시문에서는 끝 문장이 가장 세게 남는다
  lines.push(`Above all, the result must be unmistakably this style and no other: ${STYLE_TEXT[p.style].replace(/^Style: /, '')}`);
  return lines.filter(Boolean).join('\n');
}

/** xAI처럼 입력 이미지를 편집할 수 없는 제공사용: 비전 모델에게 사진을 묘사시키는 지시문 */
export const DESCRIBE_PROMPT =
  'Describe this photograph for an artist who must redraw it exactly without seeing it. ' +
  'Cover: subjects and their positions in the frame (use a 3x3 grid), proportions, camera angle and distance, ' +
  'background elements, materials and textures, and where light and shadow fall. ' +
  'Be concrete and visual; 120 to 200 words; no interpretation or mood words.';

