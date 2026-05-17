'use strict';

const WEBCONTAINER_HEADERS = [
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
];

// 唯一真源（single source of truth）：WebContainers / SharedArrayBuffer 所需的
// COOP+COEP 跨源隔离仅在含 Playground 的路由下启用。所有依赖此前缀的位置（next.config.mjs
// 的 headers()、docker/Caddyfile 的 @webcontainerPages matcher、评论系统路径
// 排除等）都应通过本常量保持一致；任何"配置漂移"会被 tests/unit/caddyfile.test.ts
// 在 CI 中捕获。
const WEBCONTAINER_PATH_PREFIXES = [
  '/courses/hi-agent/labs/',
  '/courses/hi-agent/chat/01-getting-started'
];

const WEBCONTAINER_NEXT_SOURCES = [
  '/courses/hi-agent/labs/:path*',
  '/courses/hi-agent/chat/01-getting-started',
  '/courses/hi-agent/chat/01-getting-started/:path*'
];

function getWebcontainerHeaderEntries() {
  return WEBCONTAINER_NEXT_SOURCES.map((source) => ({
    source,
    headers: WEBCONTAINER_HEADERS
  }));
}

function shouldEnableWebcontainerHeaders({
  nodeEnv,
  enableRuntimeHeaders = false
} = {}) {
  return nodeEnv === 'development' || enableRuntimeHeaders;
}

module.exports = {
  WEBCONTAINER_HEADERS,
  WEBCONTAINER_PATH_PREFIXES,
  WEBCONTAINER_NEXT_SOURCES,
  getWebcontainerHeaderEntries,
  shouldEnableWebcontainerHeaders
};
