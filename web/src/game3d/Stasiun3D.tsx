// Isi dinamis toko 3D: barang di meja/mesin, sorotan stasiun di depan pemain, bar progres + gelembung status mesin, antrean pelanggan.
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { Pekerja3D, type Bawa } from '../arena3d/Pekerja3D';
import { Item3D } from './Item3D';
import type { Dunia, KodeMesin, StatusMesin } from './logika';
import { D, POS_MEJA, POS_MESIN, POS_SERAH, TINGGI_MEJA, Z_BELAKANG, Z_DEPAN, type IdStasiun } from './peta';

export const POS_ITEM_MESIN: Record<KodeMesin, [number, number, number]> = {
  1: [POS_MESIN[1][0] + 0.05, 1.16, POS_MESIN[1][2] + 0.1],
  2: [POS_MESIN[2][0], TINGGI_MEJA + 0.06, POS_MESIN[2][2] + 0.3],
  3: [POS_MESIN[3][0], TINGGI_MEJA + 0.06, POS_MESIN[3][2] + 0.3],
};
const TINGGI_BAR: Record<KodeMesin, number> = { 1: 1.95, 2: 1.75, 3: 1.6 };

export function BarangDunia({ dunia }: { dunia: Dunia }) {
  return (
    <group>
      {dunia.meja.map(
        (it, i) =>
          it && (
            <group key={`meja${i}`} position={[POS_MEJA[i][0], POS_MEJA[i][1] + 0.03, POS_MEJA[i][2]]}>
              <Item3D item={it} />
            </group>
          ),
      )}
      {([1, 2, 3] as KodeMesin[]).map((k) => {
        const it = dunia.mesin[k].item;
        return (
          it && (
            <group key={k} position={POS_ITEM_MESIN[k]}>
              <Item3D item={it} />
            </group>
          )
        );
      })}
      {dunia.diSerah && (
        <group position={[POS_SERAH[0], POS_SERAH[1] + 0.05, POS_SERAH[2]]}>
          <Item3D item={dunia.diSerah} />
        </group>
      )}
    </group>
  );
}

