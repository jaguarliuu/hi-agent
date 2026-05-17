'use strict';

// Single source of truth for the Service Worker routing strategy.
// This module is plain CommonJS (no Next/React imports) so it can be:
//   - imported by `tests/unit/sw-strategy.test.ts` for direct unit tests
//   - read at build time and concatenated into `public/sw.js`
//
// Keep the path prefixes here in sync with
// `app/lib/playground/runtime-headers.js` and the `@webcontainerPages`
// matcher in `docker/Caddyfile`.

const WEBCONTAINER_PATH_PREFIXES = [
  '/courses/hi-agent/labs/',
  '/courses/hi-agent/chat/01-getting-started'
];

const SNAPSHOT_PATH_PREFIX = '/webcontainer-snapshots/';
const NEXT_STATIC_PREFIX = '/_next/static/';
const PAGEFIND_PREFIX = '/_pagefind/';
const ICON_PATH_PREFIX = '/icons/';
const MANIFEST_PATH = '/manifest.webmanifest';

const STRATEGY = Object.freeze({
  NETWORK_ONLY: 'network-only',
  CACHE_FIRST: 'cache-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  PASS_THROUGH: 'pass-through'
});

// `basePath` accommodates GitHub Pages deploys ("/hi-agent") so that
// the SW also works on jaguarliuu.github.io/hi-agent. On self-hosted
// Caddy (the production target) this is just an empty string.
function stripBasePath(pathname, basePath) {
  if (!basePath) return pathname;
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length);
  }
  return pathname;
}

function isCrossOrigin(requestUrl, selfOrigin) {
  try {
    const u = new URL(requestUrl);
    return u.origin !== selfOrigin;
  } catch (_err) {
    return true;
  }
}

function isWebcontainerPath(pathname) {
  return WEBCONTAINER_PATH_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) {
      return pathname.startsWith(prefix);
    }
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

// Decide which caching strategy to apply for a given request. The
// caller (the SW fetch handler) is responsible for actually executing
// the strategy; this function is intentionally pure and exhaustively
// tested.
function decideStrategy({ method, requestUrl, selfOrigin, basePath = '' }) {
  if (method !== 'GET') return STRATEGY.PASS_THROUGH;

  if (isCrossOrigin(requestUrl, selfOrigin)) {
    // Anything off-origin (giscus, unpkg, googletagmanager, etc.) must
    // bypass the SW. WebContainer's own provider, GitHub Discussions
    // backed by giscus, and 3rd-party fonts all rely on this.
    return STRATEGY.PASS_THROUGH;
  }

  let pathname;
  try {
    pathname = new URL(requestUrl).pathname;
  } catch (_err) {
    return STRATEGY.PASS_THROUGH;
  }

  const normalized = stripBasePath(pathname, basePath);

  // 1. WebContainer pages MUST come from the network so the COOP/COEP
  //    headers stay attached. A stale SW response without those
  //    headers would silently break crossOriginIsolated, which kills
  //    SharedArrayBuffer + the WebContainer boot.
  if (isWebcontainerPath(normalized)) {
    return STRATEGY.NETWORK_ONLY;
  }

  // 2. Long-lived, content-addressed assets - safe to cache forever.
  if (normalized.startsWith(SNAPSHOT_PATH_PREFIX)) {
    return STRATEGY.CACHE_FIRST;
  }
  if (normalized.startsWith(NEXT_STATIC_PREFIX)) {
    return STRATEGY.CACHE_FIRST;
  }
  if (normalized.startsWith(ICON_PATH_PREFIX)) {
    return STRATEGY.CACHE_FIRST;
  }

  // 3. Pagefind shards: SWR keeps search snappy after first index.
  if (normalized.startsWith(PAGEFIND_PREFIX)) {
    return STRATEGY.STALE_WHILE_REVALIDATE;
  }

  // 4. Manifest is small and infrequently changing.
  if (normalized === MANIFEST_PATH) {
    return STRATEGY.STALE_WHILE_REVALIDATE;
  }

  // 5. Everything else from our origin (HTML, css, json, course
  //    images): SWR so docs read fluidly even on flaky networks.
  return STRATEGY.STALE_WHILE_REVALIDATE;
}

const SHARED = {
  WEBCONTAINER_PATH_PREFIXES,
  SNAPSHOT_PATH_PREFIX,
  NEXT_STATIC_PREFIX,
  PAGEFIND_PREFIX,
  ICON_PATH_PREFIX,
  MANIFEST_PATH,
  STRATEGY,
  decideStrategy,
  isWebcontainerPath,
  isCrossOrigin,
  stripBasePath
};

module.exports = SHARED;
