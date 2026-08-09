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
    related: ["percentage-calculator", "color-converter"],
  },

  {
    slug: "color-converter",
    title: "Color Converter and Contrast Checker",
    metaTitle: "Color Converter and Contrast",
    description:
      "Convert a color between HEX, RGB, HSL and OKLCH, and check its WCAG " +
      "contrast ratio against any background. Everything runs in your browser.",
    category: "image",
    audience: ["designers", "developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "color converter",
      "hex to rgb",
      "rgb to hex",
      "hsl converter",
      "oklch converter",
      "contrast checker",
      "wcag contrast ratio",
    ],
    intro:
      "Type a color in any notation — hex, a CSS name, rgb, hsl or oklch — and " +
      "get every other format back, plus its WCAG contrast ratio against a " +
      "background you choose and a perceptually even tint scale.",
    howToUse: [
      "Type or paste a color into the first box. Hex works with or without the leading hash.",
      "Copy whichever format you need from the list — hex, rgb, hsl or oklch.",
      "Set the second box to the background the color will sit on to get the contrast ratio.",
      "Check the badges: AA needs 4.5:1 for body text and 3:1 for large text or UI elements.",
      "Use the tint scale at the bottom as a starting palette — it steps through OKLCH, so the shades read evenly.",
    ],
    faqs: [
      {
        q: "What contrast ratio do I need to pass WCAG?",
        a: "4.5:1 for body text and 3:1 for large text at level AA, where large means 18.66px bold or 24px regular and above. Level AAA raises those to 7:1 and 4.5:1.",
      },
      {
        q: "What is OKLCH and why use it over HSL?",
        a: "It is perceptually uniform, meaning equal numeric steps look like equal visual steps. HSL does not have that property, which is why palettes made by stepping HSL lightness look uneven through the middle.",
      },
      {
        q: "Why does the contrast ratio ignore transparency?",
        a: "Because a translucent color does not have one. What it contrasts against depends on whatever sits behind it, and a confident wrong answer is worse than none.",
      },
    ],
    related: ["aspect-ratio-calculator", "percentage-calculator"],
  },
];
