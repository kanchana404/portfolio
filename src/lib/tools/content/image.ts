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

  {
    slug: "qr-code-generator",
    title: "QR Code Generator",
    metaTitle: "QR Code Generator (SVG)",
    description:
      "Turn a link or any text into a QR code and download it as SVG, so it " +
      "stays sharp at poster size. Nothing is uploaded and no account is needed.",
    category: "image",
    audience: ["general", "designers", "developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "qr code generator",
      "free qr code",
      "url to qr code",
      "qr code svg",
      "make a qr code",
    ],
    intro:
      "Paste a link and take the code away. It is generated in your browser and " +
      "downloads as SVG rather than a fixed-size image, so the same file works " +
      "on a business card and on a shop window.",
    howToUse: [
      "Paste the URL or text you want encoded.",
      "Leave error correction on Medium unless you have a reason to change it.",
      "Check the code with your own phone before printing anything.",
      "Download the SVG, or copy it straight into your markup.",
      "For a poster, scale the SVG rather than enlarging a PNG.",
    ],
    faqs: [
      {
        q: "Which error correction level should I use?",
        a: "Medium. The levels are how much damage the code can survive, not how good it looks, and higher levels make the grid denser because the redundancy has to go somewhere.",
      },
      {
        q: "Why is my QR code hard to scan?",
        a: "Usually too much text. Capacity is fixed, so a long URL packs more squares into the same area. Shortening the link helps far more than raising the correction level.",
      },
      {
        q: "Why SVG rather than PNG?",
        a: "A QR code is squares, so it should be vector. An SVG stays crisp from a business card to a billboard, while a PNG has to be generated at one size and blurs beyond it.",
      },
      {
        q: "Do these codes expire?",
        a: "No. The link is encoded in the squares themselves, so there is no redirect in the middle and nothing to switch off later. Services that offer editable codes work by pointing at their own domain first.",
      },
      {
        q: "Is my link sent anywhere?",
        a: "No. The code is generated in your browser, so the page works offline once loaded and nobody records what you encoded.",
      },
    ],
    related: ["image-converter", "url-encoder-decoder"],
  },

  {
    slug: "image-resizer",
    title: "Image Resizer",
    metaTitle: "Resize Images Without Distortion",
    description:
      "Resize photos by longest side, width, height or percent, in batches, " +
      "with the aspect ratio held automatically and nothing uploaded.",
    category: "image",
    audience: ["general", "designers", "developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "image resizer",
      "resize image online",
      "bulk image resize",
      "reduce image size",
      "resize photo",
    ],
    intro:
      "Set one dimension and the other follows, so nothing stretches. Drop in " +
      "as many images as you like; they are resized by your own browser and " +
      "never leave the device.",
    howToUse: [
      "Choose what to set: longest side is usually what you want for a batch of mixed orientations.",
      "Enter the size. Only one dimension is ever set by hand; the other is calculated.",
      "Add your images. Portrait and landscape can be mixed freely.",
      "Anything already smaller than the target is left alone unless you allow upscaling.",
      "Save each result, and check the size saving shown beside it.",
    ],
    faqs: [
      {
        q: "Why can I not set width and height separately?",
        a: "Because setting both is what stretches an image, and stretched faces are the one distortion everybody notices. One dimension is yours, the other follows from the original ratio.",
      },
      {
        q: "Why did my image stay the same size?",
        a: "It was already smaller than the target. Enlarging cannot invent detail; it makes a softer, larger file. Turn on Allow upscaling if you genuinely want that.",
      },
      {
        q: "Will resizing rotate my phone photos?",
        a: "No. The rotation flag phones write into a photo is read on decode, so a portrait shot stays portrait. Losing that flag is the usual reason a resized photo comes out sideways.",
      },
      {
        q: "Why is my PNG bigger than the JPEG?",
        a: "PNG is lossless, so a photograph stored as PNG is often larger than the JPEG it came from. PNGs stay PNG here; everything else is written as JPEG at high quality.",
      },
      {
        q: "Is there a file size limit?",
        a: "Only what your device can hold. The work happens in your browser, so there is no upload, no queue and no account.",
      },
    ],
    related: ["image-converter", "aspect-ratio-calculator"],
  },
];
