import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiKeyDialog } from './components/ApiKeyDialog';
import { PanelIcon } from './components/Icons';
import { InputPanel } from './components/InputPanel';
import { Stage, type ViewMode } from './components/Stage';
import { StylePanel } from './components/StylePanel';
import { StrokePanel } from './components/StrokePanel';
import { StampPanel } from './components/StampPanel';
import { Toolbar, type Mode } from './components/Toolbar';
import { GuideView, type GridSize } from './components/GuideView';
import { FullscreenView } from './components/FullscreenView';
import type { PaperRatio } from './guide';
import type { GuideStep } from './tips';
import { applyTone, downloadBlob, estimateLight, isGrayscale, prepareInput, toneFilter } from './image';
import { analyzeSampleBlob, renderLocalDrawing } from './local';
import { compositeStamps, defaultPlacement, loadStamps, saveStamps, type PlacedStamp, type StampItem, type StampState } from './stamps';
import { buildProcessPrompt, buildPrompt } from './prompt';
import { EDITS_INPUT, generateDrawing } from './providers';
import { listDrawings, loadSettings, putDrawing, saveSettings } from './storage';
import { IS_PREVIEW, PREVIEW_NOTE } from './env';
import {
  DEFAULT_PARAMS, FILL_FOR_STYLE, FINE_STROKES, LEVEL_LABEL, PROVIDER_LABEL, RICHEON_STROKES, blendStrokes, mergeParams, strokesForLevel,
  type Drawing, type DrawingParams, type Settings, type StrokeProfile,
} from './types';

