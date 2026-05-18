import nextra from 'nextra';
import runtimeHeaders from './app/lib/playground/runtime-headers.js';

const isDev = process.env.NODE_ENV === 'development';
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
  // dev 与 studio 模式下不启用 export，以便注入 WebContainer COOP/COEP headers
  // 与动态路由；生产构建走 Next.js 静态导出，由 Caddy 直接托管 out/ 目录。
  ...(isDev || process.env.STUDIO_MODE === '1' ? {} : { output: 'export' }),
  images: { unoptimized: true },
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: ''
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
