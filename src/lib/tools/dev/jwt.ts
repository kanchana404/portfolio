import { decodeBase64 } from "./base64";

/**
 * JWT decoding.
 *
 * The single most important thing this module does **not** do is verify the
 * signature, and that is not a shortcoming — it is arithmetically impossible
 * without the signing key. Any site offering to "verify" your token is either
 * asking you to paste your secret into someone else's server, or lying.
 *
 * That distinction matters because a decoded-but-unverified token is worthless
 * as an authorisation decision: anyone can hand-craft a payload claiming
 * `admin: true`. Decoding tells you what a token *says*, not whether it is true.
 *
 * The corollary is why decoding belongs in the browser. A production JWT is a
 * live credential — pasting one into a server-side decoder hands a stranger a
 * working session. This runs locally, and the page says so.
 */

export interface JwtSegment {
  /** Raw base64url as it appeared in the token. */
  raw: string;
  /** Pretty-printed JSON, when it parsed. */
  json: string | null;
  /** The parsed object, for claim interpretation. */
  value: Record<string, unknown> | null;
  error: string | null;
}

export type ExpiryState = "valid" | "expired" | "not-yet-valid" | "unknown";

export interface JwtClaim {
  name: string;
  label: string;
  raw: unknown;
  /** Human rendering — dates for time claims, the value otherwise. */
  display: string;
  note?: string;
}

export interface DecodedJwt {
  ok: boolean;
  error: string | null;
  header: JwtSegment | null;
  payload: JwtSegment | null;
  /** Present but never checked. Shown so it can be compared by eye. */
  signature: string | null;
  algorithm: string | null;
  claims: JwtClaim[];
  expiry: ExpiryState;
  expiresAt: Date | null;
  issuedAt: Date | null;
  notBefore: Date | null;
  /** Things worth saying out loud about this specific token. */
  warnings: string[];
}

/** Registered claim names from RFC 7519, plus the two everyone actually uses. */
const CLAIM_LABELS: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expires at",
  nbf: "Not valid before",
  iat: "Issued at",
  jti: "Token ID",
  scope: "Scope",
  email: "Email",
  name: "Name",
  role: "Role",
  roles: "Roles",
};

const TIME_CLAIMS = new Set(["exp", "nbf", "iat", "auth_time", "updated_at"]);

function decodeSegment(raw: string, label: string): JwtSegment {
  if (raw.length === 0) {
    return { raw, json: null, value: null, error: `The ${label} is empty.` };
  }

  const decoded = decodeBase64(raw);
  if (!decoded.ok) {
    return { raw, json: null, value: null, error: decoded.error };
  }

  try {
    const parsed: unknown = JSON.parse(decoded.text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        raw,
        json: decoded.text,
        value: null,
        error: `The ${label} decoded, but it is not a JSON object.`,
      };
    }
    return {
      raw,
      json: JSON.stringify(parsed, null, 2),
      value: parsed as Record<string, unknown>,
      error: null,
    };
  } catch {
    return {
      raw,
      json: null,
      value: null,
      error: `The ${label} decoded from base64 but is not valid JSON.`,
    };
  }
}

function toDate(value: unknown): Date | null {
  // NumericDate in RFC 7519 is **seconds** since the epoch, not milliseconds.
  // Treating it as milliseconds is the classic JWT bug and puts every token in
  // January 1970.
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatClaimValue(name: string, value: unknown): string {
  if (TIME_CLAIMS.has(name)) {
    const date = toDate(value);
    // ISO/UTC only. `toLocaleString()` resolves against the host's locale and
    // timezone, so the server and the browser produce different strings for the
    // same claim and React reports a hydration mismatch. UTC is also the right
    // answer for a developer tool: `exp` is a UTC instant, and showing it in
    // whatever timezone the reader happens to be in invites off-by-hours
    // debugging. The widget shows local time separately, after mount.
    if (date) return date.toISOString();
  }
  if (Array.isArray(value)) return value.join(", ");
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function decodeJwt(token: string, now: Date = new Date()): DecodedJwt {
  const empty: DecodedJwt = {
    ok: false,
    error: null,
    header: null,
    payload: null,
    signature: null,
    algorithm: null,
    claims: [],
    expiry: "unknown",
    expiresAt: null,
    issuedAt: null,
    notBefore: null,
    warnings: [],
  };

  const trimmed = token.trim().replace(/^Bearer\s+/i, "");
  if (trimmed.length === 0) return empty;

  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return {
      ...empty,
      error:
        `A JWT has three dot-separated parts; this has ${parts.length}. ` +
        (parts.length === 5
          ? "Five parts means a JWE — an encrypted token, whose contents cannot be read without the key."
          : "Check that the whole token was copied."),
    };
  }

  const header = decodeSegment(parts[0], "header");
  const payload = decodeSegment(parts[1], "payload");
  const warnings: string[] = [];

  const algorithm =
    typeof header.value?.alg === "string" ? (header.value.alg as string) : null;

  if (algorithm === "none") {
    warnings.push(
      'The algorithm is "none", meaning the token is unsigned. A server that ' +
        "accepts this is trivially forgeable — it was a real vulnerability class " +
        "in several JWT libraries."
    );
  }

  const expiresAt = toDate(payload.value?.exp);
  const issuedAt = toDate(payload.value?.iat);
  const notBefore = toDate(payload.value?.nbf);

  let expiry: ExpiryState = "unknown";
  if (expiresAt && expiresAt.getTime() < now.getTime()) {
    expiry = "expired";
  } else if (notBefore && notBefore.getTime() > now.getTime()) {
    expiry = "not-yet-valid";
  } else if (expiresAt) {
    expiry = "valid";
  }

  if (payload.value && payload.value.exp === undefined) {
    warnings.push(
      "There is no exp claim, so this token never expires on its own. Anything " +
        "that leaks it stays usable until the key is rotated."
    );
  }

  const claims: JwtClaim[] = payload.value
    ? Object.entries(payload.value).map(([name, raw]) => ({
        name,
        label: CLAIM_LABELS[name] ?? name,
        raw,
        display: formatClaimValue(name, raw),
        note:
          name === "exp" && expiry === "expired"
            ? "This token has expired."
            : name === "nbf" && expiry === "not-yet-valid"
              ? "This token is not valid yet."
              : undefined,
      }))
    : [];

  return {
    ok: header.error === null && payload.error === null,
    error: header.error ?? payload.error,
    header,
    payload,
    signature: parts[2],
    algorithm,
    claims,
    expiry,
    expiresAt,
    issuedAt,
    notBefore,
    warnings,
  };
}
