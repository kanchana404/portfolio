/**
 * Case conversion.
 *
 * The whole difficulty is tokenisation: every target case is trivial once you
 * know where the word boundaries are, and getting boundaries right means
 * handling all four conventions at once — `helloWorld`, `HelloWorld`,
 * `hello_world`, `hello-world` — plus acronym runs like `parseHTTPResponse`,
 * which must split as `parse | HTTP | Response` and not `parse | H | T | T | P`.
 */

export type CaseId =
  | "lower"
  | "upper"
  | "title"
  | "sentence"
  | "camel"
  | "pascal"
  | "snake"
  | "constant"
  | "kebab"
  | "dot"
  | "alternating"
  | "inverse";

export const CASES: ReadonlyArray<{ id: CaseId; label: string; example: string }> = [
  { id: "lower", label: "lower case", example: "hello world" },
  { id: "upper", label: "UPPER CASE", example: "HELLO WORLD" },
  { id: "title", label: "Title Case", example: "Hello World" },
  { id: "sentence", label: "Sentence case", example: "Hello world" },
  { id: "camel", label: "camelCase", example: "helloWorld" },
  { id: "pascal", label: "PascalCase", example: "HelloWorld" },
  { id: "snake", label: "snake_case", example: "hello_world" },
  { id: "constant", label: "CONSTANT_CASE", example: "HELLO_WORLD" },
  { id: "kebab", label: "kebab-case", example: "hello-world" },
  { id: "dot", label: "dot.case", example: "hello.world" },
  { id: "alternating", label: "aLtErNaTiNg", example: "hElLo WoRlD" },
  { id: "inverse", label: "iNVERSE", example: "hELLO wORLD" },
];

/**
 * Split an identifier or phrase into its words.
 *
 * The acronym rule is the subtle one: an uppercase run followed by a lowercase
 * letter belongs to the *next* word, so `HTTPResponse` splits as
 * `HTTP | Response`. Without it you get `HTTPR | esponse`.
 */
export function splitTokens(input: string): string[] {
  return input
    // boundary between an acronym run and a following capitalised word
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    // boundary between a lowercase/digit and a following capital
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    // separators become spaces
    .replace(/[_\-.\s]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

const cap = (word: string): string =>
  word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase();

/**
 * Words that stay lowercase inside a title, unless they are first or last.
 *
 * This follows the common editorial convention. It is a convention rather than a
 * rule — house styles differ, and the page says so.
 */
const TITLE_MINOR = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "if", "in", "nor", "of",
  "on", "or", "per", "so", "the", "to", "up", "via", "vs", "yet",
]);

export function convertCase(input: string, target: CaseId): string {
  if (input.length === 0) return "";

  switch (target) {
    case "lower":
      return input.toLowerCase();

    case "upper":
      return input.toUpperCase();

    case "alternating":
      // Index over letters only, so spacing does not knock the pattern out of
      // step: "hElLo WoRlD", not "hElLo wOrLd".
      {
        let i = 0;
        let out = "";
        for (const ch of input) {
          if (/\p{L}/u.test(ch)) {
            out += i % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase();
            i += 1;
          } else {
            out += ch;
          }
        }
        return out;
      }

    case "inverse":
      return [...input]
        .map((ch) =>
          ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()
        )
        .join("");

    case "sentence":
      // Preserve the author's paragraph and line structure; only the first
      // letter of each sentence is touched.
      return input
        .toLowerCase()
        .replace(/(^\s*\p{L})|([.!?]\s+\p{L})/gu, (m) => m.toUpperCase());

    case "title":
      return splitTokens(input)
        .map((word, i, all) => {
          const lower = word.toLowerCase();
          const isEdge = i === 0 || i === all.length - 1;
          return !isEdge && TITLE_MINOR.has(lower) ? lower : cap(word);
        })
        .join(" ");

    case "camel":
      return splitTokens(input)
        .map((word, i) => (i === 0 ? word.toLowerCase() : cap(word)))
        .join("");

    case "pascal":
      return splitTokens(input).map(cap).join("");

    case "snake":
      return splitTokens(input).map((w) => w.toLowerCase()).join("_");

    case "constant":
      return splitTokens(input).map((w) => w.toUpperCase()).join("_");

    case "kebab":
      return splitTokens(input).map((w) => w.toLowerCase()).join("-");

    case "dot":
      return splitTokens(input).map((w) => w.toLowerCase()).join(".");
  }
}

/**
 * URL slug.
 *
 * Kept separate from `kebab-case` because it does more: it strips diacritics via
 * NFD normalisation so "Café Münster" becomes "cafe-munster" rather than
 * "café-münster", and it drops anything that is not alphanumeric. A slug that
 * still contains an umlaut is a slug that gets percent-encoded into noise.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
