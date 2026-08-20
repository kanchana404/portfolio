import type { ToolDef } from "../types";

/**
 * Text tools.
 *
 * Copy lives here rather than in `registry.ts` so the registry stays a short,
 * readable index as the set grows toward the cap. Every field is validated at
 * build time — see `../validate.ts` for the rules and why each exists.
 */
export const TEXT_TOOLS: readonly ToolDef[] = [
  {
    slug: "word-counter",
    title: "Word Counter",
    metaTitle: "Word Counter with Reading Time",
    description:
      "Count words, characters, sentences and paragraphs as you type, with " +
      "reading and speaking time. Handles Chinese and Sinhala. Nothing uploaded.",
    category: "text",
    audience: ["students", "general", "job-seekers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "word counter",
      "character counter",
      "count words online",
      "reading time calculator",
      "words to minutes",
      "essay word count",
    ],
    intro:
      "Counts words, characters, sentences and paragraphs as you type, and " +
      "estimates reading and speaking time. Works on Chinese, Japanese and " +
      "Sinhala, which space-splitting counters get wrong.",
    howToUse: [
      "Paste or type your text into the box. Counts update on every keystroke.",
      "Read the word and character counts at the top. Characters are shown both with and without spaces.",
      "Check the reading time if you are writing something to be read, or the speaking time if you are writing a talk.",
      "For a word limit, watch the word count; for a social or SMS limit, watch characters with spaces.",
      "Clear the box when you are done. Nothing is saved, and reloading the page discards everything.",
    ],
    faqs: [
      {
        q: "Does it count words the same way Word does?",
        a: "Very closely for ordinary prose. Differences appear with hyphenated compounds and numbers with separators, where different tools draw the boundary in different places.",
      },
      {
        q: "How is reading time calculated?",
        a: "At 238 words per minute, the average for silent reading of general prose in published research. Speaking time uses 130 words per minute, a comfortable presentation pace.",
      },
      {
        q: "Does it work with Sinhala or Chinese?",
        a: "Yes. It uses the browser's own text segmentation rather than splitting on spaces, so scripts that do not put spaces between words are counted properly.",
      },
    ],
    related: ["case-converter", "text-diff-checker"],
  },

  {
    slug: "case-converter",
    title: "Case Converter",
    metaTitle: "Case Converter: 12 Formats",
    description:
      "Switch text between camelCase, snake_case, kebab-case, Title Case and " +
      "eight more. Handles acronyms correctly. Includes a URL slug maker.",
    category: "text",
    audience: ["developers", "students", "general"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "case converter",
      "camelcase converter",
      "snake case converter",
      "title case converter",
      "kebab case",
      "url slug generator",
    ],
    intro:
      "Converts text between twelve cases (camelCase, snake_case, kebab-case, " +
      "Title Case and the rest) and makes URL slugs. Acronyms like HTTP and XML " +
      "are handled properly rather than split letter by letter.",
    howToUse: [
      "Paste your text into the input box.",
      "Every format is produced at once. Scroll the list and copy the one you need.",
      "Use the copy button beside a format rather than selecting the text by hand.",
      "For a URL slug, use the slug row: it strips accents, punctuation and doubled hyphens.",
      "Convert one identifier at a time for best results. A whole paragraph becomes one very long camelCase word.",
    ],
    faqs: [
      {
        q: "Does it handle acronyms like HTTP or XML correctly?",
        a: "Yes, and this is the case most converters get wrong. parseHTTPResponse becomes parse_http_response rather than parse_h_t_t_p_response, because an uppercase run followed by a capitalised word is treated as one token.",
      },
      {
        q: "Why do URLs use hyphens but code uses underscores?",
        a: "Hyphens read as subtraction in most programming languages, so identifiers cannot use them. URLs have no such constraint, and search engines have long treated hyphens as word separators.",
      },
      {
        q: "Can I convert a whole file?",
        a: "Paste it in. There is no length limit beyond what your browser can hold. Very large documents feel slower to type into, since every keystroke recomputes, but nothing is truncated.",
      },
    ],
    related: ["word-counter", "url-encoder-decoder", "text-diff-checker"],
  },

  {
    slug: "text-diff-checker",
    title: "Text Diff Checker",
    metaTitle: "Text Diff Checker: Compare Texts",
    description:
      "Compare two texts and see exactly which lines were added, removed or " +
      "kept, aligned properly rather than line by line. Runs in your browser.",
    category: "text",
    audience: ["developers", "students", "general"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "text diff",
      "diff checker",
      "compare two texts",
      "text comparison tool",
      "find differences between two files",
    ],
    intro:
      "Paste two versions of the same text and see what changed. Added lines are " +
      "green, removed lines are red, and both sides keep their own line numbers. " +
      "Inserting a line does not turn everything below it red.",
    howToUse: [
      "Paste the original into the left box and the changed version into the right.",
      "Read the counts (added, removed, unchanged), then scroll the comparison below them.",
      "Turn on \"ignore leading and trailing spaces\" if indentation changes are cluttering the result.",
      "Turn on \"ignore case\" when only capitalisation differs and you do not care about it.",
      "If two lines look identical but show as different, an invisible character is usually the cause.",
    ],
    faqs: [
      {
        q: "Does it compare word by word or line by line?",
        a: "Line by line. Changing one word marks the whole line as removed and re-added. That suits code and configuration; for prose, a word-level tool reads more naturally.",
      },
      {
        q: "Is my text uploaded anywhere?",
        a: "No. The comparison runs entirely in your browser, which is the point for contracts, config files with hostnames in them, or unreleased copy. Nothing is transmitted or stored.",
      },
      {
        q: "How large a text can it handle?",
        a: "Comfortably into the thousands of lines when the two mostly agree, because the identical head and tail are skipped first. Two entirely different large documents hit a safety cap and are shown as a wholesale replacement.",
      },
    ],
    related: ["word-counter", "case-converter", "json-formatter"],
  },

  {
    slug: "lorem-ipsum-generator",
    title: "Lorem Ipsum Generator",
    metaTitle: "Lorem Ipsum Generator",
    description:
      "Generate placeholder text by paragraph, sentence or exact word count. " +
      "Every run differs, so a layout gets tested against more than one shape.",
    category: "text",
    audience: ["designers", "developers", "general"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "lorem ipsum generator",
      "placeholder text",
      "dummy text generator",
      "lorem ipsum paragraphs",
      "filler text",
    ],
    intro:
      "Pick paragraphs, sentences or a word count and copy the result. The text " +
      "is assembled from the original Cicero vocabulary rather than pasted from " +
      "a fixed block, so press Shuffle and the shape changes.",
    howToUse: [
      "Choose paragraphs, sentences or words.",
      "Set how many. Words gives you that count exactly, which is what a field limit needs.",
      "Leave Start with Lorem ipsum on so the block reads as placeholder at a glance.",
      "Press Shuffle for a different set at the same size.",
      "Copy it out with the button.",
    ],
    faqs: [
      {
        q: "Where does lorem ipsum come from?",
        a: "It is a corrupted extract from Cicero's De finibus, written in 45 BC. That is why it scans like Latin without quite being it, and why it has been used as placeholder since the 1500s.",
      },
      {
        q: "Why does the text change every time?",
        a: "Because a fixed block only ever tests one shape. Varying sentence and paragraph length is how a layout meets a long word or a short line before a real user does.",
      },
      {
        q: "Can I get an exact word count?",
        a: "Yes. Choose Words and the output is exactly that many, which is what you need when checking a character or word limit on a field.",
      },
      {
        q: "Should I ship lorem ipsum to a real page?",
        a: "No. It hides how real copy will fit, and it has a habit of surviving into production. It is for the stage before the words exist, not a substitute for them.",
      },
    ],
    related: ["word-counter", "case-converter"],
  },

  {
    slug: "line-cleaner",
    title: "Remove Duplicate Lines",
    metaTitle: "Remove Duplicate Lines and Sort",
    description:
      "Deduplicate, sort, trim and strip blank lines from a list, in the order " +
      "that gives the answer you meant rather than the order you ticked them.",
    category: "text",
    audience: ["developers", "general"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "remove duplicate lines",
      "sort lines online",
      "deduplicate list",
      "remove blank lines",
      "text line tools",
    ],
    intro:
      "Paste a list and clean it up. Trailing spaces are removed before " +
      "duplicates are matched, so entries that differ only by whitespace " +
      "collapse the way you would expect them to.",
    howToUse: [
      "Paste your lines into the box.",
      "Turn on the operations you want. They apply as you type.",
      "Sorting is separate from reversing, so you can sort then flip.",
      "The counts tell you how many lines went in, came out and were dropped.",
      "Copy the result out with the button.",
    ],
    faqs: [
      {
        q: "Why do my duplicates not collapse elsewhere?",
        a: "Because trailing spaces are usually matched too. Entry and entry-with-a-space are different strings. This page trims before comparing, which is almost always what was meant.",
      },
      {
        q: "Does it handle files from Windows?",
        a: "Yes. Windows line endings carry a carriage return as well as a newline, and tools that split on the newline alone leave it attached, after which no two lines ever match.",
      },
      {
        q: "Why does item10 come after item2?",
        a: "Because sorting is numeric-aware. A plain character sort puts item10 before item2, since the character 1 sorts before 2, which is almost never what a person means by sorted.",
      },
      {
        q: "Which line survives deduplication?",
        a: "The first one. Later copies are dropped, so the original order of what remains is preserved unless you also sort.",
      },
    ],
    related: ["case-converter", "word-counter"],
  },
];
