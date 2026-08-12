/**
 * Loan and savings arithmetic.
 *
 * No statutory or market rates live in this file, and that is deliberate. Every
 * rate is supplied by the user, so nothing here can go stale, be wrong for a
 * jurisdiction, or need re-verifying against a regulator's PDF. Tools that
 * embed real tax bands or bank rates need dated citations and a review cadence;
 * these do not.
 */

export interface LoanInput {
  /** Amount borrowed. */
  principal: number;
  /** Nominal annual rate as a percentage, e.g. 12.5 for 12.5%. */
  annualRatePercent: number;
  /** Term in months. */
  months: number;
}

export interface AmortisationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface LoanResult {
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
  /** Total interest as a share of the amount borrowed. */
  interestRatio: number;
  schedule: AmortisationRow[];
}

/**
 * Equated monthly instalment.
 *
 *     EMI = P · r · (1+r)^n / ((1+r)^n − 1)
 *
 * where `r` is the monthly rate and `n` the number of months.
 *
 * The zero-rate case has to be special-cased. At r = 0 both the numerator and
 * denominator collapse to zero and the formula yields NaN, when the correct
 * answer is simply P/n. An interest-free instalment plan is a real thing people
 * put into these calculators, and most of them return NaN for it.
 */
export function computeLoan(input: LoanInput): LoanResult | null {
  const { principal, annualRatePercent, months } = input;

  if (!Number.isFinite(principal) || principal <= 0) return null;
  if (!Number.isFinite(months) || months < 1) return null;
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) return null;

  const n = Math.round(months);
  const r = annualRatePercent / 100 / 12;

  const exactPayment =
    r === 0
      ? principal / n
      : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  if (!Number.isFinite(exactPayment)) return null;

  /** Round to the cent. Money is displayed to 2dp, so it must be computed to 2dp. */
  const cents = (n: number): number => Math.round(n * 100) / 100;

  const monthlyPayment = cents(exactPayment);

  // The schedule is generated rather than derived, because rounding each month
  // to the cent and carrying the remainder is what makes the final balance land
  // on exactly zero — a closed-form total drifts by a few cents over 30 years.
  const schedule: AmortisationRow[] = [];
  let balance = principal;
  let totalPaid = 0;
  let totalInterest = 0;

  for (let month = 1; month <= n; month++) {
    const interest = cents(balance * r);
    // Final instalment clears whatever is left, absorbing accumulated rounding.
    const payment = month === n ? cents(balance + interest) : monthlyPayment;
    // Every row is rounded before it is stored, so `payment` reconciles against
    // `interest + principal` exactly as displayed. Rounding only at render time
    // is what made 17 of 60 rows fail to add up.
    const principalPart = cents(payment - interest);
    balance = cents(Math.max(0, balance - principalPart));
    totalPaid = cents(totalPaid + payment);
    totalInterest = cents(totalInterest + interest);
    schedule.push({ month, payment, interest, principal: principalPart, balance });
  }

  return {
    // Totals are accumulated from the already-rounded rows, so the summary tiles
    // agree with the schedule instead of drifting a few cents away from it.
    monthlyPayment,
    totalPaid,
    totalInterest,
    interestRatio: totalInterest / principal,
    schedule,
  };
}

export interface CompoundInput {
  /** Starting balance. May be zero if you are only contributing. */
  principal: number;
  /** Nominal annual rate as a percentage. */
  annualRatePercent: number;
  /** Years invested. */
  years: number;
  /** Compounding periods per year: 1, 4, 12, 365. */
  compoundsPerYear: number;
  /** Added every compounding period. Zero for a lump sum. */
  contributionPerPeriod: number;
}

export interface CompoundResult {
  futureValue: number;
  totalContributed: number;
  totalInterest: number;
  /** Annual snapshots, for the growth table. */
  byYear: Array<{ year: number; balance: number; contributed: number; interest: number }>;
  /** The rate actually earned once compounding is accounted for. */
  effectiveAnnualRate: number;
}

/**
 * Compound growth with optional regular contributions.
 *
 *     FV = P(1+i)^N + C · ((1+i)^N − 1) / i
 *
 * The second term is the future value of an ordinary annuity, and it too
 * degenerates at i = 0 — where the right answer is just `C · N`, the money you
 * put in. A savings calculator that cannot model a 0% account is a savings
 * calculator that breaks on the most common savings account there is.
 */
export function computeCompound(input: CompoundInput): CompoundResult | null {
  const { principal, annualRatePercent, years, compoundsPerYear, contributionPerPeriod } =
    input;

  if (!Number.isFinite(principal) || principal < 0) return null;
  if (!Number.isFinite(years) || years <= 0) return null;
  if (!Number.isFinite(compoundsPerYear) || compoundsPerYear < 1) return null;
  if (!Number.isFinite(annualRatePercent)) return null;
  if (!Number.isFinite(contributionPerPeriod) || contributionPerPeriod < 0) return null;

  const m = Math.round(compoundsPerYear);
  const i = annualRatePercent / 100 / m;
  const totalPeriods = Math.round(years * m);
  if (totalPeriods < 1) return null;

  const byYear: CompoundResult["byYear"] = [];
  let balance = principal;
  let contributed = principal;

  for (let period = 1; period <= totalPeriods; period++) {
    balance = balance * (1 + i) + contributionPerPeriod;
    contributed += contributionPerPeriod;
    if (period % m === 0 || period === totalPeriods) {
      byYear.push({
        year: Math.round((period / m) * 10) / 10,
        balance,
        contributed,
        interest: balance - contributed,
      });
    }
  }

  if (!Number.isFinite(balance)) return null;

  return {
    futureValue: balance,
    totalContributed: contributed,
    totalInterest: balance - contributed,
    byYear,
    // (1 + nominal/m)^m − 1. This is the number that makes "5% compounded
    // monthly" comparable with "5.1% compounded annually".
    effectiveAnnualRate: Math.pow(1 + i, m) - 1,
  };
}
