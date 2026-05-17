'use strict';

const WEBCONTAINER_HEADERS = [
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
];

// 唯一真源（single source of truth）：WebContainers / SharedArrayBuffer 所需的
// COOP+COEP 跨源隔离仅在 labs 路由下启用。所有依赖此前缀的位置（next.config.mjs
// 的 headers()、docker/Caddyfile 的 @webcontainerLabs matcher、评论系统路径
// 排除等）都应通过本常量保持一致；任何"配置漂移"会被 tests/unit/caddyfile.test.ts
// 在 CI 中捕获。
const WEBCONTAINER_PATH_PREFIX = '/courses/hi-agent/labs/';
const WEBCONTAINER_NEXT_SOURCE = `${WEBCONTAINER_PATH_PREFIX}:path*`;

function getWebcontainerHeaderEntries() {
  return [
    {
      source: WEBCONTAINER_NEXT_SOURCE,
      headers: WEBCONTAINER_HEADERS
    }
  ];
}

function shouldEnableWebcontainerHeaders({
  nodeEnv,
  enableRuntimeHeaders = false
} = {}) {
  return nodeEnv === 'development' || enableRuntimeHeaders;
}

module.exports = {
  WEBCONTAINER_HEADERS,
  WEBCONTAINER_PATH_PREFIX,
  WEBCONTAINER_NEXT_SOURCE,
  getWebcontainerHeaderEntries,
  shouldEnableWebcontainerHeaders
};
