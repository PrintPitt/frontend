// Mesin toko fotokopi dalam 3D, dimodelkan dari geometri figur Colorfigures di figures/ (satuan cm di kode figur).
// Sumbu figur: x = kedalaman (depan di x = W), y = lebar (+y ke kiri penonton), z = atas.
// Sumbu three: depan menghadap +z (ke kamera), x ke kanan, y ke atas. 1 unit three = 1 m.
import { RoundedBox } from '@react-three/drei';
import type { ReactNode } from 'react';

export const UNGU = { l: '#a99bfa', m: '#836ef9', d: '#2a2163' };
const KRM = '#e8e4d8'; // GREY figur
const TERANG = '#f4f2ea'; // LIGHT figur
const GELAP = '#3d3935';
const CEKUNG = '#2b2523';
const KERTAS = '#fbfaf3';
const GABUS = '#c9975a';

type Kotak = { x: [number, number]; y: [number, number]; z: [number, number]; warna: string; r?: number; kilap?: number };

/** Balok dari rentang cm figur → mesh three (relatif ke pusat alas mesin). */
function buatKotak(W: number, D: number) {
  return function B({ x, y, z, warna, r = 0, kilap = 0.75 }: Kotak) {
    const sx = (y[1] - y[0]) / 100;
    const sy = (z[1] - z[0]) / 100;
    const sz = (x[1] - x[0]) / 100;
    const pos: [number, number, number] = [(D / 2 - (y[0] + y[1]) / 2) / 100, (z[0] + z[1]) / 200, ((x[0] + x[1]) / 2 - W / 2) / 100];
    const mat = <meshStandardMaterial color={warna} roughness={kilap} />;
    return r > 0 ? (
      <RoundedBox args={[sx, sy, sz]} radius={r / 100} smoothness={3} position={pos} castShadow receiveShadow>
        {mat}
      </RoundedBox>
    ) : (
      <mesh position={pos} castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        {mat}
      </mesh>
    );
  };
}

function Wadah({ skala, children, posisi, putar = 0 }: { skala: number; children: ReactNode; posisi?: [number, number, number]; putar?: number }) {
  return (
    <group position={posisi} rotation={[0, putar, 0]} scale={skala}>
      {children}
    </group>
  );
}

/** Mesin fotokopi berdiri (figures/fotokopi): W 62, D 58, kabinet 40, mesin 92, scanner 104 cm. */
export function Fotokopi3D({ posisi, putar, skala = 1.3, jalan = false }: { posisi?: [number, number, number]; putar?: number; skala?: number; jalan?: boolean }) {
  const W = 62, D = 58;
  const B = buatKotak(W, D);
  return (
    <Wadah skala={skala} posisi={posisi} putar={putar}>
      <B x={[1, 61]} y={[1, 57]} z={[0, 2]} warna={GELAP} />
      <B x={[0, 62]} y={[0, 58]} z={[2, 40]} warna={KRM} />
      {/* dua laci A4 + gagang + indikator kertas */}
      {[
        [5, 20],
        [23, 38],
      ].map(([z0, z1], i) => (
        <group key={i}>
          <B x={[62, 63.2]} y={[4, 54]} z={[z0, z1]} warna={TERANG} />
          <B x={[63.2, 63.6]} y={[20, 38]} z={[z1 - 4.5, z1 - 2]} warna={CEKUNG} />
          {[0, 1, 2].map((k) => (
            <B key={k} x={[63.2, 63.5]} y={[8 + 2.6 * k, 9.8 + 2.6 * k]} z={[z0 + 2.2, z0 + 4]} warna={k < 2 ? '#43c25c' : '#c9c1b2'} />
          ))}
        </group>
      ))}
      {/* badan mesin ungu + pintu depan + lencana PITT */}
      <B x={[0, 62]} y={[0, 58]} z={[40, 92]} warna={UNGU.m} />
      <B x={[62, 63]} y={[4, 54]} z={[44, 86]} warna={UNGU.l} />
      <B x={[63, 63.4]} y={[40, 54]} z={[76, 83]} warna="#d8d0ff" />
      <B x={[63, 63.4]} y={[6, 8]} z={[58, 70]} warna={CEKUNG} />
      {/* unit scanner + kaca + tutup dokumen */}
      <B x={[0, 62]} y={[0, 58]} z={[92, 104]} warna={KRM} />
      <B x={[5, 57]} y={[19, 55]} z={[104, 104.3]} warna="#cfe9f0" kilap={0.15} />
      <B x={[2, 60]} y={[18, 56]} z={[104.3, 107.3]} warna={TERANG} />
      {/* panel kontrol: layar + tombol COPY */}
      <B x={[38, 67]} y={[2, 16]} z={[104, 109]} warna={KRM} />
      <B x={[46, 60]} y={[4, 14]} z={[109, 109.4]} warna="#1d2a26" kilap={0.3} />
      <B x={[61, 65]} y={[6, 12]} z={[109, 110.6]} warna="#43c25c" />
      {/* celah keluar + baki hasil di sisi kanan, dengan tumpukan salinan */}
      <B x={[10, 52]} y={[-0.4, 0]} z={[57, 62]} warna={CEKUNG} />
      <group position={[(D / 2 + 12) / 100, 0.6, 0]} rotation={[0, 0, 0.24]}>
        <mesh castShadow>
          <boxGeometry args={[0.24, 0.012, 0.46]} />
          <meshStandardMaterial color={TERANG} roughness={0.7} />
        </mesh>
        <mesh position={[0.02, 0.012, 0]} castShadow>
          <boxGeometry args={[0.2, 0.012, 0.3]} />
          <meshStandardMaterial color={KERTAS} />
        </mesh>
      </group>
      {jalan && (
        <mesh position={[0, 1.045, 0.05]}>
          <boxGeometry args={[0.52, 0.006, 0.05]} />
          <meshBasicMaterial color="#fff4a8" />
        </mesh>
      )}
    </Wadah>
  );
}

