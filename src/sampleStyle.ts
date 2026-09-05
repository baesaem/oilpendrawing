/**
 * 견본 드로잉 분석 (AI 없음, 순수 계산, 워커에서 실행).
 * 견본에서 종이·잉크색, 톤 단계, 여백, 선 굵기, 해칭 각도·간격, 손떨림을 재어 그리기 설정(PaintProfile)으로 옮겨 돌려줍니다.
 * 측정은 근사치이므로 UI 슬라이더의 초기값으로만 쓰고, 사용자가 눈으로 보며 고칩니다.
 */
import { boxBlur, luminance01, mulberry32, rgbToHex, sobel, type RawImage } from './render';
import { DEFAULT_PAINT, type BrushKind, type PaintProfile } from './types';

export interface SampleAnalysis {
  profile: PaintProfile;
  /** 사용자에게 보여 줄 한 줄 요약 */
  summary: string;
  /** 선을 거의 찾지 못한 경우 등 */
  warning?: string;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function percentile(vals: Float32Array, q: number): number {
  const step = Math.max(1, Math.floor(vals.length / 20000));
  const s: number[] = [];
  for (let i = 0; i < vals.length; i += step) s.push(vals[i]);
  s.sort((a, b) => a - b);
  return s[Math.floor(clamp(q, 0, 1) * (s.length - 1))];
}

/** Otsu 임계값 (0~1 값 배열) */
function otsu(vals: Float32Array): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < vals.length; i++) hist[clamp(Math.round(vals[i] * 255), 0, 255)]++;
  const total = vals.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) { best = v; thr = t; }
  }
  return thr / 255;
}

