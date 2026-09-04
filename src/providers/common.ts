import type { ProviderId, ProviderSettings } from '../types';

export interface GenerateRequest {
  /** 이미 리사이즈·흑백 변환이 끝난 입력 (JPEG) */
  input: Blob;
  reference?: Blob;
  prompt: string;
  signal?: AbortSignal;
  onStatus?: (message: string) => void;
}

export interface ImageProvider {
  id: ProviderId;
  /** 사진 → 드로잉 결과 이미지 */
  generate(req: GenerateRequest, s: ProviderSettings): Promise<Blob>;
  /** 키·URL이 유효한지 가볍게 확인. 성공 메시지를 돌려줍니다. */
  test(s: ProviderSettings): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly hint?: string,
  ) {
    super(message);
  }
}

export function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

/** fetch 래퍼: 네트워크/CORS 실패와 HTTP 오류를 사람이 읽을 수 있는 메시지로 바꿉니다. */
export async function callApi(url: string, init: RequestInit, providerName: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ProviderError(
      `${providerName} 서버에 연결할 수 없습니다.`,
      undefined,
      '네트워크 문제이거나, 이 제공사가 브라우저 직접 호출(CORS)을 막고 있을 수 있습니다. ' +
        '설정에서 API 기본 URL을 CORS 프록시 주소로 바꿔 보세요.',
    );
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.clone().json();
      detail = body?.error?.message ?? body?.error ?? body?.message ?? JSON.stringify(body);
      if (typeof detail !== 'string') detail = JSON.stringify(detail);
    } catch {
      detail = await res.text().catch(() => '');
    }
    const hint =
      res.status === 401 || res.status === 403
        ? 'API 키가 틀렸거나 권한이 없습니다.'
        : res.status === 404
          ? '모델 ID 또는 기본 URL을 확인하세요. 제공사가 모델 이름을 바꿨을 수 있습니다.'
          : res.status === 429
            ? '요청 한도 또는 잔액 문제입니다. 잠시 후 다시 시도하세요.'
            : undefined;
    throw new ProviderError(`${providerName} 오류 ${res.status}: ${detail.slice(0, 400)}`, res.status, hint);
  }
  return res;
}
