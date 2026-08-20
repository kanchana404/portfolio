/**
 * Lorem ipsum, generated rather than recited.
 *
 * The familiar passage is a corrupted extract from Cicero's *De finibus*
 * (45 BC), which is why it scans as Latin without being it. Most generators
 * paste the same fixed paragraphs, so asking for five gives you the same five
 * every time and any layout that breaks on unusual word lengths never sees one.
 *
 * This assembles sentences from the real Cicero vocabulary instead, with
 * varying sentence and paragraph lengths, so two runs differ and a design gets
 * tested against text that is not always the same shape.
 *
 * The convention of opening with "Lorem ipsum dolor sit amet" is kept as an
 * option and defaults on: it is what makes the block instantly recognisable as
 * placeholder rather than as copy somebody forgot to replace.
 */

const WORDS = [
  "lorem","ipsum","dolor","sit","amet","consectetur","adipiscing","elit","sed","do",
  "eiusmod","tempor","incididunt","ut","labore","et","dolore","magna","aliqua","enim",
  "ad","minim","veniam","quis","nostrud","exercitation","ullamco","laboris","nisi","aliquip",
  "ex","ea","commodo","consequat","duis","aute","irure","in","reprehenderit","voluptate",
  "velit","esse","cillum","eu","fugiat","nulla","pariatur","excepteur","sint","occaecat",
  "cupidatat","non","proident","sunt","culpa","qui","officia","deserunt","mollit","anim",
  "id","est","laborum","perspiciatis","unde","omnis","iste","natus","error","voluptatem",
  "accusantium","doloremque","laudantium","totam","rem","aperiam","eaque","quae","ab","illo",
  "inventore","veritatis","quasi","architecto","beatae","vitae","dicta","explicabo","nemo",
  "voluptas","aspernatur","aut","odit","fugit","consequuntur","magni","dolores","eos","ratione",
];

const OPENING = ["lorem","ipsum","dolor","sit","amet"];

export type LoremUnit = "paragraphs" | "sentences" | "words";

export const LOREM_UNITS: readonly { id: LoremUnit; label: string }[] = [
  { id: "paragraphs", label: "Paragraphs" },
  { id: "sentences", label: "Sentences" },
  { id: "words", label: "Words" },
];

export const MAX_LOREM = 100;

/**
 * Deterministic pseudo-random, seeded.
 *
 * Not `Math.random()`, because the widget renders on the server and again in
 * the browser: an unseeded source would produce different text each time and
 * React would report a hydration mismatch. A seed makes the output reproducible
 * for a given seed and still varied between seeds.
 */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    // xorshift32. Small, fast, and good enough to pick words with.
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
}

function sentence(next: () => number, first: boolean): string {
  const length = 6 + Math.floor(next() * 10);
  const words: string[] = [];
  if (first) words.push(...OPENING);
  while (words.length < length) {
    words.push(WORDS[Math.floor(next() * WORDS.length)]);
  }
  // A comma somewhere in the middle, on longer sentences only.
  if (words.length > 9 && next() > 0.5) {
    const at = 3 + Math.floor(next() * (words.length - 6));
    words[at] = `${words[at]},`;
  }
  const text = words.join(" ");
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

export function generateLorem(
  unit: LoremUnit,
  count: number,
  startWithLorem = true,
  seed = 1
): string {
  const n = Math.max(1, Math.min(MAX_LOREM, Math.floor(count) || 1));
  const next = rng(seed);

  if (unit === "words") {
    const words: string[] = startWithLorem ? [...OPENING] : [];
    while (words.length < n) words.push(WORDS[Math.floor(next() * WORDS.length)]);
    const text = words.slice(0, n).join(" ");
    return `${text[0].toUpperCase()}${text.slice(1)}.`;
  }

  if (unit === "sentences") {
    return Array.from({ length: n }, (_, i) => sentence(next, startWithLorem && i === 0)).join(" ");
  }

  return Array.from({ length: n }, (_, p) => {
    const sentences = 3 + Math.floor(next() * 3);
    return Array.from({ length: sentences }, (_, i) =>
      sentence(next, startWithLorem && p === 0 && i === 0)
    ).join(" ");
  }).join("\n\n");
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
