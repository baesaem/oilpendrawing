import { ARTIST_BY_ID } from './artists';
import type { DrawingParams, LightDir, PenStyle } from './types';

const LEVEL_TEXT = {
  beginner:
    'Beginner-level oil-based ballpoint pen drawing: bold confident outlines, large simplified shapes, ' +
    'only one or two tone steps of single-direction hatching, no fine texture, minimal background. ' +
    'Keep the total number of strokes low so a first-time student can reproduce it.',
  intermediate:
    'Intermediate-level oil pen drawing: clean contour lines plus interior form lines, three to four tone steps ' +
    'built with single-direction hatching, main textures suggested, background lightly indicated.',
  advanced:
    'Advanced oil pen drawing: thin overlapping strokes with varied pressure, cross-hatching that builds smooth ' +
    'mid-tones, careful reflected light and shadow edges, fine surface texture, fully rendered background.',
};

const STYLE_TEXT: Record<PenStyle, string> = {
  hatching:
    'Style: classic parallel hatching. Tone is built with straight, evenly spaced strokes in one dominant direction per plane.',
  crosshatch:
    'Style: cross-hatching. Layers of strokes at two to four angles build smooth, continuous mid-tones; darkest areas have the most layers.',
  contour:
    'Style: pure contour line drawing. Only outlines and a few interior form lines, almost no shading, large areas of untouched paper.',
  scribble:
    'Style: scribble hatching. Loose, looping, energetic circular strokes pile up to make tone; edges stay lively and slightly rough.',
  stipple:
    'Style: stippling. Tone is made entirely of dots of varying density instead of lines; contours are implied by dot clusters.',
  engraving:
    'Style: engraving / etching look. Regular, precisely spaced lines that swell and taper to follow form, like a banknote illustration.',
  urban:
    'Style: urban sketchbook. Quick, loose, slightly wobbly lines, selective detail, deliberately unfinished edges fading into the paper.',
  realistic:
    'Style: hyper-realistic pen rendering. Extremely fine, dense strokes reproducing every value and texture almost photographically.',
  comic:
    'Style: comic ink illustration. Bold, confident outlines, solid black spot-shadows, simplified mid-tones, high graphic contrast.',
  architectural:
    'Style: architectural drafting. Ruler-straight lines, accurate perspective, uniform line weight, restrained hatching only in shadows.',
  ghibli:
    'Style: hand-drawn Japanese animation look reminiscent of classic Studio Ghibli films, rendered in pen: soft clean outlines, ' +
    'simplified gentle shapes, cel-shading with two or three flat tone steps made of even hatching, warm nostalgic atmosphere, ' +
    'no photographic detail.',
  webtoon:
    'Style: Korean webtoon line art in pen: crisp digital-looking outlines of uniform weight, simple cel shading with clean flat ' +
    'shadow shapes, subjects drawn sharply while the background is simplified, modern and clean.',
  manga:
    'Style: Japanese manga ink page in pen: thin sharp linework, screentone-like regular dot and line patterns for mid-tones, ' +
    'bold spot blacks for emphasis, expressive line weight variation, black-and-white graphic clarity.',
};

const LIGHT_TEXT: Record<LightDir, string> = {
  N: 'from directly above', NE: 'from the upper right', E: 'from the right', SE: 'from the lower right',
  S: 'from below', SW: 'from the lower left', W: 'from the left', NW: 'from the upper left',
};
const SHADOW_TEXT: Record<LightDir, string> = {
  N: 'straight below the forms', NE: 'toward the lower left', E: 'toward the left', SE: 'toward the upper left',
  S: 'above the forms', SW: 'toward the upper right', W: 'toward the right', NW: 'toward the lower right',
};

function artistText(p: DrawingParams): string {
  const a = ARTIST_BY_ID[p.artist];
  if (!a || a.id === 'none') return '';
  return `Interpret the technique above through a specific master's drawing manner — ${a.prompt} ` +
    'Keep it a hand-made pen drawing of the given photograph; borrow the stroke language, not the artist\'s subjects.';
}

function intensityText(v: number): string {
  if (v < 20) return 'very light touch, sparse strokes, lots of untouched paper';
  if (v < 40) return 'light pressure, open hatching with visible paper between strokes';
  if (v < 60) return 'medium pressure and stroke density';
  if (v < 80) return 'dense confident strokes with heavy pressure in the darks';
  return 'very dense, heavily layered strokes with saturated ink in the darkest areas';
}

