import { base64ToBlob } from '../image';
import type { ProviderSettings } from '../types';
import { callApi, joinUrl, ProviderError, type GenerateRequest, type ImageProvider } from './common';

/**
 * OpenAI Images API — POST /v1/images/edits (multipart).
 * 입력 사진과 (선택) 견본을 image[] 로 함께 보내고, 결과는 data[0].b64_json 로 받습니다.
 */
export const openaiProvider: ImageProvider = {
  id: 'openai',

  async generate(req: GenerateRequest, s: ProviderSettings): Promise<Blob> {
    const form = new FormData();
    form.append('model', s.model);
    form.append('prompt', req.prompt);
    form.append('image[]', req.input, 'input.jpg');
    if (req.reference) form.append('image[]', req.reference, 'reference.png');
    form.append('n', '1');
    form.append('size', 'auto');

    // gpt-image-1 계열은 input_fidelity=high 로 원본 구도를 더 잘 지킵니다. 미지원 모델이면 빼고 재시도.
    const wantsFidelity = /^gpt-image-1(\.|$)/.test(s.model) && !s.model.includes('mini');
    if (wantsFidelity) form.append('input_fidelity', 'high');

    req.onStatus?.('OpenAI에 이미지 편집 요청 중…');
    const send = (f: FormData) =>
      callApi(
        joinUrl(s.baseUrl, '/v1/images/edits'),
        { method: 'POST', headers: { Authorization: `Bearer ${s.apiKey}` }, body: f, signal: req.signal },
        'OpenAI',
      );

    let res: Response;
    try {
      res = await send(form);
    } catch (e) {
      if (e instanceof ProviderError && e.status === 400 && wantsFidelity && /input_fidelity/i.test(e.message)) {
        form.delete('input_fidelity');
        res = await send(form);
      } else throw e;
    }

    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const first = json.data?.[0];
    if (first?.b64_json) return base64ToBlob(first.b64_json, 'image/png');
    if (first?.url) {
      const r = await fetch(first.url, { signal: req.signal });
      return r.blob();
    }
    throw new ProviderError('OpenAI 응답에 이미지가 없습니다.');
  },

  async test(s: ProviderSettings): Promise<string> {
    const res = await callApi(
      joinUrl(s.baseUrl, '/v1/models'),
      { headers: { Authorization: `Bearer ${s.apiKey}` } },
      'OpenAI',
    );
    const json = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = new Set((json.data ?? []).map((m) => m.id));
    return ids.has(s.model) ? `연결됨 · ${s.model} 사용 가능` : `연결됨 · 모델 목록에 ${s.model} 이(가) 보이지 않습니다. 모델 ID를 확인하세요.`;
  },
};
