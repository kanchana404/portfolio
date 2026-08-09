/**
 * Text statistics.
 *
 * The interesting problem here is "what is a word", and almost every free word
 * counter answers it with `text.split(/\s+/)`. That is wrong for a large share
 * of the world's writing: Chinese, Japanese and Thai do not put spaces between
 * words, so whitespace splitting reports a 400-word Chinese paragraph as one
 * word. It also miscounts hyphenates and contractions in English.
 *
 * `Intl.Segmenter` is the correct tool and is available in Node 18+ and every
 * current browser. Where it is missing the code degrades to whitespace
 * splitting rather than throwing — a slightly wrong count beats a blank page.
 */

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  /** Minutes, at an average adult silent-reading pace. */
  readingMinutes: number;
  /** Minutes, at an average speaking pace. */
  speakingMinutes: number;
  longestWord: string;
}

/**
 * Words per minute for silent reading of English prose.
 *
 * 238 is the mean from Brysbaert's 2019 meta-analysis of 190 studies, which is
 * the most defensible single figure available. The 200/250 numbers most tools
 * use are folklore.
 */
export const READING_WPM = 238;

/** Words per minute for comfortable speech — the usual guidance for presenters. */
export const SPEAKING_WPM = 130;

type SegmenterCtor = typeof Intl.Segmenter;

function getSegmenter(): Intl.Segmenter | null {
  const ctor = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (typeof ctor !== "function") return null;
  try {
    return new ctor(undefined, { granularity: "word" });
  } catch {
    return null;
  }
}

const segmenter = getSegmenter();

/**
 * Split into words.
 *
 * Exported because the sentence and longest-word figures need the same notion of
 * a word, and two different definitions inside one panel is how a tool ends up
 * reporting 12 words and a longest word that is not among them.
 */
export function splitWords(text: string): string[] {
  if (segmenter) {
    const out: string[] = [];
    for (const segment of segmenter.segment(text)) {
      // `isWordLike` is what excludes spaces, punctuation and emoji while
      // keeping CJK characters, which are each a word.
      if (segment.isWordLike) out.push(segment.segment);
    }
    return out;
  }
  const trimmed = text.trim();
  return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
}

/**
 * Count sentences.
 *
 * Terminators are `.`, `!`, `?` and their fullwidth equivalents, collapsed so
 * that "Wait?!" is one sentence rather than two. This deliberately over-counts
 * on abbreviations ("Dr. Smith") and under-counts on prose that runs on with
 * semicolons — no regex gets this exactly right, and the page says so rather
 * than implying precision it does not have.
 */
function countSentences(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  const matches = trimmed.match(/[^.!?。！？]+[.!?。！？]*/g);
  if (!matches) return 0;
  return matches.filter((s) => s.trim().length > 0).length;
}

export function analyzeText(text: string): TextStats {
  const words = splitWords(text);

  // Iterate rather than use `.length`: an emoji is two UTF-16 units, and a user
  // counting characters for a form limit means what they can see.
  let characters = 0;
  let charactersNoSpaces = 0;
  for (const ch of text) {
    characters += 1;
    if (!/\s/.test(ch)) charactersNoSpaces += 1;
  }

  const paragraphs =
    text.trim().length === 0
      ? 0
      : text
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean).length;

  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;

  let longestWord = "";
  for (const word of words) {
    if ([...word].length > [...longestWord].length) longestWord = word;
  }

  return {
    characters,
    charactersNoSpaces,
    words: words.length,
    sentences: countSentences(text),
    paragraphs,
    lines,
    readingMinutes: words.length / READING_WPM,
    speakingMinutes: words.length / SPEAKING_WPM,
    longestWord,
  };
}

/**
 * Render a duration in minutes as something a person would say.
 *
 * Anything under a minute is reported in seconds, because "0.3 min" is not how
 * anyone thinks about a short read.
 */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 sec";
  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins < 60) return secs === 0 ? `${mins} min` : `${mins} min ${secs} sec`;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}
