/** 렌더·분석 워커. 무거운 픽셀 계산을 화면 스레드 밖에서 돌립니다. */
import { renderDrawing, type RawImage, type RenderOpts } from './render';
import { analyzeSample, type SampleAnalysis } from './sampleStyle';

export type WorkerRequest =
  | { type: 'render'; image: RawImage; opts: RenderOpts }
  | { type: 'analyze'; image: RawImage };
export type WorkerResponse =
  | { type: 'render'; image: RawImage }
  | { type: 'analyze'; result: SampleAnalysis }
  | { type: 'error'; message: string };

const ctx = self as unknown as { onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null; postMessage: (m: WorkerResponse, t?: Transferable[]) => void };

ctx.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'render') {
      const image = renderDrawing(msg.image, msg.opts);
      ctx.postMessage({ type: 'render', image }, [image.data.buffer as ArrayBuffer]);
    } else {
      ctx.postMessage({ type: 'analyze', result: analyzeSample(msg.image) });
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', message: (err as Error).message || '계산 중 오류' });
  }
};
