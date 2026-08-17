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
      "Fill in either the new width or the new height. The other is calculated to match.",
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
    metaTitle: "Image Converter: AVIF, JPEG XL, PNG",
    description:
      "Convert images to PNG, JPG, WebP, AVIF, JPEG XL, TIFF, GIF, ICO and " +
      "more. Animated GIFs keep moving, and nothing is uploaded anywhere.",
    category: "image",
    audience: ["general", "designers", "developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    keywords: [
      "image converter",
      "convert to avif",
      "png to jpg",
      "jpg to png",
      "webp converter",
      "avif converter",
      "jpeg xl converter",
      "png to ico",
    ],
    intro:
      "One page for the common format changes. Pick a target, drop images in, " +
      "and take the results away. Nothing is uploaded and there is no limit " +
      "on how many you convert.",
    howToUse: [
      "Pick the format going in, or leave it on Any.",
      "Pick the format you want out. Twelve are available, including ICO for favicons and AVIF for the web.",
      "Drop your images in. Mixed formats in one batch are fine.",
      "For JPG, WebP, AVIF and JPEG XL, set the quality you want before or after dropping.",
      "Save the files individually, or all at once.",
    ],
    faqs: [
      {
        q: "Which formats can this read?",
        a: "PNG, JPG, WebP, AVIF, GIF and BMP through your browser, plus TGA, QOI, PPM and TIFF this page decodes itself. JPEG XL is native on Safari 17 and fetched elsewhere.",
      },
      {
        q: "Why do AVIF and JPEG XL cost a download?",
        a: "No browser can write either one, so the encoder has to be fetched: 822 kB for AVIF, 378 kB for JPEG XL. Once, and only if you pick it. Every other format here is free.",
      },
      {
        q: "Is AVIF actually smaller than JPG?",
        a: "Usually by a lot. A test photo came out at 94 kB as AVIF against 366 kB as JPG at matching quality, about a quarter the size. That is what the encoder download buys you.",
      },
      {
        q: "Should I use AVIF or JPEG XL?",
        a: "AVIF, unless you have a reason. Every current browser shows AVIF; JPEG XL only Safari, since Chrome dropped it in 2023. JPEG XL is the better archive format, the worse web one.",
      },
      {
        q: "Are my images uploaded?",
        a: "No. Conversion uses your browser's own canvas, so the images are read locally and no copy is sent anywhere. The page works with the network switched off.",
      },
    ],
    related: ["aspect-ratio-calculator"],
  },

];
