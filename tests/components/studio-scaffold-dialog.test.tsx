import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CourseNode } from '@/app/studio/_lib/file-api-client';

const courses: CourseNode[] = [
  {
    slug: 'hi-agent',
    title: 'Hi-Agent',
    status: 'live',
    chapters: [{ slug: 'chat', files: [] }]
  }
];

function mountAppCss() {
  const style = document.createElement('style');
  style.dataset.testStyle = 'app-globals';
  style.textContent = readFileSync(
    path.join(process.cwd(), 'app', 'globals.css'),
    'utf8'
  );
  document.head.append(style);
  return style;
}

afterEach(() => {
  // testing-library 自带 cleanup() 会卸载组件树并移除其挂载点，
  // 我们手动只清掉副作用相关的内容（注入的 style + studio-mode class）。
  cleanup();
  document.body.className = '';
  document.head
    .querySelectorAll('style[data-test-style="app-globals"]')
    .forEach((node) => node.remove());
});

describe('ScaffoldDialog', () => {
  // ScaffoldDialog 经历过几轮回归：footer 被父级 overflow:hidden 裁切、
  // .studio-mode footer { display: none } 误伤、portal 后 stacking 错位等。
  // 这个 smoke test 锁住一条最低基线：在 studio-mode body 下、open=true 时，
  // 「创建并打开」按钮必须可见——即按钮没被 CSS / 渲染逻辑藏起来。
  it('renders the primary action button when open inside studio mode', async () => {
    vi.stubGlobal('React', React);
    const { ScaffoldDialog } = await import(
      '@/app/studio/_components/scaffold-dialog'
    );
    mountAppCss();
    document.body.classList.add('studio-mode');

    render(
      <ScaffoldDialog
        open
        courses={courses}
        defaultCourse="hi-agent"
        defaultChapter="chat"
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    const btn = await screen.findByRole('button', { name: '创建并打开' });
    expect(btn).toBeInTheDocument();
  });

  it('mounts the dialog via a portal directly under document.body', async () => {
    // 用 portal 挂到 body 是为了脱离 .studio-shell 的 overflow:hidden
    // 与 stacking context；如果未来有人改回直接渲染在 shell 内，
    // 这条用例会回归提醒。
    vi.stubGlobal('React', React);
    const { ScaffoldDialog } = await import(
      '@/app/studio/_components/scaffold-dialog'
    );

    const { container } = render(
      <div data-testid="host">
        <ScaffoldDialog
          open
          courses={courses}
          onClose={vi.fn()}
          onCreated={vi.fn()}
        />
      </div>
    );

    await screen.findByRole('button', { name: '创建并打开' });
    // host 节点内不应包含 dialog overlay——它应被 portal 到 body 顶层
    expect(container.querySelector('.studio-dialog-overlay')).toBeNull();
    expect(
      document.body.querySelector('.studio-dialog-overlay')
    ).not.toBeNull();
  });
});
