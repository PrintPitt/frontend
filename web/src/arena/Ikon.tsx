// Ink-style order and step icons (for order tickets and the HUD).
import { TINTA } from './kamera';

export type JenisOrder = 'ktp' | 'boarding' | 'ijazah' | 'menu';
export const JENIS_DARI_KATALOG: Record<number, JenisOrder> = { 1: 'ktp', 2: 'boarding', 3: 'ijazah', 4: 'menu' };

const s = { stroke: TINTA, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export function IkonOrder({ jenis, ukuran = 44 }: { jenis: JenisOrder; ukuran?: number }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 48 48">
      {jenis === 'ktp' && (
        <g {...s}>
          <rect x={4} y={10} width={40} height={28} rx={4} fill="#76a0e2" />
          <rect x={9} y={15} width={11} height={14} rx={2} fill="#fbfaf3" strokeWidth={1.6} />
          <path d="M25 17 h14 M25 23 h14 M25 29 h9" strokeWidth={2.2} />
        </g>
      )}
      {jenis === 'boarding' && (
        <g {...s}>
          <path d="M4 12 h40 v8 a4 4 0 0 0 0 8 v8 h-40 v-8 a4 4 0 0 0 0 -8 z" fill="#f4b829" />
          <path d="M33 13 v22" strokeDasharray="3 3" strokeWidth={1.6} />
          <path d="M11 26 l6 -2 l6 -7 l2 1 l-3 7 l6 -1 l2 -2 l2 1 l-2 4 l-15 4 z" fill="#fbfaf3" strokeWidth={1.4} />
        </g>
      )}
      {jenis === 'ijazah' && (
        <g {...s}>
          <rect x={5} y={9} width={38} height={30} rx={2} fill="#fbfaf3" />
          <path d="M11 16 h26 M11 22 h20 M11 28 h14" strokeWidth={1.8} />
          <circle cx={34} cy={31} r={6} fill="#ef6a4c" />
          <path d="M31 36 l-2 8 l5 -3 l5 3 l-2 -8" fill="#ef6a4c" strokeWidth={1.6} />
        </g>
      )}
      {jenis === 'menu' && (
        <g {...s}>
          <rect x={9} y={5} width={30} height={38} rx={3} fill="#93d3b0" />
          <path d="M15 14 h18 M15 21 h18 M15 28 h18 M15 35 h11" strokeWidth={1.8} />
          <rect x={6} y={5} width={36} height={38} rx={4} fill="none" stroke="#ffffff88" strokeWidth={0} />
        </g>
      )}
    </svg>
  );
}

export function IkonLangkah({ kode, ukuran = 22 }: { kode: number; ukuran?: number }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 24 24">
      {kode === 1 && (
        <g {...s} strokeWidth={1.6}>
          <rect x={3} y={8} width={18} height={13} rx={2} fill="#5a82c6" />
          <rect x={3} y={4} width={18} height={4} rx={1} fill="#c6ccce" />
          <rect x={6} y={13} width={12} height={4} rx={1} fill="#fbfaf3" />
        </g>
      )}
      {kode === 2 && (
        <g {...s} strokeWidth={1.6}>
          <rect x={7} y={2} width={10} height={7} fill="#fbfaf3" />
          <rect x={2} y={8} width={20} height={9} rx={2} fill="#836ef9" />
          <rect x={7} y={14} width={10} height={8} fill="#fbfaf3" />
        </g>
      )}
      {kode === 3 && (
        <g {...s} strokeWidth={1.6}>
          <rect x={3} y={6} width={18} height={13} rx={2} fill="#e4f2f4" />
          <rect x={6} y={9} width={12} height={7} rx={1} fill="#f4b829" />
          <path d="M16 4 l1 2 l2 1 l-2 1 l-1 2 l-1 -2 l-2 -1 l2 -1 z" fill="#fff" strokeWidth={1} />
        </g>
      )}
    </svg>
  );
}

/** MON coin, Overcooked HUD style. */
export function KoinMon({ ukuran = 44 }: { ukuran?: number }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 48 48">
      <circle cx={24} cy={24} r={20} fill="#836ef9" stroke={TINTA} strokeWidth={3} />
      <circle cx={24} cy={24} r={14} fill="none" stroke="#b3a4ff" strokeWidth={2.5} />
      <path d="M17 31 v-14 l7 8 l7 -8 v14" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Jam({ ukuran = 34 }: { ukuran?: number }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 32 32">
      <g {...s}>
        <path d="M8 3 h16 M8 29 h16" strokeWidth={3} />
        <path d="M10 4 c0 8 12 8 12 12 c0 4 -12 4 -12 12 h12 c0 -8 -12 -8 -12 -12 c0 -4 12 -4 12 -12 z" fill="#e4f2f4" />
        <path d="M12 26 h8 l-4 -5 z" fill="#f4b829" strokeWidth={1.2} />
      </g>
    </svg>
  );
}
