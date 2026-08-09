> Part of [SPRINT-PLAN.md](SPRINT-PLAN.md). **Part II (Amendments) overrides anything below it.**

## Sprint 2 — The file spine, part 1: exact-KB PDF compressor + exam photo/signature resizer

**Sprint goal** — Ship two 100% client-side tools (`/tools/compress-pdf-to-exact-size`, `/tools/resize-photo-signature-for-exam-forms`) on top of one shared binary-search-to-target-size engine, with zero Railway spend and zero Vercel function invocations.

**Duration** — 2 weeks (30–40h). **Depends on** — Sprint 0 (route groups, strict build) ✅ done; Sprint 1 (registry + `validate.ts` + `/tools` hub + `/tools/[slug]` static template + `ToolShell` chrome) must be merged and deployed. Nothing here depends on Railway.

---

### Definition of Ready

- [ ] `src/lib/tools/registry.ts` exists, exports `TOOLS: Tool[]`, and calls `validateRegistry(TOOLS)` at module scope.
- [ ] `/tools/[slug]/page.tsx` exports `dynamicParams = false` and `generateStaticParams()` from the registry; adding a registry entry produces a statically generated page with no rebuild of the template.
- [ ] The page template renders `<Widget />` above the fold and accepts a `next/dynamic(..., { ssr: false })` component from a per-tool map.
- [ ] `pnpm build` passes with 0 tsc errors on `tools-platform-phase0` (already true as of Sprint 0).
- [ ] Deps added and lockfile committed: `pdfjs-dist@^4.7`, `pdf-lib@^1.17`, `@mediapipe/tasks-vision@^0.10`; dev: `vitest@^2`, `@vitest/coverage-v8`, `@playwright/test@^1.48`.
- [ ] MediaPipe assets self-hosted, **not** CDN-loaded (CSP + the offline proof depends on it): `public/vendor/mediapipe/wasm/*` and `public/vendor/mediapipe/blaze_face_short_range.tflite`, vendored by a `scripts/vendor-mediapipe.mjs` step, committed, ~3.2MB total.
- [ ] A decision is recorded (in the PR description) that **no file in `src/lib/tools/**` or either widget imports from `@db`**. The Sprint 1 ESLint `no-restricted-imports` rule covering `src/app/(tools)/**` is extended to `src/lib/tools/**`.
- [ ] Exam preset numbers (pixel dimensions and KB ceilings) have been read off the actual issuing-authority pages within the last 30 days and each preset carries a `source` URL and `verifiedOn` date in code.

---

### Tickets

---

### [CORE--01] `compressToTarget` — codec-agnostic binary search to an exact byte ceiling

**Estimate:** 4h · **Depends on:** — · **Files:** `src/lib/tools/compress/compress-to-target.ts`, `src/lib/tools/compress/errors.ts`, `src/lib/tools/compress/__tests__/compress-to-target.test.ts`

**Why** — Both tools solve the same problem: "produce a file that is ≤ N KB and as good as possible." Writing that once, as a pure function over an injected `encode(quality)` closure, means the PDF path and the image path share a single tested convergence loop and a single failure taxonomy. The engine must never return a file over the ceiling — that is the whole product promise — and must never wildly *undershoot*, because a 30 KB file when the user asked for 200 KB is a quality bug that users read as "this tool is bad."

**Implementation**

```ts
// src/lib/tools/compress/errors.ts

/** The encoder cannot reach the target at these dimensions, even at minQuality. */
export class TargetUnreachableError extends Error {
  readonly code = "TARGET_UNREACHABLE" as const;
  constructor(
    readonly targetBytes: number,
    readonly minAchievableBytes: number,
    readonly atQuality: number,
  ) {
    super(
      `Cannot reach ${targetBytes} bytes: smallest output at quality ${atQuality} is ${minAchievableBytes} bytes.`,
    );
    this.name = "TargetUnreachableError";
  }
}

/** The user (or a memory guard) aborted the job. */
export class JobCancelledError extends Error {
  readonly code = "CANCELLED" as const;
  constructor() {
    super("Job cancelled.");
    this.name = "JobCancelledError";
  }
}

export class SourceUnsupportedError extends Error {
  readonly code = "SOURCE_UNSUPPORTED" as const;
  constructor(message: string) {
    super(message);
    this.name = "SourceUnsupportedError";
  }
}
```

```ts
// src/lib/tools/compress/compress-to-target.ts
import { JobCancelledError, TargetUnreachableError } from "./errors";

export interface Probe {
  iteration: number;
  quality: number;
  bytes: number;
}

export interface CompressToTargetOptions {
  /** Hard ceiling in bytes. The returned blob is guaranteed <= this. */
  targetBytes: number;
  /**
   * Encode the source at `quality` in [0,1] and return the encoded bytes.
   * MUST be deterministic for a given quality — the search re-probes.
   */
  encode: (quality: number, signal: AbortSignal) => Promise<Blob>;
  minQuality?: number;
  maxQuality?: number;
  /**
   * Stop early once the result is within this fraction *under* the target.
   * 0.05 => a 200KB target accepts anything in [190KB, 200KB].
   */
  tolerance?: number;
  maxIterations?: number;
  onProbe?: (probe: Probe) => void;
  signal?: AbortSignal;
}

export interface CompressResult {
  blob: Blob;
  quality: number;
  iterations: number;
  /** Every probe taken, oldest first. Surfaced in the dev panel and in tests. */
  probes: Probe[];
}

const DEFAULTS = {
  minQuality: 0.3,
  maxQuality: 0.94,
  tolerance: 0.05,
  maxIterations: 8,
} as const;

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new JobCancelledError();
}

/**
 * Binary search over encoder quality for the largest output that still fits
 * under `targetBytes`.
 *
 * Assumes encoded size is (weakly) monotonic in quality. For JPEG/WebP that is
 * true in the large but NOT strictly true in the small: quantisation-table
 * rounding produces occasional non-monotonic steps of a few hundred bytes.
 * We therefore never trust the invariant to hold — we track the best fitting
 * probe seen anywhere in the search and return that, so a non-monotonic blip
 * can cost us a little quality but can never produce an over-target result.
 */
export async function compressToTarget(
  opts: CompressToTargetOptions,
): Promise<CompressResult> {
  const {
    targetBytes,
    encode,
    signal,
    onProbe,
    minQuality = DEFAULTS.minQuality,
    maxQuality = DEFAULTS.maxQuality,
    tolerance = DEFAULTS.tolerance,
    maxIterations = DEFAULTS.maxIterations,
  } = opts;

  if (targetBytes <= 0) throw new RangeError("targetBytes must be positive");
  if (minQuality >= maxQuality) throw new RangeError("minQuality >= maxQuality");

  const probes: Probe[] = [];
  let best: { blob: Blob; quality: number } | null = null;
  let iteration = 0;

  const record = (quality: number, blob: Blob): Probe => {
    const probe: Probe = { iteration, quality, bytes: blob.size };
    probes.push(probe);
    onProbe?.(probe);
    if (blob.size <= targetBytes && (best === null || blob.size > best.blob.size)) {
      best = { blob, quality };
    }
    return probe;
  };

  const goodEnough = (bytes: number): boolean =>
    bytes <= targetBytes && bytes >= targetBytes * (1 - tolerance);

  // Probe 1: ceiling. If the best-quality encode already fits, we are done and
  // we never touch quality at all. This is the common case for small photos and
  // it saves 6 encodes.
  throwIfAborted(signal);
  iteration = 1;
  const hiBlob = await encode(maxQuality, signal ?? new AbortController().signal);
  record(maxQuality, hiBlob);
  if (hiBlob.size <= targetBytes) {
    return { blob: hiBlob, quality: maxQuality, iterations: 1, probes };
  }

  // Probe 2: floor. If the worst-quality encode is still too big, no amount of
  // quality tuning saves us — the caller must reduce pixel dimensions or page
  // DPI. Report the smallest achievable size so the UI can say something useful.
  throwIfAborted(signal);
  iteration = 2;
  const loBlob = await encode(minQuality, signal ?? new AbortController().signal);
  record(minQuality, loBlob);
  if (loBlob.size > targetBytes) {
    throw new TargetUnreachableError(targetBytes, loBlob.size, minQuality);
  }
  if (goodEnough(loBlob.size)) {
    return { blob: loBlob, quality: minQuality, iterations: 2, probes };
  }

  // Bisect the open interval. Invariant on entry: encode(lo) fits, encode(hi)
  // does not.
  let lo = minQuality;
  let hi = maxQuality;

  while (iteration < maxIterations) {
    throwIfAborted(signal);
    iteration += 1;

    // Quality resolution below 0.01 is not meaningful to any browser encoder;
    // stop rather than burn an iteration on a no-op.
    if (hi - lo < 0.01) break;

    const mid = (lo + hi) / 2;
    const blob = await encode(mid, signal ?? new AbortController().signal);
    record(mid, blob);

    if (blob.size > targetBytes) {
      hi = mid;
    } else {
      lo = mid;
      if (goodEnough(blob.size)) break;
    }
  }

  // `best` is non-null here: probe 2 established a fitting candidate before the
  // loop, and `record` only ever widens the best. TS cannot see that.
  const winner = best as unknown as { blob: Blob; quality: number };
  return {
    blob: winner.blob,
    quality: winner.quality,
    iterations: iteration,
    probes,
  };
}

export interface EscalationOptions
  extends Omit<CompressToTargetOptions, "encode"> {
  /**
   * Encode at a pixel/DPI scale factor AND a quality. Called as the search
   * escalates: the ladder reduces `scale` only after quality alone has failed.
   */
  encodeAt: (scale: number, quality: number, signal: AbortSignal) => Promise<Blob>;
  /** Descending. Each rung is tried in full before the next. */
  scaleLadder?: readonly number[];
  onScaleChange?: (scale: number) => void;
}

/**
 * Quality-first, dimensions-second. Users care far more about "my photo is
 * still 600x600" than "my photo is quality 0.7", so we exhaust the quality axis
 * before we start throwing away pixels — and we tell the UI when we do.
 */
export async function compressWithEscalation(
  opts: EscalationOptions,
): Promise<CompressResult & { scale: number }> {
  const ladder = opts.scaleLadder ?? [1, 0.85, 0.7, 0.55, 0.45, 0.35];
  let lastError: TargetUnreachableError | null = null;

  for (const scale of ladder) {
    opts.onScaleChange?.(scale);
    try {
      const result = await compressToTarget({
        ...opts,
        encode: (q, signal) => opts.encodeAt(scale, q, signal),
      });
      return { ...result, scale };
    } catch (err) {
      if (err instanceof TargetUnreachableError) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("escalation ladder exhausted with no probes");
}
```

**Acceptance criteria**

- [ ] `compressToTarget` with a synthetic encoder `q => new Blob([new Uint8Array(Math.round(q * 1_000_000))])` and `targetBytes = 400_000` returns a blob of exactly ≤ 400,000 bytes in ≤ 8 iterations.
- [ ] When `encode(maxQuality)` already fits, exactly **one** call to `encode` is made.
- [ ] When `encode(minQuality)` does not fit, a `TargetUnreachableError` is thrown carrying `minAchievableBytes` equal to that probe's size, and exactly **two** calls to `encode` are made.
- [ ] A deliberately non-monotonic encoder (size dips at q=0.6) still returns a blob ≤ target — covered by a unit test.
- [ ] Aborting the signal mid-search rejects with `JobCancelledError` and makes no further `encode` calls.
- [ ] `compressWithEscalation` walks to the next ladder rung only on `TargetUnreachableError`, and rethrows any other error immediately.
- [ ] File imports nothing from `@db`, `next`, or `react`.

