/**
 * 로컬 드로잉 엔진 — Dynamic Auto-Painter 방식 (Hertzmann 의 "여러 크기의 굽은 획" 페인팅) 을 펜 드로잉에 맞게 구현.
 * AI 없음, 순수 계산, DOM 을 쓰지 않으므로 Web Worker 에서 돌린다. 입력·출력은 RawImage(RGBA 배열).
 *
 * 흐름 (DAP 와 같다):
 *  1. 사진에서 목표 그림(어둡기 지도)을 만든다. 펜 드로잉은 사진보다 밝으므로 여백(paperKeep) 위는 종이로 비운다.
 *  2. 층(pass)마다 획 크기를 큰 것에서 작은 것으로 줄여 가며 —
 *     - 목표를 획 크기만큼 뭉갠 참조를 만들고(큰 획은 큰 형태만 본다),
 *     - 캔버스를 격자로 나눠 **아직 목표보다 밝은 칸**만 골라 그 칸에서 가장 차이가 큰 자리에 획을 놓는다.
 *     - 획은 시작점의 어둡기를 지니고 방향장(형태 따라가기)을 따라 굽으며 흐르다가, 더 밝은 곳으로 넘어가거나
 *       캔버스가 이미 충분히 어두우면 멈춘다 (정지 조건).
 *  3. 색 경계를 따라가는 윤곽선 획을 얹고, 가장자리 미완성 처리 뒤 종이 위에 합성한다.
 *  층이 끝날 때마다(그리고 도중에도) onProgress 로 중간 그림을 내보내 화면에서 그려지는 과정을 볼 수 있다.
 *
 * 붓(brush) 이 획의 모양을 정한다: pen(면을 따르는 짧은 획·나뭇잎 고리선), hatch(평행), cross(교차), contour(윤곽 위주),
 * scribble(고리 선), stipple(점), wash(수채 담채 붓 자국 + 펜).
 */
import type { ColorMode, DirectionGuide, PaintProfile, TipKind } from './types';

export interface RawImage { width: number; height: number; data: Uint8ClampedArray }
export interface ProgressInfo { pass: number; passes: number; frac: number; strokes: number; /** 지금 단계 이름 (밑칠·중간·세부·윤곽) */ label?: string }
export interface RenderOpts {
  paint: PaintProfile;
  color: ColorMode;
  /** 사용자가 그은 해칭 방향 지시선 (그림 상대 좌표) */
  guides?: DirectionGuide[];
  /** 지시선 영향 범위, 짧은 변의 % */
  guideRadius?: number;
  /** 그려지는 과정 (층이 끝날 때와 도중 0.2초마다) */
  onProgress?: (img: RawImage, info: ProgressInfo) => void;
}

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
type RGB = [number, number, number];

export function luminance01(img: RawImage): Float32Array {
  const { data } = img;
  const out = new Float32Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) out[j] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  return out;
}

/** 적분 영상 기반 박스 블러 (반경 r) — 큰 반경도 O(N) */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  r = Math.round(r);
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

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function shuffled(n: number, rng: () => number): Uint32Array {
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  for (let i = n - 1; i > 0; i--) { const q = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[q]; order[q] = t; }
  return order;
}

/* ---------- 분석: 색 경계, 잔결, 방향장 ---------- */

/** 채널별 Sobel (블러 1). 색 경계 크기와 방향장에 함께 쓴다 */
function channelGradients(img: RawImage, w: number, h: number) {
  const N = w * h;
  const ch = new Float32Array(N);
  const out: Array<{ gx: Float32Array; gy: Float32Array }> = [];
  for (let k = 0; k < 3; k++) {
    for (let i = 0, j = 0; i < img.data.length; i += 4, j++) ch[j] = img.data[i + k] / 255;
    const { gx, gy } = sobel(boxBlur(ch, w, h, 1), w, h);
    out.push({ gx, gy });
  }
  return out;
}

/**
 * 색 그라디언트 크기 (Di Zenzo 방식의 단순형). 세 채널의 Sobel 을 제곱합해 밝기가 같아도 색이 다른 경계를 잡는다.
 * 회색 경계에서는 밝기 Sobel 과 같은 크기가 되도록 √3 으로 나눈다.
 */
function colorEdgeMag(grads: Array<{ gx: Float32Array; gy: Float32Array }>, N: number): Float32Array {
  const out = new Float32Array(N);
  for (const { gx, gy } of grads) for (let i = 0; i < N; i++) out[i] += gx[i] * gx[i] + gy[i] * gy[i];
  for (let i = 0; i < N; i++) out[i] = Math.sqrt(out[i] / 3);
  return out;
}

/** 색상 경계: 밝기를 뺀 색도(r/합, g/합)의 그라디언트. 잎끼리(같은 녹색)는 작고, 지붕·기둥·노란 나무와 녹색 사이는 크다 */
function chromaEdgeMag(img: RawImage, w: number, h: number): Float32Array {
  const N = w * h;
  const cr = new Float32Array(N), cg = new Float32Array(N);
  for (let i = 0, j = 0; i < img.data.length; i += 4, j++) {
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2], sum = r + g + b + 30;
    cr[j] = r / sum; cg[j] = g / sum;
  }
  const a = sobel(boxBlur(cr, w, h, 2), w, h), b2 = sobel(boxBlur(cg, w, h, 2), w, h);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = Math.hypot(a.mag[i], b2.mag[i]);
  return out;
}

/**
 * 잔결 정도 0..1: 주변에 경계 화소가 얼마나 빽빽한가. 나뭇잎·풀·물결은 높고, 컵 윤곽처럼 경계가 하나뿐인 곳은 낮다.
 * 잔결 영역은 지역 방향이 소음이므로 기준 각도로 통일하고, 윤곽선을 누르고, 목표 어둡기를 조금 낮춘다 (잎 사이로 종이가 비쳐야 잎으로 읽힌다).
 */
function textureMap(edgeMag: Float32Array, w: number, h: number): Float32Array {
  const N = w * h;
  const bin = new Float32Array(N);
  for (let i = 0; i < N; i++) bin[i] = edgeMag[i] > 0.16 ? 1 : 0;
  const dens = boxBlur(bin, w, h, 6);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = clamp((dens[i] - 0.10) / 0.30, 0, 1);
  return boxBlur(out, w, h, 4);
}

interface ManualField { tx: Float32Array; ty: Float32Array; wgt: Float32Array }

/**
 * 사용자가 그은 방향 지시선 → 방향장 (DAP 의 수동 Feature Follow). 가까운 선분들의 방향을 거리 가중(가우시안)으로 평균한다.
 * 방향은 부호가 없으므로(해칭선은 양쪽으로 뻗음) 각을 두 배로 해서 벡터 평균한다. 4px 격자에서 계산해 블록에 채운다.
 */
function manualField(guides: DirectionGuide[], radiusPct: number, w: number, h: number): ManualField | null {
  const segs: Array<[number, number, number, number, number, number]> = [];
  for (const g of guides) {
    for (let i = 1; i < g.points.length; i++) {
      const x1 = g.points[i - 1][0] * w, y1 = g.points[i - 1][1] * h, x2 = g.points[i][0] * w, y2 = g.points[i][1] * h;
      const dx = x2 - x1, dy = y2 - y1;
      if (Math.hypot(dx, dy) < 1) continue;
      const th2 = 2 * Math.atan2(dy, dx);
      segs.push([x1, y1, x2, y2, Math.cos(th2), Math.sin(th2)]);
    }
  }
  if (!segs.length) return null;
  const N = w * h;
  const tx = new Float32Array(N), ty = new Float32Array(N), wgt = new Float32Array(N);
  const sigma = Math.max(4, (clamp(radiusPct, 5, 50) / 100) * Math.min(w, h) * 0.5);
  const inv = 1 / (2 * sigma * sigma);
  const cutoff = 3 * sigma;
  const step = 4;
  for (let gy = 0; gy < h; gy += step) for (let gx = 0; gx < w; gx += step) {
    const cx = gx + step / 2, cy = gy + step / 2;
    let ax = 0, ay = 0, ws = 0;
    for (const [x1, y1, x2, y2, c2, s2] of segs) {
      const vx = x2 - x1, vy = y2 - y1;
      const t = clamp(((cx - x1) * vx + (cy - y1) * vy) / (vx * vx + vy * vy), 0, 1);
      const d = Math.hypot(cx - (x1 + vx * t), cy - (y1 + vy * t));
      if (d > cutoff) continue;
      const k = Math.exp(-d * d * inv);
      ax += k * c2; ay += k * s2; ws += k;
    }
    if (ws < 0.005) continue;
    const th = 0.5 * Math.atan2(ay, ax);
    const cs = Math.cos(th), sn = Math.sin(th), m = Math.min(1, ws);
    for (let y = gy; y < Math.min(h, gy + step); y++) for (let x = gx; x < Math.min(w, gx + step); x++) {
      const i = y * w + x;
      tx[i] = cs; ty[i] = sn; wgt[i] = m;
    }
  }
  return { tx, ty, wgt };
}

