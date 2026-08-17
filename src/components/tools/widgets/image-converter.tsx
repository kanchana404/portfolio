"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ConversionSpec,
  type ImageFormat,
  FORMATS,
  IMAGE_FORMATS,
  TARGET_FORMATS,
  formatBytes,
  formatFromMime,
  codecCost,
  formatFromName,
  isRenameOnly,
  outputName,
} from "@/lib/tools/image/spec";
import {
  ImageConvertError,
  NeedsServerError,
  canEncode,
  convertImage,
} from "@/lib/tools/image/pipeline";
import {
  ANIMATED_FORMATS,
  AnimationError,
  decodeAnimation,
  detectAnimation,
  encodeAnimation,
  releaseFrames,
} from "@/lib/tools/image/animation";
import { FormatPicker } from "../format-picker";

/** The only formats `canvas.toBlob` actually writes; everything else is ours. */
const BROWSER_ENCODED: readonly ImageFormat[] = ["png", "jpg", "webp"];
import { ToolLabel, cx } from "../ui";

/**
 * One widget behind every image-conversion route.
 *
 * The registry entry differs per slug because each answers a different
 * exact-match query and carries its own copy; the machinery is identical, so it
 * lives once here and `CONVERSIONS` in `@/lib/tools/image/spec` says what each
 * page does. Adding `webp-to-png` is a line in that table plus its copy.
 *
 * Statically imported: canvas is a platform API, so there is no library to
 * defer and `lazyWidget` would cost a chunk request to save nothing.
 *
 * Panel shape follows the subtitle converter — header, toolbar, body, actions —
 * because it is the same job: put a file in, see what came out, take it away.
 */

interface Item {
  id: number;
  file: File;
  from: ImageFormat | null;
  /**
   * `needs-server` is not a failure. It means this browser cannot read the
   * file but the server can, and the row is waiting to be told whether to send
   * it — the page promises files stay on the device, so that has to be asked
   * rather than assumed.
   */
  status: "pending" | "done" | "error" | "needs-server" | "uploading";
  url?: string;
  outBlob?: Blob;
  outName?: string;
  message?: string;
  width?: number;
  height?: number;
  /** Set when the result is animated, so the row can say so. */
  frames?: number;
  /** Format name for the upload prompt: "HEIC", "camera RAW". */
  serverFormat?: string;
}

let nextId = 0;

