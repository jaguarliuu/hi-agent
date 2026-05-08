import nextra from 'nextra';
import { getWebcontainerHeaderEntries } from './app/lib/playground/runtime-headers.js';

const repo = 'hi-agent';
// 部署到 GitHub Pages 时需要 basePath；CI 里由工作流显式设置 GITHUB_PAGES=true
const isGhPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGhPages ? `/${repo}` : '';

const withNextra = nextra({
  defaultShowCopyCode: true,
  search: {
    codeblocks: false
  }
});

export default withNextra({
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: isGhPages ? `/${repo}/` : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  experimental: {
    optimizePackageImports: ['nextra-theme-docs']
  },
  async headers() {
    return getWebcontainerHeaderEntries();
  }
});
