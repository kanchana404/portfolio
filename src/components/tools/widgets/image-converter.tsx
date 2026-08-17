"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ConversionSpec,
  type ImageFormat,
  FORMATS,
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

export default function ImageConverter({ from, to }: ConversionSpec) {
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
      TARGET_FORMATS.map(async (f) => ({ f, ok: await canEncode(f) }))
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

  const lossy = FORMATS[target].mime !== "image/png";

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
    if (from) return FORMATS[from].extensions.map((e) => `.${e}`).join(",");
    return "image/*";
  }, [from]);

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
          const files = [...e.dataTransfer.files].filter((f) =>
            f.type.startsWith("image/")
          );
          if (files.length) run(files);
        }}
        className={cx(
          "rounded-lg border transition-colors",
          loaded ? "" : "border-dashed",
          dragging ? "border-foreground/40 bg-muted/50" : "border-border"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <ToolLabel>
            {loaded ? (
              <>
                {items.length} image{items.length === 1 ? "" : "s"}
                <span className="ml-2 font-normal text-muted-foreground">
                  → {FORMATS[target].label}
                </span>
              </>
            ) : (
              "Your images"
            )}
          </ToolLabel>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              Choose files
            </button>
            {loaded ? (
              <button
                type="button"
                onClick={clear}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {loaded ? (
          <div className="max-h-[26rem] overflow-auto rounded-b-lg">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0"
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
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full px-3 py-10 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Drop {from ? `${FORMATS[from].label} files` : "images"} here, or click
            to choose.
            <span className="mt-1 block text-xs">
              They are converted on this device — nothing is uploaded.
            </span>
          </button>
        )}

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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <ToolLabel>Convert to</ToolLabel>
            <div role="group" aria-label="Output format" className="flex gap-1">
              {availableTargets.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={target === option}
                  onClick={() => setTarget(option)}
                  className={cx(
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    target === option
                      ? "border-foreground/20 bg-foreground text-background"
                      : "hover:bg-muted"
                  )}
                >
                  {FORMATS[option].label}
                </button>
              ))}
            </div>
          </div>

          {lossy ? (
            <div className="flex flex-col gap-1.5">
              <ToolLabel htmlFor="image-quality">
                Quality {Math.round(quality * 100)}%
              </ToolLabel>
              <input
                id="image-quality"
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-40 accent-foreground"
              />
            </div>
          ) : null}
        </div>

        {done.length > 1 ? (
          <button
            type="button"
            onClick={downloadAll}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Save all {done.length}
          </button>
        ) : null}
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
