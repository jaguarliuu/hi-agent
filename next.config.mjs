import nextra from 'nextra'

const isProd = process.env.NODE_ENV === 'production'
const repo = 'hi-agent'

const withNextra = nextra({
  defaultShowCopyCode: true,
  search: {
    codeblocks: false
  }
})

export default withNextra({
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isProd ? `/${repo}` : '',
  assetPrefix: isProd ? `/${repo}/` : '',
  experimental: {
    optimizePackageImports: ['nextra-theme-docs']
  }
})
