/** 브라우저 Canvas 기반 이미지 유틸 */

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
 */
export async function prepareInput(blob: Blob, opts: { maxSide: number; grayscale: boolean }): Promise<Blob> {
  const img = await blobToImage(blob);
  const scale = Math.min(1, opts.maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const [c, ctx] = canvasFor(w, h);
  if (opts.grayscale) ctx.filter = 'grayscale(1)';
  ctx.drawImage(img, 0, 0, w, h);
  return toBlob(c, 'image/jpeg', 0.92);
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