---

### [CORE--02] Web Worker harness: typed message protocol, progress, cancel

**Estimate:** 4h · **Depends on:** CORE--01 · **Files:** `src/lib/tools/worker/protocol.ts`, `src/lib/tools/worker/file-worker.ts`, `src/lib/tools/worker/client.ts`, `src/lib/tools/worker/use-file-job.ts`

**Why** — A 40MB PDF re-encoded eight times is tens of seconds of solid CPU. On the main thread that is a frozen tab: no scroll, no cancel button, no progress. Everything heavy runs in a dedicated worker; the main thread only ever holds a `File` handle and paints. Next 14's webpack config supports `new Worker(new URL("./file-worker.ts", import.meta.url))` out of the box — no plugin, no config change.

**Implementation**

```ts
// src/lib/tools/worker/protocol.ts

export type JobPhase =
  | "reading"
  | "decoding"
  | "detecting-face"
  | "rendering"
  | "searching"
  | "assembling"
  | "done";

export interface ImageJobOptions {
  kind: "image";
  targetBytes: number;
  /** Exact output pixel dimensions after cover-crop. */
  outWidth: number;
  outHeight: number;
  mimeType: "image/jpeg" | "image/png";
  /** Normalised crop rect in source pixel space, post-orientation. */
  crop?: { x: number; y: number; w: number; h: number };
  /** JFIF density to stamp into the JPEG header, for print-size presets. */
  dpi?: number;
  minQuality?: number;
}

export interface PdfJobOptions {
  kind: "pdf";
  targetBytes: number;
  mode: "structural" | "raster";
  /** Starting render DPI for raster mode. Escalation may reduce it. */
  dpi: number;
  minQuality?: number;
}

export type JobOptions = ImageJobOptions | PdfJobOptions;

export type WorkerRequest =
  | { type: "start"; jobId: string; file: File; options: JobOptions }
  | { type: "cancel"; jobId: string };

export interface ResultMeta {
  inputBytes: number;
  outputBytes: number;
  quality: number;
  /** 1 = full size. < 1 means the escalation ladder had to shrink it. */
  scale: number;
  iterations: number;
  pageCount?: number;
  /** True when a text layer existed and the raster mode destroyed it. */
  textLayerDestroyed?: boolean;
  durationMs: number;
}

export type WorkerErrorCode =
  | "TARGET_UNREACHABLE"
  | "CANCELLED"
  | "SOURCE_UNSUPPORTED"
  | "OUT_OF_MEMORY"
  | "ENCRYPTED_PDF"
  | "UNKNOWN";

export type WorkerResponse =
  | { type: "progress"; jobId: string; phase: JobPhase; ratio: number; detail?: string }
  | { type: "probe"; jobId: string; iteration: number; quality: number; bytes: number }
  | { type: "done"; jobId: string; blob: Blob; meta: ResultMeta }
  | {
      type: "error";
      jobId: string;
      code: WorkerErrorCode;
      message: string;
      /** Present when code === "TARGET_UNREACHABLE". */
      minAchievableBytes?: number;
    };
```

```ts
// src/lib/tools/worker/file-worker.ts
/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse, JobPhase } from "./protocol";
import { runImageJob } from "../image/run-image-job";
import { runPdfJob } from "../pdf/run-pdf-job";
import { JobCancelledError, TargetUnreachableError, SourceUnsupportedError } from "../compress/errors";

const controllers = new Map<string, AbortController>();

function post(message: WorkerResponse): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
}

export interface JobContext {
  signal: AbortSignal;
  progress: (phase: JobPhase, ratio: number, detail?: string) => void;
  probe: (iteration: number, quality: number, bytes: number) => void;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  if (msg.type === "cancel") {
    controllers.get(msg.jobId)?.abort();
    controllers.delete(msg.jobId);
    return;
  }

  const { jobId, file, options } = msg;
  const controller = new AbortController();
  controllers.set(jobId, controller);

  const ctx: JobContext = {
    signal: controller.signal,
    progress: (phase, ratio, detail) => post({ type: "progress", jobId, phase, ratio, detail }),
    probe: (iteration, quality, bytes) => post({ type: "probe", jobId, iteration, quality, bytes }),
  };

  const startedAt = performance.now();
  try {
    const { blob, meta } =
      options.kind === "image"
        ? await runImageJob(file, options, ctx)
        : await runPdfJob(file, options, ctx);

    post({
      type: "done",
      jobId,
      blob,
      meta: { ...meta, inputBytes: file.size, durationMs: Math.round(performance.now() - startedAt) },
    });
  } catch (err) {
    post(toErrorMessage(jobId, err));
  } finally {
    controllers.delete(jobId);
  }
};

function toErrorMessage(jobId: string, err: unknown): WorkerResponse {
  if (err instanceof TargetUnreachableError) {
    return {
      type: "error",
      jobId,
      code: "TARGET_UNREACHABLE",
      message: err.message,
      minAchievableBytes: err.minAchievableBytes,
    };
  }
  if (err instanceof JobCancelledError) {
    return { type: "error", jobId, code: "CANCELLED", message: "Cancelled." };
  }
  if (err instanceof SourceUnsupportedError) {
    return { type: "error", jobId, code: "SOURCE_UNSUPPORTED", message: err.message };
  }
  const message = err instanceof Error ? err.message : String(err);
  // Chrome throws a bare RangeError from canvas allocation; Safari throws
  // "Out of memory". Neither is a typed error, so we sniff the string.
  const looksLikeOom = /out of memory|allocation failed|Array buffer allocation/i.test(message);
  return {
    type: "error",
    jobId,
    code: looksLikeOom ? "OUT_OF_MEMORY" : "UNKNOWN",
    message,
  };
}
```

```ts
// src/lib/tools/worker/client.ts
import type { JobOptions, ResultMeta, WorkerRequest, WorkerResponse, JobPhase } from "./protocol";

export interface JobHandlers {
  onProgress?: (phase: JobPhase, ratio: number, detail?: string) => void;
  onProbe?: (iteration: number, quality: number, bytes: number) => void;
}

export interface JobHandle {
  promise: Promise<{ blob: Blob; meta: ResultMeta }>;
  cancel: () => void;
}

interface Pending extends JobHandlers {
  resolve: (value: { blob: Blob; meta: ResultMeta }) => void;
  reject: (reason: unknown) => void;
}

export class FileJobClient {
  private worker: Worker | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./file-worker.ts", import.meta.url), {
      type: "module",
      name: "kk-file-worker",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handle(event.data);
    worker.onerror = (event) => {
      // A worker-level error kills every in-flight job; nothing is recoverable.
      for (const [, p] of this.pending) p.reject(new Error(event.message || "Worker crashed"));
      this.pending.clear();
      this.terminate();
    };
    this.worker = worker;
    return worker;
  }

  private handle(msg: WorkerResponse): void {
    const entry = this.pending.get(msg.jobId);
    if (!entry) return;
    switch (msg.type) {
      case "progress":
        entry.onProgress?.(msg.phase, msg.ratio, msg.detail);
        break;
      case "probe":
        entry.onProbe?.(msg.iteration, msg.quality, msg.bytes);
        break;
      case "done":
        this.pending.delete(msg.jobId);
        entry.resolve({ blob: msg.blob, meta: msg.meta });
        break;
      case "error": {
        this.pending.delete(msg.jobId);
        const error = Object.assign(new Error(msg.message), {
          code: msg.code,
          minAchievableBytes: msg.minAchievableBytes,
        });
        entry.reject(error);
        break;
      }
    }
  }

  /**
   * `file` is posted by structured clone. A File is backed by the OS file
   * handle, so this is a reference transfer, not a copy of 40MB — do NOT
   * pre-read it into an ArrayBuffer on the main thread.
   */
  start(file: File, options: JobOptions, handlers: JobHandlers = {}): JobHandle {
    const worker = this.ensureWorker();
    const jobId = `job-${++this.seq}-${Date.now()}`;

    const promise = new Promise<{ blob: Blob; meta: ResultMeta }>((resolve, reject) => {
      this.pending.set(jobId, { ...handlers, resolve, reject });
    });

    const request: WorkerRequest = { type: "start", jobId, file, options };
    worker.postMessage(request);

    return {
      promise,
      cancel: () => {
        const req: WorkerRequest = { type: "cancel", jobId };
        this.worker?.postMessage(req);
        // Cooperative cancel is best-effort: pdf.js render tasks and the WASM
        // decoder both have uninterruptible stretches of a second or more. If
        // the worker has not acknowledged within 1.5s, kill it outright. The
        // next start() lazily spawns a fresh one.
        setTimeout(() => {
          if (this.pending.has(jobId)) {
            this.pending.get(jobId)?.reject(
              Object.assign(new Error("Cancelled."), { code: "CANCELLED" }),
            );
            this.pending.delete(jobId);
            this.terminate();
          }
        }, 1500);
      },
    };
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
```

```ts
// src/lib/tools/worker/use-file-job.ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileJobClient, type JobHandle } from "./client";
import type { JobOptions, JobPhase, ResultMeta } from "./protocol";

export type JobState =
  | { status: "idle" }
  | { status: "running"; phase: JobPhase; ratio: number; detail?: string }
  | { status: "done"; blob: Blob; meta: ResultMeta }
  | { status: "error"; code: string; message: string; minAchievableBytes?: number };

export function useFileJob() {
  const clientRef = useRef<FileJobClient | null>(null);
  const handleRef = useRef<JobHandle | null>(null);
  const [state, setState] = useState<JobState>({ status: "idle" });

  useEffect(() => {
    clientRef.current = new FileJobClient();
    return () => clientRef.current?.terminate();
  }, []);

  const run = useCallback(async (file: File, options: JobOptions) => {
    handleRef.current?.cancel();
    setState({ status: "running", phase: "reading", ratio: 0 });

    const handle = clientRef.current!.start(file, options, {
      onProgress: (phase, ratio, detail) =>
        setState({ status: "running", phase, ratio, detail }),
    });
    handleRef.current = handle;

    try {
      const { blob, meta } = await handle.promise;
      setState({ status: "done", blob, meta });
    } catch (err) {
      const e = err as Error & { code?: string; minAchievableBytes?: number };
      setState({
        status: "error",
        code: e.code ?? "UNKNOWN",
        message: e.message,
        minAchievableBytes: e.minAchievableBytes,
      });
    }
  }, []);

  const cancel = useCallback(() => handleRef.current?.cancel(), []);
  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, cancel, reset };
}
```

**Acceptance criteria**

- [ ] `pnpm build` emits a separate worker chunk; the `/tools/[slug]` route's initial JS does **not** include pdf.js or MediaPipe (verify in `.next/analyze` or by grepping the route's client chunk for `pdfjs`).
- [ ] Starting a job on a 30MB PDF keeps the main thread responsive: a CSS-animated element on the page maintains ≥ 50fps for the duration (measure with Performance panel, record the long-task count — must be 0 long tasks > 200ms attributable to compression).
- [ ] Cancel during the `searching` phase settles the promise with `code === "CANCELLED"` within 1.6s, worst case.
- [ ] Two jobs started back-to-back: the first settles as `CANCELLED`, the second completes normally.
- [ ] Killing the worker (`terminate()`) and starting a new job transparently respawns.