/** aniso: 넓은 범위(반경 28)의 방향 확실성 — 잔결이라도 물결처럼 한 방향으로 흐르면 높다 (잎 뭉치는 낮다) */
interface Field { tx: Float32Array; ty: Float32Array; coh: Float32Array; man: Float32Array; aniso: Float32Array; raw: Float32Array; /** 넓은 범위(반경 28) 방향 — 그림붓이 잔결을 무시하고 큰 흐름을 따를 때 */ ctx: Float32Array; cty: Float32Array }

/**
 * 면의 방향장 (DAP 의 Feature Follow): 세 채널 구조 텐서로 각 화소 주변의 지배적 경계 방향을 구한다.
 * 벽에서는 세로, 바닥의 원근선에서는 그 방향. 두 크기(반경 7·28)를 써서 경계에서 떨어진 면도 그 면을 두르는 선의 방향을 물려받는다.
 * 잔결(나뭇잎)에서는 coherence 를 눌러 기준 각도로 돌아가게 하고, 사용자 지시선이 가까우면 그 방향으로 끌어당긴다.
 */
function orientationField(grads: Array<{ gx: Float32Array; gy: Float32Array }>, w: number, h: number, manual: ManualField | null, texture: Float32Array): Field {
  const N = w * h;
  const jxx = new Float32Array(N), jyy = new Float32Array(N), jxy = new Float32Array(N);
  for (const { gx, gy } of grads) for (let i = 0; i < N; i++) { jxx[i] += gx[i] * gx[i]; jyy[i] += gy[i] * gy[i]; jxy[i] += gx[i] * gy[i]; }
  const fine = [boxBlur(jxx, w, h, 7), boxBlur(jyy, w, h, 7), boxBlur(jxy, w, h, 7)];
  const coarse = [boxBlur(jxx, w, h, 28), boxBlur(jyy, w, h, 28), boxBlur(jxy, w, h, 28)];
  const tx = new Float32Array(N), ty = new Float32Array(N), coh = new Float32Array(N), man = new Float32Array(N), aniso = new Float32Array(N), raw = new Float32Array(N);
  const ctxA = new Float32Array(N), ctyA = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const ca = coarse[0][i] - coarse[1][i], cb = 2 * coarse[2][i], ce = coarse[0][i] + coarse[1][i];
    const cc = ce > 0.004 ? Math.sqrt(ca * ca + cb * cb) / (ce + 1e-4) : 0;
    aniso[i] = cc;
    { const thc = 0.5 * Math.atan2(cb, ca) + Math.PI / 2; ctxA[i] = Math.cos(thc); ctyA[i] = Math.sin(thc); }
    let a = fine[0][i] - fine[1][i], b = 2 * fine[2][i], e = fine[0][i] + fine[1][i];
    let c = e > 0.02 ? Math.sqrt(a * a + b * b) / (e + 1e-4) : 0;
    raw[i] = c; // 잔결 억제 전의 지역 확실성 (잎 뭉치 안의 짧은 획 방향에 씀)
    if (c < 0.2) { a = ca; b = cb; c = cc * 0.9; }
    let th = 0.5 * Math.atan2(b, a) + Math.PI / 2; // 그래디언트에 수직 = 경계를 따라가는 방향
    // 잔결이라도 물결·풀처럼 넓게 한 방향으로 흐르면(aniso) 방향을 살리고, 잎 뭉치처럼 방향이 없으면 기준 각도로 돌아간다
    c *= 1 - texture[i] * 0.9 * (1 - clamp((cc - 0.35) * 3, 0, 1));
    if (manual && manual.wgt[i] > 0.01) {
      const m = manual.wgt[i];
      const a2 = 2 * th, b2 = 2 * Math.atan2(manual.ty[i], manual.tx[i]);
      const cx = (1 - m) * c * Math.cos(a2) + m * Math.cos(b2), cy = (1 - m) * c * Math.sin(a2) + m * Math.sin(b2);
      th = 0.5 * Math.atan2(cy, cx);
      c = c + m * (1 - c);
      man[i] = m;
    }
    tx[i] = Math.cos(th); ty[i] = Math.sin(th);
    coh[i] = c;
  }
  return { tx, ty, coh, man, aniso, raw, ctx: ctxA, cty: ctyA };
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

/* ---------- 브러시 팁 ---------- */

/** 획 하나 동안 유지되는 팁 상태: 붓털 프로필(가로지름 방향 24점)과 젖은 붓의 가장자리 흔들림(각도 16점) */
interface TipState { kind: TipKind; prof: Float32Array; wob: Float32Array }

/** 획을 시작할 때 팁을 새로 만든다 — 붓털 배치와 번짐 모양이 획마다 다르다 */
function makeTip(kind: TipKind, rng: () => number): TipState {
  const prof = new Float32Array(24), wob = new Float32Array(16);
  if (kind === 'bristle' || kind === 'chalk') {
    // 붓털: chalk 는 털이 성글고 사이가 비고, bristle 은 촘촘하되 털마다 눌린 정도가 다르다
    const hairs = kind === 'chalk' ? 6 : 11;
    const amp: number[] = [];
    for (let k = 0; k < hairs; k++) amp.push(kind === 'chalk' ? (rng() < 0.35 ? 0 : 0.5 + rng() * 0.5) : 0.55 + rng() * 0.45);
    for (let i = 0; i < 24; i++) {
      const t = ((i + 0.5) / 24) * hairs, k0 = Math.min(hairs - 1, Math.floor(t)), f = t - k0;
      const a0 = amp[k0], a1 = amp[Math.min(hairs - 1, k0 + 1)];
      const edge = Math.min(1, (Math.min(i, 23 - i) + 1) / 3); // 붓 가장자리 털은 옅다
      prof[i] = (a0 * (1 - f) + a1 * f) * (kind === 'chalk' ? 1 : 0.7 + 0.3 * edge) * (kind === 'chalk' ? (f < 0.5 ? 1 : 0.6) : 1);
    }
  } else prof.fill(1);
  // 젖은 붓: 반지름 흔들림 ±15%, 이웃 각도끼리 부드럽게
  const raw = Array.from({ length: 16 }, () => (rng() - 0.5) * 0.3);
  for (let i = 0; i < 16; i++) wob[i] = (raw[(i + 15) % 16] + raw[i] * 2 + raw[(i + 1) % 16]) / 4;
  return { kind, prof, wob };
}

/** 팁 미리보기 (그리기 설정 패널의 브러시 선택기): 밝은 종이 위에 짙은 획 하나 */
export function tipPreview(kind: TipKind, w = 96, h = 30): RawImage {
  const cv = new Canvas(w, h, [246, 243, 236]);
  const rng = mulberry32(5);
  const tip = makeTip(kind, rng);
  const r = h * 0.28;
  for (let x = r * 1.2; x <= w - r * 1.2; x += kind === 'wet' ? r * 0.35 : r * 0.25) {
    const y = h / 2 + Math.sin((x / w) * 3.1) * h * 0.08;
    if (kind === 'round') cv.dab(x, y, r, true); else cv.dabTip(x, y, r, 1, 0, tip);
  }
  cv.end(kind === 'wet' ? 0.55 : 0.9, [40, 60, 110], false);
  return cv.toImage(3);
}

/* ---------- 캔버스 ---------- */

/**
 * 색 캔버스 + 어둡기 누적. 획 하나는 begin() ~ end() 사이의 dot() 들이고, 한 획이 같은 화소를 두 번 칠하지 않도록
 * 화소별 최대 덮임만 모아 end() 에서 한 번에 얹는다 (겹치는 획끼리는 screen 방식으로 진해진다).
 */
