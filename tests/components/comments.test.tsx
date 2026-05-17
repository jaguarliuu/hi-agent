import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { pathnameState, observerState } = vi.hoisted(() => ({
  pathnameState: { value: '/courses/hi-agent/chat/01-getting-started/' },
  observerState: {
    callback: null as IntersectionObserverCallback | null,
    instances: [] as IntersectionObserver[]
  }
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value
}));

vi.mock('@giscus/react', () => {
  const Giscus = (props: Record<string, unknown>) => (
    <div data-testid="giscus-mock" data-term={String(props.term)} data-theme={String(props.theme)}>
      mock-giscus
    </div>
  );
  return { default: Giscus, Giscus };
});

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    observerState.callback = callback;
    observerState.instances.push(this as unknown as IntersectionObserver);
  }
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds = [];
}

beforeEach(() => {
  observerState.callback = null;
  observerState.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadModule() {
  return await import('@/app/lib/comments/comments-config');
}

describe('shouldShowComments / normalizePathname', () => {
  it('only enables comments on section pages with >=4 path segments', async () => {
    const { shouldShowComments } = await loadModule();
    expect(shouldShowComments('/courses/hi-agent/chat/01-getting-started/')).toBe(true);
    expect(shouldShowComments('/courses/hi-agent/chat/')).toBe(false);
    expect(shouldShowComments('/courses/hi-agent/')).toBe(false);
    expect(shouldShowComments('/courses/')).toBe(false);
    expect(shouldShowComments('/')).toBe(false);
    expect(shouldShowComments(null)).toBe(false);
  });

  it('excludes studio, api, and labs paths', async () => {
    const { shouldShowComments } = await loadModule();
    expect(shouldShowComments('/studio/edit/')).toBe(false);
    expect(shouldShowComments('/api/health/')).toBe(false);
    expect(shouldShowComments('/courses/hi-agent/labs/01-webcontainers-pilot/')).toBe(false);
  });

  it('normalizes trailing slash, basePath, and case', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/hi-agent';
    vi.resetModules();
    const { normalizePathname } = await loadModule();
    expect(normalizePathname('/hi-agent/Courses/Hi-Agent/Chat/')).toBe('/courses/hi-agent/chat');
    expect(normalizePathname('/courses/hi-agent/chat/01-getting-started/')).toBe(
      '/courses/hi-agent/chat/01-getting-started'
    );
    expect(normalizePathname('/')).toBe('/');
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    vi.resetModules();
  });

  it('respects the runtime path blocklist', async () => {
    const mod = await loadModule();
    const blocked = '/courses/hi-agent/chat/01-getting-started';
    (mod.COMMENTS_PATH_BLOCKLIST as Set<string>).add(blocked);
    try {
      expect(mod.shouldShowComments('/courses/hi-agent/chat/01-getting-started/')).toBe(false);
    } finally {
      (mod.COMMENTS_PATH_BLOCKLIST as Set<string>).delete(blocked);
    }
  });
});

describe('isCommentsConfigReady', () => {
  it('returns false when giscus repoId / categoryId are not filled in', async () => {
    const { isCommentsConfigReady } = await loadModule();
    expect(
      isCommentsConfigReady({
        provider: 'giscus',
        repo: 'jaguarliuu/hi-agent',
        giscus: {
          repoId: '',
          category: 'Comments',
          categoryId: '',
          mapping: 'specific',
          strict: '0',
          reactionsEnabled: '1',
          emitMetadata: '0',
          inputPosition: 'bottom',
          lang: 'zh-CN',
          loading: 'lazy'
        }
      })
    ).toBe(false);
  });

  it('returns true once giscus credentials are present', async () => {
    const { isCommentsConfigReady } = await loadModule();
    expect(
      isCommentsConfigReady({
        provider: 'giscus',
        repo: 'jaguarliuu/hi-agent',
        giscus: {
          repoId: 'R_kgDO1',
          category: 'Comments',
          categoryId: 'DIC_kw1',
          mapping: 'specific',
          strict: '0',
          reactionsEnabled: '1',
          emitMetadata: '0',
          inputPosition: 'bottom',
          lang: 'zh-CN',
          loading: 'lazy'
        }
      })
    ).toBe(true);
  });
});

describe('CommentsBoundary integration', () => {
  it('renders nothing on overview pages', async () => {
    pathnameState.value = '/courses/hi-agent/chat/';
    const { CommentsBoundary } = await import('@/app/lib/comments/comments-boundary');
    const { container } = render(<CommentsBoundary />);
    expect(container.querySelector('[data-testid="ha-comments-boundary"]')).toBeNull();
  });

  it('mounts after intersection on enabled paths', async () => {
    pathnameState.value = '/courses/hi-agent/chat/01-getting-started/';
    const cfgMod = await import('@/app/lib/comments/comments-config');
    const prevRepoId = cfgMod.COMMENTS_CONFIG.giscus!.repoId;
    const prevCategoryId = cfgMod.COMMENTS_CONFIG.giscus!.categoryId;
    cfgMod.COMMENTS_CONFIG.giscus!.repoId = 'R_test';
    cfgMod.COMMENTS_CONFIG.giscus!.categoryId = 'DIC_test';

    try {
      const { CommentsBoundary } = await import('@/app/lib/comments/comments-boundary');
      render(<CommentsBoundary />);

      const placeholder = await screen.findByTestId('ha-comments-boundary');
      expect(placeholder).toBeInTheDocument();
      expect(screen.queryByTestId('ha-comments-frame')).toBeNull();

      act(() => {
        observerState.callback?.(
          [
            {
              isIntersecting: true,
              target: placeholder,
              intersectionRatio: 1,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: 0
            }
          ],
          observerState.instances[0]
        );
      });

      const frame = await screen.findByTestId('ha-comments-frame');
      expect(frame).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('giscus-mock')).toBeInTheDocument();
      });
      const giscus = screen.getByTestId('giscus-mock');
      expect(giscus.dataset.term).toBe('/courses/hi-agent/chat/01-getting-started');
      expect(screen.getByText(/讨论与评论/)).toBeInTheDocument();
      expect(screen.getByText(/GitHub 隐私政策/)).toBeInTheDocument();
    } finally {
      cfgMod.COMMENTS_CONFIG.giscus!.repoId = prevRepoId;
      cfgMod.COMMENTS_CONFIG.giscus!.categoryId = prevCategoryId;
    }
  });
});

