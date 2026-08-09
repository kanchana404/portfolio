> Part of [SPRINT-PLAN.md](SPRINT-PLAN.md). **Part II (Amendments) overrides anything below it.**

## Sprint 7 — Media/AI: background remover (WASM-first) + passport photo maker

**Sprint goal** — Ship the two flagship media tools so that the common path executes entirely in the visitor's browser at $0 marginal cost, with a paid-compute tier used only where the browser genuinely cannot compete.

**Duration** — 2 weeks (30–40h). **Total estimated: 39h.**

**Depends on**
- **Sprint 0** (done): route groups `(site)`/`(tools)`, `@db` path alias, `ignoreBuildErrors` removed.
- **Sprint 1**: `src/lib/tools/registry.ts` + `src/lib/tools/validate.ts`, `/tools/[slug]` static template with `dynamicParams = false`, `generateStaticParams()`, JSON-LD @graph.
- **Sprint 3**: the photo spec registry (`src/lib/tools/photo-specs.ts`) with per-country document dimensions and source URLs.
- **Sprint 5/6**: the Railway FastAPI service skeleton, the HMAC single-use ticket minting route (canonical decision #9), the job API (#10), and the per-IP-hash quota + spend kill-switch (#11).

---

### Definition of Ready

- [ ] `pnpm build` passes on `main` with 0 tsc errors and the tools template renders a static `/tools/[slug]`.
- [ ] `src/lib/tools/registry.ts` exports `TOOLS` and `TOOLS.length <= 25` (this sprint adds 5 entries; the validator throws at >30, so confirm the headroom before you start).
- [ ] `src/lib/tools/photo-specs.ts` exists and exports at least `lk-passport`, `us-passport`, `schengen-visa`, each with a `sourceUrl` and `verifiedOn`.
- [ ] Railway media service is deployed and reachable; `POST /healthz` returns 200; the ticket-verify dependency from Sprint 5 is importable as `app.security.require_ticket`.
- [ ] `NEXT_PUBLIC_MEDIA_API_ORIGIN` and `TOOLS_TICKET_SECRET` are set in Vercel (all three environments).
- [ ] You have run `curl -sI https://app.usecortana.ai/api/hub/v1/cmqp4fx5200adi9041c7skj20 | grep -i cross-origin` and pasted the result into MEDI-01. This is an input to a decision, not a formality.
- [ ] A 12 MP iPhone HEIC, a 4000×3000 JPEG portrait, and a deliberately bad passport source photo (side-lit, patterned wall) are checked into `test-fixtures/` for manual verification.

---

### Tickets

---

### MEDI-01 COOP/COEP investigation and threading verdict

**Estimate:** 2h · **Depends on:** — · **Files:** `next.config.mjs`, `docs/adr/0007-no-cross-origin-isolation.md`, `src/components/font-loader.tsx` (deleted), `src/app/layout.tsx`

**Why** — `onnxruntime-web` runs multi-threaded only when `SharedArrayBuffer` exists, which requires the document to be cross-origin isolated (`COOP: same-origin` + a `COEP` value). Turning those headers on is a one-line change with a site-wide blast radius, and the failure mode is silent: third-party subresources stop loading. Decide this before writing the inference code, because the decision changes the code.

**Implementation**

The site's cross-origin subresources, verified by reading `src/app/layout.tsx`:

| Subresource | Where | Request mode | Under `require-corp` | Under `credentialless` |
|---|---|---|---|---|
| `https://app.usecortana.ai/api/hub/v1/cmqp4fx…` | `TrackingScript`, every page | `no-cors` classic script | **Blocked** unless that origin returns `Cross-Origin-Resource-Policy: cross-origin` | Loads, but **without cookies** — the pixel loses its own first-party cookie on tool pages |
| `https://fonts.googleapis.com/css2?family=Inter…` | `FontLoader`, injected in `useEffect` | `no-cors` stylesheet | **Blocked** unless CORP present | Loads without credentials |
| GitHub API `fetch` in `github-calendar` / `github-repos` | `(site)` only | CORS `fetch` | Fine (COEP does not restrict successful CORS responses) | Fine |
| `/kavitha-kanchana-software-engineer.jpg`, OG images | same-origin | — | Fine | Fine |

Three findings, in increasing order of importance:

1. **`FontLoader` is dead weight and should be deleted regardless of this decision.** `src/app/layout.tsx` already calls `Inter` from `next/font/google`, which self-hosts the font at build time and sets `--font-sans`. `FontLoader` then injects a *second*, render-time, cross-origin request for the same family. Deleting it removes a network round trip on every page, removes a COEP blocker, and is a strictly-positive LCP change.

   ```diff
   --- a/src/app/layout.tsx
   +++ b/src/app/layout.tsx
   @@
   -import FontLoader from "@/components/font-loader";
   @@
   -        {/* Font loader */}
   -        <FontLoader />
   -
   ```
   Then `rm src/components/font-loader.tsx`.

2. **`credentialless` is not universally available.** It is supported in Chromium and Firefox but not in every Safari version currently in the field. On a browser without it, a `COEP: credentialless` header is unrecognised, the document is not isolated, `SharedArrayBuffer` is absent, and you are back to one thread anyway. So the header buys threads for *some* browsers while degrading the analytics pixel for *all* of them.

3. **The trap that actually kills it: soft navigation.** COOP/COEP are properties of a *document*, not a URL. Next's App Router client-side navigation does not create a new document. A visitor who lands on `/`, then clicks the Dock through to `/tools/remove-background-from-image`, is running in the document that was served for `/` — not isolated, `crossOriginIsolated === false`, no threads. A visitor who lands on the tool URL directly from Google gets a fresh isolated document and four threads. Same URL, same code, two performance profiles, decided by referral path. That is not a system you can reason about, benchmark, or support.

**Verdict: do not enable COOP/COEP in Sprint 7.** Ship single-threaded WASM SIMD. Keep the thread count derived from `crossOriginIsolated` so the upgrade is free if the decision is ever revisited. Record the decision, with the escape hatch, as a commented-out block in `next.config.mjs` so the next person does not rediscover this from scratch:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      {
        // Model weights and the ORT wasm artifacts are content-addressed by
        // filename (…-v1.onnx). Immutable + 1y. These are the only assets in
        // /public that are allowed an immutable cache.
        source: "/:dir(models|ort)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // ---------------------------------------------------------------------
      // DELIBERATELY NOT ENABLED — see docs/adr/0007-no-cross-origin-isolation.md
      //
      // Cross-origin isolation would unlock SharedArrayBuffer and multi-threaded
      // onnxruntime-web. It is rejected because:
      //   1. COEP: require-corp blocks the Cortana AI pixel in <TrackingScript>
      //      (app.usecortana.ai sends no Cross-Origin-Resource-Policy header).
      //   2. COEP: credentialless would load the pixel without cookies, and is
      //      not supported across the whole Safari install base anyway.
      //   3. App Router soft navigation means isolation depends on which
      //      document the visitor first loaded, so thread availability would be
      //      nondeterministic between "landed on /tools/x" and "clicked through
      //      from /". Two performance profiles for one URL is unsupportable.
      //
      // If this is ever revisited: add the block below, re-verify the pixel,
      // and nothing in the inference code needs to change — segmentation.worker.ts
      // already reads `self.crossOriginIsolated` to pick numThreads.
      //
      // {
      //   source: "/tools/:path*",
      //   headers: [
      //     { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
      //     { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
      //   ],
      // },
      // ---------------------------------------------------------------------
    ];
  },
};

export default nextConfig;
```

One dead end worth naming so nobody spends an afternoon on it: **you cannot escape this with an isolated iframe.** A same-origin iframe served with COEP is only cross-origin isolated if its entire ancestor chain is isolated too. An isolated iframe inside a non-isolated `/tools/*` page reports `crossOriginIsolated === false`. There is no per-widget isolation.

**Acceptance criteria**
- [ ] `curl -sI` output for `app.usecortana.ai` recorded verbatim in `docs/adr/0007-no-cross-origin-isolation.md`.
- [ ] ADR written, states the verdict, the three reasons, and the exact re-enable procedure.
- [ ] `src/components/font-loader.tsx` deleted; no import of it remains (`grep -r FontLoader src/` returns nothing).
- [ ] `next.config.mjs` has the `headers()` block for `/models` and `/ort` and the commented isolation block.
- [ ] Site loads, Inter still renders (check computed `font-family` on `<body>` is `__Inter_…`), tracking pixel still fires (Network tab, 200).

---

### MEDI-02 ORT runtime harness, model asset pipeline, Cache Storage

**Estimate:** 4h · **Depends on:** MEDI-01 · **Files:** `scripts/copy-ort-wasm.mjs`, `scripts/fetch-models.mjs`, `package.json`, `public/models/u2netp-q8-v1.onnx`, `public/ort/*`, `src/lib/tools/media/model-cache.ts`, `.gitignore`

**Why** — `onnxruntime-web` needs its `.wasm`/`.mjs` artifacts served from a known path; webpack will not emit them for you. And a 4 MB model downloaded on every visit is a worse product than remove.bg, so the model must land in Cache Storage on first use and never be fetched again.

**Implementation**

Install: `pnpm add onnxruntime-web@1.20.1`.

The ORT artifact filenames have changed between minor versions (1.17 shipped four `.wasm` files, 1.20 collapsed to a threaded build plus a JSEP build). Glob rather than hard-code, so a version bump does not silently ship a 404:

```js
// scripts/copy-ort-wasm.mjs
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.join(path.dirname(require.resolve("onnxruntime-web/package.json")), "dist");
const dest = path.join(process.cwd(), "public", "ort");

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

const wanted = (await readdir(dist)).filter(
  (f) => /^ort-wasm.*\.(wasm|mjs)$/.test(f) && !f.includes(".jsep."), // WebGPU path unused
);

if (wanted.length === 0) {
  throw new Error(`No ORT wasm artifacts found in ${dist}. Did onnxruntime-web change layout?`);
}

for (const f of wanted) {
  await cp(path.join(dist, f), path.join(dest, f));
}
console.log(`[ort] copied ${wanted.length} artifact(s) -> public/ort: ${wanted.join(", ")}`);
```

The model is a build input, not source. Do not commit 4 MB of weights; fetch and checksum them:

```js
// scripts/fetch-models.mjs
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";

// u2netp, quantized to int8. Apache-2.0 (see src/lib/tools/licences.ts).
// Pin BOTH the URL and the digest: a silently-swapped model is a silently-
// changed product.
const MODELS = [
  {
    file: "u2netp-q8-v1.onnx",
    url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
    sha256: "8e83ca70e441ab006c5b7b1f0b7b1f1a1c0e0b0d0000000000000000000000000", // REPLACE with real digest
  },
];

const dir = path.join(process.cwd(), "public", "models");
await mkdir(dir, { recursive: true });

for (const m of MODELS) {
  const out = path.join(dir, m.file);
  try {
    await access(out);
    const have = createHash("sha256").update(await readFile(out)).digest("hex");
    if (have === m.sha256) { console.log(`[models] ${m.file} cached`); continue; }
    console.warn(`[models] ${m.file} digest mismatch, refetching`);
  } catch { /* not present */ }

  const res = await fetch(m.url);
  if (!res.ok) throw new Error(`[models] ${m.url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = createHash("sha256").update(buf).digest("hex");
  if (got !== m.sha256) throw new Error(`[models] digest mismatch for ${m.file}: got ${got}`);
  await writeFile(out, buf);
  console.log(`[models] fetched ${m.file} (${(buf.length / 1e6).toFixed(2)} MB)`);
}
```

```jsonc
// package.json — scripts
{
  "prebuild": "node scripts/copy-ort-wasm.mjs && node scripts/fetch-models.mjs",
  "predev":   "node scripts/copy-ort-wasm.mjs && node scripts/fetch-models.mjs"
}
```
```gitignore
/public/ort/
/public/models/
```

Cache Storage wrapper, with progress and a graceful path for browsers where `caches` is unavailable (Safari private browsing, some embedded webviews):

```ts
// src/lib/tools/media/model-cache.ts
const CACHE_NAME = "kk-tools-models-v1";

/**
 * Fetch a model, preferring Cache Storage. The URL carries a version suffix
 * (…-v1.onnx) so a new model is a new cache key; old entries are evicted by
 * pruneOldCaches(). Never throws on cache failure — worst case is a re-download.
 */
export async function loadModelBuffer(
  url: string,
  onProgress?: (ratio: number) => void,
): Promise<ArrayBuffer> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) {
      onProgress?.(1);
      return await hit.arrayBuffer();
    }
  } catch {
    cache = null; // storage denied — fall through to a plain fetch
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Model fetch failed: ${res.status} ${url}`);

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body?.getReader();

  let bytes: Uint8Array;
  if (!reader || total === 0) {
    bytes = new Uint8Array(await res.clone().arrayBuffer());
    onProgress?.(1);
  } else {
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onProgress?.(Math.min(1, received / total));
    }
    bytes = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
  }

  if (cache) {
    try {
      await cache.put(
        url,
        new Response(bytes, {
          headers: {
            "content-type": "application/octet-stream",
            "content-length": String(bytes.byteLength),
          },
        }),
      );
    } catch { /* quota exceeded — not fatal */ }
  }

  // Return a detached copy so the caller can transfer it without touching cache state.
  return bytes.buffer.slice(0) as ArrayBuffer;
}