/** Printer inkjet di atas alas gabus (figures/printer): badan W 34, D 46, tinggi 14 cm. */
export function Printer3D({ posisi, putar, skala = 2.4 }: { posisi?: [number, number, number]; putar?: number; skala?: number }) {
  const W = 34, D = 46;
  const B = buatKotak(W, D);
  return (
    <Wadah skala={skala} posisi={posisi} putar={putar}>
      <B x={[-14, 52]} y={[-6, 52]} z={[0, 3]} warna={GABUS} r={1} kilap={0.95} />
      <B x={[0, 34]} y={[0, 46]} z={[3, 17]} warna={UNGU.m} r={3} />
      <B x={[3, 33]} y={[1, 45]} z={[16.5, 19.5]} warna="#c8bffd" r={1.5} />
      {/* penyangga kertas belakang + kertas, miring ke belakang */}
      <group position={[0, (17 + 6) / 100, (-W / 2 - 4) / 100]} rotation={[-0.55, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.2, 0.01]} />
          <meshStandardMaterial color="#ddd8cc" />
        </mesh>
        <mesh position={[0, 0.03, 0.008]} castShadow>
          <boxGeometry args={[0.21, 0.22, 0.006]} />
          <meshStandardMaterial color={KERTAS} />
        </mesh>
      </group>
      {/* baki keluar depan + lembar hasil */}
      <B x={[32, 50]} y={[9, 37]} z={[8, 8.8]} warna="#ddd8cc" />
      <B x={[34, 47]} y={[12.5, 33.5]} z={[8.8, 9.3]} warna={KERTAS} />
      {/* panel depan: celah, layar hijau, tombol POWER (hijau) dan PRINT (gelap) */}
      <B x={[34, 34.4]} y={[8, 38]} z={[8.6, 11.4]} warna={CEKUNG} />
      <B x={[34, 34.4]} y={[27, 41]} z={[12.2, 15.9]} warna="#1d2a26" />
      <B x={[34, 35]} y={[3.7, 6.3]} z={[12.7, 15.3]} warna="#43c25c" r={1} />
      <B x={[34, 35]} y={[9.2, 11.8]} z={[12.7, 15.3]} warna={GELAP} r={1} />
      {/* flashdisk kuning di sisi kanan */}
      <B x={[24, 29]} y={[-6, 0]} z={[12, 15]} warna="#f4b829" r={0.8} />
    </Wadah>
  );
}

/** Laminator di atas alas gabus (figures/laminator): badan W 26, D 44, tinggi 9 cm. */
export function Laminator3D({ posisi, putar, skala = 2.6 }: { posisi?: [number, number, number]; putar?: number; skala?: number }) {
  const W = 26, D = 44;
  const B = buatKotak(W, D);
  return (
    <Wadah skala={skala} posisi={posisi} putar={putar}>
      <B x={[-14, 40]} y={[-6, 50]} z={[0, 3]} warna={GABUS} r={1} kilap={0.95} />
      <B x={[0, 26]} y={[0, 44]} z={[3, 12]} warna={UNGU.m} r={4} />
      {/* label LAMINATOR A4 di atas */}
      <B x={[6, 16]} y={[8, 34]} z={[11.9, 12.4]} warna="#d8d0ff" />
      {/* lampu POWER (merah) + READY (hijau), dial ketebalan, tombol ABS */}
      <B x={[21.5, 23.5]} y={[8, 10]} z={[11.9, 12.8]} warna="#ef4b3d" r={0.8} />
      <B x={[21.5, 23.5]} y={[12, 14]} z={[11.9, 12.8]} warna="#43c25c" r={0.8} />
      <mesh position={[(D / 2 - 22) / 100, 0.13, (19 - W / 2) / 100]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.014, 20]} />
        <meshStandardMaterial color={TERANG} />
      </mesh>
      <mesh position={[(D / 2 - 31) / 100, 0.127, (19 - W / 2) / 100]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.01, 16]} />
        <meshStandardMaterial color={GELAP} />
      </mesh>
      {/* celah depan, pemandu belakang, baki depan + kantong laminating berisi dokumen */}
      <B x={[26, 26.4]} y={[10, 34]} z={[6.8, 8.2]} warna={CEKUNG} />
      <B x={[-7, 0]} y={[9, 35]} z={[6, 7.4]} warna="#ddd8cc" />
      <B x={[26, 37]} y={[9, 35]} z={[4, 5]} warna="#ddd8cc" />
      <B x={[27, 36]} y={[11, 33]} z={[5, 5.6]} warna="#e4f2f4" kilap={0.2} />
      <B x={[28, 35]} y={[13, 31]} z={[5.6, 5.9]} warna="#f4b829" />
    </Wadah>
  );
}
