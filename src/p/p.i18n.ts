// Kamus pre-hero P (kata raksasa PRINTPITT di paling atas). Bawaan English.
import { addDict } from '../i18n';

export const P_DICT = {
  'p.word': { en: 'PRINTPITT', id: 'PRINTPITT' },
  'p.block': { en: '<b>~0.3 s</b> per block (measured on testnet)', id: '<b>±0,3 detik</b> per blok (diukur di testnet)' },
  'p.tag': { en: 'The onchain print shop on Monad', id: 'Toko fotokopi onchain di Monad' },
  'p.cue': { en: 'Scroll to enter the arena', id: 'Gulir untuk masuk arena' },
  'p.hint': { en: 'Drag to rotate · double-tap to reset', id: 'Seret untuk memutar · ketuk 2× untuk kembali' },
  'p.held': { en: 'Paused — let go to continue', id: 'Ditahan — lepas untuk lanjut' },
  'p.fig.fk': { en: 'Photocopier', id: 'Mesin fotokopi' },
  'p.fig.lm': { en: 'Laminator', id: 'Laminator A4' },
  'p.fig.pr': { en: 'Inkjet printer', id: 'Printer inkjet' },
};

addDict(P_DICT);