export default function ImageConverter({ from: initialFrom, to }: ConversionSpec) {
  // Both sides live in state: one page, you pick what goes in and what comes
  // out. `null` means "Any", which is the default and the common case.
  const [source, setSource] = useState<ImageFormat | null>(initialFrom);
  const [target, setTarget] = useState<ImageFormat>(to);
  const [quality, setQuality] = useState(0.9);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [unsupported, setUnsupported] = useState<ImageFormat[]>([]);
  /** Formats whose codec has been downloaded this session. */
  const [fetched, setFetched] = useState<Set<ImageFormat>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  // Ask the browser what it can actually write, rather than assuming. Safari
  // cannot encode WebP and `toBlob` quietly returns a PNG, so a target we
  // cannot honour is hidden instead of producing a mislabelled file.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      // ICO is exempt: it is assembled from PNGs rather than written by
      // `toBlob`, so probing it would ask the browser about a path this tool
      // never takes — and get "no", hiding a format that does work.
      // Only the three `toBlob` formats are probed. ICO, BMP, TGA, QOI and PPM
      // are written by this project, so asking the browser about them would ask
      // about a path none of them takes — and get "no".
      TARGET_FORMATS.map(async (f) => ({
        f,
        ok: BROWSER_ENCODED.includes(f) ? await canEncode(f) : true,
      }))
    ).then((results) => {
      if (cancelled) return;
      setUnsupported(results.filter((r) => !r.ok).map((r) => r.f));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke on unmount only. Object URLs are the classic leak in a batch tool.
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => {
      urls.current.forEach(URL.revokeObjectURL);
    },
    []
  );

  const availableTargets = useMemo(
    () => TARGET_FORMATS.filter((f) => !unsupported.includes(f)),
    [unsupported]
  );

  // Quality applies to the lossy encoders only. ICO is a wrapper around PNGs,
  // so a quality slider there would be a control that changes nothing.
  const lossy = target === "jpg" || target === "webp";

  const run = useCallback(
    async (files: File[]) => {
      const queued: Item[] = files.map((file) => ({
        id: nextId++,
        file,
        from: formatFromMime(file.type) ?? formatFromName(file.name),
        status: "pending",
      }));
      setItems((current) => [...current, ...queued]);

      for (const item of queued) {
        // A same-format route is a rename: re-encoding would discard quality to
        // achieve nothing. .jfif -> .jpg is literally the same bytes.
        if (isRenameOnly(item.from, target)) {
          const url = URL.createObjectURL(item.file);
          urls.current.push(url);
          setItems((c) =>
            c.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: "done",
                    url,
                    outBlob: item.file,
                    outName: outputName(item.file.name, target),
                    message: "Renamed — the bytes are identical, nothing re-encoded.",
                  }
                : i
            )
          );
          continue;
        }

        try {
          // An animated input is kept animated whenever the target can hold
          // more than one frame. Silently flattening a GIF to its first frame
          // is the single most common complaint about browser converters, so
          // it only happens when the chosen format genuinely cannot animate —
          // and then the row says so rather than leaving it to be discovered.
          const animatedIn =
            item.from !== null &&
            ANIMATED_FORMATS.includes(item.from) &&
            (await detectAnimation(item.file, item.from));

          // GIF always takes this path, animated or not: `toBlob` cannot write
          // GIF at all, so even a single frame needs the real encoder.
          if (
            (animatedIn && ANIMATED_FORMATS.includes(target)) ||
            target === "gif"
          ) {
            const frames = animatedIn
              ? await decodeAnimation(item.file, item.from!)
              : [
                  {
                    bitmap: await createImageBitmap(item.file, {
                      imageOrientation: "from-image",
                    }),
                    delayMs: 100,
                  },
                ];
            try {
              const animated = await encodeAnimation(frames, {
                to: target,
                from: item.from,
                quality: lossy ? quality : undefined,
              });
              const url = URL.createObjectURL(animated.blob);
              urls.current.push(url);
              setItems((c) =>
                c.map((i) =>
                  i.id === item.id
                    ? {
                        ...i,
                        status: "done",
                        url,
                        outBlob: animated.blob,
                        outName: outputName(item.file.name, target),
                        width: animated.width,
                        height: animated.height,
                        frames: animated.frameCount,
                      }
                    : i
                )
              );
            } finally {
              releaseFrames(frames);
            }
            continue;
          }

          const result = await convertImage(item.file, {
            to: target,
            from: item.from,
            name: item.file.name,
            quality: lossy ? quality : undefined,
          });
          setFetched((f) => (f.has(target) ? f : new Set(f).add(target)));
          const url = URL.createObjectURL(result.blob);
          urls.current.push(url);
          setItems((c) =>
            c.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: "done",
                    url,
                    outBlob: result.blob,
                    outName: outputName(item.file.name, target),
                    width: result.width,
                    height: result.height,
                  }
                : i
            )
          );
        } catch (error) {
          // Not an error — an offer. Nothing has been sent, and nothing will be
          // until the row's button is pressed.
          if (error instanceof NeedsServerError) {
            setItems((c) =>
              c.map((i) =>
                i.id === item.id
                  ? { ...i, status: "needs-server", serverFormat: error.format }
                  : i
              )
            );
            continue;
          }
          setItems((c) =>
            c.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: "error",
                    message:
                      error instanceof ImageConvertError ||
                      error instanceof AnimationError
                        ? error.message
                        : "Could not convert this image.",
                  }
                : i
            )
          );
        }
      }
    },
    [target, quality, lossy]
  );

  /**
   * Sends one file to the server decoder, having been told to.
   *
   * The server returns a PNG and nothing else, which is what makes this cheap:
   * the result re-enters the ordinary pipeline, so HEIC and RAW inherit every
   * output format, the quality slider and batch handling without any of that
   * logic existing twice.
   */
  const convertOnServer = useCallback(
    async (id: number) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      setItems((c) => c.map((i) => (i.id === id ? { ...i, status: "uploading" } : i)));

      try {
        const { decodeOnServer } = await import("@/lib/tools/image/server");
        const png = await decodeOnServer(item.file, item.file.name);
        const result = await convertImage(png, {
          to: target,
          from: "png", // it is a PNG now, whatever it arrived as
          name: "decoded.png",
          quality: lossy ? quality : undefined,
        });
        const url = URL.createObjectURL(result.blob);
        urls.current.push(url);
        setItems((c) =>
          c.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "done",
                  url,
                  outBlob: result.blob,
                  outName: outputName(item.file.name, target),
                  width: result.width,
                  height: result.height,
                }
              : i
          )
        );
      } catch (error) {
        setItems((c) =>
          c.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "error",
                  message:
                    error instanceof ImageConvertError
                      ? error.message
                      : "The server could not convert this file.",
                }
              : i
          )
        );
      }
    },
    [items, target, quality, lossy]
  );

  const accept = useMemo(() => {
    if (source) return FORMATS[source].extensions.map((e) => `.${e}`).join(",");
    // `image/*` alone hides exactly the files this tool exists for. macOS and
    // Windows register no MIME type for .cr2, .nef, .arw or .qoi, so the picker
    // greys them out and the person concludes the tool cannot take them — while
    // the drag-and-drop path accepts the same file happily. Listing the
    // extensions alongside the wildcard makes both routes agree.
    return [
      "image/*",
      ...IMAGE_FORMATS.flatMap((f) => FORMATS[f].extensions.map((e) => `.${e}`)),
      ".heic", ".heif", ".hif",
      ".cr2", ".cr3", ".crw", ".nef", ".nrw", ".arw", ".sr2", ".dng",
      ".raf", ".orf", ".rw2", ".pef", ".srw", ".3fr", ".mrw",
      ".psd",
    ].join(",");
  }, [source]);

  const done = items.filter((i) => i.status === "done" && i.outBlob);

  const downloadAll = useCallback(() => {
    for (const item of done) {
      if (!item.url || !item.outName) continue;
      const a = document.createElement("a");
      a.href = item.url;
      a.download = item.outName;
      a.click();
    }
  }, [done]);

  const clear = useCallback(() => {
    urls.current.forEach(URL.revokeObjectURL);
    urls.current = [];
    setItems([]);
  }, []);

  const loaded = items.length > 0;


  // What the "From" card shows: the route's own format, else whatever was
  // actually dropped, else "Any". Reading it off the files means the hub stops
  // claiming "Any" the moment it knows better.
  const fromLabel = source ? FORMATS[source].label : "Any";

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          // Deliberately not filtered on `f.type.startsWith("image/")`.
          // Browsers report an empty MIME type for plenty of real images —
          // camera RAW (.cr2, .nef, .arw), .tga, .qoi and often .tiff — so that
          // filter silently swallowed exactly the files someone would come here
          // to convert. Let the decoder decide, and fail with a message that
          // names the problem.
          const files = [...e.dataTransfer.files];
          if (files.length) run(files);
        }}
        className={cx(
          "rounded-xl border transition-colors",
          dragging ? "border-foreground/40 bg-muted/40" : "border-border"
        )}
      >
        {/*
          The hero: what goes in, what comes out, and where to drop it — the
          three things the page is for, all above the fold and none of them
          requiring a scroll to discover.
        */}
        <div className="flex flex-col items-center gap-5 px-4 py-6">
          <FormatPicker
            fromLabel={fromLabel}
            fromOptions={[
              { value: "any", label: "Any" },
              ...IMAGE_FORMATS.map((f) => ({ value: f, label: FORMATS[f].label })),
            ]}
            onFromChange={(v) =>
              setSource(v === "any" ? null : (v as ImageFormat))
            }
            toLabel={FORMATS[target].label}
            toOptions={availableTargets.map((f) => ({
              value: f,
              label: FORMATS[f].label,
              // Suppressed once fetched: the chunk is cached, so quoting a
              // download that will not happen would be misinformation.
              cost: fetched.has(f) ? null : codecCost(f),
            }))}
            onToChange={(v) => setTarget(v as ImageFormat)}
          />

          <div className="flex flex-col items-center gap-2 text-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:scale-[1.02] active:scale-100"
            >
              Choose {source ? FORMATS[source].label : "image"} files
            </button>
            <p className="text-sm text-muted-foreground">
              or drop them anywhere in this box
            </p>
            <p className="text-xs text-muted-foreground">
              Converted on your device · nothing is uploaded · no file limit
            </p>
          </div>

          {lossy ? (
            <div className="flex items-center gap-3">
              <label
                htmlFor="image-quality"
                className="text-xs text-muted-foreground"
              >
                Quality {Math.round(quality * 100)}%
              </label>
              <input
                id="image-quality"
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-36 accent-foreground"
              />
            </div>
          ) : null}
        </div>

        {loaded ? (
          <div className="border-t">
            <div className="flex items-center justify-between px-3 py-2">
              <ToolLabel>
                {items.length} file{items.length === 1 ? "" : "s"}
              </ToolLabel>
              <div className="flex items-center gap-2">
                {done.length > 1 ? (
                  <button
                    type="button"
                    onClick={downloadAll}
                    className="rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    Save all {done.length}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-t px-3 py-2"
                >
                  {item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded border object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded border bg-muted" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {item.outName ?? item.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.status === "error" ? (
                        item.message
                      ) : item.status === "pending" ? (
                        "Converting…"
                      ) : item.status === "uploading" ? (
                        "Sending to the server…"
                      ) : item.status === "needs-server" ? (
                        // Says exactly what would happen, before it happens.
                        // "Process on our server" without naming the upload is
                        // how a local-only promise quietly stops being true.
                        <>
                          This browser cannot read {item.serverFormat}. Send this
                          file to the server to convert it? It is decoded and
                          returned without being stored.
                        </>
                      ) : (
                        <>
                          {formatBytes(item.file.size)} →{" "}
                          {formatBytes(item.outBlob?.size ?? 0)}
                          {item.width ? ` · ${item.width}×${item.height}` : ""}
                          {item.frames ? ` · ${item.frames} frames` : ""}
                          {item.message ? ` · ${item.message}` : ""}
                        </>
                      )}
                    </p>
                  </div>

                  {item.status === "needs-server" ? (
                    <button
                      type="button"
                      onClick={() => convertOnServer(item.id)}
                      className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Send and convert
                    </button>
                  ) : null}

                  {item.status === "done" && item.url && item.outName ? (
                    <a
                      href={item.url}
                      download={item.outName}
                      className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Save
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (files.length) run(files);
            e.target.value = "";
          }}
        />
      </div>

      {unsupported.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          This browser cannot write{" "}
          {unsupported.map((f) => FORMATS[f].label).join(", ")}, so it is not
          offered. Safari is usually the one missing WebP.
        </p>
      ) : null}
    </div>
  );
}