---

### [CORE--03] Memory guard rails and device capability probe

**Estimate:** 2h · **Depends on:** CORE--02 · **Files:** `src/lib/tools/memory/budget.ts`, `src/lib/tools/memory/scoped-canvas.ts`

**Why** — The realistic worst case is a 4GB Android phone, a 40MB scanned PDF of 60 pages, and Chrome's per-tab renderer budget. A single A4 page rasterised at 200 DPI is 1654×2339×4 = **15.5 MB** of RGBA. Hold ten of those as `ImageBitmap`s to make the quality search cheap and you have blown 155 MB on top of pdf.js's own structures and the 40MB source buffer — the tab dies with no error, no telemetry, and the user blames the tool. The fix is a declared pixel budget, strictly serial page processing above it, and explicit disposal (`ImageBitmap.close()`, `canvas.width = 0`) rather than trusting GC timing.

**Implementation**

```ts
// src/lib/tools/memory/budget.ts

interface NavigatorWithMemory extends Navigator {
  /** Chrome/Edge/Android only; coarse GB value capped at 8. */
  deviceMemory?: number;
}

export interface MemoryBudget {
  /** Total RGBA bytes we allow to be resident in decoded bitmaps at once. */
  bitmapCacheBytes: number;
  /** Largest single canvas we will allocate, in pixels (w*h). */
  maxCanvasPixels: number;
  /** Refuse input files larger than this outright. */
  maxInputBytes: number;
  tier: "low" | "medium" | "high";
}

export function detectMemoryBudget(nav: Navigator = navigator): MemoryBudget {
  const gb = (nav as NavigatorWithMemory).deviceMemory ?? 4;
  // Safari and Firefox never report deviceMemory. Treating "unknown" as 4GB is
  // the safe middle: it does not cripple a MacBook and does not let a 2GB
  // iPhone SE attempt a 60-page raster.
  if (gb <= 2) {
    return { tier: "low", bitmapCacheBytes: 48 * 1024 * 1024, maxCanvasPixels: 4_000_000, maxInputBytes: 25 * 1024 * 1024 };
  }
  if (gb <= 4) {
    return { tier: "medium", bitmapCacheBytes: 120 * 1024 * 1024, maxCanvasPixels: 12_000_000, maxInputBytes: 60 * 1024 * 1024 };
  }
  return { tier: "high", bitmapCacheBytes: 320 * 1024 * 1024, maxCanvasPixels: 32_000_000, maxInputBytes: 150 * 1024 * 1024 };
}

export function rgbaBytes(width: number, height: number): number {
  return width * height * 4;
}

/**
 * Clamp a render scale so a single page never exceeds the canvas budget.
 * Returns the scale you should actually render at, which may be below the
 * requested DPI. The caller must surface that to the user ("rendered at
 * 120 DPI instead of 200 to fit this device's memory").
 */
export function clampScaleToBudget(
  baseWidth: number,
  baseHeight: number,
  desiredScale: number,
  budget: MemoryBudget,
): number {
  const desiredPixels = baseWidth * desiredScale * baseHeight * desiredScale;
  if (desiredPixels <= budget.maxCanvasPixels) return desiredScale;
  return Math.sqrt(budget.maxCanvasPixels / (baseWidth * baseHeight));
}

/** FIFO cache of decoded page bitmaps with a hard byte ceiling. */
export class BitmapCache {
  private entries = new Map<number, ImageBitmap>();
  private bytes = 0;

  constructor(private readonly limitBytes: number) {}

  get isFull(): boolean {
    return this.bytes >= this.limitBytes;
  }

  get(pageIndex: number): ImageBitmap | undefined {
    return this.entries.get(pageIndex);
  }

  /** Returns false when the bitmap does not fit; caller must re-render instead. */
  put(pageIndex: number, bitmap: ImageBitmap): boolean {
    const size = rgbaBytes(bitmap.width, bitmap.height);
    if (size > this.limitBytes) return false;
    while (this.bytes + size > this.limitBytes && this.entries.size > 0) {
      const [oldestKey, oldest] = this.entries.entries().next().value as [number, ImageBitmap];
      oldest.close();
      this.bytes -= rgbaBytes(oldest.width, oldest.height);
      this.entries.delete(oldestKey);
    }
    this.entries.set(pageIndex, bitmap);
    this.bytes += size;
    return true;
  }

  dispose(): void {
    for (const bitmap of this.entries.values()) bitmap.close();
    this.entries.clear();
    this.bytes = 0;
  }
}
```

```ts
// src/lib/tools/memory/scoped-canvas.ts

/**
 * Run `fn` with an OffscreenCanvas that is guaranteed to be released, including
 * on throw. Setting width/height to 0 is the only reliable way to make Safari
 * and Chrome-on-Android free the backing store immediately rather than at the
 * next GC — which, with eight probes in flight, is far too late.
 */
export async function withCanvas<T>(
  width: number,
  height: number,
  fn: (canvas: OffscreenCanvas, ctx: OffscreenCanvasRenderingContext2D) => Promise<T>,
): Promise<T> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
  if (!ctx) throw new Error("2D context unavailable in worker");
  try {
    return await fn(canvas, ctx);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
```

**Acceptance criteria**

- [ ] With `navigator.deviceMemory` stubbed to 2, a 40MB PDF is refused with a specific message naming the size and the limit, not a generic failure.
- [ ] `BitmapCache` never exceeds its byte limit under a fuzz test of 200 random page sizes; every evicted bitmap has `close()` called exactly once.
- [ ] A 60-page raster job on a Chrome session throttled to 512MB heap (`--js-flags="--max-old-space-size=512"` plus Performance Monitor observation) completes without a renderer crash; JS heap plateaus rather than climbing monotonically across probes.
- [ ] `clampScaleToBudget` on a `low`-tier device caps an A4 page at ≤ 4M pixels, and the UI shows the effective DPI it actually used.

---

### [IMG--01] Image decode pipeline: EXIF orientation done properly

**Estimate:** 3h · **Depends on:** CORE--02 · **Files:** `src/lib/tools/image/decode.ts`, `src/lib/tools/image/exif.ts`, `src/lib/tools/image/jfif-density.ts`

**Why** — This is the single biggest source of "your tool is broken" reports for any photo tool, and the traffic for exam-form photo resizing is overwhelmingly mobile. An iPhone stores a portrait photo as **4032×3024 landscape pixels plus an EXIF `Orientation: 6` tag**. If you draw those pixels into a canvas without honouring the tag, the passport photo comes out rotated 90°, the 3:4 crop maths operates on the wrong axis, and the face detector — which is trained on upright faces — finds nothing. `createImageBitmap(file, { imageOrientation: "from-image" })` fixes it in one line on every modern engine, but the option is silently ignored by older Safari, so we feature-detect once against a known fixture and fall back to a manual APP1 parse plus a canvas transform.

**Implementation**

```ts
// src/lib/tools/image/exif.ts

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Minimal JPEG APP1/TIFF walk for tag 0x0112 (Orientation). We deliberately do
 * not pull in a 40KB EXIF library: this is the only tag that affects geometry.
 * Returns 1 (no transform) for anything we cannot parse.
 */
export function readExifOrientation(buffer: ArrayBuffer): ExifOrientation {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1; // not JPEG

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return 1; // desynced
    const marker = view.getUint8(offset + 1);
    const segmentLength = view.getUint16(offset + 2, false);

    if (marker === 0xe1) {
      // APP1. Expect "Exif\0\0".
      const exifStart = offset + 4;
      if (view.getUint32(exifStart, false) !== 0x45786966) return 1;
      const tiff = exifStart + 6;
      if (tiff + 8 > view.byteLength) return 1;

      const little = view.getUint16(tiff, false) === 0x4949;
      if (view.getUint16(tiff + 2, little) !== 0x002a) return 1;

      const ifd0 = tiff + view.getUint32(tiff + 4, little);
      if (ifd0 + 2 > view.byteLength) return 1;
      const entryCount = view.getUint16(ifd0, little);

      for (let i = 0; i < entryCount; i++) {
        const entry = ifd0 + 2 + i * 12;
        if (entry + 12 > view.byteLength) return 1;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value >= 1 && value <= 8 ? (value as ExifOrientation) : 1;
        }
      }
      return 1;
    }

    if (marker === 0xda) return 1; // start of scan; no EXIF ahead
    offset += 2 + segmentLength;
  }
  return 1;
}

/** Canvas transform matrix + swapped output dimensions for each orientation. */
export function orientationTransform(
  orientation: ExifOrientation,
  w: number,
  h: number,
): { outWidth: number; outHeight: number; matrix: [number, number, number, number, number, number] } {
  switch (orientation) {
    case 2: return { outWidth: w, outHeight: h, matrix: [-1, 0, 0, 1, w, 0] };
    case 3: return { outWidth: w, outHeight: h, matrix: [-1, 0, 0, -1, w, h] };
    case 4: return { outWidth: w, outHeight: h, matrix: [1, 0, 0, -1, 0, h] };
    case 5: return { outWidth: h, outHeight: w, matrix: [0, 1, 1, 0, 0, 0] };
    case 6: return { outWidth: h, outHeight: w, matrix: [0, 1, -1, 0, h, 0] };
    case 7: return { outWidth: h, outHeight: w, matrix: [0, -1, -1, 0, h, w] };
    case 8: return { outWidth: h, outHeight: w, matrix: [0, -1, 1, 0, 0, w] };
    default: return { outWidth: w, outHeight: h, matrix: [1, 0, 0, 1, 0, 0] };
  }
}
```

```ts
// src/lib/tools/image/decode.ts
import { readExifOrientation, orientationTransform } from "./exif";
import { withCanvas } from "../memory/scoped-canvas";
import { SourceUnsupportedError } from "../compress/errors";

/**
 * A 1x2 JPEG carrying Orientation=6. If the UA honours `imageOrientation`, the
 * decoded bitmap is 2x1. If it ignores it, we get 1x2 and must transform by
 * hand. Base64 fixture generated by scripts/make-orientation-probe.mjs and
 * committed so the probe never touches the network (offline guarantee).
 */
import { ORIENTATION_PROBE_DATA_URL } from "./orientation-probe";

let honoursOrientation: Promise<boolean> | null = null;

export function uaHonoursImageOrientation(): Promise<boolean> {
  honoursOrientation ??= (async () => {
    try {
      const res = await fetch(ORIENTATION_PROBE_DATA_URL);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      const rotated = bitmap.width === 2 && bitmap.height === 1;
      bitmap.close();
      return rotated;
    } catch {
      return false;
    }
  })();
  return honoursOrientation;
}

export interface DecodedImage {
  bitmap: ImageBitmap;
  /** Orientation found in the source, for telemetry/debug display only. */
  sourceOrientation: number;
}

/**
 * Decode `file` into an upright ImageBitmap. Always prefer the native path:
 * it decodes on a codec thread and never allocates an intermediate canvas.
 */
export async function decodeUpright(file: File): Promise<DecodedImage> {
  if (!file.type.startsWith("image/")) {
    throw new SourceUnsupportedError(`${file.type || "This file"} is not an image.`);
  }
  if (file.type === "image/gif") {
    throw new SourceUnsupportedError(
      "Animated GIFs are not supported. Export a single frame as JPEG or PNG first.",
    );
  }

  const buffer = await file.arrayBuffer();
  const orientation = readExifOrientation(buffer);

  if (orientation === 1 || (await uaHonoursImageOrientation())) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { bitmap, sourceOrientation: orientation };
  }

  // Manual path: decode raw, then blit through the orientation matrix.
  const raw = await createImageBitmap(file, { imageOrientation: "none" });
  const { outWidth, outHeight, matrix } = orientationTransform(orientation, raw.width, raw.height);
  const corrected = await withCanvas(outWidth, outHeight, async (canvas, ctx) => {
    ctx.setTransform(...matrix);
    ctx.drawImage(raw, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas.transferToImageBitmap();
  });
  raw.close();
  return { bitmap: corrected, sourceOrientation: orientation };
}
```

