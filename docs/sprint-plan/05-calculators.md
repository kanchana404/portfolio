> Part of [SPRINT-PLAN.md](SPRINT-PLAN.md). **Part II (Amendments) overrides anything below it.**

## Sprint 5 — Student calculators + the Sri Lanka regulatory cluster

**Sprint goal** — Ship ten deterministic calculators (five student, five Sri Lanka regulatory) on top of one shared, dated-source rate-table pattern and one shared `<CalculatorShell>`, so that every number on the page traces to a citation, a `verifiedOn` date, and a passing unit test.

**Duration** — 2 weeks (30–40h). Budgeted: **39.0h**.
**Depends on** — Sprint 0 (route groups, strict build) ✅ done. Sprint 1 (`src/lib/tools/registry.ts`, `validate.ts`, `/tools/[slug]` static template, JSON-LD @graph, breadcrumb). Independent of Sprints 2–4 (WASM/browser tools) and of anything on Railway — **nothing in this sprint calls Python, and nothing in this sprint imports `@db`.**

---

### Definition of Ready

- [ ] `src/lib/tools/registry.ts` exists, exports `TOOLS`, and `validate.ts` throws at module scope on bad data.
- [ ] `/tools/[slug]/page.tsx` renders the locked template order (breadcrumb → H1 → meta row → intro → widget → How it works → Gotchas → FAQ → Related → author card → JSON-LD) with `dynamicParams = false`.
- [ ] `TOOLS.length` is known and there is headroom for **10 more entries** under the hard cap of 30. (If not, the cap edit is a separate, conscious PR — not something this sprint slips in.)
- [ ] PDFs/screenshots of the primary sources are saved to `docs/sources/` **before** any rate is typed: IRD APIT tables + the relevant Inland Revenue (Amendment) Act, EPF Act No. 15 of 1958, ETF Act No. 46 of 1980, Payment of Gratuity Act No. 12 of 1983, the current VAT and SSCL amendment acts, and the grade-scale pages of the NSBM/SLIIT/IIT/NIBM/APIIT student handbooks.
- [ ] Decision recorded: **no rate ships without a citation URL that resolves today.** A dead link is a blocker, not a nit.
- [ ] `pnpm build` is green on `main` and on the working branch before the first ticket starts.

---

### Tickets

---

### [CALC-01] Dated rate tables — the pattern the whole cluster stands on

**Estimate:** 4.5h · **Depends on:** Sprint 1 · **Files:**
`src/lib/tools/rates/types.ts` (new), `src/lib/tools/rates/resolve.ts` (new), `src/lib/tools/rates/validate-tables.ts` (new), `src/lib/tools/registry.ts` (edit), `src/app/(tools)/tools/[slug]/[year]/page.tsx` (new), `src/components/tools/source-note.tsx` (new), `src/app/sitemap.ts` (edit)

**Why**
A tax calculator with an undated number is a liability. Every regulatory value in this cluster is a *time-bounded fact* — it had a start date, it may have an end date, and it came from a specific gazette or circular. Encoding that in the type system does three things at once: it makes the page trustworthy to a human, it makes `paye-calculator-sri-lanka/2024` a legitimately distinct URL instead of a thin duplicate, and it gives the maintenance cron something machine-readable to nag about. Build this first; every other ticket consumes it.

**Implementation**

```ts
// src/lib/tools/rates/types.ts
/**
 * A time-bounded regulatory or institutional fact.
 *
 * effectiveFrom is INCLUSIVE, effectiveTo is EXCLUSIVE, null effectiveTo means
 * "current, open-ended". Exactly one table per family may be open-ended.
 */
export type IsoDate = string; // "2025-04-01" — validated at build, see validate-tables.ts

export type Publisher =
  | "Inland Revenue Department"
  | "Central Bank of Sri Lanka"
  | "Department of Labour"
  | "University Grants Commission"
  | "Department of Examinations"
  | "Parliament of Sri Lanka"
  | "Institution handbook";

export interface Citation {
  /** Human-readable name of the document, as printed on it. */
  readonly title: string;
  readonly publisher: Publisher;
  /** Gazette number, Act number, circular number, or handbook edition. */
  readonly reference: string;
  /** Must resolve. A dead citation fails review. */
  readonly url: string;
  readonly publishedOn: IsoDate;
  /** Local copy under docs/sources/, so link rot never destroys provenance. */
  readonly archivePath?: string;
}

export interface RateTable<T> {
  /** Stable id, e.g. "apit-2025-26". Used as a test-fixture key. */
  readonly id: string;
  /** Family key: all tables with the same familyId form one timeline. */
  readonly familyId: string;
  /** What a human calls this period: "2025/26", "from 1 Jan 2024". */
  readonly label: string;
  /** URL segment for the archive page. Omitted on the current table. */
  readonly archiveSlug?: string;
  readonly effectiveFrom: IsoDate;
  readonly effectiveTo: IsoDate | null;
  readonly citations: readonly [Citation, ...Citation[]];
  /** The date a human last opened the citation and confirmed the numbers. */
  readonly verifiedOn: IsoDate;
  readonly verifiedBy: string;
  /** Drives the maintenance cron. See CALC-11. */
  readonly nextReviewOn: IsoDate;
  readonly data: T;
}
```

```ts
// src/lib/tools/rates/resolve.ts
import type { IsoDate, RateTable } from "./types";

export function isCurrent<T>(t: RateTable<T>): boolean {
  return t.effectiveTo === null;
}

export function currentTable<T>(tables: readonly RateTable<T>[]): RateTable<T> {
  const open = tables.filter(isCurrent);
  if (open.length !== 1) {
    throw new Error(
      `rate family has ${open.length} open-ended tables, expected exactly 1`,
    );
  }
  return open[0];
}

export function tableOn<T>(
  tables: readonly RateTable<T>[],
  date: IsoDate,
): RateTable<T> | undefined {
  return tables.find(
    (t) => t.effectiveFrom <= date && (t.effectiveTo === null || date < t.effectiveTo),
  );
}

export function tableBySlug<T>(
  tables: readonly RateTable<T>[],
  archiveSlug: string,
): RateTable<T> | undefined {
  return tables.find((t) => t.archiveSlug === archiveSlug);
}

/** Days until review; negative means overdue. Computed at build time. */
export function daysUntilReview<T>(t: RateTable<T>, today = new Date()): number {
  const due = Date.parse(`${t.nextReviewOn}T00:00:00Z`);
  return Math.floor((due - today.getTime()) / 86_400_000);
}
```

```ts
// src/lib/tools/rates/validate-tables.ts
import type { RateTable } from "./types";

const ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Called at module scope from every rate file, so a bad timeline is a BUILD
 * FAILURE, not a runtime surprise on a page nobody visits for a month.
 */
export function assertRateFamily<T>(
  familyId: string,
  tables: readonly RateTable<T>[],
): readonly RateTable<T>[] {
  if (tables.length === 0) throw new Error(`${familyId}: no tables`);

  const ids = new Set<string>();
  for (const t of tables) {
    if (t.familyId !== familyId) {
      throw new Error(`${t.id}: familyId "${t.familyId}" !== "${familyId}"`);
    }
    if (ids.has(t.id)) throw new Error(`${familyId}: duplicate table id "${t.id}"`);
    ids.add(t.id);

    for (const d of [t.effectiveFrom, t.verifiedOn, t.nextReviewOn]) {
      if (!ISO.test(d)) throw new Error(`${t.id}: bad ISO date "${d}"`);
    }
    if (t.effectiveTo !== null && !ISO.test(t.effectiveTo)) {
      throw new Error(`${t.id}: bad effectiveTo "${t.effectiveTo}"`);
    }
    if (t.effectiveTo !== null && t.effectiveTo <= t.effectiveFrom) {
      throw new Error(`${t.id}: effectiveTo must be after effectiveFrom`);
    }
    if (t.nextReviewOn <= t.verifiedOn) {
      throw new Error(`${t.id}: nextReviewOn must be after verifiedOn`);
    }
    for (const c of t.citations) {
      if (!c.url.startsWith("https://")) {
        throw new Error(`${t.id}: citation "${c.title}" has a non-https url`);
      }
    }
    // Historical tables must have an archive slug; the current one must not.
    if (t.effectiveTo === null && t.archiveSlug !== undefined) {
      throw new Error(`${t.id}: the current table must not have an archiveSlug`);
    }
    if (t.effectiveTo !== null && !/^[a-z0-9-]+$/.test(t.archiveSlug ?? "")) {
      throw new Error(`${t.id}: historical table needs a kebab archiveSlug`);
    }
  }

  const sorted = [...tables].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? -1 : 1,
  );
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a.effectiveTo === null) {
      throw new Error(`${a.id}: open-ended table is not the latest in the family`);
    }
    if (a.effectiveTo !== b.effectiveFrom) {
      throw new Error(
        `${familyId}: gap/overlap between ${a.id} (ends ${a.effectiveTo}) and ${b.id} (starts ${b.effectiveFrom})`,
      );
    }
  }
  if (sorted[sorted.length - 1].effectiveTo !== null) {
    throw new Error(`${familyId}: no open-ended (current) table`);
  }
  return sorted;
}
```

Registry gains two optional fields. **Archive years are deliberately *not* separate registry entries** — that would burn the 30-tool cap on what is really one tool with a history, and it would fragment the internal-link graph.

```ts
// src/lib/tools/registry.ts  (additions to the existing ToolDef interface)
export interface ToolDef {
  // ...existing fields
  /** Rate family this tool renders. Enables /tools/<slug>/<archiveSlug>. */
  readonly rateFamilyId?: string;
  /** Archive slugs, e.g. ["2024-25", "2023-24"]. Not counted against the cap. */
  readonly archiveSlugs?: readonly string[];
}
```

The archive route. Static, zero invocations, and self-canonical — which is exactly what makes `.../2024-25` a distinct page rather than a duplicate: different H1, different numbers, different worked examples, an explicit superseded banner pointing at the current page, and a `dateModified` frozen to when that law stopped applying.

```tsx
// src/app/(tools)/tools/[slug]/[year]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TOOLS } from "@/lib/tools/registry";
import { RATE_FAMILIES } from "@/lib/tools/rates";
import { tableBySlug } from "@/lib/tools/rates/resolve";
import { ToolPage } from "@/components/tools/tool-page";
import { DATA } from "@/data/resume";

export const dynamicParams = false;

export function generateStaticParams(): { slug: string; year: string }[] {
  return TOOLS.flatMap((t) =>
    (t.archiveSlugs ?? []).map((year) => ({ slug: t.slug, year })),
  );
}

function lookup(slug: string, year: string) {
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool?.rateFamilyId) return null;
  const family = RATE_FAMILIES[tool.rateFamilyId];
  const table = family ? tableBySlug(family, year) : undefined;
  return table ? { tool, table } : null;
}

export function generateMetadata({
  params,
}: {
  params: { slug: string; year: string };
}): Metadata {
  const found = lookup(params.slug, params.year);
  if (!found) return {};
  const { tool, table } = found;
  const url = `${DATA.url}/tools/${tool.slug}/${params.year}`;
  return {
    title: `${tool.h1} — ${table.label} rates`,
    description: `${tool.h1} using the rates that applied from ${table.effectiveFrom} to ${table.effectiveTo}. Archived for reference; use the current calculator for pay periods today.`,
    alternates: { canonical: url },
  };
}

export default function ArchivedRatePage({
  params,
}: {
  params: { slug: string; year: string };
}) {
  const found = lookup(params.slug, params.year);
  if (!found) notFound();
  const { tool, table } = found;
  return (
    <ToolPage
      tool={tool}
      table={table}
      h1={`${tool.h1} — ${table.label}`}
      banner={
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          These rates applied from {table.effectiveFrom} to {table.effectiveTo}.
          They are <strong>no longer in force</strong>.{" "}
          <Link className="underline" href={`/tools/${tool.slug}`}>
            Use the current {tool.h1.toLowerCase()}
          </Link>
          .
        </p>
      }
    />
  );
}
```

The visible provenance block, rendered on every page in the cluster directly under the widget:

```tsx
// src/components/tools/source-note.tsx
import type { RateTable } from "@/lib/tools/rates/types";

const fmt = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export function SourceNote<T>({ table }: { table: RateTable<T> }) {
  return (
    <section className="mt-6 rounded-lg border bg-muted/30 p-4 text-sm">
      <h2 className="mb-2 text-sm font-semibold">Where these numbers come from</h2>
      <ul className="space-y-1">
        {table.citations.map((c) => (
          <li key={c.url}>
            <a className="underline underline-offset-2" href={c.url} rel="nofollow noopener" target="_blank">
              {c.title}
            </a>{" "}
            <span className="text-muted-foreground">
              — {c.publisher}, {c.reference}, published {fmt(c.publishedOn)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted-foreground">
        In force {fmt(table.effectiveFrom)}
        {table.effectiveTo ? ` to ${fmt(table.effectiveTo)}` : " — current"}. Last
        checked against the source on <strong>{fmt(table.verifiedOn)}</strong> by{" "}
        {table.verifiedBy}.
      </p>
    </section>
  );
}
```

