import { describe, expect, it } from "vitest";
import { describeError, isRetryable } from "./errors";

describe("codes that mean the protection is working", () => {
  it("treats a replayed ticket as retryable, not as a fault", () => {
    // Single-use is the whole point. Telling someone to press the button again
    // is the correct response, and calling it an error is not.
    expect(isRetryable("ticket_replayed")).toBe(true);
    expect(isRetryable("ticket_expired")).toBe(true);
    expect(describeError("ticket_replayed").message).toMatch(/again/i);
  });

  it("does not explain why a signature failed", () => {
    // The service deliberately refuses to say whether the secret or the address
    // was wrong, because that makes it an oracle. Repeating that here.
    const m = describeError("ticket_bad_signature").message;
    expect(m).not.toMatch(/secret|signature|address|ip/i);
  });
});

describe("codes that are not the reader's fault and not ours", () => {
  it("explains a broken extractor honestly", () => {
    const info = describeError("platform_degraded");
    expect(info.message).toMatch(/few days/);
    // Not retryable: pressing the button again in ten seconds cannot help, and
    // saying it can is a lie that produces load.
    expect(info.retryable).toBe(false);
  });

  it("says a private post cannot be worked around", () => {
    expect(describeError("extractor_failed").message).toMatch(/private|deleted|age/i);
    expect(isRetryable("extractor_failed")).toBe(false);
  });

  it("says the daily cap is not a breakage", () => {
    expect(describeError("killswitch_active").message).toMatch(/nothing is broken/i);
    expect(isRetryable("killswitch_active")).toBe(false);
  });
});

describe("never leaking a raw code", () => {
  it("falls back to a sentence for an unknown code", () => {
    const info = describeError("some_new_code_from_the_future");
    expect(info.message).not.toContain("some_new_code");
    expect(info.message).toMatch(/could not be processed/i);
  });

  it("prefers the service's own detail when it gave one", () => {
    expect(describeError("unknown", "The service said this.").message).toBe(
      "The service said this."
    );
  });

  it("ignores an empty detail rather than showing a blank message", () => {
    expect(describeError("unknown", "   ").message).toMatch(/could not be processed/i);
  });

  it("gives every known code a real sentence", () => {
    for (const code of [
      "unsupported_platform", "playlist_rejected", "video_too_long", "file_too_large",
      "extractor_failed", "platform_degraded", "ticket_expired", "ticket_used",
      "ticket_missing", "ticket_replayed", "ticket_rejected", "ticket_ttl_implausible",
      "turnstile_failed", "killswitch_active", "quota_exceeded",
      "not_configured", "unreachable", "internal",
    ]) {
      const m = describeError(code).message;
      expect(m.length, code).toBeGreaterThan(20);
      expect(m, code).not.toMatch(/_/); // no snake_case leaking through
      expect(m.endsWith("."), code).toBe(true);
    }
  });
});

describe("the codes are a wire contract, not prose", () => {
  it("handles every ticket code the Python service can actually emit", async () => {
    // The bug this catches: errors.ts once handled `ticket_used`, which the
    // service never sends — so a replayed ticket, the one case with a genuinely
    // useful message, got the generic fallback instead. Read the codes out of
    // the service rather than trusting this file to have kept up.
    const { readFileSync, existsSync } = await import("node:fs");
    const errorsPy = "downloader-api/app/errors.py";
    if (!existsSync(errorsPy)) return; // service not vendored in this checkout

    const source = readFileSync(errorsPy, "utf8");
    const codes = [...source.matchAll(/^\s*"(ticket_[a-z_]+)":\s*\d{3},/gm)].map(
      (m) => m[1]
    );
    expect(codes.length).toBeGreaterThan(3);

    for (const code of codes) {
      const info = describeError(code);
      expect(info.message, `${code} has no entry in errors.ts`).not.toMatch(
        /could not be processed/
      );
    }
  });
});

describe("a broken challenge is not a failed one", () => {
  it("does not tell the reader to retry a configuration fault", () => {
    // Measured 2026-08-21 on the live site: a deleted Turnstile widget's
    // sitekey returns error 400020, byte-identical to a garbage key, while
    // Cloudflare's always-block test key returns 600010. The old code mapped
    // both to "Try once more", so the one failure no amount of retrying could
    // fix was the one that invited retrying.
    const broken = describeError("challenge_misconfigured");
    expect(broken.retryable).toBe(false);
    expect(broken.message).not.toMatch(/try (again|once more)/i);
    // Says whose fault it is. The reader can do nothing about this one.
    expect(broken.message).toMatch(/not yours/i);
  });

  it("still offers a retry for an actual challenge verdict", () => {
    expect(describeError("challenge_failed").retryable).toBe(true);
    expect(describeError("challenge_failed").message).toMatch(/once more/i);
  });
});
