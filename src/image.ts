/** 브라우저 Canvas 기반 이미지 유틸 */
import { LIGHT_DIRS, type LightDir } from './types';

/** 화면 좌표(y 아래) 기준 각도. E=0°, 시계 방향으로 증가 */
const LIGHT_ANGLE: Record<LightDir, number> = { N: -90, NE: -45, E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225 };

export async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasFor(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 컨텍스트를 만들 수 없습니다');
  return [c, ctx];
}

function toBlob(c: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('이미지 인코딩 실패'))), type, quality));
}

/**
 * 긴 변을 maxSide 이하로 줄이고, 필요하면 흑백으로 변환합니다.
 * API 전송량을 줄이고 EXIF 회전 문제를 없애기 위해 항상 재인코딩합니다.
 * relight 를 주면 그 방향에서 빛이 오는 것처럼 밝기 기울기를 입힙니다 — 편집형 AI 와 로컬 렌더러는
 * 글보다 사진의 명암을 따르므로, 빛 방향을 바꾸려면 사진 자체를 바꿔야 합니다.
 */
export async function prepareInput(blob: Blob, opts: { maxSide: number; grayscale: boolean; relight?: LightDir }): Promise<Blob> {
  const img = await blobToImage(blob);
  const scale = Math.min(1, opts.maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const [c, ctx] = canvasFor(w, h);
  if (opts.grayscale) ctx.filter = 'grayscale(1)';
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = 'none';
  if (opts.relight) relight(ctx, w, h, opts.relight);
  return toBlob(c, 'image/jpeg', 0.92);
}

/** 빛 쪽은 밝게(screen), 반대쪽은 어둡게(multiply) 하는 대각 기울기. 큰 그림자 방향만 바꾸는 근사입니다 */
function relight(ctx: CanvasRenderingContext2D, w: number, h: number, dir: LightDir) {
  const a = (LIGHT_ANGLE[dir] * Math.PI) / 180;
  const cx = w / 2, cy = h / 2, r = Math.hypot(w, h) / 2;
  const lx = cx + Math.cos(a) * r, ly = cy + Math.sin(a) * r; // 빛이 오는 가장자리
  const dx = cx - Math.cos(a) * r, dy = cy - Math.sin(a) * r; // 반대편
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const dark = ctx.createLinearGradient(lx, ly, dx, dy);
  dark.addColorStop(0, 'rgba(0,0,0,0)');
  dark.addColorStop(0.45, 'rgba(0,0,0,0.08)');
  dark.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = dark; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'screen';
  const light = ctx.createLinearGradient(lx, ly, dx, dy);
  light.addColorStop(0, 'rgba(255,255,255,0.28)');
  light.addColorStop(0.5, 'rgba(255,255,255,0.04)');
  light.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = light; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * 사진에서 빛이 오는 방향을 추정합니다.
 * 크게 뭉갠 밝기의 기울기(어두운 곳 → 밝은 곳)를 평균 내어 8방향 중 가장 가까운 것을 고릅니다.
 */
export async function estimateLight(blob: Blob): Promise<LightDir> {
  const img = await blobToImage(blob);
  const S = 48;
  const [, ctx] = canvasFor(S, S);
  ctx.filter = 'blur(3px)';
  ctx.drawImage(img, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;
  const lum = (i: number) => 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  let gx = 0, gy = 0;
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    gx += lum(y * S + x + 1) - lum(y * S + x - 1);
    gy += lum((y + 1) * S + x) - lum((y - 1) * S + x);
  }
  // 하늘이 밝은 풍경은 위쪽이 밝기 마련이라 세로 성분을 조금 눌러 줍니다
  gy *= 0.7;
  if (Math.hypot(gx, gy) < 1) return 'NW';
  const ang = (Math.atan2(gy, gx) * 180) / Math.PI;
  let best: LightDir = 'NW', bestDiff = 999;
  for (const dir of LIGHT_DIRS) {
    let diff = Math.abs(((ang - LIGHT_ANGLE[dir]) % 360 + 540) % 360 - 180);
    if (diff < bestDiff) { bestDiff = diff; best = dir; }
  }
  return best;
}

/** 결과에 밝기·대비를 적용한 새 PNG를 만듭니다 (저장용). 화면 미리보기는 CSS filter로 처리합니다. */
export async function applyTone(blob: Blob, brightness: number, contrast: number): Promise<Blob> {
  if (brightness === 0 && contrast === 0) return blob;
  const img = await blobToImage(blob);
  const [c, ctx] = canvasFor(img.naturalWidth, img.naturalHeight);
  ctx.filter = toneFilter(brightness, contrast);
  ctx.drawImage(img, 0, 0);
  return toBlob(c);
}

/** -50~+50 → CSS filter 문자열 */
export function toneFilter(brightness: number, contrast: number): string {
  const b = 1 + brightness / 100;
  const k = 1 + contrast / 100;
  return `brightness(${b.toFixed(3)}) contrast(${k.toFixed(3)})`;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function base64ToBlob(b64: string, mime = 'image/png'): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** 사진이 사실상 흑백인지 샘플링으로 판별 */
export async function isGrayscale(blob: Blob): Promise<boolean> {
  const img = await blobToImage(blob);
  const [, ctx] = canvasFor(64, 64);
  ctx.drawImage(img, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  let diff = 0;
  for (let i = 0; i < d.length; i += 4) {
    diff += Math.abs(d[i] - d[i + 1]) + Math.abs(d[i + 1] - d[i + 2]);
  }
  return diff / (d.length / 4) < 6;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
