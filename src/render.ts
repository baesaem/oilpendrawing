/**
 * 로컬 드로잉 렌더러 (AI 없음, 순수 계산).
 * DOM 을 쓰지 않으므로 Web Worker 에서 돌립니다. 입력·출력은 RawImage(RGBA 배열).
 *
 * 흐름: 밝기 → 톤 단계 나누기 → 단계별 해칭/점묘 → 윤곽선 → 종이색 위에 잉크색으로 합성
 */
import type { ColorMode, StrokeProfile } from './types';

export interface RawImage { width: number; height: number; data: Uint8ClampedArray }
export interface RenderOpts { strokes: StrokeProfile; color: ColorMode }

/* ---------- 공용 수치 유틸 ---------- */

/** 결정적 난수 (같은 설정이면 같은 그림) */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function luminance01(img: RawImage): Float32Array {
  const { data } = img;
  const out = new Float32Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) out[j] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  return out;
}

/** 적분 영상 기반 박스 블러 (반경 r) — 큰 반경도 O(N) */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src;
  const W = w + 1;
  const sat = new Float64Array(W * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += src[(y - 1) * w + (x - 1)];
      sat[y * W + x] = sat[(y - 1) * W + x] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = sat[y1 * W + x1] - sat[y0 * W + x1] - sat[y1 * W + x0] + sat[y0 * W + x0];
      out[y * w + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

/** Sobel 크기와 방향 */
export function sobel(src: Float32Array, w: number, h: number): { mag: Float32Array; gx: Float32Array; gy: Float32Array } {
  const mag = new Float32Array(w * h), gxA = new Float32Array(w * h), gyA = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -src[i - w - 1] - 2 * src[i - 1] - src[i + w - 1] + src[i - w + 1] + 2 * src[i + 1] + src[i + w + 1];
    const gy = -src[i - w - 1] - 2 * src[i - w] - src[i - w + 1] + src[i + w - 1] + 2 * src[i + w] + src[i + w + 1];
    gxA[i] = gx; gyA[i] = gy; mag[i] = Math.hypot(gx, gy);
  }
  return { mag, gx: gxA, gy: gyA };
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/* ---------- 잉크 캔버스 ---------- */

/** 잉크 농도 누적 버퍼 (0~1). 겹치면 screen 방식으로 진해집니다 */
class Ink {
  buf: Float32Array;
  constructor(public w: number, public h: number) { this.buf = new Float32Array(w * h); }
  /** 반지름 r 원을 antialias 로 찍습니다 */
  dot(cx: number, cy: number, r: number, a: number) {
    const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(this.w - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(this.h - 1, Math.ceil(cy + r + 1));
    const { buf, w } = this;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const cov = clamp(r + 0.5 - d, 0, 1) * a;
      if (cov <= 0) continue;
      const i = y * w + x;
      buf[i] = 1 - (1 - buf[i]) * (1 - cov);
    }
  }
}

/**
 * 손으로 그은 듯한 평행선 층.
 * mask(i) 가 참인 곳만 그리며, 선은 여러 토막으로 끊기고 각 토막은 각도·굵기가 조금씩 다릅니다.
 */
function hatchLayer(ink: Ink, mask: (i: number) => boolean, angleDeg: number, spacing: number, width: number,
  phase: number, jitter: number, rng: () => number, scribble = false) {
  const { w, h } = ink;
  const j = jitter / 100;
  const th = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(th), dy = Math.sin(th);
  const nx = -dy, ny = dx;
  const cx = w / 2, cy = h / 2;
  const diag = Math.hypot(w, h);
  const r = width / 2;
  const alpha = 0.85;

  for (let o = -diag / 2 + phase * spacing; o <= diag / 2; o += spacing) {
    // 이 선의 기준점
    const bx = cx + nx * o, by = cy + ny * o;
    let t = -diag / 2;
    while (t < diag / 2) {
      // 토막 하나: 길이·각도·필압이 다름
      const segLen = scribble ? 12 + rng() * 30 : (40 + rng() * 70) * (1.2 - j * 0.7);
      const dAng = scribble ? (rng() - 0.5) * 2.2 : (rng() - 0.5) * j * 0.35;
      const sx = dx * Math.cos(dAng) - dy * Math.sin(dAng), sy = dx * Math.sin(dAng) + dy * Math.cos(dAng);
      const pressure = 0.75 + rng() * 0.45;
      const wobbleAmp = (scribble ? 2.5 : 1.6) * j + (scribble ? 1 : 0);
      const wobbleF = 0.12 + rng() * 0.15;
      const wobbleP = rng() * 6.28;
      const startX = bx + dx * t + (rng() - 0.5) * j * spacing * 0.5 * nx;
      const startY = by + dy * t + (rng() - 0.5) * j * spacing * 0.5 * ny;
      let tail = 0; // 마스크를 벗어난 뒤 조금 더 긋는 관성 (손은 경계에서 딱 멈추지 않음)
      let drawnAny = false;
      for (let s = 0; s < segLen; s += 0.8) {
        const wob = Math.sin(s * wobbleF + wobbleP) * wobbleAmp;
        const px = startX + sx * s + nx * wob, py = startY + sy * s + ny * wob;
        const ix = px | 0, iy = py | 0;
        if (ix < 0 || iy < 0 || ix >= w || iy >= h) { if (drawnAny) break; continue; }
        const inside = mask(iy * w + ix);
        if (inside) { tail = 2 + j * 4; drawnAny = true; }
        else if (tail > 0) tail -= 0.8;
        else { if (drawnAny) break; continue; }
        // 토막 양끝은 가늘게 (펜을 대고 떼는 느낌)
        const taper = Math.min(1, s / 6, (segLen - s) / 6);
        ink.dot(px, py, r * (0.6 + 0.4 * taper) * pressure, alpha * (0.7 + 0.3 * taper));
      }
      // 다음 토막까지 살짝 띄움
      t += segLen + 2 + rng() * (4 + j * 8);
    }
  }
}

/** 점묘: 어두울수록 점을 촘촘히 */
function stippleLayer(ink: Ink, tone: Uint8Array, layers: number, spacing: number, width: number, rng: () => number) {
  const { w, h } = ink;
  const base = 6 / (spacing * spacing);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = tone[y * w + x];
    if (!k) continue;
    const p = Math.pow(k / layers, 1.6) * base * 2.2;
    if (rng() < p) ink.dot(x + rng(), y + rng(), (width / 2) * (0.7 + rng() * 0.6), 0.9);
  }
}

/* ---------- 메인 ---------- */

export function renderDrawing(img: RawImage, opts: RenderOpts): RawImage {
  const { width: w, height: h } = img;
  const N = w * h;
  const p = opts.strokes;
  const rng = mulberry32(1234567);

  const lum = luminance01(img);

  // 1) 톤 단계: 부드럽게 만든 밝기를 n 단계로. 0 = 종이, 1..layers = 해칭 층 수
  const layers = clamp(Math.round(p.tones), 2, 6) - 1;
  const white = 0.42 + 0.55 * clamp(p.paperKeep, 0, 100) / 100;
  const smooth = boxBlur(lum, w, h, 3);
  const tone = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const L = smooth[i];
    tone[i] = L >= white ? 0 : clamp(1 + Math.floor(((white - L) / white) * layers), 1, layers);
  }

  const ink = new Ink(w, h);
  const width = clamp(p.lineWidth, 0.8, 8);
  const spacing = clamp(p.hatchSpacing, 2.5, 30);
  const angle = p.hatchAngle;

  // 2) 채우기
  const CROSS = [0, 47, -38, 90, 22, 68];
  const PHASE = [0, 0.618, 0.236, 0.854, 0.472, 0.09];
  switch (p.fill) {
    case 'hatch':
      for (let j = 1; j <= layers; j++) hatchLayer(ink, (i) => tone[i] >= j, angle, spacing, width, PHASE[j - 1], p.jitter, rng);
      break;
    case 'cross':
      for (let j = 1; j <= layers; j++) hatchLayer(ink, (i) => tone[i] >= j, angle + CROSS[j - 1], spacing, width, 0, p.jitter, rng);
      break;
    case 'contour':
      // 가장 어두운 곳만 성기게
      hatchLayer(ink, (i) => tone[i] >= layers, angle, spacing * 1.4, width, 0, p.jitter, rng);
      break;
    case 'scribble':
      for (let j = 1; j <= layers; j++) hatchLayer(ink, (i) => tone[i] >= j, angle + j * 37, spacing * 1.3, width * 0.9, PHASE[j - 1], Math.max(50, p.jitter), rng, true);
      break;
    case 'stipple':
      stippleLayer(ink, tone, layers, spacing, width, rng);
      break;
  }

  // 3) 윤곽선: Sobel → 임계값 → 선 굵기만큼 팽창
  const edgeSrc = boxBlur(lum, w, h, 1);
  const { mag } = sobel(edgeSrc, w, h);
  const th = 0.30 - 0.20 * clamp(p.edgeDensity, 0, 100) / 100;
  const edge = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = clamp((mag[i] - th * 0.6) / (th * 0.8), 0, 1);
    edge[i] = t * t;
  }
  const rad = Math.max(0, Math.round((width - 1.5) / 2));
  const dil = rad > 0 ? dilate(edge, w, h, rad) : edge;
  const edgeStrength = p.fill === 'contour' ? 1 : 0.9;
  for (let i = 0; i < N; i++) {
    const a = dil[i] * edgeStrength;
    if (a > 0) ink.buf[i] = 1 - (1 - ink.buf[i]) * (1 - a);
  }

  // 4) 합성
  let paper = hexToRgb(p.paperColor), inkC = hexToRgb(p.inkColor);
  if (opts.color === 'sepia') { paper = [243, 231, 208]; inkC = [74, 46, 28]; }
  const out = new Uint8ClampedArray(N * 4);
  const grain = mulberry32(99);
  for (let i = 0; i < N; i++) {
    const a = ink.buf[i];
    let r = inkC[0], g = inkC[1], b = inkC[2];
    if (opts.color === 'color') {
      // 컬러: 사진의 색을 어둡게 눌러 잉크색과 섞음
      const o = i * 4;
      r = r * 0.35 + img.data[o] * 0.45; g = g * 0.35 + img.data[o + 1] * 0.45; b = b * 0.35 + img.data[o + 2] * 0.45;
    }
    const gr = (grain() - 0.5) * 5;
    const o = i * 4;
    out[o] = paper[0] * (1 - a) + r * a + gr;
    out[o + 1] = paper[1] * (1 - a) + g * a + gr;
    out[o + 2] = paper[2] * (1 - a) + b * a + gr;
    out[o + 3] = 255;
  }
  return { width: w, height: h, data: out };
}

/** 분리형 최대값 필터 (선 굵히기) */
function dilate(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { const v = src[y * w + xx]; if (v > m) m = v; } }
    tmp[y * w + x] = m;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { const v = tmp[yy * w + x]; if (v > m) m = v; } }
    out[y * w + x] = m;
  }
  return out;
}
