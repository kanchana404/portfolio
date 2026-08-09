"use client";

import { useId, useMemo, useState } from "react";
import { StatTile, ToolInput, ToolLabel, ToolSelect } from "@/components/tools/ui";
import { computeCompound } from "@/lib/tools/math/finance";
import { parseDecimal } from "@/lib/tools/math/percentage";

const money = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const FREQUENCIES = [
  { value: 1, label: "Yearly" },
  { value: 2, label: "Half-yearly" },
  { value: 4, label: "Quarterly" },
  { value: 12, label: "Monthly" },
  { value: 365, label: "Daily" },
] as const;

export default function CompoundInterestCalculator() {
  const id = useId();
  const [principal, setPrincipal] = useState("100,000");
  const [rate, setRate] = useState("8");
  const [years, setYears] = useState("10");
  const [frequency, setFrequency] = useState(12);
  const [contribution, setContribution] = useState("5,000");

  const result = useMemo(() => {
    const p = parseDecimal(principal);
    const r = parseDecimal(rate);
    const y = parseDecimal(years);
    const c = parseDecimal(contribution) ?? 0;
    if (p === null || r === null || y === null) return null;
    return computeCompound({
      principal: p,
      annualRatePercent: r,
      years: y,
      compoundsPerYear: frequency,
      contributionPerPeriod: c,
    });
  }, [principal, rate, years, frequency, contribution]);

  return (
    <div className="rounded-lg border">
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <ToolLabel htmlFor={`${id}-p`}>Starting amount</ToolLabel>
          <ToolInput
            id={`${id}-p`}
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            inputMode="decimal"
            className="mt-2 tabular-nums"
          />
        </div>
        <div>
          <ToolLabel htmlFor={`${id}-r`}>Annual rate</ToolLabel>
          <div className="relative mt-2">
            <ToolInput
              id={`${id}-r`}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="decimal"
              className="pr-8 tabular-nums"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
            >
              %
            </span>
          </div>
        </div>
        <div>
          <ToolLabel htmlFor={`${id}-y`}>Years</ToolLabel>
          <ToolInput
            id={`${id}-y`}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            inputMode="decimal"
            className="mt-2 tabular-nums"
          />
        </div>
        <div>
          <ToolLabel htmlFor={`${id}-f`}>Compounded</ToolLabel>
          <ToolSelect
            id={`${id}-f`}
            value={String(frequency)}
            onChange={(e) => setFrequency(Number(e.target.value))}
            className="mt-2"
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </ToolSelect>
        </div>
        <div className="sm:col-span-2">
          <ToolLabel htmlFor={`${id}-c`}>
            Added every period (leave at 0 for a lump sum)
          </ToolLabel>
          <ToolInput
            id={`${id}-c`}
            value={contribution}
            onChange={(e) => setContribution(e.target.value)}
            inputMode="decimal"
            className="mt-2 tabular-nums"
          />
        </div>
      </div>

      <div className="border-t p-4 sm:p-5" aria-live="polite" aria-atomic="true">
        {result === null ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Enter a starting amount, a rate and a number of years.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Final balance" value={money(result.futureValue)} />
              <StatTile label="You put in" value={money(result.totalContributed)} />
              <StatTile label="Interest earned" value={money(result.totalInterest)} />
              <StatTile
                label="Effective rate"
                value={`${(result.effectiveAnnualRate * 100).toFixed(2)}%`}
                hint="per year, after compounding"
              />
            </div>

            <div className="mt-4 max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-right text-xs tabular-nums">
                <caption className="sr-only">Balance at the end of each year</caption>
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th scope="col" className="p-2 text-left font-medium">Year</th>
                    <th scope="col" className="p-2 font-medium">Paid in</th>
                    <th scope="col" className="p-2 font-medium">Interest</th>
                    <th scope="col" className="p-2 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {result.byYear.map((row) => (
                    <tr key={row.year} className="border-b last:border-0">
                      <th scope="row" className="p-2 text-left font-normal">{row.year}</th>
                      <td className="p-2 text-muted-foreground">{money(row.contributed)}</td>
                      <td className="p-2 text-muted-foreground">{money(row.interest)}</td>
                      <td className="p-2">{money(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
