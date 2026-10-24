// One copy-shop kitchen (8 × 6 tiles) in the arena camera: floor, wall + name sign, tables, machines, characters.
import type { ReactNode } from 'react';
import MesinFigur from '../components/MesinFigur';
import Karakter, { type Bawaan } from './Karakter';
import { IkonLangkah } from './Ikon';
import { CP, PALET, px, py, SP, TINTA, UNIT, zIndex, type NamaPalet } from './kamera';
import Kotak from './Kotak';

export const LEBAR_DAPUR = 8;
export const DALAM_DAPUR = 6.2;
const TINGGI_DINDING = 3.1;
const TINGGI_MEJA = 0.95;

export type Pemain = { x: number; y: number; warna: NamaPalet; bawa?: Bawaan; arah?: 1 | -1; jalan?: boolean; langkah?: number };
export type MesinAktif = { kode: 1 | 2 | 3; progres: number } | null;

/** Machine position (base center, local tiles) and its iframe size (tiles). */
const MESIN = {
  1: { x: 1.2, y: 1.45, z: 0, lebar: 6.4, tinggi: 6.4, angkat: 0.72, bar: 0.27 },
  2: { x: 3.85, y: 0.6, z: TINGGI_MEJA, lebar: 3.3, tinggi: 2.75, angkat: 0.7, bar: 0.1 },
  3: { x: 6.35, y: 0.6, z: TINGGI_MEJA, lebar: 3.3, tinggi: 2.75, angkat: 0.7, bar: 0.1 },
} as const;

function Lantai({ warnaA, warnaB }: { warnaA: string; warnaB: string }) {
  const ubin: ReactNode[] = [];
  for (let i = 0; i < LEBAR_DAPUR; i++)
    for (let j = 0; j < Math.ceil(DALAM_DAPUR); j++)
      ubin.push(<rect key={`${i}-${j}`} x={px(i)} y={py(j)} width={UNIT} height={SP * UNIT} fill={(i + j) % 2 ? warnaA : warnaB} />);
  return (
    <svg className="lantai" width={px(LEBAR_DAPUR)} height={py(DALAM_DAPUR)} style={{ left: 0, top: 0, zIndex: 1 }}>
      {ubin}
      <rect x={1} y={1} width={px(LEBAR_DAPUR) - 2} height={py(DALAM_DAPUR) - 2} fill="none" stroke={TINTA} strokeWidth={2} />
    </svg>
  );
}

export default function Dapur({
  x0 = 0,
  nama,
  warna,
  pemain = [],
  aktif = null,
  jalankanMesin = true,
}: {
  x0?: number;
  nama: string;
  warna: NamaPalet;
  pemain?: Pemain[];
  aktif?: MesinAktif;
  jalankanMesin?: boolean;
}) {
  const p = PALET[warna];
  return (
    <div className="dapur" style={{ left: px(x0), top: 0, width: px(LEBAR_DAPUR), height: py(DALAM_DAPUR) }}>
      <Lantai warnaA="#efe6d2" warnaB="#e2d6bb" />

      {/* back wall + shop name sign */}
      <Kotak x={-0.12} y={-0.3} w={LEBAR_DAPUR + 0.24} d={0.3} h={TINGGI_DINDING} atas="#cfc3a6" depan="#f6efe0" lapis={2} />
      <div className="papan-nama" style={{ left: px(4), top: py(-0.3, TINGGI_DINDING) - 40, zIndex: 400, background: p.m, transform: 'translateX(-50%)' }}>
        <span>COPY SHOP</span>
        <b>{nama}</b>
      </div>

      {/* back table (printer, laminator) */}
      <Kotak x={2.2} y={0} w={LEBAR_DAPUR - 2.2} d={1.1} h={TINGGI_MEJA} atas="#ebe3cf" depan={p.m} />
      {/* left side table: paper reams */}
      <Kotak x={0} y={2.4} w={1} d={2.4} h={TINGGI_MEJA} atas="#ebe3cf" depan={p.m}>
        <div className="rim" style={{ left: 8, top: 6 }} />
        <div className="rim" style={{ left: 8, top: 34 }} />
        <div className="rim" style={{ left: 8, top: 62 }} />
      </Kotak>
      {/* right side table: customer documents */}
      <Kotak x={7} y={1.8} w={1} d={2.6} h={TINGGI_MEJA} atas="#ebe3cf" depan={p.m}>
        <div className="map-dok" style={{ left: 7, top: 10 }} />
        <div className="map-dok biru" style={{ left: 9, top: 52 }} />
      </Kotak>
      {/* front table + hand-in counter */}
      <Kotak x={0} y={5.2} w={2.7} d={1} h={TINGGI_MEJA} atas="#ebe3cf" depan={p.m} />
      <Kotak x={2.7} y={5.2} w={2.6} d={1} h={TINGGI_MEJA * 0.92} atas={p.l} depan={p.d}>
        <div className="loket-label">DELIVER</div>
      </Kotak>
      <Kotak x={5.3} y={5.2} w={2.7} d={1} h={TINGGI_MEJA} atas="#ebe3cf" depan={p.m}>
        <div className="bel" style={{ left: 18, top: 6 }} />
      </Kotak>

      {/* machines from figures/ (Colorfigures), same camera angle as the arena */}
      {([1, 2, 3] as const).map((k) => {
        const m = MESIN[k];
        const w = px(m.lebar);
        const h = m.tinggi * UNIT;
        const dasar = py(m.y, m.z);
        return (
          <div key={k} className="pos-mesin" style={{ left: px(m.x) - w / 2, top: dasar - h * m.angkat, width: w, height: h, zIndex: zIndex(m.y + 0.6) }}>
            <MesinFigur kode={k} yaw={0} pitch={55} kelas="mesin-arena" jalan={jalankanMesin && aktif?.kode === k} />
            {aktif?.kode === k && (
              <div className="bar-stasiun" style={{ top: h * m.bar, left: w / 2 - 44, right: 'auto', width: 88 }}>
                <div style={{ width: `${aktif.progres * 100}%` }} />
              </div>
            )}
          </div>
        );
      })}

      {/* players */}
      {pemain.map((q, i) => (
        <div key={i} className="pos-karakter" style={{ left: px(q.x) - 32, top: py(q.y) - 78, zIndex: zIndex(q.y) }}>
          {q.langkah && (
            <div className="gelembung">
              <IkonLangkah kode={q.langkah} ukuran={20} />
            </div>
          )}
          <Karakter warna={q.warna} bawa={q.bawa} arah={q.arah} jalan={q.jalan} />
        </div>
      ))}
      <div className="bayang-dinding" style={{ height: CP * UNIT * 0.4, zIndex: 2 }} />
    </div>
  );
}