class Canvas {
  rgb: Float32Array;
  dark: Float32Array;
  private sw: Float32Array;
  private touched: number[] = [];
  strokes = 0;
  constructor(public w: number, public h: number, paper: RGB) {
    const N = w * h;
    this.rgb = new Float32Array(N * 3);
    this.dark = new Float32Array(N);
    this.sw = new Float32Array(N);
    for (let i = 0; i < N; i++) { this.rgb[i * 3] = paper[0]; this.rgb[i * 3 + 1] = paper[1]; this.rgb[i * 3 + 2] = paper[2]; }
  }
  /** 반지름 r 의 원 (antialias) — 덮임 0..1 을 화소별 최대로 모은다 */
  dot(cx: number, cy: number, r: number, cov = 1) {
    const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(this.w - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(this.h - 1, Math.ceil(cy + r + 1));
    const { sw, w } = this;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const c = clamp(r + 0.5 - d, 0, 1) * cov;
      if (c <= 0.002) continue;
      const i = y * w + x;
      if (sw[i] === 0) this.touched.push(i);
      if (c > sw[i]) sw[i] = c;
    }
  }
  /** 젖은 붓 자국: 가운데는 고르고 가장자리는 부드럽다 */
  dab(cx: number, cy: number, r: number, soft = true) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    const { sw, w } = this;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1) continue;
      const q = 1 - d * d;
      // 젖은 붓(soft): 가운데 진하고 가장자리로 부드럽게 번진다. 마른 종이 위(wet-on-dry): 가장자리가 또렷한 채색 면
      const c = soft ? q * q : (d < 0.8 ? 1 : (1 - d) / 0.2);
      const i = y * w + x;
      if (sw[i] === 0) this.touched.push(i);
      if (c > sw[i]) sw[i] = c;
    }
  }
  /**
   * 브러시 팁 자국 (포토샵 브러시 팁에 해당). 획 방향 (dx,dy) 에 맞춰 돌려 찍는다.
   * bristle·chalk: 획을 가로지르는 붓털 프로필(tip.prof) × 획 방향의 짧은 캡슐 — 연속해 찍으면 붓털 줄무늬가 이어진다.
   * wet: 반지름이 각도에 따라 흔들리는(tip.wob) 둥근 자국, 가운데는 살짝 옅고 가장자리로 안료가 몰린다.
   */
  dabTip(cx: number, cy: number, r: number, dx: number, dy: number, tip: TipState) {
    const { sw, w } = this;
    if (tip.kind === 'wet') {
      const R = r * 1.18;
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(this.w - 1, Math.ceil(cx + R));
      const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(this.h - 1, Math.ceil(cy + R));
      const n = tip.wob.length;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - cx, py = y + 0.5 - cy;
        const ang = (Math.atan2(py, px) / 6.2832 + 0.5) * n;
        const k0 = Math.floor(ang) % n, k1 = (k0 + 1) % n, f = ang - Math.floor(ang);
        const rEff = r * (1 + tip.wob[k0] * (1 - f) + tip.wob[k1] * f);
        const d = Math.hypot(px, py) / rEff;
        if (d >= 1) continue;
        const c = (d < 0.72 ? 0.86 + 0.14 * (d / 0.72) : (1 - d) / 0.28);
        const i = y * w + x;
        if (sw[i] === 0) this.touched.push(i);
        if (c > sw[i]) sw[i] = c;
      }
      return;
    }
    // 납작한 붓: 폭 r(가로지름), 길이 r·0.7(획 방향)
    const L = r * 0.7, ext = Math.max(r, L) + 1;
    const x0 = Math.max(0, Math.floor(cx - ext)), x1 = Math.min(this.w - 1, Math.ceil(cx + ext));
    const y0 = Math.max(0, Math.floor(cy - ext)), y1 = Math.min(this.h - 1, Math.ceil(cy + ext));
    const n = tip.prof.length;
    const chalk = tip.kind === 'chalk';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      const along = px * dx + py * dy, across = -px * dy + py * dx;
      const u = across / r, v = along / L;
      if (u <= -1 || u >= 1 || v * v >= 1) continue;
      let c = tip.prof[Math.min(n - 1, Math.floor((u + 1) * 0.5 * n))] * Math.sqrt(1 - v * v);
      if (chalk) { const hsh = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; c *= 0.55 + 0.9 * (hsh - Math.floor(hsh)); }
      if (c <= 0.01) continue;
      const i = y * w + x;
      if (sw[i] === 0) this.touched.push(i);
      if (c > sw[i]) sw[i] = c;
    }
  }
  /** 모아 둔 획을 alpha·색으로 얹는다. darkAdd 는 어둡기 누적에 반영할지 (담채는 어둡기로 세지 않는다) */
  end(alpha: number, col: RGB, darkAdd = true) {
    const { rgb, dark, sw } = this;
    for (const i of this.touched) {
      const k = sw[i] * alpha;
      sw[i] = 0;
      const o = i * 3;
      rgb[o] += (col[0] - rgb[o]) * k; rgb[o + 1] += (col[1] - rgb[o + 1]) * k; rgb[o + 2] += (col[2] - rgb[o + 2]) * k;
      if (darkAdd) dark[i] = 1 - (1 - dark[i]) * (1 - k);
    }
    if (this.touched.length) this.strokes++;
    this.touched.length = 0;
  }
  /** 화소 하나를 직접 어둡게 (먹 채움) */
  fill(i: number, k: number, col: RGB) {
    const o = i * 3;
    this.rgb[o] += (col[0] - this.rgb[o]) * k; this.rgb[o + 1] += (col[1] - this.rgb[o + 1]) * k; this.rgb[o + 2] += (col[2] - this.rgb[o + 2]) * k;
    this.dark[i] = 1 - (1 - this.dark[i]) * (1 - k);
  }
  toImage(grainSeed = 99): RawImage {
    const N = this.w * this.h;
    const out = new Uint8ClampedArray(N * 4);
    const grain = mulberry32(grainSeed);
    for (let i = 0; i < N; i++) {
      const gr = (grain() - 0.5) * 5;
      const o = i * 4, q = i * 3;
      out[o] = this.rgb[q] + gr; out[o + 1] = this.rgb[q + 1] + gr; out[o + 2] = this.rgb[q + 2] + gr; out[o + 3] = 255;
    }
    return { width: this.w, height: this.h, data: out };
  }
}

/* ---------- 획 ---------- */

/** 그리기 한 판의 공유 상태 */
interface Ctx {
  w: number; h: number; N: number;
  cv: Canvas;
  field: Field;
  texture: Float32Array;
  rng: () => number;
  p: PaintProfile;
  /** 선 굵기 (px, 이 그림 크기 기준) */
  lw: number;
  /** 형태 따라가기 0..1 */
  ff: number;
  /** 무작위 0..1 */
  rnd: number;
  /** 기준 각도 (rad) */
  base: number;
  /** 획이 더 밝은 곳으로 넘어갔다고 볼 어둡기 차 */
  tol: number;
  /** 시작점 i 의 획 색 */
  colorAt: (i: number) => RGB;
  /** 그림붓(담채·유화·임파스토)인지 — 잔결을 무시하고 큰 흐름을 따른다 */
  painty: boolean;
}

/**
 * 자리 i 의 획 방향 (단위 벡터, 부호 없음). 형태 따라가기 × 방향장의 확실성이 높으면 방향장을, 아니면 기준 각도를 따른다.
 * 둘은 두 배 각으로 섞는다. 사용자 지시선(man) 은 형태 따라가기 값과 무관하게 먹는다. rot 는 추가 회전 (교차 해칭).
 */
function dirAt(c: Ctx, i: number, rot: number): [number, number] {
  const wf = Math.max(c.ff * c.field.coh[i], c.field.man[i]);
  let th: number;
  const tex = c.texture[i];
  if (c.painty && tex > 0.3 && c.field.man[i] < 0.1) {
    // 그림붓: 잎 하나하나가 아니라 나무 덩어리·물결의 큰 흐름을 따른다 (고흐의 소용돌이). 흐름이 없으면 기준 각도 주변
    th = c.field.aniso[i] > 0.12 ? Math.atan2(c.field.cty[i], c.field.ctx[i]) : c.base + (c.rng() - 0.5) * 0.8;
  } else if (tex > 0.5 && c.field.man[i] < 0.1) {
    // 잔결(잎 뭉치): 짧은 획이 잎 무리의 지역 방향을 따르면 잎 질감이 된다. 방향이 없으면 기준 각도 주변에서 흩어진다
    const r = c.field.raw[i];
    th = r > 0.4 ? Math.atan2(c.field.ty[i], c.field.tx[i]) : c.base + (c.rng() - 0.5) * 0.6;
  } else if (wf < 0.12) th = c.base;
  else {
    const a2 = 2 * Math.atan2(c.field.ty[i], c.field.tx[i]), b2 = 2 * c.base;
    th = 0.5 * Math.atan2(wf * Math.sin(a2) + (1 - wf) * Math.sin(b2), wf * Math.cos(a2) + (1 - wf) * Math.cos(b2));
  }
  th += rot;
  return [Math.cos(th), Math.sin(th)];
}

