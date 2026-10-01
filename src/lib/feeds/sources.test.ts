import { describe, expect, it } from "vitest";
import { CODEX_ALLOWED_DOMAINS, FEED_HOSTS, SOURCES } from "./sources";

/**
 * The source list is the fetcher's whole reach, so every entry is checked:
 * a tampered or careless edit (an http URL, another host, a prefix that
 * matches a look-alike domain) fails CI before any task runs it.
 */

describe("SOURCES", () => {
  it("has unique, well-formed ids", () => {
    const ids = SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it.each(SOURCES.map((s) => [s.id, s] as const))("%s is https on a feed host, with safe prefixes", (_id, source) => {
    const url = new URL(source.url);
    expect(url.protocol).toBe("https:");
    expect(url.username + url.password + url.port).toBe("");
    expect(FEED_HOSTS).toContain(url.hostname);
    expect(source.include.length).toBeGreaterThan(0);
    for (const prefix of source.include) {
      const p = new URL(prefix);
      expect(p.protocol).toBe("https:");
      expect(p.hostname).toBe(url.hostname);
      // Ends in a slash, so https://openai.com/ never matches openai.com.evil.example.
      expect(prefix.endsWith("/")).toBe(true);
    }
    if (source.sitemap) {
      expect(source.kind).toBe("listing");
      const sitemap = new URL(source.sitemap.url);
      expect(sitemap.protocol).toBe("https:");
      expect(sitemap.hostname).toBe(url.hostname);
      for (const prefix of source.sitemap.include) {
        expect(new URL(prefix).hostname).toBe(url.hostname);
        expect(prefix.endsWith("/")).toBe(true);
        // The sitemap narrows the listing's reach, never widens it.
        expect(source.include.some((p) => prefix.startsWith(p))).toBe(true);
      }
    }
    expect(Number.isInteger(source.weight) && source.weight >= 1 && source.weight <= 3).toBe(true);
    expect(source.maxPageReads).toBeGreaterThanOrEqual(0);
    expect(source.maxPageReads).toBeLessThanOrEqual(20);
    if (source.pages !== undefined) {
      expect(source.pages).toBeGreaterThanOrEqual(1);
      expect(source.pages).toBeLessThanOrEqual(5);
      if (source.pages > 1) expect(source.pageParam).toMatch(/^[a-z_]{1,20}$/);
    }
  });

  it("uses every feed host, and no other", () => {
    expect(new Set(SOURCES.map((s) => new URL(s.url).hostname))).toEqual(new Set(FEED_HOSTS));
  });
});

describe("decisions recorded in the list", () => {
  it("reads Anthropic's /news listing, which dates its launch posts, then its sitemap", () => {
    const anthropic = SOURCES.find((s) => s.id === "anthropic");
    expect(anthropic).toMatchObject({ kind: "listing", url: "https://www.anthropic.com/news", include: ["https://www.anthropic.com/"] });
    expect(anthropic?.sitemap?.url).toBe("https://www.anthropic.com/sitemap.xml");
  });

  it("keeps Vercel to its blog", () => {
    expect(SOURCES.find((s) => s.id === "vercel")?.include).toEqual(["https://vercel.com/blog/"]);
  });
});

describe("CODEX_ALLOWED_DOMAINS", () => {
  it("is the npm registry plus exactly the feed hosts", () => {
    expect(CODEX_ALLOWED_DOMAINS[0]).toBe("registry.npmjs.org");
    expect(new Set(CODEX_ALLOWED_DOMAINS.slice(1))).toEqual(new Set(FEED_HOSTS));
    expect(CODEX_ALLOWED_DOMAINS).toHaveLength(FEED_HOSTS.length + 1);
  });
});
