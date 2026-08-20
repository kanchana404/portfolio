"use client";

import { useId, useMemo, useState } from "react";
import { StatTile, ToolInput, ToolLabel, ToolSelect } from "@/components/tools/ui";
import { computeLoan } from "@/lib/tools/math/finance";
import { parseDecimal } from "@/lib/tools/math/percentage";

const money = (n: number): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LoanCalculator() {
  const id = useId();
  const [amount, setAmount] = useState("1,000,000");
  const [rate, setRate] = useState("12");
  const [term, setTerm] = useState("5");
  const [termUnit, setTermUnit] = useState<"years" | "months">("years");
  const [showSchedule, setShowSchedule] = useState(false);

  const result = useMemo(() => {
    const principal = parseDecimal(amount);
    const annualRatePercent = parseDecimal(rate);
    const termValue = parseDecimal(term);
    if (principal === null || annualRatePercent === null || termValue === null) {
      return null;
    }
    const months = termUnit === "years" ? termValue * 12 : termValue;
    return computeLoan({ principal, annualRatePercent, months });
  }, [amount, rate, term, termUnit]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <ToolLabel htmlFor={`${id}-amount`}>Amount borrowed</ToolLabel>
          <ToolInput
            id={`${id}-amount`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="mt-2 tabular-nums"
          />
        </div>
        <div>
          <ToolLabel htmlFor={`${id}-rate`}>Annual interest rate</ToolLabel>
          <div className="relative mt-2">
            <ToolInput
              id={`${id}-rate`}
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
          <ToolLabel htmlFor={`${id}-term`}>Term</ToolLabel>
          <div className="mt-2 flex gap-2">
            <ToolInput
              id={`${id}-term`}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              inputMode="decimal"
              className="tabular-nums"
            />
            <ToolSelect
              value={termUnit}
              onChange={(e) => setTermUnit(e.target.value as "years" | "months")}
              aria-label="Term unit"
              className="w-28"
            >
              <option value="years">years</option>
              <option value="months">months</option>
            </ToolSelect>
          </div>
        </div>
      </div>

      <div className="border-t p-4 sm:p-5" aria-live="polite" aria-atomic="true">
        {result === null ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Enter an amount, a rate and a term to see the instalment.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <StatTile label="Per month" value={money(result.monthlyPayment)} />
              <StatTile label="Total repaid" value={money(result.totalPaid)} />
              <StatTile label="Total interest" value={money(result.totalInterest)} />
              <StatTile
                label="Interest cost"
                value={`${(result.interestRatio * 100).toFixed(1)}%`}
                hint="of the amount borrowed"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowSchedule((v) => !v)}
              aria-expanded={showSchedule}
              className="mt-4 text-sm font-medium underline underline-offset-4"
            >
              {showSchedule ? "Hide" : "Show"} the month-by-month schedule
            </button>

            {showSchedule ? (
              <div className="mt-3 max-h-96 overflow-auto rounded-md border">
                <table className="w-full text-right text-xs tabular-nums">
                  <caption className="sr-only">
                    Amortisation schedule: how each instalment splits between
                    interest and principal.
                  </caption>
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-muted-foreground">
                      <th scope="col" className="p-2 text-left font-medium">Month</th>
                      <th scope="col" className="p-2 font-medium">Payment</th>
                      <th scope="col" className="p-2 font-medium">Interest</th>
                      <th scope="col" className="p-2 font-medium">Principal</th>
                      <th scope="col" className="p-2 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.schedule.map((row) => (
                      <tr key={row.month} className="border-b last:border-0">
                        <th scope="row" className="p-2 text-left font-normal">
                          {row.month}
                        </th>
                        <td className="p-2">{money(row.payment)}</td>
                        <td className="p-2 text-muted-foreground">{money(row.interest)}</td>
                        <td className="p-2">{money(row.principal)}</td>
                        <td className="p-2">{money(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