function colorText(p: DrawingParams): string {
  switch (p.color) {
    case 'mono':
      return 'Monochrome: black oil pen ink only on off-white paper.';
    case 'sepia':
      return 'Single-color: warm sepia brown oil pen ink only on cream paper.';
    case 'color':
      return 'Colored oil pens: a limited palette of five to seven pen colors layered by hatching, ' +
        'keeping the drawn, hand-made look (not a painting).';
  }
}

function toneText(p: DrawingParams): string {
  const parts: string[] = [];
  if (p.brightness > 15) parts.push('overall bright and airy, keep large areas of paper untouched');
  else if (p.brightness < -15) parts.push('overall dark and moody, most of the paper covered by tone');
  if (p.contrast > 15) parts.push('high contrast: deep blacks against clean paper');
  else if (p.contrast < -15) parts.push('low contrast: soft, close mid-tones, no pure black');
  return parts.length ? parts.join('; ') + '.' : '';
}

export function buildPrompt(p: DrawingParams, hasReference: boolean): string {
  const lines = [
    'Redraw the provided photograph as a hand-made oil-based ballpoint pen drawing on paper.',
    'Keep the exact composition, proportions, perspective and every subject of the photo; change only the medium.',
    STYLE_TEXT[p.style],
    artistText(p),
    LEVEL_TEXT[p.level],
    `Stroke density and pressure: ${intensityText(p.intensity)}.`,
    colorText(p),
    `Key light comes ${LIGHT_TEXT[p.light]}; cast shadows fall ${SHADOW_TEXT[p.light]}. ` +
      'Hatching follows the form and turns away from the light; the lit side stays mostly open paper.',
    toneText(p),
    'Visible paper grain, slight ink build-up where strokes overlap, no digital smoothing, no photographic textures.',
    'This drawing is a reference that a human student will copy by hand into a sketchbook: every mark must read as a ' +
      'real pen stroke a person could make, with no effects impossible by hand.',
  ];
  if (hasReference) {
    const w = p.referenceWeight;
    const strength = w >= 70 ? 'closely' : w >= 40 ? 'moderately' : 'loosely';
    lines.push(
      `A second image is a style sample. Follow its line weight, hatching angle, tone steps and paper exposure ${strength} ` +
        '(do not copy its subject; the subject comes only from the photograph).',
    );
  }
  return lines.filter(Boolean).join('\n');
}

/** xAI처럼 입력 이미지를 편집할 수 없는 제공사용: 비전 모델에게 사진을 묘사시키는 지시문 */
export const DESCRIBE_PROMPT =
  'Describe this photograph for an artist who must redraw it exactly without seeing it. ' +
  'Cover: subjects and their positions in the frame (use a 3x3 grid), proportions, camera angle and distance, ' +
  'background elements, materials and textures, and where light and shadow fall. ' +
  'Be concrete and visual; 120 to 200 words; no interpretation or mood words.';

/** 4단계 과정을 한 장(2×2)으로 그려 달라는 지시문 */
export function buildProcessPrompt(p: DrawingParams, hasFinal: boolean): string {
  const level = p.level === 'beginner' ? 'complete beginner' : p.level === 'intermediate' ? 'intermediate' : 'advanced';
  return [
    'Create ONE image divided into a 2x2 grid of four equal panels with thin borders, numbered 1 to 4 in the top-left corner of each panel.',
    `It teaches a ${level} student how to draw the provided photograph as an oil-based ballpoint pen drawing, step by step:`,
    '1) very light construction lines: simple boxes/ovals for the big shapes and a horizon or eye line, nothing else;',
    '2) clean contour lines of every subject, still no shading;',
    `3) first layer of hatching only in the shadow areas (light comes ${LIGHT_TEXT[p.light]}), mid-tones still open paper;`,
    '4) the finished drawing with full tone.',
    'Every panel shows the whole subject in exactly the same composition and size; white paper background; ' +
      'strokes must look like real pen marks a person can make.',
    STYLE_TEXT[p.style],
    artistText(p),
    colorText(p),
    hasFinal ? 'The second image is the finished drawing: panel 4 must match it, and panels 1-3 are its earlier stages.' : '',
  ].filter(Boolean).join('\n');
}
