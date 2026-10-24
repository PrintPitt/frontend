// Isi dinamis toko 3D: barang di meja/mesin, sorotan stasiun di depan pemain, bar progres + gelembung status mesin, antrean pelanggan.
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { Pekerja3D, TIPE_PEMBELI } from '../arena3d/Pekerja3D';
import { Item3D } from './Item3D';
import type { Dunia, StatusMesin } from './logika';
import { D, ID_MESIN, MEJA_MESIN, MESIN, POS_MEJA, POS_SERAH, TINGGI_MEJA, Z_DEPAN, type IdMesin, type IdStasiun, type KodeMesin } from './peta';

/** Ubah titik lokal mesin (x kanan, z ke muka) ke dunia. */
function keDunia(id: IdMesin, [lx, ly, lz]: [number, number, number]): [number, number, number] {
  const m = MESIN[id];
  const c = Math.cos(m.putar);
  const sn = Math.sin(m.putar);
  return [m.x + lx * c + lz * sn, m.y + ly, m.z - lx * sn + lz * c];
}
const ITEM_LOKAL: Record<KodeMesin, [number, number, number]> = { 1: [0, 1.6, -0.02], 2: [0, 0.08, 0.36], 3: [0, 0.08, 0.38] };
export const POS_ITEM_MESIN = Object.fromEntries(ID_MESIN.map((id) => [id, keDunia(id, ITEM_LOKAL[MESIN[id].kode])])) as Record<IdMesin, [number, number, number]>;
const TINGGI_BAR: Record<KodeMesin, number> = { 1: 1.95, 2: 0.95, 3: 0.8 };
const posBar = (id: IdMesin): [number, number, number] => {
  const m = MESIN[id];
  return [m.x, m.y + TINGGI_BAR[m.kode], m.z];
};

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
      {ID_MESIN.map((id) => {
        const it = dunia.mesin[id].item;
        return (
          it && (
            <group key={id} position={POS_ITEM_MESIN[id]} rotation={[0, MESIN[id].putar, 0]}>
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
export function BarMesin({ id, dunia }: { id: IdMesin; dunia: React.RefObject<Dunia> }) {
  const grup = useRef<THREE.Group>(null);
  const isi = useRef<THREE.Mesh>(null);
  const bahan = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const m = dunia.current.mesin[id];
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
    <group ref={grup} position={posBar(id)} visible={false}>
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
export function TandaMesin({ id, status }: { id: IdMesin; status: StatusMesin }) {
  const ref = useRef<THREE.Group>(null);
  const [x, yBar, z] = posBar(id);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const w = clock.elapsedTime;
    ref.current.position.y = yBar + 0.38 + Math.sin(w * 4) * 0.06;
    ref.current.position.x = x + (status === 'macet' ? Math.sin(w * 40) * 0.04 : 0);
  });
  const t = TANDA[status];
  if (!t) return null;
  return (
    <group ref={ref} position={[x, yBar + 0.38, z]}>
      <Billboard>
        <mesh renderOrder={5}>
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial map={teksturGelembung(t[0], t[1])} transparent toneMapped={false} depthTest={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

/** Kotak sorot (x, y, z, lebar, dalam, putar) tiap stasiun. */
const SOROT: Record<IdStasiun, [number, number, number, number, number, number]> = {
  serah: [POS_SERAH[0], TINGGI_MEJA + 0.02, Z_DEPAN, 1.0, 0.72, 0],
  meja0: [POS_MEJA[0][0], TINGGI_MEJA + 0.02, POS_MEJA[0][2], 0.97, 0.72, 0],
  meja1: [POS_MEJA[1][0], TINGGI_MEJA + 0.02, POS_MEJA[1][2], 0.97, 0.72, 0],
  meja2: [POS_MEJA[2][0], TINGGI_MEJA + 0.02, POS_MEJA[2][2], 0.97, 0.72, 0],
  meja3: [POS_MEJA[3][0], TINGGI_MEJA + 0.02, POS_MEJA[3][2], 0.97, 0.72, 0],
  ...(Object.fromEntries(
    ID_MESIN.map((id) => {
      const m = MESIN[id];
      if (m.kode === 1) {
        const [x, , z] = keDunia(id, [0, 0, 0.72]);
        return [id, [x, 0.02, z, 1.15, 0.42, m.putar]];
      }
      return [id, [m.x, TINGGI_MEJA + 0.02, m.z, MEJA_MESIN.lebar - 0.04, MEJA_MESIN.dalam - 0.04, m.putar]];
    }),
  ) as Record<IdMesin, [number, number, number, number, number, number]>),
};

export function Sorotan({ id }: { id: IdStasiun | null }) {
  const bahan = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (bahan.current) bahan.current.opacity = 0.32 + Math.sin(clock.elapsedTime * 6) * 0.12;
  });
  if (!id) return null;
  const [x, y, z, w, d, putar] = SOROT[id];
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, putar]} renderOrder={2}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial ref={bahan} color="#fff7c2" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

const BAJU = ['#76a0e2', '#ef6a4c', '#93d3b0', '#f4b829', '#c58be0', '#f08fb0', '#5fb0c9'];
const RAMBUT = ['#231e16', '#7a4a2a', '#3d2a1e', '#5a3a2a', '#2d2440'];
const HIJAB = ['#f08fb0', '#76a0e2', '#c58be0', '#93d3b0', '#f4b829'];
const KULIT = ['#f1c9a5', '#d9a27c', '#e8b48f', '#b98262'];
const SLOT_X = [-1.75, 0.75, -2.95, 1.95, -4.15, 3.15];
const Z_ANTRE = D / 2 + 0.95;

/** Ikon pesanan di gelembung (digambar di kanvas, di-cache per jenis). */
const cacheIkon = new Map<number, THREE.CanvasTexture>();
function teksturIkon(jenis: number) {
  let t = cacheIkon.get(jenis);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#231e16';
  g.beginPath();
  g.roundRect(6, 6, 116, 100, 26);
  g.moveTo(52, 100);
  g.lineTo(64, 124);
  g.lineTo(78, 100);
  g.fill();
  g.fillStyle = '#fbfaf3';
  g.beginPath();
  g.roundRect(12, 12, 104, 88, 21);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#231e16';
  if (jenis === 1) {
    g.fillStyle = '#76a0e2';
    g.fillRect(26, 30, 76, 50);
    g.strokeRect(26, 30, 76, 50);
    g.fillStyle = '#fbfaf3';
    g.fillRect(34, 40, 22, 28);
    g.fillStyle = '#231e16';
    for (const y of [44, 54, 64]) g.fillRect(62, y, 32, 5);
  } else if (jenis === 2) {
    g.fillStyle = '#f4b829';
    g.fillRect(22, 34, 84, 42);
    g.strokeRect(22, 34, 84, 42);
    g.setLineDash([5, 5]);
    g.beginPath();
    g.moveTo(80, 34);
    g.lineTo(80, 76);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#231e16';
    g.beginPath();
    g.moveTo(34, 58);
    g.lineTo(70, 50);
    g.lineTo(70, 58);
    g.lineTo(60, 62);
    g.closePath();
    g.fill();
  } else if (jenis === 3) {
    g.fillStyle = '#fbfaf3';
    g.fillRect(30, 24, 68, 62);
    g.strokeRect(30, 24, 68, 62);
    g.fillStyle = '#231e16';
    for (const y of [36, 46]) g.fillRect(40, y, 48, 4);
    g.fillStyle = '#ef6a4c';
    g.beginPath();
    g.arc(78, 70, 12, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else {
    g.fillStyle = '#93d3b0';
    g.fillRect(32, 22, 64, 66);
    g.strokeRect(32, 22, 64, 66);
    g.fillStyle = '#231e16';
    g.fillRect(42, 32, 44, 7);
    for (const y of [48, 58, 68]) g.fillRect(42, y, 34, 4);
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cacheIkon.set(jenis, t);
  return t;
}

export type DataPembeli = { id: bigint; jenis: number; sisa: number };

function Pelanggan({ p, x, z, menunggu, putar = Math.PI }: { p: DataPembeli; x: number; z: number; menunggu?: boolean; putar?: number }) {
  const n = Number(p.id % 997n);
  const tipe = TIPE_PEMBELI[n % TIPE_PEMBELI.length];
  const warnaBar = p.sisa > 0.5 ? '#5fd39a' : p.sisa > 0.25 ? '#f4b829' : '#ef6a4c';
  return (
    <group>
      <Pekerja3D
        model="pembeli"
        tipe={tipe}
        warna={BAJU[(n >> 1) % BAJU.length]}
        posisi={[x, 0, z]}
        putar={putar}
        topi={false}
        rambut={tipe === 'hijab' ? HIJAB[n % HIJAB.length] : RAMBUT[n % RAMBUT.length]}
        kulit={KULIT[(n >> 2) % KULIT.length]}
        cincin={false}
        skala={1.08}
        gaya={!menunggu && p.sisa < 0.3 ? 'kerja' : 'diam'}
        fase={n}
      />
      <Billboard position={[x, 2.05, z]}>
        <mesh renderOrder={6}>
          <planeGeometry args={[0.62, 0.62]} />
          <meshBasicMaterial map={teksturIkon(p.jenis)} transparent toneMapped={false} depthTest={false} />
        </mesh>
        <mesh position={[0, -0.4, 0]} renderOrder={6}>
          <planeGeometry args={[0.6, 0.11]} />
          <meshBasicMaterial color="#231e16" toneMapped={false} depthTest={false} />
        </mesh>
        <mesh position={[(-0.54 * (1 - Math.max(0.02, p.sisa))) / 2, -0.4, 0.001]} scale={[Math.max(0.02, p.sisa), 1, 1]} renderOrder={7}>
          <planeGeometry args={[0.54, 0.06]} />
          <meshBasicMaterial color={warnaBar} toneMapped={false} depthTest={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

/** Pelanggan: yang order-nya sedang dikerjakan menunggu di loket; yang belum direbut antre di luar. Gelembung = pesanan + kesabaran. */
export function Antrean({ antre, aktif }: { antre: DataPembeli[]; aktif?: DataPembeli }) {
  return (
    <group>
      {aktif && <Pelanggan p={aktif} x={POS_SERAH[0]} z={D / 2 + 0.7} menunggu />}
      {antre.slice(0, SLOT_X.length).map((o, i) => (
        <Pelanggan key={String(o.id)} p={o} x={SLOT_X[i]} z={Z_ANTRE} putar={((Number(o.id % 3n) - 1) * 0.35)} />
      ))}
    </group>
  );
}