```ts
// src/lib/tools/image/jfif-density.ts

/**
 * Canvas `convertToBlob` writes a JFIF header with density 1x1 "no units",
 * which makes Word and most print dialogs treat a 600x600 photo as 8 inches
 * wide. Exam forms that specify "2x2 inches at 300 DPI" need the density field
 * set. Rewriting APP0 in place is 20 lines and avoids a JPEG encoder dependency.
 */
export async function stampJpegDensity(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  if (view.getUint16(0, false) !== 0xffd8) return blob;
  if (view.getUint16(2, false) !== 0xffe0) return blob; // no APP0 to patch
  if (view.getUint32(6, false) !== 0x4a464946) return blob; // not "JFIF"

  bytes[13] = 1; // units = dots per inch
  view.setUint16(14, dpi, false); // Xdensity
  view.setUint16(16, dpi, false); // Ydensity
  return new Blob([bytes], { type: "image/jpeg" });
}
```

**Acceptance criteria**

- [ ] Fixtures for all eight EXIF orientations decode to visually upright output; verified by an 8×8 average-hash comparison against a golden hash per orientation (Hamming distance ≤ 4).
- [ ] A real iPhone-shot portrait JPEG (`tests/fixtures/iphone-portrait-exif6.jpg`, 4032×3024 + Orientation 6) yields a bitmap of 3024×4032.
- [ ] `uaHonoursImageOrientation()` executes at most one `fetch`, against a `data:` URL — confirmed by a Playwright network assertion of zero HTTP requests during a full image job.
- [ ] `readExifOrientation` returns `1` (never throws) for: a PNG, a truncated JPEG, a JPEG with no APP1, and 1KB of random bytes.
- [ ] `stampJpegDensity(blob, 300)` produces a file that macOS Preview and `identify -verbose` both report as 300×300 DPI.

---

### [IMG--02] Exam photo & signature resizer widget

**Estimate:** 3.5h · **Depends on:** CORE--01, CORE--03, IMG--01 · **Files:** `src/lib/tools/image/run-image-job.ts`, `src/lib/tools/image/presets.ts`, `src/app/(tools)/tools/_widgets/photo-signature-resizer.tsx`

**Why** — The searched intent is never "resize an image." It is "my form says 200×230 px and under 50 KB and it keeps rejecting my upload." The tool wins by encoding those constraints as named presets and guaranteeing both simultaneously — exact pixel dimensions *and* a hard KB ceiling — which is precisely what `compressToTarget` plus a cover-crop gives us.

**Implementation**

```ts
// src/lib/tools/image/presets.ts

export interface SizePreset {
  id: string;
  label: string;
  group: "photo" | "signature" | "generic";
  width: number;
  height: number;
  maxBytes: number;
  minBytes?: number;
  dpi?: number;
  format: "image/jpeg" | "image/png";
  /** Head height as a fraction of image height, for face auto-crop. */
  headHeightRatio?: number;
  /** Authority page these numbers came from. Required — no folklore presets. */
  source: string;
  verifiedOn: `${number}-${number}-${number}`;
}

/**
 * NOTE: every entry must be re-read from `source` before each release. These
 * numbers change without notice and a wrong preset is worse than no preset.
 * The build does not and cannot validate them; the release checklist does.
 */
export const PRESETS: readonly SizePreset[] = [
  {
    id: "generic-photo-50kb",
    label: "Photo — 200 × 230 px, under 50 KB",
    group: "photo",
    width: 200, height: 230,
    maxBytes: 50 * 1024, minBytes: 20 * 1024,
    format: "image/jpeg",
    headHeightRatio: 0.62,
    source: "TODO://replace-with-authority-url",
    verifiedOn: "2026-08-09",
  },
  {
    id: "generic-signature-20kb",
    label: "Signature — 140 × 60 px, under 20 KB",
    group: "signature",
    width: 140, height: 60,
    maxBytes: 20 * 1024, minBytes: 10 * 1024,
    format: "image/jpeg",
    source: "TODO://replace-with-authority-url",
    verifiedOn: "2026-08-09",
  },
  {
    id: "passport-2in-300dpi",
    label: "Passport photo — 600 × 600 px at 300 DPI (2 × 2 in)",
    group: "photo",
    width: 600, height: 600,
    maxBytes: 240 * 1024,
    dpi: 300,
    format: "image/jpeg",
    headHeightRatio: 0.6,
    source: "TODO://replace-with-authority-url",
    verifiedOn: "2026-08-09",
  },
];
```

```ts
// src/lib/tools/image/run-image-job.ts
import { compressWithEscalation, compressToTarget } from "../compress/compress-to-target";
import { decodeUpright } from "./decode";
import { stampJpegDensity } from "./jfif-density";
import { withCanvas } from "../memory/scoped-canvas";
import { detectMemoryBudget, clampScaleToBudget } from "../memory/budget";
import type { ImageJobOptions, ResultMeta } from "../worker/protocol";
import type { JobContext } from "../worker/file-worker";

export async function runImageJob(
  file: File,
  options: ImageJobOptions,
  ctx: JobContext,
): Promise<{ blob: Blob; meta: Omit<ResultMeta, "inputBytes" | "durationMs"> }> {
  ctx.progress("decoding", 0.05);
  const { bitmap } = await decodeUpright(file);

  try {
    const budget = detectMemoryBudget();
    const crop = options.crop ?? coverCrop(bitmap.width, bitmap.height, options.outWidth, options.outHeight);

    ctx.progress("searching", 0.2);

    const encodeAt = async (scale: number, quality: number): Promise<Blob> => {
      const w = Math.max(1, Math.round(options.outWidth * scale));
      const h = Math.max(1, Math.round(options.outHeight * scale));
      const safeScale = clampScaleToBudget(w, h, 1, budget);
      return withCanvas(Math.round(w * safeScale), Math.round(h * safeScale), async (canvas, c2d) => {
        // White matte: PNG signatures with alpha would otherwise composite to
        // black under JPEG, which is the classic "my signature turned into a
        // black box" bug.
        c2d.fillStyle = "#ffffff";
        c2d.fillRect(0, 0, canvas.width, canvas.height);
        c2d.imageSmoothingEnabled = true;
        c2d.imageSmoothingQuality = "high";
        c2d.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
        return canvas.convertToBlob({ type: options.mimeType, quality });
      });
    };

    // PNG ignores `quality`, so there is nothing to bisect: encode once and
    // either it fits or it does not.
    if (options.mimeType === "image/png") {
      const blob = await encodeAt(1, 1);
      if (blob.size > options.targetBytes) {
        const { TargetUnreachableError } = await import("../compress/errors");
        throw new TargetUnreachableError(options.targetBytes, blob.size, 1);
      }
      return { blob, meta: { outputBytes: blob.size, quality: 1, scale: 1, iterations: 1 } };
    }

    const result = await compressWithEscalation({
      targetBytes: options.targetBytes,
      minQuality: options.minQuality ?? 0.3,
      signal: ctx.signal,
      onProbe: (p) => {
        ctx.probe(p.iteration, p.quality, p.bytes);
        ctx.progress("searching", 0.2 + Math.min(0.7, p.iteration / 10));
      },
      // Dimensions are a hard requirement of the preset — never shrink them.
      // Quality alone must do the work; failure is an honest error, not a
      // silently non-compliant file.
      scaleLadder: [1],
      encodeAt: (scale, quality) => encodeAt(scale, quality),
    });

    ctx.progress("assembling", 0.95);
    const final = options.dpi
      ? await stampJpegDensity(result.blob, options.dpi)
      : result.blob;

    return {
      blob: final,
      meta: {
        outputBytes: final.size,
        quality: result.quality,
        scale: result.scale,
        iterations: result.iterations,
      },
    };
  } finally {
    bitmap.close();
  }
}

/** Centre cover-crop: fill the target aspect ratio without letterboxing. */
export function coverCrop(
  srcW: number, srcH: number, outW: number, outH: number,
): { x: number; y: number; w: number; h: number } {
  const srcAspect = srcW / srcH;
  const outAspect = outW / outH;
  if (srcAspect > outAspect) {
    const w = Math.round(srcH * outAspect);
    return { x: Math.round((srcW - w) / 2), y: 0, w, h: srcH };
  }
  const h = Math.round(srcW / outAspect);
  return { x: 0, y: Math.round((srcH - h) / 2), w: srcW, h };
}
```

Widget behaviour (React, in `photo-signature-resizer.tsx`): preset radio group → live preview `<canvas>` at 1× with a drag-to-reposition crop rect → target KB numeric input pre-filled from the preset but user-editable → Compress → result card showing exact output dimensions, exact bytes with a "under 50 KB ✓" affordance, and a side-by-side 200% zoom of a face/ink detail crop so quality loss is visible before download.

**Acceptance criteria**

- [ ] For every preset, a 4000×3000 source produces output of **exactly** the preset's `width × height` and `size ≤ maxBytes`.
- [ ] When `minBytes` is set and the result lands under it, the UI warns "some portals also enforce a *minimum* size" and offers a one-click re-run at higher quality.
- [ ] A transparent PNG signature yields white background, never black.
- [ ] PNG output that cannot fit the target fails with `TARGET_UNREACHABLE` and the UI suggests switching to JPEG, rather than silently emitting an over-target file.
- [ ] A 300 DPI preset produces a file whose JFIF density reads 300×300.
- [ ] The dimensions ladder is disabled for presets — output dimensions are never silently reduced to hit a size target.

---

### [IMG--03] MediaPipe FaceDetector: lazy WASM on gesture, head-height auto-crop

**Estimate:** 4.5h · **Depends on:** IMG--02 · **Files:** `src/lib/tools/image/face/detector.ts`, `src/lib/tools/image/face/head-crop.ts`, `src/app/(tools)/tools/_widgets/face-crop-controls.tsx`, `scripts/vendor-mediapipe.mjs`

**Why** — Passport and exam photo specs are stated as *head height as a percentage of image height*, which humans cannot eyeball. A face detector turns a fiddly manual crop into one button. But the vision WASM plus model is **~3.2 MB**, which is more than the entire rest of the tool page. Loading it at module scope would destroy the LCP budget for the 90% of visitors who never press the button. It loads on gesture, prefetches on hover, and degrades to manual crop if it fails.

Second honesty point: BlazeFace returns a *face* box (roughly eyebrow-to-chin), not a *head* box (crown-to-chin). Any mapping between them is a calibrated heuristic, so auto-crop **proposes** and the user confirms with draggable crown/chin handles. Shipping "auto-crop, take it or leave it" for a document that gets rejected at a counter is not acceptable.

**Implementation**