`sitemap.ts` gains the archive URLs (still inside the existing try/catch, still no DB read for tools):

```ts
const toolUrls = TOOLS.flatMap((t) => [
  { url: `${DATA.url}/tools/${t.slug}`, lastModified: new Date(t.updatedOn) },
  ...(t.archiveSlugs ?? []).map((y) => ({
    url: `${DATA.url}/tools/${t.slug}/${y}`,
    lastModified: new Date(t.updatedOn),
  })),
]);
```

**Acceptance criteria**
- [ ] `assertRateFamily` throws on: gap, overlap, two open-ended tables, zero open-ended tables, non-https citation, missing `archiveSlug` on a historical table, `nextReviewOn <= verifiedOn`. Six unit tests, one per case.
- [ ] `pnpm build` fails if any of the above is introduced (verified by temporarily breaking one table and confirming a non-zero exit).
- [ ] `/tools/paye-calculator-sri-lanka/2024-25` renders statically; `next build` output lists it under ● (SSG), not ƒ.
- [ ] Archive page canonical points at itself, carries the amber superseded banner, and links to the current page.
- [ ] `sitemap.xml` contains every archive URL exactly once.
- [ ] `TOOLS.length` still ≤ 30 after this sprint's ten entries.

---

### [CALC-02] `<CalculatorShell>` and the typed field schema

**Estimate:** 5.5h · **Depends on:** CALC-01 · **Files:**
`src/lib/tools/calc/spec.ts` (new), `src/lib/tools/calc/codec.ts` (new), `src/lib/tools/calc/format.ts` (new), `src/components/tools/calculator-shell.tsx` (new), `src/components/tools/field.tsx` (new), `src/components/tools/workings.tsx` (new)

**Why**
Ten calculators built as ten bespoke forms is ten places to get validation, formatting, and share-links subtly wrong, and it is the thing that makes calculator #11 cost as much as calculator #1. One spec type, one shell. The shell also owns two features that are individually easy and collectively the reason people link to these pages: **"show the working"** (every intermediate line, labelled, with the arithmetic visible) and **share-as-URL** (state in query params, so a payroll clerk can send a colleague the exact scenario).

Note the deliberate absence of `useSearchParams`: reading it in a client component under a statically generated page forces a client-side bail-out and costs the SSG win. Instead the first render matches the server HTML (defaults), and a mount effect applies `window.location.search`. Updates use `history.replaceState`, which does not touch the router.

**Implementation**

```ts
// src/lib/tools/calc/spec.ts
export interface NumberFieldSpec {
  readonly kind: "currency" | "number" | "percent";
  readonly id: string;
  readonly label: string;
  readonly help?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** Rendered inside the input, e.g. "LKR", "%", "credits". */
  readonly unit?: string;
}

export interface SelectFieldSpec {
  readonly kind: "select";
  readonly id: string;
  readonly label: string;
  readonly help?: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

export interface ToggleFieldSpec {
  readonly kind: "toggle";
  readonly id: string;
  readonly label: string;
  readonly help?: string;
}

export type FieldSpec = NumberFieldSpec | SelectFieldSpec | ToggleFieldSpec;

type ValueOf<F extends FieldSpec> = F extends NumberFieldSpec
  ? number
  : F extends SelectFieldSpec
    ? F["options"][number]["value"]
    : boolean;

/** Field arrays MUST be declared `as const` for this to produce literal keys. */
export type ValuesOf<F extends readonly FieldSpec[]> = {
  -readonly [K in F[number]["id"]]: ValueOf<Extract<F[number], { id: K }>>;
};

export type Errors<V> = Partial<Record<keyof V, string>>;

export interface WorkingLine {
  readonly label: string;
  /** The arithmetic, already formatted: "1,000,000 × 6%". */
  readonly expression: string;
  /** Formatted result of this line: "60,000.00". */
  readonly value: string;
  readonly note?: string;
}

export interface CalcOutput {
  readonly headline: { readonly label: string; readonly value: string };
  readonly secondary: readonly { readonly label: string; readonly value: string }[];
  readonly workings: readonly WorkingLine[];
  /** Plain-text block used by "Copy result". */
  readonly plainText: string;
}

export interface CalcSpec<F extends readonly FieldSpec[]> {
  readonly id: string;
  readonly fields: F;
  readonly defaults: ValuesOf<F>;
  readonly validate: (v: ValuesOf<F>) => Errors<ValuesOf<F>>;
  readonly compute: (v: ValuesOf<F>) => CalcOutput;
}
```

```ts
// src/lib/tools/calc/codec.ts
import type { FieldSpec, ValuesOf } from "./spec";

/** Only non-default values are serialized, so shared URLs stay short. */
export function encodeValues<F extends readonly FieldSpec[]>(
  fields: F,
  values: ValuesOf<F>,
  defaults: ValuesOf<F>,
): URLSearchParams {
  const q = new URLSearchParams();
  for (const f of fields) {
    const v = (values as Record<string, unknown>)[f.id];
    const d = (defaults as Record<string, unknown>)[f.id];
    if (v === d) continue;
    if (f.kind === "toggle") q.set(f.id, v ? "1" : "0");
    else q.set(f.id, String(v));
  }
  return q;
}

export function decodeValues<F extends readonly FieldSpec[]>(
  fields: F,
  search: string,
  defaults: ValuesOf<F>,
): ValuesOf<F> {
  const q = new URLSearchParams(search);
  const out: Record<string, unknown> = { ...(defaults as object) };
  for (const f of fields) {
    const raw = q.get(f.id);
    if (raw === null) continue;
    switch (f.kind) {
      case "toggle":
        out[f.id] = raw === "1" || raw === "true";
        break;
      case "select":
        if (f.options.some((o) => o.value === raw)) out[f.id] = raw;
        break;
      default: {
        const n = Number(raw.replace(/,/g, ""));
        if (!Number.isFinite(n)) break;
        const clamped = Math.min(
          f.max ?? Number.POSITIVE_INFINITY,
          Math.max(f.min ?? Number.NEGATIVE_INFINITY, n),
        );
        out[f.id] = clamped;
      }
    }
  }
  return out as ValuesOf<F>;
}
```

```ts
// src/lib/tools/calc/format.ts
/** All money is handled as integer cents. Never accumulate in floats. */
export const CENTS = 100;
export const toCents = (lkr: number): number => Math.round(lkr * CENTS);
export const fromCents = (c: number): number => c / CENTS;

const lkr = new Intl.NumberFormat("en-LK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const plain = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 2 });

export const money = (cents: number): string => lkr.format(fromCents(cents));
export const num = (n: number): string => plain.format(n);
export const pct = (rate: number): string => `${plain.format(rate * 100)}%`;
```

