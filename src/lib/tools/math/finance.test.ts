import { describe, expect, it } from "vitest";
import { computeCompound, computeLoan } from "./finance";

describe("computeLoan", () => {
  it("matches a hand-checkable EMI", () => {
    // 100,000 over 12 months at 12% nominal (1% per month) is a textbook case.
    const r = computeLoan({ principal: 100_000, annualRatePercent: 12, months: 12 });
    expect(r).not.toBeNull();
    expect(r!.monthlyPayment).toBeCloseTo(8884.88, 1);
    expect(r!.totalPaid).toBeCloseTo(106_618.55, 0);
  });

  it("handles a 0% loan instead of returning NaN", () => {
    // The formula's numerator and denominator both collapse to zero at r = 0.
    // Interest-free instalment plans are real and most calculators break here.
    const r = computeLoan({ principal: 12_000, annualRatePercent: 0, months: 12 });
    expect(r).not.toBeNull();
    expect(r!.monthlyPayment).toBe(1000);
    expect(r!.totalInterest).toBeCloseTo(0, 6);
    expect(Number.isNaN(r!.monthlyPayment)).toBe(false);
  });

  it("amortises to exactly zero", () => {
    const r = computeLoan({ principal: 250_000, annualRatePercent: 7.5, months: 60 });
    expect(r).not.toBeNull();
    const last = r!.schedule[r!.schedule.length - 1];
    expect(last.balance).toBeCloseTo(0, 6);
    expect(r!.schedule).toHaveLength(60);
  });

  it("shifts from interest to principal over the term", () => {
    const r = computeLoan({ principal: 1_000_000, annualRatePercent: 10, months: 240 });
    const first = r!.schedule[0];
    const last = r!.schedule[r!.schedule.length - 1];
    // The defining shape of an amortising loan, and the thing the schedule is
    // there to show.
    expect(first.interest).toBeGreaterThan(first.principal);
    expect(last.principal).toBeGreaterThan(last.interest);
  });

  it("has a schedule whose payments sum to the reported total", () => {
    const r = computeLoan({ principal: 50_000, annualRatePercent: 9, months: 24 });
    const summed = r!.schedule.reduce((s, row) => s + row.payment, 0);
    expect(summed).toBeCloseTo(r!.totalPaid, 6);
  });

  // Regression: the schedule used to carry full float precision and was only
  // rounded at render time, so a row could display 8,884.88 = 833.33 + 8,051.54
  // — which is 8,884.87. 17 of 60 rows failed to reconcile on the loan
  // calculator's own default inputs. Every value is now rounded to the cent
  // before it is stored, so what the user reads is what was computed.
  it.each([
    { principal: 1_000_000, annualRatePercent: 12, months: 60 },
    { principal: 100_000, annualRatePercent: 12, months: 12 },
    { principal: 250_000, annualRatePercent: 7.5, months: 60 },
    { principal: 50_000, annualRatePercent: 0, months: 18 },
  ])(
    "every row reconciles as displayed: $principal at $annualRatePercent% over $months months",
    (input) => {
      const r = computeLoan(input)!;
      const cents = (n: number) => Math.round(n * 100);

      for (const row of r.schedule) {
        // payment === interest + principal, to the cent, with no tolerance.
        expect(cents(row.payment)).toBe(cents(row.interest) + cents(row.principal));
      }

      const summed = r.schedule.reduce((s, row) => s + cents(row.payment), 0);
      expect(summed).toBe(cents(r.totalPaid));

      const interestSum = r.schedule.reduce((s, row) => s + cents(row.interest), 0);
      expect(interestSum).toBe(cents(r.totalInterest));

      // The loan is fully repaid: the final balance is exactly zero, not ~1e-9.
      expect(r.schedule[r.schedule.length - 1].balance).toBe(0);
    },
  );

  it("charges more interest over a longer term at the same rate", () => {
    const short = computeLoan({ principal: 100_000, annualRatePercent: 10, months: 12 })!;
    const long = computeLoan({ principal: 100_000, annualRatePercent: 10, months: 60 })!;
    expect(long.totalInterest).toBeGreaterThan(short.totalInterest);
    expect(long.monthlyPayment).toBeLessThan(short.monthlyPayment);
  });

  it("refuses nonsense rather than returning a confident wrong number", () => {
    expect(computeLoan({ principal: 0, annualRatePercent: 10, months: 12 })).toBeNull();
    expect(computeLoan({ principal: -5, annualRatePercent: 10, months: 12 })).toBeNull();
    expect(computeLoan({ principal: 100, annualRatePercent: -1, months: 12 })).toBeNull();
    expect(computeLoan({ principal: 100, annualRatePercent: 10, months: 0 })).toBeNull();
    expect(
      computeLoan({ principal: Number.NaN, annualRatePercent: 10, months: 12 })
    ).toBeNull();
  });
});

describe("computeCompound", () => {
  it("matches the textbook lump-sum result", () => {
    // 1000 at 5% compounded annually for 10 years = 1000 * 1.05^10
    const r = computeCompound({
      principal: 1000,
      annualRatePercent: 5,
      years: 10,
      compoundsPerYear: 1,
      contributionPerPeriod: 0,
    });
    expect(r!.futureValue).toBeCloseTo(1628.89, 2);
    expect(r!.totalContributed).toBe(1000);
  });

  it("compounds more often for more money at the same nominal rate", () => {
    const annual = computeCompound({
      principal: 1000, annualRatePercent: 12, years: 1,
      compoundsPerYear: 1, contributionPerPeriod: 0,
    })!;
    const monthly = computeCompound({
      principal: 1000, annualRatePercent: 12, years: 1,
      compoundsPerYear: 12, contributionPerPeriod: 0,
    })!;
    expect(monthly.futureValue).toBeGreaterThan(annual.futureValue);
    expect(monthly.effectiveAnnualRate).toBeCloseTo(0.1268, 3);
  });

  it("handles a 0% account, where the answer is simply the money paid in", () => {
    const r = computeCompound({
      principal: 100, annualRatePercent: 0, years: 2,
      compoundsPerYear: 12, contributionPerPeriod: 50,
    })!;
    expect(r.futureValue).toBeCloseTo(100 + 50 * 24, 6);
    expect(r.totalInterest).toBeCloseTo(0, 6);
  });

  it("accounts for regular contributions", () => {
    const r = computeCompound({
      principal: 0, annualRatePercent: 6, years: 10,
      compoundsPerYear: 12, contributionPerPeriod: 100,
    })!;
    expect(r.totalContributed).toBeCloseTo(12_000, 6);
    expect(r.futureValue).toBeGreaterThan(r.totalContributed);
    expect(r.totalInterest).toBeCloseTo(r.futureValue - r.totalContributed, 6);
  });

  it("reports a yearly snapshot per year", () => {
    const r = computeCompound({
      principal: 1000, annualRatePercent: 5, years: 5,
      compoundsPerYear: 12, contributionPerPeriod: 0,
    })!;
    expect(r.byYear).toHaveLength(5);
    expect(r.byYear[4].year).toBe(5);
  });

  it("refuses nonsense", () => {
    expect(
      computeCompound({ principal: -1, annualRatePercent: 5, years: 1, compoundsPerYear: 1, contributionPerPeriod: 0 })
    ).toBeNull();
    expect(
      computeCompound({ principal: 100, annualRatePercent: 5, years: 0, compoundsPerYear: 1, contributionPerPeriod: 0 })
    ).toBeNull();
    expect(
      computeCompound({ principal: 100, annualRatePercent: 5, years: 1, compoundsPerYear: 0, contributionPerPeriod: 0 })
    ).toBeNull();
  });
});
