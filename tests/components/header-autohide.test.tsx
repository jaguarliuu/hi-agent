import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeaderAutohide } from '@/app/lib/header-autohide';

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value,
  });
}

function flushRaf() {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe('<HeaderAutohide>', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete document.documentElement.dataset.haHeader;
    delete document.documentElement.dataset.haPlayground;
    setScrollY(0);
  });

  afterEach(() => {
    delete document.documentElement.dataset.haHeader;
    delete document.documentElement.dataset.haPlayground;
  });

  it('starts visible by default', async () => {
    render(<HeaderAutohide />);
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('visible');
  });

  it('collapses when playground is open and restores when it closes', async () => {
    render(<HeaderAutohide />);
    await flushRaf();

    act(() => {
      document.documentElement.dataset.haPlayground = 'open';
    });
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('collapsed');

    act(() => {
      delete document.documentElement.dataset.haPlayground;
    });
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('visible');
  });

  it('collapses on meaningful downward scroll and restores on scroll up', async () => {
    render(<HeaderAutohide />);
    await flushRaf();

    setScrollY(240);
    fireEvent.scroll(window);
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('collapsed');

    setScrollY(180);
    fireEvent.scroll(window);
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('visible');
  });

  it('reveals header when pointer moves near the top of the viewport', async () => {
    render(<HeaderAutohide />);
    await flushRaf();
    act(() => {
      document.documentElement.dataset.haPlayground = 'open';
    });
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('collapsed');

    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { clientY: 20, bubbles: true })
      );
    });
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('visible');

    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { clientY: 400, bubbles: true })
      );
    });
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('collapsed');
  });

  it('reveals header when a descendant of .nextra-navbar gains keyboard focus', async () => {
    const nav = document.createElement('nav');
    nav.className = 'nextra-navbar';
    const input = document.createElement('input');
    nav.appendChild(input);
    document.body.appendChild(nav);

    render(<HeaderAutohide />);
    await flushRaf();

    act(() => {
      document.documentElement.dataset.haPlayground = 'open';
    });
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('collapsed');

    act(() => {
      input.focus();
    });
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('visible');

    act(() => {
      input.blur();
    });
    await flushRaf();
    expect(document.documentElement.dataset.haHeader).toBe('collapsed');
  });
});