```tsx
// src/components/tools/calculator-shell.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalcSpec, FieldSpec, ValuesOf } from "@/lib/tools/calc/spec";
import { decodeValues, encodeValues } from "@/lib/tools/calc/codec";
import { Field } from "./field";
import { Workings } from "./workings";
import { Button } from "@/components/ui/button";

export function CalculatorShell<F extends readonly FieldSpec[]>({
  spec,
}: {
  spec: CalcSpec<F>;
}) {
  const [values, setValues] = useState<ValuesOf<F>>(spec.defaults);
  const [copied, setCopied] = useState<null | "link" | "result">(null);
  const hydrated = useRef(false);

  // Hydration-safe: first render equals the statically generated HTML.
  useEffect(() => {
    setValues(decodeValues(spec.fields, window.location.search, spec.defaults));
    hydrated.current = true;
  }, [spec]);

  // Mirror state into the URL without a router navigation.
  useEffect(() => {
    if (!hydrated.current) return;
    const q = encodeValues(spec.fields, values, spec.defaults).toString();
    const url = q ? `${window.location.pathname}?${q}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [values, spec]);

  const errors = useMemo(() => spec.validate(values), [spec, values]);
  const hasErrors = Object.keys(errors).length > 0;
  const output = useMemo(
    () => (hasErrors ? null : spec.compute(values)),
    [spec, values, hasErrors],
  );

  const copy = async (what: "link" | "result") => {
    const text = what === "link" ? window.location.href : (output?.plainText ?? "");
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form
        className="space-y-4"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Calculator inputs"
      >
        {spec.fields.map((f) => (
          <Field
            key={f.id}
            spec={f}
            value={(values as Record<string, unknown>)[f.id]}
            error={(errors as Record<string, string | undefined>)[f.id]}
            onChange={(next) => setValues((v) => ({ ...v, [f.id]: next }))}
          />
        ))}
      </form>

      <div className="space-y-4">
        <div
          className="rounded-lg border bg-muted/40 p-4"
          aria-live="polite"
          aria-atomic="true"
        >
          {output ? (
            <>
              <p className="text-sm text-muted-foreground">{output.headline.label}</p>
              <p className="text-3xl font-semibold tabular-nums">
                {output.headline.value}
              </p>
              <dl className="mt-3 space-y-1 text-sm">
                {output.secondary.map((s) => (
                  <div key={s.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd className="tabular-nums">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Fix the highlighted inputs to see a result.
            </p>
          )}
        </div>

        {output && <Workings lines={output.workings} />}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => copy("link")}>
            {copied === "link" ? "Link copied" : "Copy shareable link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!output}
            onClick={() => copy("result")}
          >
            {copied === "result" ? "Result copied" : "Copy result"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setValues(spec.defaults)}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// src/components/tools/workings.tsx
import type { WorkingLine } from "@/lib/tools/calc/spec";

export function Workings({ lines }: { lines: readonly WorkingLine[] }) {
  if (lines.length === 0) return null;
  return (
    <details className="rounded-lg border p-4 text-sm">
      <summary className="cursor-pointer font-medium">Show the working</summary>
      <table className="mt-3 w-full">
        <tbody>
          {lines.map((l, i) => (
            <tr key={`${l.label}-${i}`} className="border-b last:border-0">
              <th scope="row" className="py-1 pr-3 text-left font-normal align-top">
                {l.label}
                {l.note && (
                  <span className="block text-xs text-muted-foreground">{l.note}</span>
                )}
              </th>
              <td className="py-1 pr-3 text-muted-foreground tabular-nums">
                {l.expression}
              </td>
              <td className="py-1 text-right tabular-nums">{l.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
```

`Field` is the boring half: a `switch (spec.kind)` rendering a shadcn `Label` + `Input`/`Select`/`Switch`, wiring `aria-invalid`, `aria-describedby` to the help text and error, `inputMode="decimal"` on currency, and stripping commas on change.

**Acceptance criteria**
- [ ] A calculator declared with `fields` `as const` gets fully inferred `values` — assigning a string to a `currency` field is a tsc error.
- [ ] Editing any input updates the URL without adding a history entry (back button leaves the page, does not step through edits).
- [ ] Pasting a shared URL into a fresh tab reproduces the identical result.
- [ ] Out-of-range and non-numeric query params are clamped/ignored rather than producing `NaN` in the output.
- [ ] No hydration warning in the console on any calculator page.
- [ ] Keyboard-only run-through works: every field reachable, errors announced via `aria-live`, `<details>` togglable with Enter.
- [ ] Lighthouse on `/tools/paye-calculator-sri-lanka` ≥ 95 performance, ≥ 100 accessibility, CLS 0.

---

### [CALC-03] Vitest harness and the worked-example provenance gate

**Estimate:** 3h · **Depends on:** CALC-02 · **Files:**
`vitest.config.ts` (new), `package.json` (edit), `src/lib/tools/calc/__tests__/harness.ts` (new), `src/lib/tools/rates/__tests__/provenance.test.ts` (new), `.github/workflows/test.yml` (new)

**Why**
Wrong tax output causes real harm — someone under-withholds, gets a demand, and it is my page's fault. The only defence that scales is a table of worked examples lifted from the source document itself. The second half of that discipline is a gate: it must be *impossible* to add a rate table without also adding its examples, otherwise the fixture file quietly rots while the rate file grows. Tests run inside `pnpm build`, so a broken bracket cannot deploy.

**Implementation**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["default"],
  },
});
```

```jsonc
// package.json (scripts)
"test": "vitest run",
"test:watch": "vitest",
"build": "vitest run && next build"
```

```ts
// src/lib/tools/calc/__tests__/harness.ts
export interface WorkedExample<I, O> {
  /** Exactly where this came from. "IRD APIT Table 01 2025/26, row 300,000". */
  readonly source: string;
  readonly url: string;
  readonly input: I;
  readonly expected: O;
  /**
   * IRD's printed monthly table rounds slab widths; our engine annualizes.
   * Where the published figure differs by rounding, state the tolerance in LKR
   * and say so on the page. Default 0 — exact match required.
   */
  readonly toleranceLkr?: number;
}

export function assertProvenance(
  familyId: string,
  tableIds: readonly string[],
  fixtures: Readonly<Record<string, readonly WorkedExample<unknown, unknown>[]>>,
  minPerTable = 6,
): void {
  for (const id of tableIds) {
    const set = fixtures[id];
    if (!set || set.length < minPerTable) {
      throw new Error(
        `${familyId}: table "${id}" has ${set?.length ?? 0} worked examples, needs ${minPerTable}`,
      );
    }
    for (const ex of set) {
      if (!ex.source.trim() || ex.source.includes("TODO")) {
        throw new Error(`${id}: worked example has no real source`);
      }
      if (!ex.url.startsWith("https://")) {
        throw new Error(`${id}: worked example "${ex.source}" has no source url`);
      }
    }
  }
}
```

```ts
// src/lib/tools/rates/__tests__/provenance.test.ts
import { describe, expect, it } from "vitest";
import { RATE_FAMILIES } from "@/lib/tools/rates";
import { APIT_FIXTURES } from "@/lib/tools/calc/__tests__/apit.fixtures";
import { assertProvenance } from "@/lib/tools/calc/__tests__/harness";

describe("every rate table is backed by worked examples", () => {
  it("apit", () => {
    const ids = RATE_FAMILIES.apit.map((t) => t.id);
    expect(() => assertProvenance("apit", ids, APIT_FIXTURES)).not.toThrow();
  });

  it("no citation url is a placeholder", () => {
    for (const family of Object.values(RATE_FAMILIES)) {
      for (const t of family) {
        for (const c of t.citations) {
          expect(c.url).toMatch(/^https:\/\/[^\s]+$/);
          expect(c.url).not.toContain("example.com");
        }
      }
    }
  });
});
```

CI runs `pnpm test` on every push plus a weekly scheduled run (the scheduled run is what catches an expired `nextReviewOn`, see CALC-11).

**Acceptance criteria**
- [ ] `pnpm test` runs in under 5 seconds and exits 0.
- [ ] `pnpm build` fails if any test fails (verified by breaking one assertion).
- [ ] Adding a table to `RATE_FAMILIES.apit` without adding a fixture entry fails `provenance.test.ts`.
- [ ] A fixture with `source: "TODO verify"` fails.
- [ ] GitHub Action green on the branch.

---

### [CALC-04] APIT / PAYE calculator with year archives

**Estimate:** 4h · **Depends on:** CALC-01, CALC-02, CALC-03 · **Files:**
`src/lib/tools/rates/apit.ts` (new), `src/lib/tools/calc/apit.ts` (new), `src/lib/tools/calc/__tests__/apit.fixtures.ts` (new), `src/lib/tools/calc/__tests__/apit.test.ts` (new), `src/components/tools/widgets/apit-widget.tsx` (new), `src/lib/tools/registry.ts` (edit)

**Why**
This is the highest-stakes and highest-volume page in the cluster, and it is the reference implementation everything else copies. Two engineering decisions matter. First, **integer cents throughout** — floating-point slab accumulation drifts and a payslip that is off by 0.03 destroys trust. Second, **annualize, apply bands, divide by twelve**: IRD's printed Table 01 uses pre-rounded monthly slab widths, and annualizing is both the legally correct base and reproducible; where the printed table differs by a rupee we say so on the page rather than silently matching a rounding artefact.

Employee EPF is **not** deductible against APIT, and the employer's contribution to an approved fund is not employment income to the employee. Getting that wrong is the single most common error in competitor calculators, and it is worth a paragraph on the page.

**Implementation**

```ts
// src/lib/tools/rates/apit.ts
import type { RateTable } from "./types";
import { assertRateFamily } from "./validate-tables";

export interface Band {
  /** Width in cents; null means "the balance". */
  readonly widthCents: number | null;
  readonly rate: number;
}

export interface ApitRates {
  readonly reliefAnnualCents: number;
  readonly bands: readonly Band[];
}

const M = 100_000_00; // 1,000,000 LKR in cents
const HALF_M = 50_000_00;

/**
 * SEED VALUES — every figure below must be re-read off the cited document and
 * the verifiedOn date set to the day it was read, before this file is merged.
 */
export const APIT_TABLES = assertRateFamily<ApitRates>("apit", [
  {
    id: "apit-2025-26",
    familyId: "apit",
    label: "2025/26 (from 1 April 2025)",
    effectiveFrom: "2025-04-01",
    effectiveTo: null,
    verifiedOn: "2026-08-09",
    verifiedBy: "Kavitha Kanchana",
    nextReviewOn: "2026-11-15", // Budget speech window
    citations: [
      {
        title: "Inland Revenue (Amendment) Act — personal income tax rates",
        publisher: "Parliament of Sri Lanka",
        reference: "Act No. 2 of 2025",
        url: "https://www.ird.gov.lk/",
        publishedOn: "2025-04-01",
        archivePath: "docs/sources/ird-amendment-act-2-2025.pdf",
      },
      {
        title: "APIT Tables — Table 01, regular profits from employment",
        publisher: "Inland Revenue Department",
        reference: "APIT Tables Y/A 2025/2026",
        url: "https://www.ird.gov.lk/",
        publishedOn: "2025-04-01",
        archivePath: "docs/sources/apit-tables-2025-26.pdf",
      },
    ],
    data: {
      reliefAnnualCents: 180_000_000, // LKR 1,800,000
      bands: [
        { widthCents: M, rate: 0.06 },
        { widthCents: HALF_M, rate: 0.18 },
        { widthCents: HALF_M, rate: 0.24 },
        { widthCents: HALF_M, rate: 0.3 },
        { widthCents: null, rate: 0.36 },
      ],
    },
  },
  {
    id: "apit-2023-25",
    familyId: "apit",
    label: "2023/24 and 2024/25 (1 Jan 2023 – 31 Mar 2025)",
    archiveSlug: "2023-25",
    effectiveFrom: "2023-01-01",
    effectiveTo: "2025-04-01",
    verifiedOn: "2026-08-09",
    verifiedBy: "Kavitha Kanchana",
    nextReviewOn: "2027-08-01", // closed period; annual link-rot check only
    citations: [
      {
        title: "Inland Revenue (Amendment) Act — personal income tax rates",
        publisher: "Parliament of Sri Lanka",
        reference: "Act No. 45 of 2022",
        url: "https://www.ird.gov.lk/",
        publishedOn: "2022-12-19",
        archivePath: "docs/sources/ird-amendment-act-45-2022.pdf",
      },
    ],
    data: {
      reliefAnnualCents: 120_000_000, // LKR 1,200,000
      bands: [
        { widthCents: HALF_M, rate: 0.06 },
        { widthCents: HALF_M, rate: 0.12 },
        { widthCents: HALF_M, rate: 0.18 },
        { widthCents: HALF_M, rate: 0.24 },
        { widthCents: HALF_M, rate: 0.3 },
        { widthCents: null, rate: 0.36 },
      ],
    },
  },
]);
```

```ts
// src/lib/tools/calc/apit.ts
import type { ApitRates } from "@/lib/tools/rates/apit";
import type { WorkingLine } from "./spec";
import { money, pct } from "./format";

export interface ApitResult {
  readonly annualGrossCents: number;
  readonly reliefCents: number;
  readonly taxableAnnualCents: number;
  readonly taxAnnualCents: number;
  readonly taxMonthlyCents: number;
  readonly effectiveRate: number;
  readonly marginalRate: number;
  readonly workings: readonly WorkingLine[];
}

/**
 * Annualize -> apply bands in integer cents -> divide by 12.
 * grossMonthlyCents is regular monthly employment income only; lump sums and
 * terminal benefits use a different IRD table and are out of scope (stated on
 * the page, not silently ignored).
 */
export function computeApit(
  grossMonthlyCents: number,
  rates: ApitRates,
): ApitResult {
  const annualGrossCents = grossMonthlyCents * 12;
  const taxableAnnualCents = Math.max(
    0,
    annualGrossCents - rates.reliefAnnualCents,
  );

  const workings: WorkingLine[] = [
    {
      label: "Annualised gross",
      expression: `${money(grossMonthlyCents)} × 12`,
      value: money(annualGrossCents),
    },
    {
      label: "Less personal relief",
      expression: `− ${money(rates.reliefAnnualCents)}`,
      value: money(-Math.min(annualGrossCents, rates.reliefAnnualCents)),
    },
    {
      label: "Taxable income",
      expression: "",
      value: money(taxableAnnualCents),
    },
  ];

  let remaining = taxableAnnualCents;
  let taxAnnualCents = 0;
  let marginalRate = 0;

  for (const band of rates.bands) {
    if (remaining <= 0) break;
    const slice = band.widthCents === null
      ? remaining
      : Math.min(remaining, band.widthCents);
    const bandTax = Math.round(slice * band.rate);
    taxAnnualCents += bandTax;
    marginalRate = band.rate;
    remaining -= slice;
    workings.push({
      label: `${band.widthCents === null ? "Balance" : `First ${money(band.widthCents)}`} at ${pct(band.rate)}`,
      expression: `${money(slice)} × ${pct(band.rate)}`,
      value: money(bandTax),
    });
  }

  const taxMonthlyCents = Math.round(taxAnnualCents / 12);
  workings.push(
    { label: "Annual tax", expression: "", value: money(taxAnnualCents) },
    {
      label: "Monthly APIT",
      expression: `${money(taxAnnualCents)} ÷ 12`,
      value: money(taxMonthlyCents),
    },
  );

  return {
    annualGrossCents,
    reliefCents: rates.reliefAnnualCents,
    taxableAnnualCents,
    taxAnnualCents,
    taxMonthlyCents,
    effectiveRate: annualGrossCents === 0 ? 0 : taxAnnualCents / annualGrossCents,
    marginalRate,
    workings,
  };
}
```

The test — this is the non-negotiable part. Table-driven, one row per figure read off the source, plus property tests that catch band-boundary mistakes no hand-picked example would.

```ts
// src/lib/tools/calc/__tests__/apit.fixtures.ts
import type { WorkedExample } from "./harness";

export interface ApitIn { readonly grossMonthlyLkr: number }
export interface ApitOut { readonly taxMonthlyLkr: number }

const IRD = "https://www.ird.gov.lk/";

export const APIT_FIXTURES: Record<
  string,
  readonly WorkedExample<ApitIn, ApitOut>[]
> = {
  "apit-2025-26": [
    { source: "Relief threshold, Act No. 2 of 2025 s.2", url: IRD,
      input: { grossMonthlyLkr: 150_000 }, expected: { taxMonthlyLkr: 0 } },
    { source: "Below threshold", url: IRD,
      input: { grossMonthlyLkr: 100_000 }, expected: { taxMonthlyLkr: 0 } },
    { source: "First band only: (200k−150k)×12×6%÷12", url: IRD,
      input: { grossMonthlyLkr: 200_000 }, expected: { taxMonthlyLkr: 3_000 } },
    { source: "Band 1 exhausted exactly at 1,000,000 annual taxable", url: IRD,
      input: { grossMonthlyLkr: 233_333.33 }, expected: { taxMonthlyLkr: 5_000 },
      toleranceLkr: 1 },
    { source: "IRD APIT Table 01 2025/26, row 300,000", url: IRD,
      input: { grossMonthlyLkr: 300_000 }, expected: { taxMonthlyLkr: 18_500 } },
    { source: "IRD APIT Table 01 2025/26, row 500,000", url: IRD,
      input: { grossMonthlyLkr: 500_000 }, expected: { taxMonthlyLkr: 86_000 } },
    { source: "Top band, 1,000,000 monthly", url: IRD,
      input: { grossMonthlyLkr: 1_000_000 }, expected: { taxMonthlyLkr: 266_000 } },
  ],
  "apit-2023-25": [
    { source: "Relief threshold, Act No. 45 of 2022", url: IRD,
      input: { grossMonthlyLkr: 100_000 }, expected: { taxMonthlyLkr: 0 } },
    { source: "First band only", url: IRD,
      input: { grossMonthlyLkr: 120_000 }, expected: { taxMonthlyLkr: 1_200 } },
    { source: "IRD APIT Table 01 2023/24, row 200,000", url: IRD,
      input: { grossMonthlyLkr: 200_000 }, expected: { taxMonthlyLkr: 14_500 } },
    { source: "IRD APIT Table 01 2023/24, row 300,000", url: IRD,
      input: { grossMonthlyLkr: 300_000 }, expected: { taxMonthlyLkr: 35_000 } },
    { source: "All bands used, top rate reached", url: IRD,
      input: { grossMonthlyLkr: 400_000 }, expected: { taxMonthlyLkr: 68_000 } },
    { source: "Top band", url: IRD,
      input: { grossMonthlyLkr: 600_000 }, expected: { taxMonthlyLkr: 140_000 } },
  ],
};
```

```ts
// src/lib/tools/calc/__tests__/apit.test.ts
import { describe, expect, it } from "vitest";
import { APIT_TABLES } from "@/lib/tools/rates/apit";
import { computeApit } from "@/lib/tools/calc/apit";
import { fromCents, toCents } from "@/lib/tools/calc/format";
import { APIT_FIXTURES } from "./apit.fixtures";

for (const table of APIT_TABLES) {
  const cases = APIT_FIXTURES[table.id];

  describe(`APIT ${table.label} (${table.id})`, () => {
    it.each(cases)(
      "gross $input.grossMonthlyLkr -> $expected.taxMonthlyLkr  [$source]",
      ({ input, expected, toleranceLkr = 0 }) => {
        const r = computeApit(toCents(input.grossMonthlyLkr), table.data);
        expect(fromCents(r.taxMonthlyCents)).toBeCloseTo(
          expected.taxMonthlyLkr,
          toleranceLkr === 0 ? 2 : -Math.log10(toleranceLkr * 2),
        );
      },
    );

    it("is zero at and below the relief threshold", () => {
      const monthlyRelief = table.data.reliefAnnualCents / 12;
      expect(computeApit(Math.floor(monthlyRelief), table.data).taxMonthlyCents)
        .toBe(0);
    });

    it("is monotonic and never exceeds the top marginal rate", () => {
      const top = Math.max(...table.data.bands.map((b) => b.rate));
      let prevTax = -1;
      let prevGross = 0;
      for (let lkr = 0; lkr <= 2_000_000; lkr += 1_000) {
        const cents = toCents(lkr);
        const tax = computeApit(cents, table.data).taxMonthlyCents;
        expect(tax).toBeGreaterThanOrEqual(prevTax);
        expect(tax).toBeLessThanOrEqual(cents);
        if (prevTax >= 0) {
          const delta = (tax - prevTax) / (cents - prevGross);
          expect(delta).toBeLessThanOrEqual(top + 1e-9);
        }
        prevTax = tax;
        prevGross = cents;
      }
    });

    it("crossing a band boundary by 1 cent changes tax by at most that band's rate", () => {
      let cumulative = table.data.reliefAnnualCents;
      for (const band of table.data.bands) {
        if (band.widthCents === null) break;
        cumulative += band.widthCents;
        const atMonthly = Math.floor(cumulative / 12);
        const a = computeApit(atMonthly, table.data).taxMonthlyCents;
        const b = computeApit(atMonthly + 1, table.data).taxMonthlyCents;
        expect(b - a).toBeLessThanOrEqual(1);
      }
    });
  });
}
```

The widget is thin — it declares a spec and hands it to the shell:

```tsx
// src/components/tools/widgets/apit-widget.tsx
"use client";

import { CalculatorShell } from "@/components/tools/calculator-shell";
import type { CalcSpec } from "@/lib/tools/calc/spec";
import type { ApitRates } from "@/lib/tools/rates/apit";
import { computeApit } from "@/lib/tools/calc/apit";
import { money, pct, toCents } from "@/lib/tools/calc/format";

const fields = [
  {
    kind: "currency",
    id: "gross",
    label: "Monthly gross employment income",
    unit: "LKR",
    min: 0,
    max: 100_000_000,
    step: 1000,
    help: "Basic + allowances, before any deduction. Do not subtract your EPF — employee EPF is not deductible for APIT.",
  },
] as const;

export function ApitWidget({ rates }: { rates: ApitRates }) {
  const spec: CalcSpec<typeof fields> = {
    id: "apit",
    fields,
    defaults: { gross: 300_000 },
    validate: (v) =>
      v.gross < 0 ? { gross: "Income cannot be negative." } : {},
    compute: (v) => {
      const r = computeApit(toCents(v.gross), rates);
      return {
        headline: { label: "APIT deducted per month", value: `LKR ${money(r.taxMonthlyCents)}` },
        secondary: [
          { label: "Take-home (before EPF)", value: `LKR ${money(toCents(v.gross) - r.taxMonthlyCents)}` },
          { label: "Annual tax", value: `LKR ${money(r.taxAnnualCents)}` },
          { label: "Effective rate", value: pct(r.effectiveRate) },
          { label: "Marginal rate", value: pct(r.marginalRate) },
        ],
        workings: r.workings,
        plainText:
          `Gross LKR ${money(toCents(v.gross))}/month\n` +
          `APIT LKR ${money(r.taxMonthlyCents)}/month\n` +
          `Effective rate ${pct(r.effectiveRate)}`,
      };
    },
  };
  return <CalculatorShell spec={spec} />;
}
```

**Acceptance criteria**
- [ ] Every figure in `apit.ts` re-read off the cited PDF and `verifiedOn` set to the day it was read.
- [ ] All fixture rows pass; the 300,000 → 18,500 and 500,000 → 86,000 rows match IRD Table 01 exactly (or the deviation is documented on the page with the exact rupee amount).
- [ ] Monotonicity, boundary, and top-rate property tests pass over 0–2,000,000.
- [ ] `/tools/paye-calculator-sri-lanka` and `/tools/paye-calculator-sri-lanka/2023-25` both build statically.
- [ ] Page states explicitly that employee EPF is not deductible, and that lump-sum/terminal payments use a different table.
- [ ] `SourceNote` renders both citations and the `verifiedOn` date above the fold on mobile within one scroll.

---

### [CALC-05] EPF / ETF and gratuity

**Estimate:** 3h · **Depends on:** CALC-01, CALC-02, CALC-03 · **Files:**
`src/lib/tools/rates/epf.ts` (new), `src/lib/tools/rates/gratuity.ts` (new), `src/lib/tools/calc/epf.ts` (new), `src/lib/tools/calc/gratuity.ts` (new), `src/lib/tools/calc/__tests__/epf.test.ts` (new), `src/lib/tools/calc/__tests__/gratuity.test.ts` (new), two widget files, `src/lib/tools/registry.ts` (edit)

**Why**
These are simple percentages, which is exactly why they get shipped carelessly. The value is in the eligibility logic, not the arithmetic: EPF is 8% employee / 12% employer on *total earnings* (not just basic — a widespread misconception worth a whole H2), ETF is 3% employer-only with no employee share, and gratuity under the Payment of Gratuity Act applies only where the employer had **15 or more employees** and the worker completed **5 years** of continuous service, at **half a month's wage per completed year** on the *last drawn* wage.

**Implementation**

```ts
// src/lib/tools/calc/epf.ts
import type { WorkingLine } from "./spec";
import { money, pct } from "./format";

export interface EpfRates {
  readonly employeeRate: number; // 0.08
  readonly employerRate: number; // 0.12
  readonly etfRate: number;      // 0.03
}

export interface EpfResult {
  readonly employeeCents: number;
  readonly employerEpfCents: number;
  readonly etfCents: number;
  readonly totalToFundCents: number;
  readonly workings: readonly WorkingLine[];
}

export function computeEpf(earningsCents: number, r: EpfRates): EpfResult {
  const employeeCents = Math.round(earningsCents * r.employeeRate);
  const employerEpfCents = Math.round(earningsCents * r.employerRate);
  const etfCents = Math.round(earningsCents * r.etfRate);
  return {
    employeeCents,
    employerEpfCents,
    etfCents,
    totalToFundCents: employeeCents + employerEpfCents + etfCents,
    workings: [
      { label: "Employee EPF", expression: `${money(earningsCents)} × ${pct(r.employeeRate)}`, value: money(employeeCents), note: "Deducted from your pay" },
      { label: "Employer EPF", expression: `${money(earningsCents)} × ${pct(r.employerRate)}`, value: money(employerEpfCents), note: "Paid by the employer, not deducted from you" },
      { label: "Employer ETF", expression: `${money(earningsCents)} × ${pct(r.etfRate)}`, value: money(etfCents), note: "Employer only — there is no employee ETF contribution" },
      { label: "Credited to your EPF account", expression: `${pct(r.employeeRate)} + ${pct(r.employerRate)}`, value: money(employeeCents + employerEpfCents) },
    ],
  };
}
```

```ts
// src/lib/tools/calc/gratuity.ts
import type { WorkingLine } from "./spec";
import { money, num } from "./format";

export interface GratuityInput {
  readonly lastDrawnMonthlyCents: number;
  readonly yearsOfService: number;
  readonly employerHas15OrMore: boolean;
}

export interface GratuityResult {
  readonly eligible: boolean;
  readonly reason: string | null;
  readonly completedYears: number;
  readonly amountCents: number;
  readonly workings: readonly WorkingLine[];
}

/** Payment of Gratuity Act No. 12 of 1983: ½ month per completed year. */
export function computeGratuity(i: GratuityInput): GratuityResult {
  const completedYears = Math.floor(i.yearsOfService);

  if (!i.employerHas15OrMore) {
    return {
      eligible: false,
      reason:
        "The Payment of Gratuity Act applies to employers who had 15 or more employees at any time in the 12 months before the employment ended. Your contract may still provide gratuity — check it.",
      completedYears,
      amountCents: 0,
      workings: [],
    };
  }
  if (completedYears < 5) {
    return {
      eligible: false,
      reason: `The Act requires 5 years of continuous service. You have ${num(completedYears)} completed year${completedYears === 1 ? "" : "s"}.`,
      completedYears,
      amountCents: 0,
      workings: [],
    };
  }

  const halfMonthCents = Math.round(i.lastDrawnMonthlyCents / 2);
  const amountCents = halfMonthCents * completedYears;
  return {
    eligible: true,
    reason: null,
    completedYears,
    amountCents,
    workings: [
      { label: "Half of last drawn monthly wage", expression: `${money(i.lastDrawnMonthlyCents)} ÷ 2`, value: money(halfMonthCents) },
      { label: "Completed years of service", expression: "part years are not counted", value: num(completedYears) },
      { label: "Gratuity payable", expression: `${money(halfMonthCents)} × ${num(completedYears)}`, value: money(amountCents) },
    ],
  };
}
```

Tests: EPF fixtures at 25,000 / 50,000 / 100,000 / 137,500 / 1,000,000 with the exact rupee split, plus a rounding test that `employee + employer` never exceeds `earnings × 0.20` by more than 1 cent. Gratuity fixtures cover 4.9 years (ineligible), exactly 5.0, 5.9 (still 5 completed years), 10, the `<15 employees` branch, and a zero wage.

**Acceptance criteria**
- [ ] 6+ worked examples per table, passing.
- [ ] The `<15 employees` and `<5 years` branches render as a plain-English explanation, not "LKR 0.00".
- [ ] Page has an explicit H2 answering "is EPF on basic salary or total earnings?" — the highest-volume misconception.
- [ ] "There is no employee ETF contribution" appears in the copy and in the workings.
- [ ] Both pages build statically and score ≥ 95 Lighthouse performance.

---

### [CALC-06] Gross ↔ net salary and employer payroll cost (composition)

**Estimate:** 3h · **Depends on:** CALC-04, CALC-05 · **Files:**
`src/lib/tools/calc/salary.ts` (new), `src/lib/tools/calc/__tests__/salary.test.ts` (new), `src/components/tools/widgets/salary-widget.tsx` (new), `src/components/tools/widgets/employer-cost-widget.tsx` (new), `src/lib/tools/registry.ts` (edit)

**Why**
"What's my take-home?" outranks every individual component query, and it is pure composition — no new rates, no new citations, just APIT + EPF layered in the right order. Net-to-gross is the interesting half: there is no closed form once you have piecewise bands plus a percentage deduction, so it is a bisection over the monotonic gross→net function. Monotonicity is already guaranteed by CALC-04's property test, which is what makes the search safe.

**Implementation**

```ts
// src/lib/tools/calc/salary.ts
import type { ApitRates } from "@/lib/tools/rates/apit";
import { computeApit } from "./apit";
import { computeEpf, type EpfRates } from "./epf";
import type { WorkingLine } from "./spec";
import { money, pct } from "./format";

export interface SalaryBreakdown {
  readonly grossCents: number;
  readonly employeeEpfCents: number;
  readonly apitCents: number;
  readonly netCents: number;
  readonly employerEpfCents: number;
  readonly etfCents: number;
  readonly gratuityAccrualCents: number;
  readonly employerTotalCents: number;
  readonly workings: readonly WorkingLine[];
}

export interface SalaryOptions {
  readonly apit: ApitRates;
  readonly epf: EpfRates;
  /** Gratuity accrues at ½ month per year = 1/24 of monthly gross. */
  readonly accrueGratuity: boolean;
}

export function grossToNet(grossCents: number, o: SalaryOptions): SalaryBreakdown {
  const epf = computeEpf(grossCents, o.epf);
  const apit = computeApit(grossCents, o.apit); // NOT reduced by employee EPF
  const netCents = grossCents - epf.employeeCents - apit.taxMonthlyCents;
  const gratuityAccrualCents = o.accrueGratuity ? Math.round(grossCents / 24) : 0;

  return {
    grossCents,
    employeeEpfCents: epf.employeeCents,
    apitCents: apit.taxMonthlyCents,
    netCents,
    employerEpfCents: epf.employerEpfCents,
    etfCents: epf.etfCents,
    gratuityAccrualCents,
    employerTotalCents:
      grossCents + epf.employerEpfCents + epf.etfCents + gratuityAccrualCents,
    workings: [
      { label: "Gross", expression: "", value: money(grossCents) },
      { label: "Less employee EPF", expression: `${money(grossCents)} × ${pct(o.epf.employeeRate)}`, value: money(-epf.employeeCents) },
      { label: "Less APIT", expression: "see APIT working below", value: money(-apit.taxMonthlyCents) },
      { label: "Net in hand", expression: "", value: money(netCents) },
      ...apit.workings,
      { label: "Employer EPF", expression: `${money(grossCents)} × ${pct(o.epf.employerRate)}`, value: money(epf.employerEpfCents) },
      { label: "Employer ETF", expression: `${money(grossCents)} × ${pct(o.epf.etfRate)}`, value: money(epf.etfCents) },
      ...(o.accrueGratuity
        ? [{ label: "Gratuity accrual", expression: `${money(grossCents)} ÷ 24`, value: money(gratuityAccrualCents), note: "½ month per year, spread monthly. Vests only at 5 years." }]
        : []),
    ],
  };
}

/**
 * Bisection: gross->net is monotonic non-decreasing (proved by the APIT
 * property test), so a 60-iteration halving converges well inside 1 cent for
 * any realistic salary.
 */
export function netToGross(targetNetCents: number, o: SalaryOptions): number {
  if (targetNetCents <= 0) return 0;
  let lo = targetNetCents;
  let hi = targetNetCents * 3 + 100_000;
  for (let i = 0; i < 60; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (grossToNet(mid, o).netCents < targetNetCents) lo = mid + 1;
    else hi = mid;
  }
  return hi;
}
```

Test the round trip as a property: for gross ∈ {50k … 2M step 10k}, `netToGross(grossToNet(g).netCents)` returns a gross whose net equals the original net (the inverse is only unique up to the cent granularity, so assert on net, not on gross).

**Acceptance criteria**
- [ ] Round-trip property test passes across 50,000–2,000,000 in 10,000 steps.
- [ ] `netToGross` converges in ≤ 60 iterations for a 5,000,000 target (asserted).
- [ ] Employer-cost page shows the gratuity accrual as an *option* with the 5-year vesting caveat visible, not baked in.
- [ ] The workings panel shows the full APIT band walk nested inside the salary walk — one click, no second page.
- [ ] Both pages link to `/tools/paye-calculator-sri-lanka` and `/tools/epf-etf-calculator` in Related tools; those pages link back.

---

### [CALC-07] GPA / CGPA with per-institution grade scales

**Estimate:** 3.5h · **Depends on:** CALC-01, CALC-02 · **Files:**
`src/lib/tools/rates/grade-scales.ts` (new), `src/lib/tools/calc/gpa.ts` (new), `src/lib/tools/calc/__tests__/gpa.test.ts` (new), `src/components/tools/widgets/gpa-widget.tsx` (new), `src/lib/tools/registry.ts` (edit)

**Why**
The naive version — one 4.0 scale, a grade dropdown — is wrong for half the audience, and wrongness here is *visible* to the student, which kills trust instantly. NSBM, SLIIT and NIBM award a GPA on a 4.0 scale; **IIT (University of Westminster) and APIIT (Staffordshire) do not award a GPA at all** — they compute a weighted level average and map it to a UK classification (First / 2:1 / 2:2 / Third). Modelling that as a discriminated union rather than fudging it into a GPA is what makes this page the one that ranks for "iit degree classification calculator" as well as "sliit gpa calculator". Grade scales reuse `RateTable` verbatim: a handbook edition is a citation, and handbooks change.

**Implementation**

```ts
// src/lib/tools/rates/grade-scales.ts
import type { RateTable } from "./types";
import { assertRateFamily } from "./validate-tables";

export interface GpaScheme {
  readonly kind: "gpa";
  readonly maxPoint: number; // 4.0
  readonly grades: readonly { readonly grade: string; readonly points: number }[];
  /** Classification thresholds on the GPA, best-first. */
  readonly classes: readonly { readonly label: string; readonly minGpa: number }[];
}

export interface UkClassificationScheme {
  readonly kind: "uk-classification";
  /** Weight of each level's average in the final mark, e.g. L5 30% / L6 70%. */
  readonly levelWeights: readonly { readonly level: string; readonly weight: number }[];
  readonly classes: readonly { readonly label: string; readonly minMark: number }[];
}

export interface InstitutionScale {
  readonly institution: string;
  readonly awardingBody: string;
  readonly scheme: GpaScheme | UkClassificationScheme;
}

const SLIIT_LIKE: GpaScheme = {
  kind: "gpa",
  maxPoint: 4.0,
  grades: [
    { grade: "A+", points: 4.0 }, { grade: "A", points: 4.0 }, { grade: "A-", points: 3.7 },
    { grade: "B+", points: 3.3 }, { grade: "B", points: 3.0 }, { grade: "B-", points: 2.7 },
    { grade: "C+", points: 2.3 }, { grade: "C", points: 2.0 }, { grade: "C-", points: 1.7 },
    { grade: "D+", points: 1.3 }, { grade: "D", points: 1.0 }, { grade: "E", points: 0.0 },
  ],
  classes: [
    { label: "First Class", minGpa: 3.7 },
    { label: "Second Class (Upper)", minGpa: 3.3 },
    { label: "Second Class (Lower)", minGpa: 3.0 },
    { label: "Pass", minGpa: 2.0 },
  ],
};

/** SEED — each scale must be checked against the current student handbook. */
export const GRADE_SCALES = assertRateFamily<readonly InstitutionScale[]>(
  "grade-scales",
  [
    {
      id: "grade-scales-2026",
      familyId: "grade-scales",
      label: "2026 handbooks",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      verifiedOn: "2026-08-09",
      verifiedBy: "Kavitha Kanchana",
      nextReviewOn: "2027-02-01", // new intake handbooks land around January
      citations: [
        { title: "SLIIT Student Handbook — grading and GPA", publisher: "Institution handbook", reference: "2026 edition", url: "https://www.sliit.lk/", publishedOn: "2026-01-01" },
        { title: "NSBM Green University — programme regulations", publisher: "Institution handbook", reference: "2026 edition", url: "https://www.nsbm.ac.lk/", publishedOn: "2026-01-01" },
        { title: "IIT / University of Westminster — assessment regulations", publisher: "Institution handbook", reference: "2026 edition", url: "https://www.iit.ac.lk/", publishedOn: "2026-01-01" },
        { title: "NIBM — academic regulations", publisher: "Institution handbook", reference: "2026 edition", url: "https://www.nibm.lk/", publishedOn: "2026-01-01" },
        { title: "APIIT / Staffordshire University — award regulations", publisher: "Institution handbook", reference: "2026 edition", url: "https://www.apiit.lk/", publishedOn: "2026-01-01" },
      ],
      data: [
        { institution: "SLIIT", awardingBody: "SLIIT", scheme: SLIIT_LIKE },
        { institution: "NSBM Green University", awardingBody: "UGC-affiliated", scheme: SLIIT_LIKE },
        { institution: "NIBM", awardingBody: "NIBM", scheme: SLIIT_LIKE },
        {
          institution: "IIT",
          awardingBody: "University of Westminster",
          scheme: {
            kind: "uk-classification",
            levelWeights: [
              { level: "Level 5", weight: 0.3 },
              { level: "Level 6", weight: 0.7 },
            ],
            classes: [
              { label: "First Class Honours", minMark: 70 },
              { label: "Upper Second (2:1)", minMark: 60 },
              { label: "Lower Second (2:2)", minMark: 50 },
              { label: "Third Class", minMark: 40 },
            ],
          },
        },
        {
          institution: "APIIT",
          awardingBody: "Staffordshire University",
          scheme: {
            kind: "uk-classification",
            levelWeights: [
              { level: "Level 5", weight: 0.25 },
              { level: "Level 6", weight: 0.75 },
            ],
            classes: [
              { label: "First Class Honours", minMark: 70 },
              { label: "Upper Second (2:1)", minMark: 60 },
              { label: "Lower Second (2:2)", minMark: 50 },
              { label: "Third Class", minMark: 40 },
            ],
          },
        },
      ],
    },
  ],
);
```

```ts
// src/lib/tools/calc/gpa.ts
import type { GpaScheme, UkClassificationScheme } from "@/lib/tools/rates/grade-scales";
import type { WorkingLine } from "./spec";
import { num } from "./format";

export interface Module { readonly name: string; readonly credits: number; readonly grade: string }

export interface GpaResult {
  readonly gpa: number;
  readonly totalCredits: number;
  readonly qualityPoints: number;
  readonly classification: string;
  readonly workings: readonly WorkingLine[];
}

export function computeGpa(modules: readonly Module[], s: GpaScheme): GpaResult {
  const points = new Map(s.grades.map((g) => [g.grade, g.points]));
  let totalCredits = 0;
  let qualityPoints = 0;
  const workings: WorkingLine[] = [];

  for (const m of modules) {
    const p = points.get(m.grade);
    if (p === undefined || m.credits <= 0) continue;
    totalCredits += m.credits;
    qualityPoints += m.credits * p;
    workings.push({
      label: m.name || "(unnamed module)",
      expression: `${num(m.credits)} credits × ${num(p)} (${m.grade})`,
      value: num(m.credits * p),
    });
  }

  const gpa = totalCredits === 0 ? 0 : qualityPoints / totalCredits;
  workings.push({
    label: "GPA",
    expression: `${num(qualityPoints)} quality points ÷ ${num(totalCredits)} credits`,
    value: gpa.toFixed(2),
  });

  return {
    gpa,
    totalCredits,
    qualityPoints,
    classification:
      s.classes.find((c) => gpa >= c.minGpa)?.label ?? "Below pass threshold",
    workings,
  };
}

export interface LevelAverage { readonly level: string; readonly average: number }

export function computeUkClassification(
  levels: readonly LevelAverage[],
  s: UkClassificationScheme,
): { mark: number; classification: string; workings: readonly WorkingLine[] } {
  const workings: WorkingLine[] = [];
  let mark = 0;
  for (const w of s.levelWeights) {
    const found = levels.find((l) => l.level === w.level);
    const avg = found?.average ?? 0;
    mark += avg * w.weight;
    workings.push({
      label: `${w.level} average`,
      expression: `${num(avg)} × ${num(w.weight * 100)}%`,
      value: num(avg * w.weight),
    });
  }
  workings.push({ label: "Weighted final mark", expression: "", value: mark.toFixed(2) });
  return {
    mark,
    classification:
      s.classes.find((c) => mark >= c.minMark)?.label ?? "Fail",
    workings,
  };
}
```

Widget uses a repeatable module row (add/remove), persisted in the URL as a compact `m=Name:3:A|Name2:4:B%2B` param — the one place the generic codec needs a custom field kind (`rows`), so `Field` gets a fourth branch.

**Acceptance criteria**
- [ ] Selecting IIT or APIIT swaps the form to level averages and reports a UK classification; the words "GPA" do not appear in that output.
- [ ] Institution selection is in the URL; a shared link reopens on the right scale.
- [ ] Fixture tests: for each GPA institution, a 5-module worked example with a hand-checked GPA to 2dp; for each UK institution, a 2-level example.
- [ ] Zero-credit and unknown-grade rows are skipped without producing `NaN`.
- [ ] Copy states plainly that the scale is read from the *current* handbook, with the edition and `verifiedOn` shown, and that students should confirm against their own programme regulations.

---

### [CALC-08] A/L Z-score and cutoff estimator

**Estimate:** 2.5h · **Depends on:** CALC-02 · **Files:**
`src/lib/tools/calc/zscore.ts` (new), `src/lib/tools/rates/al-cutoffs.ts` (new), `src/lib/tools/calc/__tests__/zscore.test.ts` (new), `src/components/tools/widgets/zscore-widget.tsx` (new), `src/lib/tools/registry.ts` (edit)

**Why**
Huge seasonal search volume and almost every existing tool lies about what it can do. The Department of Examinations standardises each subject against that year's national mean and standard deviation for that subject and medium; those parameters are not published as open data. So an honest tool takes the mean and SD as *inputs* (or from an archived table where I have a sourced figure), computes the standardised aggregate, and compares it against the **UGC-published district and all-island cutoff marks**, which genuinely are published. The page's competitive advantage is saying "this is an estimate and here is exactly why" instead of implying it reproduces the official result.

**Implementation**

```ts
// src/lib/tools/calc/zscore.ts
import type { WorkingLine } from "./spec";
import { num } from "./format";

export interface SubjectMark {
  readonly subject: string;
  readonly raw: number;   // 0-100
  readonly mean: number;  // national subject mean for that year and medium
  readonly sd: number;    // national subject standard deviation
}

export interface ZResult {
  readonly perSubject: readonly { subject: string; z: number }[];
  readonly aggregateZ: number;
  readonly workings: readonly WorkingLine[];
}

export function computeZ(subjects: readonly SubjectMark[]): ZResult {
  const usable = subjects.filter((s) => s.sd > 0);
  const workings: WorkingLine[] = [];
  const perSubject = usable.map((s) => {
    const z = (s.raw - s.mean) / s.sd;
    workings.push({
      label: s.subject || "Subject",
      expression: `(${num(s.raw)} − ${num(s.mean)}) ÷ ${num(s.sd)}`,
      value: z.toFixed(4),
    });
    return { subject: s.subject, z };
  });

  const aggregateZ =
    perSubject.length === 0
      ? 0
      : perSubject.reduce((a, b) => a + b.z, 0) / perSubject.length;

  workings.push({
    label: "Aggregate Z-score",
    expression: `sum of ${perSubject.length} subject Z-scores ÷ ${perSubject.length}`,
    value: aggregateZ.toFixed(4),
    note: "The Department of Examinations may apply additional standardisation steps. Treat this as an estimate.",
  });

  return { perSubject, aggregateZ, workings };
}

export interface Cutoff {
  readonly course: string;
  readonly university: string;
  readonly district: string;
  readonly z: number;
}

export function compareToCutoffs(
  aggregateZ: number,
  cutoffs: readonly Cutoff[],
  district: string,
): { qualifying: readonly Cutoff[]; nearMiss: readonly Cutoff[] } {
  const inDistrict = cutoffs.filter((c) => c.district === district);
  return {
    qualifying: inDistrict.filter((c) => aggregateZ >= c.z),
    nearMiss: inDistrict
      .filter((c) => aggregateZ < c.z && c.z - aggregateZ <= 0.2)
      .sort((a, b) => a.z - b.z),
  };
}
```

Cutoffs ship as a `RateTable<readonly Cutoff[]>` cited to the UGC Admissions Handbook edition. **Scope cut:** one intake year, the Physical Science and Biological Science streams, all 25 districts, engineering/medicine/IT courses only. Extending the dataset is a content task, not an engineering one, and is listed as deferred.

**Acceptance criteria**
- [ ] `sd = 0` and empty input produce a message, never `NaN` or `Infinity`.
- [ ] Fixture test: three subjects with known mean/SD produce a hand-checked aggregate Z to 4dp.
- [ ] Near-miss list shows courses within 0.2 Z and is sorted ascending.
- [ ] The page carries the estimator disclaimer **above** the widget, not buried below it.
- [ ] Cutoff table cites the UGC handbook edition and shows `verifiedOn`.

---

### [CALC-09] Attendance tracker — localStorage now, account later, ICS out

**Estimate:** 4h · **Depends on:** CALC-02 · **Files:**
`src/lib/tools/attendance/schema.ts` (new), `src/lib/tools/attendance/store.ts` (new), `src/lib/tools/attendance/math.ts` (new), `src/lib/tools/attendance/ics.ts` (new), `src/lib/tools/attendance/sync-contract.ts` (new), `src/lib/tools/attendance/__tests__/*.test.ts` (new), `src/components/tools/widgets/attendance-widget.tsx` (new), `src/lib/tools/registry.ts` (edit)

**Why**
The stateful one, and the only page here with repeat visitors — which is why it must not require an account on day one. The trap is shipping an unversioned blob into `localStorage` and then being unable to change the shape without wiping people's semester. So: a `schemaVersion` from commit one, a migration chain, and an export/import envelope. The Mongo path is *designed now, built later*: the sync contract is a typed file with no server, so when the account feature lands it cannot drift from what is already on thousands of devices. Per architecture rule 4, nothing here imports `@db`, and the tool page stays static.

**Implementation**

```ts
// src/lib/tools/attendance/schema.ts
export const ATTENDANCE_KEY = "kk.tools.attendance";
export const CURRENT_VERSION = 2;

export interface AttendanceSession {
  readonly id: string;
  /** ISO date, "2026-08-11". */
  readonly date: string;
  readonly status: "attended" | "missed" | "cancelled" | "excused";
}

export interface AttendanceModule {
  readonly id: string;
  readonly name: string;
  readonly requiredPercent: number;   // 80
  readonly plannedSessions: number;   // total for the semester
  readonly weekday: number;           // 0-6, for the ICS export
  readonly startTime: string;         // "08:30"
  readonly durationMinutes: number;
  readonly sessions: readonly AttendanceSession[];
}

export interface AttendanceDocV2 {
  readonly schemaVersion: 2;
  /** Stable per-device id; becomes the merge key when accounts arrive. */
  readonly deviceId: string;
  readonly updatedAt: string; // ISO timestamp
  readonly semesterStart: string;
  readonly semesterEnd: string;
  readonly modules: readonly AttendanceModule[];
}

interface AttendanceDocV1 {
  readonly schemaVersion?: 1;
  readonly modules?: readonly {
    name: string;
    required: number;
    attended: number;
    held: number;
  }[];
}

export function emptyDoc(now = new Date()): AttendanceDocV2 {
  return {
    schemaVersion: 2,
    deviceId: crypto.randomUUID(),
    updatedAt: now.toISOString(),
    semesterStart: now.toISOString().slice(0, 10),
    semesterEnd: now.toISOString().slice(0, 10),
    modules: [],
  };
}

/**
 * Migration chain. Every future version appends one step here; nothing is ever
 * removed, so a user who last opened the page two years ago still upgrades.
 */
export function migrate(raw: unknown): AttendanceDocV2 {
  if (typeof raw !== "object" || raw === null) return emptyDoc();
  const doc = raw as { schemaVersion?: number };

  if (doc.schemaVersion === 2) return raw as AttendanceDocV2;

  if (doc.schemaVersion === undefined || doc.schemaVersion === 1) {
    const v1 = raw as AttendanceDocV1;
    const base = emptyDoc();
    return {
      ...base,
      modules: (v1.modules ?? []).map((m, i) => ({
        id: `m${i}-${base.deviceId.slice(0, 8)}`,
        name: m.name,
        requiredPercent: m.required,
        plannedSessions: m.held,
        weekday: 1,
        startTime: "08:30",
        durationMinutes: 60,
        // v1 stored only counts, so synthesise sessions to preserve the ratio.
        sessions: Array.from({ length: m.held }, (_, k) => ({
          id: `s${i}-${k}`,
          date: base.semesterStart,
          status: k < m.attended ? ("attended" as const) : ("missed" as const),
        })),
      })),
    };
  }

  // Newer schema than this build understands: don't destroy it, start fresh
  // and keep the original under a backup key (handled in store.ts).
  return emptyDoc();
}
```

```ts
// src/lib/tools/attendance/store.ts
import {
  ATTENDANCE_KEY,
  CURRENT_VERSION,
  emptyDoc,
  migrate,
  type AttendanceDocV2,
} from "./schema";

export function loadDoc(): AttendanceDocV2 {
  if (typeof window === "undefined") return emptyDoc();
  try {
    const raw = window.localStorage.getItem(ATTENDANCE_KEY);
    if (!raw) return emptyDoc();
    const parsed: unknown = JSON.parse(raw);
    const version = (parsed as { schemaVersion?: number }).schemaVersion ?? 1;
    if (version > CURRENT_VERSION) {
      window.localStorage.setItem(`${ATTENDANCE_KEY}.backup.v${version}`, raw);
    }
    const migrated = migrate(parsed);
    if (version !== CURRENT_VERSION) saveDoc(migrated);
    return migrated;
  } catch {
    return emptyDoc();
  }
}

export function saveDoc(doc: AttendanceDocV2): void {
  if (typeof window === "undefined") return;
  const next = { ...doc, updatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode: fail silently, the in-memory state still works.
  }
}

/** Portable envelope — the same shape the future sync endpoint accepts. */
export function exportDoc(doc: AttendanceDocV2): string {
  return JSON.stringify({ kind: "kk.attendance.export", doc }, null, 2);
}

export function importDoc(json: string): AttendanceDocV2 | null {
  try {
    const parsed = JSON.parse(json) as { kind?: string; doc?: unknown };
    if (parsed.kind !== "kk.attendance.export") return null;
    return migrate(parsed.doc);
  } catch {
    return null;
  }
}
```

```ts
// src/lib/tools/attendance/sync-contract.ts
/**
 * Designed now, implemented in a later sprint. Freezing the contract here is
 * what guarantees that when accounts land, devices already carrying v2 docs
 * upgrade rather than lose data.
 *
 * Migration path, in order:
 *  1. Today: localStorage only. deviceId is generated and never leaves the device.
 *  2. Sign-in ships: the client POSTs its whole local doc once, with
 *     lastSyncedAt = null. The server stores it under (userId, deviceId).
 *  3. Server merges per module id, last-write-wins on updatedAt, and returns
 *     the merged doc. The client writes the merged doc straight back to
 *     localStorage, which stays the source of truth for rendering. An
 *     anonymous user who never signs in is completely unaffected.
 *  4. Conflicts on the same module id from two devices keep the higher
 *     session count rather than the newer timestamp — losing attended
 *     sessions is worse than keeping a stale module name.
 */
import type { AttendanceDocV2 } from "./schema";

export interface SyncRequest {
  readonly doc: AttendanceDocV2;
  readonly lastSyncedAt: string | null;
  /** Idempotency key so a retried POST cannot double-apply. */
  readonly clientMutationId: string;
}

export interface SyncResponse {
  readonly doc: AttendanceDocV2;
  readonly serverUpdatedAt: string;
  readonly conflicts: readonly { moduleId: string; resolution: "local" | "remote" | "merged" }[];
}

export const SYNC_ENDPOINT = "/api/tools/attendance/sync" as const;
```

```ts
// src/lib/tools/attendance/math.ts
import type { AttendanceModule } from "./schema";

export interface AttendanceStatus {
  readonly attended: number;
  readonly held: number;          // excludes cancelled
  readonly percent: number;
  readonly meetsRequirement: boolean;
  /** How many of the remaining planned sessions you can still miss. */
  readonly canStillMiss: number;
  /** Consecutive sessions you must now attend to get back to the threshold. */
  readonly mustAttendConsecutively: number;
}

export function status(m: AttendanceModule): AttendanceStatus {
  const counted = m.sessions.filter((s) => s.status !== "cancelled");
  const held = counted.length;
  const attended = counted.filter(
    (s) => s.status === "attended" || s.status === "excused",
  ).length;
  const p = m.requiredPercent / 100;
  const percent = held === 0 ? 0 : (attended / held) * 100;

  // Total counted sessions by end of semester, never fewer than already held.
  const total = Math.max(m.plannedSessions, held);
  const maxMissesAllowed = Math.floor(total * (1 - p));
  const missedSoFar = held - attended;

  // Smallest k with (attended + k) / (held + k) >= p
  const mustAttend =
    percent >= m.requiredPercent
      ? 0
      : Math.max(0, Math.ceil((p * held - attended) / (1 - p)));

  return {
    attended,
    held,
    percent,
    meetsRequirement: percent >= m.requiredPercent,
    canStillMiss: Math.max(0, maxMissesAllowed - missedSoFar),
    mustAttendConsecutively: mustAttend,
  };
}
```

```ts
// src/lib/tools/attendance/ics.ts
import type { AttendanceDocV2, AttendanceModule } from "./schema";

const CRLF = "\r\n";

/** RFC 5545 §3.1: fold at 75 octets. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  while (start < line.length) {
    const chunk = line.slice(start, start + (start === 0 ? 74 : 73));
    out.push(start === 0 ? chunk : ` ${chunk}`);
    start += chunk.length;
  }
  return out.join(CRLF);
}

const esc = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const stamp = (d: Date): string =>
  `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

function firstOccurrence(semesterStart: string, weekday: number, time: string): string {
  const [h, min] = time.split(":").map(Number);
  const d = new Date(`${semesterStart}T00:00:00`);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  d.setHours(h, min, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function endOf(startLocal: string, minutes: number): string {
  const y = +startLocal.slice(0, 4);
  const mo = +startLocal.slice(4, 6) - 1;
  const da = +startLocal.slice(6, 8);
  const h = +startLocal.slice(9, 11);
  const mi = +startLocal.slice(11, 13);
  const d = new Date(y, mo, da, h, mi + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function vevent(m: AttendanceModule, doc: AttendanceDocV2, now: Date): string[] {
  const dtStart = firstOccurrence(doc.semesterStart, m.weekday, m.startTime);
  const until = `${doc.semesterEnd.replace(/-/g, "")}T235900Z`;
  return [
    "BEGIN:VEVENT",
    fold(`UID:${m.id}.${doc.deviceId}@kavithakanchana.me`),
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;TZID=Asia/Colombo:${dtStart}`,
    `DTEND;TZID=Asia/Colombo:${endOf(dtStart, m.durationMinutes)}`,
    `RRULE:FREQ=WEEKLY;UNTIL=${until}`,
    fold(`SUMMARY:${esc(m.name)}`),
    fold(`DESCRIPTION:${esc(`Attendance requirement: ${m.requiredPercent}%`)}`),
    "END:VEVENT",
  ];
}

export function buildIcs(doc: AttendanceDocV2, now = new Date()): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//kavithakanchana.me//attendance-tracker//EN",
    "CALSCALE:GREGORIAN",
    ...doc.modules.flatMap((m) => vevent(m, doc, now)),
    "END:VCALENDAR",
    "",
  ].join(CRLF);
}
```

**Acceptance criteria**
- [ ] A v1 blob written by hand into `localStorage` migrates to v2 on load with attended/held ratios preserved (unit test on `migrate`, not just manual).
- [ ] A doc with `schemaVersion: 99` is preserved under a backup key and does not crash the page.
- [ ] `status()` tests cover: 0 held, all cancelled, exactly at threshold, 1 below threshold, and `mustAttendConsecutively` verified by simulation (attend k sessions and re-check).
- [ ] Exported `.ics` imports cleanly into Google Calendar **and** Apple Calendar, with weekly recurrence stopping at semester end.
- [ ] ICS output uses CRLF line endings and no line exceeds 75 octets (asserted in a test).
- [ ] Export → clear storage → import restores identical state.
- [ ] `sync-contract.ts` compiles, is imported nowhere at runtime, and documents the four-step migration path.
- [ ] Page still builds as a static route; `grep -r "@db" src/components/tools src/lib/tools` returns nothing.

---

### [CALC-10] NIC decoder and VAT/SSCL stacking

**Estimate:** 3h · **Depends on:** CALC-01, CALC-02 · **Files:**
`src/lib/tools/calc/nic.ts` (new), `src/lib/tools/rates/vat.ts` (new), `src/lib/tools/calc/vat.ts` (new), tests + two widgets, `src/lib/tools/registry.ts` (edit)

**Why**
Two small, purely deterministic tools that cost almost nothing once the shell exists.

The NIC one carries a real integrity decision. Every "NIC validator" on the web claims to verify a check digit; the Department for Registration of Persons has never published the algorithm, and the circulating implementations disagree with each other. Shipping a folklore checksum means telling real people their real ID is invalid. So: decode structure, day-of-year, gender and date of birth — all of which *are* documented and genuinely catch typos — and state plainly that the check digit is not verifiable. That refusal is the page's differentiator, and it is the answer to the query "is my NIC number valid" better than a wrong yes/no.

The VAT one exists because the **order of stacking is the thing people get wrong**: SSCL is levied on liable turnover first, and VAT is then charged on a base that already includes SSCL. That compounding is why 2.5% + 18% is not 20.5%.

**Implementation**

```ts
// src/lib/tools/calc/nic.ts
export type NicFormat = "old-9" | "new-12";

export interface NicDecoded {
  readonly valid: boolean;
  readonly format: NicFormat | null;
  readonly birthYear: number | null;
  readonly dayOfYear: number | null;
  readonly dateOfBirth: string | null;  // ISO
  readonly gender: "male" | "female" | null;
  readonly serial: string | null;
  readonly checkDigit: string | null;
  /**
   * The DRP has not published the check-digit algorithm. We deliberately do
   * not guess: a false "invalid" on a real ID is far worse than declining to
   * answer. Structural checks below do catch the common typos.
   */
  readonly checkDigitVerified: false;
  readonly issues: readonly string[];
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Day-of-year -> ISO date. SL numbering always reserves day 60 for 29 Feb. */
function dayToDate(year: number, day: number): string | null {
  const lengths = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Non-leap years still skip 60, so subtract one for days past February.
  let d = day;
  if (!isLeap(year) && d > 59) d -= 1;
  if (d < 1) return null;
  for (let m = 0; m < 12; m++) {
    if (d <= lengths[m]) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${year}-${pad(m + 1)}-${pad(d)}`;
    }
    d -= lengths[m];
  }
  return null;
}

const fail = (issues: string[]): NicDecoded => ({
  valid: false, format: null, birthYear: null, dayOfYear: null, dateOfBirth: null,
  gender: null, serial: null, checkDigit: null, checkDigitVerified: false, issues,
});

export function decodeNic(input: string): NicDecoded {
  const raw = input.trim().toUpperCase().replace(/\s/g, "");

  let format: NicFormat;
  let year: number;
  let dayField: number;
  let serial: string;
  let checkDigit: string;

  if (/^\d{9}[VX]$/.test(raw)) {
    format = "old-9";
    year = 1900 + Number(raw.slice(0, 2));
    dayField = Number(raw.slice(2, 5));
    serial = raw.slice(5, 8);
    checkDigit = raw.slice(8, 9);
  } else if (/^\d{12}$/.test(raw)) {
    format = "new-12";
    year = Number(raw.slice(0, 4));
    dayField = Number(raw.slice(4, 7));
    serial = raw.slice(7, 11);
    checkDigit = raw.slice(11, 12);
  } else {
    return fail([
      "Not a recognised NIC. Expected 9 digits followed by V or X (old format), or 12 digits (new format).",
    ]);
  }

  const issues: string[] = [];
  const female = dayField > 500;
  const day = female ? dayField - 500 : dayField;

  if (day < 1 || day > 366) {
    issues.push(
      `Day-of-year field is ${dayField}, which is outside the valid ranges (1–366 for males, 501–866 for females).`,
    );
  }
  if (day === 366 && !isLeap(year)) {
    issues.push(`${year} is not a leap year, so day 366 cannot exist.`);
  }
  if (format === "new-12" && (year < 1900 || year > new Date().getFullYear())) {
    issues.push(`Birth year ${year} is implausible.`);
  }

  const dateOfBirth = issues.length === 0 ? dayToDate(year, day) : null;

  return {
    valid: issues.length === 0,
    format,
    birthYear: year,
    dayOfYear: day,
    dateOfBirth,
    gender: female ? "female" : "male",
    serial,
    checkDigit,
    checkDigitVerified: false,
    issues,
  };
}
```

```ts
// src/lib/tools/calc/vat.ts
import type { WorkingLine } from "./spec";
import { money, pct } from "./format";

export interface IndirectTaxRates {
  readonly vatRate: number;   // 0.18
  readonly ssclRate: number;  // 0.025
}

export interface StackResult {
  readonly baseCents: number;
  readonly ssclCents: number;
  readonly vatBaseCents: number;
  readonly vatCents: number;
  readonly totalCents: number;
  readonly effectiveRate: number;
  readonly workings: readonly WorkingLine[];
}

/** Order matters: SSCL first, then VAT on (base + SSCL). */
export function stackForward(
  baseCents: number,
  r: IndirectTaxRates,
  ssclApplies: boolean,
): StackResult {
  const ssclCents = ssclApplies ? Math.round(baseCents * r.ssclRate) : 0;
  const vatBaseCents = baseCents + ssclCents;
  const vatCents = Math.round(vatBaseCents * r.vatRate);
  const totalCents = vatBaseCents + vatCents;
  return {
    baseCents, ssclCents, vatBaseCents, vatCents, totalCents,
    effectiveRate: baseCents === 0 ? 0 : (totalCents - baseCents) / baseCents,
    workings: [
      { label: "Price before tax", expression: "", value: money(baseCents) },
      { label: "SSCL", expression: ssclApplies ? `${money(baseCents)} × ${pct(r.ssclRate)}` : "not liable", value: money(ssclCents) },
      { label: "VAT base", expression: "price + SSCL", value: money(vatBaseCents), note: "VAT is charged on a base that already includes SSCL — this is why the rates do not simply add up." },
      { label: "VAT", expression: `${money(vatBaseCents)} × ${pct(r.vatRate)}`, value: money(vatCents) },
      { label: "Total payable", expression: "", value: money(totalCents) },
    ],
  };
}

/** Inclusive -> exclusive, inverting the same order. */
export function stackReverse(
  totalCents: number,
  r: IndirectTaxRates,
  ssclApplies: boolean,
): StackResult {
  const factor = (1 + (ssclApplies ? r.ssclRate : 0)) * (1 + r.vatRate);
  return stackForward(Math.round(totalCents / factor), r, ssclApplies);
}
```

**Acceptance criteria**
- [ ] NIC fixtures cover: valid old male, valid old female, valid new male, valid new female, day 366 in a leap year (valid), day 366 in a non-leap year (rejected with the reason), day 500 (rejected), 10-digit garbage (rejected), lowercase `v` (accepted).
- [ ] `dayToDate` round-trips: for every day 1–365 of 2025 and 1–366 of 2024, the derived date's own day-of-year matches.
- [ ] The page says in plain words that the check digit is not verified and why; the UI never displays "invalid NIC" on the basis of a checksum.
- [ ] VAT: `stackReverse(stackForward(x).totalCents)` returns a base within 1 cent of `x`, tested across 1,000–10,000,000.
- [ ] The page shows the worked 100 → 102.50 → 120.95 example and states the effective combined rate explicitly.

---

### [CALC-11] Page content, disclaimers, JSON-LD, and the maintenance calendar

**Estimate:** 3h · **Depends on:** all of the above · **Files:**
`src/lib/tools/registry.ts` (edit — copy for 10 tools), `src/components/tools/disclaimer.tsx` (new), `src/components/tools/tool-jsonld.tsx` (edit), `scripts/rates-audit.ts` (new), `.github/workflows/rates-audit.yml` (new)

**Why**
The calculators are the reason people arrive; the prose is the reason Google decides the page deserves to exist. Two additional jobs live here: disclaimers that are *specific* enough to be useful (a generic "consult a professional" footer is a legal reflex, not information), and an automated tripwire so a stale tax bracket cannot sit unnoticed for a year.

**Content — what the 400–700 words actually say.** Every page follows the locked template. The intro (40–70 words, above the widget) states what the tool computes, which authority's numbers it uses, and the date they were verified. Then:

- **How it works** (~150 words) — the actual method, in the order the widget applies it. For APIT: annualise, subtract relief, walk the bands, divide by twelve. This paragraph is where "how is PAYE calculated in Sri Lanka" and "APIT calculation formula" land, because it is the honest answer to them.
- **Edge cases and gotchas** (~180 words) — the differentiator, and one bullet per real misconception:
  - APIT: employee EPF is *not* deductible; bonuses and lump sums use a different IRD table; two employments mean primary/secondary rates; mid-year rate changes split the year.
  - EPF/ETF: contributions are on total earnings, not basic; there is no employee ETF share; the employer's 12% is not your taxable income.
  - Gratuity: 15-employee threshold, 5-year vesting, part years discarded, last-drawn wage not average.
  - GPA: repeat modules, credit weighting, and the fact that IIT and APIIT award classifications, not GPAs.
  - Attendance: cancelled sessions do not count toward "held"; medical excuses vary by faculty.
  - Z-score: the DoE's exact standardisation is not public; this is an estimate.
  - NIC: 500-offset for females; leap-day handling; the unpublished check digit.
  - VAT/SSCL: the stacking order and why 2.5 + 18 ≠ 20.5.
- **FAQ** (3–6, each 25–50 words) — this is where the long tail lands naturally, because these are literally the queries: *"How much PAYE do I pay on 300,000 a month?"*, *"Is EPF calculated on basic salary or gross?"*, *"How many classes can I miss with 80% attendance?"*, *"What GPA do I need for a first class at SLIIT?"*, *"How do I read my NIC number's date of birth?"*, *"What is my take-home salary in Sri Lanka?"* No keyword stuffing is required — answering the question in the question's own words is the whole technique.
- **Related tools** — the cluster's internal link graph: salary ↔ APIT ↔ EPF ↔ gratuity ↔ employer cost is a closed five-node loop; GPA ↔ attendance ↔ Z-score is a three-node student loop; NIC and VAT sit adjacent to the payroll loop.

**Disclaimers — specific, not boilerplate.**

```tsx
// src/components/tools/disclaimer.tsx
const TEXT = {
  tax: "This calculator applies the published rates shown above to the figures you enter. It does not know about your other employment, terminal benefits, tax credits already claimed, or a directive issued to your employer by the IRD. Your employer's payroll is the authority on what is actually deducted; if the two disagree, ask your payroll department which of these inputs differs. This is not tax advice.",
  labour:
    "Statutory minimums only. Your contract, collective agreement, or company policy may be more generous, and only your employer's records establish your service dates and last drawn wage.",
  academic:
    "Grade scales are read from the institution handbook cited above. Programme regulations override the general scale, and repeat or condoned modules may be weighted differently. Confirm with your academic office before relying on this for a progression or graduation decision.",
  estimate:
    "This is an estimate, not the official result. The Department of Examinations standardises each subject against parameters it does not publish, so a number computed here can differ from your released Z-score.",
  identity:
    "Structure, date of birth and gender are decoded from the documented number format. The check digit is not verified, because the algorithm has never been published by the Department for Registration of Persons — any tool that claims otherwise is guessing.",
} as const;

export type DisclaimerKind = keyof typeof TEXT;

export function Disclaimer({ kind }: { kind: DisclaimerKind }) {
  return (
    <aside className="mt-8 rounded-lg border-l-4 border-l-muted-foreground/40 bg-muted/30 p-4 text-sm text-muted-foreground">
      <p className="mb-1 font-medium text-foreground">What this does and does not tell you</p>
      <p>{TEXT[kind]}</p>
    </aside>
  );
}
```

**JSON-LD** — the existing @graph gains `dateModified` from `verifiedOn` and a `citation` array, still `@id`-referencing `#person` and `#website`:

```ts
const softwareApplication = {
  "@type": "SoftwareApplication",
  "@id": `${DATA.url}/tools/${tool.slug}#app`,
  name: tool.h1,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any (runs in the browser)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "LKR" },
  dateModified: table.verifiedOn,
  author: { "@id": `${DATA.url}/#person` },
  isPartOf: { "@id": `${DATA.url}/#website` },
  citation: table.citations.map((c) => ({
    "@type": "CreativeWork",
    name: c.title,
    url: c.url,
    datePublished: c.publishedOn,
  })),
};
```

**Maintenance calendar.**

| Table family | Changes when | Typical date | Review cadence | Blast radius |
|---|---|---|---|---|
| APIT / PAYE bands | Budget + Inland Revenue (Amendment) Act | Budget ~Nov, effective 1 Apr or 1 Jan | 15 Nov, 15 Mar, then monthly until confirmed | APIT, salary, employer cost |
| VAT rate & threshold | Gazette, any time (has moved mid-year) | unpredictable | monthly | VAT/SSCL |
| SSCL rate & liable turnover | Finance Act amendment | with the Budget | 15 Nov | VAT/SSCL |
| EPF / ETF rates | Statutory; rarely changes | — | annually, 1 Feb | EPF, salary, employer cost |
| Gratuity formula & thresholds | Statutory; rarely changes | — | annually, 1 Feb | gratuity, employer cost |
| University grade scales | New intake handbooks | ~Jan | annually, 1 Feb | GPA |
| A/L subject statistics | After results release | ~Dec–Jan | annually, 15 Jan | Z-score |
| UGC cutoff marks | Admissions handbook | ~Sep–Oct | annually, 1 Oct | Z-score |

The workflow that catches them:

```ts
// scripts/rates-audit.ts — run by GitHub Actions weekly
import { RATE_FAMILIES } from "../src/lib/tools/rates";
import { daysUntilReview } from "../src/lib/tools/rates/resolve";

const WARN_WINDOW_DAYS = 30;
const rows: string[] = [];

for (const [familyId, tables] of Object.entries(RATE_FAMILIES)) {
  for (const t of tables) {
    const days = daysUntilReview(t);
    if (days <= WARN_WINDOW_DAYS) {
      rows.push(
        `- [ ] **${familyId}/${t.id}** — review due ${t.nextReviewOn} (${days} day${days === 1 ? "" : "s"}${days < 0 ? " OVERDUE" : ""}). Last verified ${t.verifiedOn} by ${t.verifiedBy}. Source: ${t.citations[0].url}`,
      );
    }
  }
}

if (rows.length === 0) {
  console.log("All rate tables are within their review window.");
  process.exit(0);
}

console.log(`## Rate tables needing review\n\n${rows.join("\n")}`);
process.exit(1); // non-zero -> the Action opens/updates the tracking issue
```

The Action runs Mondays, and on a non-zero exit uses `gh issue create --title "Rate review due" --body-file -` (or comments on the existing open issue). It also hits the Vercel deploy hook weekly regardless, so the build-time `verifiedOn` rendering and the daysUntilReview banner are never more than seven days stale — which is how a fully static page stays honest about dates without a single function invocation.

**Acceptance criteria**
- [ ] All ten pages are 400–700 words, verified by a word-count script over the registry copy.
- [ ] Every page has 3–6 FAQs; `validate.ts` already enforces this and the build passes.
- [ ] Each of the five disclaimer kinds appears on at least one page; no page uses "consult a professional" as its only caveat.
- [ ] JSON-LD validates in Google's Rich Results Test with SoftwareApplication + FAQPage + BreadcrumbList all detected, and `#person` resolving.
- [ ] `pnpm tsx scripts/rates-audit.ts` exits 0 today and exits 1 with a readable list when a `nextReviewOn` is moved into the past.
- [ ] The weekly Action is green and has run at least once before the sprint closes.
- [ ] Internal links form the two closed loops described above (checked by a script asserting every `related` slug is reciprocal).

---

### Deferred from this sprint

Cut to hold the 39h budget. Each is a standalone follow-up, not a half-built thing left in the tree:

- **Account-backed attendance sync.** The contract is frozen in `sync-contract.ts`; the Mongoose model and `/api/tools/attendance/sync` route handler are not built. localStorage users are unaffected when it lands.
- **Withholding tax (WHT/AIT) and stamp duty calculators.** Would push the cluster to twelve tools and both need their own citation research.
- **Full UGC cutoff dataset.** Shipping Physical Science + Biological Science only; Commerce, Arts, and Technology streams are a data-entry task for a later pass.
- **Sinhala and Tamil copy.** High value for this exact audience, but it is a routing + i18n decision that deserves its own sprint, not a bolt-on.
- **PDF export of a salary breakdown.** Wants a print stylesheet at minimum; nice-to-have, not load-bearing.
- **`/tools/category/finance` and `/tools/category/education` hub copy.** The route exists from Sprint 1; writing genuinely useful category prose is a content sprint.

---

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A seed rate is wrong and someone under-withholds tax | Medium | **Severe** — real financial harm | Six worked examples per table lifted from IRD Table 01, run inside `pnpm build`; `verifiedOn` set only after a human opens the cited PDF; the archived PDF lives in `docs/sources/` so provenance survives link rot |
| Budget changes APIT bands mid-sprint | Medium | Medium | The dated-table pattern is designed for exactly this: add a table, set `effectiveTo` on the old one, give it an `archiveSlug`, and the archive URL generates itself. Cost of a rate change is ~30 minutes, not a rewrite |
| IRD / UGC URLs rot, killing every citation | High over 12 months | Medium | `archivePath` to a local PDF copy on every citation; the provenance test asserts https URLs; the weekly audit is where a dead link gets noticed |
| Registry hits the hard cap of 30 | Medium | Low | Archive years are **not** registry entries by design. If the tenth entry would exceed 30, the cap edit is a separate PR with a written justification — that is the anti-content-farm guard working, not a bug |
| `useSearchParams` deopts the static pages | Low (mitigated by design) | Medium | The shell never calls it; state is hydrated from `window.location.search` in a mount effect. Acceptance criterion asserts every tool route appears as ● in `next build` output |
| Institution grade scales are wrong or out of date | Medium | Medium — visible to the student, kills trust | Every scale carries its handbook edition and `verifiedOn` on the page; annual 1 Feb review; copy explicitly tells students programme regulations override |
| Someone treats the Z-score estimator as official | High | Medium | Disclaimer sits **above** the widget, not below; the output is labelled "estimated aggregate Z", never "your Z-score" |
| Ten new client widgets bloat the bundle | Medium | Low | Each widget is a leaf client component under a server page; no chart library, no date library — `Intl` only. Budget: ≤ 15 kB gzipped JS added per tool page, checked in the DoD |
| localStorage schema change wipes a user's semester | Low | High for that user | Versioned from commit one, append-only migration chain, unknown-future-version blobs preserved under a backup key, export/import as a manual escape hatch |

---

### Definition of Done

- [ ] `pnpm build` passes with **0 tsc errors** and **0 eslint errors** (`ignoreBuildErrors` remains removed, per Sprint 0).
- [ ] `pnpm test` passes; ≥ 6 worked examples per rate table; provenance gate green.
- [ ] `next build` output shows every `/tools/*` route as ● (SSG). Zero `ƒ` routes added by this sprint.
- [ ] `grep -rn "@db" src/lib/tools src/components/tools src/app/\(tools\)` returns nothing.
- [ ] Every rate table has: ≥ 1 resolving https citation, a local archive PDF, a `verifiedOn` set by a human who opened the source, and a `nextReviewOn`.
- [ ] Lighthouse mobile on three sampled tool pages: performance ≥ 95, accessibility 100, best practices ≥ 95, SEO 100, CLS 0. Added JS ≤ 15 kB gzipped per page.
- [ ] All ten pages 400–700 words with 3–6 FAQs; JSON-LD validates with `#person` resolving.
- [ ] Deployed to production on `kavithakanchana.me`; all ten canonical URLs plus archives return 200 and appear in `sitemap.xml`.
- [ ] All ten URLs submitted to Google Search Console; **indexation, not ranking, is the gate** — the sprint is not "successful" until pages are indexed, which is measured in the next review, not at merge.
- [ ] Weekly rates-audit Action has run green at least once.
- [ ] Attendance export → clear storage → import verified by hand on a real device.

---

### Demo script

1. `pnpm build` — confirm 0 errors, and read the route table: `/tools/paye-calculator-sri-lanka`, `/tools/paye-calculator-sri-lanka/2023-25`, and the other nine all marked ●.
2. Open `/tools/paye-calculator-sri-lanka`, enter **300,000**, confirm the headline reads **LKR 18,500.00**, expand *Show the working*, and check the band walk sums to the headline by hand.
3. Click **Copy shareable link**, paste it into a private window, confirm it reopens on 300,000 with the same result and no hydration warning in the console.
4. Change the URL to `/tools/paye-calculator-sri-lanka/2023-25`, enter 300,000, confirm **LKR 35,000.00**, the amber superseded banner, and the link back to the current page.
5. Open `/tools/salary-calculator-sri-lanka`, switch to net→gross, enter a target net, confirm the returned gross round-trips to that net, and that the nested APIT working is visible in one click.
6. Open `/tools/attendance-calculator`, add two modules, mark some sessions, confirm "you can still miss N" is arithmetically right; export the `.ics` and import it into Google Calendar; confirm weekly recurrence ends at semester end.
7. In DevTools, overwrite `kk.tools.attendance` with a hand-written v1 blob, reload, confirm the modules survive with their attended/held ratios intact.
8. Open `/tools/nic-number-decoder`, enter an old-format female NIC, confirm the decoded DOB and gender; enter a 366-day NIC in a non-leap year, confirm the specific rejection message — and confirm nothing anywhere claims the check digit was verified.
9. Edit any `nextReviewOn` to yesterday, run `pnpm tsx scripts/rates-audit.ts`, confirm exit code 1 and a readable overdue line. Revert.