describe('Comments theme bridge & fallback', () => {
  it('reads dark mode from html class', async () => {
    document.documentElement.classList.add('dark');
    const { Comments } = await import('@/app/lib/comments/comments');
    const cfgMod = await import('@/app/lib/comments/comments-config');
    const prevRepoId = cfgMod.COMMENTS_CONFIG.giscus!.repoId;
    const prevCategoryId = cfgMod.COMMENTS_CONFIG.giscus!.categoryId;
    cfgMod.COMMENTS_CONFIG.giscus!.repoId = 'R_test';
    cfgMod.COMMENTS_CONFIG.giscus!.categoryId = 'DIC_test';
    try {
      render(<Comments pathname="/courses/hi-agent/chat/01-getting-started/" />);
      const giscus = await screen.findByTestId('giscus-mock');
      expect(giscus.dataset.theme).toBe('dark');
    } finally {
      cfgMod.COMMENTS_CONFIG.giscus!.repoId = prevRepoId;
      cfgMod.COMMENTS_CONFIG.giscus!.categoryId = prevCategoryId;
    }
  });

  it('renders config-missing notice when credentials are empty', async () => {
    const { Comments } = await import('@/app/lib/comments/comments');
    render(
      <Comments
        pathname="/courses/hi-agent/chat/01-getting-started/"
        config={{
          provider: 'giscus',
          repo: 'jaguarliuu/hi-agent',
          giscus: {
            repoId: '',
            category: 'Comments',
            categoryId: '',
            mapping: 'specific',
            strict: '0',
            reactionsEnabled: '1',
            emitMetadata: '0',
            inputPosition: 'bottom',
            lang: 'zh-CN',
            loading: 'lazy'
          }
        }}
      />
    );
    expect(screen.getByText(/评论尚未启用/)).toBeInTheDocument();
    expect(screen.queryByTestId('giscus-mock')).toBeNull();
  });

  it('shows fallback message after timeout when iframe never reports ready', async () => {
    vi.useFakeTimers();
    const cfgMod = await import('@/app/lib/comments/comments-config');
    const prevRepoId = cfgMod.COMMENTS_CONFIG.giscus!.repoId;
    const prevCategoryId = cfgMod.COMMENTS_CONFIG.giscus!.categoryId;
    cfgMod.COMMENTS_CONFIG.giscus!.repoId = 'R_test';
    cfgMod.COMMENTS_CONFIG.giscus!.categoryId = 'DIC_test';
    try {
      const { Comments } = await import('@/app/lib/comments/comments');
      render(<Comments pathname="/courses/hi-agent/chat/01-getting-started/" />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(screen.getByText(/评论加载较慢或被网络拦截/)).toBeInTheDocument();
    } finally {
      cfgMod.COMMENTS_CONFIG.giscus!.repoId = prevRepoId;
      cfgMod.COMMENTS_CONFIG.giscus!.categoryId = prevCategoryId;
      vi.useRealTimers();
    }
  });
});
