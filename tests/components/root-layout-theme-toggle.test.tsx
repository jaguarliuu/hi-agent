import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nextra-theme-docs', async () => {
  const { ThemeProvider } = await import('next-themes');

  return {
    Footer: ({ children }: { children?: React.ReactNode }) => (
      <footer>{children}</footer>
    ),
    Navbar: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Layout: ({ children }: { children?: React.ReactNode }) => (
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
      >
        <div className="nextra-navbar">
          <nav>
            <button className="nextra-hamburger" type="button">
              menu
            </button>
          </nav>
        </div>
        <main>{children}</main>
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

async function waitForPortal() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

async function renderRootLayoutBody() {
  const { default: RootLayout } = await import('@/app/layout');
  const root = await RootLayout({
    children: <div data-testid="page">page</div>,
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

describe('RootLayout theme toggle wiring', () => {
  beforeEach(() => {
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
    document.documentElement.className = '';
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('toggles the document theme when the navbar button is clicked', async () => {
    await renderRootLayoutBody();
    await waitForPortal();

    const toggle = screen.getByRole('button', { name: '切换到深色主题' });
    await act(async () => {
      fireEvent.click(toggle);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
    });
  });
});
