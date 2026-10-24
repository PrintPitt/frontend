// Contract v2.3: shops self-register from the dashboard (`/`). Tx logic lives in lib/toko.ts (daftarkanToko).
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
  // mainnet: the MON gas faucet needs a judge code (same as customers); ask for it if not saved or rejected
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
      // the on-screen shop list updates via the ShopRegistered event (lib/live)
    } catch (e) {
      const pesan = e instanceof Error ? e.message : String(e);
      // lib/toko.ts wraps backend errors as Error(message); BAD_CODE → saved code is wrong, ask again
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
      <input value={nama} maxLength={MAX_TEXT} placeholder="Shop name, e.g. Fotokopi Berkah" onChange={(e) => setNama(e.target.value)} autoComplete="off" />
      {perluKode && <input value={kode} placeholder="Judge code from the organizers" onChange={(e) => setKode(e.target.value)} autoComplete="off" />}
      <button className="tombol utama" disabled={jalan || !ok} onClick={daftar}>
        {jalan ? 'Registering…' : 'Register my shop'}
      </button>
      {nama && !namaOk && <span className="galat kecil">Name: 1–40 plain characters, no emoji and no &lt; &gt; &amp; " ' \</span>}
      {galat && <span className="galat kecil">{galat}</span>}
    </div>
  );
}
