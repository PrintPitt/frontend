// Tukang fotokopi: kepala besar, topi warna toko, celemek kertas. Digambar menghadap kamera arena.
import { PALET, TINTA, type NamaPalet } from './kamera';

export type Bawaan = 'kertas' | 'ktp' | 'ijazah' | 'menu' | null;

export default function Karakter({
  warna,
  bawa = null,
  arah = 1,
  jalan = false,
  ukuran = 64,
  cincin = true,
}: {
  warna: NamaPalet;
  bawa?: Bawaan;
  arah?: 1 | -1;
  jalan?: boolean;
  ukuran?: number;
  cincin?: boolean;
}) {
  const p = PALET[warna];
  const kulit = '#f1c9a5';
  return (
    <svg
      className={`karakter ${jalan ? 'jalan' : ''}`}
      width={ukuran}
      height={ukuran * 1.3}
      viewBox="-32 -78 64 84"
      style={{ transform: `scaleX(${arah})` }}
    >
      {cincin && <ellipse cx={0} cy={0} rx={24} ry={9} fill="none" stroke={p.m} strokeWidth={4} opacity={0.9} />}
      <ellipse cx={0} cy={0} rx={17} ry={6} fill="#00000033" />
      <g className="badan">
        {/* kaki */}
        <rect x={-10} y={-12} width={8} height={11} rx={3} fill="#3d3935" stroke={TINTA} strokeWidth={2} />
        <rect x={2} y={-12} width={8} height={11} rx={3} fill="#3d3935" stroke={TINTA} strokeWidth={2} />
        {/* badan + celemek */}
        <rect x={-15} y={-38} width={30} height={30} rx={11} fill={p.m} stroke={TINTA} strokeWidth={2.2} />
        <path d="M-9 -34 h18 v20 a5 5 0 0 1 -5 5 h-8 a5 5 0 0 1 -5 -5 z" fill="#fbfaf3" stroke={TINTA} strokeWidth={1.8} />
        <rect x={-4} y={-26} width={8} height={6} rx={1.5} fill="none" stroke={TINTA} strokeWidth={1.4} />
        {/* tangan */}
        <circle cx={-17} cy={-22} r={5} fill={kulit} stroke={TINTA} strokeWidth={2} />
        <circle cx={17} cy={-22} r={5} fill={kulit} stroke={TINTA} strokeWidth={2} />
        {/* kepala */}
        <circle cx={0} cy={-52} r={17} fill={kulit} stroke={TINTA} strokeWidth={2.2} />
        <circle cx={-6} cy={-50} r={2.2} fill={TINTA} />
        <circle cx={6} cy={-50} r={2.2} fill={TINTA} />
        <ellipse cx={-10} cy={-45} rx={3.5} ry={2.2} fill="#ef6a4c55" />
        <ellipse cx={10} cy={-45} rx={3.5} ry={2.2} fill="#ef6a4c55" />
        <path d="M-4 -43 q4 3 8 0" fill="none" stroke={TINTA} strokeWidth={1.8} strokeLinecap="round" />
        {/* topi toko */}
        <path d="M-17 -56 a17 15 0 0 1 34 0 z" fill={p.l} stroke={TINTA} strokeWidth={2.2} />
        <path d="M-2 -57 h24 a4 4 0 0 1 0 6 h-22 z" fill={p.d} stroke={TINTA} strokeWidth={2} />
        <circle cx={-3} cy={-69} r={3} fill={p.d} stroke={TINTA} strokeWidth={1.6} />
        {/* bawaan di tangan */}
        {bawa && (
          <g transform="translate(0 -20)">
            {bawa === 'kertas' && <rect x={-13} y={-6} width={26} height={14} rx={1.5} fill="#fbfaf3" stroke={TINTA} strokeWidth={1.8} />}
            {bawa === 'ktp' && (
              <g>
                <rect x={-13} y={-7} width={26} height={16} rx={2.5} fill="#76a0e2" stroke={TINTA} strokeWidth={1.8} />
                <rect x={-10} y={-4} width={7} height={9} rx={1} fill="#fbfaf3" stroke={TINTA} strokeWidth={1.2} />
                <path d="M0 -3 h9 M0 1 h9 M0 5 h6" stroke={TINTA} strokeWidth={1.4} />
              </g>
            )}
            {bawa === 'ijazah' && (
              <g>
                <rect x={-14} y={-7} width={28} height={16} rx={1.5} fill="#fbfaf3" stroke={TINTA} strokeWidth={1.8} />
                <circle cx={8} cy={4} r={3.5} fill="#ef6a4c" stroke={TINTA} strokeWidth={1.2} />
              </g>
            )}
            {bawa === 'menu' && (
              <g>
                <rect x={-12} y={-8} width={24} height={17} rx={2} fill="#93d3b0" stroke={TINTA} strokeWidth={1.8} />
                <path d="M-7 -3 h14 M-7 1 h14 M-7 5 h9" stroke={TINTA} strokeWidth={1.4} />
              </g>
            )}
          </g>
        )}
      </g>
    </svg>
  );
}