/** Drop caches from previous model versions. Fire-and-forget on tool mount. */
export async function pruneOldCaches(): Promise<void> {
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith("kk-tools-models-") && k !== CACHE_NAME).map((k) => caches.delete(k)),
    );
  } catch { /* ignore */ }
}
```

**Acceptance criteria**
- [ ] `pnpm build` runs `prebuild`; `public/ort/` contains at least `ort-wasm-simd-threaded.wasm` and `.mjs`; `public/models/u2netp-q8-v1.onnx` is 4–5 MB.
- [ ] `scripts/fetch-models.mjs` exits non-zero if the digest does not match (verify by corrupting one hex char).
- [ ] `curl -sI https://kavithakanchana.me/models/u2netp-q8-v1.onnx` returns `cache-control: public, max-age=31536000, immutable`.
- [ ] Second visit to the tool shows the model served from Cache Storage: DevTools → Application → Cache Storage → `kk-tools-models-v1` contains the entry, and the Network panel shows **no** request for the `.onnx`.
- [ ] Neither `/public/ort` nor `/public/models` appears in `git status`.

---

### MEDI-03 Segmentation worker — pre/post-processing, mask upsample, compositing

**Estimate:** 6h · **Depends on:** MEDI-02 · **Files:** `src/lib/tools/media/segmentation.worker.ts`, `src/lib/tools/media/segmentation-client.ts`, `src/lib/tools/media/types.ts`

**Why** — This is the core of the sprint. Getting the normalization wrong produces a mask that looks *nearly* right, which is worse than one that is obviously broken, because you will ship it. The numbers below match `rembg`'s `SimpleSession` exactly so that the browser tier and the Railway tier produce comparable output.

**Implementation**

```ts
// src/lib/tools/media/types.ts
export type BackgroundOption =
  | { kind: "transparent" }
  | { kind: "color"; hex: `#${string}` };

export type SegRequest =
  | { type: "warm" }
  | {
      type: "segment";
      id: string;
      bitmap: ImageBitmap;
      background: BackgroundOption;
      /** Gaussian-ish feather applied to the alpha edge, in output pixels. 0 = off. */
      feather: number;
    };

export type SegResponse =
  | { type: "ready"; threads: number }
  | { type: "progress"; id: string; phase: "model" | "infer" | "composite"; ratio: number }
  | { type: "result"; id: string; blob: Blob; width: number; height: number; ms: number; coverage: number }
  | { type: "error"; id: string | null; message: string };
```

```ts
// src/lib/tools/media/segmentation.worker.ts
/// <reference lib="webworker" />
import * as ort from "onnxruntime-web";
import { loadModelBuffer } from "./model-cache";
import type { BackgroundOption, SegRequest, SegResponse } from "./types";

declare const self: DedicatedWorkerGlobalScope;

const MODEL_URL = "/models/u2netp-q8-v1.onnx";
const N = 320;                       // u2netp's fixed input side
const MEAN = [0.485, 0.456, 0.406];  // matches rembg SimpleSession
const STD = [0.229, 0.224, 0.225];
/** Refuse anything whose long edge exceeds this. RGBA at 8000px is ~256 MB per copy. */
const MAX_EDGE = 6000;

ort.env.wasm.wasmPaths = "/ort/";
ort.env.wasm.simd = true;
// SharedArrayBuffer requires cross-origin isolation, which we deliberately do not
// ship (MEDI-01 / ADR-0007). This evaluates to 1 in production. Leaving the
// expression here means threads switch on for free if that decision changes.
ort.env.wasm.numThreads = self.crossOriginIsolated
  ? Math.min(4, navigator.hardwareConcurrency || 1)
  : 1;
ort.env.logLevel = "error";

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getSession(onProgress: (r: number) => void): Promise<ort.InferenceSession> {
  sessionPromise ??= (async () => {
    const buf = await loadModelBuffer(MODEL_URL, onProgress);
    return ort.InferenceSession.create(buf, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  })();
  return sessionPromise;
}

/**
 * NCHW float32, [1,3,320,320].
 *
 * Note the divisor: rembg normalizes by the image's own maximum channel value,
 * not by a constant 255. For a well-exposed photo these are the same; for an
 * underexposed one they are not, and matching the training-time preprocessing
 * measurably improves the mask on dark images. Do not "simplify" this to /255.
 */
function preprocess(px: Uint8ClampedArray): Float32Array {
  let max = 0;
  for (let p = 0; p < px.length; p += 4) {
    if (px[p] > max) max = px[p];
    if (px[p + 1] > max) max = px[p + 1];
    if (px[p + 2] > max) max = px[p + 2];
  }
  if (max === 0) max = 1;

  const plane = N * N;
  const out = new Float32Array(3 * plane);
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    out[i] = (px[p] / max - MEAN[0]) / STD[0];
    out[i + plane] = (px[p + 1] / max - MEAN[1]) / STD[1];
    out[i + 2 * plane] = (px[p + 2] / max - MEAN[2]) / STD[2];
  }
  return out;
}

/** u2net emits d0..d6; d0 is the fused prediction. Min-max stretch to [0,255]. */
function postprocessToMaskImage(pred: Float32Array): ImageData {
  let mi = Infinity;
  let ma = -Infinity;
  for (let i = 0; i < pred.length; i++) {
    if (pred[i] < mi) mi = pred[i];
    if (pred[i] > ma) ma = pred[i];
  }
  const range = ma - mi || 1;

  const img = new ImageData(N, N);
  for (let i = 0, p = 0; i < pred.length; i++, p += 4) {
    const v = ((pred[i] - mi) / range) * 255;
    img.data[p] = v;
    img.data[p + 1] = v;
    img.data[p + 2] = v;
    img.data[p + 3] = 255;
  }
  return img;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function segment(
  bitmap: ImageBitmap,
  background: BackgroundOption,
  feather: number,
  emit: (r: SegResponse) => void,
  id: string,
): Promise<{ blob: Blob; width: number; height: number; coverage: number }> {
  const W = bitmap.width;
  const H = bitmap.height;
  if (Math.max(W, H) > MAX_EDGE) {
    throw new Error(
      `Image is ${W}x${H}. The in-browser engine caps the long edge at ${MAX_EDGE}px to stay inside the tab's memory budget. Resize it first, or use the higher-quality server option.`,
    );
  }

  // --- 1. downscale to the model's fixed 320x320. Aspect ratio is deliberately
  //        NOT preserved: u2net was trained on square-warped inputs.
  const small = new OffscreenCanvas(N, N);
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(bitmap, 0, 0, W, H, 0, 0, N, N);
  const input = preprocess(sctx.getImageData(0, 0, N, N).data);

  // --- 2. inference
  emit({ type: "progress", id, phase: "infer", ratio: 0 });
  const session = await getSession((r) => emit({ type: "progress", id, phase: "model", ratio: r }));
  const feeds: Record<string, ort.Tensor> = {
    [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, N, N]),
  };
  const results = await session.run(feeds);
  const pred = results[session.outputNames[0]].data as Float32Array;
  emit({ type: "progress", id, phase: "infer", ratio: 1 });

  // --- 3. upsample the 320x320 mask back to source resolution. drawImage with
  //        high-quality smoothing gives bilinear/bicubic for free and is an order
  //        of magnitude faster than doing it by hand in JS.
  emit({ type: "progress", id, phase: "composite", ratio: 0 });
  const maskSmall = new OffscreenCanvas(N, N);
  maskSmall.getContext("2d")!.putImageData(postprocessToMaskImage(pred), 0, 0);

  const maskFull = new OffscreenCanvas(W, H);
  const mctx = maskFull.getContext("2d", { willReadFrequently: true })!;
  mctx.imageSmoothingEnabled = true;
  mctx.imageSmoothingQuality = "high";
  if (feather > 0) mctx.filter = `blur(${feather}px)`;
  mctx.drawImage(maskSmall, 0, 0, N, N, 0, 0, W, H);
  mctx.filter = "none";
  const maskPx = mctx.getImageData(0, 0, W, H).data;

  // --- 4. composite. Straight (non-premultiplied) alpha into the source RGBA.
  const out = new OffscreenCanvas(W, H);
  const octx = out.getContext("2d", { willReadFrequently: true })!;
  octx.drawImage(bitmap, 0, 0);
  const frame = octx.getImageData(0, 0, W, H);
  const d = frame.data;

  let alphaSum = 0;
  if (background.kind === "color") {
    const [br, bg, bb] = hexToRgb(background.hex);
    for (let p = 0; p < d.length; p += 4) {
      const a = maskPx[p] / 255;
      alphaSum += a;
      d[p] = d[p] * a + br * (1 - a);
      d[p + 1] = d[p + 1] * a + bg * (1 - a);
      d[p + 2] = d[p + 2] * a + bb * (1 - a);
      d[p + 3] = 255;
    }
  } else {
    for (let p = 0; p < d.length; p += 4) {
      const a = maskPx[p];
      alphaSum += a / 255;
      d[p + 3] = a;
    }
  }
  octx.putImageData(frame, 0, 0);
  emit({ type: "progress", id, phase: "composite", ratio: 1 });

  const blob = await out.convertToBlob({ type: "image/png" });
  bitmap.close();
  return { blob, width: W, height: H, coverage: alphaSum / (W * H) };
}

