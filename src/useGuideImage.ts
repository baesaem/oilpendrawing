import { useEffect, useMemo, useState } from 'react';
import { edgeMap, valueMap } from './guide';
import type { GuideStep } from './tips';
import type { Level } from './types';

interface Args {
  photo: Blob;
  result: Blob | null;
  process: Blob | null;
  showProcess: boolean;
  step: GuideStep;
  level: Level;
}

/** 가이드 단계별로 보여 줄 이미지 (2·3단계는 사진에서 계산) — 가이드 화면과 전체화면이 함께 씁니다 */
export function useGuideImage({ photo, result, process, showProcess, step, level }: Args): { blob: Blob | null; working: boolean } {
  const [derived, setDerived] = useState<{ key: string; blob: Blob } | null>(null);
  const [working, setWorking] = useState(false);
  const key = `${step}-${level}`;

  useEffect(() => {
    if (step !== 'shape' && step !== 'value') return;
    let alive = true;
    setWorking(true);
    const job = step === 'shape' ? edgeMap(photo, level) : valueMap(photo, level);
    job.then((blob) => alive && setDerived({ key, blob })).finally(() => alive && setWorking(false));
    return () => { alive = false; };
  }, [step, photo, level, key]);

  const blob = useMemo<Blob | null>(() => {
    switch (step) {
      case 'compose': return photo;
      case 'shape':
      case 'value': return derived?.key === key ? derived.blob : null;
      case 'final': return showProcess && process ? process : result ?? photo;
    }
  }, [step, photo, result, process, showProcess, derived, key]);

  return { blob, working };
}
