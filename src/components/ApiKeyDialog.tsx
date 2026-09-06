import { useState } from 'react';
import { listModels, testConnection, type ModelLists } from '../providers';
import { DEFAULT_PROVIDER_SETTINGS, PROVIDER_LABEL, type ProviderId, type ProviderSettings, type Settings } from '../types';
import { CloseIcon } from './Icons';
import { IS_PREVIEW, PREVIEW_NOTE } from '../env';

const IDS: ProviderId[] = ['gemini', 'openai', 'xai'];
const KEY_HELP: Record<ProviderId, string> = {
  gemini: 'Google AI Studio에서 발급한 키를 붙여넣으세요. 이미지 출력을 지원하는 모델이어야 합니다.',
  openai: 'OpenAI 플랫폼에서 발급한 키를 붙여넣으세요. 이미지 편집(images/edits)을 지원하는 모델이어야 합니다.',
  xai: 'xAI 콘솔에서 발급한 키를 붙여넣으세요. xAI는 사진을 직접 편집하지 못해 "묘사 → 생성" 2단계로 동작하므로 원본 구도 재현이 덜 정확합니다.',
};

interface Props {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
  canClose: boolean;
}

export function ApiKeyDialog({ settings, onSave, onClose, canClose }: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // 고급을 펼치면 계정에서 쓸 수 있는 모델 목록을 불러와 드롭다운으로 고르게 한다
  const [models, setModels] = useState<Partial<Record<ProviderId, ModelLists>>>({});
  const [listing, setListing] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);

  const id = draft.provider;
  const ps = draft.providers[id];
  const patch = (p: Partial<ProviderSettings>) =>
    setDraft((d) => ({ ...d, providers: { ...d.providers, [id]: { ...d.providers[id], ...p } } }));

  /** 모델 목록 불러오기 (키가 있어야 한다). 제공사가 CORS 로 막으면 오류만 보여 주고 직접 입력으로 쓴다 */
  const loadModels = async () => {
    if (!ps.apiKey.trim() || listing) return;
    setListing(true);
    setListErr(null);
    try {
      const got = await listModels(draft, id);
      setModels((m) => ({ ...m, [id]: got }));
    } catch (e) {
      setListErr((e as Error).message);
    } finally {
      setListing(false);
    }
  };

  /** 드롭다운 목록: 불러온 목록 + 지금 값 + 기본값 (중복 없이) */
  const choices = (kind: 'image' | 'vision') => {
    const got = models[id]?.[kind] ?? [];
    const now = kind === 'image' ? ps.model : ps.visionModel ?? '';
    const fallback = kind === 'image' ? DEFAULT_PROVIDER_SETTINGS[id].model : DEFAULT_PROVIDER_SETTINGS[id].visionModel ?? '';
    return [...new Set([...got, now, fallback].filter(Boolean))];
  };

  const runTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const text = await testConnection(draft, id);
      setTestMsg({ ok: true, text });
    } catch (e) {
      const err = e as Error & { hint?: string };
      setTestMsg({ ok: false, text: err.message + (err.hint ? ` — ${err.hint}` : '') });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={canClose ? onClose : undefined}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="keys-title" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div className="small faint" style={{ letterSpacing: '.08em' }}>선택 기능</div>
            <h2 id="keys-title">AI 로도 그려 보기</h2>
          </div>
          {canClose && <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="닫기"><CloseIcon /></button>}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          키 없이도 "드로잉 만들기"는 동작합니다. AI 제공사의 다른 해석을 보고 싶을 때만 키를 넣으세요.
          키는 이 브라우저에만 저장되고, 요청은 브라우저에서 제공사 API로 직접 보냅니다.
        </p>
        {IS_PREVIEW && <div className="note preview-note">미리보기 모드 · {PREVIEW_NOTE} 키를 넣지 않아도 "저장하고 시작"을 누르면 화면을 둘러볼 수 있습니다.</div>}

        <div className="field">
          <div className="field-row"><b>이미지 생성 제공사</b></div>
          <div className="tabs" role="tablist">
            {IDS.map((p) => (
              <button key={p} role="tab" aria-selected={p === id} className={p === id ? 'on' : ''} onClick={() => { setDraft((d) => ({ ...d, provider: p })); setTestMsg(null); }}>
                {PROVIDER_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="small muted">{KEY_HELP[id]}</div>
        </div>

        <div className="field">
          <div className="field-row"><b>API 키</b><button className="link" onClick={() => setShow((s) => !s)}>{show ? '숨기기' : '표시'}</button></div>
          <input
            className="text-input mono" type={show ? 'text' : 'password'} value={ps.apiKey} autoComplete="off" spellCheck={false}
            placeholder={id === 'openai' ? 'sk-…' : id === 'xai' ? 'xai-…' : 'AIza…'}
            onChange={(e) => { patch({ apiKey: e.target.value.trim() }); setTestMsg(null); }}
          />
        </div>

        <details className="advanced" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open && !models[id]) void loadModels(); }}>
          <summary>고급: 모델 고르기 · 기본 URL</summary>
          <div className="field" style={{ marginBottom: 10 }}>
            <div className="field-row">
              <b>모델 목록</b>
              <button className="link" onClick={loadModels} disabled={listing || !ps.apiKey.trim()}>
                {listing ? '불러오는 중…' : models[id] ? '다시 불러오기' : '목록 불러오기'}
              </button>
            </div>
            <div className="small faint">
              {listErr
                ? `목록을 못 불러왔습니다: ${listErr} — 아래에 모델 ID를 직접 넣어도 됩니다.`
                : models[id]
                  ? `${PROVIDER_LABEL[id]} 계정에서 쓸 수 있는 모델입니다. 목록에 없으면 직접 입력하세요.`
                  : 'API 키를 넣고 누르면 계정에서 쓸 수 있는 모델을 불러옵니다.'}
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <div className="field-row"><b>이미지 모델</b></div>
              <select className="text-input select mono" value={choices('image').includes(ps.model) ? ps.model : ''} aria-label="이미지 모델"
                onChange={(e) => { if (e.target.value) patch({ model: e.target.value }); }}>
                {choices('image').map((m) => <option key={m} value={m}>{m}</option>)}
                {!choices('image').includes(ps.model) && <option value="">{ps.model || '(직접 입력)'}</option>}
              </select>
              <input className="text-input mono" value={ps.model} onChange={(e) => patch({ model: e.target.value.trim() })} spellCheck={false} aria-label="이미지 모델 직접 입력" />
            </div>
            {id === 'xai' && (
              <div className="field">
                <div className="field-row"><b>비전 모델 (사진 묘사용)</b></div>
                <select className="text-input select mono" value={choices('vision').includes(ps.visionModel ?? '') ? ps.visionModel : ''} aria-label="비전 모델"
                  onChange={(e) => { if (e.target.value) patch({ visionModel: e.target.value }); }}>
                  {choices('vision').map((m) => <option key={m} value={m}>{m}</option>)}
                  {!choices('vision').includes(ps.visionModel ?? '') && <option value="">{ps.visionModel || '(직접 입력)'}</option>}
                </select>
                <input className="text-input mono" value={ps.visionModel ?? ''} onChange={(e) => patch({ visionModel: e.target.value.trim() })} spellCheck={false} aria-label="비전 모델 직접 입력" />
              </div>
            )}
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <div className="field-row"><b>API 기본 URL</b></div>
              <input className="text-input mono" value={ps.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value.trim() })} spellCheck={false} />
              <div className="small faint">제공사가 모델 이름을 바꿨거나 브라우저 직접 호출을 막는 경우 여기서 조정합니다.</div>
            </div>
          </div>
        </details>

        <button className="toggle" role="switch" aria-checked={draft.rememberKeys} onClick={() => setDraft((d) => ({ ...d, rememberKeys: !d.rememberKeys }))}>
          <span>이 기기에 기억하기 <span className="faint">· 공용 PC라면 끄세요</span></span>
          <span className={`switch ${draft.rememberKeys ? 'on' : ''}`} />
        </button>

        <div className={`test-result ${testMsg ? (testMsg.ok ? 'ok' : 'bad') : ''}`}>{testMsg?.text}</div>

        <div className="dialog-actions">
          <button className="btn" onClick={runTest} disabled={testing || !ps.apiKey}>{testing ? '확인 중…' : '연결 확인'}</button>
          <button className="btn btn-primary" onClick={() => onSave(IS_PREVIEW && !ps.apiKey ? { ...draft, providers: { ...draft.providers, [id]: { ...ps, apiKey: 'preview' } } } : draft)} disabled={!ps.apiKey && !IS_PREVIEW}>저장하고 시작</button>
        </div>
      </div>
    </div>
  );
}