self.onmessage = async (e: MessageEvent<SegRequest>) => {
  const msg = e.data;
  const emit = (r: SegResponse) => self.postMessage(r);
  try {
    if (msg.type === "warm") {
      await getSession((r) => emit({ type: "progress", id: "warm", phase: "model", ratio: r }));
      emit({ type: "ready", threads: ort.env.wasm.numThreads ?? 1 });
      return;
    }
    const t0 = performance.now();
    const { blob, width, height, coverage } = await segment(
      msg.bitmap, msg.background, msg.feather, emit, msg.id,
    );
    emit({ type: "result", id: msg.id, blob, width, height, coverage, ms: performance.now() - t0 });
  } catch (err) {
    emit({
      type: "error",
      id: msg.type === "segment" ? msg.id : null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export {};
```

The client wrapper. Next 14 / webpack 5 handles `new Worker(new URL(...), { type: "module" })` natively — no config needed — provided the call site is a client component.

```ts
// src/lib/tools/media/segmentation-client.ts
import type { BackgroundOption, SegRequest, SegResponse } from "./types";

export interface SegmentOptions {
  background: BackgroundOption;
  feather?: number;
  onProgress?: (phase: "model" | "infer" | "composite", ratio: number) => void;
}

export class SegmentationEngine {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<
    string,
    { resolve: (v: Extract<SegResponse, { type: "result" }>) => void; reject: (e: Error) => void;
      onProgress?: SegmentOptions["onProgress"] }
  >();

  constructor() {
    this.worker = new Worker(new URL("./segmentation.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<SegResponse>) => {
      const m = e.data;
      if (m.type === "ready") return;
      const entry = m.type === "error" && m.id === null ? undefined : this.pending.get(m.id!);
      if (!entry) return;
      if (m.type === "progress") entry.onProgress?.(m.phase, m.ratio);
      if (m.type === "result") { this.pending.delete(m.id); entry.resolve(m); }
      if (m.type === "error") { this.pending.delete(m.id!); entry.reject(new Error(m.message)); }
    };
  }

  /** Start downloading + compiling the model without blocking on a user image. */
  warm(): void {
    this.worker.postMessage({ type: "warm" } satisfies SegRequest);
  }

  segment(bitmap: ImageBitmap, opts: SegmentOptions) {
    const id = `s${++this.seq}`;
    return new Promise<Extract<SegResponse, { type: "result" }>>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress: opts.onProgress });
      const req: SegRequest = {
        type: "segment", id, bitmap, background: opts.background, feather: opts.feather ?? 1,
      };
      this.worker.postMessage(req, [bitmap]); // transfer, do not copy
    });
  }

  dispose(): void {
    this.worker.terminate();
    this.pending.forEach((p) => p.reject(new Error("Engine disposed")));
    this.pending.clear();
  }
}
```

**Acceptance criteria**
- [ ] A 3000×2000 portrait JPEG produces a PNG with a plausible alpha channel; opening it in Preview/GIMP over a coloured layer shows no halo wider than ~2 px.
- [ ] `coverage` for a typical portrait falls in 0.10–0.60; log it and use it as a smoke assertion.
- [ ] Median wall-clock for the `segment` phase (model already cached) on an M-series MacBook is **≤ 1.5 s**, and p75 on a throttled 4× CPU profile is **≤ 6 s**. Record actuals in the ADR.
- [ ] A 7000 px image produces the explicit `MAX_EDGE` error message, not an out-of-memory crash.
- [ ] Two segments fired back-to-back both resolve, and neither leaks (the `pending` map is empty afterwards).
- [ ] `ImageBitmap` is transferred, not structured-cloned — verify by checking `bitmap.width === 0` on the main thread after `postMessage`.

---

### MEDI-04 Background remover tool page, widget UI, registry entry

**Estimate:** 3h · **Depends on:** MEDI-03 · **Files:** `src/components/tools/background-remover.tsx`, `src/lib/tools/widgets.ts`, `src/lib/tools/registry.ts`

**Why** — The template puts the widget above the fold, which means the widget's *shell* must render instantly and at a fixed height (or CLS blows the budget), while the ~1 MB of ORT JS and the 4 MB model load only after the user actually drops a file.

**Implementation**

The widget map is the single place `next/dynamic` is used, so the bundle story is auditable in one file:

```ts
// src/lib/tools/widgets.ts
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * Every tool widget is client-only and code-split. `ssr: false` is mandatory for
 * anything touching OffscreenCanvas, Worker, or WASM. `loading` must render a box
 * of the same height as the loaded widget — see MEDI-10's CLS budget.
 */
const Skeleton = () => (
  <div className="min-h-[420px] rounded-lg border border-dashed animate-pulse" aria-hidden />
);

export const WIDGETS: Record<string, ComponentType<Record<string, never>>> = {
  "remove-background-from-image": dynamic(
    () => import("@/components/tools/background-remover"),
    { ssr: false, loading: Skeleton },
  ),
  "passport-photo-maker": dynamic(
    () => import("@/components/tools/passport-photo-maker"),
    { ssr: false, loading: Skeleton },
  ),
  "heic-to-jpg-converter": dynamic(
    () => import("@/components/tools/image-converter"),
    { ssr: false, loading: Skeleton },
  ),
  "image-compressor": dynamic(
    () => import("@/components/tools/image-converter"),
    { ssr: false, loading: Skeleton },
  ),
  "bulk-image-resizer": dynamic(
    () => import("@/components/tools/bulk-resizer"),
    { ssr: false, loading: Skeleton },
  ),
};
```

```tsx
// src/components/tools/background-remover.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pruneOldCaches } from "@/lib/tools/media/model-cache";
import type { SegmentationEngine } from "@/lib/tools/media/segmentation-client";
import type { BackgroundOption } from "@/lib/tools/media/types";

type Tier = "browser" | "server";
type Status =
  | { s: "idle" }
  | { s: "working"; label: string; ratio: number }
  | { s: "done"; url: string; ms: number; tier: Tier }
  | { s: "error"; message: string };

const BACKGROUNDS: { label: string; value: BackgroundOption }[] = [
  { label: "Transparent", value: { kind: "transparent" } },
  { label: "White", value: { kind: "color", hex: "#FFFFFF" } },
  { label: "Studio blue", value: { kind: "color", hex: "#3A6EA5" } },
];

export default function BackgroundRemover() {
  const engineRef = useRef<SegmentationEngine | null>(null);
  const [tier, setTier] = useState<Tier>("browser");
  const [bgIndex, setBgIndex] = useState(0);
  const [status, setStatus] = useState<Status>({ s: "idle" });
  const [srcUrl, setSrcUrl] = useState<string | null>(null);

  useEffect(() => {
    void pruneOldCaches();
    return () => { engineRef.current?.dispose(); };
  }, []);

  const ensureEngine = useCallback(async () => {
    if (!engineRef.current) {
      // The ~1 MB onnxruntime-web chunk is fetched here and nowhere else.
      const { SegmentationEngine } = await import("@/lib/tools/media/segmentation-client");
      engineRef.current = new SegmentationEngine();
      engineRef.current.warm();
    }
    return engineRef.current;
  }, []);

  const runBrowser = useCallback(
    async (file: File) => {
      const engine = await ensureEngine();
      const bitmap = await createImageBitmap(file);
      const res = await engine.segment(bitmap, {
        background: BACKGROUNDS[bgIndex].value,
        feather: 1,
        onProgress: (phase, ratio) =>
          setStatus({
            s: "working",
            label:
              phase === "model" ? "Downloading the model (one time, then cached)"
              : phase === "infer" ? "Finding the subject"
              : "Compositing",
            ratio,
          }),
      });
      return { url: URL.createObjectURL(res.blob), ms: res.ms };
    },
    [bgIndex, ensureEngine],
  );

  const runServer = useCallback(
    async (file: File) => {
      setStatus({ s: "working", label: "Uploading to the high-quality engine", ratio: 0.2 });
      const { removeBackgroundRemote } = await import("@/lib/tools/media/remote-bg");
      const t0 = performance.now();
      const blob = await removeBackgroundRemote(file, BACKGROUNDS[bgIndex].value);
      return { url: URL.createObjectURL(blob), ms: performance.now() - t0 };
    },
    [bgIndex],
  );

  const onFile = useCallback(
    async (file: File) => {
      setSrcUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
      setStatus({ s: "working", label: "Reading image", ratio: 0.05 });
      try {
        const { url, ms } = tier === "browser" ? await runBrowser(file) : await runServer(file);
        setStatus({ s: "done", url, ms, tier });
      } catch (err) {
        setStatus({ s: "error", message: err instanceof Error ? err.message : "Something went wrong" });
      }
    },
    [tier, runBrowser, runServer],
  );

  return (
    <section className="min-h-[420px] rounded-lg border p-4 sm:p-6" aria-label="Background remover">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {BACKGROUNDS.map((b, i) => (
          <button
            key={b.label}
            type="button"
            onClick={() => setBgIndex(i)}
            aria-pressed={i === bgIndex}
            className={cn("rounded-full border px-3 py-1", i === bgIndex && "bg-foreground text-background")}
          >
            {b.label}
          </button>
        ))}
      </div>

      <fieldset className="mb-4 rounded-md border p-3 text-sm">
        <legend className="px-1 text-xs uppercase tracking-wide text-muted-foreground">Engine</legend>
        <label className="flex items-start gap-2">
          <input type="radio" checked={tier === "browser"} onChange={() => setTier("browser")} className="mt-1" />
          <span>
            <strong>In your browser</strong> — nothing is uploaded. Free, works offline after the first run.
            Struggles with fine hair and semi-transparent edges.
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2">
          <input type="radio" checked={tier === "server"} onChange={() => setTier("server")} className="mt-1" />
          <span>
            <strong>Higher quality (server)</strong> — a larger model runs on my server. Better hair and edge
            detail. <em>Your image is uploaded, processed in memory, and never written to disk.</em> Limited
            to a few runs per day per visitor because it costs me money.
          </span>
        </label>
      </fieldset>

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        className="block w-full text-sm"
      />

      {status.s === "working" && (
        <div className="mt-4" role="status" aria-live="polite">
          <p className="text-sm">{status.label}</p>
          <div className="mt-1 h-1.5 w-full rounded bg-muted">
            <div className="h-1.5 rounded bg-foreground transition-[width]"
                 style={{ width: `${Math.round(status.ratio * 100)}%` }} />
          </div>
        </div>
      )}

      {status.s === "error" && (
        <p className="mt-4 text-sm text-red-600" role="alert">{status.message}</p>
      )}

      {status.s === "done" && (
        <div className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {srcUrl && <img src={srcUrl} alt="Original" className="w-full rounded border" />}
            <img
              src={status.url}
              alt="Background removed"
              className="w-full rounded border"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {status.tier === "browser" ? "Processed on your device" : "Processed on the server"} in{" "}
            {(status.ms / 1000).toFixed(1)}s
          </p>
          <Button asChild className="mt-3">
            <a href={status.url} download="background-removed.png">Download PNG</a>
          </Button>
        </div>
      )}
    </section>
  );
}
```

Registry entry (one shown in full; the other four follow the identical shape — `passport-photo-maker`, `heic-to-jpg-converter`, `image-compressor`, `bulk-image-resizer`):

```ts
// src/lib/tools/registry.ts — append to TOOLS
{
  slug: "remove-background-from-image",
  title: "Remove Image Background",
  metaTitle: "Remove Image Background Free — No Upload, Runs Offline", // 54 chars
  description:
    "Remove the background from any photo right in your browser. The image never leaves your device, there is no upload, no account and no watermark.", // 145 chars
  category: "image",
  updatedAt: "2026-08-20",
  intro:
    "Drop a photo in and the subject is cut out on your own machine — the file is never sent anywhere. A small neural network runs inside the browser tab, so this works on a plane, on hotel wifi, or with the tab offline once the model is cached.",
  howItWorks: `…≥120 words: the u2netp model, the 320×320 resize, the alpha mask, why it runs locally, what the server tier adds…`,
  gotchas: `…≥120 words: hair and fur, motion blur, subjects the same colour as the wall, glass and smoke, why a 6000px cap exists, JPEG cannot hold transparency so output is PNG…`,
  faqs: [
    { q: "Is my photo uploaded anywhere?", a: "No. On the default setting the image is decoded and processed inside your browser tab…" },
    { q: "Why is the first run slower?", a: "The first run downloads a 4 MB model file. It is stored in your browser's cache…" },
    { q: "Does it work offline?", a: "Yes, once the model is cached…" },
    { q: "Why does hair look rough?", a: "The in-browser model is the small u2netp variant…" },
    { q: "What formats can I upload?", a: "PNG, JPEG and WebP. HEIC from an iPhone should go through the HEIC converter first." },
  ],
  related: ["passport-photo-maker", "image-compressor", "bulk-image-resizer"],
}
```

**Acceptance criteria**
- [ ] `/tools/remove-background-from-image` is statically generated (`○` in `next build` output, not `λ`).
- [ ] With JS network throttled, the widget shell renders at 420 px height before any engine chunk loads; measured CLS on the page is ≤ 0.02.
- [ ] No request for `ort-wasm*.wasm` or the `.onnx` occurs until a file is selected — verify in a clean profile with the Network panel filtered to `wasm|onnx`.
- [ ] The engine radio group is keyboard operable and the tradeoff copy names the upload explicitly.
- [ ] Build fails if the registry entry violates the validator (test by shortening `description` to 100 chars).

---

### MEDI-05 Railway "higher quality" tier — rembg over u2net/BiRefNet

**Estimate:** 5h · **Depends on:** MEDI-04, Sprint 5 ticket auth · **Files:** `services/media/app/routers/bg_remove.py`, `services/media/app/models.py`, `services/media/Dockerfile`, `src/app/api/tools/ticket/route.ts`, `src/lib/tools/media/remote-bg.ts`

**Why** — u2netp int8 in the browser is good enough for 80% of photos and free. The remaining 20% — hair against a busy background, fur, semi-transparent fabric — needs a full-size model. That is worth ~$0.15 per 1000 runs, but only if it is the explicit exception, quota'd, and never the default.

**Implementation**

Model choice matters for RAM more than for quality. `birefnet-general` in fp32 ONNX is close to a gigabyte and will OOM a small Railway instance during warm-up. Default to `u2net` (176 MB, Apache-2.0) and expose `birefnet-general-lite` only if the container is sized for it.

```python
# services/media/app/routers/bg_remove.py
from __future__ import annotations

import io
import logging
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from rembg import new_session, remove
from rembg.sessions.base import BaseSession

from app.security import Ticket, require_ticket   # Sprint 5
from app.quota import consume_quota               # Sprint 5

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/image", tags=["image"])

MAX_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 40_000_000            # guard against decompression bombs
ModelName = Literal["u2net", "birefnet-general-lite"]

# Pillow's own bomb guard. Raise deliberately, do not disable.
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


@lru_cache(maxsize=2)
def get_session(model: ModelName) -> BaseSession:
    """Sessions are process-global and expensive (~1.5s + 176MB for u2net).
    Weights are baked into the image at build time (see Dockerfile), so this
    never hits the network."""
    log.info("loading rembg session model=%s", model)
    return new_session(model)


@router.post("/remove-background")
async def remove_background(
    file: UploadFile = File(...),
    model: ModelName = Form("u2net"),
    background_hex: str | None = Form(None),
    ticket: Ticket = Depends(require_ticket),
) -> Response:
    await consume_quota(ticket, cost_units=1)

    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, f"Image exceeds {MAX_BYTES // (1024*1024)} MB")

    try:
        src = Image.open(io.BytesIO(raw))
        src.load()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise HTTPException(400, "Could not decode that image") from exc

    # EXIF orientation is the single most common "the output is rotated" bug.
    src = ImageOps.exif_transpose(src).convert("RGB")

    cut = remove(src, session=get_session(model), post_process_mask=True)  # RGBA

    if background_hex:
        try:
            flat = Image.new("RGBA", cut.size, background_hex)
        except ValueError as exc:
            raise HTTPException(400, "background_hex must be like #FFFFFF") from exc
        flat.alpha_composite(cut)
        cut = flat

    buf = io.BytesIO()
    cut.save(buf, format="PNG", optimize=True)
    # No disk writes anywhere in this handler; the promise in the UI is literal.
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={"Cache-Control": "no-store", "X-Model": model},
    )
