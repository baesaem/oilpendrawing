/**
 * 로컬 렌더러·견본 분석의 화면 스레드 쪽 다리.
 * Blob → ImageData 변환은 여기서(DOM 필요), 계산은 render.worker.ts 에서.
 */
import { blobToImage } from './image';
import { renderDrawing, type RawImage, type RenderOpts } from './render';
import type { WorkerRequest, WorkerResponse } from './render.worker';
import { analyzeSample, type SampleAnalysis } from './sampleStyle';

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

/** 워커 없이 화면 스레드에서 같은 계산을 한다 (워커가 뜨지 않는 환경의 대비책. 그리는 동안 화면이 잠깐 멈춘다) */
function runInline(req: WorkerRequest): WorkerResponse {
  if (req.type === 'render') return { type: 'render', image: renderDrawing(req.image, req.opts) };
  return { type: 'analyze', result: analyzeSample(req.image) };
}

let workerBroken = false;

/**
 * 워커를 요청마다 새로 띄우고 끝나면 종료합니다. 중단은 terminate 로.
 * 워커 스크립트를 못 불러오거나(옛 개발 서버에 새 코드가 섞인 경우, 모듈 워커 미지원 브라우저 등) 워커가 죽으면
 * 한 번 알린 뒤 화면 스레드로 대신 계산합니다. 그래서 "드로잉 만들기"는 어떤 환경에서도 결과를 냅니다.
 */
function runWorker(req: WorkerRequest, transfer: Transferable[], signal?: AbortSignal): Promise<WorkerResponse> {
  if (workerBroken || typeof Worker === 'undefined') {
    return new Promise((res, rej) => {
      if (signal?.aborted) return rej(new DOMException('중단', 'AbortError'));
      // 화면이 한 프레임 그려질 틈을 준 뒤 계산
      setTimeout(() => { try { res(runInline(req)); } catch (e) { rej(e instanceof Error ? e : new Error(String(e))); } }, 30);
    });
  }
  // 워커로 넘기면 버퍼가 비워지므로, 실패 시 화면 스레드에서 다시 쓰기 위해 복사해 둔다
  const backup: WorkerRequest = { ...req, image: { ...req.image, data: new Uint8ClampedArray(req.image.data) } } as WorkerRequest;
  return new Promise((res, rej) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
      console.error('렌더 워커 생성 실패, 화면 스레드로 대신 계산합니다', e);
      workerBroken = true;
      try { res(runInline(backup)); } catch (err) { rej(err instanceof Error ? err : new Error(String(err))); }
      return;
    }
    const done = () => { worker.terminate(); signal?.removeEventListener('abort', onAbort); };
    const onAbort = () => { done(); rej(new DOMException('중단', 'AbortError')); };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort);
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      done();
      if (e.data.type === 'error') rej(new Error(e.data.message));
      else res(e.data);
    };
    worker.onerror = (e) => {
      done();
      const where = e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : '';
      console.error('렌더 워커 오류' + where, e.message || e, '— 화면 스레드로 대신 계산합니다. 개발 서버를 켠 채로 업데이트했다면 start.bat 을 다시 실행하세요.');
      workerBroken = true;
      try { res(runInline(backup)); } catch (err) { rej(err instanceof Error ? err : new Error(String(err))); }
    };
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
