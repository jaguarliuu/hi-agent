import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function cssBlock(selector: string) {
  const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  return match?.[1] ?? '';
}

describe('studio dialog layout', () => {
  it('keeps dialog actions visible whether the overlay scrolls or the body scrolls', () => {
    // 经过几轮回归后，对话框采用「双重保险」的可滚布局：
    //   1) overlay 自身 overflow-y:auto + align-items:flex-start
    //      —— 即便 dialog 总高超过视口，整体也能从顶部往下滚
    //   2) dialog 内部仍然 max-height + flex-column，body 内可独立滚动
    //      —— 视口够高时，footer 与按钮一直可见、不需要滚动
    // 任何一种条件失效都不会让 footer 消失。
    const overlay = cssBlock('.studio-dialog-overlay');
    const dialog = cssBlock('.studio-dialog');
    const body = cssBlock('.studio-dialog__body');
    const footer = cssBlock('.studio-dialog__footer');

    // overlay：固定全屏 + 自身可滚
    expect(overlay).toContain('position: fixed');
    expect(overlay).toContain('overflow-y: auto');

    // dialog：flex column 撑开 header / body / footer
    expect(dialog).toContain('display: flex');
    expect(dialog).toContain('flex-direction: column');
    expect(dialog).toMatch(/max-height:\s*calc\(100vh/);

    // body：可在内部滚动；min-height: 0 让 flex 能正确收缩
    expect(body).toContain('overflow-y: auto');
    expect(body).toContain('min-height: 0');

    // footer：永不被压缩
    expect(footer).toContain('flex-shrink: 0');
  });

  it('overrides studio-mode chrome hiding for dialog action footers', () => {
    // body.studio-mode { footer { display: none } } 会一刀切隐藏所有 footer——
    // dialog 的 .studio-dialog__footer 必须显式 override，否则按钮会消失。
    const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');

    expect(css).toContain('body.studio-mode footer');
    expect(css).toMatch(
      /body\.studio-mode\s+\.studio-dialog__footer\s*\{[\s\S]*display:\s*flex\s*!important/
    );
  });

  it('lifts dialog overlay above the studio shell stacking context', () => {
    // .studio-shell 自己 z-index: 9999；dialog overlay 必须更高，
    // 否则即便 portal 到 body，也会被 studio-shell 创建的层叠上下文盖住。
    const overlay = cssBlock('.studio-dialog-overlay');
    const match = overlay.match(/z-index:\s*(\d+)/);
    expect(match).not.toBeNull();
    const z = Number(match![1]);
    expect(z).toBeGreaterThanOrEqual(10000);
  });
});
