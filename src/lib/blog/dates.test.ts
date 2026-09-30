import { describe, expect, it } from "vitest";
import {
  DIGEST_SLUG_RE,
  addDays,
  digestSlug,
  formatPostDate,
  isYmd,
  todayUtc,
  ymdToIso,
  ymdToRfc822,
} from "./dates";

describe("isYmd", () => {
  it("accepts a real date", () => {
    expect(isYmd("2026-09-28")).toBe(true);
    expect(isYmd("2028-02-29")).toBe(true);
  });

  it("refuses dates JavaScript would roll over, and other shapes", () => {
    expect(isYmd("2026-02-30")).toBe(false);
    expect(isYmd("2026-02-29")).toBe(false);
    expect(isYmd("2026-13-01")).toBe(false);
    expect(isYmd("2026-9-28")).toBe(false);
    expect(isYmd("26-09-28")).toBe(false);
    expect(isYmd("2026-09-28T00:00:00Z")).toBe(false);
    expect(isYmd("")).toBe(false);
  });
});

describe("date formats", () => {
  it("renders the same strings on any machine", () => {
    expect(formatPostDate("2026-09-28")).toBe("September 28, 2026");
    expect(formatPostDate("2027-01-01")).toBe("January 1, 2027");
    expect(ymdToIso("2026-09-28")).toBe("2026-09-28T00:00:00.000Z");
    expect(ymdToRfc822("2026-09-28")).toBe("Mon, 28 Sep 2026 00:00:00 GMT");
  });

  it("takes today in UTC", () => {
    expect(todayUtc(new Date("2026-09-28T23:59:59Z"))).toBe("2026-09-28");
    // 05:00 on the 29th in Sri Lanka is still the 28th in UTC.
    expect(todayUtc(new Date("2026-09-29T05:00:00+05:30"))).toBe("2026-09-28");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-09-28", 1)).toBe("2026-09-29");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("digestSlug", () => {
  it.each([
    ["2026-09-28", "ai-dev-news-2026-w40"],
    ["2026-10-04", "ai-dev-news-2026-w40"],
    ["2026-12-31", "ai-dev-news-2026-w53"],
    ["2027-01-01", "ai-dev-news-2026-w53"],
    ["2027-01-04", "ai-dev-news-2027-w01"],
    ["2025-12-29", "ai-dev-news-2026-w01"],
    ["2021-01-03", "ai-dev-news-2020-w53"],
  ])("%s is %s (ISO week-year)", (ymd, slug) => {
    expect(digestSlug(ymd)).toBe(slug);
    expect(slug).toMatch(DIGEST_SLUG_RE);
  });

  it("the pattern refuses weeks that do not exist", () => {
    expect(DIGEST_SLUG_RE.test("ai-dev-news-2026-w00")).toBe(false);
    expect(DIGEST_SLUG_RE.test("ai-dev-news-2026-w54")).toBe(false);
    expect(DIGEST_SLUG_RE.test("ai-dev-news-2026-w5")).toBe(false);
    expect(DIGEST_SLUG_RE.test("week-2026-40")).toBe(false);
  });
});
