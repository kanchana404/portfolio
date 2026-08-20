/**
 * The distance between two dates, in the units people actually ask for.
 *
 * Three things make this harder than subtraction, and all three are why the
 * arithmetic here is done on UTC calendar parts rather than on timestamps.
 *
 * 1. **Daylight saving.** Two local midnights 24 hours apart are 23 or 25 hours
 *    apart twice a year. Subtracting local timestamps and dividing by 86.4
 *    million therefore returns 0.958 days, which floors to 0. Every date-only
 *    calculation here is done at UTC midnight, where the offset cannot move.
 *
 * 2. **Months are not 30 days.** "How many months between 31 January and
 *    28 February" has no arithmetic answer, it has a *convention*: count whole
 *    calendar months, then whatever days are left. That is what a person means
 *    by "1 month and 3 days" and it is not `days / 30`.
 *
 *    The convention chosen is **clamping**: 31 January to 28 February is one
 *    month, because 31 January plus one month is 28 February. The alternative,
 *    strict counting, would call it 28 days on the grounds that the 31st never
 *    came round. Clamping is chosen because it round-trips: adding the reported
 *    parts back to the start returns the end date, and a duration you cannot
 *    add back will eventually disagree with whatever produced it.
 *
 * 3. **Inclusive counting.** "How many days until Friday" and "how many days is
 *    Monday to Friday inclusive" differ by one, and both are asked constantly.
 *    Both are reported rather than one being guessed at.
 */

export interface DateParts {
  years: number;
  months: number;
  days: number;
}

export interface DateDiff {
  ok: boolean;
  error?: string;
  /** Calendar breakdown: 1 year, 2 months, 3 days. */
  parts?: DateParts;
  /** Whole days between the two dates, exclusive of the start. */
  totalDays?: number;
  /** Days counting both endpoints, which is what "inclusive" means. */
  inclusiveDays?: number;
  totalWeeks?: number;
  weekdays?: number;
  /** Negative when the second date is earlier. */
  direction?: "forward" | "backward" | "same";
}

/** Parses YYYY-MM-DD as a UTC date, avoiding the local-timezone shift. */
export function parseDateOnly(input: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const ms = Date.UTC(year, month - 1, day);
  const back = new Date(ms);
  // Date.UTC rolls 31 February over into March rather than failing, so the only
  // way to reject an impossible date is to check it survived the round trip.
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

const DAY = 86_400_000;

/** Adds calendar months, clamping to the end of a short month. */
export function addMonths(ms: number, count: number): number {
  const d = new Date(ms);
  const targetMonth = d.getUTCMonth() + count;
  const year = d.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // 31 January plus one month is 28 or 29 February, not 3 March.
  return Date.UTC(year, month, Math.min(d.getUTCDate(), lastDay));
}


/** Whole weekdays between two UTC midnights, excluding the start date. */
function countWeekdays(fromMs: number, toMs: number): number {
  let count = 0;
  for (let t = fromMs + DAY; t <= toMs; t += DAY) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

export function diffDates(fromInput: string, toInput: string): DateDiff {
  const from = parseDateOnly(fromInput);
  const to = parseDateOnly(toInput);
  if (from === null) return { ok: false, error: "The first date is not a real date. Use YYYY-MM-DD." };
  if (to === null) return { ok: false, error: "The second date is not a real date. Use YYYY-MM-DD." };

  const forward = to >= from;
  const [a, b] = forward ? [from, to] : [to, from];

  const totalDays = Math.round((b - a) / DAY);

  // Calendar breakdown, derived from `addMonths` rather than from a borrow.
  //
  // The obvious implementation subtracts the date parts and, when days goes
  // negative, borrows the length of the preceding month. That is wrong wherever
  // the start day does not exist in the target month. From 31 March to 1 May it
  // borrows April's 30 and reports one month exactly, but 31 March plus one
  // month is 30 April, and 30 April to 1 May is a day. The right answer is one
  // month and one day, and the borrow cannot see the clamp that produced it.
  //
  // So the month count is the largest number of whole calendar months that
  // still lands on or before the end date, and the remainder is measured from
  // wherever that landed. `addMonths` already clamps, so the two agree by
  // construction.
  let whole = 0;
  while (addMonths(a, whole + 1) <= b) whole += 1;
  const anchor = addMonths(a, whole);

  const years = Math.floor(whole / 12);
  const months = whole % 12;
  const days = Math.round((b - anchor) / DAY);

  return {
    ok: true,
    parts: { years, months, days },
    totalDays,
    inclusiveDays: totalDays + 1,
    totalWeeks: Math.floor(totalDays / 7),
    weekdays: countWeekdays(a, b),
    direction: totalDays === 0 ? "same" : forward ? "forward" : "backward",
  };
}