```ts
// src/lib/tools/image/face/detector.ts
import type { FaceDetector } from "@mediapipe/tasks-vision";

let detectorPromise: Promise<FaceDetector> | null = null;

/**
 * Lazily instantiate the MediaPipe face detector. Idempotent: repeated calls
 * share one promise and one WASM instance.
 *
 * MUST NOT be called at module scope or in an effect on mount — it pulls
 * ~3.2 MB. Call it from a click handler, or from `prefetchFaceDetector()` on
 * pointerenter/focus of the button that will need it.
 */
export function loadFaceDetector(): Promise<FaceDetector> {
  detectorPromise ??= (async () => {
    const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/vendor/mediapipe/wasm");

    const create = (delegate: "GPU" | "CPU") =>
      FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/vendor/mediapipe/blaze_face_short_range.tflite",
          delegate,
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });

    try {
      return await create("GPU");
    } catch {
      // WebGL is unavailable in some hardened Android WebViews and in Firefox
      // with WebGL disabled. CPU is ~4x slower on a single 600px image, which
      // is still under 200ms — a fine fallback.
      return create("CPU");
    }
  })();
  return detectorPromise;
}

/**
 * Warm the network + parse cost without instantiating. Wire to
 * onPointerEnter / onFocus of the auto-crop button: by the time the click
 * lands, the bytes are usually in the HTTP cache.
 */
export function prefetchFaceDetector(): void {
  if (typeof document === "undefined" || detectorPromise) return;
  for (const href of [
    "/vendor/mediapipe/wasm/vision_wasm_internal.wasm",
    "/vendor/mediapipe/blaze_face_short_range.tflite",
  ]) {
    if (document.head.querySelector(`link[href="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    link.as = "fetch";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
}

export function disposeFaceDetector(): void {
  void detectorPromise?.then((d) => d.close()).catch(() => {});
  detectorPromise = null;
}
```

```ts
// src/lib/tools/image/face/head-crop.ts
import { loadFaceDetector } from "./detector";

export interface CropRect { x: number; y: number; w: number; h: number }

export interface HeadCropProposal {
  crop: CropRect;
  /** Estimated crown and chin y-coordinates in source pixel space. */
  crownY: number;
  chinY: number;
  confidence: number;
}

/**
 * BlazeFace's box spans roughly eyebrows-to-chin. Empirically (measured over
 * 40 portrait fixtures) the true crown sits about 0.48 box-heights above the
 * box top, and the chin about 0.04 box-heights below the box bottom. These are
 * heuristics, not measurements — the UI exposes draggable crown/chin handles
 * and recomputes the crop from whatever the user sets.
 */
const CROWN_ABOVE_BOX = 0.48;
const CHIN_BELOW_BOX = 0.04;

export async function proposeHeadCrop(
  bitmap: ImageBitmap,
  outAspect: number,
  headHeightRatio: number,
): Promise<HeadCropProposal | null> {
  const detector = await loadFaceDetector();

  // FaceDetector.detect accepts any CanvasImageSource; ImageBitmap qualifies
  // and avoids an extra canvas round trip.
  const result = detector.detect(bitmap as unknown as HTMLCanvasElement);
  const best = result.detections
    .slice()
    .sort((a, b) => (b.categories[0]?.score ?? 0) - (a.categories[0]?.score ?? 0))[0];
  if (!best?.boundingBox) return null;

  const box = best.boundingBox;
  const crownY = box.originY - box.height * CROWN_ABOVE_BOX;
  const chinY = box.originY + box.height * (1 + CHIN_BELOW_BOX);
  const headHeight = chinY - crownY;

  // Solve for the crop height that makes headHeight the requested fraction.
  const cropH = headHeight / headHeightRatio;
  const cropW = cropH * outAspect;

  // Vertical placement: standards want the head vertically centred with a
  // slightly larger margin below the chin than above the crown. 0.5 of the
  // leftover space above, biased up by 8%.
  const slack = cropH - headHeight;
  const y = crownY - slack * 0.42;
  const faceCentreX = box.originX + box.width / 2;
  const x = faceCentreX - cropW / 2;

  return {
    crop: clampToBitmap({ x, y, w: cropW, h: cropH }, bitmap.width, bitmap.height),
    crownY,
    chinY,
    confidence: best.categories[0]?.score ?? 0,
  };
}

/**
 * Keep the rect inside the source, preserving its aspect ratio. If the ideal
 * crop runs off the edge — very common when the subject stood too close to the
 * camera — we shrink rather than letterbox, and the caller warns the user that
 * the head will be slightly larger than the target ratio.
 */
export function clampToBitmap(rect: CropRect, srcW: number, srcH: number): CropRect {
  const aspect = rect.w / rect.h;
  let w = Math.min(rect.w, srcW);
  let h = w / aspect;
  if (h > srcH) {
    h = srcH;
    w = h * aspect;
  }
  const x = Math.min(Math.max(0, rect.x), srcW - w);
  const y = Math.min(Math.max(0, rect.y), srcH - h);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}
```

Widget wiring:

```tsx
// excerpt from src/app/(tools)/tools/_widgets/face-crop-controls.tsx
<button
  type="button"
  onPointerEnter={prefetchFaceDetector}
  onFocus={prefetchFaceDetector}
  onClick={handleAutoCrop}
  disabled={!bitmap || busy}
  className="..."
>
  {busy ? "Finding the face…" : "Auto-crop to face"}
</button>
```

`handleAutoCrop` sets `busy`, calls `proposeHeadCrop`, and on `null` shows: *"No face found — the crop below is centred. Drag the crown and chin handles to set it manually."* It never blocks the flow.

**Acceptance criteria**

- [ ] Loading `/tools/resize-photo-signature-for-exam-forms` transfers **zero** MediaPipe bytes: verified in the Network panel filtered to `mediapipe|wasm|tflite` before any click.
- [ ] Hovering "Auto-crop to face" issues `prefetch` requests; clicking it completes detection in < 1.2s on a warm cache, mid-tier laptop.
- [ ] All MediaPipe URLs are same-origin `/vendor/...`; no request to any CDN host at any point.
- [ ] Across the 12-image portrait fixture set, the proposed crop puts head height within ±6 percentage points of the preset's `headHeightRatio`, measured against hand-labelled crown/chin ground truth.
- [ ] With WebGL disabled (`chrome --disable-webgl`), detection still succeeds via the CPU delegate.
- [ ] `detector.close()` is called on widget unmount; repeated mount/unmount cycles do not grow the WASM heap.
- [ ] Signature presets never load MediaPipe at all — the button is not rendered for `group: "signature"`.

---

### [PDF--01] pdf.js render-to-canvas re-encode inside the worker

**Estimate:** 4.5h · **Depends on:** CORE--01, CORE--02, CORE--03 · **Files:** `src/lib/tools/pdf/render.ts`, `src/lib/tools/pdf/run-pdf-job.ts`

**Why** — Raster re-encode is the only client-side technique that can hit an *arbitrary* size target on an *arbitrary* PDF. The naïve implementation re-renders every page on every quality probe: 60 pages × 8 probes = 480 renders, which is minutes. The fix is to render each page **once** into a cached `ImageBitmap` and make the bisect's `encode` closure only re-encode those cached bitmaps, estimating container overhead — then verify the estimate with one real assembly. Memory-bound devices fall back to re-rendering, slowly but correctly.

A note on threading: pdf.js normally spawns its own worker. Inside our worker that would be a nested worker, which Chromium and Firefox have supported for years and Safari only since 16.4. We construct the nested worker in a `try`, and on failure fall back to pdf.js's in-thread parsing — still off the *main* thread, which is all we actually need.

**Implementation**

```ts
// src/lib/tools/pdf/render.ts
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { withCanvas } from "../memory/scoped-canvas";
import { clampScaleToBudget, type MemoryBudget } from "../memory/budget";
import { SourceUnsupportedError } from "../compress/errors";

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  let worker: pdfjs.PDFWorker | undefined;
  try {
    const nested = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
    worker = new pdfjs.PDFWorker({ port: nested as unknown as Worker });
  } catch {
    // Safari < 16.4: no nested workers. pdf.js falls back to parsing inline in
    // this worker, which is slower but still off the main thread.
    worker = undefined;
  }

  try {
    return await pdfjs.getDocument({
      data,
      worker,
      isEvalSupported: false, // CSP-safe
      useSystemFonts: false, // no network font fetches — offline guarantee
      disableFontFace: false,
    }).promise;
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "PasswordException") {
      throw new SourceUnsupportedError(
        "This PDF is password-protected. Remove the password in your PDF reader first.",
      );
    }
    if (name === "InvalidPDFException") {
      throw new SourceUnsupportedError("This file is not a valid PDF.");
    }
    throw err;
  }
}

export interface RenderedPage {
  bitmap: ImageBitmap;
  /** Page box in PDF points (1/72 in) — needed to rebuild at the same size. */
  widthPt: number;
  heightPt: number;
}

export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  dpi: number,
  budget: MemoryBudget,
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 }); // units are PDF points
  const desiredScale = dpi / 72;
  const scale = clampScaleToBudget(base.width, base.height, desiredScale, budget);
  const viewport = page.getViewport({ scale });

  const bitmap = await withCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
    async (canvas, ctx) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        intent: "print",
      }).promise;
      return canvas.transferToImageBitmap();
    },
  );

  // Free pdf.js's per-page operator list; without this a 60-page document
  // retains every page's parsed content until the document is destroyed.
  page.cleanup();

  return { bitmap, widthPt: base.width, heightPt: base.height };
}

/** True when the document has no extractable text — nothing to lose by rasterising. */
export async function hasTextLayer(doc: PDFDocumentProxy, sampleSize = 5): Promise<boolean> {
  const pagesToCheck = Math.min(sampleSize, doc.numPages);
  for (let i = 1; i <= pagesToCheck; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const chars = content.items.reduce(
      (sum, item) => sum + ("str" in item ? item.str.trim().length : 0),
      0,
    );
    page.cleanup();
    if (chars > 40) return true;
  }
  return false;
}
```

```ts
// src/lib/tools/pdf/run-pdf-job.ts
import { compressToTarget } from "../compress/compress-to-target";
import { TargetUnreachableError } from "../compress/errors";
import { detectMemoryBudget, BitmapCache } from "../memory/budget";
import { withCanvas } from "../memory/scoped-canvas";
import { openPdf, renderPage, hasTextLayer, type RenderedPage } from "./render";
import { assemblePdfFromJpegs } from "./assemble";
import type { PdfJobOptions, ResultMeta } from "../worker/protocol";
import type { JobContext } from "../worker/file-worker";

/** Measured empirically over the fixture corpus; verified, never trusted. */
const PDF_FIXED_OVERHEAD = 1_200;
const PDF_PER_PAGE_OVERHEAD = 340;