/**
 * 펜 획 하나: 씨앗에서 양쪽으로 뻗는다. 시작점의 목표 어둡기를 지니고, 방향장을 따라 조금씩 굽으며,
 * 목표가 tol 만큼 밝아지는 곳(다른 면)이나 캔버스가 이미 충분히 어두운 곳에서 멈춘다 (Hertzmann 의 정지 조건).
 */
function penStroke(c: Ctx, ref: Float32Array, x0: number, y0: number, L: number, rot: number, alphaMul = 1) {
  const { cv, w, h, rng, lw } = c;
  const i0 = (y0 | 0) * w + (x0 | 0);
  const D0 = ref[i0];
  if (D0 <= 0.01) return;
  const [dx0, dy0] = dirAt(c, i0, rot + (rng() - 0.5) * 0.5 * c.rnd);
  const r = lw / 2;
  const pressure = 0.8 + rng() * 0.4;
  const wobA = (0.4 + 1.6 * c.rnd) * Math.min(1, lw), wobF = 0.08 + rng() * 0.1, wobP = rng() * 6.28;
  const step = 0.7;
  const half = L / 2;
  for (const sign of [1, -1]) {
    let dx = dx0 * sign, dy = dy0 * sign, x = x0, y = y0, over = 0;
    for (let s = 0; s < half; s += step) {
      const xi = x | 0, yi = y | 0;
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) break;
      const i = yi * w + xi;
      // 더 밝은 곳(다른 면)으로 넘어가면 멈춤. 종이는 즉시.
      if (ref[i] < D0 - c.tol || ref[i] < 0.02) break;
      // 캔버스가 목표보다 이미 어두우면 몇 픽셀 뒤 멈춤
      if (cv.dark[i] > ref[i] + 0.08) { if (++over > 4) break; } else over = 0;
      const taper = Math.min(1, (s + step) / 4, (half - s) / 4 + 0.35);
      const wob = Math.sin(s * wobF + wobP) * wobA;
      cv.dot(x - dy * wob, y + dx * wob, r * (0.65 + 0.35 * taper) * pressure, 0.75 + 0.25 * taper);
      // 방향장을 조금씩 따라감 (부호는 이전 방향과 맞춤)
      const wf = Math.max(c.ff * c.field.coh[i], c.field.man[i]);
      if (wf > 0.12 && c.texture[i] < 0.5) {
        let [fx, fy] = dirAt(c, i, rot);
        if (fx * dx + fy * dy < 0) { fx = -fx; fy = -fy; }
        const k = 0.12 + 0.2 * wf;
        dx = dx * (1 - k) + fx * k; dy = dy * (1 - k) + fy * k;
        const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      }
      x += dx * step; y += dy * step;
    }
  }
  cv.end(clamp(alphaFor(c, D0) * alphaMul, 0, 0.97), c.colorAt(i0));
}

/** 획의 불투명도: 잉크 농도 × 목표가 어두울수록 필압 */
function alphaFor(c: Ctx, D0: number) {
  return (0.3 + 0.62 * clamp(c.p.ink, 0, 100) / 100) * (0.7 + 0.5 * D0) * (0.9 + (c.rng() - 0.5) * 0.3 * c.rnd);
}

/** 나뭇잎 고리 선 (pen 붓의 잔결 영역): 세로로 눌린 타원을 1.3~1.8바퀴 */
function loopStroke(c: Ctx, ref: Float32Array, x0: number, y0: number, R: number) {
  const { cv, w, h, rng, lw } = c;
  const i0 = (y0 | 0) * w + (x0 | 0);
  const D0 = ref[i0];
  if (D0 <= 0.01) return;
  const rr = clamp(R * (0.2 + rng() * 0.25), lw * 1.2, lw * 3);
  const turns = 1.3 + rng() * 0.5, ph = rng() * 6.28;
  for (let t = 0; t < turns * 6.283; t += 0.22) {
    const px = x0 + rr * Math.cos(t + ph) * (1 + 0.15 * Math.sin(t * 3)), py = y0 + rr * 0.7 * Math.sin(t + ph);
    const x = px | 0, y = py | 0;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = y * w + x;
    if (ref[i] < 0.02) continue;
    cv.dot(px, py, lw * 0.45, 0.9);
  }
  cv.end(alphaFor(c, D0) * 0.6, c.colorAt(i0));
}

/** 스크리블: 굽은 정도가 무작위인 고리 선이 목표 안에서만 맴돈다 */
function scribbleStroke(c: Ctx, ref: Float32Array, x0: number, y0: number, L: number) {
  const { cv, w, h, rng, lw } = c;
  const i0 = (y0 | 0) * w + (x0 | 0);
  const D0 = ref[i0];
  if (D0 <= 0.01) return;
  let th = rng() * 6.283;
  const curv = (0.12 + rng() * 0.25) * (rng() < 0.5 ? 1 : -1) / Math.max(1, lw * 0.8);
  let x = x0, y = y0, over = 0;
  const step = 0.7;
  for (let s = 0; s < L; s += step) {
    const xi = x | 0, yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) break;
    const i = yi * w + xi;
    if (ref[i] < D0 - c.tol || ref[i] < 0.02) { th += 1.2; x += Math.cos(th) * step; y += Math.sin(th) * step; if (++over > 8) break; continue; }
    if (cv.dark[i] > ref[i] + 0.1) { if (++over > 12) break; } else over = 0;
    cv.dot(x, y, lw / 2, 0.85);
    th += curv * step + (rng() - 0.5) * 0.25 * c.rnd;
    x += Math.cos(th) * step; y += Math.sin(th) * step;
  }
  cv.end(alphaFor(c, D0) * 0.8, c.colorAt(i0));
}

/**
 * 색 경계를 따라가는 윤곽선 (DAP 의 edge 층). 셀마다 경계가 가장 센 자리에서 출발해 경계 접선을 따라 양쪽으로 긋고,
 * 지나간 자리는 표시해 같은 경계를 두 번 긋지 않는다. 잔결(나뭇잎) 영역은 눌러서 잎 덩어리가 검게 뭉치지 않게 한다.
 */
