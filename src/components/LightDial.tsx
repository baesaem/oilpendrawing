import { LIGHT_DIRS, LIGHT_LABEL, type CompassDir, type LightDir } from '../types';

const ANGLE: Record<CompassDir, number> = { N: -90, NE: -45, E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225 };

/** 다이얼 아래 세 버튼: 원본(사진 그대로) · 앞에서(정면광) · 뒤에서(역광) */
const MODES: { key: 'auto' | 'front' | 'back'; label: string; hint: string }[] = [
  { key: 'auto', label: '원본', hint: '사진의 빛을 그대로 씁니다' },
  { key: 'front', label: '앞에서', hint: '정면광 — 그림자가 옅고 고르게 밝습니다' },
  { key: 'back', label: '뒤에서', hint: '역광 — 안쪽이 어둡고 테두리가 밝습니다' },
];

export function LightDial({ value, auto, onChange, onAuto }: { value: LightDir; auto: boolean; onChange: (d: LightDir) => void; onAuto: () => void }) {
  const R = 54, C = 66;
  const flat = value === 'front' || value === 'back';
  const a = (ANGLE[flat ? 'NW' : (value as CompassDir)] * Math.PI) / 180;
  // 구체의 하이라이트 위치: 빛이 오는 쪽. 정면광은 가운데, 역광은 뒤(=가장자리만 밝다)
  const hx = flat ? 50 : 50 + Math.cos(a) * 28, hy = value === 'front' ? 46 : flat ? 50 : 50 + Math.sin(a) * 28;
  // 그림자: 빛의 반대편. 정면광은 발밑에 조금, 역광은 앞(아래)으로 길게
  const sx = flat ? C : C - Math.cos(a) * 26, sy = flat ? C + 30 : C - Math.sin(a) * 26 + 4;
  const stops: [number, string][] = value === 'back'
    ? [[0, '#2e2b27'], [0.72, '#3c3831'], [1, '#efe7d8']]
    : value === 'front'
      ? [[0, '#efe9de'], [0.7, '#c6bfb1'], [1, '#6f6960']]
      : [[0, '#f2ede4'], [0.55, '#8a8378'], [1, '#2a2724']];
  return (
    <div className="dial-block">
    <div className="dial">
      <svg width="132" height="132" viewBox="0 0 132 132" role="radiogroup" aria-label="빛의 방향">
        <defs>
          <radialGradient id="dial-ball" cx={`${hx}%`} cy={`${hy}%`} r="72%">
            {stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={60} fill="#1b1a18" stroke="#3a3833" />
        <ellipse cx={sx} cy={sy} rx={flat ? 17 : 22} ry={flat ? 5 : 7} fill="#000" opacity={value === 'front' ? 0.28 : 0.45} />
        <circle cx={C} cy={C} r={24} fill="url(#dial-ball)" />
        {LIGHT_DIRS.map((d) => {
          const ang = (ANGLE[d] * Math.PI) / 180;
          const x = C + Math.cos(ang) * R, y = C + Math.sin(ang) * R;
          const on = !auto && !flat && d === value;
          return (
            <g key={d} onClick={() => onChange(d)} role="radio" aria-checked={on} aria-label={LIGHT_LABEL[d]} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={12} fill="transparent" />
              <circle cx={x} cy={y} r={on ? 7 : 4} fill={on ? '#d9a25f' : '#5a564e'} stroke={on ? '#161513' : 'none'} strokeWidth={2} />
            </g>
          );
        })}
      </svg>
      <div className="dial-label">
        <span className="small" style={{ fontWeight: 500 }}>빛의 방향</span>
        <b>{auto ? '원본' : LIGHT_LABEL[value]}</b>
        <span className="small muted">
          {auto
            ? '사진의 빛을 그대로 씁니다. 아래에서 정면광·역광을 고르거나 점을 눌러 방향을 바꿉니다.'
            : flat
              ? MODES.find((m) => m.key === value)!.hint + '. 사진을 그렇게 다시 조명해서 로컬·AI 양쪽에 보냅니다.'
              : '사진을 이 방향의 빛으로 다시 조명해서 로컬·AI 양쪽에 보냅니다.'}
        </span>
      </div>
    </div>
    <div className="seg light-modes" role="group" aria-label="빛의 종류">
      {MODES.map((m) => {
        const on = m.key === 'auto' ? auto : !auto && value === m.key;
        return (
          <button key={m.key} type="button" className={on ? 'on' : ''} title={m.hint}
            onClick={() => (m.key === 'auto' ? onAuto() : onChange(m.key))}>{m.label}</button>
        );
      })}
    </div>
    </div>
  );
}
