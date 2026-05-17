import nextra from 'nextra';
import runtimeHeaders from './app/lib/playground/runtime-headers.js';

const repo = 'hi-agent';
// 部署到 GitHub Pages 时需要 basePath；CI 里由工作流显式设置 GITHUB_PAGES=true
const isGhPages = process.env.GITHUB_PAGES === 'true';
const isDev = process.env.NODE_ENV === 'development';
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
  // 本地 next dev 需要自定义 headers 来启用 WebContainer 的 COOP/COEP。
  // output: 'export' 会让 Next dev 忽略 headers，因此只在生产静态构建启用。
  // Studio 模式（npm run studio）下需要动态 API 路由，也不能启用静态导出。
  // 生产构建走默认的 output: 'export'（GitHub Pages）。
  ...(isDev || process.env.STUDIO_MODE === '1' ? {} : { output: 'export' }),
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
