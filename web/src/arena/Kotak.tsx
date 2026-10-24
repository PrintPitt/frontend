// Balok 3D sederhana (meja, dinding, rak) dalam kamera arena: tampak sisi atas + sisi depan.
import type { ReactNode } from 'react';
import { CP, px, py, SP, TINTA, UNIT, zIndex } from './kamera';

export type PropsKotak = {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  z?: number;
  atas: string;
  depan: string;
  /** Lapisan tambahan (dekorasi) di permukaan atas, koordinat px relatif ke sisi atas. */
  children?: ReactNode;
  lapis?: number;
  className?: string;
};

export default function Kotak({ x, y, w, d, h, z = 0, atas, depan, children, lapis, className }: PropsKotak) {
  const W = px(w);
  const tAtas = d * SP * UNIT;
  const tDepan = h * CP * UNIT;
  return (
    <div
      className={`kotak ${className ?? ''}`}
      style={{ left: px(x), top: py(y, z + h), width: W, height: tAtas + tDepan, zIndex: lapis ?? zIndex(y + d) }}
    >
      <svg width={W} height={tAtas + tDepan} viewBox={`-1 -1 ${W + 2} ${tAtas + tDepan + 2}`} style={{ overflow: 'visible' }}>
        <rect x={0} y={tAtas} width={W} height={tDepan} rx={3} fill={depan} stroke={TINTA} strokeWidth={2} />
        <rect x={0} y={tAtas + tDepan * 0.82} width={W} height={tDepan * 0.18} fill="#00000026" />
        <rect x={0} y={0} width={W} height={tAtas} rx={3} fill={atas} stroke={TINTA} strokeWidth={2} />
        <line x1={4} y1={3} x2={W - 4} y2={3} stroke="#ffffff66" strokeWidth={2} strokeLinecap="round" />
      </svg>
      {children && (
        <div className="kotak-atas" style={{ height: tAtas }}>
          {children}
        </div>
      )}
    </div>
  );
}
