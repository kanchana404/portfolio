import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";
import { hashIp, mintTicket, normaliseIp, clientIpFrom } from "./ticket";

/**
 * The cross-language contract test.
 *
 * A download ticket is a wire format shared by two programs, in two languages,
 * in two repositories. `downloader-api/app/security/tickets.py` is the
 * authority because it is what verifies; this file is what proves the minter
 * still agrees with it.
 *
 * `contrib/mint-ticket.ts` in the service repo says outright that a second copy
 * of a protocol "WILL drift". The failure mode when it does is unusually bad:
 * nothing errors at build time, the ticket looks fine, and every request comes
 * back 401 with a message that deliberately does not say whether the secret,
 * the payload or the address was wrong. So the check is not "does my code look
 * right", it is "does the real verifier accept what my code produced".
 *
 * The Python side is skipped when no interpreter with the service's stubs is
 * available, rather than failing: a machine without it should not go red for a
 * dependency it was never asked to have. The pure-TypeScript assertions below
 * still run everywhere.
 */

const PY = "image-api/.venv/bin/python";
const HARNESS = "contrib/ticket_harness.py";
const SECRET = "test-secret";
const SALT = "test-salt";

function python(args: string[]): string | null {
  try {
    return execFileSync(`../${PY}`, [HARNESS, ...args], {
      cwd: "downloader-api",
      env: { ...process.env, TICKET_SECRET: SECRET, IP_SALT: SALT },
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

const pythonAvailable = python(["haship", "127.0.0.1"]) !== null;

describe.skipIf(!pythonAvailable)("agreement with the real verifier", () => {
  it("hashes an address to the same digest", () => {
    for (const ip of ["127.0.0.1", "203.0.113.9", "2001:db8::1"]) {
      expect(hashIp(ip, SALT), ip).toBe(python(["haship", ip]));
    }
  });

  it("normalises an IPv4-mapped IPv6 address the same way", () => {
    // Measured 2026-08-12 and recorded in the service: the same loopback was
    // `::ffff:127.0.0.1` to Node and `127.0.0.1` to uvicorn. Two spellings, two
    // digests, and every ticket rejected as ip_mismatch. Any dual-stack hop can
    // reproduce it in production.
    expect(hashIp("::ffff:127.0.0.1", SALT)).toBe(python(["haship", "::ffff:127.0.0.1"]));
    expect(hashIp("::ffff:127.0.0.1", SALT)).toBe(hashIp("127.0.0.1", SALT));
  });

  it("produces a byte-identical ticket for identical inputs", () => {
    // Not "a ticket the verifier accepts" but the *same bytes*. Accepting a
    // weaker assertion would let the two drift in any field the MAC happens to
    // cover identically.
    const now = 1787000000;
    const jti = "0123456789abcdef0123456789abcdef";
    const mine = mintTicket({ ip: "203.0.113.9", secret: SECRET, salt: SALT, now, jti });
    expect(mine).toBe(python(["mint", "203.0.113.9", String(now), jti]));
  });

  it("mints something the verifier parses and reads back correctly", () => {
    const now = Math.floor(Date.now() / 1000);
    const jti = "abcdef0123456789abcdef0123456789";
    const ticket = mintTicket({ ip: "198.51.100.4", secret: SECRET, salt: SALT, now, jti });
    const parsed = JSON.parse(python(["verify", ticket])!);
    expect(parsed).toMatchObject({
      ok: true,
      jti,
      aud: "downloader",
      exp: now + 120,
      ip_hash: hashIp("198.51.100.4", SALT),
    });
  });
});

describe("the wire format, independent of Python", () => {
  it("is two unpadded base64url segments joined by a dot", () => {
    const t = mintTicket({ ip: "203.0.113.9", secret: SECRET, salt: SALT });
    const [payload, mac] = t.split(".");
    expect(t.split(".")).toHaveLength(2);
    for (const seg of [payload, mac]) {
      expect(seg).toMatch(/^[A-Za-z0-9_-]+$/); // no + / =
    }
  });

  it("puts exp in seconds, not milliseconds, on the DEFAULT clock path", () => {
    // Deliberately no injected `now`. An earlier version of this test supplied
    // one, which meant it never ran the `Date.now()` branch and passed happily
    // while that branch returned milliseconds. Mutation-tested: replacing the
    // divide-by-1000 has to fail here, and with an injected clock it did not.
    //
    // The bug matters because it is silent. Milliseconds mint a ticket valid
    // until the year 57000, which the verifier refuses as `ticket_expired`
    // rather than honouring, so the service is 100% broken with a message that
    // points at the clock rather than the units.
    const before = Math.floor(Date.now() / 1000);
    const t = mintTicket({ ip: "1.2.3.4", secret: SECRET, salt: SALT });
    const after = Math.floor(Date.now() / 1000);

    const payload = JSON.parse(Buffer.from(t.split(".")[0], "base64url").toString());
    expect(payload.exp).toBeGreaterThanOrEqual(before + 120);
    expect(payload.exp).toBeLessThanOrEqual(after + 120);
  });

  it("keeps the lifetime inside what the verifier will accept", () => {
    // MAX_TICKET_TTL_S is 300. A correctly signed ticket with an implausible
    // lifetime is rejected *and* logged as a minting misconfiguration, so this
    // is the boundary that separates "works" from "works until someone looks".
    const t = mintTicket({ ip: "1.2.3.4", secret: SECRET, salt: SALT });
    const payload = JSON.parse(Buffer.from(t.split(".")[0], "base64url").toString());
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it("keeps the payload key order the Python minter uses", () => {
    const t = mintTicket({ ip: "1.2.3.4", secret: SECRET, salt: SALT });
    const json = Buffer.from(t.split(".")[0], "base64url").toString();
    expect(Object.keys(JSON.parse(json))).toEqual(["jti", "aud", "exp", "ip_hash"]);
  });

  it("gives every ticket a distinct jti", () => {
    // The jti is what makes a ticket single-use. Repeating one would mean the
    // second request burns a token the first already spent.
    const ids = new Set(
      Array.from({ length: 50 }, () =>
        JSON.parse(
          Buffer.from(
            mintTicket({ ip: "1.2.3.4", secret: SECRET, salt: SALT }).split(".")[0],
            "base64url"
          ).toString()
        ).jti
      )
    );
    expect(ids.size).toBe(50);
  });

  it("changes the signature when the secret changes", () => {
    const args = { ip: "1.2.3.4", salt: SALT, now: 1787000000, jti: "a".repeat(32) };
    const a = mintTicket({ ...args, secret: "secret-one" });
    const b = mintTicket({ ...args, secret: "secret-two" });
    expect(a.split(".")[0]).toBe(b.split(".")[0]); // same payload
    expect(a.split(".")[1]).not.toBe(b.split(".")[1]); // different MAC
  });
});

describe("normalising an address", () => {
  it("trims, lowercases and unwraps brackets", () => {
    expect(normaliseIp("  203.0.113.9 ")).toBe("203.0.113.9");
    expect(normaliseIp("[2001:DB8::1]")).toBe("2001:db8::1");
  });

  it("unwraps ::ffff: only for a real dotted quad", () => {
    expect(normaliseIp("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(normaliseIp("::ffff:1.2")).toBe("::ffff:1.2");
  });
});

describe("finding the client address", () => {
  const h = (o: Record<string, string>) => new Headers(o);

  it("prefers Cloudflare's header, which cannot be spoofed past Cloudflare", () => {
    expect(clientIpFrom(h({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "9.9.9.9" })))
      .toBe("1.1.1.1");
  });

  it("takes the RIGHTMOST forwarded entry, not the leftmost", () => {
    // The leftmost is whatever the client claimed. Trusting it would let anyone
    // choose their own quota bucket.
    expect(clientIpFrom(h({ "x-forwarded-for": "10.0.0.1, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back and never returns undefined", () => {
    expect(clientIpFrom(h({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIpFrom(h({}))).toBe("");
  });
});
