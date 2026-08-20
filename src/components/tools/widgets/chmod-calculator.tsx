"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import {
  DEFAULT_PERMISSIONS,
  type PermissionSet,
  type Permissions,
  parseOctal,
  toOctal,
  toSymbolic,
  warningsFor,
} from "@/lib/tools/dev/chmod";

const CLASSES: Array<[keyof Pick<Permissions, "owner" | "group" | "other">, string]> = [
  ["owner", "Owner"],
  ["group", "Group"],
  ["other", "Others"],
];
const BITS: Array<[keyof PermissionSet, string]> = [
  ["read", "read"],
  ["write", "write"],
  ["execute", "execute"],
];
const SPECIAL: Array<[keyof Pick<Permissions, "setuid" | "setgid" | "sticky">, string]> = [
  ["setuid", "setuid"],
  ["setgid", "setgid"],
  ["sticky", "sticky"],
];

export default function ChmodCalculator() {
  const id = useId();
  const [perms, setPerms] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [isDirectory, setIsDirectory] = useState(false);
  const [typed, setTyped] = useState("");

  const octal = toOctal(perms);
  const symbolic = toSymbolic(perms);
  const warnings = useMemo(() => warningsFor(perms, isDirectory), [perms, isDirectory]);

  const applyTyped = (value: string) => {
    setTyped(value);
    const parsed = parseOctal(value);
    if (parsed.ok && parsed.permissions) setPerms(parsed.permissions);
  };

  const toggle = (cls: "owner" | "group" | "other", bit: keyof PermissionSet) => {
    setPerms((p) => ({ ...p, [cls]: { ...p[cls], [bit]: !p[cls][bit] } }));
    setTyped("");
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-end gap-4 border-b p-4 sm:p-5">
        <div>
          <ToolLabel htmlFor={`${id}-octal`}>Octal</ToolLabel>
          <ToolInput
            id={`${id}-octal`}
            value={typed || octal}
            onChange={(e) => applyTyped(e.target.value)}
            className="mt-2 w-28 font-mono tabular-nums"
          />
        </div>
        <div>
          <p className="text-sm font-medium leading-none">Symbolic</p>
          <p className="mt-2 font-mono text-lg">{symbolic}</p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={isDirectory}
            onChange={(e) => setIsDirectory(e.target.checked)}
            className="size-3.5 accent-foreground"
          />
          This is a directory
        </label>
      </div>

      <div className="border-b p-4 sm:p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 font-medium">Class</th>
              {BITS.map(([, label]) => (
                <th key={label} className="pb-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLASSES.map(([cls, label]) => (
              <tr key={cls} className="border-t border-border/60">
                <td className="py-2">{label}</td>
                {BITS.map(([bit]) => (
                  <td key={bit} className="py-2">
                    <input
                      type="checkbox"
                      aria-label={`${label} ${bit}`}
                      checked={perms[cls][bit]}
                      onChange={() => toggle(cls, bit)}
                      className="size-4 accent-foreground"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap gap-2">
          {SPECIAL.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={perms[key]}
              onClick={() => {
                setPerms((p) => ({ ...p, [key]: !p[key] }));
                setTyped("");
              }}
              className={cx(
                "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
                perms[key]
                  ? "border-foreground/20 bg-muted text-foreground"
                  : "text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        <div className="flex items-center gap-3">
          <code className="font-mono text-sm">chmod {octal} {isDirectory ? "mydir" : "myfile"}</code>
          <CopyButton value={`chmod ${octal} ${isDirectory ? "mydir" : "myfile"}`} />
        </div>
        {warnings.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {warnings.map((w) => (
              <li key={w.text} className="max-w-prose text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {w.level === "danger" ? "Careful." : "Note."}
                </span>{" "}
                {w.text}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
