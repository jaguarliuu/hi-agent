// Hi-Agent · Service Worker
//
// 离线/二次访问策略，刻意设计为零依赖的纯 SW 脚本：
// - WebContainer 页面 (labs/* 与 chat/01-getting-started/*) 必须 network-only，
//   否则 SW 命中会丢掉 COOP/COEP，crossOriginIsolated 失效会让 WebContainer 直接挂。
// - WebContainer 快照 (.bin) 与 Next 静态 chunk + icons 走 cache-first，命中即取。
// - 其余同源 HTML/CSS/JSON 走 stale-while-revalidate，弱网/离线也能继续阅读已读章节。
// - 跨域请求 (giscus.app / githubusercontent.com / 字体 CDN 等) 全量透传，永不拦截。
//
// 任意修改请同步更新 `app/lib/pwa/sw-strategy.js` 与
// `tests/unit/sw-strategy.test.ts`，CI 会拒绝两者漂移。

const SW_VERSION = 'v1';
const PRECACHE = `ha-precache-${SW_VERSION}`;
const RUNTIME = `ha-runtime-${SW_VERSION}`;
const HTML_CACHE = `ha-html-${SW_VERSION}`;
const KNOWN_CACHES = new Set([PRECACHE, RUNTIME, HTML_CACHE]);

// 同步保持：app/lib/pwa/sw-strategy.js + app/lib/playground/runtime-headers.js
const WEBCONTAINER_PATH_PREFIXES = [
  '/courses/hi-agent/labs/',
  '/courses/hi-agent/chat/01-getting-started'
];

const SNAPSHOT_PATH_PREFIX = '/webcontainer-snapshots/';
const NEXT_STATIC_PREFIX = '/_next/static/';
const PAGEFIND_PREFIX = '/_pagefind/';
const ICON_PATH_PREFIX = '/icons/';
const MANIFEST_PATH = '/manifest.webmanifest';

const STRATEGY = {
  NETWORK_ONLY: 'network-only',
  CACHE_FIRST: 'cache-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  PASS_THROUGH: 'pass-through'
};

const swScope = self.registration && self.registration.scope
  ? new URL(self.registration.scope).pathname.replace(/\/$/, '')
  : '';

function stripBasePath(pathname) {
  if (!swScope) return pathname;
  if (pathname === swScope) return '/';
  if (pathname.startsWith(`${swScope}/`)) {
    return pathname.slice(swScope.length);
  }
  return pathname;
}

function isWebcontainerPath(pathname) {
  return WEBCONTAINER_PATH_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) return pathname.startsWith(prefix);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

function decideStrategy(request) {
  if (request.method !== 'GET') return STRATEGY.PASS_THROUGH;

  let url;
  try {
    url = new URL(request.url);
  } catch (_e) {
    return STRATEGY.PASS_THROUGH;
  }

  if (url.origin !== self.location.origin) return STRATEGY.PASS_THROUGH;

  const path = stripBasePath(url.pathname);

  if (isWebcontainerPath(path)) return STRATEGY.NETWORK_ONLY;
  if (path.startsWith(SNAPSHOT_PATH_PREFIX)) return STRATEGY.CACHE_FIRST;
  if (path.startsWith(NEXT_STATIC_PREFIX)) return STRATEGY.CACHE_FIRST;
  if (path.startsWith(ICON_PATH_PREFIX)) return STRATEGY.CACHE_FIRST;
  if (path.startsWith(PAGEFIND_PREFIX)) return STRATEGY.STALE_WHILE_REVALIDATE;
  if (path === MANIFEST_PATH) return STRATEGY.STALE_WHILE_REVALIDATE;

  return STRATEGY.STALE_WHILE_REVALIDATE;
}

function pickCache(strategy, request) {
  if (strategy === STRATEGY.CACHE_FIRST) return RUNTIME;
  // SWR results vary widely; keep them in a smaller HTML cache so
  // operators can wipe HTML responses without nuking long-lived chunks.
  return HTML_CACHE;
}

async function cacheFirst(request) {
  const cache = await caches.open(pickCache(STRATEGY.CACHE_FIRST, request));
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok && fresh.type === 'basic') {
    cache.put(request, fresh.clone()).catch(() => {});
  }
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(pickCache(STRATEGY.STALE_WHILE_REVALIDATE, request));
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || fetch(request);
}

self.addEventListener('install', (event) => {
  // Activate as soon as installation finishes; the
  // 'controllerchange' listener on the page side will surface a
  // refresh toast so users opt in to the new bundle.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('ha-') && !KNOWN_CACHES.has(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const strategy = decideStrategy(event.request);
  if (strategy === STRATEGY.PASS_THROUGH || strategy === STRATEGY.NETWORK_ONLY) {
    return;
  }

  if (strategy === STRATEGY.CACHE_FIRST) {
    event.respondWith(cacheFirst(event.request).catch(() => fetch(event.request)));
    return;
  }

  if (strategy === STRATEGY.STALE_WHILE_REVALIDATE) {
    event.respondWith(
      staleWhileRevalidate(event.request).catch(() => fetch(event.request))
    );
  }
});