export async function runPdfJob(
  file: File,
  options: PdfJobOptions,
  ctx: JobContext,
): Promise<{ blob: Blob; meta: Omit<ResultMeta, "inputBytes" | "durationMs"> }> {
  const budget = detectMemoryBudget();
  if (file.size > budget.maxInputBytes) {
    throw Object.assign(
      new Error(
        `This file is ${(file.size / 1e6).toFixed(0)} MB. On this device the limit is ` +
          `${(budget.maxInputBytes / 1e6).toFixed(0)} MB — a larger file would crash the tab. ` +
          `Split the PDF first, or try on a desktop browser.`,
      ),
      { name: "SourceUnsupportedError" },
    );
  }

  ctx.progress("reading", 0.02);
  const doc = await openPdf(await file.arrayBuffer());
  const cache = new BitmapCache(budget.bitmapCacheBytes);
  const geometry: Array<{ widthPt: number; heightPt: number }> = [];

  try {
    const textLayer = await hasTextLayer(doc);
    const pageCount = doc.numPages;

    // Render pass. Cache what fits; anything beyond the budget gets re-rendered
    // per probe, which is slow but bounded.
    for (let i = 1; i <= pageCount; i++) {
      if (ctx.signal.aborted) throw Object.assign(new Error("Cancelled."), { name: "JobCancelledError" });
      ctx.progress("rendering", 0.05 + 0.45 * (i / pageCount), `Page ${i} of ${pageCount}`);
      const rendered = await renderPage(doc, i, options.dpi, budget);
      geometry[i - 1] = { widthPt: rendered.widthPt, heightPt: rendered.heightPt };
      if (!cache.put(i, rendered.bitmap)) rendered.bitmap.close();
    }

    const encodeJpegs = async (quality: number): Promise<Blob[]> => {
      const out: Blob[] = [];
      for (let i = 1; i <= pageCount; i++) {
        let bitmap = cache.get(i);
        let temporary: RenderedPage | null = null;
        if (!bitmap) {
          temporary = await renderPage(doc, i, options.dpi, budget);
          bitmap = temporary.bitmap;
        }
        const jpeg = await withCanvas(bitmap.width, bitmap.height, async (canvas, c2d) => {
          c2d.drawImage(bitmap!, 0, 0);
          return canvas.convertToBlob({ type: "image/jpeg", quality });
        });
        out.push(jpeg);
        temporary?.bitmap.close();
      }
      return out;
    };

    ctx.progress("searching", 0.55);

    // Stage 1: bisect against an *estimated* container size. Cheap — no
    // pdf-lib assembly per probe.
    const estimateTarget =
      options.targetBytes - PDF_FIXED_OVERHEAD - PDF_PER_PAGE_OVERHEAD * pageCount;
    if (estimateTarget <= 0) {
      throw new TargetUnreachableError(options.targetBytes, PDF_FIXED_OVERHEAD + PDF_PER_PAGE_OVERHEAD * pageCount, 0);
    }

    let winningJpegs: Blob[] = [];
    const search = await compressToTarget({
      targetBytes: estimateTarget,
      minQuality: options.minQuality ?? 0.25,
      maxQuality: 0.9,
      tolerance: 0.06,
      maxIterations: 7,
      signal: ctx.signal,
      onProbe: (p) => {
        ctx.probe(p.iteration, p.quality, p.bytes + PDF_FIXED_OVERHEAD + PDF_PER_PAGE_OVERHEAD * pageCount);
        ctx.progress("searching", 0.55 + Math.min(0.3, p.iteration / 12));
      },
      encode: async (quality) => {
        const jpegs = await encodeJpegs(quality);
        const total = jpegs.reduce((sum, b) => sum + b.size, 0);
        const proxy = new Blob([new Uint8Array(0)]) as Blob & { size: number };
        // We only need `size` from this probe; carrying the real bytes would
        // hold N page JPEGs alive per probe. Stash the last-fitting set.
        if (total <= estimateTarget) winningJpegs = jpegs;
        Object.defineProperty(proxy, "size", { value: total, configurable: true });
        return proxy;
      },
    });

    // Stage 2: assemble for real and verify. The overhead model only affects
    // how many iterations we spend — never correctness.
    ctx.progress("assembling", 0.9);
    let quality = search.quality;
    let assembled = await assemblePdfFromJpegs(
      winningJpegs.length ? winningJpegs : await encodeJpegs(quality),
      geometry,
    );

    for (let correction = 0; correction < 2 && assembled.size > options.targetBytes; correction++) {
      quality = Math.max(options.minQuality ?? 0.25, quality - 0.08);
      ctx.progress("assembling", 0.93 + correction * 0.03, "Fine-tuning");
      assembled = await assemblePdfFromJpegs(await encodeJpegs(quality), geometry);
    }

    if (assembled.size > options.targetBytes) {
      throw new TargetUnreachableError(options.targetBytes, assembled.size, quality);
    }

    return {
      blob: assembled,
      meta: {
        outputBytes: assembled.size,
        quality,
        scale: 1,
        iterations: search.iterations,
        pageCount,
        textLayerDestroyed: textLayer,
      },
    };
  } finally {
    cache.dispose();
    await doc.destroy();
  }
}
```

**Acceptance criteria**

- [ ] `tests/fixtures/scanned-20p.pdf` (12 MB) compresses to ≤ 500 KB, and the output opens correctly in Chrome PDF viewer, Preview, and Acrobat Reader.
- [ ] The render pass runs exactly `pageCount` renders when the bitmap cache fits, verified by a counter exposed in the probe stream.
- [ ] An encrypted PDF produces the specific "password-protected" message, not a stack trace.
- [ ] A corrupt PDF produces "not a valid PDF."
- [ ] Output size is ≤ target for all 6 PDF fixtures at targets of 100 KB, 300 KB, and 1 MB (18 assertions), or fails cleanly with `TARGET_UNREACHABLE` and a stated minimum.
- [ ] `page.cleanup()` and `doc.destroy()` run on every path including throw and cancel.
- [ ] No network request is made during a PDF job (no font fetches — `useSystemFonts: false` verified).

---

### [PDF--02] pdf-lib assembly, structural mode, and the honest "you will lose your text" UI

**Estimate:** 3h · **Depends on:** PDF--01 · **Files:** `src/lib/tools/pdf/assemble.ts`, `src/lib/tools/pdf/structural.ts`, `src/app/(tools)/tools/_widgets/pdf-compressor.tsx`

**Why** — Rasterising a text PDF destroys the text layer: Ctrl-F stops finding words, copy-paste stops working, and screen readers get nothing. Every competitor quietly does this and does not say so. Saying it plainly, before the download, is both the ethical move and the differentiator that earns the "compress pdf to 100kb without losing quality" long tail — because we can answer that query truthfully instead of pretending.

**Implementation**

```ts
// src/lib/tools/pdf/assemble.ts
import { PDFDocument } from "pdf-lib";

export async function assemblePdfFromJpegs(
  jpegs: Blob[],
  geometry: Array<{ widthPt: number; heightPt: number }>,
): Promise<Blob> {
  const doc = await PDFDocument.create();
  doc.setProducer("kavithakanchana.me/tools");
  doc.setCreator("kavithakanchana.me/tools");

  for (let i = 0; i < jpegs.length; i++) {
    const bytes = new Uint8Array(await jpegs[i].arrayBuffer());
    const image = await doc.embedJpg(bytes);
    const { widthPt, heightPt } = geometry[i];
    const page = doc.addPage([widthPt, heightPt]);
    page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt });
  }

  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  return new Blob([out], { type: "application/pdf" });
}
```

```ts
// src/lib/tools/pdf/structural.ts
import { PDFDocument } from "pdf-lib";

export interface StructuralResult {
  blob: Blob;
  savedBytes: number;
  savedRatio: number;
}

/**
 * Lossless-ish pass: strip metadata, drop unreferenced objects, and re-serialise
 * with cross-reference/object streams. Preserves the text layer completely.
 *
 * Be honest about the ceiling: this typically saves 2-15% on a text PDF written
 * by Word or LaTeX and close to 0% on an already-linearised file. It cannot
 * recompress embedded images — pdf-lib has no image transcoder — so on a scanned
 * PDF it saves nothing. When it misses the target, the UI must offer raster mode
 * rather than silently returning a file that is still too big.
 */
