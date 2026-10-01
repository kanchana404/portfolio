import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_URL } from "../site";
import { FetchError, MAX_REDIRECTS, USER_AGENT, checkUrl, getBytes, maybeGunzip, readCapped } from "./http";

/** No network: `fetch` is replaced in every test that would call it. */

const stream = (...chunks: number[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size).fill(65));
      controller.close();
    },
  });

const HOSTS = ["example.com"];
const OPTIONS = { timeoutMs: 1000, maxBytes: 100, accept: "*/*", allowedHosts: HOSTS };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readCapped", () => {
  it("returns the whole body under the cap", async () => {
    expect((await readCapped(stream(40, 60), 100)).length).toBe(100);
  });

  it("throws past the cap, or truncates when asked", async () => {
    await expect(readCapped(stream(60, 60), 100)).rejects.toThrow(FetchError);
    expect((await readCapped(stream(60, 60), 100, true)).length).toBe(100);
  });

  it("reads a missing body as empty", async () => {
    expect((await readCapped(null, 100)).length).toBe(0);
  });
});

describe("maybeGunzip", () => {
  it("round-trips gzip and passes other bytes through", () => {
    const text = new TextEncoder().encode("<rss></rss>");
    expect(new TextDecoder().decode(maybeGunzip(new Uint8Array(gzipSync(text)), 1000))).toBe("<rss></rss>");
    expect(maybeGunzip(text, 1000)).toBe(text);
  });

  it("refuses a gzip bomb", () => {
    const bomb = new Uint8Array(gzipSync(new Uint8Array(10 * 1024 * 1024)));
    expect(bomb.length).toBeLessThan(20_000);
    expect(() => maybeGunzip(bomb, 1024 * 1024)).toThrow(FetchError);
  });
});

describe("USER_AGENT", () => {
  it("names the site and carries no email address", () => {
    expect(USER_AGENT).toContain(SITE_URL);
    expect(USER_AGENT).not.toContain("@");
    expect(USER_AGENT).not.toMatch(/Mozilla|Chrome|Safari/);
  });
});

describe("checkUrl", () => {
  it.each([
    ["http://example.com/a", /https only/],
    ["https://evil.example/a", /not a feed host/],
    ["https://sub.example.com/a", /not a feed host/],
    ["https://user:pw@example.com/a", /credentials/],
    ["https://example.com:8443/a", /port/],
    ["not a url", /not a valid URL/],
  ])("refuses %s", (url, message) => {
    expect(() => checkUrl(url, HOSTS)).toThrow(message);
  });

  it("accepts an https URL on an allowed host", () => {
    expect(checkUrl("https://example.com/feed.xml", HOSTS).hostname).toBe("example.com");
  });
});

describe("getBytes", () => {
  it("sends a GET with the bot User-Agent and returns the body", async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("manual");
      expect((init?.headers as Record<string, string>)["User-Agent"]).toBe(USER_AGENT);
      return new Response("<rss/>", { status: 200, headers: { "content-type": "application/rss+xml" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const got = await getBytes("https://example.com/feed.xml", OPTIONS);
    expect(new TextDecoder().decode(got.bytes)).toBe("<rss/>");
    expect(got.finalUrl).toBe("https://example.com/feed.xml");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect on an allowed host", async () => {
    const fetchMock = vi.fn(async (url: URL) =>
      url.pathname === "/old"
        ? new Response(null, { status: 301, headers: { location: "/new" } })
        : new Response("ok", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const got = await getBytes("https://example.com/old", OPTIONS);
    expect(got.finalUrl).toBe("https://example.com/new");
  });

  it("refuses a redirect to another host before requesting it", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://blog.example.org/a" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getBytes("https://example.com/a", OPTIONS)).rejects.toThrow(/not a feed host/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect to http", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://example.com/a" } })));
    await expect(getBytes("https://example.com/a", OPTIONS)).rejects.toThrow(/https only/);
  });

  it("stops after MAX_REDIRECTS", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "/again" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getBytes("https://example.com/a", OPTIONS)).rejects.toThrow(/redirects/);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it("reports a non-2xx status and a wrong content type", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    await expect(getBytes("https://example.com/a", OPTIONS)).rejects.toThrow("HTTP 403");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } })));
    await expect(getBytes("https://example.com/a", { ...OPTIONS, requireType: ["text/html"] })).rejects.toThrow(/content type/);
  });

  it("never calls fetch for a refused start URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getBytes("https://evil.example/a", OPTIONS)).rejects.toThrow(FetchError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
