import { base64ToBlob, blobToBase64 } from '../image';
import type { ProviderSettings } from '../types';
import { callApi, joinUrl, ProviderError, type GenerateRequest, type ImageProvider } from './common';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

/**
 * Gemini API — POST /v1beta/models/{model}:generateContent
 * 텍스트 + inline_data 이미지 파트를 보내고, 응답 parts 에서 inlineData 이미지를 꺼냅니다.
 */
export const geminiProvider: ImageProvider = {
  id: 'gemini',

  async generate(req: GenerateRequest, s: ProviderSettings): Promise<Blob> {
    req.onStatus?.('이미지 인코딩 중…');
    const parts: Array<Record<string, unknown>> = [
      { text: req.prompt },
      { inline_data: { mime_type: req.input.type || 'image/jpeg', data: await blobToBase64(req.input) } },
    ];
    if (req.reference) {
      parts.push({ text: 'Style sample (do not copy its subject):' });
      parts.push({ inline_data: { mime_type: req.reference.type || 'image/png', data: await blobToBase64(req.reference) } });
    }

    req.onStatus?.('Gemini에 생성 요청 중…');
    const res = await callApi(
      joinUrl(s.baseUrl, `/v1beta/models/${encodeURIComponent(s.model)}:generateContent`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
        signal: req.signal,
      },
      'Gemini',
    );

    const json = (await res.json()) as GeminiResponse;
    if (json.promptFeedback?.blockReason) {
      throw new ProviderError(`Gemini가 요청을 차단했습니다: ${json.promptFeedback.blockReason}`);
    }
    const img = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!img) {
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join(' ');
      throw new ProviderError(
        'Gemini 응답에 이미지가 없습니다.' + (text ? ` 모델 답변: ${text.slice(0, 300)}` : ''),
        undefined,
        '이미지 출력을 지원하는 모델 ID인지 확인하세요.',
      );
    }
    return base64ToBlob(img.data, img.mimeType || 'image/png');
  },

  async test(s: ProviderSettings): Promise<string> {
    const res = await callApi(
      joinUrl(s.baseUrl, `/v1beta/models/${encodeURIComponent(s.model)}`),
      { headers: { 'x-goog-api-key': s.apiKey } },
      'Gemini',
    );
    const json = (await res.json()) as { displayName?: string; supportedGenerationMethods?: string[] };
    return `연결됨 · ${json.displayName ?? s.model}`;
  },
};
