const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router é estável desde Next 13.4; não precisa mais de flag experimental.
}

module.exports = withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,
  // Upload source maps to Sentry for better stack traces
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
})