```

```dockerfile
# services/media/Dockerfile
FROM python:3.12-slim AS base

# ---------------------------------------------------------------------------
# THIRD-PARTY MODEL AND LIBRARY LICENCES BAKED INTO THIS IMAGE
# Full text and provenance: services/media/LICENSES.md (MEDI-11).
#
#   rembg                   MIT             OK commercial
#   u2net / u2netp weights  Apache-2.0      OK commercial — attribution required
#   BiRefNet (lite)         MIT             OK commercial
#   MediaPipe + .task files Apache-2.0      OK commercial
#   Pillow                  MIT-CMU         OK commercial
#   onnxruntime             MIT             OK commercial
#
# EXPLICITLY EXCLUDED — do not add these, they are non-commercial:
#   CodeFormer   S-Lab NC licence
#   LaMa         CC BY-NC-SA
#   GFPGAN       StyleGAN2 lineage, unresolved
# Any `pip install` that pulls one of these fails the licence check in CI.
# ---------------------------------------------------------------------------

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    U2NET_HOME=/opt/models \
    MPLCONFIGDIR=/tmp

RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt

# Bake weights at build time. Downloading 176 MB on the first request turns a
# cold start into a 30s timeout; this makes cold start ~2s of mmap instead.
RUN python -c "from rembg import new_session; new_session('u2net')" \
 && python -c "\
import mediapipe, urllib.request, pathlib; \
p = pathlib.Path('/opt/models/face_landmarker.task'); \
urllib.request.urlretrieve('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', p)"

COPY app ./app
COPY LICENSES.md ./LICENSES.md

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

Client side: **the browser posts directly to Railway**, not through Vercel. A Vercel Serverless Function caps the request body at 4.5 MB, so proxying a 10 MB photo through it fails by design; Vercel's only job is to mint the ticket.

```ts
// src/app/api/tools/ticket/route.ts
import { NextResponse } from "next/server";
import { mintTicket } from "@/lib/tools/ticket"; // Sprint 5: HMAC + jti in Redis

export const runtime = "edge";

const ALLOWED_OPS = new Set(["bg-remove", "passport-photo"]);

export async function POST(req: Request) {
  const { op } = (await req.json()) as { op?: string };
  if (!op || !ALLOWED_OPS.has(op)) {
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  }
  const ticket = await mintTicket({
    op,
    ip: req.headers.get("x-forwarded-for") ?? "0.0.0.0",
    ttlSeconds: 120,
  });
  return NextResponse.json({ ticket }, { headers: { "cache-control": "no-store" } });
}
```

```ts
// src/lib/tools/media/remote-bg.ts
import type { BackgroundOption } from "./types";

const ORIGIN = process.env.NEXT_PUBLIC_MEDIA_API_ORIGIN!;

export async function removeBackgroundRemote(file: File, bg: BackgroundOption): Promise<Blob> {
  const t = await fetch("/api/tools/ticket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "bg-remove" }),
  });
  if (!t.ok) throw new Error("Could not authorize the request. Reload and try again.");
  const { ticket } = (await t.json()) as { ticket: string };

  const form = new FormData();
  form.append("file", file);
  form.append("model", "u2net");
  if (bg.kind === "color") form.append("background_hex", bg.hex);

  const res = await fetch(`${ORIGIN}/v1/image/remove-background`, {
    method: "POST",
    headers: { authorization: `Bearer ${ticket}` },
    body: form,
  });

  if (res.status === 429) throw new Error("You've used today's server-side quota. The in-browser option is unlimited.");
  if (res.status === 503) throw new Error("The server engine is paused right now. Use the in-browser option.");
  if (!res.ok) throw new Error(`Server engine failed (${res.status}). Try the in-browser option.`);
  return res.blob();
}
```

**Acceptance criteria**
- [ ] `docker build` succeeds and `docker run … python -c "import os;print(os.listdir('/opt/models'))"` shows `u2net.onnx` and `face_landmarker.task` — no runtime download.
- [ ] Cold-start-to-first-200 on Railway is under 8 s (`time curl -F file=@fixture.jpg …`).
- [ ] A request with no ticket returns 401; a replayed ticket returns 401; an expired ticket returns 401.
- [ ] CORS `Access-Control-Allow-Origin` is exactly `https://kavithakanchana.me` — verify a request from a `null` origin is rejected.
- [ ] Exceeding the daily per-IP-hash quota returns 429 and the UI shows the "in-browser option is unlimited" message, not a stack trace.
- [ ] An EXIF-rotated iPhone JPEG comes back the right way up.
- [ ] `grep -rn "open(" services/media/app/routers/bg_remove.py` shows no filesystem writes.

---

### MEDI-06 Passport photo compute service — MediaPigraph geometry and compliance report

**Estimate:** 7h · **Depends on:** MEDI-05 · **Files:** `services/media/app/passport/geometry.py`, `services/media/app/passport/landmarks.py`, `services/media/app/passport/compliance.py`, `services/media/app/passport/sheet.py`, `services/media/app/routers/passport.py`

**Why** — Every free passport-photo site crops to the right *pixel dimensions* and stops there. Rejections happen because of head height, eye line, background shadow, and pose — none of which those sites check. The compliance report is the product; the crop is table stakes.

The spec itself stays in TypeScript (`src/lib/tools/photo-specs.ts`, Sprint 3) and is sent in the request body. Python validates ranges but never keeps its own copy — one source of truth, no drift.

**Implementation**

```python
# services/media/app/passport/geometry.py
from __future__ import annotations

import math
from dataclasses import dataclass

MM_PER_INCH = 25.4
Point = tuple[float, float]


@dataclass(frozen=True)
class PhotoSpec:
    """Mirrors PhotoSpec in src/lib/tools/photo-specs.ts. Sent by the client;
    validated (not defined) here."""
    id: str
    width_mm: float
    height_mm: float
    head_min_mm: float          # chin to crown
    head_max_mm: float
    eye_from_bottom_min_mm: float | None
    eye_from_bottom_max_mm: float | None
    background_hex: str
    dpi: int


@dataclass(frozen=True)
class FaceGeometry:
    chin: Point        # FaceMesh 152
    crown: Point       # from the alpha mask, not the mesh — see landmarks.py
    left_eye: Point    # iris centre, mesh 473
    right_eye: Point   # iris centre, mesh 468
    nose_tip: Point    # mesh 1
    face_width_px: float


@dataclass(frozen=True)
class Transform:
    roll_deg: float          # rotate the source by -roll about eye_mid to level the eyes
    scale: float             # source px -> output px; >1 means we are upscaling
    crop_left: float         # in rotated-source coordinates
    crop_top: float
    crop_w: float
    crop_h: float
    out_w_px: int
    out_h_px: int
    head_px_out: float
    eye_y_out_px: float


def px_per_mm(dpi: int) -> float:
    return dpi / MM_PER_INCH


def rotate_point(p: Point, centre: Point, deg: float) -> Point:
    """Rotate p about centre by `deg` (positive = counter-clockwise in image
    coordinates, matching PIL.Image.rotate)."""
    r = math.radians(deg)
    cos, sin = math.cos(r), math.sin(r)
    dx, dy = p[0] - centre[0], p[1] - centre[1]
    return (centre[0] + dx * cos + dy * sin, centre[1] - dx * sin + dy * cos)


def compute_transform(geo: FaceGeometry, spec: PhotoSpec) -> Transform:
    """The whole geometry of the tool lives here.

    Working in millimetres and converting once keeps the country specs readable:
    every published spec is expressed in mm of *printed* output, never pixels.
    """
    ppm = px_per_mm(spec.dpi)
    out_w = round(spec.width_mm * ppm)
    out_h = round(spec.height_mm * ppm)

    # 1. Level the eyes. Everything downstream assumes a horizontal eye line.
    dx = geo.left_eye[0] - geo.right_eye[0]
    dy = geo.left_eye[1] - geo.right_eye[1]
    roll_deg = math.degrees(math.atan2(dy, dx))

    eye_mid = ((geo.left_eye[0] + geo.right_eye[0]) / 2.0,
               (geo.left_eye[1] + geo.right_eye[1]) / 2.0)
    chin_r = rotate_point(geo.chin, eye_mid, roll_deg)
    crown_r = rotate_point(geo.crown, eye_mid, roll_deg)

    head_px_src = chin_r[1] - crown_r[1]
    if head_px_src <= 1:
        raise ValueError("Could not measure head height — chin and crown are degenerate.")

    # 2. Target head height: the midpoint of the allowed band, so a small
    #    landmark error in either direction still lands inside the band.
    head_mm_target = (spec.head_min_mm + spec.head_max_mm) / 2.0
    head_px_out = head_mm_target * ppm
    scale = head_px_out / head_px_src

    # 3. Vertical placement, driven by the eye line where the spec gives one.
    if spec.eye_from_bottom_min_mm is not None and spec.eye_from_bottom_max_mm is not None:
        eye_from_bottom_mm = (spec.eye_from_bottom_min_mm + spec.eye_from_bottom_max_mm) / 2.0
        eye_y_out = out_h - eye_from_bottom_mm * ppm
    else:
        # No eye-line rule (common outside the US). Fall back to ICAO practice:
        # leave ~8% of frame height above the crown, then derive the eye line
        # from where that puts the head.
        crown_y_out = out_h * 0.08
        eye_y_out = crown_y_out + (eye_mid[1] - crown_r[1]) * scale

    # 4. Crop rectangle in rotated-source coordinates.
    crop_w = out_w / scale
    crop_h = out_h / scale
    crop_left = eye_mid[0] - crop_w / 2.0          # horizontal centring on the eye midpoint
    crop_top = eye_mid[1] - eye_y_out / scale

    return Transform(
        roll_deg=roll_deg, scale=scale,
        crop_left=crop_left, crop_top=crop_top, crop_w=crop_w, crop_h=crop_h,
        out_w_px=out_w, out_h_px=out_h,
        head_px_out=head_px_src * scale, eye_y_out_px=eye_y_out,
    )
```

Landmarks. FaceMesh does not include the crown — it stops at the forehead. The trick that makes this accurate: we already have an alpha matte from rembg, so take the topmost foreground pixel in a column band centred on the face. That is the actual top of the hair, which is what the spec means by "crown".

```python
# services/media/app/passport/landmarks.py
from __future__ import annotations

import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
import mediapipe as mp

from .geometry import FaceGeometry, Point

_MODEL = "/opt/models/face_landmarker.task"   # Apache-2.0, baked in Dockerfile

# FaceMesh indices used. Do not renumber these casually.
IDX_CHIN = 152
IDX_NOSE = 1
IDX_IRIS_R = 468       # requires output_face_blendshapes=False + refine landmarks
IDX_IRIS_L = 473
IDX_CHEEK_L, IDX_CHEEK_R = 280, 50
IDX_FACE_L, IDX_FACE_R = 234, 454
IDX_LIP_TOP, IDX_LIP_BOTTOM = 13, 14
IDX_EYE_TOP, IDX_EYE_BOTTOM = 159, 145

_landmarker: vision.FaceLandmarker | None = None


def _get_landmarker() -> vision.FaceLandmarker:
    global _landmarker
    if _landmarker is None:
        opts = vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=_MODEL),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=2,                       # detect 2 so we can reject group photos
            min_face_detection_confidence=0.5,
        )
        _landmarker = vision.FaceLandmarker.create_from_options(opts)
    return _landmarker


def crown_from_alpha(alpha: np.ndarray, face_cx: float, face_w: float) -> Point:
    """Topmost foreground row within a band around the face centre.

    Restricting to a ±35% band around the face width matters: a raised hand or a
    lamp in the corner would otherwise be mistaken for the top of the head.
    """
    h, w = alpha.shape
    lo = max(0, int(face_cx - face_w * 0.35))
    hi = min(w, int(face_cx + face_w * 0.35))
    band = alpha[:, lo:hi] > 128
    rows = np.nonzero(band.any(axis=1))[0]
    if rows.size == 0:
        raise ValueError("Could not find the top of the head in the cut-out.")
    return (face_cx, float(rows[0]))


def extract(rgb: np.ndarray, alpha: np.ndarray) -> tuple[FaceGeometry, dict[str, Point]]:
    h, w = rgb.shape[:2]
    result = _get_landmarker().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))

    if not result.face_landmarks:
        raise ValueError("No face detected. Use a photo where the face is clearly visible and front-on.")
    if len(result.face_landmarks) > 1:
        raise ValueError("More than one face detected. A passport photo must show only the applicant.")

    lm = result.face_landmarks[0]
    def px(i: int) -> Point:
        return (lm[i].x * w, lm[i].y * h)

    right_eye, left_eye = px(IDX_IRIS_R), px(IDX_IRIS_L)
    face_l, face_r = px(IDX_FACE_L), px(IDX_FACE_R)
    face_width = abs(face_r[0] - face_l[0])
    face_cx = (face_l[0] + face_r[0]) / 2.0

    geo = FaceGeometry(
        chin=px(IDX_CHIN),
        crown=crown_from_alpha(alpha, face_cx, face_width),
        left_eye=left_eye,
        right_eye=right_eye,
        nose_tip=px(IDX_NOSE),
        face_width_px=face_width,
    )
    aux = {
        "cheek_l": px(IDX_CHEEK_L), "cheek_r": px(IDX_CHEEK_R),
        "lip_top": px(IDX_LIP_TOP), "lip_bottom": px(IDX_LIP_BOTTOM),
        "eye_top": px(IDX_EYE_TOP), "eye_bottom": px(IDX_EYE_BOTTOM),
    }
    return geo, aux
```

