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
    metaTitle: "Percentage Calculator",
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
      "Type your numbers into the two boxes. The answer updates as you type. There is no button to press.",
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
      "Enter the annual interest rate as a percentage (12.5, not 0.125).",
      "Set the term in years or months, whichever your lender quoted.",
      "Read the monthly instalment, then open the schedule to see the interest and principal split for each month.",
      "Use the total interest figure to compare offers. A longer term lowers the monthly payment and raises what you pay overall.",
    ],
    faqs: [
      {
        q: "What is EMI?",
        a: "Equated Monthly Instalment: a fixed monthly payment covering both interest and principal, so the loan clears exactly at the end of the term. It is the standard structure for personal, vehicle and home loans.",
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

  {
    slug: "date-difference",
    title: "Date Difference Calculator",
    metaTitle: "Days Between Two Dates",
    description:
      "Count the days, weeks, weekdays and calendar months between two dates, " +
      "with inclusive and exclusive totals given separately.",
    category: "calculators",
    audience: ["general", "developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "days between dates",
      "date difference calculator",
      "date duration",
      "weekdays between dates",
      "how many days until",
    ],
    intro:
      "Pick two dates and read the gap in every unit at once. Weekends are " +
      "counted separately from working days, and both the inclusive and the " +
      "exclusive day count are shown, because those differ by one and both get " +
      "asked for.",
    howToUse: [
      "Set the two dates. Order does not matter; a backwards range is reported as such.",
      "Days is the plain gap. Days inclusive counts both endpoints, which is what a booking usually means.",
      "Weekdays skips Saturdays and Sundays.",
      "The calendar line counts whole months, not thirty-day blocks.",
      "Everything updates as you change either date.",
    ],
    faqs: [
      {
        q: "Why do two calculators disagree by a day?",
        a: "One is counting inclusively and the other is not. Monday to Friday is four days apart and five days inclusive. Both numbers are shown here so you can pick the one your question means.",
      },
      {
        q: "How are months counted?",
        a: "As whole calendar months, then whatever days remain. Not as thirty-day blocks, which is why 15 January to 18 March is two months and three days rather than two months and two.",
      },
      {
        q: "Is 31 January to 28 February one month?",
        a: "Here, yes. Adding one month to the 31st clamps to the 28th, so the parts add back to the end date exactly. Strict counting would call it 28 days instead. The day count is 28 either way.",
      },
      {
        q: "Does daylight saving affect the result?",
        a: "No. Dates are compared at UTC midnight, so a clock change cannot make two days 23 hours apart and round the answer down to zero, which is the usual bug.",
      },
    ],
    related: ["percentage-calculator", "timestamp-converter"],
  },

  {
    slug: "data-size-converter",
    title: "Data Size Converter",
    metaTitle: "MB to GB Converter (and GiB)",
    description:
      "Convert between bytes, kB, MB, GB and their binary counterparts KiB, " +
      "MiB and GiB, and see why a drive never holds the number on the box.",
    category: "calculators",
    audience: ["developers", "general"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "mb to gb",
      "data size converter",
      "gb to gib",
      "bytes to mb",
      "kb vs kib",
      "storage size calculator",
    ],
    intro:
      "There are two systems using nearly the same abbreviations: one counts in " +
      "thousands, the other in 1024s. Enter a size in either and see it in both, " +
      "along with how far apart they are at that scale.",
    howToUse: [
      "Type the size and pick its unit.",
      "Choose which system that unit belongs to: decimal counts in 1000s, binary in 1024s.",
      "Read the byte count and both interpretations underneath.",
      "The percentage line is the gap between the systems at that magnitude.",
      "Copy any row with the button beside it.",
    ],
    faqs: [
      {
        q: "Why does my 500 GB drive show 465 GB?",
        a: "Both numbers are right. The drive holds 500 billion bytes as advertised, then the operating system divides by 1024 three times and still writes GB. The correct label for 465 is GiB.",
      },
      {
        q: "What is the difference between GB and GiB?",
        a: "A GB is a billion bytes. A GiB is 1024 cubed, or 1,073,741,824. That is 6.87% more, which is exactly the shortfall people notice on storage.",
      },
      {
        q: "Which system should I use?",
        a: "Decimal for storage and network sizes, which is what vendors quote. Binary for memory, where 1024 is a consequence of how addressing works rather than a convention someone picked.",
      },
      {
        q: "Why do Windows and macOS disagree?",
        a: "macOS reports decimal, so it agrees with the box. Windows divides by 1024 but keeps the decimal label, which is where the apparent missing space comes from.",
      },
    ],
    related: ["date-difference", "number-base-converter"],
  },
];
