// Overcooked-style order ticket: timer bar on top, document icon, step icons, price, stamp of the shop that claimed it.
import { motion } from 'motion/react';
import { IkonLangkah, IkonOrder, type JenisOrder } from './Ikon';
import { PALET, type NamaPalet } from './kamera';

export type DataTiket = { id: string; jenis: JenisOrder; langkah: number[]; sisa: number; harga: string; diambil?: { huruf: string; warna: NamaPalet } };

export default function Tiket({ t }: { t: DataTiket }) {
  const warnaBar = t.sisa > 0.5 ? '#5fd39a' : t.sisa > 0.25 ? '#f4b829' : '#ef6a4c';
  return (
    <motion.div className="tiket" layout initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
      <div className="tiket-bar">
        <div style={{ width: `${t.sisa * 100}%`, background: warnaBar }} />
      </div>
      <div className="tiket-ikon">
        <IkonOrder jenis={t.jenis} ukuran={46} />
      </div>
      <div className="tiket-langkah">
        {t.langkah.map((k, i) => (
          <span key={i}>
            <IkonLangkah kode={k} ukuran={20} />
          </span>
        ))}
      </div>
      <div className="tiket-harga">{t.harga}</div>
      {t.diambil && (
        <div className="cap-toko" style={{ background: PALET[t.diambil.warna].m }}>
          {t.diambil.huruf}
        </div>
      )}
    </motion.div>
  );
}