The compliance report — the actual differentiator:

```python
# services/media/app/passport/compliance.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Literal

import numpy as np
from PIL import Image

from .geometry import FaceGeometry, PhotoSpec, Transform, px_per_mm

Severity = Literal["pass", "warn", "fail"]


@dataclass
class Check:
    id: str
    label: str
    severity: Severity
    measured: str
    allowed: str
    advice: str

    def dict(self) -> dict:
        return asdict(self)


def _lum(a: np.ndarray) -> float:
    return float(0.2126 * a[..., 0].mean() + 0.7152 * a[..., 1].mean() + 0.0722 * a[..., 2].mean())


def _laplacian_var(gray: np.ndarray) -> float:
    k = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32)
    g = gray.astype(np.float32)
    out = np.zeros_like(g)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            wgt = k[dy + 1, dx + 1]
            if wgt:
                out += wgt * np.roll(np.roll(g, dy, 0), dx, 1)
    return float(out[2:-2, 2:-2].var())


def run_checks(
    spec: PhotoSpec, geo: FaceGeometry, aux: dict[str, tuple[float, float]],
    tf: Transform, src_rgb: np.ndarray, alpha: np.ndarray,
) -> list[Check]:
    ppm = px_per_mm(spec.dpi)
    checks: list[Check] = []

    # --- 1. Resolution. The crop is scaled to hit the head-height band, so the
    #        only way to fail head height is to be forced to upscale.
    up = tf.scale
    checks.append(Check(
        id="resolution",
        label="Source resolution",
        severity="pass" if up <= 1.0 else "warn" if up <= 1.15 else "fail",
        measured=f"{up:.2f}x scaling required",
        allowed="<= 1.00x (no upscaling)",
        advice="Retake the photo closer to the subject or with a higher-resolution camera. "
               "Upscaling produces soft prints that get rejected.",
    ))

    # --- 2. Head height as printed.
    head_mm = tf.head_px_out / ppm
    checks.append(Check(
        id="head_height", label="Head height (chin to crown)",
        severity="pass" if spec.head_min_mm <= head_mm <= spec.head_max_mm else "fail",
        measured=f"{head_mm:.1f} mm",
        allowed=f"{spec.head_min_mm:.0f}–{spec.head_max_mm:.0f} mm",
        advice="If this fails after cropping, the crown was mis-detected — usually dark hair "
               "against a dark background. Retake against a light wall.",
    ))

    # --- 3. Eye line.
    if spec.eye_from_bottom_min_mm is not None and spec.eye_from_bottom_max_mm is not None:
        eye_mm = (tf.out_h_px - tf.eye_y_out_px) / ppm
        ok = spec.eye_from_bottom_min_mm <= eye_mm <= spec.eye_from_bottom_max_mm
        checks.append(Check(
            id="eye_line", label="Eye height from bottom edge",
            severity="pass" if ok else "fail",
            measured=f"{eye_mm:.1f} mm", allowed=f"{spec.eye_from_bottom_min_mm:.0f}–{spec.eye_from_bottom_max_mm:.0f} mm",
            advice="Both the eye line and the head height must fit. If they conflict, the subject's "
                   "face proportions differ from the spec's assumption — try a slightly different distance.",
        ))

    # --- 4. Background uniformity. Sample only pixels well outside the subject:
    #        erode the background mask by ~2% of the frame so edge fringing from
    #        the matte does not pollute the statistics.
    h, w = alpha.shape
    pad = max(4, int(0.02 * max(h, w)))
    bg_mask = alpha < 20
    bg_mask[:pad, :] |= False   # keep shape; erosion below
    eroded = bg_mask.copy()
    for dy in range(-pad, pad + 1, max(1, pad // 2)):
        eroded &= np.roll(bg_mask, dy, axis=0)
    for dx in range(-pad, pad + 1, max(1, pad // 2)):
        eroded &= np.roll(bg_mask, dx, axis=1)

    if eroded.sum() > 500:
        bg_px = src_rgb[eroded]
        std = float(bg_px.std(axis=0).mean())
        checks.append(Check(
            id="bg_uniform", label="Background uniformity",
            severity="pass" if std <= 6 else "warn" if std <= 12 else "fail",
            measured=f"sigma {std:.1f}/255", allowed="sigma <= 6",
            advice="Shoot against a plain, evenly lit wall. Patterned wallpaper, door frames "
                   "and curtains all fail this.",
        ))

        # --- 5. Directional shadow: split the background left/right and compare
        #        luminance. A lamp on one side shows up as a large delta.
        mid = w // 2
        left = eroded.copy();  left[:, mid:] = False
        right = eroded.copy(); right[:, :mid] = False
        if left.sum() > 200 and right.sum() > 200:
            d = abs(_lum(src_rgb[left]) - _lum(src_rgb[right]))
            checks.append(Check(
                id="bg_shadow", label="Shadow on the background",
                severity="pass" if d <= 8 else "warn" if d <= 18 else "fail",
                measured=f"{d:.1f}/255 left-right difference", allowed="<= 8",
                advice="Stand at least 50 cm away from the wall and light yourself from the front, "
                       "not from one side.",
            ))
    else:
        checks.append(Check(
            id="bg_uniform", label="Background uniformity", severity="warn",
            measured="not enough background visible", allowed="—",
            advice="Frame more loosely so there is visible background around the head.",
        ))

    # --- 6. Uneven light across the face.
    def patch(p: tuple[float, float], r: int = 12) -> np.ndarray:
        y, x = int(p[1]), int(p[0])
        return src_rgb[max(0, y - r):y + r, max(0, x - r):x + r]

    fl, fr = _lum(patch(aux["cheek_l"])), _lum(patch(aux["cheek_r"]))
    fd = abs(fl - fr)
    checks.append(Check(
        id="face_light", label="Even lighting on the face",
        severity="pass" if fd <= 12 else "warn" if fd <= 25 else "fail",
        measured=f"{fd:.1f}/255 cheek-to-cheek difference", allowed="<= 12",
        advice="One side of the face is lit more than the other. Face a window, or use two lights.",
    ))

    # --- 7. Sharpness, measured on the eye region only (a blurred background is fine).
    ey, ex = int(geo.left_eye[1]), int(geo.left_eye[0])
    box = src_rgb[max(0, ey - 40):ey + 40, max(0, ex - 60):ex + 60]
    gray = box.mean(axis=2) if box.size else np.zeros((4, 4))
    lv = _laplacian_var(gray) if gray.size > 64 else 0.0
    checks.append(Check(
        id="sharpness", label="Sharpness",
        severity="pass" if lv >= 120 else "warn" if lv >= 60 else "fail",
        measured=f"laplacian variance {lv:.0f}", allowed=">= 120",
        advice="Hold the camera steady, tap to focus on the eyes, and avoid digital zoom.",
    ))

    # --- 8. Head pose (yaw), from the nose tip's offset relative to the eye midpoint,
    #        normalised by inter-ocular distance.
    inter = abs(geo.left_eye[0] - geo.right_eye[0]) or 1.0
    eye_mid_x = (geo.left_eye[0] + geo.right_eye[0]) / 2.0
    yaw_ratio = (geo.nose_tip[0] - eye_mid_x) / inter
    checks.append(Check(
        id="pose_yaw", label="Facing the camera",
        severity="pass" if abs(yaw_ratio) <= 0.10 else "warn" if abs(yaw_ratio) <= 0.18 else "fail",
        measured=f"offset {yaw_ratio:+.2f} of eye spacing", allowed="within +/-0.10",
        advice="Look straight into the lens with your shoulders square to the camera.",
    ))

    # --- 9. Roll (already corrected, but a large roll means a large rotation crop).
    checks.append(Check(
        id="pose_roll", label="Head tilt",
        severity="pass" if abs(tf.roll_deg) <= 5 else "warn",
        measured=f"{tf.roll_deg:+.1f} deg (auto-corrected)", allowed="within +/-5 deg",
        advice="Level your head. Large corrections rotate the frame and can crop the edges.",
    ))

    # --- 10. Eyes open, mouth closed.
    eye_open = abs(aux["eye_top"][1] - aux["eye_bottom"][1]) / inter
    checks.append(Check(
        id="eyes_open", label="Eyes open",
        severity="pass" if eye_open >= 0.06 else "fail",
        measured=f"opening {eye_open:.3f}", allowed=">= 0.060",
        advice="Blinking or heavily squinting photos are rejected.",
    ))
    mouth = abs(aux["lip_top"][1] - aux["lip_bottom"][1]) / inter
    checks.append(Check(
        id="mouth_closed", label="Neutral expression",
        severity="pass" if mouth <= 0.05 else "warn",
        measured=f"lip gap {mouth:.3f}", allowed="<= 0.050",
        advice="Close your mouth and keep a neutral expression — no smiling with teeth.",
    ))

    return checks
```

Print sheet:

```python
# services/media/app/passport/sheet.py
from __future__ import annotations

from PIL import Image, ImageDraw

MM_PER_INCH = 25.4
SHEET_W_IN, SHEET_H_IN = 6.0, 4.0     # standard 4x6 print, landscape


def build_sheet(photo: Image.Image, spec_w_mm: float, spec_h_mm: float, dpi: int = 300) -> Image.Image:
    """Tile the finished photo across a 4x6 print with cut guides.

    Labs print 4x6 for pocket change; a sheet of 6-8 photos costs the same as one.
    Guides are drawn just OUTSIDE each photo so scissors never cut into the image.
    """
    ppm = dpi / MM_PER_INCH
    sw, sh = round(SHEET_W_IN * dpi), round(SHEET_H_IN * dpi)
    pw, ph = round(spec_w_mm * ppm), round(spec_h_mm * ppm)
    gutter = round(3 * ppm)        # 3 mm between photos, room for the blade
    margin = round(4 * ppm)

    photo = photo.convert("RGB").resize((pw, ph), Image.LANCZOS)

    cols = max(1, (sw - 2 * margin + gutter) // (pw + gutter))
    rows = max(1, (sh - 2 * margin + gutter) // (ph + gutter))

    sheet = Image.new("RGB", (sw, sh), "white")
    draw = ImageDraw.Draw(sheet)
    tick = round(2 * ppm)

    used_w = cols * pw + (cols - 1) * gutter
    used_h = rows * ph + (rows - 1) * gutter
    x0 = (sw - used_w) // 2
    y0 = (sh - used_h) // 2

    for r in range(rows):
        for c in range(cols):
            x = x0 + c * (pw + gutter)
            y = y0 + r * (ph + gutter)
            sheet.paste(photo, (x, y))
            # corner crop marks, 1px, mid-grey so they survive lab auto-contrast
            for cx, cy, dx, dy in (
                (x, y, -1, -1), (x + pw, y, 1, -1), (x, y + ph, -1, 1), (x + pw, y + ph, 1, 1),
            ):
                draw.line([(cx, cy), (cx + dx * tick, cy)], fill=(140, 140, 140), width=1)
                draw.line([(cx, cy), (cx, cy + dy * tick)], fill=(140, 140, 140), width=1)

    draw.text((margin, sh - margin - 12),
              f"{spec_w_mm:.0f} x {spec_h_mm:.0f} mm @ {dpi} DPI — cut on the marks",
              fill=(150, 150, 150))
    return sheet
```

