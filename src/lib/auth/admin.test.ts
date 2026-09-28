import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_S, issueSessionToken, verifySessionToken } from "./admin";

const NOW = Date.UTC(2026, 8, 28, 12);

describe("admin session tokens", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple";
    delete process.env.ADMIN_SESSION_SECRET;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("accepts a token it issued, until it expires", async () => {
    const token = await issueSessionToken(NOW);
    expect(token).toMatch(/^v2\.\d+\.[0-9a-f]{64}$/);
    expect(await verifySessionToken(token!, NOW + 1000)).toBe(true);
    expect(await verifySessionToken(token!, NOW + SESSION_MAX_AGE_S * 1000 - 1000)).toBe(true);
    expect(await verifySessionToken(token!, NOW + SESSION_MAX_AGE_S * 1000 + 1000)).toBe(false);
  });

  it("gives every session its own token", async () => {
    const a = await issueSessionToken(NOW);
    const b = await issueSessionToken(NOW + 5000);
    expect(a).not.toBe(b);
  });

  it("rejects a tampered, future-dated or foreign token", async () => {
    const token = (await issueSessionToken(NOW))!;
    const [v, t, mac] = token.split(".");
    expect(await verifySessionToken(`${v}.${Number(t) + 60}.${mac}`, NOW)).toBe(false);
    expect(await verifySessionToken(`${v}.${t}.${mac.replace(/.$/, mac.endsWith("0") ? "1" : "0")}`, NOW)).toBe(false);
    expect(await verifySessionToken((await issueSessionToken(NOW + 3_600_000))!, NOW)).toBe(false);
    expect(await verifySessionToken("admin-session-v1-digest", NOW)).toBe(false);
    expect(await verifySessionToken(undefined, NOW)).toBe(false);
  });

  it("signs every session out when a secret changes", async () => {
    const token = (await issueSessionToken(NOW))!;
    process.env.ADMIN_SESSION_SECRET = "a separate random secret";
    expect(await verifySessionToken(token, NOW)).toBe(false);
  });

  it("fails closed when admin access is not configured", async () => {
    delete process.env.ADMIN_PASSWORD;
    expect(await issueSessionToken(NOW)).toBeNull();
    expect(await verifySessionToken("v2.1.abc", NOW)).toBe(false);
  });
});
