import nextra from 'nextra';
import runtimeHeaders from './app/lib/playground/runtime-headers.js';

const repo = 'hi-agent';
// 部署到 GitHub Pages 时需要 basePath；CI 里由工作流显式设置 GITHUB_PAGES=true
const isGhPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGhPages ? `/${repo}` : '';
const {
  getWebcontainerHeaderEntries,
  shouldEnableWebcontainerHeaders
} = runtimeHeaders;

const withNextra = nextra({
  defaultShowCopyCode: true,
  search: {
    codeblocks: false
  }
});

const nextConfig = {
  reactStrictMode: true,
  // Studio 模式（npm run studio）下需要在 dev 跑动态 API 路由，
  // 与 output: 'export' 冲突，因此仅在非 studio 模式启用静态导出。
  // 生产构建走默认的 output: 'export'（GitHub Pages）。
  ...(process.env.STUDIO_MODE === '1' ? {} : { output: 'export' }),
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: isGhPages ? `/${repo}/` : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  experimental: {
    optimizePackageImports: ['nextra-theme-docs']
  }
};

if (
  shouldEnableWebcontainerHeaders({
    nodeEnv: process.env.NODE_ENV,
    enableRuntimeHeaders:
      process.env.ENABLE_WEBCONTAINER_RUNTIME_HEADERS === 'true'
  })
) {
  nextConfig.headers = async () => getWebcontainerHeaderEntries();
}

export default withNextra(nextConfig);
