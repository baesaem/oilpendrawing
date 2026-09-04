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

/** 1차원 부드러운 난수 (-1~1): 가장자리 흐림의 불규칙한 경계에 씀 */
function smoothNoise1D(n: number, rng: () => number): Float32Array {
  let a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = rng() * 2 - 1;
  const r = Math.max(2, Math.round(n / 40));
  for (let pass = 0; pass < 3; pass++) {
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0, c = 0;
      for (let k = -r; k <= r; k++) { const j = i + k; if (j >= 0 && j < n) { sum += a[j]; c++; } }
      b[i] = sum / c;
    }
    a = b;
  }
  let max = 1e-6;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(a[i]));
  for (let i = 0; i < n; i++) a[i] /= max;
  return a;
}

/**
 * 면의 방향장: 구조 텐서로 각 픽셀 주변의 지배적인 에지 방향을 구합니다.
 * 벽에서는 세로, 바닥의 원근선에서는 그 방향 — 리천 드로잉의 "면을 따라가는 해칭"의 근거입니다.
 */
function orientationField(lum: Float32Array, w: number, h: number) {
  const { gx, gy } = sobel(boxBlur(lum, w, h, 2), w, h);
  const N = w * h;
  const jxx = new Float32Array(N), jyy = new Float32Array(N), jxy = new Float32Array(N);
  for (let i = 0; i < N; i++) { jxx[i] = gx[i] * gx[i]; jyy[i] = gy[i] * gy[i]; jxy[i] = gx[i] * gy[i]; }
  // 두 크기: 가까운 에지(반경 7)를 우선하고, 없으면 넓은 범위(반경 28)의 지배적 방향을 따릅니다.
  // 벽 안쪽처럼 에지에서 떨어진 면도 그 면을 두르는 선의 방향을 물려받게 하기 위해서입니다.
  const fine = [boxBlur(jxx, w, h, 7), boxBlur(jyy, w, h, 7), boxBlur(jxy, w, h, 7)];
  const coarse = [boxBlur(jxx, w, h, 28), boxBlur(jyy, w, h, 28), boxBlur(jxy, w, h, 28)];
  const tx = new Float32Array(N), ty = new Float32Array(N), coh = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let a = fine[0][i] - fine[1][i], b = 2 * fine[2][i], e = fine[0][i] + fine[1][i];
    let c = e > 0.02 ? Math.sqrt(a * a + b * b) / (e + 1e-4) : 0;
    if (c < 0.2) {
      a = coarse[0][i] - coarse[1][i]; b = 2 * coarse[2][i]; e = coarse[0][i] + coarse[1][i];
      c = e > 0.004 ? Math.sqrt(a * a + b * b) / (e + 1e-4) * 0.9 : 0;
    }
    const th = 0.5 * Math.atan2(b, a) + Math.PI / 2; // 그래디언트에 수직 = 에지를 따라가는 방향
    tx[i] = Math.cos(th); ty[i] = Math.sin(th);
    coh[i] = c; // 평탄한 곳(하늘)은 방향 없음
  }
  return { tx, ty, coh };
}

/** 나뭇잎·풀처럼 잔결이 많은 곳: 주변 밝기 분산이 큰 영역 */
function textureMask(lum: Float32Array, w: number, h: number): Uint8Array {
  const N = w * h;
  const sq = new Float32Array(N);
  for (let i = 0; i < N; i++) sq[i] = lum[i] * lum[i];
  const m = boxBlur(lum, w, h, 3), m2 = boxBlur(sq, w, h, 3);
  const v = new Float32Array(N);
  for (let i = 0; i < N; i++) v[i] = Math.sqrt(Math.max(0, m2[i] - m[i] * m[i])) > 0.085 ? 1 : 0;
  const sm = boxBlur(v, w, h, 5);
  const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) out[i] = sm[i] > 0.45 ? 1 : 0;
  return out;
}

/**
 * 어반 스케치 층: 방향장을 따라가는 짧은 획들. 방향이 없는 곳(하늘)은 기준 각도로 긴 사선.
 * 잔결 영역(나뭇잎)은 획 대신 작은 고리 선 뭉치로 채웁니다.
 */