interface UiError { message: string; hint?: string }
interface AnalysisState { busy: boolean; summary: string | null; warning?: string }

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const keyOk = settings.providers[settings.provider].apiKey.trim().length > 0;
  const [keysOpen, setKeysOpen] = useState(false);

  const [params, setParams] = useState<DrawingParams>(DEFAULT_PARAMS);
  const patchParams = useCallback((p: Partial<DrawingParams>) => setParams((prev) => {
    const next = { ...prev, ...p };
    // 화풍을 고르면 로컬 선·톤도 같이 맞춥니다: 작가 스타일은 프리셋 전체, 나머지는 채우기 방식만
    if (p.style === 'richeon') next.strokes = { ...RICHEON_STROKES };
    else if (p.style === 'fineink') next.strokes = { ...FINE_STROKES };
    else {
      const fill = p.style ? FILL_FOR_STYLE[p.style] : undefined;
      if (fill) next.strokes = { ...next.strokes, fill };
    }
    return next;
  }), []);
  const patchStrokes = useCallback((p: Partial<StrokeProfile>) => setParams((prev) => ({ ...prev, strokes: { ...prev.strokes, ...p } })), []);

  const [input, setInput] = useState<File | null>(null);
  const [inputIsGray, setInputIsGray] = useState<boolean | null>(null);
  const [reference, setReference] = useState<File | null>(null);
  /** 견본에서 읽은 선·톤 (반영도로 기본값과 섞어 씀) */
  const [measured, setMeasured] = useState<StrokeProfile | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>({ busy: false, summary: null });

  /** 등록한 낙관·사인과 배치 (이 브라우저에 저장) */
  const [stamps, setStamps] = useState<StampState>(() => loadStamps());
  useEffect(() => { saveStamps(stamps); }, [stamps]);

  const [current, setCurrent] = useState<Drawing | null>(null);
  const [history, setHistory] = useState<Drawing[]>([]);
  const [view, setView] = useState<ViewMode>('original');
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [mode, setMode] = useState<Mode>('draw');
  const [step, setStep] = useState<GuideStep>('compose');
  const [grid, setGrid] = useState<GridSize>(3);
  const [paper, setPaper] = useState<PaperRatio>('photo');
  const [showProcess, setShowProcess] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** 이력에서 불러올 때는 그 레코드의 선·톤을 유지해야 하므로 자동 재설정을 한 번 건너뜁니다 */
  const keepStrokesRef = useRef(false);

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
    // 빛 방향은 사진에서 읽어 다이얼에 표시 (사용자가 돌리기 전까지)
    estimateLight(input).then((light) => alive && setParams((p) => ({ ...p, lightAuto: true, light }))).catch(() => {});
    return () => { alive = false; };
  }, [input]);

  // 견본이 바뀌면 브라우저에서 선·톤을 읽습니다 (API 없음).
  useEffect(() => {
    if (!reference) { setMeasured(null); setAnalysis({ busy: false, summary: null }); return; }
    let alive = true;
    const ac = new AbortController();
    setAnalysis({ busy: true, summary: null });
    analyzeSampleBlob(reference, ac.signal)
      .then((r) => {
        if (!alive) return;
        setMeasured(r.warning ? null : r.profile);
        setAnalysis({ busy: false, summary: r.warning ? null : r.summary, warning: r.warning });
      })
      .catch((e: Error) => alive && setAnalysis({ busy: false, summary: null, warning: e.message }));
    return () => { alive = false; ac.abort(); };
  }, [reference]);

  // 숙련도·견본·반영도가 바뀌면 선·톤 슬라이더를 다시 채웁니다.
  useEffect(() => {
    if (keepStrokesRef.current) { keepStrokesRef.current = false; return; }
    setParams((p) => ({ ...p, strokes: measured ? blendStrokes(strokesForLevel(p.level), measured, p.referenceWeight) : strokesForLevel(p.level) }));
  }, [measured, params.level, params.referenceWeight]);

  const resetStrokes = () => {
    setParams((p) => ({ ...p, strokes: measured ? blendStrokes(strokesForLevel(p.level), measured, p.referenceWeight) : strokesForLevel(p.level) }));
  };

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

  const fail = (e: unknown) => {
    if (e instanceof DOMException && e.name === 'AbortError') setError({ message: '생성을 중단했습니다.' });
    else { const err = e as Error & { hint?: string }; setError({ message: err.message || '알 수 없는 오류', hint: err.hint }); }
  };
  const finish = () => {
    setBusy(null);
    abortRef.current = null;
    // 포커스가 생성 버튼에 남아 있으면 스페이스바가 화면 전환 대신 재생성을 일으키므로 해제합니다.
    (document.activeElement as HTMLElement | null)?.blur?.();
  };
  /** 낙관·사인 배치를 결과에 구워 넣은 레코드 */
  const withStamps = async (d: Drawing, placed: PlacedStamp[], items: StampItem[]): Promise<Drawing> => {
    const base = d.base ?? d.result;
    const result = await compositeStamps(base, placed, items);
    return { ...d, base, result };
  };
  const commit = async (raw: Drawing) => {
    const drawing = await withStamps(raw, stamps.placed, stamps.items);
    await putDrawing(drawing);
    setHistory((h) => [drawing, ...h].slice(0, 30));
    setCurrent(drawing);
    setView('compare');
    if (mode === 'guide') setStep('final');
  };

  /** 기본: 브라우저 로컬 렌더러로 그리기 (API 없음) */
  const drawLocal = async () => {
    if (!input || busy) return;
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      setBusy('그리는 중…');
      const gray = params.grayscaleInput && !inputIsGray;
      const preparedInput = await prepareInput(input, { maxSide: 1536, grayscale: gray, relight: params.lightAuto ? undefined : params.light });
      const preparedRef = reference ? await prepareInput(reference, { maxSide: 1024, grayscale: false }) : undefined;
      const result = await renderLocalDrawing(preparedInput, { strokes: params.strokes, color: params.color }, ac.signal);
      await commit({ id: newId(), createdAt: Date.now(), input: preparedInput, reference: preparedRef, result, params: { ...params }, engine: 'local' });
    } catch (e) { fail(e); } finally { finish(); }
  };

  /** 선택: AI 제공사로 그리기 (API 비용) */
  const drawAi = async () => {
    if (!input || busy) return;
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      setBusy('이미지 준비 중…');
      const gray = params.grayscaleInput && !inputIsGray;
      const preparedInput = await prepareInput(input, { maxSide: 1536, grayscale: gray, relight: params.lightAuto ? undefined : params.light });
      // 로컬 결과가 있고 스위치가 켜져 있으면 그것을 견본으로 (같은 구도라 올린 견본보다 정확히 따름)
      const localRef = params.aiRefFromLocal && current?.engine === 'local' ? current.base ?? current.result : null;
      const preparedRef = localRef
        ? await prepareInput(localRef, { maxSide: 1024, grayscale: false })
        : reference ? await prepareInput(reference, { maxSide: 1024, grayscale: false }) : undefined;
      const prompt = buildPrompt(params, localRef ? 'local' : preparedRef ? 'sample' : 'none');
      const result = await generateDrawing(settings, { input: preparedInput, reference: preparedRef, prompt, signal: ac.signal, onStatus: setBusy });
      await commit({
        id: newId(), createdAt: Date.now(), input: preparedInput, reference: preparedRef, result, params: { ...params },
        engine: 'ai', provider: settings.provider, model: settings.providers[settings.provider].model, prompt,
      });
    } catch (e) { fail(e); } finally { finish(); }
  };

  // 로컬 결과가 떠 있을 때 선·톤이나 색을 바꾸면 잠시 뒤 자동으로 다시 그립니다.
  const liveRef = useRef(0);
  useEffect(() => {
    if (!current || current.engine !== 'local' || busy) return;
    const lightChanged = current.params.lightAuto !== params.lightAuto || (!params.lightAuto && current.params.light !== params.light);
    const same = current.params.color === params.color && JSON.stringify(current.params.strokes) === JSON.stringify(params.strokes) && !lightChanged;
    if (same) return;
    // 빛 방향을 바꾸려면 원본 사진을 다시 조명해야 하는데, 이력에서 불러온 경우엔 원본 파일이 없습니다
    if (lightChanged && !input) return;
    const id = ++liveRef.current;
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      setLive(true);
      try {
        const photo = lightChanged && input
          ? await prepareInput(input, { maxSide: 1536, grayscale: params.grayscaleInput && !inputIsGray, relight: params.lightAuto ? undefined : params.light })
          : current.input;
        const base = await renderLocalDrawing(photo, { strokes: params.strokes, color: params.color }, ac.signal);
        if (id !== liveRef.current) return;
        const result = await compositeStamps(base, stamps.placed, stamps.items);
        const updated: Drawing = { ...current, input: photo, base, result, params: { ...current.params, strokes: params.strokes, color: params.color, light: params.light, lightAuto: params.lightAuto } };
        setCurrent(updated);
        setHistory((h) => h.map((d) => (d.id === updated.id ? updated : d)));
        void putDrawing(updated);
      } catch { /* 중단·오류는 조용히 */ } finally { if (id === liveRef.current) setLive(false); }
    }, 350);
    return () => { window.clearTimeout(timer); ac.abort(); };
  }, [params.strokes, params.color, params.light, params.lightAuto, params.grayscaleInput, inputIsGray, input, current, busy, stamps]);

  // 낙관·사인 배치가 바뀌면 (끌어 놓기 끝, 크기 조절, 추가·제거) 결과에 다시 구워 넣습니다.
  const bakeRef = useRef(0);
  const rebake = useCallback(async () => {
    if (!current) return;
    const id = ++bakeRef.current;
    const updated = await withStamps(current, stamps.placed, stamps.items);
    if (id !== bakeRef.current) return;
    setCurrent(updated);
    setHistory((h) => h.map((d) => (d.id === updated.id ? updated : d)));
    void putDrawing(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, stamps]);
  const stampsKey = JSON.stringify(stamps.placed.map((p) => [p.stampId, p.size]));
  useEffect(() => { void rebake(); /* 추가·제거·크기 */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampsKey, stamps.items]);

  const addStamp = (item: StampItem) => setStamps((s) => ({ ...s, items: [...s.items, item] }));
  const removeStamp = (id: string) => setStamps((s) => ({ items: s.items.filter((i) => i.id !== id), placed: s.placed.filter((p) => p.stampId !== id) }));
  const placeStamp = (item: StampItem) => setStamps((s) => ({ ...s, placed: [...s.placed, defaultPlacement(item, s.placed.filter((p) => s.items.find((i) => i.id === p.stampId)?.kind === item.kind))] }));
  const unplaceStamp = (id: string) => setStamps((s) => ({ ...s, placed: s.placed.filter((p) => p.id !== id) }));
  const resizeStamp = (id: string, size: number) => setStamps((s) => ({ ...s, placed: s.placed.map((p) => (p.id === id ? { ...p, size } : p)) }));
  const moveStamp = (id: string, x: number, y: number) => setStamps((s) => ({ ...s, placed: s.placed.map((p) => (p.id === id ? { ...p, x, y } : p)) }));
  const placedWithItems = stamps.placed
    .map((placed) => ({ placed, item: stamps.items.find((i) => i.id === placed.stampId)! }))
    .filter((x) => x.item);

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
          id: newId(), createdAt: Date.now(), input: photo, result: sheet, process: sheet, params: { ...params },
          engine: 'ai', provider: settings.provider, model: settings.providers[settings.provider].model, prompt,
        };
        await putDrawing(drawing);
        setHistory((h) => [drawing, ...h].slice(0, 30));
        setCurrent(drawing);
      }
      setShowProcess(true);
      setStep('final');
    } catch (e) { fail(e); } finally { finish(); }
  };

  const download = async () => {
    if (!current) return;
    const toned = await applyTone(current.result, params.brightness, params.contrast);
    const stamp = new Date(current.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadBlob(toned, `oilpen-${LEVEL_LABEL[current.params.level]}-${stamp}.png`);
  };

  const selectHistory = (d: Drawing) => {
    keepStrokesRef.current = true;
    setCurrent(d);
    setParams(mergeParams(d.params));
    setView('compare');
  };

  const filter = useMemo(() => toneFilter(params.brightness, params.contrast), [params.brightness, params.contrast]);
  const stageOriginal: Blob | null = current ? current.input : input;
  const providerLabel = PROVIDER_LABEL[settings.provider];

  return (
    <div className="app">
      <div className="stage" />

      <div className="brand">
        <h1>리천 오일펜 드로잉 도우미</h1>
        <span>PHOTO → OIL PEN</span>
      </div>
      {IS_PREVIEW && <div className="preview-banner" title={PREVIEW_NOTE}>미리보기 모드 · AI 생성·저장은 배포판에서 동작합니다</div>}

      <Stage
        original={stageOriginal} result={current ? current.base ?? current.result : null} view={view} busy={busy} live={live} toneFilter={filter} wide={panelsHidden}
        stamps={current ? placedWithItems : []} onStampMove={moveStamp} onStampDrop={() => { void rebake(); }}
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
          analysis={analysis} hasLocal={current?.engine === 'local'} keyOk={keyOk}
        />
        {keyOk && !EDITS_INPUT[settings.provider] && (
          <div className="note">
            {providerLabel}는 사진을 직접 편집하지 못해 사진을 글로 묘사한 뒤 새로 그립니다. AI 결과의 구도가 조금 달라질 수 있습니다.
          </div>
        )}
      </aside>

      <aside className={`panel panel-right ${panelsHidden ? 'panel-hidden' : ''}`} aria-label="표현 설정">
        <StylePanel params={params} onParams={patchParams}>
          <StrokePanel strokes={params.strokes} onChange={patchStrokes} fromSample={!!measured} onReset={resetStrokes} />
        </StylePanel>
        <StampPanel
          items={stamps.items} placed={stamps.placed} hasResult={!!current}
          onAddItem={addStamp} onRemoveItem={removeStamp} onPlace={placeStamp} onUnplace={unplaceStamp} onResize={resizeStamp}
        />
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
        canDraw={!!input && !busy} onDraw={drawLocal}
        canAi={!!input && keyOk && !busy} onAi={drawAi}
        busy={!!busy} onCancel={cancel} onDownload={download}
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
        <ApiKeyDialog settings={settings} onSave={onSaveSettings} onClose={() => setKeysOpen(false)} canClose />
      )}
    </div>
  );
}
