// Kontrak bersama antara kerangka halaman (main.ts) dan dua bagian besar: D (src/d/) dan E (src/e/).
import { NAMA, DESKRIPSI, TAGLINE, URL_PESAN, URL_LAYAR, URL_APP, BUKTI, EXPLORER, HARGA, BATAS_KERJA, rpAngka, BISNIS, MODE, ORG_GITHUB } from './config';

export type FigApi = {
  act: (label: string) => boolean; palette: (p: string) => boolean; reset: () => void; spin: (on: boolean) => void;
  camTo: (yaw: number, pitch: number, ms?: number) => void; actions: () => string[]; frame: HTMLIFrameElement; doc: Document;
};
export type FigName = 'mesin-fotokopi' | 'laminator-a4' | 'printer-inkjet';

declare global {
  interface Window { FIG?: { mount: (el: HTMLElement, name: string, o: Record<string, unknown>) => Promise<FigApi> } }
}

let figLib: Promise<void> | null = null;
/** Muat /fig.js (figur isometrik Hans) sekali. */
export function loadFig(): Promise<void> {
  if (!figLib) figLib = new Promise(res => { const s = document.createElement('script'); s.src = '/fig.js'; s.onload = () => res(); document.head.appendChild(s); });
  return figLib;
}
/** Pasang satu figur interaktif (seret memutar, ketuk 2× kembali, bagian mesin bisa ditekan). */
export async function mountFig(el: HTMLElement, name: FigName, opts: { palette?: string; interactive?: boolean; title?: string } = {}): Promise<FigApi> {
  await loadFig();
  return window.FIG!.mount(el, name, { interactive: opts.interactive ?? true, palette: opts.palette ?? 'monad', title: opts.title ?? name });
}

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isMobile = () => innerWidth < 700;

export const ctx = { NAMA, DESKRIPSI, TAGLINE, URL_PESAN, URL_LAYAR, URL_APP, BUKTI, EXPLORER, HARGA, BATAS_KERJA, rpAngka, BISNIS, MODE, ORG_GITHUB, mountFig, loadFig, reduced, isMobile };
export type Ctx = typeof ctx;

/** Setiap bagian mengekspor: mount(root, ctx) untuk membangun isinya, dan stops() = posisi scrollY (px, absolut) untuk mode panggung. */
export interface Bagian { mount(root: HTMLElement, c: Ctx): void; stops(): number[] }
