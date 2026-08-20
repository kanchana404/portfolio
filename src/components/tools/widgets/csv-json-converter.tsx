"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { TOOL_CHIP_CLASS, TOOL_CHIP_OFF_CLASS, TOOL_CHIP_ON_CLASS, ToolLabel, ToolSelect, ToolTextarea, cx } from "@/components/tools/ui";
import {
  type Delimiter,
  csvToJson,
  jsonToCsv,
  parseCsv,
} from "@/lib/tools/dev/csv";

type Direction = "csvToJson" | "jsonToCsv";

const CSV_SAMPLE = `name,role,city
"Lovelace, Ada",mathematician,London
"Turing, Alan",logician,Wilmslow`;

const JSON_SAMPLE = `[
  { "name": "Lovelace, Ada", "role": "mathematician" },
  { "name": "Turing, Alan", "role": "logician" }
]`;

const DELIMITERS: Array<{ value: Delimiter | "auto"; label: string }> = [
  { value: "auto", label: "Detect automatically" },
  { value: ",", label: "Comma" },
  { value: ";", label: "Semicolon" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe" },
];

const DELIMITER_NAME: Record<string, string> = {
  ",": "comma",
  ";": "semicolon",
  "\t": "tab",
  "|": "pipe",
};

export default function CsvJsonConverter() {
  const id = useId();
  const [direction, setDirection] = useState<Direction>("csvToJson");
  const [csv, setCsv] = useState(CSV_SAMPLE);
  const [json, setJson] = useState(JSON_SAMPLE);
  const [delimiter, setDelimiter] = useState<Delimiter | "auto">("auto");
  const [inferTypes, setInferTypes] = useState(true);

  const fromCsv = useMemo(() => {
    const parsed = parseCsv(csv, delimiter === "auto" ? undefined : delimiter);
    return {
      parsed,
      output: parsed.error ? "" : csvToJson(parsed, { inferTypes }),
    };
  }, [csv, delimiter, inferTypes]);

  const fromJson = useMemo(
    () => jsonToCsv(json, delimiter === "auto" ? "," : delimiter),
    [json, delimiter]
  );

  const toJson = direction === "csvToJson";
  const output = toJson ? fromCsv.output : fromJson.ok ? fromJson.csv : "";
  const error = toJson ? fromCsv.parsed.error : fromJson.ok ? null : fromJson.error;
  const warnings = toJson ? fromCsv.parsed.warnings : [];

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-end gap-4 border-b p-4 sm:p-5">
        <div role="group" aria-label="Direction" className="flex gap-2">
          {(
            [
              ["csvToJson", "CSV → JSON"],
              ["jsonToCsv", "JSON → CSV"],
            ] as const
          ).map(([d, label]) => (
            <button
              key={d}
              type="button"
              aria-pressed={direction === d}
              onClick={() => setDirection(d)}
              className={cx(
                TOOL_CHIP_CLASS,
                direction === d
                  ? TOOL_CHIP_ON_CLASS
                  : TOOL_CHIP_OFF_CLASS
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-52">
          <ToolLabel htmlFor={`${id}-delimiter`} className="text-xs">
            Delimiter
          </ToolLabel>
          <ToolSelect
            id={`${id}-delimiter`}
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value as Delimiter | "auto")}
            className="mt-1 h-9"
          >
            {DELIMITERS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </ToolSelect>
        </div>

        {toJson ? (
          <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={inferTypes}
              onChange={(e) => setInferTypes(e.target.checked)}
              className="size-4"
            />
            Convert numbers and booleans
          </label>
        ) : null}
      </div>

      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
        <div>
          <ToolLabel htmlFor={`${id}-input`}>{toJson ? "CSV" : "JSON"}</ToolLabel>
          <ToolTextarea
            id={`${id}-input`}
            rows={10}
            value={toJson ? csv : json}
            onChange={(e) => (toJson ? setCsv(e.target.value) : setJson(e.target.value))}
            spellCheck={false}
            className="mt-2"
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <ToolLabel htmlFor={`${id}-output`}>{toJson ? "JSON" : "CSV"}</ToolLabel>
            {output.length > 0 ? <CopyButton value={output} /> : null}
          </div>
          <ToolTextarea
            id={`${id}-output`}
            rows={10}
            value={output}
            readOnly
            spellCheck={false}
            className="mt-2 bg-muted/40"
          />
        </div>
      </div>

      <div className="border-t p-4 sm:p-5" aria-live="polite">
        {error ? (
          <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {toJson
              ? `${fromCsv.parsed.rows.length} row${
                  fromCsv.parsed.rows.length === 1 ? "" : "s"
                } · ${fromCsv.parsed.headers.length} column${
                  fromCsv.parsed.headers.length === 1 ? "" : "s"
                } · ${DELIMITER_NAME[fromCsv.parsed.delimiter] ?? "comma"}-separated`
              : fromJson.ok
                ? `${fromJson.rows} row${fromJson.rows === 1 ? "" : "s"} · ${
                    fromJson.columns
                  } column${fromJson.columns === 1 ? "" : "s"}`
                : ""}
          </p>
        )}

        {warnings.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-400">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
