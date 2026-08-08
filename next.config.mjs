/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Both checks stay ON. The tools section ships calculators and converters
  // where correctness IS the product — a type error inside a fee, tax, or
  // token computation must fail the build, not ship silently.
  trailingSlash: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
