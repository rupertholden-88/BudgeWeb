/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // @anthropic-ai/sdk's client eagerly requires its beta webhooks module
    // (used for verifying incoming webhook signatures — we never call it),
    // which pulls in standardwebhooks -> @stablelib/base64, an ESM-only
    // package a CJS require() can't load. Deferring resolution to Vercel's
    // Node runtime (the previous fix here) just moved the same crash from
    // build time to every single invocation instead. Stubbing the module out
    // avoids loading it at all, in either place.
    config.resolve.alias['standardwebhooks'] = false
    return config
  },
}
module.exports = nextConfig