function edgePass(c: Ctx, mag: Float32Array, mass: { mag: Float32Array; gx: Float32Array; gy: Float32Array }, chroma: Float32Array, th: number, widthMul: number, alphaMul: number) {
  const { cv, w, h, N, rng, lw, texture, field } = c;
  // 경계 접선: 잔결 영역에서는 지역 방향장이 소음이므로 뭉갠 밝기의 그라디언트에 수직인 방향을 쓴다
  const tangent = (i: number): [number, number] => {
    if (texture[i] < 0.4) return [field.tx[i], field.ty[i]];
    const gx = mass.gx[i], gy = mass.gy[i], n = Math.hypot(gx, gy) || 1;
    return [-gy / n, gx / n];
  };
  const done = new Int32Array(N); // 0 = 아직, n = n번째 윤곽 획이 지나감
  let sid = 0;
  const g = Math.max(2, lw * 2.2);
  const cols = Math.ceil(w / g), rows = Math.ceil(h / g);
  const order = shuffled(cols * rows, rng);
  const maxLen = Math.min(w, h) * 0.35;
  const r = (lw * widthMul) / 2;
  // 잔결(나뭇잎)에서는 센 경계만 남기고, 대신 뭉갠 밝기의 경계(잎 뭉치의 덩어리 윤곽)를 살린다 — 리천 드로잉의 뭉게구름 같은 나무 윤곽
  const massMag = mass.mag;
  const strength = (i: number) => Math.max(mag[i] / (1 + 2.2 * texture[i]), chroma[i] * 1.3 / (1 + 1.2 * texture[i]), 0 * massMag[i]);
  const mark = (x: number, y: number) => {
    const m = Math.max(1, Math.round(g * 0.5));
    for (let yy = Math.max(0, y - m); yy <= Math.min(h - 1, y + m); yy++) for (let xx = Math.max(0, x - m); xx <= Math.min(w - 1, x + m); xx++) done[yy * w + xx] = sid;
  };
  for (let q = 0; q < order.length; q++) {
    const cell = order[q];
    const cx = (cell % cols) * g, cy = Math.floor(cell / cols) * g;
    const x1 = Math.min(w, Math.ceil(cx + g)), y1 = Math.min(h, Math.ceil(cy + g));
    let best = -1, bi = -1;
    for (let y = cy | 0; y < y1; y++) for (let x = cx | 0; x < x1; x++) { const i = y * w + x; const s = strength(i); if (s > best) { best = s; bi = i; } }
    if (bi < 0 || best < th || done[bi]) continue;
    sid++;
    const x0 = (bi % w) + 0.5, y0 = Math.floor(bi / w) + 0.5;
    const i0 = bi;
    // 접선 방향: 방향장(경계에서 확실함)
    const t0 = tangent(i0);
    let drawn = 0;
    for (const sign of [1, -1]) {
      let dx = t0[0] * sign, dy = t0[1] * sign, x = x0, y = y0, dup = 0;
      for (let s = 0; s < maxLen; s += 0.7) {
        const xi = x | 0, yi = y | 0;
        if (xi < 0 || yi < 0 || xi >= w || yi >= h) break;
        const i = yi * w + xi;
        const m = strength(i);
        if (m < th * (0.45 + 0.3 * texture[i])) break;
        // 다른 윤곽 획이 이미 지나간 자리로 들어가면 조금 겹친 뒤 멈춘다
        if (done[i] && done[i] !== sid) { if (++dup > 4) break; }
        mark(xi, yi);
        const k = clamp(m / th, 0.5, 1.6);
        cv.dot(x, y, r * (0.6 + 0.4 * Math.min(1, k)), 0.6 + 0.4 * Math.min(1, k));
        drawn++;
        // 경계 접선을 따라감 (부호 유지)
        let [fx, fy] = tangent(i);
        if (fx * dx + fy * dy < 0) { fx = -fx; fy = -fy; }
        dx = dx * 0.6 + fx * 0.4; dy = dy * 0.6 + fy * 0.4;
        const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
        x += dx * 0.7; y += dy * 0.7;
      }
    }
    if (drawn) cv.end(clamp((0.55 + 0.45 * Math.min(1, best / (th * 1.8))) * alphaMul, 0, 0.97), c.colorAt(i0));
  }
}

/* ---------- 층 ---------- */

interface Sweep {
  /** 추가 회전 (rad) — 교차 해칭 */
  rot?: number;
  /** 격자 반 칸 어긋남 */
  offset?: number;
  /** 시작점 목표 어둡기가 이 이상일 때만 (그림자에만 교차) */
  minRef?: number;
  /** 격자 배율 */
  gMul?: number;
  kind?: 'pen' | 'scribble' | 'stipple';
}

/**
 * 한 번의 훑기 (Hertzmann 의 층 하나): 격자 칸마다 목표보다 밝은 정도의 평균이 T 를 넘으면
 * 가장 차이가 큰 자리에 획을 놓는다. 칸 순서는 무작위.
 */
function sweep(c: Ctx, ref: Float32Array, R: number, sw: Sweep, T: number, L: number, onTick?: (frac: number) => void) {
  const { w, h, cv, rng, lw } = c;
  const g = Math.max(lw * 2.2, R * 0.3) * (sw.gMul ?? 1);
  const cols = Math.ceil(w / g) + 1, rows = Math.ceil(h / g) + 1;
  const order = shuffled(cols * rows, rng);
  const off = (sw.offset ?? 0) * g;
  const sample = g > 14 ? 2 : 1;
  const tickEvery = Math.max(1, Math.floor(order.length / 8));
  for (let q = 0; q < order.length; q++) {
    if (onTick && q % tickEvery === 0) onTick(q / order.length);
    const cell = order[q];
    const cx = (cell % cols) * g - off, cy = Math.floor(cell / cols) * g - off;
    const xs = Math.max(0, cx | 0), ys = Math.max(0, cy | 0);
    const x1 = Math.min(w, Math.ceil(cx + g)), y1 = Math.min(h, Math.ceil(cy + g));
    if (xs >= x1 || ys >= y1) continue;
    let sum = 0, n = 0, best = 0, bi = -1;
    for (let y = ys; y < y1; y += sample) for (let x = xs; x < x1; x += sample) {
      const i = y * w + x;
      const e = ref[i] - cv.dark[i];
      if (e > 0) { sum += e; if (e > best) { best = e; bi = i; } }
      n++;
    }
    if (bi < 0 || sum / n < T) continue;
    if (sw.minRef !== undefined && ref[bi] < sw.minRef) continue;
    // 시작점: 가장 차이가 큰 자리 + 무작위성만큼 흔들림
    const jx = (rng() - 0.5) * g * c.rnd, jy = (rng() - 0.5) * g * c.rnd;
    const x0 = clamp((bi % w) + 0.5 + jx, 0, w - 1), y0 = clamp(Math.floor(bi / w) + 0.5 + jy, 0, h - 1);
    const i0 = (y0 | 0) * w + (x0 | 0);
    const len = L * (1 + (rng() - 0.5) * 0.8 * c.rnd);
    if (sw.kind === 'stipple') {
      // 점묘: 부족한 만큼의 점을 칸 안에 흩뿌린다
      const need = (sum / n) * (g * g) / (Math.PI * lw * lw * 0.25 * 2.4);
      const cnt = Math.min(60, Math.floor(need + rng()));
      for (let k = 0; k < cnt; k++) {
        const px = xs + rng() * (x1 - xs), py = ys + rng() * (y1 - ys);
        const i = (py | 0) * w + (px | 0);
        if (ref[i] < 0.02 || cv.dark[i] > ref[i]) continue;
        cv.dot(px, py, (lw / 2) * (0.7 + rng() * 0.6), 0.95);
        cv.end(clamp(alphaFor(c, ref[i]) * 1.1, 0, 0.97), c.colorAt(i));
      }
      continue;
    }
    if (sw.kind === 'scribble') { scribbleStroke(c, ref, x0, y0, len * 1.6); continue; }
    // pen 붓: 잔결(나뭇잎)은 획 대신 고리 선
    // 무작위성이 낮은(정돈된 손) 설정은 고리 대신 짧은 잎 획으로 잔결을 낸다 (세밀 펜화)
    if (c.p.brush === 'pen' && !sw.rot && c.rnd >= 0.25 && c.texture[i0] > 0.45 && c.field.aniso[i0] < 0.45 && ref[i0] > 0.25 && ref[i0] < 0.75 && rng() < 0.3) { loopStroke(c, ref, x0, y0, R); continue; }
    let Lc = Math.min(len, Math.min(w, h) * 0.14);
    // 방향이 없는 평탄한 곳(하늘·벽)은 길게. 잔결 영역은 짧게 (긴 줄이 생기면 풀밭처럼 보인다)
    if (c.field.coh[i0] < 0.15 && c.field.man[i0] < 0.1 && c.texture[i0] < 0.3) Lc *= 1.7;
    else if (c.texture[i0] > 0.5) Lc = Math.min(Lc * 0.5, Math.max(lw * 14, Math.min(w, h) * 0.035));
    penStroke(c, ref, x0, y0, Lc, sw.rot ?? 0);
  }
}

/** 붓별 훑기 구성. 층마다 이 순서대로 돈다 */
function sweepsFor(p: PaintProfile): Sweep[] {
  const q = Math.PI / 2;
  switch (p.brush) {
    case 'pen': return [{ rot: 0 }, { rot: q, minRef: 0.5, offset: 0.5 }];
    case 'hatch': return [{ rot: 0 }, { rot: 0, offset: 0.5 }];
    case 'cross': return [{ rot: 0 }, { rot: q, offset: 0.5 }, { rot: q / 2, minRef: 0.55 }];
    case 'contour': return [{ rot: 0, minRef: 0.6, gMul: 1.6 }];
    case 'scribble': return [{ kind: 'scribble' }, { kind: 'scribble', offset: 0.5 }];
    case 'stipple': return [{ kind: 'stipple' }];
    case 'wash': case 'oil': case 'impasto': return [];
  }
}