export function analyzeSample(img: RawImage): SampleAnalysis {
  const { width: w, height: h, data } = img;
  const N = w * h;
  const lum = luminance01(img);

  // 1) 조명 평탄화: 폰으로 찍은 견본은 한쪽이 어두우므로 큰 블러로 나눠 종이를 1 근처로 맞춤
  const bg = boxBlur(lum, w, h, Math.max(8, Math.round(Math.max(w, h) / 12)));
  const flat = new Float32Array(N);
  for (let i = 0; i < N; i++) flat[i] = clamp(lum[i] / Math.max(0.05, bg[i]) * 0.97, 0, 1);

  // 2) 잉크 마스크
  const thr = Math.min(otsu(flat), 0.82);
  const mask = new Uint8Array(N);
  let inkCount = 0;
  for (let i = 0; i < N; i++) if (flat[i] < thr) { mask[i] = 1; inkCount++; }
  const inkFrac = inkCount / N;
  if (inkFrac < 0.004) {
    return { profile: { ...DEFAULT_PAINT }, summary: '선을 찾지 못했습니다', warning: '견본에서 선을 거의 찾지 못했습니다. 더 또렷한 스캔이나 사진을 써 보세요.' };
  }

  // 3) 종이색·잉크색 (원본 색으로)
  const pHi = percentile(lum, 0.88), pLo = percentile(lum, 0.04);
  let pr = 0, pg = 0, pb = 0, pn = 0, ir = 0, ig = 0, ib = 0, inn = 0;
  for (let i = 0; i < N; i += 3) {
    const o = i * 4;
    if (lum[i] >= pHi) { pr += data[o]; pg += data[o + 1]; pb += data[o + 2]; pn++; }
    else if (lum[i] <= pLo) { ir += data[o]; ig += data[o + 1]; ib += data[o + 2]; inn++; }
  }
  const paperColor = pn ? rgbToHex(pr / pn, pg / pn, pb / pn) : DEFAULT_PAINT.paperColor;
  const inkColor = inn ? rgbToHex(ir / inn, ig / inn, ib / inn) : DEFAULT_PAINT.inkColor;

  // 4) 블록 단위 잉크 밀도 → 여백 비율, 톤 단계 수, 해칭 영역
  const B = 16;
  const bw = Math.ceil(w / B), bh = Math.ceil(h / B);
  const dens = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let c = 0, n = 0;
    for (let y = by * B; y < Math.min(h, by * B + B); y++) for (let x = bx * B; x < Math.min(w, bx * B + B); x++) { c += mask[y * w + x]; n++; }
    dens[by * bw + bx] = c / n;
  }
  let paperBlocks = 0, drawn = 0;
  const bins = [0, 0, 0, 0, 0];
  for (let i = 0; i < dens.length; i++) {
    const d = dens[i];
    if (d < 0.02) { paperBlocks++; continue; }
    drawn++;
    bins[d < 0.12 ? 0 : d < 0.25 ? 1 : d < 0.4 ? 2 : d < 0.6 ? 3 : 4]++;
  }
  const paperKeep = clamp(Math.round((paperBlocks / dens.length) * 100), 15, 85);
  const occupied = bins.filter((b) => b >= Math.max(2, drawn * 0.12)).length;
  const tones = clamp(occupied + 1, 2, 6);
  const hatched = (bx: number, by: number) => { const d = dens[by * bw + bx]; return d >= 0.06 && d <= 0.7; };

  // 5) 선 굵기: 침식을 반복해 잉크가 절반 이하로 줄 때까지의 횟수
  let cur = mask, count = inkCount, iters = 0;
  while (iters < 6 && count > inkCount * 0.5) {
    const next = new Uint8Array(N);
    let c = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (cur[i] && cur[i - 1] && cur[i + 1] && cur[i - w] && cur[i + w]) { next[i] = 1; c++; }
    }
    cur = next; count = c; iters++;
  }
  const lineWidth = clamp(iters * 2 - (iters > 1 ? 1 : 0) || 1, 1, 6);

  // 6) 선 방향 히스토그램 (해칭 영역만, 그래디언트 크기로 가중)
  const { mag, gx, gy } = sobel(flat, w, h);
  const BINS = 36;
  const hist = new Float64Array(BINS);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (mag[i] < 0.25 || !hatched((x / B) | 0, (y / B) | 0)) continue;
    let a = Math.atan2(gy[i], gx[i]) + Math.PI / 2; // 선 방향 = 그래디언트에 수직
    a = ((a % Math.PI) + Math.PI) % Math.PI;
    hist[Math.floor((a / Math.PI) * BINS) % BINS] += mag[i];
  }
  const sm = new Float64Array(BINS);
  let total = 0;
  for (let i = 0; i < BINS; i++) { sm[i] = hist[(i + BINS - 1) % BINS] * 0.25 + hist[i] * 0.5 + hist[(i + 1) % BINS] * 0.25; total += sm[i]; }
  let peak = 0;
  for (let i = 1; i < BINS; i++) if (sm[i] > sm[peak]) peak = i;
  const binDist = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, BINS - d); };
  let near = 0;
  for (let i = 0; i < BINS; i++) if (binDist(i, peak) <= 3) near += sm[i];
  const concentration = total ? near / total : 0;
  let second = -1;
  for (let i = 0; i < BINS; i++) if (binDist(i, peak) >= 5 && (second < 0 || sm[i] > sm[second])) second = i;
  const hasSecond = second >= 0 && sm[second] >= sm[peak] * 0.45 && total > 0;
  const hatchAngle = Math.round((peak + 0.5) * (180 / BINS)) % 180;
  const jitter = clamp(Math.round(((0.85 - concentration) / 0.7) * 100), 0, 100);

  // 7) 해칭 간격·점 길이: 무작위 선을 따라 잉크 시작 횟수와 잉크 토막 길이를 잼
  const rng = mulberry32(7);
  const th = (hatchAngle * Math.PI) / 180;
  const nx = -Math.sin(th), ny = Math.cos(th);
  const dxA = Math.cos(th), dyA = Math.sin(th);
  const LEN = 120;
  const spacings: number[] = [], runs: number[] = [];
  for (let tries = 0; tries < 2500 && spacings.length < 300; tries++) {
    const sx = rng() * (w - 1), sy = rng() * (h - 1);
    if (!hatched((sx / B) | 0, (sy / B) | 0)) continue;
    // 수직 방향: 선 간격
    let prev = 0, trans = 0, ok = true;
    for (let s = 0; s < LEN; s++) {
      const x = (sx + nx * s) | 0, y = (sy + ny * s) | 0;
      if (x < 0 || y < 0 || x >= w || y >= h) { ok = false; break; }
      const m = mask[y * w + x];
      if (m && !prev) trans++;
      prev = m;
    }
    if (ok && trans >= 3) spacings.push(LEN / trans);
    // 선 방향: 잉크 위에서 출발해 선을 따라가며 토막 길이를 잼 (옆 1px 은 같은 선으로 봄)
    const sxi = sx | 0, syi = sy | 0;
    if (!mask[syi * w + sxi]) continue;
    let run = 0;
    for (let s = 0; s < LEN; s++) {
      const px = sx + dxA * s, py = sy + dyA * s;
      let hit = false;
      for (let k = -1; k <= 1 && !hit; k++) {
        const x = (px + nx * k) | 0, y = (py + ny * k) | 0;
        if (x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x]) hit = true;
      }
      if (hit) run++; else break;
    }
    runs.push(run);
  }
  const median = (a: number[], d: number) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : d);
  const hatchSpacing = clamp(Math.round(median(spacings, 7)), 3, 24);
  const runLen = median(runs, 10);

  // 8) 붓 추정
  let brush: BrushKind = 'hatch';
  if (runLen <= 4 && runs.length > 20) brush = 'stipple';
  else if (concentration < 0.22 && total > 0) brush = 'scribble';
  else if (hasSecond) brush = 'cross';
  else if (drawn && bins[0] / drawn > 0.75 && tones <= 3) brush = 'contour';

  // 9) 그리기 설정으로: 톤 단계 → 층 수, 해칭 간격 → 세밀함(간격이 좁을수록 작은 획), 토막 길이 → 획 길이,
  //    방향 집중도 → 무작위성. 형태 따라가기·정밀도는 견본 한 장으로 재기 어려워 기본값을 둔다.
  const detail = clamp(Math.round(100 - ((hatchSpacing - 3) / 21) * 80), 20, 100);
  const strokeLength = clamp(Math.round((runLen / 60) * 100), 20, 90);
  const profile: PaintProfile = {
    ...DEFAULT_PAINT,
    brush, passes: tones, detail, strokeLength, baseAngle: hatchAngle, randomness: jitter, lineWidth, paperKeep, paperColor, inkColor,
    featureFollow: brush === 'hatch' || brush === 'cross' ? 40 : DEFAULT_PAINT.featureFollow,
  };
  const summary = `${BRUSH_TEXT[brush]} · ${tones}층 · 선 ${lineWidth}px · 간격 ${hatchSpacing}px · ${hatchAngle}°`;
  return { profile, summary };
}

const BRUSH_TEXT: Record<BrushKind, string> = { pen: '펜 획', hatch: '한 방향 해칭', cross: '교차 해칭', contour: '윤곽선 위주', scribble: '스크리블', stipple: '점묘', wash: '펜 선 + 담채' };
