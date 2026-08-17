import type { ToolDef } from "../types";

/**
 * Calculators.
 *
 * Every rate in this category is supplied by the user. Nothing here embeds a
 * statutory or market figure, so nothing here can go stale or be wrong for a
 * jurisdiction. Tools that do embed real tax bands need dated citations in
 * `sources` and a review cadence — see the `Citation` type — and none of these
 * do.
 *
 * Copy is deliberately short: a one-line intro, numbered steps, three questions.
 * Someone who searched "percentage calculator" wants the calculator.
 */
export const CALCULATOR_TOOLS: readonly ToolDef[] = [
  {
    slug: "percentage-calculator",
    title: "Percentage Calculator",
    metaTitle: "Percentage Calculator — Free, No Signup",
    description:
      "Work out a percentage of a number, what share one number is of another, " +
      "or the change between two values. Shows the working. Runs in your browser.",
    category: "calculators",
    audience: ["students", "small-business", "general"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "percentage calculator",
      "what is x percent of y",
      "percentage increase calculator",
      "percentage decrease calculator",
      "percentage change formula",
      "how to calculate percentage",
    ],
    intro:
      "Three percentage calculations in one place: a percentage of a number, " +
      "what share one number is of another, and the change between two values. " +
      "Each one shows the formula it used.",
    howToUse: [
      "Pick the calculation you need from the three tabs at the top.",
      "Type your numbers into the two boxes. The answer updates as you type — there is no button to press.",
      "Read the working under the result if you need to show it or check it.",
      "Note that a change from 4% to 6% is both 2 percentage points and a 50% increase. Both are correct; pick the one you mean.",
      "Percentage changes do not cancel out: down 20% then up 20% leaves you at 96, not 100.",
    ],
    faqs: [
      {
        q: "How do I calculate a percentage of a number by hand?",
        a: "Divide the percentage by 100, then multiply. 15% of 60 is 0.15 × 60 = 9. As a mental check, 10% is the number with the decimal point moved one place left.",
      },
      {
        q: "What is the percentage increase formula?",
        a: "Subtract the old value from the new one, divide by the old value, then multiply by 100. From 80 to 100 is (100 − 80) ÷ 80 × 100 = a 25% increase. The old value is always the denominator.",
      },
      {
        q: "Does this send my numbers anywhere?",
        a: "No. The page is a static file and the arithmetic runs in your own browser. You can confirm it by turning off your connection and using it offline.",
      },
    ],
    related: ["loan-calculator"],
  },

  {
    slug: "loan-calculator",
    title: "Loan and EMI Calculator",
    metaTitle: "Loan & EMI Calculator",
    description:
      "Find the monthly instalment on any loan and see the full repayment " +
      "schedule, month by month, with interest and principal split out.",
    category: "calculators",
    audience: ["small-business", "general", "sri-lanka"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "loan calculator",
      "emi calculator",
      "monthly instalment calculator",
      "amortisation schedule",
      "loan interest calculator",
      "mortgage payment calculator",
    ],
    intro:
      "Enter the amount, the annual rate and the term, and get the monthly " +
      "instalment plus a full month-by-month schedule showing how much of each " +
      "payment goes to interest and how much clears the balance.",
    howToUse: [
      "Enter the loan amount you are borrowing.",
      "Enter the annual interest rate as a percentage — 12.5, not 0.125.",
      "Set the term in years or months, whichever your lender quoted.",
      "Read the monthly instalment, then open the schedule to see the interest and principal split for each month.",
      "Use the total interest figure to compare offers — a longer term lowers the monthly payment and raises what you pay overall.",
    ],
    faqs: [
      {
        q: "What is EMI?",
        a: "Equated Monthly Instalment — a fixed monthly payment covering both interest and principal, so the loan clears exactly at the end of the term. It is the standard structure for personal, vehicle and home loans.",
      },
      {
        q: "Why does the early payment barely reduce my balance?",
        a: "Interest is charged on the outstanding balance, which is largest at the start. Early instalments are mostly interest; the principal share grows every month. The schedule shows the crossover.",
      },
      {
        q: "Does this match what my bank will quote?",
        a: "The instalment maths is standard and should match closely. Your bank may add processing fees, insurance or a different day-count convention, so treat this as an estimate rather than an offer.",
      },
    ],
    related: ["percentage-calculator"],
  },

];
