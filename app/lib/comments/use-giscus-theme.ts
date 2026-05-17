'use client';

import { useEffect, useState } from 'react';

export type GiscusTheme = 'light' | 'dark' | 'preferred_color_scheme';

function readDocumentTheme(): GiscusTheme {
  if (typeof document === 'undefined') return 'preferred_color_scheme';
  const root = document.documentElement;
  if (root.classList.contains('dark')) return 'dark';
  if (root.classList.contains('light')) return 'light';
  const dataTheme = root.getAttribute('data-theme');
  if (dataTheme === 'dark') return 'dark';
  if (dataTheme === 'light') return 'light';
  return 'preferred_color_scheme';
}

export function useGiscusTheme(): GiscusTheme {
  const [theme, setTheme] = useState<GiscusTheme>('preferred_color_scheme');

  useEffect(() => {
    setTheme(readDocumentTheme());

    if (typeof MutationObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(readDocumentTheme());
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
