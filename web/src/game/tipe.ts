export type PropsMiniGame = {
  /** Customer custom text (shown on the document / file name). */
  teks: string;
  /** Order type label, e.g. "Menu Warung". */
  label: string;
  /** Called once when the mini-game is passed → runner sends completeStep. */
  onLulus: () => void;
};
