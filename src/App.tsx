import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiKeyDialog } from './components/ApiKeyDialog';
import { PanelIcon } from './components/Icons';
import { InputPanel } from './components/InputPanel';
import { Stage, type ViewMode } from './components/Stage';
import { StylePanel } from './components/StylePanel';
import { Toolbar, type Mode } from './components/Toolbar';
import { GuideView, type GridSize } from './components/GuideView';
import { FullscreenView } from './components/FullscreenView';
import type { PaperRatio } from './guide';
import type { GuideStep } from './tips';
import { applyTone, downloadBlob, isGrayscale, prepareInput, toneFilter } from './image';
import { buildProcessPrompt, buildPrompt } from './prompt';
import { EDITS_INPUT, generateDrawing } from './providers';
import { listDrawings, loadSettings, putDrawing, saveSettings } from './storage';
import { IS_PREVIEW, PREVIEW_NOTE } from './env';
import { DEFAULT_PARAMS, LEVEL_LABEL, PROVIDER_LABEL, type Drawing, type DrawingParams, type Settings } from './types';

interface UiError { message: string; hint?: string }

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const keyOk = settings.providers[settings.provider].apiKey.trim().length > 0;
  const [keysOpen, setKeysOpen] = useState(!keyOk);

  const [params, setParams] = useState<DrawingParams>(DEFAULT_PARAMS);
  const patchParams = useCallback((p: Partial<DrawingParams>) => setParams((prev) => ({ ...prev, ...p })), []);

  const [input, setInput] = useState<File | null>(null);
  const [inputIsGray, setInputIsGray] = useState<boolean | null>(null);
  const [reference, setReference] = useState<File | null>(null);

  const [current, setCurrent] = useState<Drawing | null>(null);
  const [history, setHistory] = useState<Drawing[]>([]);
  const [view, setView] = useState<ViewMode>('original');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [mode, setMode] = useState<Mode>('draw');
  const [step, setStep] = useState<GuideStep>('compose');
  const [grid, setGrid] = useState<GridSize>(3);
  const [paper, setPaper] = useState<PaperRatio>('photo');
  const [showProcess, setShowProcess] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { listDrawings().then(setHistory); }, []);

  // 원본이 바뀌면 흑백 여부를 판별하고 이전 결과는 내립니다.
  useEffect(() => {
    setCurrent(null);
    setView('original');
    setStep('compose');
    setShowProcess(false);
    if (!input) { setInputIsGray(null); setMode('draw'); return; }
    let alive = true;
    setInputIsGray(null);
    isGrayscale(input).then((g) => alive && setInputIsGray(g)).catch(() => alive && setInputIsGray(false));
    return () => { alive = false; };
  }, [input]);

  // 스페이스: 결과 ↔ 원본 전환, H: 패널 숨기기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
      if (keysOpen) return;
      if (e.code === 'Space' && current) {
        e.preventDefault();
        setView((v) => (v === 'result' ? 'original' : 'result'));
      } else if (e.key === 'h' || e.key === 'H') {
        setPanelsHidden((h) => !h);
      } else if (e.key === 'f' || e.key === 'F') {
        setFullscreen((f) => !f);
      } else if (e.key === 'Escape') {
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, keysOpen]);

  const onSaveSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
    setKeysOpen(false);
  };

  const generate = async () => {
    if (!input || busy) return;
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      setBusy('이미지 준비 중…');
      const gray = params.grayscaleInput && !inputIsGray;
      const preparedInput = await prepareInput(input, { maxSide: 1536, grayscale: gray });
      const preparedRef = reference ? await prepareInput(reference, { maxSide: 1024, grayscale: false }) : undefined;
      const prompt = buildPrompt(params, !!preparedRef);

      const result = await generateDrawing(settings, {
        input: preparedInput,
        reference: preparedRef,
        prompt,
        signal: ac.signal,
        onStatus: setBusy,
      });

      const drawing: Drawing = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        input: preparedInput,
        reference: preparedRef,
        result,
        params: { ...params },
        provider: settings.provider,
        model: settings.providers[settings.provider].model,
        prompt,
      };
      await putDrawing(drawing);
      setHistory((h) => [drawing, ...h].slice(0, 30));
      setCurrent(drawing);
      setView('compare');
      if (mode === 'guide') setStep('final');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setError({ message: '생성을 중단했습니다.' });
      } else {
        const err = e as Error & { hint?: string };
        setError({ message: err.message || '알 수 없는 오류', hint: err.hint });
      }
    } finally {
      setBusy(null);
      abortRef.current = null;
      // 포커스가 생성 버튼에 남아 있으면 스페이스바가 화면 전환 대신 재생성을 일으키므로 해제합니다.
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };

  const cancel = () => abortRef.current?.abort();

  /** 4단계 과정을 한 장으로 그려 달라고 요청 (API 1회) */
  const makeProcess = async () => {
    if (!input || busy) return;
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      setBusy('이미지 준비 중…');
      const photo = current?.input ?? (await prepareInput(input, { maxSide: 1536, grayscale: params.grayscaleInput && !inputIsGray }));
      const prompt = buildProcessPrompt(params, !!current);
      const sheet = await generateDrawing(settings, {
        input: photo, reference: current?.result, prompt, signal: ac.signal, onStatus: setBusy,
      });
      if (current) {
        const updated: Drawing = { ...current, process: sheet };
        await putDrawing(updated);
        setCurrent(updated);
        setHistory((h) => h.map((d) => (d.id === updated.id ? updated : d)));
      } else {
        const drawing: Drawing = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: Date.now(), input: photo, result: sheet, process: sheet,
          params: { ...params }, provider: settings.provider, model: settings.providers[settings.provider].model, prompt,
        };
        await putDrawing(drawing);
        setHistory((h) => [drawing, ...h].slice(0, 30));
        setCurrent(drawing);
      }
      setShowProcess(true);
      setStep('final');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setError({ message: '생성을 중단했습니다.' });
      else { const err = e as Error & { hint?: string }; setError({ message: err.message || '알 수 없는 오류', hint: err.hint }); }
    } finally {
      setBusy(null);
      abortRef.current = null;
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };

  const download = async () => {
    if (!current) return;
    const toned = await applyTone(current.result, params.brightness, params.contrast);
    const stamp = new Date(current.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadBlob(toned, `oilpen-${LEVEL_LABEL[current.params.level]}-${stamp}.png`);
  };

  const selectHistory = (d: Drawing) => {
    setCurrent(d);
    setParams({ ...DEFAULT_PARAMS, ...d.params });
    setView('compare');
  };

  const filter = useMemo(() => toneFilter(params.brightness, params.contrast), [params.brightness, params.contrast]);
  const stageOriginal: Blob | null = current ? current.input : input;
  const providerLabel = PROVIDER_LABEL[settings.provider];

  return (
    <div className="app">
      <div className="stage" />

      <div className="brand">
        <h1>오일펜 드로잉</h1>
        <span>PHOTO → OIL PEN</span>
      </div>
      {IS_PREVIEW && <div className="preview-banner" title={PREVIEW_NOTE}>미리보기 모드 · AI 생성·저장은 배포판에서 동작합니다</div>}

      <Stage
        original={stageOriginal} result={current?.result ?? null} view={view} busy={busy} toneFilter={filter} wide={panelsHidden}
        guide={mode === 'guide' && stageOriginal ? (
          <GuideView
            photo={stageOriginal} result={current?.result ?? null} process={current?.process ?? null} params={params}
            step={step} onStep={setStep} grid={grid} onGrid={setGrid} paper={paper} onPaper={setPaper}
            showProcess={showProcess} onShowProcess={setShowProcess} onMakeProcess={makeProcess} busy={busy} keyOk={keyOk}
          />
        ) : undefined}
      />

      <aside className={`panel panel-left ${panelsHidden ? 'panel-hidden' : ''}`} aria-label="입력">
        <InputPanel
          input={input} reference={reference} inputIsGray={inputIsGray}
          params={params} onParams={patchParams}
          onInput={setInput} onReference={setReference}
        />
        {!EDITS_INPUT[settings.provider] && (
          <div className="note">
            {providerLabel}는 사진을 직접 편집하지 못해 사진을 글로 묘사한 뒤 새로 그립니다. 구도가 조금 달라질 수 있습니다.
          </div>
        )}
      </aside>

      <aside className={`panel panel-right ${panelsHidden ? 'panel-hidden' : ''}`} aria-label="표현 설정">
        <StylePanel params={params} onParams={patchParams} />
      </aside>

      {panelsHidden && (
        <>
          <button className="panel-toggle left" onClick={() => setPanelsHidden(false)} title="패널 보이기 (H)"><PanelIcon /></button>
          <button className="panel-toggle right" onClick={() => setPanelsHidden(false)} title="패널 보이기 (H)"><PanelIcon /></button>
        </>
      )}

      {error && (
        <div className="error-toast" role="alert">
          <div>
            <div>{error.message}</div>
            {error.hint && <div className="hint">{error.hint}</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)} aria-label="닫기">닫기</button>
        </div>
      )}

      <Toolbar
        mode={mode} onMode={setMode} hasPhoto={!!stageOriginal}
        providerLabel={providerLabel} keyOk={keyOk} onOpenKeys={() => setKeysOpen(true)}
        view={view} onView={setView} hasResult={!!current}
        history={history} currentId={current?.id ?? null} onSelect={selectHistory}
        canGenerate={!!input && keyOk && !busy} busy={!!busy}
        onGenerate={generate} onCancel={cancel} onDownload={download}
        onFullscreen={() => setFullscreen(true)}
      />

      {fullscreen && stageOriginal && (
        <FullscreenView
          mode={mode} photo={stageOriginal} result={current?.result ?? null} process={current?.process ?? null} showProcess={showProcess}
          params={params} step={step} onStep={setStep} grid={grid} onGrid={setGrid} paper={paper}
          showResult={view !== 'original'} onToggleResult={() => setView((v) => (v === 'original' ? 'result' : 'original'))}
          toneFilter={filter} onClose={() => setFullscreen(false)}
        />
      )}

      {keysOpen && (
        <ApiKeyDialog settings={settings} onSave={onSaveSettings} onClose={() => setKeysOpen(false)} canClose={keyOk} />
      )}
    </div>
  );
}