export async function compressStructurally(input: ArrayBuffer): Promise<StructuralResult> {
  const doc = await PDFDocument.load(input, {
    updateMetadata: false,
    ignoreEncryption: false,
  });
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("kavithakanchana.me/tools");
  doc.setCreator("kavithakanchana.me/tools");

  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  const blob = new Blob([out], { type: "application/pdf" });
  const savedBytes = Math.max(0, input.byteLength - blob.size);
  return { blob, savedBytes, savedRatio: savedBytes / input.byteLength };
}
```

UI contract in `pdf-compressor.tsx`:

1. On file select, run `hasTextLayer` first (fast, samples 5 pages) and branch:
   - **No text layer** → auto-select raster mode with the banner *"This PDF is already scanned images — there's no text layer to lose."* No warning, no friction.
   - **Has a text layer** → default to **structural** mode, run it immediately, and report `savedRatio`.
2. If structural output is still over target, show a decision card, not a dropdown:

   > **We got it to 1.8 MB. You asked for 500 KB.**
   > Keeping the text layer, that's as small as this PDF goes.
   > To reach 500 KB we'd flatten every page to an image. That means:
   > · Ctrl-F will no longer find words in this PDF
   > · Text can't be copied out of it
   > · Screen readers will read nothing
   > · The visible quality drops — see the preview below
   >
   > `[ Keep the text, download at 1.8 MB ]`  `[ Flatten to images, get 500 KB ]`

3. Below the card, render page 1 at 100% zoom at the *proposed* raster quality, side by side with the original, so the artifacting is visible before the choice.
4. The result card after a raster run carries a persistent `role="status"` note: *"Text layer removed. This file is images only."*
5. Filename encodes the choice: `original-name-flattened-500kb.pdf` vs `original-name-optimized.pdf`.

**Acceptance criteria**

- [ ] A LaTeX-produced text PDF run in structural mode has an identical extracted text string (`pdftotext` output byte-identical) to the source.
- [ ] A scanned PDF skips the warning entirely and auto-selects raster.
- [ ] The flatten warning is a blocking choice — no code path downloads a flattened file without an explicit click on "Flatten to images."
- [ ] Structural mode reporting 0% savings says so plainly ("This PDF is already as small as it gets without flattening") instead of showing a success state.
- [ ] Output filenames differ between modes and both are ASCII-safe.
- [ ] Assembled PDFs preserve original page dimensions in points to within 1pt for mixed-page-size fixtures (A4 + Letter + landscape in one document).

---

### [UX--01] Dropzone, progress, cancel, and screen-reader announcements

**Estimate:** 3h · **Depends on:** CORE--02 · **Files:** `src/components/tools/file-dropzone.tsx`, `src/components/tools/job-progress.tsx`, `src/lib/tools/a11y/announce.ts`

**Why** — These two tools are used under stress, on a phone, minutes before a form deadline. Shared, correct, accessible chrome for file input and async progress is reused by every file tool in Sprints 3 and 4, so it is worth doing once properly. The subtle part is announcement throttling: an `aria-live` region updated on every progress tick makes a screen reader unusable.

**Implementation**

```tsx
// src/components/tools/file-dropzone.tsx
"use client";
import { useId, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

export interface FileDropzoneProps {
  accept: string;
  maxBytes: number;
  hint: string;
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function FileDropzone({ accept, maxBytes, hint, onFile, disabled }: FileDropzoneProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accepts = (file: File): boolean =>
    accept.split(",").some((pattern) => {
      const p = pattern.trim();
      if (p.startsWith(".")) return file.name.toLowerCase().endsWith(p.toLowerCase());
      if (p.endsWith("/*")) return file.type.startsWith(p.slice(0, -1));
      return file.type === p;
    });

  const take = (file: File | undefined) => {
    if (!file) return;
    if (!accepts(file)) {
      setError(`${file.name} isn't a supported file type.`);
      return;
    }
    if (file.size > maxBytes) {
      setError(
        `${file.name} is ${(file.size / 1e6).toFixed(1)} MB. The limit is ${(maxBytes / 1e6).toFixed(0)} MB.`,
      );
      return;
    }
    setError(null);
    onFile(file);
  };

  return (
    <div
      onDragOver={(e: DragEvent) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files[0]);
      }}
      onPaste={(e) => take(e.clipboardData?.files?.[0])}
      className={cn(
        "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      {/*
        A real <input type="file"> inside a <label>. Not a div with
        role="button": the native control gives keyboard activation, the OS file
        picker, mobile "take a photo" integration, and correct SR semantics for
        free. It is visually hidden but focusable, with focus styling projected
        onto the label via peer-focus-visible.
      */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          take(e.target.files?.[0]);
          e.target.value = ""; // allow re-selecting the same file
        }}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
      >
        Choose a file
      </label>
      <p id={hintId} className="mt-3 text-sm text-muted-foreground">
        {hint} — or drag it here, or paste from the clipboard.
      </p>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

```ts
// src/lib/tools/a11y/announce.ts
import type { JobPhase } from "../worker/protocol";

const PHASE_LABEL: Record<JobPhase, string> = {
  reading: "Reading the file",
  decoding: "Decoding",
  "detecting-face": "Finding the face",
  rendering: "Rendering pages",
  searching: "Finding the best quality for your size limit",
  assembling: "Building the output file",
  done: "Finished",
};

/**
 * Screen readers queue every aria-live change and read them in order. Emitting
 * a percentage tick 40 times produces 40 queued utterances and a user who
 * cannot hear anything else for a minute. We announce phase *transitions* only,
 * plus at most one coarse update every 4 seconds.
 */
export function createAnnouncer(setText: (text: string) => void) {
  let lastPhase: JobPhase | null = null;
  let lastAt = 0;

  return {
    progress(phase: JobPhase, ratio: number, detail?: string): void {
      const now = Date.now();
      const phaseChanged = phase !== lastPhase;
      if (!phaseChanged && now - lastAt < 4000) return;
      lastPhase = phase;
      lastAt = now;
      const pct = Math.round(ratio * 100);
      setText(detail ? `${PHASE_LABEL[phase]}. ${detail}. ${pct} percent.` : `${PHASE_LABEL[phase]}. ${pct} percent.`);
    },
    reset(): void {
      lastPhase = null;
      lastAt = 0;
      setText("");
    },
  };
}
```

`<JobProgress>` renders a native `<progress value={ratio} max={1} aria-hidden="true">` for the visual bar (native progress is not consistently announced), the throttled `role="status" aria-live="polite" aria-atomic="true"` region for the text, a `role="alert"` region for terminal errors, and a Cancel `<button>` that is always the next tab stop after the progress region. The bar's shimmer is wrapped in `@media (prefers-reduced-motion: no-preference)`.

**Acceptance criteria**

- [ ] Full keyboard path with zero mouse: Tab to file input → Enter → pick file → Tab to preset → arrows → Tab to Compress → Enter → Tab to Cancel → Enter aborts → Tab to Download → Enter downloads.
- [ ] VoiceOver (Safari) and NVDA (Firefox) each announce at most 6 utterances during a 20-second PDF job.
- [ ] Terminal errors are announced immediately via `role="alert"`.
- [ ] axe-core reports 0 violations on both tool pages in idle, running, error, and done states (4 axe runs per page in the Playwright suite).
- [ ] Drag-drop, click-to-browse, and Ctrl-V paste all reach the same `take()` path; rejecting an oversized file announces the reason.
- [ ] All interactive targets ≥ 44×44 CSS px at 375px viewport width.

---

### [UX--02] The "nothing is uploaded" proof: offline service worker + request ledger

**Estimate:** 2.5h · **Depends on:** UX--01 · **Files:** `public/sw-tools.js`, `src/components/tools/offline-proof.tsx`, `src/app/(tools)/tools/_components/register-sw.tsx`, `next.config.mjs`

**Why** — "Runs in your browser — nothing uploaded" is the meta-row claim on every tool page, and every competitor makes the same claim while POSTing your file to an S3 bucket. Making the claim *falsifiable* — the tool provably keeps working with the network off, and a visible ledger shows every request the page made — is a real differentiator, a trust signal, and something a reviewer or a Reddit thread can verify in ten seconds.

**Implementation**

```js
// public/sw-tools.js
// Scope is /tools/ — a service worker at the origin root may claim any scope.
const CACHE = "kk-tools-v__BUILD_ID__";

// Injected at build time by scripts/build-sw-manifest.mjs: the hashed worker
// chunk, the MediaPipe wasm + model, and the two tool HTML documents.
const PRECACHE = self.__KK_PRECACHE__ || [];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // HTML: network-first, so copy and preset edits go live immediately and a
  // stale shell never outlives a deploy.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request).then((r) => r || Response.error())),
    );
    return;
  }

  // Hashed static assets (/_next/static, /vendor): cache-first, they are immutable.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/vendor/")) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
            return res;
          }),
      ),
    );
  }
});
```

```tsx
// src/components/tools/offline-proof.tsx
"use client";
import { useEffect, useState } from "react";

interface Outbound { url: string; initiatorType: string }

/**
 * A live ledger of every network request this page has made since load, split
 * into same-origin (assets) and cross-origin (should be exactly zero). This is
 * the falsifiable version of "nothing is uploaded": a visitor can read it
 * without opening DevTools, and any regression that adds an upload shows up
 * here first.
 */
export function OfflineProof() {
  const [outbound, setOutbound] = useState<Outbound[]>([]);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    const record = (entries: PerformanceResourceTiming[]) => {
      const foreign = entries
        .filter((e) => new URL(e.name, location.href).origin !== location.origin)
        .map((e) => ({ url: e.name, initiatorType: e.initiatorType }));
      if (foreign.length) setOutbound((prev) => [...prev, ...foreign]);
    };

    record(performance.getEntriesByType("resource") as PerformanceResourceTiming[]);
    const observer = new PerformanceObserver((list) =>
      record(list.getEntries() as PerformanceResourceTiming[]),
    );
    observer.observe({ type: "resource", buffered: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <aside className="mt-8 rounded-lg border bg-muted/30 p-4 text-sm">
      <h3 className="font-medium">Proof this runs on your device</h3>
      <p className="mt-1 text-muted-foreground">
        Requests sent off this domain since you opened the page:{" "}
        <strong>{outbound.length}</strong>
        {outbound.length === 0 && " — none."}
      </p>
      {outbound.length > 0 && (
        <ul className="mt-2 list-disc pl-5 font-mono text-xs">
          {outbound.map((o) => (
            <li key={o.url}>{o.url}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-muted-foreground">
        {online
          ? "Turn off your Wi-Fi and reload — the tool still works. Your file never leaves this device."
          : "You're offline right now, and this tool is still working."}
      </p>
    </aside>
  );
}
```

`next.config.mjs` gains a headers entry so the worker script is never cached:

```js
async headers() {
  return [
    {
      source: "/sw-tools.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/tools/" },
      ],
    },
  ];
},
```

**Acceptance criteria**

- [ ] With DevTools set to Offline after one warm visit, both tool pages load and a full compression job completes end to end.
- [ ] `OfflineProof` shows `0` cross-origin requests on both tool pages through a complete job including MediaPipe auto-crop.
- [ ] A Playwright test asserts zero requests to any host other than the page origin over the full job lifecycle, and fails the build if one appears.
- [ ] Deploying a new build invalidates the old cache: after deploy, a reload serves the new HTML (network-first) and the old `kk-tools-v*` caches are deleted on activate.
- [ ] The service worker's scope is `/tools/` — visiting `/` and `/blog` registers nothing and is unaffected.

---

### [TEST--01] Fixture corpus and golden-invariant harness for binary output

**Estimate:** 3.5h · **Depends on:** IMG--02, PDF--01 · **Files:** `vitest.config.ts`, `playwright.config.ts`, `tests/fixtures/manifest.json`, `scripts/make-fixtures.mjs`, `tests/browser/image-jobs.spec.ts`, `tests/browser/pdf-jobs.spec.ts`, `tests/golden/*.json`

**Why** — You cannot byte-compare JPEG output: Chromium, Firefox and WebKit ship different encoders and the same browser changes bytes across versions. The right assertion set is **invariants plus a perceptual golden**: exact dimensions, a size ceiling, a size floor (didn't over-compress), and an 8×8 average-hash within a small Hamming distance of a committed golden hash. That catches "the image came out rotated / black / blank" — the failures that actually happen — without breaking on every Chrome release.

**Implementation**

```js
// scripts/make-fixtures.mjs
// Small fixtures are committed. Anything over 1 MB is generated here and
// gitignored, so the repo does not carry 60 MB of test PDFs.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const DIR = new URL("../tests/fixtures/generated/", import.meta.url).pathname;
mkdirSync(DIR, { recursive: true });

async function makeTextHeavy(pages, out) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let p = 0; p < pages; p++) {
    const page = doc.addPage([595.28, 841.89]); // A4 points
    for (let line = 0; line < 45; line++) {
      page.drawText(
        `Page ${p + 1} line ${line + 1}. The quick brown fox jumps over the lazy dog. 0123456789.`,
        { x: 50, y: 790 - line * 17, size: 10, font, color: rgb(0.1, 0.1, 0.1) },
      );
    }
  }
  writeFileSync(out, await doc.save());
}

if (!existsSync(`${DIR}text-heavy-60p.pdf`)) await makeTextHeavy(60, `${DIR}text-heavy-60p.pdf`);
console.log("fixtures ready in", DIR);
```

```ts
// tests/browser/image-jobs.spec.ts
import { test, expect } from "@playwright/test";
import golden from "../golden/image-hashes.json";

const TOOL = "/tools/resize-photo-signature-for-exam-forms";

/** 8x8 average hash of an ImageData, as a 64-bit hex string. */
const AHASH_SOURCE = `(imageData) => { /* injected below */ }`;

test.describe("photo resizer", () => {
  for (const fixture of ["iphone-portrait-exif6.jpg", "landscape-4000x3000.jpg", "cmyk.jpg"]) {
    test(`${fixture} -> 200x230 under 50KB`, async ({ page }) => {
      const requests: string[] = [];
      page.on("request", (r) => {
        if (new URL(r.url()).origin !== new URL(page.url() || "http://x").origin) requests.push(r.url());
      });

      await page.goto(TOOL);
      await page.setInputFiles('input[type="file"]', `tests/fixtures/${fixture}`);
      await page.getByRole("radio", { name: /200 × 230/ }).check();
      await page.getByRole("button", { name: "Compress" }).click();

      const download = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /Download/ }).click(),
      ]).then(([d]) => d);

      const path = await download.path();
      const stats = await import("node:fs").then((fs) => fs.promises.stat(path!));

      expect(stats.size).toBeLessThanOrEqual(50 * 1024);
      // Floor: 50% of the ceiling. Below that we over-compressed and shipped a
      // visibly worse file than we needed to.
      expect(stats.size).toBeGreaterThan(25 * 1024);

      const meta = await page.getByTestId("result-dimensions").innerText();
      expect(meta).toBe("200 × 230");

      const hash = await page.evaluate(AHASH_SOURCE);
      expect(hamming(hash as string, golden[fixture])).toBeLessThanOrEqual(6);
      expect(requests).toEqual([]);
    });
  }
});

function hamming(a: string, b: string): number {
  const x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  return x.toString(2).split("").filter((c) => c === "1").length;
}
```

Layers:
- **vitest** (`node` env) for `compress-to-target.ts`, `exif.ts`, `budget.ts`, `presets.ts`, `head-crop.ts` maths — pure functions, no canvas, fast, run on every commit.
- **Playwright** against `pnpm build && pnpm start`, on Chromium + WebKit, for everything that touches canvas/WASM/workers. WebKit is non-negotiable: it is the only way to catch the Safari orientation and nested-worker paths.
- **Golden regeneration** is an explicit `pnpm test:golden:update` script that rewrites `tests/golden/*.json` and must be reviewed as a diff — never auto-updated in CI.

**Acceptance criteria**

- [ ] `pnpm test:unit` runs in < 5s and covers `compressToTarget` including the non-monotonic, unreachable, and abort paths.
- [ ] `pnpm test:browser` passes on Chromium and WebKit.
- [ ] Fixture corpus present: 8 EXIF orientation variants, an iPhone portrait, a CMYK JPEG, a progressive JPEG, a transparent PNG signature, an animated GIF (reject path), a 1×1 PNG, a text-heavy 10p PDF, a scanned 20p PDF, a mixed-page-size PDF, an encrypted PDF, a corrupt PDF, plus a generated 60p / 40MB PDF.
- [ ] Every image test asserts all four invariants: exact dimensions, size ≤ target, size ≥ 0.5 × target, aHash Hamming ≤ 6.
- [ ] The zero-cross-origin-request assertion runs in every browser test and fails the suite on any violation.
- [ ] Golden JSON files are committed and the update script is not wired into CI.

---

### [SEO--01] Registry entries, page copy, JSON-LD

**Estimate:** 1.5h · **Depends on:** PDF--02, IMG--02 · **Files:** `src/lib/tools/registry.ts`, `src/lib/tools/content/compress-pdf-to-exact-size.ts`, `src/lib/tools/content/resize-photo-signature-for-exam-forms.ts`

**Why** — The tool is the widget, but the *page* is what gets indexed. Sprint 1 built the template; this ticket supplies the two entries that make it render, and the build-time validator enforces the shape.

**Implementation** — two `Tool` objects appended to `TOOLS`, each with: `slug`, `h1` set to the exact target keyword, `metaTitle` ≤ 60 chars, `description` 120–165 chars, a 40–70 word intro, `howItWorks` ≥ 120 words describing the actual binary search (the honest mechanism is also the differentiated content), `gotchas` ≥ 120 words covering the text-layer loss, minimum-size portals, and EXIF rotation, 4–6 FAQs, and `related` slugs pointing at each other and at Sprint 1's tools. `validateRegistry` already enforces every one of those constraints at module scope, so a malformed entry fails `pnpm build`.

Widget registration in the `/tools/[slug]` widget map:

```ts
// src/app/(tools)/tools/_widgets/index.ts
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const Skeleton = () => <div className="h-[420px] animate-pulse rounded-lg bg-muted" aria-hidden="true" />;

export const WIDGETS: Record<string, ComponentType> = {
  "compress-pdf-to-exact-size": dynamic(() => import("./pdf-compressor").then((m) => m.PdfCompressor), {
    ssr: false,
    loading: Skeleton,
  }),
  "resize-photo-signature-for-exam-forms": dynamic(
    () => import("./photo-signature-resizer").then((m) => m.PhotoSignatureResizer),
    { ssr: false, loading: Skeleton },
  ),
};
```

**Acceptance criteria**

- [ ] Both pages are statically generated (`○ /tools/[slug]` prerendered, 2 entries in the build output), with zero function invocations in the Vercel dashboard after a week.
- [ ] `validateRegistry` rejects a deliberately over-length `metaTitle` and fails the build (verified once, then reverted).
- [ ] Both pages emit a single JSON-LD `@graph` containing `SoftwareApplication`, `FAQPage`, and `BreadcrumbList`, with the `SoftwareApplication.author` node `@id`-referencing `${DATA.url}/#person`. Validates clean in the Rich Results Test.
- [ ] Word count on each page is 400–700, and the widget is the first interactive element below the meta row.
- [ ] Both URLs appear in `/sitemap.xml`.

---

**Total: 39h** (4 + 4 + 2 + 3 + 3.5 + 4.5 + 4.5 + 3 + 3 + 2.5 + 3.5 + 1.5).

#### Deferred from this sprint

- **Batch / multi-file processing.** One file at a time. Batching multiplies the memory problem by N and doubles the UI surface.
- **Signature clean-up** (background whitening, ink darkening, auto-deskew). Genuinely useful, genuinely a separate ticket with its own thresholding work.
- **Per-page quality optimisation** for PDFs (spend more bits on the text-heavy pages). Meaningfully better output, meaningfully more search space. Sprint 4 candidate.
- **OPFS caching of the MediaPipe WASM** so repeat visits skip the 3.2 MB entirely. The HTTP cache plus the service worker covers 90% of the benefit for 5% of the work.
- **Auto-detected "email attachment limit" presets** (25 MB Gmail, 10 MB corporate). Nice hook, no code exists for it yet.
- **PDF/A output, page rotation, page removal.** Adjacent tools, not this one.
- **WebP and AVIF output.** Exam portals reject both. Revisit when the generic image compressor ships.

---

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Renderer OOM on a low-end Android with a 40MB PDF — silent tab death, no error, user blames the tool | High | High | CORE--03: hard `maxInputBytes` per memory tier with a specific refusal message; `BitmapCache` byte ceiling with FIFO eviction; strictly serial page render; `canvas.width = 0` on every path; `page.cleanup()` + `doc.destroy()` in `finally`. Verified against a 512MB-heap Chrome session in TEST--01. |
| Safari < 16.4 cannot construct nested workers, so pdf.js fails inside our worker | Medium | High | `openPdf` constructs the nested worker in a `try` and falls back to pdf.js in-thread parsing within our worker — slower, still off the main thread. WebKit is a required Playwright target so a regression fails CI. |
| `createImageBitmap({ imageOrientation })` silently ignored → sideways passport photos on iPhone | Medium | High | One-time feature probe against a committed 1×2 Orientation-6 `data:` fixture; manual APP1 parse + canvas transform fallback. Eight orientation fixtures asserted per browser. |
| Exam preset numbers are wrong or go stale; a user's form is rejected | Medium | High | Every preset carries `source` + `verifiedOn` in code and is re-read from the authority page as a release-checklist item. The UI always shows the exact output dimensions and byte count so the user can check against their form. Never present a preset as authoritative advice. |
| MediaPipe's 3.2 MB lands in the initial bundle by accident and destroys the LCP budget | Medium | Medium | Only reachable via `await import()` inside a click handler; a Playwright assertion fails the suite if any `mediapipe|wasm|tflite` request fires before a click; Lighthouse budget in DoD. |
| Users flatten a text PDF without understanding, then complain their PDF is "broken" | Medium | Medium | PDF--02's blocking decision card with the four concrete consequences, a side-by-side quality preview, a filename that says `-flattened-`, and a persistent post-run status note. Scanned PDFs skip the warning entirely so the friction lands only where it matters. |
| Cooperative cancel does not fire during an uninterruptible pdf.js render, leaving a frozen "Cancelling…" state | Medium | Low | `FileJobClient.cancel()` arms a 1.5s timer that terminates the worker outright and rejects the promise; the next job lazily respawns. |
| Stale service worker serves an old tool page after a deploy | Low | Medium | Network-first for navigations; build-id-versioned cache name; old caches deleted on `activate`; `Cache-Control: no-store` header on `/sw-tools.js`. |
| pdf-lib is lightly maintained | Low | Medium | We use four stable APIs (`create`, `embedJpg`, `addPage`, `drawImage`). If it stalls, `@cantoo/pdf-lib` is a drop-in fork. Not worth pre-emptively switching. |
| Non-monotonic JPEG size vs quality makes the bisect return an over-target file | Low | High | `compressToTarget` never trusts the monotonicity invariant: it tracks the best *fitting* probe seen anywhere and returns that. PDF--01 adds a real-assembly verify step with up to two corrective iterations. Covered by a dedicated non-monotonic unit test. |

---

### Definition of Done

- [ ] `pnpm build` completes with **0 TypeScript errors** and 0 ESLint errors (both checks are enforced — Sprint 0 removed the `ignoreBuildErrors` escape hatches).
- [ ] `pnpm test:unit` green; `pnpm test:browser` green on Chromium **and** WebKit.
- [ ] Build output shows both tool routes as statically prerendered (`○`), and `next build` reports no new dynamic routes.
- [ ] Lighthouse (mobile, Moto G4 throttle) on both tool pages: Performance ≥ 92, Accessibility = 100, Best Practices ≥ 95, SEO = 100; LCP ≤ 2.0s; initial route JS ≤ 130 KB gzipped with **no** pdf.js, pdf-lib, or MediaPipe in the initial chunk.
- [ ] axe-core: 0 violations across idle / running / error / done states on both pages.
- [ ] Zero cross-origin requests during a full job on either tool, asserted in CI.
- [ ] Both pages validate clean in Google's Rich Results Test with `SoftwareApplication` + `FAQPage` + `BreadcrumbList`, and the author node resolves to the existing `#person` entity.
- [ ] Merged to `main`, deployed to Vercel production, and both URLs verified live at `https://kavithakanchana.me/tools/...`.
- [ ] Vercel dashboard shows **0 serverless function invocations** attributable to `/tools/*` over the 48h after deploy.
- [ ] Both URLs submitted to Google Search Console via URL Inspection and showing "URL is on Google" or "Indexing requested".
- [ ] `README` section added describing how to run the fixture generator and regenerate goldens.
- [ ] The `verifiedOn` date on every preset is within 30 days of the deploy date.

---

### Demo script

1. `pnpm build && pnpm start`, open `http://localhost:3000/tools/compress-pdf-to-exact-size` in Chrome with DevTools → Network open and the filter set to `mediapipe|wasm|tflite`. Confirm **zero** matching requests on page load and that the widget is visible without scrolling.
2. Drop `tests/fixtures/generated/text-heavy-60p.pdf` in, set the target to **300 KB**, and press Compress. Confirm: structural mode runs first, reports its (small) saving, and then the blocking decision card appears listing the four consequences of flattening, with a side-by-side page-1 quality preview.
3. Click "Flatten to images." Watch the progress region tick through *Rendering pages → Finding the best quality → Building the output file*, then download. In a terminal: `ls -l` the download and confirm it is ≤ 307,200 bytes; `pdftotext out.pdf -` and confirm it emits nothing — the flatten warning told the truth.
4. Re-run the same file at a **50 KB** target. Confirm you get a clear `TARGET_UNREACHABLE` message naming the smallest achievable size, not a spinner that never resolves and not an over-target download.
5. Start a job on the 40MB fixture and hit **Cancel** two seconds in. Confirm the UI returns to idle within ~1.5s and that a subsequent job runs normally (the worker respawned).
6. Switch to `/tools/resize-photo-signature-for-exam-forms`. Upload `tests/fixtures/iphone-portrait-exif6.jpg`. Confirm the preview is **upright**, not sideways. Hover "Auto-crop to face" and watch the two `prefetch` requests appear in the Network panel; click it and confirm the crop rect snaps to the head with visible crown/chin handles you can drag.
7. Pick the 200 × 230 / 50 KB preset, compress, download. Verify with `identify -format "%wx%h %b\n" out.jpg` that it reports exactly `200x230` and under 50 KB.
8. Set DevTools → Network → **Offline**, reload the page, and repeat step 7 end to end. It works. Then scroll to the "Proof this runs on your device" panel and confirm it reads **0** cross-origin requests.