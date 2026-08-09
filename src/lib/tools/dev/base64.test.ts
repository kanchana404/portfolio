import { describe, expect, it } from "vitest";
import { decodeBase64, decodedByteLength, encodeBase64 } from "./base64";

describe("encodeBase64", () => {
  it("matches the known vectors from RFC 4648", () => {
    expect(encodeBase64("")).toBe("");
    expect(encodeBase64("f")).toBe("Zg==");
    expect(encodeBase64("fo")).toBe("Zm8=");
    expect(encodeBase64("foo")).toBe("Zm9v");
    expect(encodeBase64("foob")).toBe("Zm9vYg==");
    expect(encodeBase64("fooba")).toBe("Zm9vYmE=");
    expect(encodeBase64("foobar")).toBe("Zm9vYmFy");
  });

  it("encodes text that plain btoa cannot", () => {
    // btoa() throws InvalidCharacterError on every one of these. This is the
    // whole reason the module exists.
    for (const text of ["සිංහල", "தமிழ்", "日本語", "🚀🌍", "café"]) {
      expect(() => encodeBase64(text)).not.toThrow();
      const round = decodeBase64(encodeBase64(text));
      expect(round.ok && round.text).toBe(text);
    }
  });

  it("produces the URL-safe alphabet without padding on request", () => {
    const text = "subjects?/+";
    const standard = encodeBase64(text);
    const urlSafe = encodeBase64(text, true);
    expect(urlSafe).not.toContain("+");
    expect(urlSafe).not.toContain("/");
    expect(urlSafe).not.toContain("=");
    expect(decodeBase64(urlSafe)).toEqual({ ok: true, text });
    expect(decodeBase64(standard)).toEqual({ ok: true, text });
  });

  it("handles input large enough to break a naive spread call", () => {
    // String.fromCharCode(...bytes) throws RangeError somewhere around 100 kB.
    const big = "a".repeat(300_000);
    const encoded = encodeBase64(big);
    const decoded = decodeBase64(encoded);
    expect(decoded.ok && decoded.text.length).toBe(300_000);
  });
});

describe("decodeBase64", () => {
  it("decodes with and without padding", () => {
    expect(decodeBase64("Zm9vYmE=")).toEqual({ ok: true, text: "fooba" });
    expect(decodeBase64("Zm9vYmE")).toEqual({ ok: true, text: "fooba" });
  });

  it("ignores whitespace, including the newlines in wrapped MIME base64", () => {
    expect(decodeBase64("Zm9v\nYmFy")).toEqual({ ok: true, text: "foobar" });
    expect(decodeBase64("  Zm9vYmFy  ")).toEqual({ ok: true, text: "foobar" });
  });

  it("returns empty for empty input rather than erroring", () => {
    expect(decodeBase64("")).toEqual({ ok: true, text: "" });
  });

  it("rejects characters outside the alphabet with a useful message", () => {
    const result = decodeBase64("not valid base64!!");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("A–Z");
  });

  it("rejects a length that cannot encode whole bytes", () => {
    // A remainder of one is impossible in well-formed base64.
    const result = decodeBase64("Zm9vY");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("Truncated");
  });

  it("explains rather than corrupts when the bytes are not text", () => {
    // 0xFF 0xFE is a valid byte sequence and invalid UTF-8. Decoding without
    // `fatal` would silently return replacement characters and let the user
    // conclude their data was damaged.
    const result = decodeBase64("//4=");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("not valid UTF-8");
    expect(result.ok === false && result.error).toContain("2 bytes");
  });
});

describe("decodedByteLength", () => {
  it("reports the payload size without decoding", () => {
    expect(decodedByteLength("")).toBe(0);
    expect(decodedByteLength("Zm9vYmFy")).toBe(6);
    expect(decodedByteLength("Zg==")).toBe(1);
  });
  it("returns null for an impossible length", () => {
    expect(decodedByteLength("Zm9vY")).toBeNull();
  });
});
