import { describe, expect, it } from "vitest";
import { encodeBase64 } from "./base64";
import { decodeJwt } from "./jwt";

/** Build a syntactically valid token. The signature is decorative — nothing verifies it. */
function makeToken(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  signature = "not-a-real-signature"
): string {
  return [
    encodeBase64(JSON.stringify(header), true),
    encodeBase64(JSON.stringify(payload), true),
    signature,
  ].join(".");
}

const HS256 = { alg: "HS256", typ: "JWT" };
const NOW = new Date("2026-08-09T12:00:00.000Z");

describe("decodeJwt", () => {
  it("decodes header and payload", () => {
    const token = makeToken(HS256, { sub: "1234567890", name: "Ada Lovelace" });
    const result = decodeJwt(token, NOW);

    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(result.algorithm).toBe("HS256");
    expect(result.header?.value).toEqual(HS256);
    expect(result.payload?.value).toEqual({ sub: "1234567890", name: "Ada Lovelace" });
  });

  it("keeps the signature without checking it", () => {
    const result = decodeJwt(makeToken(HS256, { sub: "x" }, "abc123"), NOW);
    expect(result.signature).toBe("abc123");
    // Nothing in the result claims validity — only what the token says.
    expect(result).not.toHaveProperty("verified");
  });

  it("strips a Bearer prefix", () => {
    const token = makeToken(HS256, { sub: "x" });
    expect(decodeJwt(`Bearer ${token}`, NOW).ok).toBe(true);
    expect(decodeJwt(`bearer   ${token}`, NOW).ok).toBe(true);
  });

  it("returns a blank result for empty input rather than an error", () => {
    const result = decodeJwt("   ", NOW);
    expect(result.ok).toBe(false);
    expect(result.error).toBeNull();
    expect(result.header).toBeNull();
  });

  it("explains a five-part token as a JWE", () => {
    const result = decodeJwt("a.b.c.d.e", NOW);
    expect(result.error).toContain("JWE");
    expect(result.error).toContain("encrypted");
  });

  it("reports the wrong number of parts", () => {
    expect(decodeJwt("only.two", NOW).error).toContain("this has 2");
  });

  it("reads NumericDate as seconds, not milliseconds", () => {
    // 1516239022 is 2018-01-18. Read as milliseconds it would land in January 1970.
    const result = decodeJwt(makeToken(HS256, { iat: 1516239022 }), NOW);
    expect(result.issuedAt?.toISOString()).toBe("2018-01-18T01:30:22.000Z");
  });

  it("classifies an expired token", () => {
    const exp = Math.floor(NOW.getTime() / 1000) - 60;
    const result = decodeJwt(makeToken(HS256, { exp }), NOW);
    expect(result.expiry).toBe("expired");
    expect(result.claims.find((c) => c.name === "exp")?.note).toContain("expired");
  });

  it("classifies a live token", () => {
    const exp = Math.floor(NOW.getTime() / 1000) + 3600;
    expect(decodeJwt(makeToken(HS256, { exp }), NOW).expiry).toBe("valid");
  });

  it("classifies a token that is not valid yet", () => {
    const base = Math.floor(NOW.getTime() / 1000);
    const result = decodeJwt(
      makeToken(HS256, { nbf: base + 600, exp: base + 3600 }),
      NOW
    );
    expect(result.expiry).toBe("not-yet-valid");
    expect(result.claims.find((c) => c.name === "nbf")?.note).toContain("not valid yet");
  });

  it("leaves expiry unknown when there is no exp", () => {
    const result = decodeJwt(makeToken(HS256, { sub: "x" }), NOW);
    expect(result.expiry).toBe("unknown");
    expect(result.expiresAt).toBeNull();
  });

  it('warns about alg "none"', () => {
    const result = decodeJwt(makeToken({ alg: "none", typ: "JWT" }, { sub: "x" }), NOW);
    expect(result.warnings.join(" ")).toContain("unsigned");
  });

  it("warns about a token with no expiry", () => {
    const result = decodeJwt(makeToken(HS256, { sub: "x" }), NOW);
    expect(result.warnings.join(" ")).toContain("never expires");
  });

  it("does not warn about expiry when exp is present", () => {
    const exp = Math.floor(NOW.getTime() / 1000) + 60;
    const result = decodeJwt(makeToken(HS256, { exp }), NOW);
    expect(result.warnings.join(" ")).not.toContain("never expires");
  });

  it("labels registered claims", () => {
    const result = decodeJwt(makeToken(HS256, { iss: "https://issuer" }), NOW);
    expect(result.claims.find((c) => c.name === "iss")?.label).toBe("Issuer");
  });

  it("falls back to the raw name for unknown claims", () => {
    const result = decodeJwt(makeToken(HS256, { tenant_id: "acme" }), NOW);
    expect(result.claims.find((c) => c.name === "tenant_id")?.label).toBe("tenant_id");
  });

  it("renders array claims readably", () => {
    const result = decodeJwt(makeToken(HS256, { roles: ["admin", "billing"] }), NOW);
    expect(result.claims.find((c) => c.name === "roles")?.display).toBe("admin, billing");
  });

  it("reports a payload that is not base64", () => {
    const result = decodeJwt(`${encodeBase64(JSON.stringify(HS256), true)}.!!!.sig`, NOW);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("reports a segment that decodes but is not JSON", () => {
    const token = [
      encodeBase64(JSON.stringify(HS256), true),
      encodeBase64("plain text, not json", true),
      "sig",
    ].join(".");
    expect(decodeJwt(token, NOW).error).toContain("not valid JSON");
  });

  it("reports a segment that is JSON but not an object", () => {
    const token = [
      encodeBase64(JSON.stringify(HS256), true),
      encodeBase64("[1,2,3]", true),
      "sig",
    ].join(".");
    expect(decodeJwt(token, NOW).error).toContain("not a JSON object");
  });

  it("survives a payload carrying non-Latin-1 text", () => {
    const result = decodeJwt(makeToken(HS256, { name: "කවිත", emoji: "🔐" }), NOW);
    expect(result.payload?.value?.name).toBe("කවිත");
    expect(result.payload?.value?.emoji).toBe("🔐");
  });
});
