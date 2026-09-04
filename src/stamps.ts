/**
 * 낙관·사인 등록과 배치.
 * 등록한 이미지는 localStorage 에 작은 PNG(data URL)로 보관하고, 배치는 그림 위 상대 좌표(0~1)로 기억합니다.
 * 결과 PNG 에는 compositeStamps 로 구워 넣습니다.
 */
import { blobToImage } from './image';

export type StampKind = 'seal' | 'sign';
export interface StampItem {
  id: string;
  kind: StampKind;
  name: string;
  /** 투명 배경 PNG data URL */
  dataUrl: string;
  w: number;
  h: number;
}
export interface PlacedStamp {
  id: string;
  stampId: string;
  /** 그림 너비·높이에 대한 중심 위치 0~1 */
  x: number;
  y: number;
  /** 그림 너비에 대한 폭 비율 */
  size: number;
}
export interface StampState { items: StampItem[]; placed: PlacedStamp[] }

export const STAMP_LIMIT: Record<StampKind, number> = { seal: 2, sign: 3 };
export const STAMP_LABEL: Record<StampKind, string> = { seal: '낙관', sign: '사인' };
const KEY = 'oilpen.stamps.v1';
const MAX_SIDE = 480;

export const newStampId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function loadStamps(): StampState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<StampState>;
      return { items: Array.isArray(p.items) ? p.items : [], placed: Array.isArray(p.placed) ? p.placed : [] };
    }
  } catch { /* 손상된 값은 무시 */ }
  return { items: [], placed: [] };
}
export function saveStamps(s: StampState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 용량 초과 등은 조용히 */ }
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas를 만들 수 없습니다');
  return [c, ctx];
}

/**
 * 종이에 찍힌 낙관·사인 사진에서 배경을 걷어냅니다.
 * 밝은 픽셀은 투명하게, 어두운(잉크·인주) 픽셀은 남기고, 잉크 부분만 남도록 여백을 잘라냅니다.
 */
