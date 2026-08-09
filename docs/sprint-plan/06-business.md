> Part of [SPRINT-PLAN.md](SPRINT-PLAN.md). **Part II (Amendments) overrides anything below it.**

## Sprint 6 — Business cluster: ROAS, ROI, churn + the stateful cohort tracker

**Sprint goal** — Ship the ten business calculators, with the churn/cohort retention tracker as the flagship: the only tool in the platform allowed to write to Mongo, and the only one whose output is a shareable artifact rather than a number.

**Duration** — 2 weeks (30–40h). **Depends on** — Sprint 0 (route groups, strict build) ✅ done; Sprint 1 (`src/lib/tools/registry.ts`, `validate.ts`, `/tools` hub, `/tools/[slug]` static template with `dynamicParams = false`, JSON-LD @graph, `src/lib/tools/widgets.ts` slug→dynamic-import map); Sprint 2 (shared widget shell `<ToolShell>`, copy/reset/export helpers, `track()` analytics helper).

---

### Definition of Ready

- [ ] `src/lib/tools/registry.ts` exists, exports `TOOLS: Tool[]`, and `validate.ts` runs at module scope and throws on bad data.
- [ ] `/tools/[slug]/page.tsx` renders the locked template order (breadcrumb → H1 → meta row → intro → widget → how it works → gotchas → FAQ → related → author card → JSON-LD) and resolves widgets through `src/lib/tools/widgets.ts`.
- [ ] `TOOLS.length` is known. **Sprint 6 adds 10 entries.** Confirm `TOOLS.length + 10 <= 30` before starting, or cut from the supporting set first. This is a hard build failure, not a warning.
- [ ] `MONGODB_URI` is set on Vercel for preview and production (already true — blog uses it).
- [ ] Two new env vars added to Vercel *before* the first deploy of BUSI-07: `TOOLS_IP_SALT` (32 random bytes, base64) and `TOOLS_BOARD_TTL_DAYS` (default `180`).
- [ ] `pnpm build` is green on `tools-platform-phase0` with 0 tsc errors.
- [ ] Decision recorded: board pages are **query-param state on the static page** (`/tools/cohort-retention-calculator?b=SLUG`), not a new dynamic route. Nothing in this sprint introduces a `generateStaticParams`-less page segment.

---

### Tickets

---

### [BUSI-01] Shared finance primitives: parsing, formatting, safe arithmetic
**Estimate:** 2h · **Depends on:** Sprint 2 · **Files:** `src/lib/tools/business/format.ts`, `src/lib/tools/business/format.test.ts`

**Why** — Every tool in this cluster reads user-typed money and percentages. If each widget hand-rolls `parseFloat`, you get ten different behaviors for `"1,200"`, `"$1.2k"`, `"12%"`, and `""`. Centralize it once, test it once, and make every downstream function take `number` and return `number | null` so "undefined because the user hasn't typed a denominator yet" is representable instead of `NaN` leaking into the DOM.

**Implementation**

```ts
// src/lib/tools/business/format.ts

/** Parses user-typed money/quantity. Tolerates separators and currency glyphs. */
export function parseNumber(raw: string): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .trim()
    .replace(/[\s,_'\u00A0]/g, "")
    .replace(/[$£€¥₹₨]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parses a percentage. "12", "12%", "0.12%" -> 0.12, 0.12, 0.0012. Never divides twice. */
export function parsePercent(raw: string): number | null {
  const n = parseNumber(raw.replace(/%/g, ""));
  return n === null ? null : n / 100;
}

/** Division that refuses to produce Infinity or NaN. */
export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  const r = numerator / denominator;
  return Number.isFinite(r) ? r : null;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

const currencyCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(
  value: number | null,
  currency = "USD",
  maximumFractionDigits = 2,
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const key = `${currency}:${maximumFractionDigits}`;
  let fmt = currencyCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits,
    });
    currencyCache.set(key, fmt);
  }
  return fmt.format(value);
}

export function formatPercent(value: number | null, dp = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${round(value * 100, dp).toFixed(dp)}%`;
}

