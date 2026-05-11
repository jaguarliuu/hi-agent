'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export type PlaygroundTheme = 'dark' | 'light';

/**
 * 将 next-themes 的 resolvedTheme 归一化为 Playground 里直接可用的
 * 'dark' | 'light' 值。
 *
 * - SSR / 首次挂载阶段 resolvedTheme 可能是 undefined，此时回退到 'dark'，
 *   与现有抽屉视觉一致，避免浅色用户第一帧看到刺眼的主题闪烁。
 * - 用户选 system 时，next-themes 已经把实际生效值放到 resolvedTheme 里。
 */
export function usePlaygroundTheme(): PlaygroundTheme {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return 'dark';
  }

  return resolvedTheme === 'light' ? 'light' : 'dark';
}
