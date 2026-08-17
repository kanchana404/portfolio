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
    slug: "png-to-jpg",
    title: "PNG to JPG Converter",
    metaTitle: "PNG to JPG Converter — Free, No Upload",
    description:
      "Turn PNG files into JPG on your own device. Transparent areas get a " +
      "white background instead of the black most converters leave behind.",
    category: "image",
    audience: ["general", "designers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    keywords: [
      "png to jpg",
      "png to jpeg",
      "convert png to jpg",
      "png to jpg converter",
      "change png to jpg",
    ],
    intro:
      "Drop PNGs in and get JPGs out, several at once. Nothing is uploaded — " +
      "the conversion happens in this tab, so it works offline and your images " +
      "stay on your machine.",
    howToUse: [
      "Drop your PNG files in, or click to choose them.",
      "Each one converts as it lands. Drop a whole folder if you like.",
      "Drag the quality slider down if you want smaller files.",
      "Save them one at a time, or use Save all.",
    ],
    faqs: [
      {
        q: "Why do transparent parts turn black in other converters?",
        a: "JPG cannot store transparency. A canvas starts out transparent-black, so anything that does not paint a background first encodes those pixels as black. This one fills white before drawing.",
      },
      {
        q: "Will the JPG be smaller than the PNG?",
        a: "Usually, for photographs — often by a lot. For screenshots, logos or flat-colour graphics a PNG is frequently smaller, because those are exactly what PNG compresses well.",
      },
      {
        q: "Does converting lose quality?",
        a: "Yes. JPG is lossy, so detail is discarded and cannot be recovered by converting back. Keep the original PNG if you may need to edit it again.",
      },
    ],
    related: ["image-converter", "avif-to-jpg", "aspect-ratio-calculator"],
  },

  {
    slug: "avif-to-jpg",
    title: "AVIF to JPG Converter",
    metaTitle: "AVIF to JPG Converter (Free, In-Browser)",
    description:
      "Open AVIF images in software that does not support them yet by " +
      "converting them to JPG, without ever sending the file to a server.",
    category: "image",
    audience: ["general"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    keywords: [
      "avif to jpg",
      "avif to jpeg",
      "convert avif",
      "open avif file",
      "avif converter",
    ],
    intro:
      "AVIF saves a lot of space, and plenty of apps still cannot open it. " +
      "This converts to JPG in your browser, so the file goes nowhere and you " +
      "can convert a batch at once.",
    howToUse: [
      "Drop your AVIF files in, or click to choose them.",
      "They decode and convert on this device, several at a time.",
      "Lower the quality slider for smaller files if size matters more than detail.",
      "Save each result, or use Save all.",
    ],
    faqs: [
      {
        q: "Why can't my photo editor open AVIF?",
        a: "It is a comparatively new format. Browsers have decoded it since 2020 or so, but plenty of desktop software and older phones have not caught up, which is why converting is still routine.",
      },
      {
        q: "Can this convert the other way, into AVIF?",
        a: "No, and no honest browser tool can. Chrome does not refuse the request — it quietly returns a PNG instead — so a page offering it would hand you a mislabelled file.",
      },
      {
        q: "Does converting to JPG make the file bigger?",
        a: "Usually yes. AVIF compresses better than JPG at the same visual quality, so the same picture as a JPG generally takes more space. That is the trade for compatibility.",
      },
    ],
    related: ["avif-to-png", "image-converter", "png-to-jpg"],
  },

  {
    slug: "avif-to-png",
    title: "AVIF to PNG Converter",
    metaTitle: "AVIF to PNG — Transparency Kept",
    description:
      "Convert AVIF to PNG right in your browser and keep the alpha channel " +
      "intact. Lossless output, nothing uploaded, and batches are supported.",
    category: "image",
    audience: ["general", "designers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    keywords: [
      "avif to png",
      "convert avif to png",
      "avif png transparent",
      "avif converter png",
    ],
    intro:
      "Pick PNG rather than JPG when the image has transparency to protect, or " +
      "when you need a lossless copy. Everything runs here in the tab, with no " +
      "file leaving your device.",
    howToUse: [
      "Drop your AVIF files in, or click to choose them.",
      "PNG is already selected, so transparency is preserved.",
      "Wait for each thumbnail to appear — that is the converted image, not the original.",
      "Save individually, or use Save all.",
    ],
    faqs: [
      {
        q: "Should I choose PNG or JPG for an AVIF?",
        a: "PNG if the image has transparent areas or you want no further quality loss. JPG if it is a photograph and file size matters more than perfect fidelity.",
      },
      {
        q: "Is transparency really kept?",
        a: "Yes. Both formats carry an alpha channel, so no background is painted in and semi-transparent edges survive the round trip unchanged.",
      },
      {
        q: "Why is the PNG so much larger?",
        a: "PNG is lossless and stores every pixel exactly, while AVIF throws away detail you are unlikely to notice. Several times the original size is normal for a photograph.",
      },
    ],
    related: ["avif-to-jpg", "image-converter"],
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
      "Choose the format you want out: PNG, JPG or WebP.",
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
    related: ["png-to-jpg", "avif-to-png", "avif-to-jpg"],
  },
];
