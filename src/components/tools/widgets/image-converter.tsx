"use client";

import type { ConversionSpec } from "@/lib/tools/image/spec";
import { lazyWidget } from "../lazy-widget";

/**
 * The image converter, kept out of the shared tools chunk.
 *
 * This is the one widget ADR 0003 anticipated. Every other widget is statically
 * imported, which is deliberate and measured: `dynamic()` with `ssr: true` was
 * shipped once and reverted, because the server markup is unmounted on
 * hydration and the resulting gap took worst-case throttled CLS from 0.0235 to
 * **0.2779** on a platform whose entire purpose is ranking.
 *
 * The ADR leaves exactly one door open, and it is this one:
 *
 * > If a future widget genuinely needs code-splitting — WASM, a large parser —
 * > it must use `dynamic(..., { ssr: false })` with a `<WidgetSkeleton>`
 * > reserving its settled height. With `ssr: false` there is no server-rendered
 * > markup to lose, so no gap exists to shift through.
 *
 * This widget is that case twice over. It carries the canvas pipeline, the
 * animation encoders, and the lazy hooks for libaom and libjxl, and at ~22 kB
 * of source it is the largest in the catalogue — landing on all fifteen tool
 * pages, including the percentage calculator, where none of it can ever run.
 *
 * **320 is measured, not estimated.** It is the settled height of the loaded
 * panel at 375px wide, read from the production build, which is the width where
 * a wrong number costs the most. If the hero layout changes, re-measure it;
 * a stale number here is exactly the shift this file exists to prevent.
 */
const Impl = lazyWidget<ConversionSpec>(
  () => import("./image-converter.impl"),
  320
);

export default function ImageConverter(props: ConversionSpec) {
  return <Impl {...props} />;
}
