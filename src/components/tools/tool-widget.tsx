"use client";

import type { ComponentType } from "react";
import type { WidgetSlug } from "@/lib/tools/widget-slugs";
import { type ConversionSlug, conversionFor } from "@/lib/tools/image/spec";
import AspectRatioCalculator from "./widgets/aspect-ratio-calculator";
import Base64Converter from "./widgets/base64-converter";
import CaseConverter from "./widgets/case-converter";
import CsvJsonConverter from "./widgets/csv-json-converter";
import HashGenerator from "./widgets/hash-generator";
import ImageConverter from "./widgets/image-converter";
import JsonFormatter from "./widgets/json-formatter";
import JwtDecoder from "./widgets/jwt-decoder";
import LoanCalculator from "./widgets/loan-calculator";
import PasswordGenerator from "./widgets/password-generator";
import PercentageCalculator from "./widgets/percentage-calculator";
import SubtitleConverter from "./widgets/subtitle-converter";
import CronExplainer from "./widgets/cron-explainer";
import DataSizeConverter from "./widgets/data-size-converter";
import ImageResizer from "./widgets/image-resizer";
import ChmodCalculator from "./widgets/chmod-calculator";
import EntityConverter from "./widgets/entity-converter";
import PdfToImages from "./widgets/pdf-to-images";
import RegexTester from "./widgets/regex-tester";
import PdfToText from "./widgets/pdf-to-text";
import QrGenerator from "./widgets/qr-generator";
import DateDifference from "./widgets/date-difference";
import LineCleaner from "./widgets/line-cleaner";
import LoremGenerator from "./widgets/lorem-generator";
import NumberBaseConverter from "./widgets/number-base-converter";
import TimestampConverter from "./widgets/timestamp-converter";
import UuidGenerator from "./widgets/uuid-generator";
import TextDiff from "./widgets/text-diff";
import UrlEncoder from "./widgets/url-encoder";
import WordCounter from "./widgets/word-counter";

// Nothing from `./widget-frame` is imported here on purpose: it uses `cx` now,
// but the rule that matters is that this module never reaches for `@/lib/utils`
// — clsx + tailwind-merge is ~21 kB of client JavaScript. Enforced by
// `src/components/tools/ui.test.ts`.

/**
 * Slug → widget.
 *
 * ## These imports are static, and that is a deliberate reversal
 *
 * They were `next/dynamic(() => import(...))` for one commit, which cut
 * `/tools/[slug]` from 121.6 kB to 95.8 kB by giving each widget its own async
 * chunk. That change was measured, documented in ADR 0003, and **wrong**.
 *
 * `next/dynamic` inside a Client Component creates a Suspense boundary. During
 * hydration, if the widget's chunk has not arrived yet, React swaps the
 * server-rendered markup for the (empty) fallback and swaps it back when the
 * chunk lands. `WidgetFrame` then collapses to its `minHeight` floor and springs
 * back — everything below the widget jumps up and down.
 *
 * On a warm localhost the chunk is already there and the gap never opens, so it
 * measured **0.0000 on every tool** and the whole browser suite stayed green.
 * Under Fast 3G with 4× CPU throttling — an ordinary mid-range phone, and what
 * Lighthouse simulates — the same pages measured:
 *
 * | tool                          | warm   | throttled |
 * |-------------------------------|--------|-----------|
 * | compound-interest-calculator  | 0.0000 | **0.2779**|
 * | text-diff-checker             | 0.0000 | **0.2086**|
 * | color-converter               | 0.0000 | **0.1740**|
 * | json-formatter                | 0.0000 | **0.1334**|
 *
 * (Measured against the 17-widget catalogue. `compound-interest-calculator` and
 * `color-converter` have since been retired; the readings are kept because they
 * are the evidence for this decision, not a description of the current tree.)
 *
 * 0.25 is the boundary of Google's "poor" band for Cumulative Layout Shift, and
 * mobile is the indexed viewport. Trading that for 26 kB of gzipped JavaScript
 * on a platform whose entire purpose is search performance is a bad trade, and
 * the measurement that made it look free was taken under conditions no real
 * visitor experiences.
 *
 * Static imports mean all fourteen widgets land in this route's client chunk
 * regardless of which one renders — about 19 kB gzipped, roughly 1.5 kB each.
 * That cost is constant per page load and, crucially, causes no shift: the
 * server-rendered widget is never unmounted.
 *
 * ## The tripwire, restated
 *
 * This is linear in the size of the catalogue, capped at `MAX_TOOLS`. The
 * bundle budget caps the combined cost. **If it fires, do not re-split with
 * `next/dynamic` and do not simply raise the number** — re-splitting reopens the
 * hydration gap above. The fix is to make the widget genuinely absent from the
 * initial render: a heavy widget (WASM, canvas) belongs behind its own
 * `"use client"` wrapper with `dynamic(..., { ssr: false })` *and* a
 * `<WidgetSkeleton>` reserving its settled height, so there is no server markup
 * to lose in the first place.
 *
 * ## Adding a widget
 *
 * Add the slug to `WIDGET_SLUGS` and the component here. The `Record` is typed
 * over the slug union, so doing one without the other is a compile error, and
 * `widget-slugs.ts` separately cross-checks the list against the registry at
 * build time.
 */
const TOOL_WIDGETS: Record<Exclude<WidgetSlug, ConversionSlug>, ComponentType> = {
  // calculators
  "percentage-calculator": PercentageCalculator,
  "loan-calculator": LoanCalculator,
  // text
  "word-counter": WordCounter,
  "case-converter": CaseConverter,
  "text-diff-checker": TextDiff,
  // developer
  "json-formatter": JsonFormatter,
  "base64-encoder-decoder": Base64Converter,
  "hash-generator": HashGenerator,
  "url-encoder-decoder": UrlEncoder,
  "jwt-decoder": JwtDecoder,
  "password-generator": PasswordGenerator,
  "csv-to-json-converter": CsvJsonConverter,
  // image
  "aspect-ratio-calculator": AspectRatioCalculator,
  // video
  "srt-to-vtt": SubtitleConverter,
  // developer
  "uuid-generator": UuidGenerator,
  "timestamp-converter": TimestampConverter,
  "cron-explainer": CronExplainer,
  "number-base-converter": NumberBaseConverter,
  // text
  "lorem-ipsum-generator": LoremGenerator,
  "line-cleaner": LineCleaner,
  // calculators
  "date-difference": DateDifference,
  "data-size-converter": DataSizeConverter,
  // image
  "qr-code-generator": QrGenerator,
  "image-resizer": ImageResizer,
  // pdf
  "pdf-to-text": PdfToText,
  "pdf-to-images": PdfToImages,
  "regex-tester": RegexTester,
  "html-entity-converter": EntityConverter,
  "chmod-calculator": ChmodCalculator,
};

export default function ToolWidget({ slug }: { slug: string }) {
  // Conversion routes share one widget, parameterised by the slug. Checked
  // before the map because those slugs are deliberately absent from it — the
  // `Exclude` above is what keeps the map exhaustive over everything else.
  const conversion = conversionFor(slug);
  if (conversion) return <ImageConverter {...conversion} />;

  const Widget = TOOL_WIDGETS[slug as Exclude<WidgetSlug, ConversionSlug>];

  // Unreachable: widget-slugs.ts throws at module scope if a buildable tool has
  // no widget, so the build fails before this can render. Kept because an
  // indexable page with a silent hole in it is worse than an obvious one.
  if (!Widget) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        This tool is being rebuilt and will be back shortly.
      </p>
    );
  }

  return <Widget />;
}
