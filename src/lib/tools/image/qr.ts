/**
 * QR codes, and the two settings people get wrong.
 *
 * **Error correction is not "quality".** A QR code carries redundancy so it
 * still scans when part of it is damaged or covered, at four levels: L recovers
 * ~7%, M ~15%, Q ~25%, H ~30%. Higher correction does not make the code clearer,
 * it makes it *denser*, because the redundancy has to go somewhere. A long URL
 * at level H produces a grid so fine that a phone camera struggles with it,
 * which is the opposite of the intent. H exists for codes with a logo punched
 * through the middle, and for printing on something that will get scuffed.
 *
 * **Shorter input is the real quality setting.** Capacity is fixed per version,
 * so every character you remove lowers the module count and makes the code
 * easier to scan from further away. A shortened URL scans better than a long
 * one at any correction level.
 */

export type ErrorCorrection = "L" | "M" | "Q" | "H";

export interface CorrectionInfo {
  id: ErrorCorrection;
  label: string;
  recovers: string;
  note: string;
}

export const CORRECTION_LEVELS: readonly CorrectionInfo[] = [
  { id: "L", label: "Low", recovers: "~7%", note: "Smallest code. Good for a clean screen or paper." },
  { id: "M", label: "Medium", recovers: "~15%", note: "The usual default, and a sensible one." },
  { id: "Q", label: "Quartile", recovers: "~25%", note: "For print that may get handled or scuffed." },
  { id: "H", label: "High", recovers: "~30%", note: "Only worth it if a logo covers the middle." },
];

/** Beyond this a QR code stops being scannable by a phone in practice. */
export const MAX_QR_CHARS = 1200;

export interface QrCheck {
  ok: boolean;
  error?: string;
  /** Rough guidance shown under the code. */
  hint?: string;
}

export function checkInput(text: string, level: ErrorCorrection): QrCheck {
  const value = text.trim();
  if (!value) return { ok: false, error: "Enter some text or a URL." };
  if (value.length > MAX_QR_CHARS) {
    return {
      ok: false,
      error: `That is ${value.length} characters. Past about ${MAX_QR_CHARS} the grid gets too fine for a phone camera to resolve.`,
    };
  }

  // The failure mode worth warning about, because it looks like it worked.
  if (value.length > 300 && (level === "Q" || level === "H")) {
    return {
      ok: true,
      hint: `${value.length} characters at level ${level} makes a very dense code. Try M, or shorten the text, if it scans slowly.`,
    };
  }
  return { ok: true };
}

/** True when the text will open something, which is worth saying out loud. */
export function looksLikeUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}