/** 2.4166 -> "2.42x". For ROAS, LTV:CAC, quick ratio. */
export function formatMultiple(value: number | null, dp = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${round(value, dp).toFixed(dp)}x`;
}

export function formatMonths(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "never";
  if (value < 1) return "< 1 month";
  return `${round(value, 1)} months`;
}
```

**Acceptance criteria**
- [ ] `parseNumber("1,234.50")` → `1234.5`; `parseNumber("$1,200")` → `1200`; `parseNumber("abc")` → `null`; `parseNumber("")` → `null`; `parseNumber("1.2.3")` → `null`.
- [ ] `parsePercent("12%")` and `parsePercent("12")` both → `0.12`.
- [ ] `safeDiv(1, 0)` → `null`, never `Infinity`.
- [ ] `formatCurrency(null)` → `"—"` (em dash), never `"$NaN"`.
- [ ] Test file covers all of the above; `pnpm test` green.
- [ ] Module has **zero** imports from `@db` or from React.

---

### [BUSI-02] ROAS / CAC / break-even ROAS calculator
**Estimate:** 4h · **Depends on:** BUSI-01 · **Files:** `src/lib/tools/business/roas.ts`, `src/lib/tools/business/roas.test.ts`, `src/components/tools/business/RoasWidget.tsx`, registry entries for `roas-calculator` and `cac-calculator`

**Why** — "ROAS calculator" is a head term dominated by pages that compute `revenue / spend` and stop. The differentiator is the second question every performance marketer actually has: *given my margin, what ROAS do I need to break even, and what is the most I can pay for a customer?* That's three formulas and one honest warning (top-line ROAS is margin-blind), and it's what makes the page worth a link.

`cac-calculator` gets its own page because CAC has a genuine formula argument — blended CAC (all marketing spend ÷ all new customers) vs paid CAC (paid spend ÷ paid-attributed customers), and whether salaries and tooling count. Those give different numbers and people argue about it. Per the split rule in BUSI-09, that earns a page.

**Implementation**

```ts
// src/lib/tools/business/roas.ts
import { safeDiv, clamp } from "./format";

export interface RoasInput {
  adSpend: number;
  revenue: number;
  /** Gross margin as a fraction, 0..1. COGS excluded, ad spend NOT excluded. */
  grossMarginPct: number;
  newCustomers: number;
  averageOrderValue: number;
  /** Gross-margin lifetime value per customer. Already margin-adjusted. */
  marginLtv: number | null;
  /** Target LTV:CAC, conventionally 3. */
  targetLtvCacRatio: number;
  /** Contribution margin you want left AFTER ad spend, as a fraction of revenue. */
  targetContributionPct: number;
}

export interface RoasResult {
  roas: number | null;
  acos: number | null;
  poas: number | null;
  breakEvenRoas: number | null;
  targetRoas: number | null;
  cac: number | null;
  maxCpaSinglePurchase: number | null;
  maxCacFromLtv: number | null;
  ltvCacRatio: number | null;
  grossProfit: number | null;
  contributionAfterAds: number | null;
  verdict: "profitable" | "break-even" | "losing" | "unknown";
  notes: string[];
}

export function computeRoas(input: RoasInput): RoasResult {
  const notes: string[] = [];
  const gm = clamp(input.grossMarginPct, -1, 1);

  const roas = safeDiv(input.revenue, input.adSpend);
  const acos = safeDiv(input.adSpend, input.revenue);
  const grossProfit = Number.isFinite(input.revenue) ? input.revenue * gm : null;
  const poas = grossProfit === null ? null : safeDiv(grossProfit, input.adSpend);
  const contributionAfterAds =
    grossProfit === null ? null : grossProfit - input.adSpend;

  // Break-even ROAS: revenue where gross profit exactly covers ad spend.
  //   revenue * gm = adSpend  =>  revenue / adSpend = 1 / gm
  const breakEvenRoas = gm > 0 ? 1 / gm : null;
  if (gm <= 0) {
    notes.push(
      "Gross margin is zero or negative, so no amount of revenue covers ad spend. Break-even ROAS is undefined.",
    );
  }

  // Target ROAS: leave targetContributionPct of revenue after ad spend.
  //   gm - (1 / ROAS) >= target  =>  ROAS >= 1 / (gm - target)
  const headroom = gm - input.targetContributionPct;
  const targetRoas = headroom > 0 ? 1 / headroom : null;
  if (headroom <= 0 && gm > 0) {
    notes.push(
      `A ${(input.targetContributionPct * 100).toFixed(0)}% contribution target is unreachable at a ${(gm * 100).toFixed(0)}% gross margin — the target must be below the margin.`,
    );
  }

  const cac = safeDiv(input.adSpend, input.newCustomers);
  const maxCpaSinglePurchase = Number.isFinite(input.averageOrderValue)
    ? input.averageOrderValue * gm
    : null;
  const maxCacFromLtv =
    input.marginLtv === null || input.targetLtvCacRatio <= 0
      ? null
      : safeDiv(input.marginLtv, input.targetLtvCacRatio);
  const ltvCacRatio =
    input.marginLtv === null || cac === null ? null : safeDiv(input.marginLtv, cac);

  let verdict: RoasResult["verdict"] = "unknown";
  if (roas !== null && breakEvenRoas !== null) {
    const delta = roas - breakEvenRoas;
    verdict =
      Math.abs(delta) < breakEvenRoas * 0.02
        ? "break-even"
        : delta > 0
          ? "profitable"
          : "losing";
  }

  if (roas !== null && roas > 1 && verdict === "losing") {
    notes.push(
      "ROAS above 1.0x still loses money here: 1.0x only means revenue equals spend, and revenue is not profit.",
    );
  }
  if (cac !== null && maxCpaSinglePurchase !== null && cac > maxCpaSinglePurchase) {
    notes.push(
      "Your CAC exceeds the gross profit on a first order. This only works if customers buy again — use the LTV field.",
    );
  }

  return {
    roas, acos, poas, breakEvenRoas, targetRoas, cac,
    maxCpaSinglePurchase, maxCacFromLtv, ltvCacRatio,
    grossProfit, contributionAfterAds, verdict, notes,
  };
}

export type CacBasis = "paid" | "blended" | "fully-loaded";

export interface CacInput {
  paidAdSpend: number;
  otherMarketingSpend: number;
  salesAndMarketingSalaries: number;
  toolingSpend: number;
  customersFromPaid: number;
  totalNewCustomers: number;
}

export function computeCac(input: CacInput): Record<CacBasis, number | null> {
  return {
    paid: safeDiv(input.paidAdSpend, input.customersFromPaid),
    blended: safeDiv(
      input.paidAdSpend + input.otherMarketingSpend,
      input.totalNewCustomers,
    ),
    "fully-loaded": safeDiv(
      input.paidAdSpend +
        input.otherMarketingSpend +
        input.salesAndMarketingSalaries +
        input.toolingSpend,
      input.totalNewCustomers,
    ),
  };
}
```

The widget renders all three CAC bases side by side with a one-line definition under each, and the ROAS page renders `verdict` as a colored band above the numbers.

**Acceptance criteria**
- [ ] At 60% gross margin, `breakEvenRoas` is exactly `1.6667` (displays as `1.67x`).
- [ ] `computeRoas` with `grossMarginPct: 0` returns `breakEvenRoas: null` and a note, and the UI shows the note rather than `Infinity`.
- [ ] Entering `targetContributionPct` ≥ `grossMarginPct` produces a null `targetRoas` and the explanatory note.
- [ ] A case where `roas = 1.5` and `gm = 0.4` is labeled `"losing"` and shows the "ROAS above 1.0x still loses money" note.
- [ ] `computeCac` returns three distinct numbers for realistic inputs, each labeled with its definition in the UI.
- [ ] Both pages pass `validate.ts` (metaTitle ≤ 60, description 120–165, 3–6 FAQs, howItWorks and gotchas ≥ 120 words).
- [ ] Widget is `"use client"`, has no `@db` import, and the page still statically generates (`.next/server/app/tools/roas-calculator.html` exists after build).

---

### [BUSI-03] ROI calculator with URL-encoded shareable scenarios
**Estimate:** 4h · **Depends on:** BUSI-01 · **Files:** `src/lib/tools/business/roi.ts`, `src/lib/tools/business/url-state.ts`, `src/lib/tools/business/url-state.test.ts`, `src/components/tools/business/RoiWidget.tsx`, registry entry `roi-calculator`

**Why** — People want to send an ROI model to their boss. The naive answer is "add accounts and a database." The correct v1 answer is that this state is about 200 bytes, so **the URL is the database.** Zero backend, zero auth, zero retention policy, zero GDPR surface, works on a statically generated CDN page, and the share link *is* the record — it can't be orphaned by a TTL sweep or lost when a row is deleted.

Two decisions worth stating explicitly:

1. **State lives in `location.hash`, not the query string.** The fragment is never transmitted to the server, so nobody's revenue projections land in Vercel's request logs or an analytics referrer. It also means no crawlable URL variants and no cache fragmentation on the CDN.
2. **The size of the state decides the storage.** ROI scenarios: ~6 numbers × ≤6 scenarios → URL. Cohort boards (BUSI-07): a 24×24 triangle is 576 numbers plus movements → 8–20KB → Mongo. That's the whole rule; nothing else about "importance" enters into it.

The costs of URL state, honestly: practical length ceiling around 2000 characters (IE-era limit, but also where Slack/Twitter unfurls and some email clients start truncating); you cannot analyze what people modeled; the sender can't edit a link someone already has. All acceptable for v1. Account-backed persistence is deferred, and the encoder is versioned so a future migration to server-side storage can import old links.

**Implementation**

```ts
// src/lib/tools/business/roi.ts
import { safeDiv, round } from "./format";

export const SCENARIO_NUMERIC_FIELDS = [
  "initialCost",
  "recurringCostPerMonth",
  "monthlyBenefit",
  "oneOffBenefit",
  "horizonMonths",
  "annualDiscountPct",
] as const;

export type ScenarioNumericField = (typeof SCENARIO_NUMERIC_FIELDS)[number];

export type RoiScenario = Record<ScenarioNumericField, number> & { label: string };

export interface RoiResult {
  totalCost: number;
  totalBenefit: number;
  netBenefit: number;
  roi: number | null;
  annualizedRoi: number | null;
  paybackMonths: number | null;
  npv: number;
  monthlyIrr: number | null;
  annualIrr: number | null;
  cumulativeNet: number[];
}

/** Cash flows by month. Index 0 carries the up-front cost and any one-off benefit. */
export function cashflows(s: RoiScenario): number[] {
  const months = Math.max(1, Math.round(s.horizonMonths));
  const flows: number[] = new Array(months + 1).fill(0);
  flows[0] = -s.initialCost + s.oneOffBenefit;
  for (let m = 1; m <= months; m++) {
    flows[m] = s.monthlyBenefit - s.recurringCostPerMonth;
  }
  return flows;
}

export function computeRoi(s: RoiScenario): RoiResult {
  const months = Math.max(1, Math.round(s.horizonMonths));
  const flows = cashflows(s);

  const totalCost = s.initialCost + s.recurringCostPerMonth * months;
  const totalBenefit = s.oneOffBenefit + s.monthlyBenefit * months;
  const netBenefit = totalBenefit - totalCost;
  const roi = safeDiv(netBenefit, totalCost);

  const years = months / 12;
  const annualizedRoi =
    roi === null || 1 + roi <= 0 || years <= 0
      ? null
      : Math.pow(1 + roi, 1 / years) - 1;

  const monthlyDiscount = Math.pow(1 + s.annualDiscountPct, 1 / 12) - 1;
  const npv = flows.reduce(
    (acc, cf, i) => acc + cf / Math.pow(1 + monthlyDiscount, i),
    0,
  );

  const cumulativeNet: number[] = [];
  let cum = 0;
  let paybackMonths: number | null = null;
  for (let m = 0; m < flows.length; m++) {
    const prev = cum;
    cum += flows[m];
    cumulativeNet.push(round(cum, 2));
    if (paybackMonths === null && prev < 0 && cum >= 0 && flows[m] !== 0) {
      // Linear interpolation inside month m.
      paybackMonths = m - 1 + -prev / flows[m];
    }
  }

  const monthlyIrr = irr(flows);
  const annualIrr = monthlyIrr === null ? null : Math.pow(1 + monthlyIrr, 12) - 1;

  return {
    totalCost, totalBenefit, netBenefit, roi, annualizedRoi,
    paybackMonths, npv, monthlyIrr, annualIrr, cumulativeNet,
  };
}

/** Bisection IRR. Deterministic, bounded, returns null when no sign change exists. */
export function irr(flows: number[]): number | null {
  const npvAt = (r: number) =>
    flows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + r, i), 0);

  let lo = -0.9999;
  let hi = 10;
  let fLo = npvAt(lo);
  let fHi = npvAt(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAt(mid);
    if (!Number.isFinite(fMid)) return null;
    if (Math.abs(fMid) < 1e-9) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}
```

```ts
// src/lib/tools/business/url-state.ts
import { SCENARIO_NUMERIC_FIELDS, type RoiScenario } from "./roi";
import { round } from "./format";

const SCHEMA_VERSION = 1;
const MAX_SCENARIOS = 6;
const MAX_ENCODED_LENGTH = 1800;
const MAX_LABEL_LENGTH = 40;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Positional tuple encoding, not object JSON. Keys are implied by
 * SCENARIO_NUMERIC_FIELDS, which cuts the payload roughly in half.
 */
export function encodeScenarios(scenarios: RoiScenario[]): string | null {
  const rows = scenarios.slice(0, MAX_SCENARIOS).map((s) => [
    s.label.slice(0, MAX_LABEL_LENGTH),
    ...SCENARIO_NUMERIC_FIELDS.map((f) => round(s[f], 2)),
  ]);
  const json = JSON.stringify([SCHEMA_VERSION, rows]);
  const encoded = toBase64Url(new TextEncoder().encode(json));
  return encoded.length > MAX_ENCODED_LENGTH ? null : encoded;
}

/** Never trusts the input. Any deviation returns null and the UI falls back to defaults. */
export function decodeScenarios(encoded: string): RoiScenario[] | null {
  if (!encoded || encoded.length > MAX_ENCODED_LENGTH) return null;
  const bytes = fromBase64Url(encoded);
  if (!bytes) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== 2) return null;
  const [version, rows] = parsed as [unknown, unknown];
  if (version !== SCHEMA_VERSION) return null;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_SCENARIOS) {
    return null;
  }

  const out: RoiScenario[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== SCENARIO_NUMERIC_FIELDS.length + 1) {
      return null;
    }
    const [label, ...values] = row as [unknown, ...unknown[]];
    if (typeof label !== "string") return null;

    const scenario = {
      label: label.replace(/[\u0000-\u001F<>]/g, "").slice(0, MAX_LABEL_LENGTH),
    } as RoiScenario;

    for (let i = 0; i < SCENARIO_NUMERIC_FIELDS.length; i++) {
      const v = values[i];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      if (Math.abs(v) > 1e12) return null;
      scenario[SCENARIO_NUMERIC_FIELDS[i]] = v;
    }
    if (scenario.horizonMonths < 1 || scenario.horizonMonths > 600) return null;
    out.push(scenario);
  }
  return out;
}

/** Rewrites the fragment without a history entry or a scroll jump. */
export function syncHashState(encoded: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = encoded ? `s=${encoded}` : "";
  window.history.replaceState(null, "", url.toString());
}

export function readHashState(): string | null {
  if (typeof window === "undefined") return null;
  const m = /(?:^|[#&])s=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  return m ? m[1] : null;
}
```

The widget reads the hash in a `useEffect` on mount (not during render — the server render must be deterministic), debounces writes at 400ms, and shows a "Copy share link" button. When `decodeScenarios` returns `null` it renders an inline warning: *"That link couldn't be read — it may have been truncated. Starting from defaults."* Loud failure, not silent partial state.

**Acceptance criteria**
- [ ] `decodeScenarios(encodeScenarios(x)!)` round-trips to `x` for a 3-scenario fixture, values equal to 2dp.
- [ ] `decodeScenarios` returns `null` for: empty string, `"!!!!"`, a valid base64url of `{"a":1}`, a payload with `version: 2`, a row with 5 elements, a row with `"12"` as a string, `horizonMonths: 0`.
- [ ] A `<script>` tag in the label is stripped of `<` and `>` before render; the label never reaches `dangerouslySetInnerHTML`.
- [ ] Editing inputs updates `location.hash` without adding history entries (back button leaves the page, doesn't step through edits).
- [ ] Scenario state never appears in the query string; server access logs contain no scenario data.
- [ ] `computeRoi` on `{initialCost: 12000, monthlyBenefit: 2000, recurringCostPerMonth: 500, horizonMonths: 12, annualDiscountPct: 0.1, oneOffBenefit: 0}` gives `paybackMonths ≈ 9.0` and a positive NPV; verified in the test file.
- [ ] `irr([-100, 60, 60])` returns a finite positive rate; `irr([100, 60, 60])` returns `null`.
- [ ] Encoded state for 6 scenarios stays under 1800 chars.

---

### [BUSI-04] Cohort math library: triangle, retention, NRR/GRR, and four LTVs
**Estimate:** 5h · **Depends on:** BUSI-01 · **Files:** `src/lib/tools/business/cohorts.ts`, `src/lib/tools/business/cohorts.test.ts`

**Why** — This is the ticket that makes the flagship tool worth building. Everything visual in BUSI-05 is a rendering of these structures. Three things here are commonly done wrong by competitor tools and getting them right *is* the moat:

1. **Averaging retention across cohorts.** The naive implementation takes the mean of the per-cohort retention percentages. That lets a 3-customer cohort move the curve as hard as a 300-customer one. The correct aggregate is a **ratio of sums** — total customers retained at period *p* divided by total starting customers of cohorts that reached period *p* — which is size-weighted by construction.

2. **GRR from a net revenue triangle.** You cannot compute it. Net revenue at period *p* nets expansion against contraction, and no algebra recovers the two components. So the revenue triangle is labeled **"net revenue retention (cohort)"** and can legitimately exceed 100%, while GRR is only computed on the separate MRR-movement input where the user actually supplies contraction and churn as distinct numbers. Any tool that shows you a "GRR" derived from a net triangle is making it up.

3. **LTV.** Four defensible formulas, and on the same inputs they can differ by 3–5x. Reporting one silently teaches the user a wrong number with false precision. Return all four with their assumptions attached and let the UI show the spread.

**Implementation**

```ts
// src/lib/tools/business/cohorts.ts
import { safeDiv } from "./format";

// ---------- Cohort triangle ----------

export interface CohortRow {
  /** "YYYY-MM". Sorted lexicographically, which is chronological for this format. */
  cohort: string;
  /** index = months since acquisition. index 0 is the acquisition month. */
  customers: number[];
  revenue: number[];
}

export interface TriangleCell {
  cohortIndex: number;
  periodIndex: number;
  customers: number;
  revenue: number;
  logoRetention: number | null;
  revenueRetention: number | null;
}

export interface CohortTriangle {
  cohorts: string[];
  maxPeriods: number;
  /** cells[cohortIndex][periodIndex]; null where the period hasn't happened yet. */
  cells: (TriangleCell | null)[][];
  /** Size-weighted, by period. Ratio of sums, not mean of ratios. */
  averageLogoRetention: (number | null)[];
  averageRevenueRetention: (number | null)[];
  warnings: string[];
}

export function buildCohortTriangle(rows: CohortRow[]): CohortTriangle {
  const warnings: string[] = [];
  const sorted = [...rows]
    .filter((r) => r.customers.length > 0)
    .sort((a, b) => a.cohort.localeCompare(b.cohort));

  const maxPeriods = sorted.reduce((m, r) => Math.max(m, r.customers.length), 0);
  const cells: (TriangleCell | null)[][] = [];

  sorted.forEach((row, ci) => {
    const c0 = row.customers[0];
    const r0 = row.revenue[0] ?? 0;
    if (!(c0 > 0)) {
      warnings.push(
        `Cohort ${row.cohort} starts with 0 customers, so its retention row is undefined and it is excluded from the averages.`,
      );
    }
    const line: (TriangleCell | null)[] = new Array(maxPeriods).fill(null);

    for (let p = 0; p < row.customers.length; p++) {
      const customers = row.customers[p];
      const revenue = row.revenue[p] ?? 0;
      if (!Number.isFinite(customers)) continue;

      if (p > 0 && Number.isFinite(row.customers[p - 1]) && customers > row.customers[p - 1]) {
        warnings.push(
          `Cohort ${row.cohort} grows from month ${p - 1} to ${p} (${row.customers[p - 1]} → ${customers}). Either you are counting reactivations, or a row is misaligned.`,
        );
      }

      line[p] = {
        cohortIndex: ci,
        periodIndex: p,
        customers,
        revenue,
        logoRetention: c0 > 0 ? customers / c0 : null,
        revenueRetention: r0 > 0 ? revenue / r0 : null,
      };
    }
    cells.push(line);
  });

  const averageLogoRetention: (number | null)[] = [];
  const averageRevenueRetention: (number | null)[] = [];

  for (let p = 0; p < maxPeriods; p++) {
    let retainedCustomers = 0;
    let baseCustomers = 0;
    let retainedRevenue = 0;
    let baseRevenue = 0;

    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci][p];
      if (!cell) continue;
      const c0 = sorted[ci].customers[0];
      const r0 = sorted[ci].revenue[0] ?? 0;
      if (c0 > 0) {
        retainedCustomers += cell.customers;
        baseCustomers += c0;
      }
      if (r0 > 0) {
        retainedRevenue += cell.revenue;
        baseRevenue += r0;
      }
    }
    averageLogoRetention.push(safeDiv(retainedCustomers, baseCustomers));
    averageRevenueRetention.push(safeDiv(retainedRevenue, baseRevenue));
  }

  return {
    cohorts: sorted.map((r) => r.cohort),
    maxPeriods,
    cells,
    averageLogoRetention,
    averageRevenueRetention,
    warnings,
  };
}

// ---------- MRR movements: the only place GRR is computable ----------

export interface MrrMovement {
  month: string;
  startingMrr: number;
  newMrr: number;
  expansionMrr: number;
  reactivationMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  /** Optional; enables logo churn alongside revenue churn. */
  startingCustomers?: number;
  churnedCustomers?: number;
}

export interface RetentionMetrics {
  month: string;
  endingMrr: number;
  netNewMrr: number;
  /** (start − contraction − churn) / start. Capped at 1 by definition. */
  grr: number | null;
  /** (start + expansion [+ reactivation] − contraction − churn) / start. Can exceed 1. */
  nrr: number | null;
  grossRevenueChurn: number | null;
  netRevenueChurn: number | null;
  logoChurn: number | null;
  quickRatio: number | null;
  warnings: string[];
}

export interface RetentionOptions {
  /** Convention split: some count reactivation as new, some as retained. Default: as new. */
  includeReactivationInNrr: boolean;
  /** Warn when the ledger doesn't tie to the next month's opening balance. */
  ledgerTolerancePct: number;
}

export const DEFAULT_RETENTION_OPTIONS: RetentionOptions = {
  includeReactivationInNrr: false,
  ledgerTolerancePct: 0.005,
};

export function computeRetentionSeries(
  movements: MrrMovement[],
  options: RetentionOptions = DEFAULT_RETENTION_OPTIONS,
): RetentionMetrics[] {
  const sorted = [...movements].sort((a, b) => a.month.localeCompare(b.month));

  return sorted.map((m, i) => {
    const warnings: string[] = [];
    const start = m.startingMrr;
    const lost = m.contractionMrr + m.churnedMrr;
    const reactivation = options.includeReactivationInNrr ? m.reactivationMrr : 0;

    const endingMrr =
      start + m.newMrr + m.expansionMrr + m.reactivationMrr - lost;
    const netNewMrr = endingMrr - start;

    if (lost > start && start > 0) {
      warnings.push(
        `${m.month}: contraction + churn (${lost}) exceeds starting MRR (${start}). Check that churn is entered as a positive number.`,
      );
    }

    const grrRaw = safeDiv(start - lost, start);
    const grr = grrRaw === null ? null : Math.min(1, Math.max(0, grrRaw));
    const nrr = safeDiv(start + m.expansionMrr + reactivation - lost, start);

    const next = sorted[i + 1];
    if (next && start > 0) {
      const drift = Math.abs(next.startingMrr - endingMrr) / Math.max(1, endingMrr);
      if (drift > options.ledgerTolerancePct) {
        warnings.push(
          `${m.month}: closing MRR (${endingMrr.toFixed(0)}) does not match ${next.month} opening MRR (${next.startingMrr.toFixed(0)}). Your movement ledger is missing a category.`,
        );
      }
    }

    return {
      month: m.month,
      endingMrr,
      netNewMrr,
      grr,
      nrr,
      grossRevenueChurn: safeDiv(lost, start),
      netRevenueChurn: nrr === null ? null : 1 - nrr,
      logoChurn:
        m.startingCustomers === undefined || m.churnedCustomers === undefined
          ? null
          : safeDiv(m.churnedCustomers, m.startingCustomers),
      quickRatio: safeDiv(m.newMrr + m.expansionMrr, lost),
      warnings,
    };
  });
}

// ---------- LTV: four formulas, none of them secretly chosen for you ----------

export type LtvMethod = "simple" | "margin" | "discounted" | "cohort";

export interface LtvEstimate {
  method: LtvMethod;
  label: string;
  value: number | null;
  formula: string;
  assumption: string;
  caveat: string | null;
}

export interface LtvInputs {
  arpu: number;
  grossMarginPct: number;
  /** Monthly logo churn as a fraction. */
  monthlyChurn: number;
  /** Monthly expansion revenue rate as a fraction of MRR. */
  monthlyExpansion: number;
  /** Monthly discount rate for the DCF variant. */
  monthlyDiscount: number;
  /** Size-weighted retention curve from buildCohortTriangle, if available. */
  retentionCurve?: (number | null)[];
}

export function computeLtvEstimates(input: LtvInputs): LtvEstimate[] {
  const { arpu, grossMarginPct: gm, monthlyChurn, monthlyExpansion, monthlyDiscount } = input;

  const simple = safeDiv(arpu, monthlyChurn);
  const margin = safeDiv(arpu * gm, monthlyChurn);
  const netChurn = monthlyChurn - monthlyExpansion;
  const discounted = safeDiv(arpu * gm, Math.max(0, netChurn) + monthlyDiscount);

  let cohort: number | null = null;
  const curve = input.retentionCurve;
  if (curve && curve.length > 0) {
    let acc = 0;
    for (let p = 0; p < curve.length; p++) {
      const r = curve[p];
      if (r === null) break;
      acc += arpu * gm * r * Math.pow(1 + monthlyDiscount, -p);
    }
    cohort = acc;
  }

  return [
    {
      method: "simple",
      label: "Revenue LTV",
      value: simple,
      formula: "ARPU ÷ monthly churn",
      assumption: "Constant churn forever. Ignores the cost of serving the customer.",
      caveat:
        "This is the biggest of the four and the least useful. It is revenue, not value — do not compare it to CAC.",
    },
    {
      method: "margin",
      label: "Gross-margin LTV",
      value: margin,
      formula: "(ARPU × gross margin) ÷ monthly churn",
      assumption: "Constant churn forever, margin held constant.",
      caveat: "The default for LTV:CAC. Still assumes churn never changes.",
    },
    {
      method: "discounted",
      label: "Discounted LTV (with expansion)",
      value: discounted,
      formula: "(ARPU × gross margin) ÷ (net churn + discount rate)",
      assumption: "Net churn = logo churn − expansion; future cash discounted.",
      caveat:
        netChurn <= 0
          ? "Your expansion equals or exceeds churn (NRR ≥ 100%), so the infinite-horizon series diverges. Only the discount rate is holding this number finite — use the cohort estimate instead."
          : null,
    },
    {
      method: "cohort",
      label: "Cohort LTV (observed)",
      value: cohort,
      formula: "Σ ARPU × gross margin × retention(p) ÷ (1 + d)^p, over observed periods",
      assumption:
        "No distributional assumption at all. Uses your actual retention curve, truncated at the last month you have data for.",
      caveat:
        cohort === null
          ? "Needs a cohort triangle. Paste or import cohort data to unlock it."
          : "A floor, not a forecast — it stops at your data horizon and ignores everything after it.",
    },
  ];
}
```

**Acceptance criteria**
- [ ] Fixture: cohorts of 100 and 10 starting customers, retaining 50% and 100% at month 1. `averageLogoRetention[1]` is `(50 + 10) / 110 ≈ 0.545`, **not** `0.75`.
- [ ] `cells[c][p]` is `null` for every `p` beyond the observed length; the triangle is triangular, not a padded rectangle.
- [ ] A cohort whose customer count rises month-over-month produces exactly one warning naming the cohort and the two months.
- [ ] `computeRetentionSeries` on `{start:100000, expansion:8000, contraction:3000, churned:5000, new:20000}` gives `grr = 0.92` and `nrr = 1.00`, and `quickRatio = 3.5`.
- [ ] GRR is clamped to ≤ 1 and never returned from cohort revenue data.
- [ ] A ledger where `ending ≠ next.starting` by more than 0.5% emits a warning naming both months.
- [ ] `computeLtvEstimates` returns 4 entries always; when `monthlyExpansion >= monthlyChurn`, the `discounted` entry carries the divergence caveat.
- [ ] With no `retentionCurve`, `cohort.value` is `null` and its caveat tells the user how to unlock it.
- [ ] Module has zero React and zero `@db` imports; it is pure and fully unit-testable.

---

### [BUSI-05] Cohort triangle heatmap + NRR/GRR trend chart, zero new dependencies
**Estimate:** 5h · **Depends on:** BUSI-04 · **Files:** `src/components/tools/business/CohortTriangle.tsx`, `src/components/tools/business/TrendChart.tsx`, `src/components/tools/business/RetentionWidget.tsx`

**Why** — Recharts is ~95KB gzipped and would be the single heaviest thing on the site, on a page that is otherwise CDN-static HTML. Two observations kill the need for it:

- **A cohort triangle is a table, not a chart.** It's a labeled grid of numbers where the color is a secondary encoding. `<table>` gives you semantics, keyboard navigation, screen-reader row/column association, and copy-paste into Excel for free. A canvas or SVG heatmap gives you none of that and costs a dependency.
- **The NRR/GRR trend is two polylines.** That's ~90 lines of hand-written SVG including a nice-number axis scale — smaller than the import statement's share of a charting bundle.

Color uses `color-mix(…, transparent)` so the cell composites onto whatever the theme background is, which means one ramp works in light and dark without a second palette, and text stays `currentColor` with guaranteed contrast because peak alpha is capped at 0.7.

**Implementation**

```tsx
// src/components/tools/business/CohortTriangle.tsx
"use client";

import { useState, type CSSProperties } from "react";
import type { CohortTriangle as Triangle } from "@/lib/tools/business/cohorts";
import { formatPercent } from "@/lib/tools/business/format";
import { cn } from "@/lib/utils";

type Mode = "logo" | "revenue";

function heatStyle(value: number | null, mode: Mode): CSSProperties {
  if (value === null) return {};
  if (mode === "revenue" && value > 1) {
    const t = Math.min(1, (value - 1) / 0.5); // 100% → 150% saturates the expansion ramp
    return { backgroundColor: `color-mix(in oklab, var(--heat-up) ${Math.round(t * 70)}%, transparent)` };
  }
  const t = Math.min(1, Math.max(0, value));
  return { backgroundColor: `color-mix(in oklab, var(--heat) ${Math.round(t * 70)}%, transparent)` };
}

export function CohortTriangleTable({ triangle }: { triangle: Triangle }) {
  const [mode, setMode] = useState<Mode>("logo");
  const periods = Array.from({ length: triangle.maxPeriods }, (_, i) => i);

  const pick = (cellValue: { logoRetention: number | null; revenueRetention: number | null }) =>
    mode === "logo" ? cellValue.logoRetention : cellValue.revenueRetention;

  return (
    <div
      className={cn(
        "[--heat:oklch(0.72_0.15_155)] dark:[--heat:oklch(0.62_0.14_155)]",
        "[--heat-up:oklch(0.70_0.16_255)] dark:[--heat-up:oklch(0.60_0.15_255)]",
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("logo")}
          aria-pressed={mode === "logo"}
          className={cn("rounded-md border px-3 py-1", mode === "logo" && "bg-muted font-medium")}
        >
          Customer retention
        </button>
        <button
          type="button"
          onClick={() => setMode("revenue")}
          aria-pressed={mode === "revenue"}
          className={cn("rounded-md border px-3 py-1", mode === "revenue" && "bg-muted font-medium")}
        >
          Net revenue retention
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-right text-xs tabular-nums">
          <caption className="mb-2 text-left text-xs text-muted-foreground">
            {mode === "logo"
              ? "Share of each cohort's original customers still active N months later."
              : "Share of each cohort's month-0 revenue still recurring N months later. Values above 100% mean expansion outran churn."}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-background px-2 py-1 text-left font-medium">
                Cohort
              </th>
              {periods.map((p) => (
                <th key={p} scope="col" className="px-2 py-1 font-medium">
                  M{p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {triangle.cohorts.map((cohort, ci) => (
              <tr key={cohort}>
                <th scope="row" className="sticky left-0 bg-background px-2 py-1 text-left font-normal">
                  {cohort}
                </th>
                {periods.map((p) => {
                  const cell = triangle.cells[ci][p];
                  if (!cell) return <td key={p} className="px-2 py-1 text-muted-foreground/40">·</td>;
                  const v = pick(cell);
                  return (
                    <td
                      key={p}
                      style={heatStyle(v, mode)}
                      className="px-2 py-1"
                      title={`${cohort}, month ${p}: ${cell.customers} customers`}
                    >
                      {formatPercent(v, 0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <th scope="row" className="sticky left-0 bg-background px-2 py-1 text-left">
                Weighted avg
              </th>
              {periods.map((p) => {
                const avg =
                  mode === "logo"
                    ? triangle.averageLogoRetention[p]
                    : triangle.averageRevenueRetention[p];
                return (
                  <td key={p} className="px-2 py-1">
                    {formatPercent(avg, 0)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
```

```tsx
// src/components/tools/business/TrendChart.tsx
"use client";

import { useId } from "react";

export interface TrendSeries {
  label: string;
  values: (number | null)[];
  /** Tailwind stroke class, e.g. "stroke-emerald-500". */
  strokeClass: string;
}

interface Props {
  labels: string[];
  series: TrendSeries[];
  referenceLine?: number;
  format?: (n: number) => string;
  caption: string;
}

const W = 720;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 30, left: 48 };

function niceScale(lo: number, hi: number): [number, number, number] {
  if (hi <= lo) hi = lo + 1;
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step, step];
}

function segments(values: (number | null)[]): Array<Array<[number, number]>> {
  const out: Array<Array<[number, number]>> = [];
  let cur: Array<[number, number]> = [];
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      if (cur.length) out.push(cur);
      cur = [];
    } else {
      cur.push([i, v]);
    }
  });
  if (cur.length) out.push(cur);
  return out;
}

export function TrendChart({
  labels,
  series,
  referenceLine,
  format = (n) => `${Math.round(n * 100)}%`,
  caption,
}: Props) {
  const titleId = useId();
  const all = series
    .flatMap((s) => s.values)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (all.length === 0 || labels.length === 0) return null;

  const refs = referenceLine === undefined ? [] : [referenceLine];
  const [min, max, step] = niceScale(
    Math.min(...all, ...refs),
    Math.max(...all, ...refs),
  );

  const x = (i: number) =>
    PAD.left + (i * (W - PAD.left - PAD.right)) / Math.max(1, labels.length - 1);
  const y = (v: number) =>
    PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);

  const ticks: number[] = [];
  for (let t = min; t <= max + step / 1000; t += step) ticks.push(t);

  return (
    <figure className="my-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-labelledby={titleId}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>{caption}</title>

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
              className="stroke-border" strokeWidth={1}
            />
            <text
              x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {format(t)}
            </text>
          </g>
        ))}

        {referenceLine !== undefined && (
          <line
            x1={PAD.left} x2={W - PAD.right} y1={y(referenceLine)} y2={y(referenceLine)}
            className="stroke-foreground/50" strokeWidth={1} strokeDasharray="4 4"
          />
        )}

        {series.map((s) =>
          segments(s.values).map((seg, si) => (
            <polyline
              key={`${s.label}-${si}`}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={s.strokeClass}
              points={seg.map(([i, v]) => `${x(i)},${y(v)}`).join(" ")}
            />
          )),
        )}

        {labels.map((label, i) =>
          i % Math.ceil(labels.length / 8) === 0 ? (
            <text
              key={label} x={x(i)} y={H - 8} textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {label}
            </text>
          ) : null,
        )}
      </svg>

      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <svg width="14" height="4" aria-hidden="true">
              <line x1="0" y1="2" x2="14" y2="2" strokeWidth={2} className={s.strokeClass} />
            </svg>
            {s.label}
          </span>
        ))}
      </figcaption>

      {/* Screen-reader and no-SVG fallback. */}
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            {series.map((s) => <th key={s.label} scope="col">{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {series.map((s) => (
                <td key={s.label}>{s.values[i] === null ? "no data" : format(s.values[i]!)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
```

**Acceptance criteria**
- [ ] `pnpm build` shows **no** new package in the dependency tree; `package.json` `dependencies` is unchanged by this ticket.
- [ ] The triangle renders as a real `<table>` with `<caption>`, `scope="col"` / `scope="row"`, and `<tfoot>`; VoiceOver announces "Cohort 2025-03, month 4, 62%".
- [ ] Empty (future) cells render `·` and carry no background color.
- [ ] Revenue mode colors values > 100% with `--heat-up` (blue ramp), values ≤ 100% with `--heat` (green ramp).
- [ ] Switching to dark mode changes both ramps and text stays legible; verified with a contrast check on the darkest cell (≥ 4.5:1).
- [ ] `TrendChart` renders correctly with a `null` gap in the middle of a series — the line breaks, it does not draw through zero.
- [ ] Table scrolls horizontally inside its container at 375px viewport; the page body does not scroll horizontally.
- [ ] `TrendChart` with all-equal values still renders (no divide-by-zero in the scale).

---

### [BUSI-06] Paste / CSV import for cohort and movement data
**Estimate:** 2h · **Depends on:** BUSI-04 · **Files:** `src/lib/tools/business/csv.ts`, `src/lib/tools/business/csv.test.ts`, `src/components/tools/business/PasteImport.tsx`

**Why** — Nobody types a 24×24 triangle. They copy it out of Google Sheets, which puts **tab-delimited** text on the clipboard, not commas. And a naive `split(",")` destroys `"1,234"` — quoted fields containing separators are the single most common cause of "your tool says my revenue is 1". A 25-line RFC4180-ish splitter removes an entire class of support complaint.

**Implementation**

```ts
// src/lib/tools/business/csv.ts
import { parseNumber } from "./format";
import type { CohortRow } from "./cohorts";

export interface ParseResult<T> {
  rows: T[];
  warnings: string[];
  error: string | null;
}

/** Splits one line honoring double-quoted fields with escaped "" inside. */
export function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const tabs = (sample.match(/\t/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  const semis = (sample.match(/;/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return "\t";
  if (semis > commas) return ";";
  return ",";
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Expected shape (header optional):
 *   cohort, m0_customers, m0_revenue, m1_customers, m1_revenue, ...
 * Pairs are read greedily; a trailing odd column is ignored with a warning.
 */
export function parseCohortCsv(text: string, maxCohorts = 60): ParseResult<CohortRow> {
  const warnings: string[] = [];
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return { rows: [], warnings, error: "Nothing to import." };

  const delimiter = detectDelimiter(clean);
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== "");
  const rows: CohortRow[] = [];

  for (const [lineIndex, line] of lines.entries()) {
    const fields = splitLine(line, delimiter).map((f) => f.trim());
    const cohort = fields[0];
    if (!MONTH_RE.test(cohort)) {
      if (lineIndex === 0) continue; // header row
      warnings.push(`Line ${lineIndex + 1}: "${cohort}" is not a YYYY-MM cohort label. Skipped.`);
      continue;
    }
    if (rows.length >= maxCohorts) {
      warnings.push(`Stopped at ${maxCohorts} cohorts. Longer histories need the CSV upload on a paid plan — or trim the oldest rows.`);
      break;
    }

    const customers: number[] = [];
    const revenue: number[] = [];
    const values = fields.slice(1);
    if (values.length % 2 === 1) {
      warnings.push(`Line ${lineIndex + 1}: odd number of value columns; the last one was ignored.`);
    }
    for (let i = 0; i + 1 < values.length; i += 2) {
      const c = parseNumber(values[i]);
      const r = parseNumber(values[i + 1]);
      if (c === null) break; // triangle ends at the first blank
      customers.push(c);
      revenue.push(r ?? 0);
    }
    if (customers.length > 0) rows.push({ cohort, customers, revenue });
  }

  if (rows.length === 0) {
    return { rows, warnings, error: "No rows had a valid YYYY-MM cohort label in the first column." };
  }
  return { rows, warnings, error: null };
}
```

The `PasteImport` component is a `<textarea>` with an "Import" button, a "Load sample data" button (crucial — the widget must be non-empty above the fold on first paint), and a warnings list. No file input in v1; paste covers the case and avoids a file-reading permission prompt.

**Acceptance criteria**
- [ ] Tab-delimited paste from Google Sheets parses without the user picking a format.
- [ ] `splitLine('a,"1,234",b', ",")` → `["a", "1,234", "b"]`.
- [ ] `splitLine('a,"he said ""hi""",b', ",")` → `["a", 'he said "hi"', "b"]`.
- [ ] A header row (`cohort,m0_customers,...`) is silently skipped, not parsed as data.
- [ ] A BOM-prefixed paste parses cleanly.
- [ ] Rows with a bad cohort label produce a numbered warning and do not abort the import.
- [ ] "Load sample data" renders a populated triangle in under 100ms with no network request.
- [ ] > 60 cohorts truncates with an explicit warning rather than hanging.

---

### [BUSI-07] Stateful cohort boards: the one place Mongo is allowed
**Estimate:** 5h · **Depends on:** BUSI-04, BUSI-06 · **Files:** `db/models/CohortBoard.ts`, `db/models/ToolQuota.ts`, `src/lib/tools/business/board-schema.ts`, `src/lib/tools/business/board-client.ts`, `src/app/api/tools/cohort/route.ts`, `src/app/api/tools/cohort/[slug]/route.ts`

**Why — and the auth argument, decided**

The question is whether saving a cohort board needs accounts.

*For accounts:* durable ownership, a "my boards" list, revocation if a link leaks, an email to recover access, and a foundation for anything paid later.

*Against:* the codebase has no auth system — `src/middleware.ts` is a single shared admin password compared in plaintext against a cookie. Building real accounts means email verification, password hashing, session rotation, reset flows, rate limiting on login, and a GDPR erasure path. That is 15–20 hours, i.e. an entire sprint, to protect data whose worst-case leak is "someone learns your churn rate." And the user's actual job-to-be-done is *send this to my co-founder*, which an account makes strictly worse — the recipient would need to sign up too.

**Decision: anonymous capability URL + edit token for v1.**

- **Slug** = 12 chars from a 30-symbol unambiguous alphabet ≈ 59 bits of entropy. Unguessable at any realistic scan rate, so *possession of the URL is read authorization*. This is the same model as an unlisted Google Doc link, and users already understand it.
- **Edit token** = 24 random bytes, returned once at creation, stored **hashed** (SHA-256) and compared with `timingSafeEqual`. Persisted in `localStorage` keyed by slug so the creator keeps editing from the same browser without knowing a token exists.
- **TTL index at 180 days**, extended on every write. Abandoned boards garbage-collect themselves; no admin console, no storage growth, no data-retention policy to write.
- **Explicit delete button.** With a link-capability model, a working delete is what makes the "leaked link" story survivable.
- **`X-Robots-Tag: noindex` on every board response, and boards never enter `sitemap.ts`.** User business data must not become indexable content on his personal domain. This is the single highest-severity mistake available in this sprint.
- Boards are addressed as `?b=SLUG` on the existing statically generated page. **No new dynamic route segment**, so `dynamicParams = false` and the zero-invocation guarantee for tool pages both survive intact. Only the API routes are dynamic.
- Only route handlers import `@db`. The tool page never does.

**Implementation**

```ts
// db/models/CohortBoard.ts
import mongoose, { Schema, type Document } from "mongoose";

export interface ICohortBoardCohort {
  cohort: string;
  customers: number[];
  revenue: number[];
}

export interface ICohortBoardMovement {
  month: string;
  startingMrr: number;
  newMrr: number;
  expansionMrr: number;
  reactivationMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  startingCustomers?: number;
  churnedCustomers?: number;
}

export interface ICohortBoard extends Document {
  slug: string;
  editTokenHash: string;
  schemaVersion: number;
  title: string;
  currency: string;
  cohorts: ICohortBoardCohort[];
  movements: ICohortBoardMovement[];
  settings: {
    includeReactivationInNrr: boolean;
    grossMarginPct: number;
    monthlyDiscountPct: number;
  };
  viewCount: number;
  createdIpHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CohortSchema = new Schema<ICohortBoardCohort>(
  {
    cohort: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    customers: { type: [Number], required: true },
    revenue: { type: [Number], required: true },
  },
  { _id: false },
);

const MovementSchema = new Schema<ICohortBoardMovement>(
  {
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    startingMrr: { type: Number, required: true },
    newMrr: { type: Number, default: 0 },
    expansionMrr: { type: Number, default: 0 },
    reactivationMrr: { type: Number, default: 0 },
    contractionMrr: { type: Number, default: 0 },
    churnedMrr: { type: Number, default: 0 },
    startingCustomers: { type: Number },
    churnedCustomers: { type: Number },
  },
  { _id: false },
);

const CohortBoardSchema = new Schema<ICohortBoard>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    editTokenHash: { type: String, required: true, select: false },
    schemaVersion: { type: Number, default: 1 },
    title: { type: String, default: "Untitled board", maxlength: 80, trim: true },
    currency: { type: String, default: "USD", maxlength: 3, uppercase: true },
    cohorts: { type: [CohortSchema], default: [] },
    movements: { type: [MovementSchema], default: [] },
    settings: {
      includeReactivationInNrr: { type: Boolean, default: false },
      grossMarginPct: { type: Number, default: 0.8, min: -1, max: 1 },
      monthlyDiscountPct: { type: Number, default: 0.008, min: 0, max: 1 },
    },
    viewCount: { type: Number, default: 0 },
    createdIpHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// TTL sweep: Mongo deletes the doc once expiresAt passes. Refreshed on every write.
CohortBoardSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default (mongoose.models.CohortBoard as mongoose.Model<ICohortBoard>) ||
  mongoose.model<ICohortBoard>("CohortBoard", CohortBoardSchema);
```

```ts
// db/models/ToolQuota.ts
import mongoose, { Schema, type Document } from "mongoose";

export interface IToolQuota extends Document {
  key: string;
  count: number;
  expiresAt: Date;
}

const ToolQuotaSchema = new Schema<IToolQuota>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

ToolQuotaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ToolQuota =
  (mongoose.models.ToolQuota as mongoose.Model<IToolQuota>) ||
  mongoose.model<IToolQuota>("ToolQuota", ToolQuotaSchema);

export default ToolQuota;

/** Atomic increment-and-check. TTL cleans the window up; no cron needed. */
export async function consumeQuota(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; count: number }> {
  const doc = await ToolQuota.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + windowMs) } },
    { upsert: true, new: true },
  ).lean<{ count: number }>();
  const count = doc?.count ?? 1;
  return { allowed: count <= limit, count };
}
```

```ts
// src/lib/tools/business/board-schema.ts
// Hand-rolled validation. Server-side only, so bundle size is irrelevant,
// but the project keeps its dependency count low and this is 90 lines.

export interface BoardPayload {
  title: string;
  currency: string;
  cohorts: { cohort: string; customers: number[]; revenue: number[] }[];
  movements: {
    month: string;
    startingMrr: number;
    newMrr: number;
    expansionMrr: number;
    reactivationMrr: number;
    contractionMrr: number;
    churnedMrr: number;
    startingCustomers?: number;
    churnedCustomers?: number;
  }[];
  settings: {
    includeReactivationInNrr: boolean;
    grossMarginPct: number;
    monthlyDiscountPct: number;
  };
}

export type ParseOutcome =
  | { ok: true; value: BoardPayload }
  | { ok: false; error: string };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_COHORTS = 60;
const MAX_PERIODS = 60;
const MAX_MOVEMENTS = 120;

function numArray(v: unknown, max: number): number[] | null {
  if (!Array.isArray(v) || v.length > max) return null;
  const out: number[] = [];
  for (const n of v) {
    if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e12) return null;
    out.push(n);
  }
  return out;
}

function num(v: unknown, fallback: number, lo = -1e12, hi = 1e12): number | null {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) return null;
  return v;
}

export function parseBoardPayload(raw: unknown): ParseOutcome {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "body_not_object" };
  const b = raw as Record<string, unknown>;

  const title =
    typeof b.title === "string"
      ? b.title.replace(/[\u0000-\u001F<>]/g, "").slice(0, 80).trim() || "Untitled board"
      : "Untitled board";

  const currency =
    typeof b.currency === "string" && /^[A-Za-z]{3}$/.test(b.currency)
      ? b.currency.toUpperCase()
      : "USD";

  if (!Array.isArray(b.cohorts) || b.cohorts.length > MAX_COHORTS) {
    return { ok: false, error: "cohorts_invalid" };
  }
  const cohorts: BoardPayload["cohorts"] = [];
  for (const c of b.cohorts) {
    if (typeof c !== "object" || c === null) return { ok: false, error: "cohort_row_invalid" };
    const row = c as Record<string, unknown>;
    if (typeof row.cohort !== "string" || !MONTH_RE.test(row.cohort)) {
      return { ok: false, error: "cohort_label_invalid" };
    }
    const customers = numArray(row.customers, MAX_PERIODS);
    const revenue = numArray(row.revenue, MAX_PERIODS);
    if (!customers || !revenue) return { ok: false, error: "cohort_values_invalid" };
    cohorts.push({ cohort: row.cohort, customers, revenue });
  }

  if (!Array.isArray(b.movements) || b.movements.length > MAX_MOVEMENTS) {
    return { ok: false, error: "movements_invalid" };
  }
  const movements: BoardPayload["movements"] = [];
  for (const m of b.movements) {
    if (typeof m !== "object" || m === null) return { ok: false, error: "movement_row_invalid" };
    const row = m as Record<string, unknown>;
    if (typeof row.month !== "string" || !MONTH_RE.test(row.month)) {
      return { ok: false, error: "movement_month_invalid" };
    }
    const fields = {
      startingMrr: num(row.startingMrr, 0),
      newMrr: num(row.newMrr, 0),
      expansionMrr: num(row.expansionMrr, 0),
      reactivationMrr: num(row.reactivationMrr, 0),
      contractionMrr: num(row.contractionMrr, 0),
      churnedMrr: num(row.churnedMrr, 0),
    };
    if (Object.values(fields).some((v) => v === null)) {
      return { ok: false, error: "movement_values_invalid" };
    }
    movements.push({ month: row.month, ...(fields as Record<string, number>) } as BoardPayload["movements"][number]);
  }

  const s = (typeof b.settings === "object" && b.settings !== null ? b.settings : {}) as Record<string, unknown>;
  const grossMarginPct = num(s.grossMarginPct, 0.8, -1, 1);
  const monthlyDiscountPct = num(s.monthlyDiscountPct, 0.008, 0, 1);
  if (grossMarginPct === null || monthlyDiscountPct === null) {
    return { ok: false, error: "settings_invalid" };
  }

  return {
    ok: true,
    value: {
      title,
      currency,
      cohorts,
      movements,
      settings: {
        includeReactivationInNrr: s.includeReactivationInNrr === true,
        grossMarginPct,
        monthlyDiscountPct,
      },
    },
  };
}
```

```ts
// src/app/api/tools/cohort/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { connectToDatabase } from "@db";
import CohortBoard from "@db/models/CohortBoard";
import { consumeQuota } from "@db/models/ToolQuota";
import { parseBoardPayload } from "@/lib/tools/business/board-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64_000;
const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // no 0/1/i/l/o
const CREATE_LIMIT_PER_DAY = 20;

export function newSlug(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function tokensMatch(presented: string, storedHash: string): boolean {
  const a = Buffer.from(sha256(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function ipHash(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const day = new Date().toISOString().slice(0, 10);
  return sha256(`${ip}:${process.env.TOOLS_IP_SALT ?? ""}:${day}`);
}

const NO_INDEX = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "private, no-store",
} as const;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413, headers: NO_INDEX });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: NO_INDEX });
  }

  const parsed = parseBoardPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_INDEX });
  }

  await connectToDatabase();

  const hash = ipHash(req);
  const quota = await consumeQuota(`cohort:create:${hash}`, CREATE_LIMIT_PER_DAY, 24 * 60 * 60 * 1000);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "You've saved 20 boards today. Try again tomorrow." },
      { status: 429, headers: NO_INDEX },
    );
  }

  const editToken = randomBytes(24).toString("base64url");
  const ttlDays = Number(process.env.TOOLS_BOARD_TTL_DAYS ?? 180);

  const board = await CohortBoard.create({
    ...parsed.value,
    slug: newSlug(),
    editTokenHash: sha256(editToken),
    createdIpHash: hash,
    expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
  });

  return NextResponse.json(
    { slug: board.slug, editToken, expiresAt: board.expiresAt },
    { status: 201, headers: NO_INDEX },
  );
}
```

```ts
// src/app/api/tools/cohort/[slug]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@db";
import CohortBoard from "@db/models/CohortBoard";
import { parseBoardPayload } from "@/lib/tools/business/board-schema";
import { tokensMatch } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64_000;
const SLUG_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{12}$/;

const NO_INDEX = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "private, no-store",
} as const;

function bearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 && token.length <= 200 ? token : null;
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX });
  }
  await connectToDatabase();

  const ttlDays = Number(process.env.TOOLS_BOARD_TTL_DAYS ?? 180);
  const board = await CohortBoard.findOneAndUpdate(
    { slug: params.slug },
    {
      $inc: { viewCount: 1 },
      $set: { expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000) },
    },
    { new: true },
  ).lean();

  if (!board) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX });
  }

  const { editTokenHash, createdIpHash, _id, __v, ...safe } = board as Record<string, unknown>;
  return NextResponse.json(safe, { headers: NO_INDEX });
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX });
  }
  const token = bearer(req);
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_INDEX });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413, headers: NO_INDEX });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: NO_INDEX });
  }

  const parsed = parseBoardPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_INDEX });
  }

  await connectToDatabase();

  const existing = await CohortBoard.findOne({ slug: params.slug }).select("+editTokenHash");
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX });
  }
  if (!tokensMatch(token, existing.editTokenHash)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_INDEX });
  }

  const ttlDays = Number(process.env.TOOLS_BOARD_TTL_DAYS ?? 180);
  existing.set({
    ...parsed.value,
    expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
  });
  await existing.save();

  return NextResponse.json({ ok: true, updatedAt: existing.updatedAt }, { headers: NO_INDEX });
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX });
  }
  const token = bearer(req);
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_INDEX });
  }

  await connectToDatabase();
  const existing = await CohortBoard.findOne({ slug: params.slug }).select("+editTokenHash");
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_INDEX });
  }
  if (!tokensMatch(token, existing.editTokenHash)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_INDEX });
  }

  await existing.deleteOne();
  return NextResponse.json({ ok: true }, { headers: NO_INDEX });
}
```

```ts
// src/lib/tools/business/board-client.ts
"use client";

import type { BoardPayload } from "./board-schema";

const TOKEN_PREFIX = "cohort-board-token:";

export function rememberToken(slug: string, token: string): void {
  try { window.localStorage.setItem(TOKEN_PREFIX + slug, token); } catch { /* private mode */ }
}

export function recallToken(slug: string): string | null {
  try { return window.localStorage.getItem(TOKEN_PREFIX + slug); } catch { return null; }
}

export function forgetToken(slug: string): void {
  try { window.localStorage.removeItem(TOKEN_PREFIX + slug); } catch { /* noop */ }
}

export async function createBoard(payload: BoardPayload): Promise<{ slug: string; editToken: string }> {
  const res = await fetch("/api/tools/cohort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "create_failed");
  const data = (await res.json()) as { slug: string; editToken: string };
  rememberToken(data.slug, data.editToken);
  return data;
}

export async function loadBoard(slug: string): Promise<BoardPayload | null> {
  const res = await fetch(`/api/tools/cohort/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("load_failed");
  return (await res.json()) as BoardPayload;
}

export async function saveBoard(slug: string, payload: BoardPayload): Promise<boolean> {
  const token = recallToken(slug);
  if (!token) return false;
  const res = await fetch(`/api/tools/cohort/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return res.ok;
}
```

**Acceptance criteria**
- [ ] `POST /api/tools/cohort` with a valid payload returns 201 with a 12-char slug matching `^[23456789a-hjkmnp-z]{12}$` and a base64url token.
- [ ] `GET /api/tools/cohort/{slug}` returns the board **without** `editTokenHash`, `createdIpHash`, `_id`, or `__v`; verified by asserting on the JSON keys.
- [ ] Every board response carries `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store`.
- [ ] `PATCH` with no `Authorization` → 401; with a wrong token → 403; with the right token → 200 and a bumped `updatedAt`.
- [ ] `DELETE` with the right token removes the document; a subsequent `GET` → 404.
- [ ] A 100KB body → 413 **before** `JSON.parse` runs.
- [ ] The 21st create from one IP in 24h → 429 with a human-readable message.
- [ ] `db.cohortboards.getIndexes()` in Atlas shows a unique index on `slug` and a TTL index on `expiresAt` with `expireAfterSeconds: 0`.
- [ ] `grep -rn "@db" src/app/\(tools\)/` returns **nothing**. Only `src/app/api/**` touches the database.
- [ ] `sitemap.ts` output contains no board URLs; `/tools/cohort-retention-calculator?b=xxx` is still the same static HTML document as the bare page.
- [ ] Loading a board from a second browser shows the data read-only, with a "You can't edit this board — duplicate it to make changes" affordance rather than a silent save failure.

---

### [BUSI-08] LTV disclosure component: show the spread, not a number
**Estimate:** 2h · **Depends on:** BUSI-04 · **Files:** `src/components/tools/business/LtvDisclosure.tsx`, registry entry `ltv-calculator`

**Why** — This is the editorial position of the whole cluster expressed as a component. A user who types ARPU $50, 3% monthly churn, 80% margin gets $1,667 / $1,333 / ~$1,000 / ~$780 from the four methods — a 2.1x spread. Every competitor page shows exactly one of these and calls it "LTV". Showing all four with their assumptions is (a) correct, (b) the thing an experienced founder will screenshot and share, and (c) genuinely hard to copy, because copying it means admitting your one number was arbitrary.

Default display: the **gross-margin** figure as the headline when there's no cohort data, the **cohort** figure when there is, with the range always visible directly beneath: *"Depending on definition, between $780 and $1,667."*

**Implementation**

```tsx
// src/components/tools/business/LtvDisclosure.tsx
"use client";

import { computeLtvEstimates, type LtvInputs, type LtvMethod } from "@/lib/tools/business/cohorts";
import { formatCurrency, formatMultiple, safeDiv } from "@/lib/tools/business/format";

interface Props {
  inputs: LtvInputs;
  currency: string;
  cac: number | null;
}

const PREFERRED: LtvMethod[] = ["cohort", "margin", "discounted", "simple"];

export function LtvDisclosure({ inputs, currency, cac }: Props) {
  const estimates = computeLtvEstimates(inputs);
  const byMethod = new Map(estimates.map((e) => [e.method, e]));

  const headline =
    PREFERRED.map((m) => byMethod.get(m)).find((e) => e && e.value !== null) ?? estimates[1];

  const values = estimates
    .map((e) => e.value)
    .filter((v): v is number => v !== null && v > 0);
  const lo = values.length ? Math.min(...values) : null;
  const hi = values.length ? Math.max(...values) : null;
  const spread = lo !== null && hi !== null ? safeDiv(hi, lo) : null;

  return (
    <section aria-labelledby="ltv-heading" className="rounded-lg border p-4">
      <h3 id="ltv-heading" className="text-sm font-medium text-muted-foreground">
        Lifetime value — {headline.label}
      </h3>
      <p className="mt-1 text-3xl font-semibold tabular-nums">
        {formatCurrency(headline.value, currency, 0)}
      </p>

      {lo !== null && hi !== null && spread !== null && spread > 1.05 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Depending on which definition you use, this number is between{" "}
          <strong>{formatCurrency(lo, currency, 0)}</strong> and{" "}
          <strong>{formatCurrency(hi, currency, 0)}</strong> — a {formatMultiple(spread)} spread.
          There is no single correct LTV. Pick one, write down which, and use it consistently.
        </p>
      )}

      {cac !== null && headline.value !== null && (
        <p className="mt-2 text-sm">
          LTV:CAC on this basis:{" "}
          <strong className="tabular-nums">{formatMultiple(safeDiv(headline.value, cac))}</strong>
          {" — "}
          <span className="text-muted-foreground">
            benchmark is 3x or better, and above 5x usually means you are underspending on growth,
            not that you are winning.
          </span>
        </p>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium">
          Show all four formulas and what each assumes
        </summary>
        <dl className="mt-3 space-y-4">
          {estimates.map((e) => (
            <div key={e.method}>
              <dt className="flex items-baseline justify-between gap-4 text-sm font-medium">
                <span>{e.label}</span>
                <span className="tabular-nums">{formatCurrency(e.value, currency, 0)}</span>
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1 py-0.5">{e.formula}</code>
                <span className="mt-1 block">{e.assumption}</span>
                {e.caveat && <span className="mt-1 block font-medium text-foreground">{e.caveat}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
```

**Acceptance criteria**
- [ ] With ARPU 50, churn 0.03, margin 0.8, discount 0.008, no cohort curve: headline is the margin figure (~$1,333) and the spread line renders with min ≈ $1,000 and max ≈ $1,667.
- [ ] Supplying a cohort retention curve switches the headline to the cohort estimate without a page reload.
- [ ] When expansion ≥ churn, the discounted row shows the divergence caveat in `text-foreground` weight, not buried.
- [ ] The `<details>` block is closed by default and keyboard-openable.
- [ ] The spread paragraph is suppressed when the spread is under 1.05x (avoids a nag on degenerate inputs).
- [ ] `ltv-calculator` registry entry passes `validate.ts` and its `gotchas` section ≥ 120 words explains the four-formula problem in prose (the component is not the only place it's said — the page text must carry it for search engines).

---

### [BUSI-09] SaaS metrics suite: the split rule, and the pages that follow from it
**Estimate:** 3h · **Depends on:** BUSI-01, BUSI-04 · **Files:** `src/lib/tools/business/saas-metrics.ts`, `src/components/tools/business/SaasMetricsWidget.tsx`, registry entries `saas-metrics-calculator`, `churn-rate-calculator`, `cohort-retention-calculator`

**Why — the split rule, stated once and applied everywhere**

> A metric gets its **own page** if and only if either:
> 1. Two or more defensible formulas exist and the choice moves the answer by more than ~10%; or
> 2. It has its own head search term with volume distinct from the group term.
>
> Otherwise it is a **tab on a grouped page**. And a third, overriding clause: never split a metric whose page would need padding to clear the validator's 400-word floor. The word floors in `validate.ts` are the enforcement mechanism — if you can't write 120 honest words of "gotchas" about a metric, it isn't a page.

Applying it:

| Metric | Formula argument? | Own head term? | Verdict |
|---|---|---|---|
| Churn rate | Yes — logo vs revenue vs net revenue; start-of-period vs average denominator | Yes | **Own page** (`churn-rate-calculator`) |
| LTV | Yes — four formulas, 2x+ spread | Yes | **Own page** (BUSI-08) |
| CAC | Yes — paid vs blended vs fully-loaded | Yes | **Own page** (BUSI-02) |
| Cohort retention | Yes — weighting, GRR derivability | Yes | **Own page**, the flagship |
| MRR / ARR | No — it's a definition | Weak | Grouped |
| ARPU | No | No | Grouped |
| LTV:CAC | No — it's a ratio of two things that have their own pages | Weak | Grouped, links out |
| CAC payback | Marginal — margin-adjusted or not | Weak | Grouped, with a toggle |
| Quick ratio | No | No | Grouped |
| Rule of 40 | No — growth% + margin% | Weak | Grouped |

So: three pages here, not ten. `saas-metrics-calculator` is one page with a tabbed widget covering the six grouped metrics; `churn-rate-calculator` and `cohort-retention-calculator` are their own.

**Implementation**

```ts
// src/lib/tools/business/saas-metrics.ts
import { safeDiv } from "./format";

export interface SaasMetricsInput {
  mrr: number;
  previousMrr: number;
  customers: number;
  grossMarginPct: number;
  cac: number;
  marginLtv: number | null;
  newMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  /** Year-over-year revenue growth as a fraction. */
  yoyGrowthPct: number;
  /** Free cash flow or EBITDA margin as a fraction; may be negative. */
  profitMarginPct: number;
  cashInBank: number;
  monthlyNetBurn: number;
}

export interface SaasMetricsResult {
  mrr: number;
  arr: number;
  arpu: number | null;
  ltvCacRatio: number | null;
  /** Months of gross profit needed to repay CAC. The honest version. */
  cacPaybackMonths: number | null;
  /** The vanity version, for comparison. Ignores margin. */
  cacPaybackMonthsRevenue: number | null;
  quickRatio: number | null;
  ruleOf40: number;
  ruleOf40Pass: boolean;
  netNewMrr: number;
  momGrowth: number | null;
  runwayMonths: number | null;
  notes: string[];
}

export function computeSaasMetrics(input: SaasMetricsInput): SaasMetricsResult {
  const notes: string[] = [];
  const arpu = safeDiv(input.mrr, input.customers);

  const cacPaybackMonths =
    arpu === null || input.grossMarginPct <= 0
      ? null
      : safeDiv(input.cac, arpu * input.grossMarginPct);
  const cacPaybackMonthsRevenue = arpu === null ? null : safeDiv(input.cac, arpu);

  if (
    cacPaybackMonths !== null &&
    cacPaybackMonthsRevenue !== null &&
    cacPaybackMonths > cacPaybackMonthsRevenue * 1.15
  ) {
    notes.push(
      `Margin-adjusted payback is ${cacPaybackMonths.toFixed(1)} months, not ${cacPaybackMonthsRevenue.toFixed(1)}. Revenue does not pay back CAC — gross profit does.`,
    );
  }

  const quickRatio = safeDiv(
    input.newMrr + input.expansionMrr,
    input.contractionMrr + input.churnedMrr,
  );
  if (input.contractionMrr + input.churnedMrr === 0 && input.newMrr > 0) {
    notes.push("Zero churn this month makes the quick ratio undefined, not infinite.");
  }

  const ruleOf40 = (input.yoyGrowthPct + input.profitMarginPct) * 100;
  const netNewMrr = input.mrr - input.previousMrr;

  const runwayMonths =
    input.monthlyNetBurn <= 0 ? null : safeDiv(input.cashInBank, input.monthlyNetBurn);
  if (input.monthlyNetBurn <= 0) {
    notes.push("You are cash-flow positive, so runway is not the constraint. Nice.");
  }

  return {
    mrr: input.mrr,
    arr: input.mrr * 12,
    arpu,
    ltvCacRatio:
      input.marginLtv === null ? null : safeDiv(input.marginLtv, input.cac),
    cacPaybackMonths,
    cacPaybackMonthsRevenue,
    quickRatio,
    ruleOf40,
    ruleOf40Pass: ruleOf40 >= 40,
    netNewMrr,
    momGrowth: safeDiv(netNewMrr, input.previousMrr),
    runwayMonths,
    notes,
  };
}

export type ChurnBasis = "logo" | "grossRevenue" | "netRevenue";
export type ChurnDenominator = "startOfPeriod" | "averageOfPeriod";

export interface ChurnInput {
  startCustomers: number;
  endCustomers: number;
  churnedCustomers: number;
  startMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  expansionMrr: number;
  denominator: ChurnDenominator;
}

export function computeChurn(input: ChurnInput): Record<ChurnBasis, number | null> & {
  annualizedLogo: number | null;
} {
  const base =
    input.denominator === "startOfPeriod"
      ? input.startCustomers
      : (input.startCustomers + input.endCustomers) / 2;

  const logo = safeDiv(input.churnedCustomers, base);
  const grossRevenue = safeDiv(input.contractionMrr + input.churnedMrr, input.startMrr);
  const netRevenue = safeDiv(
    input.contractionMrr + input.churnedMrr - input.expansionMrr,
    input.startMrr,
  );

  return {
    logo,
    grossRevenue,
    netRevenue,
    // Compounding, not 12x. 5%/mo is 46% a year, not 60%.
    annualizedLogo: logo === null ? null : 1 - Math.pow(1 - logo, 12),
  };
}
```

**Acceptance criteria**
- [ ] Exactly three registry entries added by this ticket; all pass `validate.ts`.
- [ ] The split-rule table above appears verbatim in the `howItWorks` prose of `saas-metrics-calculator` (it's the page's differentiator, not just an internal note).
- [ ] `computeSaasMetrics` shows both payback figures side by side and emits the note when they diverge by >15%.
- [ ] `computeChurn` toggling `denominator` between `startOfPeriod` and `averageOfPeriod` visibly changes the number, with a one-line explanation of which convention the user's board uses.
- [ ] `annualizedLogo` for 5% monthly returns `0.4596`, not `0.60`; asserted in a test.
- [ ] `quickRatio` with zero churn returns `null` and renders `"—"` plus the note, never `Infinity`.
- [ ] `saas-metrics-calculator` uses a tabbed widget; each tab is reachable by keyboard and has `role="tab"` / `aria-selected`.

---

### [BUSI-10] Supporting set: margin vs markup, burn & runway, break-even
**Estimate:** 3h · **Depends on:** BUSI-01 · **Files:** `src/lib/tools/business/pricing.ts`, `src/components/tools/business/MarginMarkupWidget.tsx`, `src/components/tools/business/RunwayWidget.tsx`, `src/components/tools/business/BreakEvenWidget.tsx`, registry entries `margin-vs-markup-calculator`, `burn-rate-runway-calculator`, `break-even-calculator`

**Why** — Three cheap pages with real search demand that feed internal links into the expensive ones. Margin-vs-markup in particular is a genuine and common error (a 50% markup is a 33% margin), which makes it a good page and a good link source into the ROAS calculator, whose break-even formula depends on getting margin right. Grouped per the BUSI-09 rule: margin and markup on one page (same formula, two directions); burn and runway on one page (runway is burn divided into cash).

**Implementation**

```ts
// src/lib/tools/business/pricing.ts
import { safeDiv } from "./format";

export interface MarginMarkup {
  cost: number;
  price: number;
  profit: number;
  /** profit / price */
  marginPct: number | null;
  /** profit / cost */
  markupPct: number | null;
}

export function fromCostAndPrice(cost: number, price: number): MarginMarkup {
  const profit = price - cost;
  return {
    cost, price, profit,
    marginPct: safeDiv(profit, price),
    markupPct: safeDiv(profit, cost),
  };
}

export function priceFromMargin(cost: number, marginPct: number): number | null {
  if (marginPct >= 1) return null; // 100% margin needs an infinite price
  const p = safeDiv(cost, 1 - marginPct);
  return p;
}

export function priceFromMarkup(cost: number, markupPct: number): number {
  return cost * (1 + markupPct);
}

export function marginToMarkup(marginPct: number): number | null {
  return safeDiv(marginPct, 1 - marginPct);
}

export function markupToMargin(markupPct: number): number | null {
  return safeDiv(markupPct, 1 + markupPct);
}

export interface RunwayInput {
  cashInBank: number;
  monthlyRevenue: number;
  monthlyCosts: number;
  /** Fractional MoM revenue growth applied when projecting forward. */
  monthlyRevenueGrowth: number;
  maxMonths: number;
}

export interface RunwayResult {
  grossBurn: number;
  netBurn: number;
  /** Flat-burn runway: the number everyone quotes. */
  flatRunwayMonths: number | null;
  /** Runway with revenue growth compounding. The realistic one. */
  projectedRunwayMonths: number | null;
  breakEvenMonth: number | null;
  cashByMonth: number[];
}

export function computeRunway(input: RunwayInput): RunwayResult {
  const grossBurn = input.monthlyCosts;
  const netBurn = input.monthlyCosts - input.monthlyRevenue;
  const flatRunwayMonths = netBurn <= 0 ? null : safeDiv(input.cashInBank, netBurn);

  const cashByMonth: number[] = [];
  let cash = input.cashInBank;
  let revenue = input.monthlyRevenue;
  let projectedRunwayMonths: number | null = null;
  let breakEvenMonth: number | null = null;

  for (let m = 1; m <= input.maxMonths; m++) {
    revenue *= 1 + input.monthlyRevenueGrowth;
    const burn = input.monthlyCosts - revenue;
    if (burn <= 0 && breakEvenMonth === null) breakEvenMonth = m;
    const previous = cash;
    cash -= burn;
    cashByMonth.push(cash);
    if (previous > 0 && cash <= 0 && projectedRunwayMonths === null) {
      projectedRunwayMonths = m - 1 + safeDiv(previous, burn)!;
    }
  }

  return { grossBurn, netBurn, flatRunwayMonths, projectedRunwayMonths, breakEvenMonth, cashByMonth };
}

export interface BreakEvenInput {
  fixedCosts: number;
  pricePerUnit: number;
  variableCostPerUnit: number;
}

export function computeBreakEven(input: BreakEvenInput) {
  const contributionPerUnit = input.pricePerUnit - input.variableCostPerUnit;
  const units = contributionPerUnit > 0 ? safeDiv(input.fixedCosts, contributionPerUnit) : null;
  return {
    contributionPerUnit,
    contributionMarginPct: safeDiv(contributionPerUnit, input.pricePerUnit),
    breakEvenUnits: units === null ? null : Math.ceil(units),
    breakEvenRevenue: units === null ? null : Math.ceil(units) * input.pricePerUnit,
  };
}
```

The runway widget reuses `TrendChart` from BUSI-05 to plot `cashByMonth` with a zero reference line — no new chart code.

**Acceptance criteria**
- [ ] `markupToMargin(0.5)` → `0.3333`; `marginToMarkup(0.5)` → `1.0`. Both asserted in tests, and the page states the 50%-markup-is-33%-margin example in prose.
- [ ] `priceFromMargin(100, 1)` → `null` with a UI message, not `Infinity`.
- [ ] `computeRunway` shows flat and growth-adjusted runway side by side, and the growth-adjusted figure exceeds the flat one whenever growth > 0.
- [ ] `breakEvenMonth` is `null` and clearly labeled "not within N months" when revenue never overtakes costs inside `maxMonths`.
- [ ] `computeBreakEven` with `variableCostPerUnit >= pricePerUnit` returns `null` units and the UI says "you lose money on every unit — volume won't fix this."
- [ ] All three registry entries pass `validate.ts` and each links to at least one of the flagship pages via `related`.

---

### [BUSI-11] Registry entries, JSON-LD, internal links, and the commercial CTA
**Estimate:** 2h · **Depends on:** BUSI-02…BUSI-10 · **Files:** `src/lib/tools/registry.ts`, `src/lib/tools/widgets.ts`, `src/components/tools/business/BusinessCta.tsx`

**Why these visitors, and the CTA design that follows**

A student converting a PDF is worth approximately zero commercially. He'll never hire anyone, he'll never buy anything, he bounces in 40 seconds. He is worth having — volume feeds indexation, which per the canonical constraints is the actual bottleneck — but he is not the business.

A founder pasting real MRR movements into a cohort tracker is a different person entirely. He has a budget, a technical problem, and he is *at this moment* thinking about unit economics, which is the precise mental state in which people decide to hire a contractor. He also has peers and will forward a link. One of these visitors is worth several thousand of the other.

But the correct response to that is **not** to gate the tool. Gating produces a fake-email list and destroys the referral loop that makes these pages work. The design principles:

1. **The tool always fully works, immediately, with zero friction.** No "enter your email to see results", no watermark on the export, no upgrade interstitial.
2. **The CTA appears only after the value is delivered** — below the results, never above the widget, never as a modal. If `hasResult` is false it does not render at all.
3. **The CTA is a link, not a form.** Two of them: "I build internal tools and data dashboards — see what I work on" → `/#work`, and "How this cohort math works" → the relevant blog post. Contact is one more click, deliberately.
4. **The real conversion action is the export/share button**, not the CTA. A CSV export and a share link carry the domain into the recipient's inbox. Word of mouth from a founder outperforms a form fill from the same founder.
5. **The KPI is outbound clicks from `/tools/*` to `/#contact`**, tracked as an event. Not email captures. If the number is zero after 90 days, the fix is a better tool, not a more aggressive CTA.
6. Explicitly not doing: exit-intent popups, "3 free calculations remaining", newsletter slide-ins, a chatbot, or any UI that implies the results are partial.

**Implementation**

```ts
// src/lib/tools/registry.ts (excerpt — the business cluster)
import type { Tool } from "./types";

export const BUSINESS_TOOLS: Tool[] = [
  {
    slug: "cohort-retention-calculator",
    category: "business",
    name: "Cohort Retention Calculator",
    h1: "Cohort Retention Calculator",
    metaTitle: "Cohort Retention Calculator — NRR, GRR & Churn",   // 48 chars
    description:
      "Paste monthly cohort data and get a retention triangle, weighted retention curve, and NRR and GRR trends. Runs in your browser; nothing is uploaded unless you save.",
    compute: "browser",
    persistence: "mongo",
    updatedAt: "2026-08-09",
    howItWorks: `…≥120 words explaining the triangle, the ratio-of-sums weighting, and why GRR cannot be derived from a net revenue triangle…`,
    gotchas: `…≥120 words on reactivations breaking monotonicity, incomplete diagonals, small-cohort noise, and the movement-ledger tie-out…`,
    faqs: [
      { q: "What's the difference between NRR and GRR?", a: "…" },
      { q: "Why does my revenue retention go above 100%?", a: "…" },
      { q: "How many cohorts do I need before the curve means anything?", a: "…" },
      { q: "Is my data uploaded anywhere?", a: "…" },
      { q: "How long do saved boards last?", a: "…" },
    ],
    related: ["churn-rate-calculator", "ltv-calculator", "saas-metrics-calculator"],
  },
  // roas-calculator, cac-calculator, roi-calculator, churn-rate-calculator,
  // ltv-calculator, saas-metrics-calculator, margin-vs-markup-calculator,
  // burn-rate-runway-calculator, break-even-calculator follow the same shape.
];
```

```tsx
// src/components/tools/business/BusinessCta.tsx
"use client";

import Link from "next/link";
import { track } from "@/lib/tools/analytics";
import { DATA } from "@/data/resume";

interface Props {
  toolSlug: string;
  hasResult: boolean;
  deepDiveHref?: string;
}

export function BusinessCta({ toolSlug, hasResult, deepDiveHref }: Props) {
  if (!hasResult) return null;

  return (
    <aside className="mt-10 rounded-lg border bg-muted/40 p-5">
      <p className="text-sm leading-relaxed">
        I&apos;m {DATA.name}. I build internal tools, data dashboards, and the kind of
        metric plumbing this page is a toy version of — at Cortana AI and at Ryzera.
        No email required to use anything here.
      </p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <Link
          href="/#work"
          onClick={() => track("tools_cta_click", { tool: toolSlug, target: "work" })}
          className="font-medium underline underline-offset-4"
        >
          See what I work on
        </Link>
        {deepDiveHref && (
          <Link
            href={deepDiveHref}
            onClick={() => track("tools_cta_click", { tool: toolSlug, target: "deep_dive" })}
            className="font-medium underline underline-offset-4"
          >
            How the math on this page works
          </Link>
        )}
      </div>
    </aside>
  );
}
```

**Acceptance criteria**
- [ ] 10 new registry entries; `TOOLS.length` printed at build time and **≤ 30**. If it would exceed 30, the build fails — that's the intended behavior, and the response is to cut, not to raise the cap silently.
- [ ] Each business tool's JSON-LD emits `SoftwareApplication` + `FAQPage` + `BreadcrumbList` in one `@graph`, with `author` and `publisher` as `@id` references to the existing `${DATA.url}/#person` and `${DATA.url}/#website` nodes — verified by pasting the rendered JSON-LD into Google's Rich Results Test with zero errors.
- [ ] Every business tool has 2–3 `related` slugs; `validate.ts` confirms no dangling references; a click-through of all 10 pages reaches every other page in ≤ 2 hops.
- [ ] `BusinessCta` renders nothing before the user has produced a result (assert via a component test or manual check on first paint).
- [ ] There is no modal, no exit-intent handler, no email field, and no `localStorage` usage counter anywhere in `src/components/tools/business/` except the board edit token. `grep -rn "email" src/components/tools/business/` returns nothing.
- [ ] `tools_cta_click` fires with the tool slug and target on both links.

---

### [BUSI-12] Test harness and build gate
**Estimate:** 2h · **Depends on:** BUSI-01…BUSI-10 · **Files:** `package.json`, `vitest.config.ts`, `src/lib/tools/business/*.test.ts`

**Why** — Every ticket in this sprint is anchored on a pure function with a formula that is easy to get subtly wrong and impossible to eyeball. The math libraries are dependency-free and side-effect-free, which makes them the cheapest possible thing to test and the most expensive thing to ship broken — a wrong break-even ROAS on an indexed page is a credibility problem that outlives the fix. `vitest` is a devDependency only; it does not touch the runtime bundle.

**Implementation**

```jsonc
// package.json — additions only
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "verify": "pnpm test && pnpm build"
  },
  "devDependencies": {
    "vitest": "^2.1.9"
  }
}
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@db": resolve(__dirname, "./db"),
    },
  },
  test: {
    environment: "node",
    include: ["src/lib/tools/**/*.test.ts"],
  },
});
```

```ts
// src/lib/tools/business/cohorts.test.ts (representative — the weighting trap)
import { describe, it, expect } from "vitest";
import { buildCohortTriangle, computeRetentionSeries } from "./cohorts";

describe("buildCohortTriangle", () => {
  it("weights the average by cohort size, not by cohort count", () => {
    const t = buildCohortTriangle([
      { cohort: "2025-01", customers: [100, 50], revenue: [10000, 5000] },
      { cohort: "2025-02", customers: [10, 10], revenue: [1000, 1000] },
    ]);
    // Ratio of sums: (50 + 10) / (100 + 10) = 0.5454…
    expect(t.averageLogoRetention[1]).toBeCloseTo(0.5454, 4);
    // The naive mean-of-ratios would be 0.75. Guard against a regression to it.
    expect(t.averageLogoRetention[1]).not.toBeCloseTo(0.75, 2);
  });

  it("leaves the future half of the triangle null", () => {
    const t = buildCohortTriangle([
      { cohort: "2025-01", customers: [100, 80, 70], revenue: [1, 1, 1] },
      { cohort: "2025-02", customers: [50, 40], revenue: [1, 1] },
    ]);
    expect(t.cells[1][2]).toBeNull();
    expect(t.maxPeriods).toBe(3);
  });

  it("warns when a cohort grows month over month", () => {
    const t = buildCohortTriangle([
      { cohort: "2025-01", customers: [100, 80, 90], revenue: [1, 1, 1] },
    ]);
    expect(t.warnings.some((w) => w.includes("2025-01"))).toBe(true);
  });
});

describe("computeRetentionSeries", () => {
  it("separates GRR from NRR correctly", () => {
    const [m] = computeRetentionSeries([
      {
        month: "2025-01",
        startingMrr: 100_000,
        newMrr: 20_000,
        expansionMrr: 8_000,
        reactivationMrr: 0,
        contractionMrr: 3_000,
        churnedMrr: 5_000,
      },
    ]);
    expect(m.grr).toBeCloseTo(0.92, 5);
    expect(m.nrr).toBeCloseTo(1.0, 5);
    expect(m.quickRatio).toBeCloseTo(3.5, 5);
  });

  it("caps GRR at 100% and never lets new MRR inflate it", () => {
    const [m] = computeRetentionSeries([
      {
        month: "2025-01",
        startingMrr: 100_000,
        newMrr: 500_000,
        expansionMrr: 0,
        reactivationMrr: 0,
        contractionMrr: 0,
        churnedMrr: 0,
      },
    ]);
    expect(m.grr).toBe(1);
  });
});
```

**Acceptance criteria**
- [ ] `pnpm test` runs and passes; ≥ 30 assertions across `format`, `roas`, `roi`, `url-state`, `cohorts`, `saas-metrics`, `pricing`, `csv`.
- [ ] `vitest` appears only in `devDependencies`; `pnpm build` output size for `/tools/*` is unchanged by this ticket.
- [ ] The mean-of-ratios regression test exists and fails if `buildCohortTriangle` is reverted to a naive average (verify by temporarily breaking it).
- [ ] `pnpm verify` is the single command that gates a merge.

---

**Total: 39h** (2 + 4 + 4 + 5 + 5 + 2 + 5 + 2 + 3 + 3 + 2 + 2). Top of the band, no padding.

### Deferred from this sprint

- **Account-backed persistence** for boards and ROI scenarios. The URL/slug model covers v1; accounts are a sprint of their own and need a real auth story, not a bolt-on to the admin password cookie.
- **PNG/SVG export of the cohort triangle.** CSV export ships; image export needs `foreignObject` serialization or a canvas rasterizer and is a half-day on its own.
- **Weekly and quarterly cohort granularity.** Monthly only in v1. `cohorts.ts` takes a label string, not a Date, so this is additive later.
- **Board versioning / undo.** A single mutable document in v1. If someone overwrites a board they care about, the recovery is "you shouldn't have shared the edit token."
- **Multi-currency with FX conversion.** A currency *label* ships; conversion does not.
- **Benchmark comparison data** ("your 4% churn vs SaaS median"). Needs a defensible source; making numbers up would undo the honesty positioning that BUSI-08 is built on.
- **Embeddable iframe widget** for other people's blogs — the highest-value backlink play in the whole cluster, and its own sprint.
- **Railway-side parsing** for very large CSVs. The 60-cohort/64KB caps make this unnecessary at current traffic.

---

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Board data gets indexed by Google, exposing a user's MRR on his personal domain | Low | **Severe** | `X-Robots-Tag: noindex, nofollow` on every API response; boards addressed by `?b=` on a page whose `<link rel="canonical">` points at the bare URL; boards never enter `sitemap.ts`; explicit acceptance test asserting the header. Manually check `site:kavithakanchana.me inurl:b=` in GSC after two weeks. |
| `minPoolSize: 5` pins connections; board traffic multiplies warm lambdas and exhausts the Atlas connection cap | Medium | High | Board routes are the only new DB consumers and are low-volume. Add an Atlas alert at 60% of the connection limit before deploying BUSI-07. If it fires, drop `minPoolSize` to `0` in `db/index.ts` — cold-start cost is ~200ms on a route that already does a round trip. |
| Someone pastes customer names or emails into board labels and it lands in Mongo | Medium | Medium | Schema stores no free-text per row — cohort labels are regex-constrained to `YYYY-MM`; only `title` is free text and it's capped at 80 chars with control characters stripped. Visible notice above the paste box: "cohort labels only, no customer names." 180-day TTL bounds retention. Working delete endpoint. |
| Bundle bloat from the cohort widget pushes `/tools/*` past the Lighthouse budget | Medium | Medium | Zero new runtime dependencies by design (BUSI-05). Widget loaded via `next/dynamic` with `ssr: false`. Budget gate: first-load JS for any `/tools/*` route ≤ 130KB gzipped, checked against `pnpm build` output before merge. |
| `TOOLS.length` hits 30 and the build fails mid-sprint | Medium | Low | Counted in the Definition of Ready, not discovered at merge time. If it trips, cut from the supporting set (BUSI-10) first — those three pages have the lowest commercial value per slot. |
| The cohort math is subtly wrong on an indexed page | Medium | High | BUSI-12 pins the three specific traps (ratio-of-sums weighting, GRR clamping, compounding annualization) with regression tests. Cross-check the sample dataset's outputs by hand in a spreadsheet once, before launch, and keep that spreadsheet. |
| Rate-limit collection grows unbounded | Low | Low | `ToolQuota` has a TTL index on `expiresAt`; documents self-delete at the end of each window. Verify the index exists in Atlas, since a TTL index that was never created fails silently. |
| Edit token lost (cleared localStorage) means a board is permanently read-only | Medium | Low | Accepted trade-off, stated in the UI at save time: "Save this link — it's the only way back to editing." A "Duplicate this board" action gives an escape hatch that costs nothing. |

---

### Definition of Done

- [ ] `pnpm build` completes with **0 TypeScript errors** and 0 ESLint errors (recall: `ignoreBuildErrors` was removed in Sprint 0 — there is no escape hatch).
- [ ] `pnpm test` passes; ≥ 30 assertions across the eight math modules.
- [ ] All 10 registry entries pass `validate.ts` at module scope; `TOOLS.length ≤ 30`.
- [ ] `.next/server/app/tools/*.html` exists for all 10 slugs — every tool page is statically generated, zero function invocations on page load.
- [ ] `grep -rn "@db" src/app/\(tools\)/ src/components/tools/` returns nothing. Only `src/app/api/tools/cohort/**` touches Mongo.
- [ ] Lighthouse on `/tools/cohort-retention-calculator` (mobile, throttled): Performance ≥ 90, Accessibility = 100, Best Practices ≥ 95, SEO = 100. First-load JS ≤ 130KB gzipped.
- [ ] Cohort triangle and trend chart render correctly in light and dark, at 375px and 1280px, with no horizontal body scroll.
- [ ] JSON-LD for all 10 pages validates in Google's Rich Results Test with zero errors, and `@id` references resolve to the existing `#person` / `#website` nodes.
- [ ] Atlas shows the unique `slug` index and both TTL indexes (`cohortboards.expiresAt`, `toolquotas.expiresAt`).
- [ ] `TOOLS_IP_SALT` and `TOOLS_BOARD_TTL_DAYS` set in Vercel production and preview.
- [ ] Merged to `main`, deployed to production, and **verified on the live domain**, not just preview: create a board, open the share link in a private window, confirm read-only, confirm `X-Robots-Tag` in the response headers via `curl -I`.
- [ ] All 10 URLs submitted to Google Search Console for indexing; the indexation count recorded as the baseline for the Sprint 7 gate.

---

### Demo script

1. `pnpm verify` — tests pass, build is clean, and the build log prints `TOOLS.length = N` with N ≤ 30.
2. Open `/tools/roas-calculator`. Enter spend 10,000, revenue 22,000, gross margin 40%, 180 new customers. Confirm: ROAS `2.20x`, break-even ROAS `2.50x`, verdict **losing**, and the "ROAS above 1.0x still loses money" note is visible. Confirm CAC `$55.56` and the "CAC exceeds first-order gross profit" note when AOV is set to 100.
3. Open `/tools/roi-calculator`. Build two scenarios, watch `location.hash` change and the query string stay empty. Copy the share link, open it in a private window, confirm both scenarios reconstruct exactly. Then delete 10 characters from the middle of the hash and reload — confirm the "that link couldn't be read" warning and a clean fall back to defaults.
4. Open `/tools/cohort-retention-calculator`. Click **Load sample data** — the triangle paints immediately. Toggle to **Net revenue retention** and confirm cells above 100% switch to the blue expansion ramp. Confirm the weighted-average footer row differs from a plain mean (the smallest cohort should not be dragging it).
5. Copy a 12-cohort block out of Google Sheets and paste it. Confirm it parses without choosing a delimiter, and that a deliberately mis-typed cohort label produces a numbered warning without aborting the import.
6. Switch to the **MRR movements** tab, enter three months where month 1's closing balance doesn't match month 2's opening balance, and confirm the ledger tie-out warning names both months. Confirm GRR ≤ 100% and NRR > 100%.
7. Click **Save & share**. Confirm the URL becomes `?b=<12 chars>`, that `localStorage` holds the edit token, and that `curl -I https://kavithakanchana.me/api/tools/cohort/<slug>` returns `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store`. Open the same URL in a private window: data loads, editing is disabled, "Duplicate this board" is offered.
8. In the private window, run `fetch('/api/tools/cohort/<slug>', {method:'DELETE'})` from the console — confirm **401**. Then from the owning browser, click Delete, confirm the board is gone, and confirm a reload of the share link shows "This board no longer exists."
9. Scroll to the bottom of any business tool with a result on screen. Confirm the CTA is present, is a link and not a form, and that reloading with empty inputs makes it disappear entirely.