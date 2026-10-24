export type PropsMiniGame = {
  /** Teks custom pelanggan (muncul di dokumen / nama file). */
  teks: string;
  /** Label jenis order, mis. "Menu Warung". */
  label: string;
  /** Dipanggil sekali saat mini-game lulus → runner mengirim completeStep. */
  onLulus: () => void;
};
