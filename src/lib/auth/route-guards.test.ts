import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every privileged route handler must call `requireAdmin`.
 *
 * This exists because of a real, live hole rather than as a precaution. The
 * middleware matcher was `/admin` and `/admin/((?!login|api).*)`, and the admin
 * API is served from `/api/admin/*` — which does not start with `/admin`. The
 * middleware therefore never executed on any of it, and `POST /api/admin/blogs`,
 * `PUT|DELETE /api/admin/blogs/[id]` and `POST /api/admin/generate-image` were
 * callable by any anonymous request against production.
 *
 * Nothing about the code looked wrong. The matcher reads as though it covers the
 * API — it even has an explicit `(?!...|api)` exclusion, which implies its author
 * believed `/admin/api` was the API path. A test is the only thing that catches
 * that class of mistake, so the guard is asserted structurally here rather than
 * trusted to review.
 */

const API_ROOT = join(process.cwd(), "src/app/api");

/** Handlers that read or write privileged state and must be behind the guard. */
const PRIVILEGED_PREFIXES = ["admin/", "data/"];

/** Handlers that are deliberately public, with the reason they are safe. */
const PUBLIC_EXCEPTIONS: Record<string, string> = {
  "admin/login/route.ts":
    "The login endpoint is how you obtain a session; it cannot require one. It verifies the password in constant time and fails closed when ADMIN_PASSWORD is unset.",
  "admin/logout/route.ts":
    "Clearing your own cookies needs no privilege, and an unauthenticated call accomplishes nothing an attacker wants.",
  "tools/download-ticket/route.ts":
    "Public by design: it is what lets an anonymous visitor use the downloader tools, so requiring a session would make them unusable. It mutates nothing on this site — it returns a 120-second, single-use, IP-bound HMAC that only the downloader service accepts, and that service burns the jti on first use and enforces its own per-IP quotas and spend cap. Abusing this endpoint yields a stack of tickets that are worthless from any other address. It fails closed with 503 when the secret is unset, and it is Turnstile-gated the moment DOWNLOADER_TURNSTILE_SECRET is configured.",
};

const MUTATING = ["POST", "PUT", "PATCH", "DELETE"];

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts" || entry === "route.tsx") out.push(full);
  }
  return out;
}

/**
 * Comments removed, so a file is never punished for *documenting* the hole it
 * fixed. `login/route.ts` explains the old `|| 'admin123'` fallback in its
 * header comment, and an earlier version of the credential check below flagged
 * it for saying so — exactly the wrong incentive.
 *
 * Block comments go first, then whole-line `//` and `*` continuations. Inline
 * `//` is deliberately left alone so a URL in a string literal is not truncated;
 * that can only cause a missed detection, never a false accusation.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("//") && !t.startsWith("*");
    })
    .join("\n");
}

const files = routeFiles(API_ROOT).map((f) => {
  const raw = readFileSync(f, "utf8");
  return {
    rel: relative(API_ROOT, f).split("\\").join("/"),
    source: raw,
    /** Comment-free, for checks that would otherwise flag documentation. */
    code: stripComments(raw),
  };
});

/** Exported HTTP method handlers in a route module. */
function handlersIn(source: string): string[] {
  return [
    ...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g),
  ].map((m) => m[1]);
}

describe("admin route guards", () => {
  it("finds the API routes to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  const privileged = files.filter(
    (f) =>
      PRIVILEGED_PREFIXES.some((p) => f.rel.startsWith(p)) &&
      !(f.rel in PUBLIC_EXCEPTIONS)
  );

  it("finds privileged routes to check", () => {
    expect(privileged.length).toBeGreaterThan(0);
  });

  it.each(privileged.map((f) => f.rel))(
    "%s imports requireAdmin",
    (rel) => {
      const file = files.find((f) => f.rel === rel)!;
      expect(file.source).toContain("requireAdmin");
    }
  );

  it.each(privileged.map((f) => f.rel))(
    "%s calls the guard in every exported handler",
    (rel) => {
      const file = files.find((f) => f.rel === rel)!;
      const handlers = handlersIn(file.source);
      expect(handlers.length).toBeGreaterThan(0);

      // One `requireAdmin` call per exported handler. Counting is crude and
      // deliberately so: it cannot be satisfied by importing the guard and
      // forgetting to call it in the one handler that matters.
      const calls = (file.source.match(/await requireAdmin\(/g) ?? []).length;
      expect(
        calls,
        `${rel} exports ${handlers.join(", ")} (${handlers.length}) but calls requireAdmin ${calls} time(s)`
      ).toBeGreaterThanOrEqual(handlers.length);
    }
  );

  it("has no unauthenticated mutating handler anywhere under /api", () => {
    const offenders: string[] = [];

    for (const file of files) {
      if (file.rel in PUBLIC_EXCEPTIONS) continue;
      const mutators = handlersIn(file.source).filter((h) => MUTATING.includes(h));
      if (mutators.length === 0) continue;
      if (!file.source.includes("requireAdmin")) {
        offenders.push(`${file.rel} (${mutators.join(", ")})`);
      }
    }

    expect(
      offenders,
      `unauthenticated mutating handlers: ${offenders.join("; ")}. ` +
        `Add requireAdmin(), or add an entry to PUBLIC_EXCEPTIONS explaining why it is safe.`
    ).toEqual([]);
  });

  it("no route reintroduces a hardcoded password fallback", () => {
    // `const expectedPassword = correctPassword || 'admin123'` shipped for
    // months. The literal is in git history forever; make sure it is not in the
    // working tree.
    for (const file of files) {
      expect(file.code, `${file.rel} contains a hardcoded credential`).not.toMatch(
        /admin123|['"]password['"]\s*===\s*['"][^'"]+['"]/
      );
    }
  });

  it("no route falls open when ADMIN_PASSWORD is unset", () => {
    // The two original fail-open shapes: middleware returned next(), login fell
    // back to a default. Both keyed off a falsy env read.
    for (const file of files) {
      const failOpen =
        /if\s*\(\s*!\s*(correctPassword|adminPassword|process\.env\.ADMIN_PASSWORD)\s*\)\s*\{?\s*(return\s+NextResponse\.next|return\s+null)/;
      expect(file.code, `${file.rel} fails open`).not.toMatch(failOpen);
    }
  });
});

describe("middleware", () => {
  const raw = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
  const source = stripComments(raw);

  it("fails closed rather than calling next() when unconfigured", () => {
    expect(source).not.toMatch(/if\s*\(\s*!\s*correctPassword\s*\)/);
    expect(source).toContain("isAdminRequest");
  });

  it("does not claim to protect the API, which it structurally cannot", () => {
    // The matcher only ever sees paths under /admin. The admin API is at
    // /api/admin. If someone adds '/api/admin/...' to this matcher believing it
    // replaces the handler guards, that is a regression in understanding even
    // though it would work — the guards stay authoritative.
    const matcher = source.slice(source.indexOf("matcher"));
    expect(matcher).not.toContain("/admin/api");
  });
});
