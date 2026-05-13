import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeSwitchRelocator } from '@/app/theme-switch-relocator';

function flushFrame() {
  return act(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ThemeSwitchRelocator', () => {
  it('removes the stock theme switch but keeps the sidebar collapse button', async () => {
    document.body.innerHTML = `
      <aside class="nextra-sidebar">
        <div class="nextra-sidebar-footer">
          <button title="Change theme">theme</button>
          <button title="Collapse sidebar" aria-expanded="true">collapse</button>
        </div>
      </aside>
    `;

    render(<ThemeSwitchRelocator />);
    await flushFrame();

    expect(
      document.querySelector('button[title="Change theme"]')
    ).toBeNull();
    expect(
      document.querySelector('button[title="Collapse sidebar"]')
    ).not.toBeNull();
    expect(document.querySelector('.nextra-sidebar-footer')).not.toBeNull();
  });

  it('still removes the navbar theme switch listbox', async () => {
    document.body.innerHTML = `
      <header class="nextra-navbar">
        <button title="Change theme">theme</button>
      </header>
    `;

    render(<ThemeSwitchRelocator />);
    await flushFrame();

    expect(
      document.querySelector('button[title="Change theme"]')
    ).toBeNull();
    expect(document.querySelector('.nextra-navbar')).not.toBeNull();
  });
});