/** Bar progres di atas mesin; dibaca langsung dari ref tiap frame. */
export function BarMesin({ k, dunia }: { k: KodeMesin; dunia: React.RefObject<Dunia> }) {
  const grup = useRef<THREE.Group>(null);
  const isi = useRef<THREE.Mesh>(null);
  const bahan = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const m = dunia.current.mesin[k];
    const tampil = m.status === 'jalan' || m.status === 'tahan' || m.status === 'macet';
    if (grup.current) grup.current.visible = tampil;
    const v = m.status === 'macet' ? 1 : Math.max(0.001, m.progres);
    if (isi.current) {
      isi.current.scale.x = v;
      isi.current.position.x = (-0.92 * (1 - v)) / 2;
    }
    bahan.current?.color.set(m.status === 'macet' ? '#ef6a4c' : '#5fd39a');
  });
  return (
    <group ref={grup} position={[POS_MESIN[k][0], TINGGI_BAR[k], POS_MESIN[k][2]]} visible={false}>
      <Billboard>
        <mesh>
          <planeGeometry args={[1.0, 0.2]} />
          <meshBasicMaterial color="#231e16" toneMapped={false} depthTest={false} />
        </mesh>
        <mesh ref={isi} position={[0, 0, 0.001]}>
          <planeGeometry args={[0.92, 0.12]} />
          <meshBasicMaterial ref={bahan} color="#5fd39a" toneMapped={false} depthTest={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

const cacheGelembung = new Map<string, THREE.CanvasTexture>();
function teksturGelembung(teks: string, latar: string) {
  const kunci = teks + latar;
  let t = cacheGelembung.get(kunci);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#231e16';
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = latar;
    g.beginPath();
    g.arc(64, 60, 52, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fbfaf3';
    g.strokeStyle = '#231e16';
    g.lineWidth = 7;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${teks.length > 1 ? 46 : 74}px "Lilita One", system-ui`;
    g.strokeText(teks, 64, 64);
    g.fillText(teks, 64, 64);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    cacheGelembung.set(kunci, t);
  }
  return t;
}

const TANDA: Partial<Record<StatusMesin, [string, string]>> = {
  selesai: ['✓', '#5fd39a'],
  pilih: ['1-3', '#f4b829'],
  tahan: ['E', '#836ef9'],
  macet: ['!', '#ef6a4c'],
};

/** Gelembung status di atas mesin: ✓ siap diambil, 1-3 pilih file, E tahan, ! virus. */
export function TandaMesin({ k, status }: { k: KodeMesin; status: StatusMesin }) {
  const ref = useRef<THREE.Group>(null);
  const [x, , z] = POS_MESIN[k];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const w = clock.elapsedTime;
    ref.current.position.y = TINGGI_BAR[k] + 0.38 + Math.sin(w * 4) * 0.06;
    ref.current.position.x = x + (status === 'macet' ? Math.sin(w * 40) * 0.04 : 0);
  });
  const t = TANDA[status];
  if (!t) return null;
  return (
    <group ref={ref} position={[x, TINGGI_BAR[k] + 0.38, z]}>
      <Billboard>
        <mesh renderOrder={5}>
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial map={teksturGelembung(t[0], t[1])} transparent toneMapped={false} depthTest={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

/** Kotak sorot (x, y, z, lebar, dalam) tiap stasiun. */
const SOROT: Record<IdStasiun, [number, number, number, number, number]> = {
  serah: [POS_SERAH[0], TINGGI_MEJA + 0.02, Z_DEPAN, 1.0, 0.72],
  m1: [POS_MESIN[1][0] + 0.1, 0.02, -2.55, 1.7, 0.45],
  m2: [POS_MESIN[2][0], TINGGI_MEJA + 0.02, Z_BELAKANG, 1.05, 0.74],
  m3: [POS_MESIN[3][0], TINGGI_MEJA + 0.02, Z_BELAKANG, 1.05, 0.74],
  meja0: [POS_MEJA[0][0], TINGGI_MEJA + 0.02, POS_MEJA[0][2], 0.97, 0.72],
  meja1: [POS_MEJA[1][0], TINGGI_MEJA + 0.02, POS_MEJA[1][2], 0.97, 0.72],
};

export function Sorotan({ id }: { id: IdStasiun | null }) {
  const bahan = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (bahan.current) bahan.current.opacity = 0.32 + Math.sin(clock.elapsedTime * 6) * 0.12;
  });
  if (!id) return null;
  const [x, y, z, w, d] = SOROT[id];
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial ref={bahan} color="#fff7c2" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

const BAWA: Record<number, Bawa> = { 1: 'ktp', 2: 'kertas', 3: 'ijazah', 4: 'menu' };
const BAJU = ['#76a0e2', '#ef6a4c', '#93d3b0', '#f4b829', '#c58be0', '#f08fb0'];
const RAMBUT = ['#231e16', '#7a4a2a', '#3d2a1e', '#f4d23a', '#5a3a2a'];
const KULIT = ['#f1c9a5', '#d9a27c', '#e8b48f', '#b98262'];
const SLOT_X = [-1.7, 0.7, -2.9, 1.9, -4.1, 3.1];

function Pelanggan({ id, x, z, bawa }: { id: bigint; x: number; z: number; bawa?: Bawa }) {
  const n = Number(id % 997n);
  return (
    <Pekerja3D
      warna={BAJU[n % BAJU.length]}
      posisi={[x, 0, z]}
      putar={Math.PI}
      bawa={bawa}
      topi={false}
      rambut={RAMBUT[n % RAMBUT.length]}
      kulit={KULIT[(n >> 1) % KULIT.length]}
      cincin={false}
      fase={n}
    />
  );
}

/** Pelanggan: yang order-nya sedang dikerjakan menunggu di loket; yang belum direbut antre membawa dokumen. */
export function Antrean({ antre, aktif }: { antre: { id: bigint; jenis: number }[]; aktif?: bigint }) {
  return (
    <group>
      {aktif !== undefined && <Pelanggan id={aktif} x={POS_SERAH[0]} z={D / 2 + 0.7} />}
      {antre.slice(0, SLOT_X.length).map((o, i) => (
        <Pelanggan key={String(o.id)} id={o.id} x={SLOT_X[i]} z={D / 2 + 1.3} bawa={BAWA[o.jenis]} />
      ))}
    </group>
  );
}
