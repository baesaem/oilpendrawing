/** 렌더·분석 워커. 무거운 픽셀 계산을 화면 스레드 밖에서 돌립니다. 그리는 도중의 중간 그림은 progress 로 보냅니다. */
import { renderDrawing, type ProgressInfo, type RawImage, type RenderOpts } from './render';
import { analyzeSample, type SampleAnalysis } from './sampleStyle';

/** 워커로 보내는 요청. onProgress 는 함수라 넘길 수 없으므로 progress 플래그로 대신한다 */
export type WorkerRequest =
  | { type: 'render'; image: RawImage; opts: Omit<RenderOpts, 'onProgress'>; progress?: boolean }
  | { type: 'analyze'; image: RawImage };
export type WorkerResponse =
  | { type: 'render'; image: RawImage }
  | { type: 'progress'; image: RawImage; info: ProgressInfo }
  | { type: 'analyze'; result: SampleAnalysis }
  | { type: 'error'; message: string };

const ctx = self as unknown as { onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null; postMessage: (m: WorkerResponse, t?: Transferable[]) => void };

ctx.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'render') {
      const onProgress = msg.progress
        ? (image: RawImage, info: ProgressInfo) => ctx.postMessage({ type: 'progress', image, info }, [image.data.buffer as ArrayBuffer])
        : undefined;
      const image = renderDrawing(msg.image, { ...msg.opts, onProgress });
      ctx.postMessage({ type: 'render', image }, [image.data.buffer as ArrayBuffer]);
    } else {
      ctx.postMessage({ type: 'analyze', result: analyzeSample(msg.image) });
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', message: (err as Error).message || '계산 중 오류' });
  }
};
