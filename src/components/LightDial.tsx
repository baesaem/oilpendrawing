import { LIGHT_DIRS, LIGHT_LABEL, type LightDir } from '../types';

const ANGLE: Record<LightDir, number> = { N: -90, NE: -45, E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225 };

export function LightDial({ value, onChange }: { value: LightDir; onChange: (d: LightDir) => void }) {
  const R = 54, C = 66;
  const a = (ANGLE[value] * Math.PI) / 180;
  // 구체의 하이라이트 위치: 빛이 오는 쪽
  const hx = 50 + Math.cos(a) * 28, hy = 50 + Math.sin(a) * 28;
  // 그림자: 빛의 반대편
  const sx = C - Math.cos(a) * 26, sy = C - Math.sin(a) * 26 + 4;
  return (
    <div className="dial">
      <svg width="132" height="132" viewBox="0 0 132 132" role="radiogroup" aria-label="빛의 방향">
        <defs>
          <radialGradient id="dial-ball" cx={`${hx}%`} cy={`${hy}%`} r="72%">
            <stop offset="0" stopColor="#f2ede4" />
            <stop offset="0.55" stopColor="#8a8378" />
            <stop offset="1" stopColor="#2a2724" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={60} fill="#1b1a18" stroke="#3a3833" />
        <ellipse cx={sx} cy={sy} rx={22} ry={7} fill="#000" opacity="0.45" />
        <circle cx={C} cy={C} r={24} fill="url(#dial-ball)" />
        {LIGHT_DIRS.map((d) => {
          const ang = (ANGLE[d] * Math.PI) / 180;
          const x = C + Math.cos(ang) * R, y = C + Math.sin(ang) * R;
          const on = d === value;
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
        <b>{LIGHT_LABEL[value]}</b>
        <span className="small muted">8방향 중 선택. 그림자와 해칭 방향이 함께 바뀝니다.</span>
      </div>
    </div>
  );
}
