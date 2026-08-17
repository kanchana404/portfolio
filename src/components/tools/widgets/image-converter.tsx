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
  formatFromName,
  isRenameOnly,
  outputName,
} from "@/lib/tools/image/spec";
import {
  ImageConvertError,
  canEncode,
  convertImage,
} from "@/lib/tools/image/pipeline";
import { FormatPicker } from "../format-picker";
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
  status: "pending" | "done" | "error";
  url?: string;
  outBlob?: Blob;
  outName?: string;
  message?: string;
  width?: number;
  height?: number;
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
      TARGET_FORMATS.map(async (f) => ({
        f,
        ok: f === "ico" ? true : await canEncode(f),
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
          const result = await convertImage(item.file, {
            to: target,
            from: item.from,
            quality: lossy ? quality : undefined,
          });
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
          setItems((c) =>
            c.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: "error",
                    message:
                      error instanceof ImageConvertError
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

  const accept = useMemo(() => {
    if (source) return FORMATS[source].extensions.map((e) => `.${e}`).join(",");
    return "image/*";
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
                      ) : (
                        <>
                          {formatBytes(item.file.size)} →{" "}
                          {formatBytes(item.outBlob?.size ?? 0)}
                          {item.width ? ` · ${item.width}×${item.height}` : ""}
                          {item.message ? ` · ${item.message}` : ""}
                        </>
                      )}
                    </p>
                  </div>

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
