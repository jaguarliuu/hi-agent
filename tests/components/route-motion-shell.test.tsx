import React, { useEffect } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '@/app/lib/motion/motion-context';
import { RouteMotionShell } from '@/app/lib/motion/route-motion-shell';

const { intersectionState, pathnameState } = vi.hoisted(() => ({
  intersectionState: {
    callback: null as IntersectionObserverCallback | null,
  },
  pathnameState: { value: '/docs/route-motion' },
}));

vi.mock('nextra-theme-docs', async () => {
  const { ThemeProvider } = await import('next-themes');

  return {
    Footer: ({ children }: { children?: React.ReactNode }) => (
      <footer>{children}</footer>
    ),
    Navbar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Layout: ({ children }: { children?: React.ReactNode }) => (
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
      >
        <main data-testid="docs-main">{children}</main>
      </ThemeProvider>
    ),
  };
});

vi.mock('nextra/components', () => ({
  Banner: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Head: () => null,
  Search: () => <div>search</div>,
}));

vi.mock('nextra/page-map', () => ({
  getPageMap: vi.fn().mockResolvedValue([]),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
}));

async function renderRootLayoutBody() {
  const { default: RootLayout } = await import('@/app/layout');
  const root = await RootLayout({
    children: (
      <article data-testid="page-content">
        <h1>Route motion page</h1>
        <p>Body copy stays semantic.</p>
      </article>
    ),
  });

  const body = React.Children.toArray(root.props.children).find(
    (child) => React.isValidElement(child) && child.type === 'body'
  ) as React.ReactElement<{ children: React.ReactNode }> | undefined;

  if (!body) {
    throw new Error('RootLayout did not render a body element');
  }

  let rendered: ReturnType<typeof render> | undefined;

  await act(async () => {
    rendered = render(body.props.children);
    await Promise.resolve();
  });

  if (!rendered) {
    throw new Error('Failed to render RootLayout body');
  }

  return rendered;
}

describe('RootLayout route motion shell', () => {
  beforeEach(() => {
    intersectionState.callback = null;
    pathnameState.value = '/docs/route-motion';
    (
      globalThis as typeof globalThis & { React?: typeof React }
    ).React = React;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    window.IntersectionObserver = vi.fn().mockImplementation((callback) => {
      intersectionState.callback = callback;

      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        takeRecords: vi.fn().mockReturnValue([]),
        root: null,
        rootMargin: '0px',
        thresholds: [],
      } satisfies IntersectionObserver;
    }) as unknown as typeof window.IntersectionObserver;
    document.documentElement.className = '';
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('wraps the page slot in a stable motion shell without changing main content semantics', async () => {
    await renderRootLayoutBody();

    const main = screen.getByTestId('docs-main');
    const shell = main.querySelector('[data-ha-route-shell="true"]');

    expect(shell).toBeTruthy();
    expect(shell).toHaveClass('ha-route-shell');
    expect(shell?.getAttribute('data-ha-view-transitions')).toBe('unsupported');

    const article = within(shell as HTMLElement).getByTestId('page-content');
    expect(article.tagName).toBe('ARTICLE');
    expect(within(article).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Route motion page'
    );
    expect(screen.getByTestId('docs-main').querySelectorAll('article')).toHaveLength(1);
  });

  it('reflects reduced motion and View Transitions support on the shell contract', async () => {
    document.startViewTransition = vi.fn();

    render(
      <MotionProvider value={{ reduced: true }}>
        <RouteMotionShell>
          <article data-testid="page-content">page</article>
        </RouteMotionShell>
      </MotionProvider>
    );

    const shell = screen.getByTestId('page-content').closest('[data-ha-route-shell="true"]');

    expect(shell).toBeTruthy();

    await waitFor(() => {
      expect(shell).toHaveAttribute('data-ha-view-transitions', 'supported');
    });

    expect(shell).toHaveAttribute('data-ha-reduced-motion', 'true');
  });

  it('replays the stage mount when pathname changes and exposes a stable active TOC marker', async () => {
    const onMount = vi.fn();

    function MountProbe() {
      useEffect(() => {
        onMount();
      }, []);

      return (
        <>
          <article data-testid="page-content">page</article>
          <a
            href="#intro"
            className="subheading-anchor"
            data-testid="heading-intro"
          />
          <a
            href="#details"
            className="subheading-anchor"
            data-testid="heading-details"
          />
        </>
      );
    }

    const { rerender } = render(
      <MotionProvider>
        <div className="x:sticky">
          <ul className="nextra-scrollbar">
            <li>
              <a href="#intro">
                Intro
              </a>
            </li>
            <li>
              <a href="#details">
                Details
              </a>
            </li>
          </ul>
        </div>
        <RouteMotionShell>
          <MountProbe />
        </RouteMotionShell>
      </MotionProvider>
    );

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('page-content').closest('[data-ha-route-stage]')).toHaveAttribute(
      'data-ha-route-stage',
      '/docs/route-motion'
    );

    act(() => {
      intersectionState.callback?.([
        {
          isIntersecting: true,
          target: screen.getByTestId('heading-intro'),
        } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    await waitFor(() => {
      expect(screen.getByText('Intro')).toHaveAttribute('data-ha-toc-active', 'true');
    });

    pathnameState.value = '/docs/route-motion/next';

    await act(async () => {
      rerender(
        <MotionProvider>
          <div className="x:sticky">
            <ul className="nextra-scrollbar">
              <li>
                <a href="#intro">
                  Intro
                </a>
              </li>
              <li>
                <a href="#details">
                  Details
                </a>
              </li>
            </ul>
          </div>
          <RouteMotionShell>
            <MountProbe />
          </RouteMotionShell>
        </MotionProvider>
      );
      await Promise.resolve();
    });

    act(() => {
      intersectionState.callback?.([
        {
          isIntersecting: true,
          target: screen.getByTestId('heading-details'),
        } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    await waitFor(() => {
      expect(onMount).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByTestId('page-content').closest('[data-ha-route-stage]')).toHaveAttribute(
      'data-ha-route-stage',
      '/docs/route-motion/next'
    );

    await waitFor(() => {
      expect(screen.getByText('Intro')).not.toHaveAttribute('data-ha-toc-active');
      expect(screen.getByText('Details')).toHaveAttribute('data-ha-toc-active', 'true');
    });
  });
});
