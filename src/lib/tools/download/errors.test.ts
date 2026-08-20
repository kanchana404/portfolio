import { describe, expect, it } from "vitest";
import { describeError, isRetryable } from "./errors";

describe("codes that mean the protection is working", () => {
  it("treats a replayed ticket as retryable, not as a fault", () => {
    // Single-use is the whole point. Telling someone to press the button again
    // is the correct response, and calling it an error is not.
    expect(isRetryable("ticket_used")).toBe(true);
    expect(isRetryable("ticket_expired")).toBe(true);
    expect(describeError("ticket_used").message).toMatch(/again/i);
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
      "ticket_missing", "turnstile_failed", "killswitch_active", "quota_exceeded",
      "not_configured", "unreachable", "internal",
    ]) {
      const m = describeError(code).message;
      expect(m.length, code).toBeGreaterThan(20);
      expect(m, code).not.toMatch(/_/); // no snake_case leaking through
      expect(m.endsWith("."), code).toBe(true);
    }
  });
});