function sketchLayer(ink: Ink, mask: (i: number) => boolean, field: ReturnType<typeof orientationField>, foliage: Uint8Array,
  baseAngle: number, perpendicular: boolean, spacing: number, width: number, phase: number, jitter: number, rng: () => number) {
  const { w, h } = ink;
  const j = jitter / 100;
  const r = width / 2;
  const bth = (baseAngle * Math.PI) / 180;
  const bx = Math.cos(bth), by = Math.sin(bth);
  const cell = spacing * 2.5;
  const len = spacing * (5 + 4 * (1 - j));

  for (let gy = -cell * phase; gy < h; gy += cell) for (let gx = -cell * phase; gx < w; gx += cell) {
    const sx = gx + rng() * cell, sy = gy + rng() * cell;
    const ix = sx | 0, iy = sy | 0;
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue;
    const i0 = iy * w + ix;
    if (!mask(i0)) continue;

    if (foliage[i0]) {
      // 고리 선: 세로로 눌린 타원을 1.3~1.8바퀴, 잎 뭉치의 어두운 쪽에 몰림
      const rr = spacing * (0.45 + rng() * 0.5);
      const turns = 1.3 + rng() * 0.5;
      const ph = rng() * 6.28;
      for (let t = 0; t < turns * 6.283; t += 0.25) {
        const px = sx + rr * Math.cos(t + ph) * (1 + 0.15 * Math.sin(t * 3)), py = sy + rr * 0.7 * Math.sin(t + ph);
        const x = px | 0, y = py | 0;
        if (x < 0 || y < 0 || x >= w || y >= h || !mask(y * w + x)) continue;
        ink.dot(px, py, r * 0.9, 0.8);
      }
      continue;
    }

    // 획: 방향장을 따라가되, 방향이 약하면 기준 각도
    let dx: number, dy: number;
    const c = field.coh[i0];
    if (c > 0.2) { dx = field.tx[i0]; dy = field.ty[i0]; }
    else { dx = bx; dy = by; }
    if (perpendicular) { const t = dx; dx = -dy; dy = t; }
    const seg = len * (c > 0.2 ? 1 : 1.8) * (0.7 + rng() * 0.6);
    const pressure = 0.75 + rng() * 0.45;
    const wob = rng() * 6.28, wobF = 0.1 + rng() * 0.1;
    let px = sx - dx * seg * 0.5, py = sy - dy * seg * 0.5;
    let tail = 0, drawn = false;
    for (let s = 0; s < seg; s += 0.8) {
      const x = px | 0, y = py | 0;
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const i = y * w + x;
      const inside = mask(i);
      if (inside) { tail = 2 + j * 3; drawn = true; }
      else if (tail > 0) tail -= 0.8;
      else { if (drawn) break; px += dx * 0.8; py += dy * 0.8; continue; }
      const taper = Math.min(1, s / 5, (seg - s) / 5);
      const wv = Math.sin(s * wobF + wob) * j * 1.2;
      ink.dot(px - dy * wv, py + dx * wv, r * (0.65 + 0.35 * taper) * pressure, 0.85 * (0.7 + 0.3 * taper));
      // 방향장을 조금씩 따라감 (부호는 이전 방향과 맞춤)
      if (field.coh[i] > 0.2) {
        let fx = field.tx[i], fy = field.ty[i];
        if (perpendicular) { const t = fx; fx = -fy; fy = t; }
        if (fx * dx + fy * dy < 0) { fx = -fx; fy = -fy; }
        dx = dx * 0.85 + fx * 0.15; dy = dy * 0.85 + fy * 0.15;
        const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      }
      px += dx * 0.8; py += dy * 0.8;
    }
  }
}

/** 가장자리를 미완성처럼 흐림: 불규칙한 경계 안쪽으로만 잉크를 남깁니다 */
function applyVignette(ink: Float32Array, w: number, h: number, amount: number, rng: () => number) {
  const m = (amount / 100) * 0.22 * Math.min(w, h);
  if (m < 1) return;
  const eL = smoothNoise1D(h, rng), eR = smoothNoise1D(h, rng), eT = smoothNoise1D(w, rng), eB = smoothNoise1D(w, rng);
  const amp = m * 0.7;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.min(x + eL[y] * amp, w - 1 - x + eR[y] * amp, y + eT[x] * amp, h - 1 - y + eB[x] * amp);
    if (d >= m) continue;
    const t = Math.max(0, d / m);
    const f = t * t * (3 - 2 * t);
    ink[y * w + x] *= f;
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
    case 'sketch': {
      const field = orientationField(lum, w, h);
      const foliage = textureMask(lum, w, h);
      for (let j = 1; j <= layers; j++) {
        sketchLayer(ink, (i) => tone[i] >= j, field, foliage, angle, j % 2 === 0, spacing, width, PHASE[j - 1], p.jitter, rng);
      }
      // 톤이 5단계 이상이면 가장 어두운 단계는 먹으로 채워 대비를 줍니다 (처마 밑, 열린 문 안쪽)
      if (layers >= 4) {
        const dark = boxBlur(Float32Array.from(tone, (k) => (k >= layers ? 1 : 0)), w, h, 1);
        // 잔결 영역(나뭇잎)은 고리 선 사이의 반짝임을 남겨야 하므로 먹을 넣지 않음
        for (let i = 0; i < N; i++) if (dark[i] > 0.6 && !foliage[i]) ink.buf[i] = 1 - (1 - ink.buf[i]) * (1 - 0.8 * dark[i]);
      }
      break;
    }
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

  // 4) 가장자리 미완성 처리
  applyVignette(ink.buf, w, h, clamp(p.vignette ?? 0, 0, 100), mulberry32(4242));

  // 5) 합성
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
