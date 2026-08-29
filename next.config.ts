import type { NextConfig } from "next";

// ─── Content-Security-Policy ──────────────────────────────────────────────────
//
// next/font/google self-hosts Geist at build time — no runtime CDN needed.
// Next.js App Router injects inline scripts for hydration, so 'unsafe-inline'
// is required for script-src without per-request nonce infrastructure.
// This CSP still provides meaningful protection:
//   - All external script sources blocked (only 'self' + inline)
//   - Cross-origin connections blocked (connect-src 'self')
//   - Plugins blocked (object-src 'none')
//   - Base-tag injection blocked (base-uri 'self')
//   - Form hijacking blocked (form-action 'self')
//   - Clickjacking blocked (frame-ancestors 'none')
//   - HTTPS upgrade enforced in production (upgrade-insecure-requests)
//
// To remove 'unsafe-inline' from script-src: implement a nonce-based
// middleware that sets a per-request nonce and passes it to Next.js
// headers — see https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

// ─── HTTP security headers ────────────────────────────────────────────────────

const securityHeaders = [
  // Content-Security-Policy
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block clickjacking (belt-and-suspenders with CSP frame-ancestors)
  { key: "X-Frame-Options", value: "DENY" },
  // Disable cross-origin referrer leakage
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions policy — deny camera/mic/geolocation
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Basic XSS protection for older browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  // Allow large image uploads for question media
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
