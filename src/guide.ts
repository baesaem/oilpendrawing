/**
 * 그리기 가이드용 이미지 처리 (모두 브라우저 Canvas, API 비용 없음)
 *  - edgeMap: 사진에서 윤곽선만 뽑아 "큰 형태" 단계용 선화를 만듭니다.
 *  - valueMap: 사진을 3~5단계 명암으로 단순화해 어디를 어둡게 칠할지 보여 줍니다.
 */
import { blobToImage } from './image';
import type { Level } from './types';

const PAPER = [245, 240, 230] as const; // 종이색
const INK = [34, 30, 27] as const;      // 잉크색

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas를 만들 수 없습니다');
  return { c, ctx };
}
function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('인코딩 실패'))), 'image/png'));
}
function fitSize(w: number, h: number, maxSide: number) {
  const s = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}
/** 회색조 밝기 배열 (0~255) */
function luminance(data: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) out[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return out;
}
/** 3×3 박스 블러 (노이즈 완화) */
function blur3(src: Float32Array, w: number, h: number, passes = 1): Float32Array {
  let a: Float32Array = src, b: Float32Array = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < h && xx >= 0 && xx < w) { sum += a[yy * w + xx]; n++; }
      }
      b[y * w + x] = sum / n;
    }
    [a, b] = [b, a];
  }
  return a;
}

/** 숙련도별 선 개수: 초급은 굵은 윤곽만, 상급은 세부선까지 */
const EDGE_THRESHOLD: Record<Level, number> = { beginner: 70, intermediate: 45, advanced: 28 };

export async function edgeMap(blob: Blob, level: Level): Promise<Blob> {
  const img = await blobToImage(blob);
  const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, 900);
  const { c, ctx } = makeCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const lum = blur3(luminance(ctx.getImageData(0, 0, w, h).data), w, h, level === 'beginner' ? 2 : 1);

  const mag = new Float32Array(w * h);
  let max = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
    const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
    const m = Math.hypot(gx, gy);
    mag[i] = m;
    if (m > max) max = m;
  }
  const th = EDGE_THRESHOLD[level];
  const out = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    // 임계값 이상은 잉크, 근처는 연한 선으로 부드럽게
    const t = Math.min(1, Math.max(0, (mag[i] - th * 0.6) / (th * 0.8)));
    const k = t * t;
    out.data[i * 4] = PAPER[0] + (INK[0] - PAPER[0]) * k;
    out.data[i * 4 + 1] = PAPER[1] + (INK[1] - PAPER[1]) * k;
    out.data[i * 4 + 2] = PAPER[2] + (INK[2] - PAPER[2]) * k;
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return toBlob(c);
}

/** 숙련도별 명암 단계 수 */
export const VALUE_LEVELS: Record<Level, number> = { beginner: 3, intermediate: 4, advanced: 5 };

export async function valueMap(blob: Blob, level: Level): Promise<Blob> {
  const img = await blobToImage(blob);
  const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, 900);
  // 작은 크기로 그려 잔노이즈를 없앤 뒤 확대
  const small = fitSize(w, h, 240);
  const s = makeCanvas(small.w, small.h);
  s.ctx.drawImage(img, 0, 0, small.w, small.h);
  const { c, ctx } = makeCanvas(w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(s.c, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const lum = blur3(luminance(id.data), w, h, 3);
  const n = VALUE_LEVELS[level];
  for (let i = 0; i < w * h; i++) {
    const step = Math.round((lum[i] / 255) * (n - 1)) / (n - 1); // 0(어둠)~1(밝음)
    id.data[i * 4] = INK[0] + (PAPER[0] - INK[0]) * step;
    id.data[i * 4 + 1] = INK[1] + (PAPER[1] - INK[1]) * step;
    id.data[i * 4 + 2] = INK[2] + (PAPER[2] - INK[2]) * step;
    id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return toBlob(c);
}

export type PaperRatio = 'photo' | 'a4p' | 'a4l' | 'square' | '4x5';
export const PAPER_LABEL: Record<PaperRatio, string> = {
  photo: '사진 비율', a4p: 'A4 세로', a4l: 'A4 가로', square: '정방형', '4x5': '4:5 세로',
};
/** 가로/세로 비율 (null = 사진 그대로) */
export const PAPER_ASPECT: Record<PaperRatio, number | null> = {
  photo: null, a4p: 210 / 297, a4l: 297 / 210, square: 1, '4x5': 4 / 5,
};
