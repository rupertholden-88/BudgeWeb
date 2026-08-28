/** @type {import('next').NextConfig} */
const nextConfig = {
  // @anthropic-ai/sdk pulls in an ESM-only transitive dependency (via its beta
  // webhooks module) that Next 14's webpack can't bundle. Loading it natively
  // at runtime instead sidesteps that — safe since it's only used server-side.
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
}
module.exports = nextConfig
