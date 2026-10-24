// Items carried/processed: original document, flash drive (printer order), printed/copied paper, laminated result.
export type Wujud = 'dokumen' | 'flashdisk' | 'kertas' | 'laminasi';
export type Item = { id: bigint; jenis: number; langkah: number[]; tahap: number; wujud: Wujud; teks: string };

/** Color per order type (1 ID card, 2 boarding pass, 3 diploma, 4 food stall menu). */
export const WARNA_JENIS: Record<number, string> = { 1: '#76a0e2', 2: '#f4b829', 3: '#fbfaf3', 4: '#93d3b0' };

/** Orders whose first step is Print arrive as a flash drive; others as an original document. */
export const wujudAwal = (langkah: number[]): Wujud => (langkah[0] === 2 ? 'flashdisk' : 'dokumen');

export function Item3D({ item, skala = 1 }: { item: Pick<Item, 'jenis' | 'wujud'>; skala?: number }) {
  const w = WARNA_JENIS[item.jenis] ?? '#fbfaf3';
  return (
    <group scale={skala}>
      {item.wujud === 'flashdisk' && (
        <group rotation={[0, 0.4, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.12, 0.06, 0.26]} />
            <meshStandardMaterial color="#f4b829" />
          </mesh>
          <mesh position={[0, 0, 0.17]} castShadow>
            <boxGeometry args={[0.08, 0.04, 0.09]} />
            <meshStandardMaterial color="#c6ccce" metalness={0.5} roughness={0.3} />
          </mesh>
        </group>
      )}
      {item.wujud === 'dokumen' && (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.4, 0.025, 0.28]} />
            <meshStandardMaterial color={w} />
          </mesh>
          <mesh position={[-0.11, 0.015, 0]}>
            <boxGeometry args={[0.1, 0.01, 0.13]} />
            <meshStandardMaterial color={item.jenis === 3 ? '#ef6a4c' : '#fbfaf3'} />
          </mesh>
        </group>
      )}
      {item.wujud === 'kertas' &&
        [0, 1, 2].map((i) => (
          <mesh key={i} position={[i * 0.012, i * 0.022, -i * 0.01]} rotation={[0, (i - 1) * 0.08, 0]} castShadow>
            <boxGeometry args={[0.36, 0.018, 0.27]} />
            <meshStandardMaterial color={i === 2 ? '#fbfaf3' : '#efe9d8'} />
          </mesh>
        ))}
      {item.wujud === 'kertas' && (
        <mesh position={[0.03, 0.06, -0.02]}>
          <boxGeometry args={[0.22, 0.004, 0.06]} />
          <meshStandardMaterial color={w === '#fbfaf3' ? '#836ef9' : w} />
        </mesh>
      )}
      {item.wujud === 'laminasi' && (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.44, 0.03, 0.32]} />
            <meshStandardMaterial color="#e4f2f4" roughness={0.05} metalness={0.2} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0.005, 0]}>
            <boxGeometry args={[0.36, 0.03, 0.25]} />
            <meshStandardMaterial color={w} roughness={0.2} />
          </mesh>
        </group>
      )}
    </group>
  );
}