/**
 * 수채 담채 층 (DAP 그대로): 붓 크기 R 의 붓 자국을, 캔버스 색이 목표 색과 다른 칸에만 방향장을 따라 얹는다.
 * 다른 면(목표 색이 크게 다른 곳)으로 넘어가면 멈춘다.
 */
/** 담채·유화 훑기의 단계 옵션: 불투명도 배율, 획 길이 배율, 팁 강제 (밑칠은 젖은 큰 붓, 세부는 마른 작은 붓) */
interface WashStage { alpha?: number; len?: number; tip?: TipKind }

function washSweep(c: Ctx, want: Float32Array, R: number, T: number, soft: boolean, onTick?: (frac: number) => void, st: WashStage = {}) {
  const { w, h, cv, rng, field } = c;
  // 유화: 불투명한 얇고 짧은 붓 자국 (담채는 넓고 옅음). 임파스토: 길고 굽은 자국, 자국마다 색이 다르고 테두리는 어둡게·가운데는 밝게
  const impasto = c.p.brush === 'impasto';
  const oil = c.p.brush === 'oil' || impasto;
  const g = Math.max(2, R * (impasto ? 0.5 : oil ? 0.4 : 0.55));
  const cols = Math.ceil(w / g), rows = Math.ceil(h / g);
  const order = shuffled(cols * rows, rng);
  const step = R * (impasto ? 0.4 : oil ? 0.25 : 0.35), maxLen = R * ((oil ? 1.2 : 2.5) + (impasto ? 5 : oil ? 3 : 4) * clamp(c.p.strokeLength, 0, 100) / 100) * (st.len ?? 1);
  const tickEvery = Math.max(1, Math.floor(order.length / 6));
  for (let q = 0; q < order.length; q++) {
    if (onTick && q % tickEvery === 0) onTick(q / order.length);
    const cell = order[q];
    const cx = (cell % cols) * g, cy = Math.floor(cell / cols) * g;
    const x1 = Math.min(w, Math.ceil(cx + g)), y1 = Math.min(h, Math.ceil(cy + g));
    let err = 0, n = 0;
    for (let y = cy | 0; y < y1; y++) for (let x = cx | 0; x < x1; x++) {
      const o = (y * w + x) * 3;
      err += Math.abs(cv.rgb[o] - want[o]) + Math.abs(cv.rgb[o + 1] - want[o + 1]) + Math.abs(cv.rgb[o + 2] - want[o + 2]);
      n++;
    }
    if (!n || err / (n * 3) < T) continue;
    let x = cx + rng() * g, y = cy + rng() * g;
    const fi = (y | 0) * w + (x | 0);
    const io = fi * 3;
    // 유화: 붓 자국마다 밝기가 조금씩 달라 붓결이 보인다 (임파스토 느낌)
    const jit = oil ? 1 + (rng() - 0.5) * 0.16 : 1;
    // 임파스토: 채널을 따로 흔들어 자국마다 색상이 조금씩 다르다 (노랑·주황·초록 줄무늬)
    const hj = impasto ? 0.28 * c.rnd : 0;
    const col: RGB = [want[io] * jit * (1 + (rng() - 0.5) * hj), want[io + 1] * jit * (1 + (rng() - 0.5) * hj), want[io + 2] * jit * (1 + (rng() - 0.5) * hj)];
    const path: number[] = [];
    let [dx, dy] = dirAt(c, fi, 0);
    if (rng() < 0.5) { dx = -dx; dy = -dy; }
    // 브러시 팁: 획마다 붓털 배치가 새로 정해진다. 둥근 팁은 예전 원형 자국
    const tipKind = st.tip ?? c.p.tip;
    const tip = tipKind !== 'round' ? makeTip(tipKind, rng) : null;
    for (let s = 0; s < maxLen; s += step) {
      const xi = x | 0, yi = y | 0;
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) break;
      const o = (yi * w + xi) * 3;
      // 다른 면으로 넘어가면 멈춘다. 임파스토는 문턱을 크게 두어 긴 소용돌이 획이 되고, 최소 네 걸음은 간다
      if (s >= step * 4 && Math.abs(want[o] - col[0]) + Math.abs(want[o + 1] - col[1]) + Math.abs(want[o + 2] - col[2]) > (impasto ? 110 : 60)) break;
      const rad = oil ? R * 0.32 : R / 2;
      if (impasto) path.push(x, y, dx, dy); else if (tip) cv.dabTip(x, y, rad, dx, dy, tip); else cv.dab(x, y, rad, soft);
      const i = yi * w + xi;
      if (field.coh[i] > 0.15 || field.man[i] > 0.1) {
        let [fx, fy] = dirAt(c, i, 0);
        if (fx * dx + fy * dy < 0) { fx = -fx; fy = -fy; }
        dx = dx * 0.4 + fx * 0.6; dy = dy * 0.4 + fy * 0.6;
        const nn = Math.hypot(dx, dy) || 1; dx /= nn; dy /= nn;
      }
      x += dx * step; y += dy * step;
    }
    if (impasto) {
      // 테두리(어둡고 넓게) → 몸통 → 가운데 능선(밝고 좁게): 두꺼운 물감이 빛을 받는 느낌
      const rr = R * 0.3;
      const stamp = (q: number, rad: number) => (tip ? cv.dabTip(path[q], path[q + 1], rad, path[q + 2], path[q + 3], tip) : cv.dab(path[q], path[q + 1], rad, false));
      for (let q = 0; q < path.length; q += 4) stamp(q, rr * 1.15);
      cv.end(0.85, [col[0] * 0.72, col[1] * 0.72, col[2] * 0.72], false);
      for (let q = 0; q < path.length; q += 4) stamp(q, rr * 0.85);
      cv.end(0.9, col, false);
      // 능선은 자국이 어느 정도 굵을 때만 (가는 홈에서는 보이지 않고 시간만 든다)
      if (rr >= 1.6) for (let q = 0; q < path.length; q += 8) stamp(q, rr * 0.4);
      cv.end(0.7, [Math.min(255, col[0] * 1.14 + 6), Math.min(255, col[1] * 1.14 + 6), Math.min(255, col[2] * 1.14 + 6)], false);
    } else cv.end(clamp((oil ? 0.8 + rng() * 0.15 : 0.42 + 0.1 * (1 - c.rnd) + rng() * 0.15 * c.rnd) * (st.alpha ?? 1), 0, 0.97), col, false);
  }
}

/** 담채의 목표 색: 사진 색을 크게 뭉개고 물감처럼 밝게 띄운 뒤 목표 어둡기만큼 종이에 곱한다 */
function washTarget(img: RawImage, lum: Float32Array, white: number, w: number, h: number, paper: RGB, mode: ColorMode, oil = false): Float32Array {
  const N = w * h;
  const want = new Float32Array(N * 3);
  const R0 = Math.max(2, Math.round(Math.min(w, h) / 220));
  const chans: Float32Array[] = [0, 1, 2].map((k) => {
    const a = new Float32Array(N);
    for (let i = 0, q = 0; i < img.data.length; i += 4, q++) a[q] = img.data[i + k] / 255;
    return boxBlur(a, w, h, R0);
  });
  const softL = boxBlur(lum, w, h, R0);
  for (let i = 0; i < N; i++) {
    const L = softL[i];
    const o = i * 3;
    // 여백 문턱 위는 종이, 그 아래는 사진 색을 물감처럼 조금 띄우고 채도를 살려 종이에 곱한다. 문턱 근처는 부드럽게 이어진다
    const op = oil ? 1 : clamp((white + 0.08 - L) / 0.16, 0, 1) * 0.95;
    if (op <= 0.01) { want[o] = paper[0]; want[o + 1] = paper[1]; want[o + 2] = paper[2]; continue; }
    let tr: number, tg: number, tb: number;
    if (mode === 'color') {
      const r = chans[0][i], g = chans[1][i], b = chans[2][i], m = (r + g + b) / 3;
      const sat = oil ? 1.35 : 1.6; // 참고 수채화처럼 채도는 높이고, 어두운 곳은 어둡게 남긴다. 유화는 조금만
      const lo = oil ? 0.03 : 0.08, hi = 1 - lo;
      // 유화는 대비를 조금 키운다 (인상주의 유화의 밝은 빛)
      const con = (v: number) => (oil ? clamp(0.5 + (v - 0.5) * 1.18 + 0.03, 0, 1) : v);
      tr = con(clamp(m + (r - m) * sat, 0, 1)) * hi + lo; tg = con(clamp(m + (g - m) * sat, 0, 1)) * hi + lo; tb = con(clamp(m + (b - m) * sat, 0, 1)) * hi + lo;
    } else {
      const g = L * 0.8 + 0.2;
      if (mode === 'sepia') { tr = g * 0.92 + 0.08; tg = g * 0.82 + 0.1; tb = g * 0.66 + 0.1; } else { tr = g; tg = g; tb = g; }
    }
    if (oil) { want[o] = tr * 255; want[o + 1] = tg * 255; want[o + 2] = tb * 255; continue; } // 불투명: 종이색과 무관
    want[o] = paper[0] * (1 - op * (1 - tr)); want[o + 1] = paper[1] * (1 - op * (1 - tg)); want[o + 2] = paper[2] * (1 - op * (1 - tb));
  }
  return want;
}

