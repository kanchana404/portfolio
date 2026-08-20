"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/image/spec";
import {
  type ResizeMode,
  reduction,
  targetSize,
} from "@/lib/tools/image/resize";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";

const MODES: Array<[ResizeMode, string]> = [
  ["longest", "Longest side"],
  ["width", "Width"],
  ["height", "Height"],
  ["percent", "Percent"],
];

interface Done {
  name: string;
  url: string;
  before: number;
  after: number;
  width: number;
  height: number;
  clamped: boolean;
}

export default function ImageResizer() {
  const id = useId();
  const [mode, setMode] = useState<ResizeMode>("longest");
  const [value, setValue] = useState(1200);
  const [allowUpscale, setAllowUpscale] = useState(false);
  const [items, setItems] = useState<Done[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  const run = useCallback(
    async (files: File[]) => {
      setError(null);
      for (const file of files) {
        try {
          // `imageOrientation: "from-image"` is what stops a phone photo coming
          // out sideways: the EXIF rotation flag is honoured on decode rather
          // than being lost when the bitmap is drawn.
          const bitmap = await createImageBitmap(file, {
            imageOrientation: "from-image",
          });
          const plan = targetSize(bitmap.width, bitmap.height, {
            mode,
            value,
            allowUpscale,
          });
          if (!plan.ok) {
            setError(plan.error ?? "That size could not be used.");
            bitmap.close();
            continue;
          }

          const canvas = document.createElement("canvas");
          canvas.width = plan.width!;
          canvas.height = plan.height!;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("no canvas");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close();

          // Keep PNG as PNG; everything else becomes JPEG, because a resized
          // photograph re-encoded as PNG is often larger than the original.
          const type = file.type === "image/png" ? "image/png" : "image/jpeg";
          const blob = await new Promise<Blob | null>((r) =>
            canvas.toBlob(r, type, 0.9)
          );
          if (!blob) throw new Error("no blob");

          const url = URL.createObjectURL(blob);
          urls.current.push(url);
          const ext = type === "image/png" ? "png" : "jpg";
          setItems((c) => [
            ...c,
            {
              name: file.name.replace(/\.[^.]+$/, "") + `-${plan.width}.${ext}`,
              url,
              before: file.size,
              after: blob.size,
              width: plan.width!,
              height: plan.height!,
              clamped: Boolean(plan.clamped),
            },
          ]);
        } catch {
          setError("That file could not be read as an image.");
        }
      }
    },
    [mode, value, allowUpscale]
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-end gap-3 border-b p-4 sm:p-5">
        <div role="group" aria-label="Resize by" className="flex flex-wrap gap-2">
          {MODES.map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cx(
                "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
                mode === m
                  ? "border-foreground/20 bg-muted text-foreground"
                  : "text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ToolLabel htmlFor={`${id}-v`} className="text-xs text-muted-foreground">
            {mode === "percent" ? "%" : "px"}
          </ToolLabel>
          <ToolInput
            id={`${id}-v`}
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="h-7 w-24 px-2 text-xs tabular-nums"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={allowUpscale}
            onChange={(e) => setAllowUpscale(e.target.checked)}
            className="size-3.5 accent-foreground"
          />
          Allow upscaling
        </label>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Choose images
          </button>
          <p className="text-xs text-muted-foreground">
            Resized on your device. Nothing is uploaded.
          </p>
        </div>
        {error ? <p className="mt-3 text-sm text-muted-foreground">{error}</p> : null}
      </div>

      {items.length > 0 ? (
        <div className="border-t">
          {items.map((item, i) => (
            <div
              key={item.url}
              className={cx(
                "flex min-h-11 items-center gap-3 px-4 py-2 sm:px-5",
                i > 0 && "border-t border-border/60"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded border object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.name}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {item.width}×{item.height} · {formatBytes(item.before)} →{" "}
                  {formatBytes(item.after)} ({reduction(item.before, item.after)}% smaller)
                </p>
                {item.clamped ? (
                  <p className="text-xs text-muted-foreground">
                    Kept at the original size, which was already smaller than asked for.
                  </p>
                ) : null}
              </div>
              <a
                href={item.url}
                download={item.name}
                className="inline-flex h-7 shrink-0 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:bg-muted"
              >
                Save
              </a>
            </div>
          ))}
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) void run(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
