// Profil pemain (diatur di lobi, dipakai di match): nama tampilan + rupa karakter. Disimpan di localStorage perangkat ini.
import type { ModelKarakter } from '../arena3d/Pekerja3D';

export type Profil = { nama: string; model: Extract<ModelKarakter, 'tukang' | 'tukang-visor'>; warna: string; kulit: string; rambut: string };

export const WARNA_BAJU = ['#836ef9', '#ef6a4c', '#f4b829', '#5fd39a', '#76a0e2', '#f08fb0'];
export const WARNA_KULIT = ['#f6d3b3', '#f1c9a5', '#d9a27c', '#b98262', '#8a5a3c'];
export const WARNA_RAMBUT = ['#231e16', '#5a3a2a', '#a8642e', '#e4c35a', '#e4e1dc'];
export const MAKS_NAMA = 14;

const KUNCI = 'pp.profil';
const BAWAAN: Profil = { nama: '', model: 'tukang', warna: WARNA_BAJU[0], kulit: WARNA_KULIT[1], rambut: WARNA_RAMBUT[0] };

/** Huruf, angka, spasi, titik, strip; maksimal MAKS_NAMA karakter. */
export const rapikanNama = (s: string) => s.replace(/[^A-Za-z0-9 ._-]/g, '').replace(/\s+/g, ' ').slice(0, MAKS_NAMA);

export function bacaProfil(): Profil {
  try {
    const p = JSON.parse(localStorage.getItem(KUNCI) ?? 'null') as Partial<Profil> | null;
    return { ...BAWAAN, ...(p ?? {}), nama: rapikanNama(p?.nama ?? '') };
  } catch {
    return { ...BAWAAN };
  }
}

export function simpanProfil(p: Profil) {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(p));
  } catch {
    /* mode privat: profil hanya bertahan selama halaman terbuka */
  }
}

/** Nama yang ditampilkan: nama pilihan pemain, atau nama toko kalau kosong. */
export const namaTampil = (p: Profil, cadangan: string) => p.nama.trim() || cadangan;
