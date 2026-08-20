import { describe, expect, it } from "vitest";
import {
  CLEARANCE_TTL_S,
  clearanceCookieHeader,
  clearanceValid,
  mintClearance,
} from "./clearance";

const SECRET = "a-secret-that-is-long-enough-to-be-real";
const OTHER = "a-different-secret-entirely-but-same-len";
const IP = "abc123def4567890";
const NOW = 1_760_000_000_000;

describe("the cookie only works where it should", () => {
  it("accepts one it just minted", () => {
    expect(clearanceValid(mintClearance(IP, SECRET, NOW), IP, SECRET, NOW)).toBe(true);
  });

  it("refuses one signed with another secret", () => {
    // Without this the cookie is a suggestion rather than a credential.
    const forged = mintClearance(IP, OTHER, NOW);
    expect(clearanceValid(forged, IP, SECRET, NOW)).toBe(false);
  });

  it("refuses one presented from a different address", () => {
    // The whole point of binding: a cookie lifted off the wire or out of a
    // shared machine is worthless anywhere else.
    const cookie = mintClearance(IP, SECRET, NOW);
    expect(clearanceValid(cookie, "0000000000000000", SECRET, NOW)).toBe(false);
  });

  it("refuses one whose window has closed", () => {
    const cookie = mintClearance(IP, SECRET, NOW);
    const after = NOW + (CLEARANCE_TTL_S + 1) * 1000;
    expect(clearanceValid(cookie, IP, SECRET, after)).toBe(false);
  });

  it("still accepts one a second before it expires", () => {
    const cookie = mintClearance(IP, SECRET, NOW);
    const justInside = NOW + (CLEARANCE_TTL_S - 1) * 1000;
    expect(clearanceValid(cookie, IP, SECRET, justInside)).toBe(true);
  });
});

describe("tampering", () => {
  it("refuses a payload edited to extend the window", () => {
    // The obvious attack: decode, push `exp` out a year, re-encode. The
    // signature is over the payload, so this must not survive.
    const cookie = mintClearance(IP, SECRET, NOW);
    const [payloadB64, sig] = cookie.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    payload.exp += 60 * 60 * 24 * 365;
    const edited = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(clearanceValid(`${edited}.${sig}`, IP, SECRET, NOW)).toBe(false);
  });

  it("refuses a payload edited to claim another address", () => {
    const cookie = mintClearance(IP, SECRET, NOW);
    const [payloadB64, sig] = cookie.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    payload.ip_hash = "ffffffffffffffff";
    const edited = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(clearanceValid(`${edited}.${sig}`, payload.ip_hash, SECRET, NOW)).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["undefined", undefined],
    ["no dot", "justonesegment"],
    ["leading dot", ".onlyasignature"],
    ["trailing dot", "onlyapayload."],
    ["not base64", "!!!.!!!"],
    ["signature only", "."],
  ])("refuses a malformed cookie: %s", (_name, value) => {
    expect(clearanceValid(value as string | undefined, IP, SECRET, NOW)).toBe(false);
  });

  it("refuses a valid signature over a payload that is not JSON", () => {
    // Reaching the parse with a good signature is only possible with the
    // secret, but the parse must still not throw and take the route with it.
    const payloadB64 = Buffer.from("not json at all").toString("base64url");
    const { createHmac } = require("node:crypto") as typeof import("node:crypto");
    const sig = createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
    expect(clearanceValid(`${payloadB64}.${sig}`, IP, SECRET, NOW)).toBe(false);
  });
});

describe("the Set-Cookie header", () => {
  it("cannot be read by script and is not sent cross-site", () => {
    const header = clearanceCookieHeader("value", true);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    expect(header).toContain("Secure");
    // Scoped to the one route that consumes it, so it is not attached to every
    // request to the site.
    expect(header).toContain("Path=/api/tools/download-ticket");
  });

  it("drops Secure off HTTP so local development works", () => {
    expect(clearanceCookieHeader("value", false)).not.toContain("Secure");
  });

  it("expires with the same window it was signed for", () => {
    expect(clearanceCookieHeader("v", true)).toContain(`Max-Age=${CLEARANCE_TTL_S}`);
  });
});
