import type { ReactElement } from 'react';

/** 격자 칸 수. 0 이면 격자 없음 */
export type GridSize = 0 | 3 | 4 | 6;

/**
 * 사진·결과 위에 겹치는 격자. 칸을 보고 스케치북의 같은 칸에 옮겨 그리라고 두는 것이다.
 * `aspect` 를 주면 그 용지 비율의 틀도 함께 그린다 (지금은 쓰지 않지만 인쇄 비율을 볼 때를 위해 남긴다).
 */
export function Overlay({ grid, aspect, imgW, imgH }: { grid: GridSize; aspect: number | null; imgW: number; imgH: number }) {
  let fx = 0, fy = 0, fw = 100, fh = 100;
  if (aspect && imgW && imgH) {
    const imgAspect = imgW / imgH;
    if (aspect < imgAspect) { fw = (aspect / imgAspect) * 100; fx = (100 - fw) / 2; }
    else { fh = (imgAspect / aspect) * 100; fy = (100 - fh) / 2; }
  }
  const lines: ReactElement[] = [];
  if (grid) {
    for (let i = 1; i < grid; i++) {
      const x = fx + (fw * i) / grid, y = fy + (fh * i) / grid;
      lines.push(<line key={`v${i}`} x1={x} y1={fy} x2={x} y2={fy + fh} />);
      lines.push(<line key={`h${i}`} x1={fx} y1={y} x2={fx + fw} y2={y} />);
    }
  }
  return (
    <svg className="grid-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {aspect && (
        <path d={`M0 0H100V100H0Z M${fx} ${fy}H${fx + fw}V${fy + fh}H${fx}Z`} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
      )}
      {aspect && <rect x={fx} y={fy} width={fw} height={fh} fill="none" stroke="#d9a25f" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />}
      <g stroke="rgba(217,162,95,0.85)" strokeWidth="0.25" vectorEffect="non-scaling-stroke">{lines}</g>
    </svg>
  );
}