/** RGB 배열(N×3) 블러 */
function blurRGB(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src;
  const N = w * h, out = new Float32Array(N * 3), ch = new Float32Array(N);
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < N; i++) ch[i] = src[i * 3 + k];
    const b = boxBlur(ch, w, h, r);
    for (let i = 0; i < N; i++) out[i * 3 + k] = b[i];
  }
  return out;
}

/** 캔버스를 조금 뭉갠다 (DAP 의 Reactor 'Shock Smooth': 젖은 밑칠끼리 번져 하나로 이어지는 느낌) */
function smoothCanvas(cv: Canvas, r: number) {
  const { w, h } = cv;
  const N = w * h;
  for (let k = 0; k < 3; k++) {
    const ch = new Float32Array(N);
    for (let i = 0; i < N; i++) ch[i] = cv.rgb[i * 3 + k];
    const b = boxBlur(ch, w, h, r);
    for (let i = 0; i < N; i++) cv.rgb[i * 3 + k] = ch[i] * 0.35 + b[i] * 0.65;
  }
}

/** 젖은 담채가 마르면서 경계에 안료가 고이는 효과: 캔버스 밝기의 그라디언트가 큰 곳을 조금 어둡게 */
function pigmentEdges(cv: Canvas, amount: number, rng: () => number) {
  const { w, h } = cv;
  const N = w * h;
  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) lum[i] = (0.299 * cv.rgb[i * 3] + 0.587 * cv.rgb[i * 3 + 1] + 0.114 * cv.rgb[i * 3 + 2]) / 255;
  const { mag } = sobel(boxBlur(lum, w, h, 1), w, h);
  // 안료 입자감(granulation): 칠한 곳일수록 거친 무작위 얼룩
  const grain = boxBlur(Float32Array.from({ length: N }, () => rng() - 0.5), w, h, 1);
  for (let i = 0; i < N; i++) {
    const painted = clamp((0.97 - lum[i]) * 3, 0, 1);
    const k = clamp(mag[i] * 2.5, 0, 1) * amount * (1 - lum[i] * 0.5) - grain[i] * 0.22 * painted;
    if (Math.abs(k) <= 0.004) continue;
    const o = i * 3;
    cv.rgb[o] *= 1 - k; cv.rgb[o + 1] *= 1 - k; cv.rgb[o + 2] *= 1 - k;
  }
}

/** 가장자리를 미완성처럼 흐림: 불규칙한 경계 밖으로 갈수록 종이로 되돌린다 */
function applyVignette(cv: Canvas, paper: RGB, amount: number, rng: () => number) {
  const { w, h } = cv;
  const m = (amount / 100) * 0.22 * Math.min(w, h);
  if (m < 1) return;
  const eL = smoothNoise1D(h, rng), eR = smoothNoise1D(h, rng), eT = smoothNoise1D(w, rng), eB = smoothNoise1D(w, rng);
  const amp = m * 0.7;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.min(x + eL[y] * amp, w - 1 - x + eR[y] * amp, y + eT[x] * amp, h - 1 - y + eB[x] * amp);
    if (d >= m) continue;
    const t = Math.max(0, d / m);
    const f = t * t * (3 - 2 * t);
    const i = y * w + x, o = i * 3;
    cv.rgb[o] = paper[0] + (cv.rgb[o] - paper[0]) * f; cv.rgb[o + 1] = paper[1] + (cv.rgb[o + 1] - paper[1]) * f; cv.rgb[o + 2] = paper[2] + (cv.rgb[o + 2] - paper[2]) * f;
    cv.dark[i] *= f;
  }
}

/** 색 모드에 따른 종이색 */
function paperFor(mode: ColorMode, p: PaintProfile): RGB {
  return mode === 'sepia' ? [243, 231, 208] : hexToRgb(p.paperColor);
}

/** 층별 획 크기: 첫 층(brushSize)에서 마지막 층(detail) 까지 등비로 */
export function passSizes(p: PaintProfile, minSide: number): number[] {
  const passes = clamp(Math.round(p.passes), 1, 6);
  const Rmax = minSide * (0.025 + 0.11 * clamp(p.brushSize, 0, 100) / 100);
  const Rmin = Math.min(Rmax, minSide * (0.005 + 0.03 * (1 - clamp(p.detail, 0, 100) / 100)));
  const out: number[] = [];
  for (let k = 0; k < passes; k++) {
    const t = passes === 1 ? 1 : k / (passes - 1);
    out.push(Rmax * Math.pow(Rmin / Rmax, t));
  }
  return out;
}

/* ---------- 메인 ---------- */