Route, tying it together (rembg's matte is reused as the crown detector *and* as the optional background replacement — one inference, three jobs):

```python
# services/media/app/routers/passport.py
from __future__ import annotations

import base64, io, json

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image, ImageOps
from pydantic import BaseModel, Field, ValidationError
from rembg import remove

from app.quota import consume_quota
from app.routers.bg_remove import get_session
from app.security import Ticket, require_ticket
from app.passport.compliance import run_checks
from app.passport.geometry import PhotoSpec, compute_transform
from app.passport.landmarks import extract
from app.passport.sheet import build_sheet

router = APIRouter(prefix="/v1/photo", tags=["photo"])


class SpecIn(BaseModel):
    """Bounds exist so a hostile client cannot ask for a 2 m print at 4800 DPI."""
    id: str = Field(max_length=64)
    width_mm: float = Field(ge=20, le=120)
    height_mm: float = Field(ge=20, le=120)
    head_min_mm: float = Field(ge=10, le=100)
    head_max_mm: float = Field(ge=10, le=100)
    eye_from_bottom_min_mm: float | None = Field(default=None, ge=5, le=120)
    eye_from_bottom_max_mm: float | None = Field(default=None, ge=5, le=120)
    background_hex: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    dpi: int = Field(ge=300, le=600)


@router.post("/passport")
async def passport(
    file: UploadFile = File(...),
    spec_json: str = Form(...),
    ticket: Ticket = Depends(require_ticket),
):
    await consume_quota(ticket, cost_units=2)
    try:
        spec_in = SpecIn.model_validate_json(spec_json)
    except ValidationError as exc:
        raise HTTPException(400, f"Invalid spec: {exc.errors()[:2]}") from exc
    if spec_in.head_min_mm >= spec_in.head_max_mm:
        raise HTTPException(400, "head_min_mm must be less than head_max_mm")

    spec = PhotoSpec(**spec_in.model_dump())

    raw = await file.read(12 * 1024 * 1024 + 1)
    src = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    rgb = np.asarray(src)

    cut = remove(src, session=get_session("u2net"), post_process_mask=True)
    alpha = np.asarray(cut)[..., 3]

    try:
        geo, aux = extract(rgb, alpha)
        tf = compute_transform(geo, spec)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    checks = run_checks(spec, geo, aux, tf, rgb, alpha)

    # Flatten onto the spec background, level, crop, resample.
    flat = Image.new("RGB", cut.size, spec.background_hex)
    flat.paste(cut, mask=cut.split()[3])
    eye_mid = ((geo.left_eye[0] + geo.right_eye[0]) / 2, (geo.left_eye[1] + geo.right_eye[1]) / 2)
    levelled = flat.rotate(tf.roll_deg, resample=Image.BICUBIC, center=eye_mid,
                           fillcolor=spec.background_hex)
    single = levelled.crop((
        round(tf.crop_left), round(tf.crop_top),
        round(tf.crop_left + tf.crop_w), round(tf.crop_top + tf.crop_h),
    )).resize((tf.out_w_px, tf.out_h_px), Image.LANCZOS)

    def encode(img: Image.Image) -> str:
        b = io.BytesIO()
        img.save(b, format="JPEG", quality=95, dpi=(spec.dpi, spec.dpi), subsampling=0)
        return base64.b64encode(b.getvalue()).decode()

    return {
        "single_jpeg_b64": encode(single),
        "sheet_jpeg_b64": encode(build_sheet(single, spec.width_mm, spec.height_mm, spec.dpi)),
        "checks": [c.dict() for c in checks],
        "overall": "fail" if any(c.severity == "fail" for c in checks)
                   else "warn" if any(c.severity == "warn" for c in checks) else "pass",
        "measured": {
            "head_mm": round(tf.head_px_out / (spec.dpi / 25.4), 2),
            "scale": round(tf.scale, 3),
            "roll_deg": round(tf.roll_deg, 2),
        },
    }
```

**Acceptance criteria**
- [ ] A well-shot fixture returns `overall: "pass"` and `measured.head_mm` inside the spec band.
- [ ] The deliberately side-lit fixture returns `bg_shadow` or `face_light` at `fail`/`warn` with actionable advice.
- [ ] A group photo returns 422 with "More than one face detected"; a photo with no face returns 422.
- [ ] A 640×480 source returns `resolution: fail` with `scale > 1.15`.
- [ ] A visibly tilted-head fixture comes back level: eye-line pixel Δy in the output ≤ 2 px.
- [ ] Output JPEG reports 300 DPI (`exiftool -XResolution` or `identify -format "%x"`), and the sheet is exactly 1800×1200 at 300 DPI.
- [ ] `SpecIn` rejects `dpi: 4800`, `width_mm: 500`, and `head_min_mm >= head_max_mm` with 400.
- [ ] Peak RSS for one request on a 12 MP input stays under 900 MB (`docker stats` during a run).

---

### MEDI-07 Passport photo front-end, spec registry wiring, sheet download

**Estimate:** 3h · **Depends on:** MEDI-06 · **Files:** `src/components/tools/passport-photo-maker.tsx`, `src/lib/tools/media/remote-passport.ts`, `src/lib/tools/photo-specs.ts`

**Why** — The report is the reason someone links to this page. It has to read like a checklist an officer would use, not a debug dump.

**Implementation**

```ts
// src/lib/tools/photo-specs.ts — Sprint 3 registry; this sprint adds the fields
// the compute service needs. Every row carries provenance: an unsourced spec is
// a guess, and a guess here costs someone a rejected application.
export interface PhotoSpec {
  id: string;
  country: string;          // ISO 3166-1 alpha-2
  label: string;            // "Sri Lanka — Passport"
  widthMm: number;
  heightMm: number;
  headMinMm: number;
  headMaxMm: number;
  eyeFromBottomMinMm: number | null;
  eyeFromBottomMaxMm: number | null;
  backgroundHex: `#${string}`;
  dpi: number;
  sourceUrl: string;        // official government page
  verifiedOn: string;       // ISO date — re-verify anything older than 12 months
}

/** Shape the compute service expects (snake_case, no provenance fields). */
export function toWirePayload(s: PhotoSpec) {
  return {
    id: s.id,
    width_mm: s.widthMm,
    height_mm: s.heightMm,
    head_min_mm: s.headMinMm,
    head_max_mm: s.headMaxMm,
    eye_from_bottom_min_mm: s.eyeFromBottomMinMm,
    eye_from_bottom_max_mm: s.eyeFromBottomMaxMm,
    background_hex: s.backgroundHex,
    dpi: s.dpi,
  };
}
```

```ts
// src/lib/tools/media/remote-passport.ts
import { toWirePayload, type PhotoSpec } from "@/lib/tools/photo-specs";

const ORIGIN = process.env.NEXT_PUBLIC_MEDIA_API_ORIGIN!;

export interface ComplianceCheck {
  id: string; label: string;
  severity: "pass" | "warn" | "fail";
  measured: string; allowed: string; advice: string;
}
export interface PassportResult {
  single_jpeg_b64: string;
  sheet_jpeg_b64: string;
  checks: ComplianceCheck[];
  overall: "pass" | "warn" | "fail";
  measured: { head_mm: number; scale: number; roll_deg: number };
}

export async function makePassportPhoto(file: File, spec: PhotoSpec): Promise<PassportResult> {
  const t = await fetch("/api/tools/ticket", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "passport-photo" }),
  });
  if (!t.ok) throw new Error("Could not authorize the request. Reload and try again.");
  const { ticket } = (await t.json()) as { ticket: string };

  const form = new FormData();
  form.append("file", file);
  form.append("spec_json", JSON.stringify(toWirePayload(spec)));

  const res = await fetch(`${ORIGIN}/v1/photo/passport`, {
    method: "POST", headers: { authorization: `Bearer ${ticket}` }, body: form,
  });
  if (res.status === 422) throw new Error(((await res.json()) as { detail: string }).detail);
  if (res.status === 429) throw new Error("Daily limit reached. Try again tomorrow.");
  if (!res.ok) throw new Error(`Processing failed (${res.status}).`);
  return res.json() as Promise<PassportResult>;
}

export function b64ToBlobUrl(b64: string, type = "image/jpeg"): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type }));
}
```

The report UI — sorted worst-first, because that is the order a user should act in:

```tsx
// src/components/tools/passport-photo-maker.tsx (report section)
const ORDER = { fail: 0, warn: 1, pass: 2 } as const;

