import { describe, expect, it } from "vitest";
import { decodeUrl, encodeUrl, parseUrl } from "./url-codec";

describe("encodeUrl", () => {
  it("shows the difference the whole tool exists to explain", () => {
    const value = "https://example.com/a b?x=1&y=2";
    // component: everything structural is escaped, because this is a *value*
    expect(encodeUrl(value, "component")).toBe(
      "https%3A%2F%2Fexample.com%2Fa%20b%3Fx%3D1%26y%3D2"
    );
    // uri: structure is preserved, because this is a whole *address*
    expect(encodeUrl(value, "uri")).toBe("https://example.com/a%20b?x=1&y=2");
  });

  it("escapes the ampersand that would otherwise inject a parameter", () => {
    // The concrete bug: encoding a value with encodeURI lets "&admin=true"
    // become a real query parameter.
    expect(encodeUrl("a&admin=true", "component")).toBe("a%26admin%3Dtrue");
    expect(encodeUrl("a&admin=true", "uri")).toBe("a&admin=true");
  });

  it("encodes non-ASCII as UTF-8 percent escapes", () => {
    expect(encodeUrl("café", "component")).toBe("caf%C3%A9");
    expect(encodeUrl("🚀", "component")).toBe("%F0%9F%9A%80");
  });

  it("round-trips through decode", () => {
    for (const text of ["a b&c=d", "café", "🚀 x", "100% sure"]) {
      const encoded = encodeUrl(text, "component");
      expect(decodeUrl(encoded, "component")).toEqual({ ok: true, value: text });
    }
  });
});

describe("decodeUrl", () => {
  it("decodes ordinary escapes", () => {
    expect(decodeUrl("hello%20world", "component")).toEqual({
      ok: true,
      value: "hello world",
    });
  });

  it("returns empty for empty input", () => {
    expect(decodeUrl("", "component")).toEqual({ ok: true, value: "" });
  });

  it("explains a malformed escape instead of throwing URIError", () => {
    const result = decodeUrl("100% sure", "component");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("%25");
    expect(result.ok === false && result.error).toContain("position");
  });

  it("handles a truncated escape at the very end", () => {
    expect(decodeUrl("abc%", "component").ok).toBe(false);
    expect(decodeUrl("abc%A", "component").ok).toBe(false);
  });

  it("rejects invalid hex digits", () => {
    expect(decodeUrl("%zz", "component").ok).toBe(false);
  });
});

describe("parseUrl", () => {
  it("breaks a URL into parts with the query already decoded", () => {
    const parsed = parseUrl("https://example.com:8443/a/b?q=hello%20world&x=1#frag");
    expect(parsed.valid).toBe(true);
    expect(parsed.protocol).toBe("https");
    expect(parsed.host).toBe("example.com");
    expect(parsed.port).toBe("8443");
    expect(parsed.path).toBe("/a/b");
    expect(parsed.hash).toBe("frag");
    expect(parsed.params).toEqual([
      { key: "q", value: "hello world" },
      { key: "x", value: "1" },
    ]);
  });

  it("keeps repeated keys rather than collapsing them", () => {
    // ?tag=a&tag=b is meaningful; an object would silently lose one.
    const parsed = parseUrl("https://e.com/?tag=a&tag=b");
    expect(parsed.params).toHaveLength(2);
  });

  it("tells the user what is missing when there is no scheme", () => {
    const parsed = parseUrl("example.com/path");
    expect(parsed.valid).toBe(false);
    expect(parsed.error).toContain("https://");
  });

  it("is quiet about blank input rather than reporting an error", () => {
    expect(parseUrl("   ")).toEqual({ valid: false, params: [] });
  });
});