export function renderDrawing(img: RawImage, opts: RenderOpts): RawImage {
  const { width: w, height: h } = img;
  const N = w * h;
  const p = opts.paint;
  const rng = mulberry32(1234567);
  const minSide = Math.min(w, h);
  const scale = Math.max(w, h) / 1000;

  const lum = luminance01(img);
  const grads = channelGradients(img, w, h);
  const mag = colorEdgeMag(grads, N);
  const texture = textureMap(mag, w, h);
  const manual = opts.guides && opts.guides.length ? manualField(opts.guides, opts.guideRadius ?? 18, w, h) : null;
  const field = orientationField(grads, w, h, manual, texture);

  // 1) 목표 어둡기 (0 = 종이). 펜 드로잉은 사진보다 밝다: 여백 위는 비우고, 나머지는 감마를 두어 옅게.
  const white = 0.40 + 0.55 * clamp(p.paperKeep, 0, 100) / 100;
  const target = new Float32Array(N);
  const smooth = boxBlur(lum, w, h, 1);
  for (let i = 0; i < N; i++) {
    const L = smooth[i];
    if (L >= white) continue;
    const d = (white - L) / white;
    target[i] = (0.06 + 0.84 * Math.pow(d, 1.1)) * (1 - texture[i] * 0.22);
  }
  const painty = p.brush === 'wash' || p.brush === 'oil' || p.brush === 'impasto';
  if (!painty) {
    // 펜: 사람 화가처럼 단순화한다. 잎 하나하나가 아니라 나무 덩어리의 톤을 본다 — 잔결 영역은 크게 뭉개고(세밀함이 낮을수록 더),
    // 덩어리끼리의 대비를 키운 뒤 톤을 층 수만큼의 단계로 눌러 덩어리마다 고른 해칭이 들어가게 한다.
    // (이걸 안 하면 실사의 빽빽한 숲이 고리·획 부스러기로 덮인 '그림이 아닌 것'이 된다.)
    const rS = Math.max(2, Math.round(minSide * (0.008 + 0.03 * (1 - clamp(p.detail, 0, 100) / 100))));
    const s1 = boxBlur(target, w, h, Math.max(1, Math.round(rS * 0.4))), s2 = boxBlur(target, w, h, rS * 2);
    for (let i = 0; i < N; i++) target[i] = s1[i] * (1 - texture[i]) + s2[i] * texture[i];
    // 잎 무리의 밝은 덩어리와 그늘 덩어리가 갈라져야 나무로 읽힌다 — 덩어리 크기(짧은 변/70)의 지역 대비를 키운다.
    // 단계로 누르거나(포스터라이즈) 어두운 곳만 남기는 시도는 실사에서 섬 윤곽이 위장 무늬처럼 보여 뺐다.
    const local = boxBlur(target, w, h, Math.max(4, Math.round(minSide / 70)));
    for (let i = 0; i < N; i++) if (texture[i] > 0.3) target[i] = clamp(target[i] + (target[i] - local[i]) * 0.9 * texture[i], 0, 1);
  }

  const paper = paperFor(opts.color, p);
  const cv = new Canvas(w, h, paper);
  let inkC = hexToRgb(p.inkColor);
  if (opts.color === 'sepia') inkC = [74, 46, 28];
  // 컬러 펜: 사진 색을 잉크색과 섞어 어둡게 누른 색
  let colorAt: (i: number) => RGB = () => inkC;
  if (opts.color === 'color') {
    const soft = [0, 1, 2].map((k) => { const a = new Float32Array(N); for (let i = 0, q = 0; i < img.data.length; i += 4, q++) a[q] = img.data[i + k]; return boxBlur(a, w, h, 3); });
    // 펜: 사진 색을 잉크색과 섞어 누른 색. 담채 위의 어두운 붓: 그 자리 색을 더 진하게 (검정 펜이 아니라 짙은 물감)
    const painty = p.brush === 'wash' || p.brush === 'oil' || p.brush === 'impasto';
    const ki = painty ? 0.45 : 0.35, kc = painty ? 0.5 : 0.45;
    colorAt = (i) => [inkC[0] * ki + soft[0][i] * kc, inkC[1] * ki + soft[1][i] * kc, inkC[2] * ki + soft[2][i] * kc];
  }
  const acc = clamp(p.accuracy, 0, 100) / 100;
  const c: Ctx = {
    w, h, N, cv, field, texture, rng, p,
    lw: clamp(p.lineWidth, 0.6, 8) * scale,
    ff: clamp(p.featureFollow, 0, 100) / 100,
    rnd: clamp(p.randomness, 0, 100) / 100,
    base: (p.baseAngle * Math.PI) / 180,
    tol: 0.10 + 0.25 * (1 - acc),
    colorAt,
    painty: p.brush === 'wash' || p.brush === 'oil' || p.brush === 'impasto',
  };
  const T = 0.03 + 0.28 * (1 - acc);
  const sizes = passSizes(p, minSide);
  const passes = sizes.length;

  // 진행 알림 (0.2초 간격)
  let lastTick = 0;
  let stageLabel = '';
  const report = (pass: number, frac: number, force = false) => {
    if (!opts.onProgress) return;
    const now = Date.now();
    if (!force && now - lastTick < 200) return;
    lastTick = now;
    opts.onProgress(cv.toImage(), { pass, passes, frac: (pass + frac) / (passes + 0.6), strokes: cv.strokes, label: stageLabel });
  };

  // 2) 층: 큰 획 → 작은 획. 층마다 목표를 획 크기만큼 뭉갠 참조를 본다 (큰 획은 큰 형태만).
  if (p.brush === 'wash' || p.brush === 'oil' || p.brush === 'impasto') {
    const oil = p.brush !== 'wash';
    const want0 = washTarget(img, lum, white, w, h, paper, opts.color, oil);
    for (let k = 0; k < passes; k++) {
      const R = Math.max(4, sizes[k] * 1.3);
      // 임파스토는 테두리·능선 때문에 목표와 늘 조금 다르므로 문턱을 높여 같은 칸을 끝없이 덧칠하지 않게 한다
      const Tk = (4 + 10 * (1 - acc)) * (p.brush === 'impasto' ? 2.4 : 1);
      // 층마다 목표를 붓 크기만큼 뭉갠 것을 본다 (Hertzmann): 큰 붓은 큰 색면만, 잎 하나하나에 걸려 짧게 끊기지 않는다
      const want = blurRGB(want0, w, h, Math.round(R * (p.brush === 'impasto' ? 0.5 : 0.35)));
      if (oil) {
        stageLabel = k === 0 ? '밑칠 (큰 붓)' : k === passes - 1 ? '세부 (작은 붓)' : '중간 붓';
        washSweep(c, want, R, Tk, false, (f) => report(k, f));
      } else {
        // DAP Watercolor Wet on Wet 의 순서(사용자 영상): 밑칠 — 크고 젖은 붓을 옅게 두 번(색이 겹쳐 번짐) → 중간 붓 →
        // 매끄럽게(Reactor) → 마른 작은 붓으로 세부를 드러냄(Dry Reveal) → 가장 작은 붓
        const stage = passes === 1 ? 1 : k / (passes - 1);
        if (stage < 0.34) {
          stageLabel = '밑칠 (큰 젖은 붓)';
          washSweep(c, want, R, Tk, true, (f) => report(k, f * 0.5), { alpha: 0.7, len: 0.55, tip: 'wet' });
          washSweep(c, want, R * 0.75, Tk, true, (f) => report(k, 0.5 + f * 0.5), { alpha: 0.8, len: 0.6, tip: 'wet' });
        } else if (stage < 0.67) {
          stageLabel = '중간 붓';
          washSweep(c, want, R, Tk, true, (f) => report(k, f), { alpha: 0.95, len: 0.8 });
          smoothCanvas(cv, 1); // Reactor: 젖은 밑칠이 서로 번져 매끄러워진다
        } else {
          stageLabel = k === passes - 1 ? '세부 (가장 작은 붓)' : '마른 붓으로 세부 드러내기';
          washSweep(c, want, R, Tk, false, (f) => report(k, f), { alpha: 1.1, len: 1, tip: p.tip === 'wet' ? 'chalk' : p.tip });
        }
      }
      report(k, 1, true);
    }
    // 물감이 마르며 가장자리에 고이는 안료: 캔버스 밝기의 경계를 조금 어둡게
    if (!oil) pigmentEdges(cv, 0.34, mulberry32(77));
    // 펜: 잉크 농도가 있을 때만 가장 어두운 곳에 성긴 획 (순수 수채는 ink 0)
    if (p.ink >= 30) {
      const ref = boxBlur(target, w, h, 1);
      const R = sizes[passes - 1];
      sweep(c, ref, R, { rot: 0, minRef: 0.6, gMul: 1.8 }, T + 0.08, R * 3);
    }
  } else {
    const sweeps = sweepsFor(p);
    for (let k = 0; k < passes; k++) {
      const R = sizes[k];
      const ref = boxBlur(target, w, h, R * 0.5);
      const L = R * (1.5 + 5 * clamp(p.strokeLength, 0, 100) / 100);
      stageLabel = k === 0 ? '큰 획 (큰 형태)' : k === passes - 1 ? '작은 획 (세부)' : '중간 획';
      for (let s = 0; s < sweeps.length; s++) sweep(c, ref, R, sweeps[s], T, L, (f) => report(k, (s + f) / sweeps.length));
      report(k, 1, true);
    }
    // 먹 채움: 잉크 농도가 높은 붓은 가장 깊은 그림자를 검게 (처마 밑, 열린 문). 잔결 영역은 제외.
    if (p.ink >= 85 && p.brush !== 'stipple') {
      const deep = boxBlur(Float32Array.from(target, (d) => (d > 0.86 ? 1 : 0)), w, h, 1);
      for (let i = 0; i < N; i++) if (deep[i] > 0.6 && texture[i] < 0.75) cv.fill(i, 0.8 * deep[i] * (1 - texture[i] * 0.4), colorAt(i));
    }
  }

  // 3) 윤곽선: 색 경계를 따라가는 획
  const edges = clamp(p.edges, 0, 100);
  if (edges > 0) {
    const th = (0.30 - 0.20 * edges / 100) * (p.brush === 'wash' || p.brush === 'oil' || p.brush === 'impasto' ? 1.5 : 1);
    const widthMul = p.brush === 'contour' ? 1.15 : 1;
    // 덩어리 윤곽: 펜은 단순화한 톤 지도의 경계(나무 덩어리의 뭉게구름 윤곽), 그림붓은 뭉갠 밝기의 경계
    const mass = sobel(boxBlur(painty ? lum : target, w, h, painty ? Math.max(3, Math.round(minSide / 60)) : 2), w, h);
    stageLabel = '윤곽선';
    report(passes - 1, 1, true);
    edgePass(c, mag, mass, chromaEdgeMag(img, w, h), th, widthMul, p.brush === 'contour' ? 1 : 0.9);
  }

  // 4) 가장자리 미완성 처리, 5) 합성
  applyVignette(cv, paper, clamp(p.vignette ?? 0, 0, 100), mulberry32(4242));
  return cv.toImage();
}
