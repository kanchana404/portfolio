import type { ToolDef } from "../types";

/**
 * PDF tools. These are the only tools that require the server.
 *
 * Every other tool in the catalogue runs in the browser and says so. These two
 * cannot: there is no PDF text extractor worth shipping to a tab, and rendering
 * a page needs poppler. So `compute` is `railway`, which makes the meta row on
 * the page read "Processed on my server, then deleted" rather than the
 * browser-only claim, and the widgets ask before sending anything.
 */
export const PDF_TOOLS: readonly ToolDef[] = [
  {
    slug: "pdf-to-text",
    title: "PDF to Text",
    metaTitle: "Extract Text From a PDF",
    description:
      "Pull the text out of a PDF, page by page, and copy it. Tells you when " +
      "a file is a scan with no text rather than returning an empty result.",
    category: "pdf",
    audience: ["general", "developers"],
    compute: "railway",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "pdf to text",
      "extract text from pdf",
      "copy text from pdf",
      "pdf text extractor",
      "convert pdf to text",
    ],
    intro:
      "Choose a PDF, confirm the upload, and read its text back page by page. " +
      "The file is parsed in memory and never written to disk, and only the " +
      "text comes back.",
    howToUse: [
      "Choose your PDF. Nothing is sent at this point.",
      "Confirm on the next step. That is the click that uploads it.",
      "Read the text page by page, or copy the whole document at once.",
      "If the file is a scan, the page says so instead of showing blank results.",
      "Password-protected files are refused rather than opened.",
    ],
    faqs: [
      {
        q: "Why is there no text in my PDF?",
        a: "It is probably a scan. A scanned document is images of paper with no text layer, so there are no characters to extract. Reading them needs OCR, which is a different job.",
      },
      {
        q: "Is my PDF uploaded?",
        a: "Yes, and only after you confirm. This is the one thing a browser genuinely cannot do alone. The file is parsed in memory, never written to disk, and nothing is kept after the response.",
      },
      {
        q: "Does the layout survive?",
        a: "Not reliably. A PDF stores glyphs at coordinates rather than paragraphs, so columns and tables come out in reading order at best. The text is right; the shape of it usually is not.",
      },
      {
        q: "Can it open a protected PDF?",
        a: "No. Some tools will open a password-protected file with an empty password. That protection was a decision the author made, so it is refused here rather than worked around.",
      },
      {
        q: "Is there a size limit?",
        a: "80 MB and 200 pages. Both exist so one large document cannot hold the service up for everybody else.",
      },
    ],
    caveats:
      "This is the one tool here that uploads your file, because no browser can " +
      "extract PDF text on its own. Nothing is sent until you confirm, the file " +
      "is parsed in memory rather than written to disk, and nothing is kept " +
      "after the response. Even so, think twice before putting a contract or an " +
      "identity document through any web tool, including this one.",
    related: ["pdf-to-images", "word-counter"],
  },

  {
    slug: "pdf-to-images",
    title: "PDF to Images",
    metaTitle: "Convert PDF Pages to PNG",
    description:
      "Render every page of a PDF as a PNG image, one per page, and download " +
      "them individually. Useful when a page has to become a picture.",
    category: "pdf",
    audience: ["general", "designers"],
    compute: "railway",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "pdf to png",
      "pdf to image",
      "convert pdf pages to images",
      "pdf page to picture",
      "export pdf pages",
    ],
    intro:
      "Choose a PDF, confirm, and each page comes back as a PNG at 150 dpi. " +
      "Pages arrive one at a time, so the first is visible while the rest are " +
      "still rendering.",
    howToUse: [
      "Choose your PDF. Nothing is sent at this point.",
      "Confirm on the next step to upload it.",
      "Pages appear as they finish rendering rather than all at the end.",
      "Save the pages you want. Each is a separate PNG.",
      "For text you can select, use the PDF to Text tool instead.",
    ],
    faqs: [
      {
        q: "What resolution are the images?",
        a: "150 dpi, which is legible on screen and roughly a quarter of the pixels of 300 dpi. Higher would mean slower rendering and much larger files for output that is usually viewed, not printed.",
      },
      {
        q: "Why one page at a time?",
        a: "A hundred pages rendered at once is about a gigabyte of pixels held on both ends. Rendering page by page keeps memory flat and puts the first page on screen almost immediately.",
      },
      {
        q: "Is my PDF uploaded?",
        a: "Yes, after you confirm. Rendering needs poppler, which does not exist in a browser. The file is read in memory, never written to disk, and nothing is kept afterwards.",
      },
      {
        q: "Can I get one long image instead?",
        a: "No, and deliberately. A single tall image of a fifty-page document is unusable in almost every context, and joining pages is easier than splitting them apart again.",
      },
      {
        q: "Why PNG and not JPEG?",
        a: "PDFs are mostly text and line art, which JPEG blurs at edges. PNG is lossless, so the text stays sharp. For a photographic page the file will be larger, which is the right trade here.",
      },
    ],
    caveats:
      "Rendering needs poppler, which does not exist in a browser, so this tool " +
      "uploads your file after you confirm. It is read in memory, never written " +
      "to disk, and discarded once the pages come back. Apply the usual caution " +
      "you would to any document you would not email.",
    related: ["pdf-to-text", "image-converter"],
  },
];
