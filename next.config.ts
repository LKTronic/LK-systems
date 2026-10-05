import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// SEC-06 Remediation: Restrict connect-src strictly to 'self' and https in production
const connectSrc = isDev
  ? "connect-src 'self' ws: wss: http: https:;"
  : "connect-src 'self' https:;";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https: http:;
  font-src 'self' data:;
  ${connectSrc}
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, " ").trim();

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.1.82:3000",
    "192.168.1.82",
    "100.73.141.101",
    "*.local",
  ],
  poweredByHeader: false, // SEC-05 Remediation: Suppress X-Powered-By fingerprint
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
