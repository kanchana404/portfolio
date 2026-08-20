/**
 * Cron expressions: what they mean, and when they next fire.
 *
 * Five fields, in the order minute, hour, day-of-month, month, day-of-week.
 *
 * The rule worth knowing, and the reason this file computes runs rather than
 * only describing fields: **when both day-of-month and day-of-week are
 * restricted, they are OR-ed, not AND-ed.** `0 0 13 * 5` is not "Friday the
 * 13th", it is "the 13th of any month, and also every Friday" — roughly five
 * times as often as intended. POSIX specifies this and every implementation
 * follows it, and it is the single most common way a schedule is wrong in
 * production. If either field is `*`, the other simply applies.
 */

export interface CronField {
  name: string;
  /** Every matching value, ascending. */
  values: number[];
  /** True when the field was `*`, which changes the day-of-week rule below. */
  wildcard: boolean;
  text: string;
}

export interface CronParse {
  ok: boolean;
  error?: string;
  fields?: CronField[];
  description?: string;
}

const RANGES: Array<[string, number, number]> = [
  ["minute", 0, 59],
  ["hour", 0, 23],
  ["day of month", 1, 31],
  ["month", 1, 12],
  ["day of week", 0, 6],
];

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const DAY_LABEL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_LABEL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/** Common shorthands, expanded before parsing. */
const ALIASES: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

function namesToNumbers(token: string, index: number): string {
  if (index === 3) {
    return token.replace(/[A-Z]{3}/g, (m) => {
      const i = MONTHS.indexOf(m);
      return i === -1 ? m : String(i + 1);
    });
  }
  if (index === 4) {
    return token.replace(/[A-Z]{3}/g, (m) => {
      const i = DAYS.indexOf(m);
      return i === -1 ? m : String(i);
    });
  }
  return token;
}

function parseField(raw: string, index: number): CronField | string {
  const [name, min, max] = RANGES[index];
  const token = namesToNumbers(raw.toUpperCase(), index);
  const wildcard = token === "*";
  const values = new Set<number>();

  for (const part of token.split(",")) {
    if (!part) return `The ${name} field has an empty entry.`;

    const [spec, stepText] = part.split("/");
    const step = stepText === undefined ? 1 : Number(stepText);
    if (stepText !== undefined && (!Number.isInteger(step) || step < 1)) {
      return `The ${name} step "/${stepText}" must be a whole number of 1 or more.`;
    }

    let from: number;
    let to: number;
    if (spec === "*" || spec === "") {
      from = min;
      to = max;
    } else if (spec.includes("-")) {
      const [a, b] = spec.split("-").map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b)) return `"${part}" is not a valid ${name}.`;
      from = a;
      to = b;
    } else {
      const n = Number(spec);
      if (!Number.isInteger(n)) return `"${part}" is not a valid ${name}.`;
      // Sunday is 0, but 7 is accepted everywhere and means the same day.
      from = index === 4 && n === 7 ? 0 : n;
      to = from;
    }

    if (from < min || to > max || from > to) {
      return `The ${name} must be between ${min} and ${max}, but "${part}" is not.`;
    }
    for (let v = from; v <= to; v += step) values.add(v);
  }

  return { name, values: [...values].sort((a, b) => a - b), wildcard, text: raw };
}

function listOf(values: number[], labels?: string[]): string {
  const shown = values.map((v) => (labels ? labels[v] : String(v)));
  if (shown.length === 1) return shown[0];
  if (shown.length === 2) return `${shown[0]} and ${shown[1]}`;
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

function describe(f: CronField[]): string {
  const [minute, hour, dom, month, dow] = f;

  let time: string;
  if (minute.wildcard && hour.wildcard) time = "Every minute";
  else if (hour.wildcard) time = `At minute ${listOf(minute.values)} of every hour`;
  else if (minute.wildcard) time = `Every minute of hour ${listOf(hour.values)}`;
  else if (minute.values.length === 1 && hour.values.length === 1) {
    time = `At ${String(hour.values[0]).padStart(2, "0")}:${String(minute.values[0]).padStart(2, "0")}`;
  } else {
    time = `At minute ${listOf(minute.values)} past hour ${listOf(hour.values)}`;
  }

  const parts: string[] = [];
  if (!dom.wildcard) parts.push(`on day ${listOf(dom.values)} of the month`);
  if (!dow.wildcard) parts.push(`on ${listOf(dow.values, DAY_LABEL)}`);
  if (!month.wildcard) parts.push(`in ${listOf(month.values, MONTH_LABEL)}`);

  // The OR is stated in words, because this is the trap.
  const joined =
    !dom.wildcard && !dow.wildcard
      ? `${parts[0]} OR ${parts.slice(1).join(", ")}`
      : parts.join(", ");

  return joined ? `${time}, ${joined}.` : `${time}, every day.`;
}

export function parseCron(input: string): CronParse {
  const trimmed = input.trim().toLowerCase();
  const expanded = ALIASES[trimmed] ?? input.trim();
  const tokens = expanded.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return { ok: false, error: "Enter a cron expression." };
  if (tokens.length !== 5) {
    return {
      ok: false,
      error: `A cron expression has 5 fields (minute hour day-of-month month day-of-week). This has ${tokens.length}.`,
    };
  }

  const fields: CronField[] = [];
  for (let i = 0; i < 5; i += 1) {
    const out = parseField(tokens[i], i);
    if (typeof out === "string") return { ok: false, error: out };
    fields.push(out);
  }
  return { ok: true, fields, description: describe(fields) };
}

/**
 * The next `count` times this fires, at or after `from`.
 *
 * Brute force by the minute, capped at four years of candidates. A closed-form
 * search would be faster and much easier to get subtly wrong; four years of
 * minutes is about two million iterations, which is milliseconds, and the cap
 * is what stops an impossible schedule such as `0 0 30 2 *` looping forever.
 */
export function nextRuns(fields: CronField[], from: Date, count = 5): Date[] {
  const [minute, hour, dom, month, dow] = fields;
  const out: Date[] = [];
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  const LIMIT = 4 * 366 * 24 * 60;
  for (let i = 0; i < LIMIT && out.length < count; i += 1) {
    const matchesDom = dom.values.includes(d.getDate());
    const matchesDow = dow.values.includes(d.getDay());
    // The OR, in code. Both restricted means either may satisfy it.
    const dayOk =
      dom.wildcard || dow.wildcard ? matchesDom && matchesDow : matchesDom || matchesDow;

    if (
      minute.values.includes(d.getMinutes()) &&
      hour.values.includes(d.getHours()) &&
      month.values.includes(d.getMonth() + 1) &&
      dayOk
    ) {
      out.push(new Date(d.getTime()));
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return out;
}
