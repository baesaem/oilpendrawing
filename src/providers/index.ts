import type { ProviderId, Settings } from '../types';
import type { GenerateRequest, ImageProvider } from './common';
import { geminiProvider } from './gemini';
import { openaiProvider } from './openai';
import { xaiProvider } from './xai';

export { ProviderError } from './common';
export type { GenerateRequest } from './common';

const PROVIDERS: Record<ProviderId, ImageProvider> = {
  gemini: geminiProvider,
  openai: openaiProvider,
  xai: xaiProvider,
};

/** 제공사가 입력 사진을 직접 편집하는지(true) 아니면 묘사→생성 2단계인지(false) */
export const EDITS_INPUT: Record<ProviderId, boolean> = { gemini: true, openai: true, xai: false };

export function generateDrawing(settings: Settings, req: GenerateRequest): Promise<Blob> {
  const s = settings.providers[settings.provider];
  if (!s.apiKey.trim()) return Promise.reject(new Error('API 키가 없습니다. 먼저 키를 연결하세요.'));
  return PROVIDERS[settings.provider].generate(req, s);
}

export function testConnection(settings: Settings, id: ProviderId): Promise<string> {
  const s = settings.providers[id];
  if (!s.apiKey.trim()) return Promise.reject(new Error('API 키를 입력하세요.'));
  return PROVIDERS[id].test(s);
}
