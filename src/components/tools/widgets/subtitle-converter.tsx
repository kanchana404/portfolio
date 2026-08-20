"use client";

import { lazyWidget } from "../lazy-widget";

/**
 * The subtitle converter, kept out of the shared tools chunk.
 *
 * The second widget to take ADR 0003's exception, and it qualifies on the
 * clause the image converter did not use: the ADR permits code-splitting for
 * "WASM, a large parser", and this is the parser. It carries the SRT and WebVTT
 * readers and writers, cue-level search, and a timing shifter, which is ~19 kB
 * of source landing on the JSON formatter and every calculator, where none of
 * it can run.
 *
 * `ssr: false` plus a reserved box is the whole of the exception. `ssr: true`
 * splitting is the thing that reversal exists to prevent: the server markup is
 * unmounted on hydration and the gap took worst-case throttled CLS to 0.2779.
 *
 * **236 is measured, not estimated** — the settled height of the loaded panel
 * at 375px wide, read from a production build. Re-measure it if the empty state
 * changes shape, because a stale number here reintroduces exactly the shift
 * this file is arranged to avoid.
 */
const Impl = lazyWidget(() => import("./subtitle-converter.impl"), 236);

export default function SubtitleConverter() {
  return <Impl />;
}
