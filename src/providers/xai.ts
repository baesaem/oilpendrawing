import { blobToBase64, base64ToBlob } from '../image';
import { DESCRIBE_PROMPT } from '../prompt';
import type { ProviderSettings } from '../types';
import { callApi, joinUrl, ProviderError, type GenerateRequest, type ImageProvider } from './common';

/**
 * xAI — 이미지 생성 API(/v1/images/generations)는 입력 이미지를 받지 않으므로 2단계로 처리합니다.
 *  1) 비전 채팅 모델(/v1/chat/completions)에 사진을 보내 구도·피사체를 상세히 묘사시킴
 *  2) 묘사 + 드로잉 지시문으로 이미지를 생성
 * 원본 구도 재현 정확도는 이미지 편집을 지원하는 제공사보다 낮습니다.
 */
export const xaiProvider: ImageProvider = {
  id: 'xai',

  async generate(req: GenerateRequest, s: ProviderSettings): Promise<Blob> {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` };
    const visionModel = s.visionModel?.trim() || 'grok-4';

    const describe = async (blob: Blob, instruction: string): Promise<string> => {
      const dataUrl = `data:${blob.type || 'image/jpeg'};base64,${await blobToBase64(blob)}`;
      const res = await callApi(
        joinUrl(s.baseUrl, '/v1/chat/completions'),
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: visionModel,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
                  { type: 'text', text: instruction },
                ],
              },
            ],
          }),
          signal: req.signal,
        },
        'xAI',
      );
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) throw new ProviderError('xAI 비전 모델이 묘사를 돌려주지 않았습니다.');
      return text;
    };

    req.onStatus?.('xAI 비전 모델이 사진을 분석 중…');
    const sceneDescription = await describe(req.input, DESCRIBE_PROMPT);

    let styleDescription = '';
    if (req.reference) {
      req.onStatus?.('견본 드로잉 스타일 분석 중…');
      styleDescription = await describe(
        req.reference,
        'Describe only the drawing technique of this pen drawing: line weight, hatching direction and spacing, ' +
          'number of tone steps, how much paper is left untouched, edge treatment. 60 to 100 words. Ignore the subject.',
      );
    }

    const prompt = [
      req.prompt,
      '',
      'The photograph to redraw is described here:',
      sceneDescription,
      styleDescription ? `\nStyle sample technique:\n${styleDescription}` : '',
    ].join('\n');

    req.onStatus?.('xAI에 이미지 생성 요청 중…');
    const res = await callApi(
      joinUrl(s.baseUrl, '/v1/images/generations'),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: s.model, prompt, n: 1, response_format: 'b64_json' }),
        signal: req.signal,
      },
      'xAI',
    );
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const first = json.data?.[0];
    if (first?.b64_json) return base64ToBlob(first.b64_json, 'image/jpeg');
    if (first?.url) {
      const r = await fetch(first.url, { signal: req.signal });
      return r.blob();
    }
    throw new ProviderError('xAI 응답에 이미지가 없습니다.');
  },

  async test(s: ProviderSettings): Promise<string> {
    const res = await callApi(
      joinUrl(s.baseUrl, '/v1/models'),
      { headers: { Authorization: `Bearer ${s.apiKey}` } },
      'xAI',
    );
    const json = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = new Set((json.data ?? []).map((m) => m.id));
    const missing = [s.model, s.visionModel ?? ''].filter((m) => m && !ids.has(m));
    return missing.length
      ? `연결됨 · 모델 목록에 ${missing.join(', ')} 이(가) 보이지 않습니다. 모델 ID를 확인하세요.`
      : '연결됨 · 모델 확인 완료';
  },
};