function cleanBackground(ctx: CanvasRenderingContext2D, w: number, h: number, kind: StampKind) {
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  // 종이 밝기 추정: 상위 밝기의 중앙값 근처
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    // 낙관은 붉은 인주가 밝아도 남아야 하므로 채도도 봅니다
    const inkness = kind === 'seal' ? Math.max(1 - lum, sat * 1.3) : 1 - lum;
    const a = Math.min(1, Math.max(0, (inkness - 0.18) / 0.32));
    d[i + 3] = Math.round(d[i + 3] * a);
    if (kind === 'sign' && a > 0) {
      // 사인은 잉크를 진하게 정리
      const k = 0.35;
      d[i] = r * k; d[i + 1] = g * k; d[i + 2] = b * k;
    }
    if (d[i + 3] > 40) {
      const x = (i / 4) % w, y = (i / 4 - x) / w;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  ctx.putImageData(id, 0, 0);
  if (maxX < 0) return null;
  const pad = 4;
  return { x: Math.max(0, minX - pad), y: Math.max(0, minY - pad), w: Math.min(w, maxX + pad + 1) - Math.max(0, minX - pad), h: Math.min(h, maxY + pad + 1) - Math.max(0, minY - pad) };
}

/** 업로드한 이미지 → 등록용 항목 (배경 제거, 여백 잘라내기, 크기 제한) */
export async function stampFromFile(file: File, kind: StampKind): Promise<StampItem> {
  const img = await blobToImage(file);
  const s = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
  const [c, ctx] = canvasOf(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const box = cleanBackground(ctx, w, h, kind) ?? { x: 0, y: 0, w, h };
  const s2 = Math.min(1, MAX_SIDE / Math.max(box.w, box.h));
  const ow = Math.max(1, Math.round(box.w * s2)), oh = Math.max(1, Math.round(box.h * s2));
  const [out, octx] = canvasOf(ow, oh);
  octx.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, ow, oh);
  return { id: newStampId(), kind, name: file.name.replace(/\.[^.]+$/, '').slice(0, 20) || STAMP_LABEL[kind], dataUrl: out.toDataURL('image/png'), w: ow, h: oh };
}

/** 글자로 낙관 만들기: 붉은 바탕에 흰 글자, 1~4자 */
export function sealFromText(text: string): StampItem {
  const chars = [...text.trim()].slice(0, 4);
  const S = 320;
  const [c, ctx] = canvasOf(S, S);
  ctx.fillStyle = '#c73a2c';
  ctx.beginPath(); ctx.roundRect(4, 4, S - 8, S - 8, S * 0.1); ctx.fill();
  ctx.fillStyle = '#fbf3ea';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const font = (px: number) => `800 ${px}px "Nanum Myeongjo", "Noto Serif KR", serif`;
  if (chars.length <= 2) {
    ctx.font = font(Math.round(S * (chars.length === 1 ? 0.62 : 0.44)));
    ctx.fillText(chars.join(''), S / 2, S / 2 + S * 0.03);
  } else {
    ctx.font = font(Math.round(S * 0.36));
    // 전통 낙관처럼 오른쪽 위부터 세로로
    const pos = [[0.74, 0.28], [0.74, 0.72], [0.26, 0.28], [0.26, 0.72]];
    chars.forEach((ch, i) => ctx.fillText(ch, S * pos[i][0], S * pos[i][1] + S * 0.02));
  }
  return { id: newStampId(), kind: 'seal', name: chars.join('') || '낙관', dataUrl: c.toDataURL('image/png'), w: S, h: S };
}

/** 직접 그린 사인(캔버스) → 등록용 항목. 잉크 부분만 잘라냅니다 */
export function signFromCanvas(src: HTMLCanvasElement): StampItem | null {
  const w = src.width, h = src.height;
  const [c, ctx] = canvasOf(w, h);
  ctx.drawImage(src, 0, 0);
  const id = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 3; i < id.length; i += 4) if (id[i] > 20) {
    const p = (i - 3) / 4, x = p % w, y = (p - x) / w;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0) return null;
  const pad = 6, bx = Math.max(0, minX - pad), by = Math.max(0, minY - pad);
  const bw = Math.min(w, maxX + pad + 1) - bx, bh = Math.min(h, maxY + pad + 1) - by;
  const [out, octx] = canvasOf(bw, bh);
  octx.drawImage(c, bx, by, bw, bh, 0, 0, bw, bh);
  return { id: newStampId(), kind: 'sign', name: '사인', dataUrl: out.toDataURL('image/png'), w: bw, h: bh };
}

/** 기본 배치 위치: 낙관은 오른쪽 아래, 사인은 그 왼쪽 */
export function defaultPlacement(item: StampItem, existing: PlacedStamp[]): PlacedStamp {
  const seal = item.kind === 'seal';
  const n = existing.length;
  return {
    id: newStampId(), stampId: item.id,
    x: seal ? 0.93 - n * 0.02 : 0.8 - n * 0.02, y: seal ? 0.93 : 0.94,
    size: seal ? 0.06 : 0.16,
  };
}

/** 결과 그림 위에 배치된 낙관·사인을 구워 넣습니다 */
export async function compositeStamps(base: Blob, placed: PlacedStamp[], items: StampItem[]): Promise<Blob> {
  const list = placed.map((p) => ({ p, item: items.find((it) => it.id === p.stampId) })).filter((x) => x.item) as Array<{ p: PlacedStamp; item: StampItem }>;
  if (!list.length) return base;
  const img = await blobToImage(base);
  const W = img.naturalWidth, H = img.naturalHeight;
  const [c, ctx] = canvasOf(W, H);
  ctx.drawImage(img, 0, 0);
  for (const { p, item } of list) {
    const sImg = new Image();
    sImg.src = item.dataUrl;
    await sImg.decode();
    const w = p.size * W, h = w * (item.h / item.w);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(sImg, p.x * W - w / 2, p.y * H - h / 2, w, h);
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('이미지 인코딩 실패'))), 'image/png'));
}
