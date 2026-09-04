/**
 * 로컬 렌더러·견본 분석의 화면 스레드 쪽 다리.
 * Blob → ImageData 변환은 여기서(DOM 필요), 계산은 render.worker.ts 에서.
 */
import { blobToImage } from './image';
import type { RawImage, RenderOpts } from './render';
import type { WorkerRequest, WorkerResponse } from './render.worker';
import type { SampleAnalysis } from './sampleStyle';

function decode(blob: Blob, maxSide: number): Promise<RawImage> {
  return blobToImage(blob).then((img) => {
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas를 만들 수 없습니다');
    ctx.drawImage(img, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    return { width: w, height: h, data: id.data };
  });
}

function encode(raw: RawImage): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = raw.width; c.height = raw.height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas를 만들 수 없습니다');
  ctx.putImageData(new ImageData(raw.data as Uint8ClampedArray<ArrayBuffer>, raw.width, raw.height), 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('이미지 인코딩 실패'))), 'image/png'));
}

/** 워커를 요청마다 새로 띄우고 끝나면 종료합니다. 중단은 terminate 로. */
function runWorker(req: WorkerRequest, transfer: Transferable[], signal?: AbortSignal): Promise<WorkerResponse> {
  return new Promise((res, rej) => {
    const worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
    const done = () => { worker.terminate(); signal?.removeEventListener('abort', onAbort); };
    const onAbort = () => { done(); rej(new DOMException('중단', 'AbortError')); };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort);
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      done();
      if (e.data.type === 'error') rej(new Error(e.data.message));
      else res(e.data);
    };
    worker.onerror = (e) => { done(); rej(new Error(e.message || '워커 오류')); };
    worker.postMessage(req, transfer);
  });
}

/** 사진 → 로컬 드로잉 PNG */
export async function renderLocalDrawing(photo: Blob, opts: RenderOpts, signal?: AbortSignal): Promise<Blob> {
  const image = await decode(photo, 1100);
  const r = await runWorker({ type: 'render', image, opts }, [image.data.buffer as ArrayBuffer], signal);
  if (r.type !== 'render') throw new Error('예상치 못한 응답');
  return encode(r.image);
}

/** 견본 드로잉 → 선·톤 프로필 */
export async function analyzeSampleBlob(sample: Blob, signal?: AbortSignal): Promise<SampleAnalysis> {
  const image = await decode(sample, 900);
  const r = await runWorker({ type: 'analyze', image }, [image.data.buffer as ArrayBuffer], signal);
  if (r.type !== 'analyze') throw new Error('예상치 못한 응답');
  return r.result;
}
