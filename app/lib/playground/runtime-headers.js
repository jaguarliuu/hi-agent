'use strict';

const WEBCONTAINER_HEADERS = [
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
];

function getWebcontainerHeaderEntries() {
  return [
    {
      source: '/:path*',
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
  getWebcontainerHeaderEntries,
  shouldEnableWebcontainerHeaders
};