function ComplianceReport({ result }: { result: PassportResult }) {
  const rows = [...result.checks].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold">Compliance report</h3>
      <p className="text-sm text-muted-foreground">
        Head height measured at {result.measured.head_mm} mm. This is a best-effort automated check,
        not an official approval.
      </p>
      <ul className="mt-3 divide-y rounded-md border">
        {rows.map((c) => (
          <li key={c.id} className="flex gap-3 p-3">
            <span aria-hidden className="mt-0.5">
              {c.severity === "pass" ? "✓" : c.severity === "warn" ? "!" : "✕"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {c.label}{" "}
                <span className="sr-only">
                  {c.severity === "pass" ? "passed" : c.severity === "warn" ? "warning" : "failed"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Measured {c.measured} · allowed {c.allowed}
              </p>
              {c.severity !== "pass" && <p className="mt-1 text-xs">{c.advice}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Acceptance criteria**
- [ ] Country/document selector is populated from `PHOTO_SPECS`; changing it re-runs against the same uploaded file without re-uploading.
- [ ] Each spec's `sourceUrl` is rendered as a link next to the selector.
- [ ] Two downloads work: single photo and 4×6 sheet, both named `{specId}-{single|sheet}.jpg`.
- [ ] Failures render before warnings, which render before passes; severity is conveyed by text, not colour alone (verify with a greyscale filter).
- [ ] A 422 from the service (no face) surfaces the service's message verbatim in an `role="alert"` region.
- [ ] All object URLs are revoked on unmount (check `performance.memory` or just assert `URL.revokeObjectURL` calls in a test).

---

### MEDI-08 Image convert and compress, including HEIC→JPG

**Estimate:** 3h · **Depends on:** MEDI-04 · **Files:** `src/components/tools/image-converter.tsx`, `src/lib/tools/media/codecs.ts`

**Why** — "HEIC to JPG" is high-volume, low-competition, and every existing free option uploads your photos. It is also the cheapest tool in the sprint to build correctly, because the browser already has most of the codecs — the trick is loading the expensive ones only when they are actually needed.

**Implementation**

The decision that keeps the bundle honest: **feature-detect first, WASM second**. Safari decodes HEIC natively via `createImageBitmap`, and Safari is where iPhone users are. Those users never download the 1.4 MB libheif build.

```ts
// src/lib/tools/media/codecs.ts
export type OutFormat = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

const encoderSupport = new Map<string, Promise<boolean>>();

/** Does this browser's canvas encode `type` natively? Cached per type. */
export function canEncodeNatively(type: OutFormat): Promise<boolean> {
  let p = encoderSupport.get(type);
  if (!p) {
    p = (async () => {
      try {
        const c = new OffscreenCanvas(2, 2);
        c.getContext("2d")!.fillRect(0, 0, 2, 2);
        const b = await c.convertToBlob({ type, quality: 0.8 });
        return b.type === type;         // browsers silently fall back to PNG
      } catch { return false; }
    })();
    encoderSupport.set(type, p);
  }
  return p;
}

/**
 * Decode any input to an ImageBitmap.
 *
 * Order matters. createImageBitmap handles JPEG/PNG/WebP/GIF everywhere, AVIF in
 * current browsers, and HEIC on Safari. Only when it throws on a HEIC/HEIF file
 * do we pull in libheif — which is ~1.4 MB of WASM, so the whole point is that
 * most visitors never touch it.
 */
export async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch (err) {
    const isHeif =
      /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
    if (!isHeif) throw err;

    // Dynamic import: this chunk exists only for browsers that need it.
    // libheif-js is LGPL-3.0 and is shipped UNMODIFIED from public/vendor —
    // see LICENSES.md for the relinking notice (MEDI-11).
    const { default: libheif } = await import("libheif-js/wasm-bundle");
    const decoder = new libheif.HeifDecoder();
    const images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
    if (!images.length) throw new Error("That HEIC file could not be decoded.");

    const img = images[0];
    const w = img.get_width();
    const h = img.get_height();
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(w, h);
    await new Promise<void>((resolve, reject) => {
      img.display(imageData, (out: ImageData | null) =>
        out ? resolve() : reject(new Error("HEIC decode returned no data")),
      );
    });
    ctx.putImageData(imageData, 0, 0);
    return canvas.transferToImageBitmap();
  }
}

export interface EncodeOptions {
  format: OutFormat;
  quality: number;      // 0..1, ignored for png
  maxEdge?: number;     // downscale longest side before encoding
}

export async function encode(bitmap: ImageBitmap, opts: EncodeOptions): Promise<Blob> {
  let { width: w, height: h } = bitmap;
  if (opts.maxEdge && Math.max(w, h) > opts.maxEdge) {
    const k = opts.maxEdge / Math.max(w, h);
    w = Math.round(w * k);
    h = Math.round(h * k);
  }

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  if (opts.format === "image/jpeg") {
    // JPEG has no alpha; without this, transparent pixels encode as black.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);

  if (await canEncodeNatively(opts.format)) {
    return canvas.convertToBlob({ type: opts.format, quality: opts.quality });
  }

  if (opts.format === "image/avif") {
    // Only Chromium encodes AVIF from canvas today. Everyone else pays ~1.4 MB,
    // and only if they explicitly chose AVIF. Apache-2.0 wrapper over libavif (BSD-2).
    const { encode: avifEncode } = await import("@jsquash/avif");
    const data = ctx.getImageData(0, 0, w, h);
    const buf = await avifEncode(data, { cqLevel: Math.round((1 - opts.quality) * 40) });
    return new Blob([buf], { type: "image/avif" });
  }

  throw new Error(`Your browser cannot produce ${opts.format}. Try JPEG or WebP.`);
}
```

Bundle cost, to be recorded and checked in MEDI-10:

| Chunk | Approx. gzip | Loaded when |
|---|---|---|
| `codecs.ts` itself | < 2 KB | with the widget |
| `libheif-js/wasm-bundle` | ~1.3–1.6 MB | only on a HEIC input in a non-Safari browser |
| `@jsquash/avif` (encode) | ~1.2–1.5 MB | only when AVIF is selected and native encode is absent |
| JPEG / PNG / WebP encode | 0 | native `convertToBlob` |

**Acceptance criteria**
- [ ] A real iPhone `.HEIC` converts to JPEG in Chrome, Firefox and Safari, right way up.
- [ ] In Safari, the Network panel shows **no** `libheif` chunk during a HEIC conversion.
- [ ] Selecting WebP or JPEG never loads a WASM chunk in any browser.
- [ ] Converting a transparent PNG to JPEG yields white, not black, behind the transparency.
- [ ] Selecting AVIF in Firefox either succeeds via the lazy jsquash chunk or shows the explicit "cannot produce" message — never a silent PNG in an `.avif` file.
- [ ] Compressing a 4 MB JPEG at quality 0.75 yields under 1 MB with no visible artefacts at 100%.

---

### MEDI-09 Bulk resize — worker pool, ZIP in, ZIP out

**Estimate:** 3h · **Depends on:** MEDI-08 · **Files:** `src/components/tools/bulk-resizer.tsx`, `src/lib/tools/media/resize.worker.ts`, `src/lib/tools/media/worker-pool.ts`

**Why** — Doing 200 images on the main thread freezes the tab and Chrome offers to kill the page. A small pool of workers keeps the UI responsive and finishes roughly `n` times faster, and it costs nothing because it is all local.

**Implementation**

```ts
// src/lib/tools/media/worker-pool.ts
export interface PoolJob<TIn, TOut> {
  payload: TIn;
  transfer?: Transferable[];
  resolve: (v: TOut) => void;
  reject: (e: Error) => void;
}

/**
 * Fixed-size worker pool. Sized to hardwareConcurrency - 1 and capped at 4:
 * beyond four, image decode becomes memory-bandwidth bound and more workers just
 * increase peak RSS, which is what actually kills the tab on mobile.
 */
export class WorkerPool<TIn, TOut> {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: PoolJob<TIn, TOut>[] = [];
  private inFlight = new Map<Worker, PoolJob<TIn, TOut>>();

  constructor(factory: () => Worker, size = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1))) {
    for (let i = 0; i < size; i++) {
      const w = factory();
      w.onmessage = (e: MessageEvent<{ ok: true; value: TOut } | { ok: false; error: string }>) => {
        const job = this.inFlight.get(w);
        this.inFlight.delete(w);
        if (job) e.data.ok ? job.resolve(e.data.value) : job.reject(new Error(e.data.error));
        this.idle.push(w);
        this.pump();
      };
      w.onerror = (ev) => {
        const job = this.inFlight.get(w);
        this.inFlight.delete(w);
        job?.reject(new Error(ev.message || "Worker crashed"));
        this.idle.push(w);
        this.pump();
      };
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  run(payload: TIn, transfer?: Transferable[]): Promise<TOut> {
    return new Promise<TOut>((resolve, reject) => {
      this.queue.push({ payload, transfer, resolve, reject });
      this.pump();
    });
  }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.inFlight.set(w, job);
      w.postMessage(job.payload, job.transfer ?? []);
    }
  }

  get size(): number { return this.workers.length; }

  dispose(): void {
    this.workers.forEach((w) => w.terminate());
    this.queue.forEach((j) => j.reject(new Error("Pool disposed")));
    this.queue = [];
    this.idle = [];
    this.inFlight.clear();
  }
}
```

```ts
// src/lib/tools/media/resize.worker.ts
/// <reference lib="webworker" />
import { decodeToBitmap, encode, type OutFormat } from "./codecs";

declare const self: DedicatedWorkerGlobalScope;

interface Job {
  name: string;
  buffer: ArrayBuffer;
  type: string;
  maxEdge: number;
  format: OutFormat;
  quality: number;
}

self.onmessage = async (e: MessageEvent<Job>) => {
  const j = e.data;
  try {
    const file = new File([j.buffer], j.name, { type: j.type });
    const bitmap = await decodeToBitmap(file);
    const blob = await encode(bitmap, { format: j.format, quality: j.quality, maxEdge: j.maxEdge });
    bitmap.close();
    const out = await blob.arrayBuffer();
    self.postMessage({ ok: true, value: { name: j.name, buffer: out, type: blob.type } }, [out]);
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};

export {};
```

ZIP handling. Two details that are easy to get wrong: **use `STORE`, not `DEFLATE`** (JPEGs and PNGs are already compressed; deflating them burns CPU for ~0% gain), and **guard the zip bomb** on input.

```ts
// inside src/components/tools/bulk-resizer.tsx
const IMAGE_RE = /\.(jpe?g|png|webp|avif|heic|heif|bmp|gif)$/i;
const MAX_TOTAL_UNCOMPRESSED = 500 * 1024 * 1024;
const MAX_FILES = 300;

async function expandInput(files: File[]): Promise<File[]> {
  const zips = files.filter((f) => /\.zip$/i.test(f.name));
  if (zips.length === 0) return files.filter((f) => IMAGE_RE.test(f.name));

  const JSZip = (await import("jszip")).default;  // ~95 KB gzip, lazy
  const out: File[] = files.filter((f) => IMAGE_RE.test(f.name));
  let budget = MAX_TOTAL_UNCOMPRESSED;

  for (const z of zips) {
    const archive = await JSZip.loadAsync(z);
    const entries = Object.values(archive.files).filter((e) => !e.dir && IMAGE_RE.test(e.name));
    if (entries.length + out.length > MAX_FILES) {
      throw new Error(`That archive has more than ${MAX_FILES} images. Split it up.`);
    }
    for (const e of entries) {
      const blob = await e.async("blob");
      budget -= blob.size;
      if (budget < 0) throw new Error("Archive expands to more than 500 MB. Refusing to open it.");
      out.push(new File([blob], e.name.split("/").pop()!, { type: blob.type || "image/jpeg" }));
    }
  }
  return out;
}

async function buildZip(results: { name: string; buffer: ArrayBuffer; type: string }[], ext: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const r of results) {
    const base = r.name.replace(/\.[^.]+$/, "");
    zip.file(`${base}.${ext}`, r.buffer);
  }
  // STORE: the payload is already-compressed image data. DEFLATE would cost
  // seconds of CPU for a fraction of a percent.
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
```

**Acceptance criteria**
- [ ] 100 × 3 MP JPEGs resize to 1600 px and download as one ZIP; the main thread stays responsive throughout (scroll the page during the run).
- [ ] A ZIP of 50 images in produces a ZIP of 50 images out, filenames preserved with the new extension.
- [ ] Pool size equals `min(4, hardwareConcurrency - 1)`; log it and confirm on a 2-core throttled profile it is 1.
- [ ] A crafted archive expanding beyond 500 MB is refused with the explicit message, and an archive with >300 images is refused.
- [ ] `jszip` appears only in a lazily loaded chunk, never in the page's first-load JS.
- [ ] One corrupt file in a batch of 50 fails that item only; the other 49 still land in the ZIP with a visible per-file error list.

---

### MEDI-10 Bundle budget and verification

**Estimate:** 2h · **Depends on:** MEDI-04, MEDI-08, MEDI-09 · **Files:** `scripts/check-bundle-budget.mjs`, `lighthouse-budget.json`, `package.json`, `.github/workflows/ci.yml`

**Why** — Every tool in this sprint drags a heavy dependency behind it. Without an automated gate, one careless static `import` of `onnxruntime-web` at the top of a page file quietly adds a megabyte to the site's shared chunk and takes the LCP of `/` down with it. Budgets that are not enforced are not budgets.

**The budget**

| Metric | Budget | Rationale |
|---|---|---|
| First-load JS, any `(site)` route | ≤ 110 KB gzip | Current baseline; this sprint must not move it at all |
| First-load JS, `/tools/[slug]` | ≤ 135 KB gzip | Shared chunk + widget shell only |
| ORT / libheif / jsquash / jszip in first-load JS | **0 bytes** | Hard fail — these are gesture-loaded, always |
| Model weights over the wire | 4–5 MB, once, cached immutably | Not JS; excluded from the JS budget but gated behind a user action |
| LCP on `/tools/[slug]`, mobile Lighthouse | ≤ 2.0 s | Widget shell is static HTML; nothing above the fold waits on JS |
| CLS on `/tools/[slug]` | ≤ 0.02 | Every widget shell reserves `min-h-[420px]` |

**Implementation**

```js
// scripts/check-bundle-budget.mjs
import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const NEXT = path.join(process.cwd(), ".next");

const ROUTE_BUDGETS = [
  { route: "/(site)/page", maxKb: 110 },
  { route: "/(tools)/tools/[slug]/page", maxKb: 135 },
];

// Substrings that must never appear in a route's first-load JS.
const FORBIDDEN = ["onnxruntime", "libheif", "jsquash", "jszip"];

const manifest = JSON.parse(await readFile(path.join(NEXT, "app-build-manifest.json"), "utf8"));

let failed = false;

for (const { route, maxKb } of ROUTE_BUDGETS) {
  const files = manifest.pages[route];
  if (!files) {
    console.error(`FAIL  route "${route}" not in app-build-manifest.json — did the path change?`);
    failed = true;
    continue;
  }

  let total = 0;
  for (const f of files.filter((f) => f.endsWith(".js"))) {
    const abs = path.join(NEXT, f);
    await stat(abs);
    total += gzipSync(await readFile(abs)).length;
  }

  const kb = total / 1024;
  const over = kb > maxKb;
  failed ||= over;
  console.log(`${over ? "FAIL" : "ok  "}  ${route}  ${kb.toFixed(1)} KB gz  (budget ${maxKb} KB)`);

  for (const f of files) {
    const hit = FORBIDDEN.find((n) => f.includes(n));
    if (hit) {
      console.error(`FAIL  ${route} statically includes "${hit}" via ${f} — it must be dynamically imported`);
      failed = true;
    }
  }
}

// Second, cheaper guard: no chunk referenced by ANY first-load set may contain
// the ORT wasm loader string. Catches a re-export sneaking through a barrel file.
for (const { route } of ROUTE_BUDGETS) {
  for (const f of (manifest.pages[route] ?? []).filter((f) => f.endsWith(".js"))) {
    const src = await readFile(path.join(NEXT, f), "utf8");
    if (src.includes("ort-wasm")) {
      console.error(`FAIL  ${f} (first-load for ${route}) references ort-wasm`);
      failed = true;
    }
  }
}

process.exit(failed ? 1 : 0);
```

```json
// lighthouse-budget.json
[
  {
    "path": "/tools/*",
    "timings": [
      { "metric": "largest-contentful-paint", "budget": 2000 },
      { "metric": "cumulative-layout-shift", "budget": 0.02 },
      { "metric": "total-blocking-time", "budget": 200 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 180 },
      { "resourceType": "total", "budget": 500 }
    ]
  }
]
```

```jsonc
// package.json — scripts
{
  "budget": "node scripts/check-bundle-budget.mjs",
  "verify": "pnpm build && pnpm budget"
}
```

Wire `pnpm verify` into CI so a PR that regresses the budget cannot merge.

**Acceptance criteria**
- [ ] `pnpm verify` passes on the sprint branch and prints actual KB for both routes.
- [ ] Temporarily adding `import * as ort from "onnxruntime-web"` to `src/app/(tools)/tools/[slug]/page.tsx` makes `pnpm budget` exit 1. Revert.
- [ ] Lighthouse mobile on the deployed `/tools/remove-background-from-image` reports LCP ≤ 2.0 s and CLS ≤ 0.02 with the budget file applied.
- [ ] Lighthouse on `/` is within 2 points of its pre-sprint score (record the before number on day 1).
- [ ] CI runs `pnpm verify` and blocks merge on failure.

---

### MEDI-11 Licence compliance manifest

**Estimate:** 1h · **Depends on:** MEDI-05, MEDI-08 · **Files:** `services/media/LICENSES.md`, `src/lib/tools/licences.ts`, `src/components/tools/licence-footer.tsx`

**Why** — Three of the licences in play carry live obligations (Apache-2.0 attribution, LGPL relinking, AGPL network clause) and three widely-recommended models are non-commercial and must never enter the image. Writing this down once, next to the code that installs the dependency, is what stops a future "just add GFPGAN, it looks great" pull request.

**Implementation**

```ts
// src/lib/tools/licences.ts
export interface LicenceEntry {
  component: string;
  version: string;
  licence: string;
  commercialUse: "yes" | "no";
  obligation: string;
  surfacedAt: string;   // where the notice is actually shown to users
}

export const LICENCES: readonly LicenceEntry[] = [
  { component: "u2netp (ONNX, int8)", version: "v1", licence: "Apache-2.0", commercialUse: "yes",
    obligation: "Retain the notice and state changes. Quantization IS a change — say so.",
    surfacedAt: "/tools/remove-background-from-image footer + services/media/LICENSES.md" },
  { component: "u2net (rembg session)", version: "rembg 2.0.x", licence: "Apache-2.0", commercialUse: "yes",
    obligation: "Retain the notice.", surfacedAt: "services/media/LICENSES.md" },
  { component: "rembg", version: "2.0.x", licence: "MIT", commercialUse: "yes",
    obligation: "Retain the copyright notice.", surfacedAt: "services/media/LICENSES.md" },
  { component: "onnxruntime / onnxruntime-web", version: "1.20.x", licence: "MIT", commercialUse: "yes",
    obligation: "Retain the notice.", surfacedAt: "services/media/LICENSES.md" },
  { component: "MediaPipe + face_landmarker.task", version: "0.10.x", licence: "Apache-2.0", commercialUse: "yes",
    obligation: "Retain notice; state changes (none made).", surfacedAt: "/tools/passport-photo-maker footer" },
  { component: "Pillow", version: "10.x", licence: "MIT-CMU", commercialUse: "yes",
    obligation: "Retain the notice.", surfacedAt: "services/media/LICENSES.md" },
  { component: "libheif-js (WASM)", version: "1.17.x", licence: "LGPL-3.0", commercialUse: "yes",
    obligation:
      "LGPL requires that the end user be able to relink against a modified library. " +
      "Mitigation: the WASM bundle is shipped UNMODIFIED from a pinned upstream release, " +
      "loaded as a separate lazily-imported chunk (never statically linked into app code), " +
      "and LICENSES.md links the exact upstream artifact + source tag. Do not patch it in-tree.",
    surfacedAt: "/tools/heic-to-jpg-converter footer + LICENSES.md" },
  { component: "@jsquash/avif (libavif)", version: "1.x", licence: "Apache-2.0 / BSD-2", commercialUse: "yes",
    obligation: "Retain notices.", surfacedAt: "LICENSES.md" },
  { component: "JSZip", version: "3.x", licence: "MIT", commercialUse: "yes",
    obligation: "Retain the notice.", surfacedAt: "LICENSES.md" },
] as const;

/** Refused. Kept in code so the reason survives the person who found it. */
export const REJECTED_MODELS = [
  { component: "CodeFormer", licence: "S-Lab Licence 1.0", reason: "Non-commercial only. Never ship." },
  { component: "LaMa", licence: "CC BY-NC-SA 4.0", reason: "Non-commercial only. Never ship." },
  { component: "GFPGAN", licence: "Apache-2.0 wrapper over StyleGAN2 weights",
    reason: "Weight provenance unresolved (NVIDIA StyleGAN2 lineage). Not worth the risk." },
  { component: "Surya OCR", licence: "GPL-3.0 with a revenue threshold",
    reason: "Read the threshold before considering it. Out of scope for this sprint." },
] as const;
```

CI guard — one grep, run alongside `pnpm verify`:

```bash
# .github/workflows/ci.yml (step)
- name: Reject non-commercial models
  run: |
    if grep -rniE 'codeformer|(^|[^a-z])lama([^a-z]|$)|gfpgan' \
         services/media/requirements.txt services/media/app src/lib src/components; then
      echo "::error::A non-commercial model was referenced. See src/lib/tools/licences.ts."
      exit 1
    fi
```

`services/media/LICENSES.md` holds the full text of each licence plus the exact upstream URL and git tag for the libheif build.

**Acceptance criteria**
- [ ] `services/media/LICENSES.md` exists, contains full licence text for every entry in `LICENCES`, and is `COPY`'d into the Docker image.
- [ ] The Dockerfile header block matches `licences.ts` — no entry in one that is missing from the other.
- [ ] Adding `gfpgan` to `requirements.txt` fails CI. Revert.
- [ ] Each of the three tool pages that ships a licenced model renders `<LicenceFooter />` naming the model, its licence, and that the weights were quantized (for u2netp).

---

### Deferred from this sprint

**Face blur / auto-redact via MediaPipe (est. 3h).** Cut because the sprint is already at 39h. It is not blocked by anything — it is a self-contained ticket for Sprint 8, and the design is settled:

Use `@mediapipe/tasks-vision`'s `FaceDetector` (BlazeFace short-range, Apache-2.0, ~230 KB `.task` file), not the 468-point FaceLandmarker — detection returns bounding boxes, which is all a redaction needs, and it is roughly 10× cheaper.

```ts
// sketch for Sprint 8 — src/lib/tools/media/face-redact.ts
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

export async function createDetector() {
  // Vision WASM artifacts copied to /public/mediapipe by a prebuild step,
  // mirroring scripts/copy-ort-wasm.mjs.
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  return FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite" },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.4,   // low: a missed face is a privacy failure, a false positive is a blurred lamp
  });
}

export function redact(ctx: OffscreenCanvasRenderingContext2D, boxes: DOMRectReadOnly[], mode: "blur" | "pixelate") {
  for (const b of boxes) {
    // Pad 15%: BlazeFace boxes crop the chin and forehead, and an un-blurred
    // hairline plus jaw is enough for a human to re-identify someone.
    const px = b.width * 0.15, py = b.height * 0.15;
    const x = b.x - px, y = b.y - py, w = b.width + 2 * px, h = b.height + 2 * py;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.filter = mode === "blur" ? `blur(${Math.max(8, w / 6)}px)` : "none";
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
  }
}
```

Two things Sprint 8 must not skip: the output must be **re-encoded from the canvas**, never patched into the original file — otherwise the unredacted pixels survive in an embedded JPEG thumbnail or in EXIF — and the UI must let the user add a manual box, because "the model missed a face" has to have a fix that is not "give up".

Also deferred: **image upscaling** (Real-ESRGAN, BSD-3 — licence is clean but ~$3/1000 makes it a Sprint 9 conversation about paid tiers, not a free tool).

---

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Quantized u2netp mask is visibly worse than the fp32 model and the free tier feels cheap | Medium | High | Compare both on 20 fixtures before committing to int8 in MEDI-02. The fp32 u2netp is ~4.7 MB vs ~1.2 MB quantized — if quality differs meaningfully, ship fp32 and eat the download size, because it is cached once and the free tier is the whole value proposition. |
| Single-threaded inference is too slow on mid-range Android and users bounce | Medium | High | Measured in MEDI-03 acceptance, not assumed. If p75 mobile exceeds 8 s: (a) drop the model input to 256×256 — u2net degrades gracefully, (b) show a live preview of the mask at 320×320 before the full-res composite so perceived latency drops, (c) auto-suggest the server tier on slow devices via `navigator.hardwareConcurrency <= 4`. Enabling COOP/COEP remains rejected for the reasons in ADR-0007. |
| Railway container OOMs when rembg and MediaPipe are both resident | Medium | High | u2net session ~700 MB peak, FaceLandmarker ~150 MB, a 12 MP RGBA image ~200 MB per copy. Run `--workers 1`, cap upload at 12 MB and 40 MP, and set the Railway memory limit to 2 GB. Add a `/healthz` that reports RSS and alert above 1.5 GB. |
| Passport specs are wrong and someone's application is rejected | Medium | High | Every `PhotoSpec` row requires `sourceUrl` + `verifiedOn`; the validator fails the build on a missing one. The UI links the source next to the selector and states plainly that this is an automated best-effort check, not an official approval. Add a `verifiedOn` staleness warning at 12 months. |
| The crown-from-alpha heuristic fails on dark hair against a dark background | Medium | Medium | It is exactly the case where the matte is weakest. Detect it: if the alpha column band has fewer than 30% confident pixels in its top 10%, return a specific 422 ("could not find the top of your head — retake against a lighter wall") rather than a silently wrong crop. |
| libheif LGPL obligation is mishandled | Low | High | MEDI-11: ship the WASM bundle unmodified from a pinned upstream release, loaded as a separate chunk, with the upstream artifact and source tag linked in LICENSES.md. Never patch it in-tree; if a patch is ever needed, publish the fork. |
| A future PR statically imports a heavy codec and tanks the site's LCP | Medium | Medium | `scripts/check-bundle-budget.mjs` fails CI on any forbidden substring in a first-load chunk. Enforced, not documented. |
| Server tier gets scraped as a free background-removal API | Medium | Medium | Already covered by canonical #9 and #11: short-lived single-use HMAC tickets with `jti` in Redis, origin-locked CORS, per-IP-hash daily quota, global spend kill-switch returning 503. The client shows a graceful "use the in-browser option" message on 429/503. |
| Adding 5 tools trips the `TOOLS.length > 30` validator mid-sprint | Low | Low | Checked in Definition of Ready. If it trips, that is the cap doing its job — cut a weaker existing tool or make a deliberate policy edit, do not bump the number reflexively. |

---

### Definition of Done

- [ ] `pnpm build` completes with **0 TypeScript errors** and 0 ESLint errors (both checks are on; `ignoreBuildErrors` stays removed).
- [ ] `pnpm verify` (build + `scripts/check-bundle-budget.mjs`) passes; actual KB figures recorded in the PR description.
- [ ] All five new registry entries pass `validate.ts` (slug, metaTitle ≤ 60, description 120–165, 3–6 FAQs, howItWorks and gotchas ≥ 120 words, no dangling `related`), and `TOOLS.length <= 30`.
- [ ] All five tool routes are **statically generated** (`○` in the build output) and no tool page imports from `@db`.
- [ ] Python service: `pytest services/media/tests` passes, including geometry unit tests for `compute_transform` (known landmarks → known crop) and `SpecIn` validation tests.
- [ ] `docker build` succeeds; the image contains baked weights; the licence grep guard passes in CI.
- [ ] Lighthouse mobile: `/tools/remove-background-from-image` LCP ≤ 2.0 s, CLS ≤ 0.02, TBT ≤ 200 ms; `/` unchanged within 2 points of the pre-sprint baseline.
- [ ] Deployed to Vercel production and the Railway media service; both verified against production URLs, not preview.
- [ ] Verified in prod on a real iPhone (Safari) and a real mid-range Android (Chrome): background remover completes, HEIC converts, passport photo returns a report.
- [ ] `docs/adr/0007-no-cross-origin-isolation.md` is merged.
- [ ] `services/media/LICENSES.md` merged and `<LicenceFooter />` renders on all three model-backed tool pages.
- [ ] The 5 new URLs are submitted in Search Console and appear in the sitemap (`curl https://kavithakanchana.me/sitemap.xml | grep tools`).

---

### Demo script

1. Open a **fresh private window** on `https://kavithakanchana.me/tools/remove-background-from-image`. Open DevTools → Network, filter `wasm|onnx`. Confirm the widget shell is fully rendered and **zero** matching requests have fired.
2. Drop `test-fixtures/portrait-3000px.jpg`. Watch the progress label go "Downloading the model" → "Finding the subject" → "Compositing". Confirm exactly one `.onnx` request. Download the PNG and open it over a coloured layer — the cut-out should be clean at the shoulders.
3. Reload the page and process the same file again. Confirm the Network panel shows **no** `.onnx` request (Cache Storage hit) and the total time drops by the download duration. Then go offline (DevTools → Network → Offline), reload, and process a third file — it still works.
4. Switch the engine radio to "Higher quality (server)" and re-run. Confirm the request goes to `NEXT_PUBLIC_MEDIA_API_ORIGIN` with an `Authorization: Bearer` header, that hair detail is visibly better, and that the result footer says "Processed on the server".
5. Go to `/tools/passport-photo-maker`, pick **Sri Lanka — Passport**, upload the good fixture. Confirm `overall: pass`, head height inside the band, and the 4×6 sheet download opens as an 1800×1200 image at 300 DPI with visible corner marks.
6. Upload `test-fixtures/passport-bad-sidelit.jpg` with the same spec. Confirm the report puts a **fail** row first, that the row names the measured value and the allowed range, and that the advice is something a person could actually act on.
7. Go to `/tools/heic-to-jpg-converter`, upload a real iPhone `.HEIC` in **Chrome** — confirm the `libheif` chunk loads and the output is correct and correctly oriented. Repeat in **Safari** and confirm the `libheif` chunk does **not** load.
8. Go to `/tools/bulk-image-resizer`, drop a folder of 100 JPEGs, set max edge 1600, format WebP. Scroll the page while it runs to confirm the UI never stutters, then open the resulting ZIP and spot-check three files for dimensions and quality.
9. Run `pnpm verify` locally and paste the KB output. Run Lighthouse mobile against production `/` and confirm it has not moved from the baseline recorded on day 1.