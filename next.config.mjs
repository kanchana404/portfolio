/**
 * Frozen by scripts/check-config-integrity.mjs: next build and next dev load
 * this file, so it is where a payload runs first. Any edit must update the
 * hash recorded there in the same commit.
 */

// Sent on every response. No full Content-Security-Policy for the public
// pages yet (they load a third-party analytics script); these cover framing,
// MIME sniffing, referrers and powerful browser features.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

// The admin pages run no third-party code, so they get a real policy: a
// script from anywhere else cannot run next to the admin session. Production
// only, because next dev evaluates its bundles with eval().
const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Both checks stay ON. The tools section ships calculators and converters
  // where correctness IS the product — a type error inside a fee, tax, or
  // token computation must fail the build, not ship silently.
  trailingSlash: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const rules = [{ source: "/:path*", headers: SECURITY_HEADERS }];
    if (process.env.NODE_ENV === "production") {
      rules.push({
        source: "/admin/:path*",
        headers: [{ key: "Content-Security-Policy", value: ADMIN_CSP }],
      });
    }
    return rules;
  },
};

export default nextConfig;
