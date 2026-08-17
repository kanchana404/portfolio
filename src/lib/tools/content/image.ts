import type { ToolDef } from "../types";

/** Image and design tools. Pure browser, no upload. */
export const IMAGE_TOOLS: readonly ToolDef[] = [
  {
    slug: "aspect-ratio-calculator",
    title: "Aspect Ratio Calculator",
    metaTitle: "Aspect Ratio Calculator",
    description:
      "Work out an aspect ratio from any width and height, or resize while " +
      "keeping the ratio. Covers 16:9, 4:3, 1:1, 21:9 and anything else.",
    category: "image",
    audience: ["designers", "developers", "general"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "aspect ratio calculator",
      "16:9 calculator",
      "resize keeping aspect ratio",
      "image ratio calculator",
      "screen aspect ratio",
    ],
    intro:
      "Give it a width and a height and it reduces them to the simplest ratio, " +
      "naming it if it is a standard one. Or fix one dimension and it works out " +
      "the other so nothing stretches.",
    howToUse: [
      "Enter the current width and height to see the simplified ratio.",
      "If it matches a standard like 16:9 or 4:3, the name is shown next to it.",
      "To resize, switch to the second panel and enter the ratio you want.",
      "Fill in either the new width or the new height — the other is calculated to match.",
      "Always let one dimension follow the other. Setting both by hand is what stretches an image.",
    ],
    faqs: [
      {
        q: "How do I resize an image without distorting it?",
        a: "Change one dimension and let the other follow the original ratio, which is what the second panel here does. Setting both independently stretches the image, and stretched faces are immediately obvious.",
      },
      {
        q: "Is 1366×768 really 16:9?",
        a: "Almost, but not exactly. It reduces to 683:384, slightly wider than true 16:9. It was a common laptop resolution chosen for panel manufacturing reasons rather than mathematical tidiness.",
      },
      {
        q: "What does 21:9 actually mean on a monitor?",
        a: "It is a marketing label for ultrawide displays rather than a precise ratio. Common ultrawide resolutions such as 2560×1080 and 3440×1440 work out to roughly 2.37:1 and 2.39:1.",
      },
    ],
    related: ["percentage-calculator", "image-converter"],
  },

  {
    slug: "image-converter",
    title: "Image Converter",
    metaTitle: "Free Image Converter — PNG, JPG, WebP",
    description:
      "Change images between PNG, JPG and WebP in one place. Reads AVIF, GIF " +
      "and BMP too, and every file is processed on your own device.",
    category: "image",
    audience: ["general", "designers", "developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    keywords: [
      "image converter",
      "convert image format",
      "jpg to png",
      "webp converter",
      "image format converter",
      "free image converter",
    ],
    intro:
      "One page for the common format changes. Pick a target, drop images in, " +
      "and take the results away — nothing is uploaded and there is no limit " +
      "on how many you convert.",
    howToUse: [
      "Pick the format going in, or leave it on Any.",
      "Pick the format you want out: PNG, JPG or WebP.",
      "Drop your images in. Mixed formats in one batch are fine.",
      "For JPG and WebP, set the quality you want before or after dropping.",
      "Save the files individually, or all at once.",
    ],
    faqs: [
      {
        q: "Which formats can this read?",
        a: "Anything your browser decodes: PNG, JPG, WebP, AVIF, GIF and BMP. Animated GIFs convert their first frame only, since the output formats hold a single image.",
      },
      {
        q: "Why is WebP missing from the options?",
        a: "Then your browser cannot write it — Safari is the usual case. The tool asks the browser what it can encode and hides anything it cannot, rather than saving a mislabelled file.",
      },
      {
        q: "Is there a file size or count limit?",
        a: "No imposed limit. The practical ceiling is your device's memory, and very large images are refused with an explanation rather than producing a blank file.",
      },
      {
        q: "Are my images uploaded?",
        a: "No. Conversion uses your browser's own canvas, so the images are read locally and no copy is sent anywhere. The page works with the network switched off.",
      },
    ],
    related: ["aspect-ratio-calculator"],
  },

];
