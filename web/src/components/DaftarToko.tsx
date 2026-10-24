// Contract v2.3: toko mendaftar sendiri dari dashboard (`/`). Logika tx ada di lib/toko.ts (daftarkanToko).
import { useState } from 'react';
import { MAX_TEXT, teksValid } from '../../../shared/src/index.ts';
import type { Akun } from '../lib/akun';
import { bacaKode, GalatBackend, simpanKode } from '../lib/backend';
import { IS_MAINNET } from '../lib/chain';
import { daftarkanToko } from '../lib/toko';

export default function DaftarToko({ akun, namaAwal = '' }: { akun: Akun; namaAwal?: string }) {
  const [nama, setNama] = useState(namaAwal.slice(0, MAX_TEXT));
  const [jalan, setJalan] = useState(false);
  const [galat, setGalat] = useState('');
  // mainnet: faucet MON untuk gas butuh kode juri (sama dengan pelanggan); minta bila belum tersimpan atau ditolak
  const [kode, setKode] = useState(bacaKode);
  const [perluKode, setPerluKode] = useState(() => IS_MAINNET && !bacaKode());
  const namaOk = teksValid(nama.trim());
  const ok = namaOk && (!perluKode || !!kode.trim());

  async function daftar() {
    setGalat('');
    setJalan(true);
    try {
      if (perluKode) simpanKode(kode.trim());
      await daftarkanToko(akun, nama.trim());
      // daftar toko di layar diperbarui lewat event ShopRegistered (lib/live)
    } catch (e) {
      const pesan = e instanceof Error ? e.message : String(e);
      // lib/toko.ts membungkus galat backend jadi Error(pesan); BAD_CODE → kode tersimpan salah, minta ulang
      if (pesan === new GalatBackend('BAD_CODE').message) {
        simpanKode('');
        setKode('');
        setPerluKode(true);
      }
      setGalat(pesan);
    } finally {
      setJalan(false);
    }
  }

  return (
    <div className="daftar-toko">
      <input value={nama} maxLength={MAX_TEXT} placeholder="Nama toko, mis. Fotokopi Berkah" onChange={(e) => setNama(e.target.value)} autoComplete="off" />
      {perluKode && <input value={kode} placeholder="Kode juri dari panitia" onChange={(e) => setKode(e.target.value)} autoComplete="off" />}
      <button className="tombol utama" disabled={jalan || !ok} onClick={daftar}>
        {jalan ? 'Mendaftar…' : 'Daftarkan toko saya'}
      </button>
      {nama && !namaOk && <span className="galat kecil">Nama 1–40 huruf biasa, tanpa emoji dan tanpa &lt; &gt; &amp; " ' \</span>}
      {galat && <span className="galat kecil">{galat}</span>}
    </div>
  );
}
